// Run with: npm test
// Starts the app on a random port with a fresh in-memory database and calls the real HTTP API.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createDb } = require('../src/db');

let server, base, db;

before(async () => {
  db = createDb(':memory:');
  const app = createApp({ db, jwtSecret: 'test-secret' });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://localhost:${server.address().port}/api`;
});

after(() => server.close());

async function call(method, path, { body, token, raw } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, { method, headers, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data };
}

let peter, miles, missionId;

test('signup creates a user and returns a token (201)', async () => {
  const r = await call('POST', '/auth/signup', { body: { name: 'Peter', email: 'Peter@Bugle.com', password: 'webs4life' } });
  assert.equal(r.status, 201);
  assert.ok(r.data.token);
  assert.equal(r.data.user.email, 'peter@bugle.com');
  assert.equal(r.data.user.password_hash, undefined, 'hash must never be sent to the client');
  peter = r.data.token;

  const m = await call('POST', '/auth/signup', { body: { name: 'Miles', email: 'miles@brooklyn.com', password: 'venomblast' } });
  miles = m.data.token;
});

test('password is stored hashed, not in plain text', () => {
  const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('peter@bugle.com');
  assert.notEqual(row.password_hash, 'webs4life');
  assert.match(row.password_hash, /^\$2[aby]\$10\$/); // bcrypt format, cost 10
});

test('duplicate email is rejected (409), case-insensitively', async () => {
  const r = await call('POST', '/auth/signup', { body: { name: 'Fake', email: 'PETER@bugle.com', password: 'whatever1' } });
  assert.equal(r.status, 409);
  assert.match(r.data.error, /already exists/);
});

test('signup validation errors (400)', async () => {
  for (const body of [
    { email: 'a@b.com', password: 'longenough' },              // no name
    { name: 'A', email: 'not-an-email', password: 'longenough' },
    { name: 'A', email: 'a@b.com', password: 'short' },
  ]) {
    const r = await call('POST', '/auth/signup', { body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.ok(r.data.error);
  }
});

test('wrong password and unknown email both give 401 with the same message', async () => {
  const a = await call('POST', '/auth/login', { body: { email: 'peter@bugle.com', password: 'wrongpass' } });
  const b = await call('POST', '/auth/login', { body: { email: 'nobody@x.com', password: 'wrongpass' } });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.data.error, b.data.error);
});

test('correct login returns a token (200)', async () => {
  const r = await call('POST', '/auth/login', { body: { email: 'peter@bugle.com', password: 'webs4life' } });
  assert.equal(r.status, 200);
  assert.ok(r.data.token);
});

test('missions require a valid token (401)', async () => {
  assert.equal((await call('GET', '/missions')).status, 401);
  assert.equal((await call('GET', '/missions', { token: 'garbage' })).status, 401);
});

test('create mission (201) and validation (400)', async () => {
  const r = await call('POST', '/missions', {
    token: peter,
    body: { title: '  Stop the heist  ', description: 'Canal St', priority: 'High' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.mission.title, 'Stop the heist'); // trimmed
  assert.equal(r.data.mission.status, 'To Do');         // default
  missionId = r.data.mission.id;

  assert.equal((await call('POST', '/missions', { token: peter, body: { title: '   ' } })).status, 400);
  assert.equal((await call('POST', '/missions', { token: peter, body: { title: 'x', priority: 'Urgent' } })).status, 400);
  assert.equal((await call('POST', '/missions', { token: peter, body: { title: 'x', status: 'Maybe' } })).status, 400);
  assert.equal((await call('POST', '/missions', { token: peter, raw: '{bad json' })).status, 400);
});

test("a user never sees or touches someone else's missions (404)", async () => {
  const list = await call('GET', '/missions', { token: miles });
  assert.equal(list.data.missions.length, 0);

  assert.equal((await call('GET', `/missions/${missionId}`, { token: miles })).status, 404);
  assert.equal((await call('PATCH', `/missions/${missionId}`, { token: miles, body: { title: 'hacked' } })).status, 404);
  assert.equal((await call('DELETE', `/missions/${missionId}`, { token: miles })).status, 404);

  const still = await call('GET', `/missions/${missionId}`, { token: peter });
  assert.equal(still.data.mission.title, 'Stop the heist');
});

test('edit mission with PATCH (200)', async () => {
  const r = await call('PATCH', `/missions/${missionId}`, { token: peter, body: { status: 'In Progress' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.mission.status, 'In Progress');
  assert.equal(r.data.mission.title, 'Stop the heist'); // untouched fields stay the same

  assert.equal((await call('PATCH', `/missions/${missionId}`, { token: peter, body: {} })).status, 400);
  assert.equal((await call('PATCH', `/missions/${missionId}`, { token: peter, body: { title: '' } })).status, 400);
  assert.equal((await call('PATCH', '/missions/abc', { token: peter, body: { title: 'x' } })).status, 400);
});

test('filter by status and priority', async () => {
  await call('POST', '/missions', { token: peter, body: { title: 'Physics homework', priority: 'Low', status: 'Done' } });
  await call('POST', '/missions', { token: peter, body: { title: 'Fix web shooters', priority: 'High' } });

  const high = await call('GET', '/missions?priority=High', { token: peter });
  assert.equal(high.data.missions.length, 2);
  const done = await call('GET', '/missions?status=Done', { token: peter });
  assert.deepEqual(done.data.missions.map((m) => m.title), ['Physics homework']);
  const both = await call('GET', '/missions?status=To%20Do&priority=High', { token: peter });
  assert.deepEqual(both.data.missions.map((m) => m.title), ['Fix web shooters']);
  assert.equal((await call('GET', '/missions?status=Nope', { token: peter })).status, 400);
});

test('delete mission (204), then it is gone (404)', async () => {
  assert.equal((await call('DELETE', `/missions/${missionId}`, { token: peter })).status, 204);
  assert.equal((await call('GET', `/missions/${missionId}`, { token: peter })).status, 404);
});

test('unknown API route gives 404 JSON', async () => {
  const r = await call('GET', '/nope');
  assert.equal(r.status, 404);
  assert.ok(r.data.error);
});
