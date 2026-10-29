# Mission Board 🕸️

A RESTful API with a database and a plain HTML/JS frontend, where Peter Parker keeps track of his missions. Built for The CodeBreakers Club Backend task (1st year).

**Stack:** Node.js · Express 5 · SQLite (better-sqlite3) · bcryptjs · JSON Web Tokens
**Live demo:** https://mission-board.onrender.com/ (free hosting: the first visit after 15 minutes idle can take ~30–50 seconds to wake up)

## Features

| Requirement | How it's done |
|---|---|
| Sign up and login, passwords hashed | `bcryptjs` with 10 salt rounds. Only the hash is stored in `users.password_hash`, and it is never sent back to the client |
| Add, view, edit, delete your own missions | `POST / GET / PATCH / DELETE /api/missions`, with title, description, priority (Low/Medium/High) and status (To Do/In Progress/Done) |
| A user never sees someone else's missions | Every SQL query includes `WHERE user_id = ?` with the id from the verified JWT. Another user's mission returns **404**, so its existence isn't revealed |
| Proper status codes and error messages | 400 bad input, 401 not logged in / wrong password, 404 not found, 409 duplicate email, 201 created, 204 deleted. Every error is JSON: `{ "error": "..." }` |
| Simple frontend with login page and missions list | `public/` — plain HTML, CSS and JS served by the same Express server |
| **Bonus:** filter by status or priority | `GET /api/missions?status=Done&priority=High`, plus dropdowns in the UI |
| **Bonus:** deploy | See "Deploy" below |

## Run it locally

```bash
npm install
cp .env.example .env      # then set JWT_SECRET to a long random string
npm start                 # http://localhost:3000
npm test                  # 13 API tests
```

Requires Node 22+. The SQLite file is created automatically at `data/missions.db`.

## API reference

All mission routes need the header `Authorization: Bearer <token>`.

| Method | Route | Body | Success | Errors |
|---|---|---|---|---|
| POST | `/api/auth/signup` | `{ name, email, password }` | 201 `{ token, user }` | 400 invalid input, 409 email already used |
| POST | `/api/auth/login` | `{ email, password }` | 200 `{ token, user }` | 400 missing fields, 401 wrong email or password |
| GET | `/api/auth/me` | — | 200 `{ user }` | 401 |
| GET | `/api/missions?status=&priority=` | — | 200 `{ missions }` | 400 bad filter, 401 |
| POST | `/api/missions` | `{ title, description?, priority?, status? }` | 201 `{ mission }` | 400 empty title / bad priority or status, 401 |
| GET | `/api/missions/:id` | — | 200 `{ mission }` | 400 bad id, 401, 404 |
| PATCH | `/api/missions/:id` | any of the mission fields | 200 `{ mission }` | 400, 401, 404 |
| DELETE | `/api/missions/:id` | — | 204 | 401, 404 |

Example:

```bash
curl -X POST localhost:3000/api/auth/signup -H "Content-Type: application/json" \
  -d '{"name":"Peter","email":"peter@bugle.com","password":"webs4life"}'
```

## Database

```
users                          missions
-----                          --------
id (PK)                        id (PK)
name                           user_id (FK → users.id, ON DELETE CASCADE)
email (UNIQUE, case-insens.)   title
password_hash                  description
created_at                     priority  CHECK IN ('Low','Medium','High')
                               status    CHECK IN ('To Do','In Progress','Done')
                               created_at, updated_at
```

The database enforces the allowed values too (`CHECK` constraints), so bad data can't get in even if a route has a bug.

## Folder structure

```
src/
├── server.js          reads .env, opens the DB, starts the server
├── app.js             builds the Express app (routes, static files, error handler)
├── db.js              SQLite connection + table creation
├── validation.js      input checks + HttpError class
├── middleware/auth.js checks the JWT and sets req.userId
└── routes/
    ├── auth.js        signup, login, me
    └── missions.js    CRUD + filters
public/                login page + missions list (HTML/CSS/JS)
tests/api.test.js      end-to-end API tests (node:test)
```

## Security notes

- **Hashed passwords:** bcrypt is slow on purpose and salts every password, so identical passwords produce different hashes.
- **Same login error for unknown email and wrong password,** so the login form can't be used to discover who has an account.
- **Parameterised SQL everywhere** (`?` placeholders), which prevents SQL injection.
- **Frontend uses `textContent`, never `innerHTML`,** for user data, which prevents stored XSS.
- **JWTs expire after 7 days.** The secret comes from an environment variable and is never committed.

## Deploy (Render, free tier)

1. Push this folder to a public GitHub repo.
2. On render.com → New → Web Service → connect the repo.
3. Build command `npm install`, start command `npm start`.
4. Add environment variables `JWT_SECRET` (long random string) and `NODE_ENV=production`.

Note: on free hosting the disk resets on redeploy, so the SQLite data is wiped. That's fine for a demo. For real use, add a persistent disk or switch to a hosted database.

## AI usage

AI tools were used to build this project. [AI_USAGE.md](AI_USAGE.md) explains what AI did, what I did, and the key ideas in my own words.
