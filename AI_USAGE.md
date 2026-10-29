# How AI was used in this project

The task rules allow AI tools, as long as I understand and can explain my code. This file says plainly what AI did, what I did, and how I checked that I understand the result.

## What AI did

| Part | AI's role |
|---|---|
| Most of the code (Express routes, auth middleware, database setup, validation, frontend, tests) | An AI coding assistant (Claude) wrote the first versions from the task requirements |
| Debugging and explanations | I asked AI to explain errors and concepts I hadn't used before (bcrypt salting, JWTs, parameterised SQL, status codes) |
| Docs | AI helped draft this file and the README |

## What I did

- Gave the requirements and reviewed every file until I could explain why each piece is there (see below).
- Checked that it works: `npm test` runs 13 API tests and all of them pass.

## Can I explain it? The key ideas, in my own words

**Walk through a login.**
The client sends email and password. The server finds the user by email, and `bcrypt.compare` checks the password against the stored hash. If it matches, the server signs a JWT containing the user's ID (`sub`). The client sends it back as `Authorization: Bearer <token>`, and `middleware/auth.js` verifies it and sets `req.userId`.

**Why hash passwords instead of encrypting them?**
Hashing is one-way, so even we can't recover a password if the database leaks. bcrypt adds a random salt (identical passwords give different hashes) and is deliberately slow (cost 10), which makes brute force expensive.

**How do users never see each other's missions?**
Every query has `WHERE user_id = ?`, and the ID comes from the verified token, never from the request body.

**Why 404 and not 403 for someone else's mission?**
A 403 would confirm that the mission exists. A 404 reveals nothing.

**Why the same error for "unknown email" and "wrong password"?**
Otherwise the login form could be used to find out which emails have accounts (user enumeration).

**How is SQL injection prevented?**
Every value goes through `?` placeholders, so the database treats user input as data, never as SQL code.

**Why `PATCH` and not `PUT`?**
PATCH is a partial update: you can send only `{ "status": "Done" }`. PUT conventionally replaces the whole resource.

**Why is `createApp` separate from `server.js`?**
Tests can build the app with an in-memory database, without touching the real data file.

## Known limitations

- The JWT is stored in `localStorage`, which an XSS bug could read. User data is rendered with `textContent` to reduce that risk, but httpOnly cookies would be safer.
- SQLite on free hosting is wiped on every redeploy. That's fine for a demo; production would use a hosted database.
- There's no rate limiting on login yet.
