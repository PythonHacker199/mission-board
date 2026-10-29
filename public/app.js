// Mission Board frontend — plain JavaScript, no framework.
// The JWT from login is kept in localStorage and sent with every API request.

const TOKEN_KEY = 'missionBoard:token';
const $ = (sel) => document.querySelector(sel);

let authMode = 'login';     // 'login' or 'signup'
let missions = [];          // the current list from the server
let editingId = null;       // id of the mission open in the edit dialog

// ---------- API helper ----------
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && token) {
    // Token expired or invalid: send the user back to the login screen.
    logout('Your session expired. Please log in again.');
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- Views ----------
function showAuth(message = '') {
  $('#app-view').hidden = true;
  $('#auth-view').hidden = false;
  $('#auth-error').textContent = message;
}

function showApp(user) {
  $('#auth-view').hidden = true;
  $('#app-view').hidden = false;
  $('#user-name').textContent = `Signed in as ${user.name}`;
  loadMissions();
}

function logout(message) {
  localStorage.removeItem(TOKEN_KEY);
  missions = [];
  showAuth(message);
}

// ---------- Auth ----------
function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('.tab').forEach((t) => {
    const active = t.dataset.mode === mode;
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-selected', active);
  });
  $('#name-field').hidden = mode !== 'signup';
  $('#password-hint').hidden = mode !== 'signup';
  $('#auth-submit').textContent = mode === 'signup' ? 'Create account' : 'Log in';
  $('#auth-form [name=password]').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  $('#auth-error').textContent = '';
}

document.querySelectorAll('.tab').forEach((tab) =>
  tab.addEventListener('click', () => setAuthMode(tab.dataset.mode))
);

$('#auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const body = { email: form.get('email'), password: form.get('password') };
  if (authMode === 'signup') body.name = form.get('name');

  const button = $('#auth-submit');
  button.disabled = true;
  try {
    const { token, user } = await api(`/auth/${authMode}`, { method: 'POST', body });
    localStorage.setItem(TOKEN_KEY, token);
    e.target.reset();
    showApp(user);
  } catch (err) {
    $('#auth-error').textContent = err.message; // shows the server's message, e.g. "Incorrect email or password"
  } finally {
    button.disabled = false;
  }
});

$('#logout-btn').addEventListener('click', () => logout());

// ---------- Missions ----------
async function loadMissions() {
  const params = new URLSearchParams();
  const status = $('#filter-status').value;
  const priority = $('#filter-priority').value;
  if (status) params.set('status', status);
  if (priority) params.set('priority', priority);

  try {
    const data = await api(`/missions?${params}`);
    missions = data.missions;
    renderMissions();
  } catch (err) {
    toast(err.message, true);
  }
}

function renderMissions() {
  const list = $('#mission-list');
  list.replaceChildren(); // clear

  $('#mission-count').textContent = missions.length;
  const filtered = $('#filter-status').value || $('#filter-priority').value;
  const empty = $('#empty-state');
  empty.hidden = missions.length > 0;
  empty.textContent = filtered
    ? 'No missions match these filters.'
    : 'No missions yet. Add your first one above — the city is counting on you.';

  for (const m of missions) {
    const li = document.createElement('li');
    li.className = `mission mission--${slug(m.status)}`;

    // textContent (not innerHTML) is used for user data, so a title like <script> is shown as text, not run.
    const top = el('div', 'mission__top');
    top.append(
      el('span', `pill pill--${slug(m.priority)}`, m.priority),
      el('h3', 'mission__title', m.title)
    );

    const desc = m.description ? el('p', 'mission__desc', m.description) : null;

    const bottom = el('div', 'mission__bottom');
    const statusSelect = document.createElement('select');
    statusSelect.className = 'status-select';
    statusSelect.setAttribute('aria-label', `Status of ${m.title}`);
    for (const s of ['To Do', 'In Progress', 'Done']) {
      const opt = new Option(s, s, false, s === m.status);
      statusSelect.add(opt);
    }
    statusSelect.addEventListener('change', () => updateMission(m.id, { status: statusSelect.value }));

    const actions = el('div', 'mission__actions');
    const editBtn = el('button', 'btn btn--ghost btn--sm', 'Edit');
    editBtn.type = 'button';
    editBtn.addEventListener('click', () => openEdit(m));
    const delBtn = el('button', 'btn btn--danger btn--sm', 'Delete');
    delBtn.type = 'button';
    delBtn.addEventListener('click', () => deleteMission(m));
    actions.append(editBtn, delBtn);

    bottom.append(statusSelect, actions);
    li.append(top, ...(desc ? [desc] : []), bottom);
    list.append(li);
  }
}

$('#create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const body = Object.fromEntries(form);
  $('#create-error').textContent = '';

  try {
    await api('/missions', { method: 'POST', body });
    e.target.reset();
    toast('Mission added');
    loadMissions();
  } catch (err) {
    $('#create-error').textContent = err.message; // e.g. "Title is required and cannot be empty"
  }
});

async function updateMission(id, changes) {
  try {
    await api(`/missions/${id}`, { method: 'PATCH', body: changes });
    toast('Mission updated');
    loadMissions();
  } catch (err) {
    toast(err.message, true);
    loadMissions();
  }
}

async function deleteMission(m) {
  if (!confirm(`Delete "${m.title}"? This can't be undone.`)) return;
  try {
    await api(`/missions/${m.id}`, { method: 'DELETE' });
    toast('Mission deleted');
    loadMissions();
  } catch (err) {
    toast(err.message, true);
  }
}

// ---------- Edit dialog ----------
const dialog = $('#edit-dialog');
const editForm = $('#edit-form');

function openEdit(m) {
  editingId = m.id;
  editForm.elements.title.value = m.title;
  editForm.elements.description.value = m.description;
  editForm.elements.priority.value = m.priority;
  editForm.elements.status.value = m.status;
  $('#edit-error').textContent = '';
  dialog.showModal();
}

$('#edit-cancel').addEventListener('click', () => dialog.close());

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(editForm));
  try {
    await api(`/missions/${editingId}`, { method: 'PATCH', body });
    dialog.close();
    toast('Mission updated');
    loadMissions();
  } catch (err) {
    $('#edit-error').textContent = err.message;
  }
});

// ---------- Filters ----------
$('#filter-status').addEventListener('change', loadMissions);
$('#filter-priority').addEventListener('change', loadMissions);

// ---------- Small helpers ----------
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function slug(s) {
  return s.toLowerCase().replace(/\s+/g, '-');
}

let toastTimer;
function toast(message, isError = false) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.toggle('toast--error', isError);
  t.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visible'), 2500);
}

// ---------- Start ----------
(async function init() {
  if (!localStorage.getItem(TOKEN_KEY)) return showAuth();
  try {
    const { user } = await api('/auth/me');
    showApp(user);
  } catch {
    showAuth();
  }
})();
