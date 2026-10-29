const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { HttpError, validateSignup, validateLogin } = require('../validation');
const { requireAuth } = require('../middleware/auth');

const SALT_ROUNDS = 10; // each extra round doubles the hashing time

function authRoutes(db, secret) {
  const router = express.Router();

  const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
  const findById = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?');
  const insertUser = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');

  const issueToken = (user) => jwt.sign({ sub: String(user.id) }, secret, { expiresIn: '7d' });
  const publicUser = ({ id, name, email }) => ({ id, name, email });

  // POST /api/auth/signup
  router.post('/signup', async (req, res) => {
    const error = validateSignup(req.body);
    if (error) throw new HttpError(400, error);

    const name = req.body.name.trim();
    const email = req.body.email.trim().toLowerCase();

    if (findByEmail.get(email)) throw new HttpError(409, 'An account with this email already exists');

    // Never store the plain password. bcrypt adds a random salt and is deliberately slow,
    // which makes guessing passwords from a leaked database very expensive.
    const passwordHash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
    const { lastInsertRowid } = insertUser.run(name, email, passwordHash);
    const user = findById.get(lastInsertRowid);

    res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  });

  // POST /api/auth/login
  router.post('/login', async (req, res) => {
    const error = validateLogin(req.body);
    if (error) throw new HttpError(400, error);

    const user = findByEmail.get(req.body.email.trim().toLowerCase());
    const passwordOk = user && (await bcrypt.compare(req.body.password, user.password_hash));

    // Same message for "no such email" and "wrong password", so an attacker
    // can't use this endpoint to find out which emails are registered.
    if (!passwordOk) throw new HttpError(401, 'Incorrect email or password');

    res.json({ token: issueToken(user), user: publicUser(user) });
  });

  // GET /api/auth/me  — who am I? (used by the frontend to check a saved token)
  router.get('/me', requireAuth(secret), (req, res) => {
    const user = findById.get(req.userId);
    if (!user) throw new HttpError(401, 'Account no longer exists');
    res.json({ user: publicUser(user) });
  });

  return router;
}

module.exports = { authRoutes };
