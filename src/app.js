const path = require('path');
const express = require('express');
const { authRoutes } = require('./routes/auth');
const { missionRoutes } = require('./routes/missions');
const { requireAuth } = require('./middleware/auth');

/**
 * Builds the Express app. The database and secret are passed in,
 * so tests can use a fresh in-memory database.
 */
function createApp({ db, jwtSecret }) {
  if (!jwtSecret) throw new Error('JWT secret is required');

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));

  // The plain HTML/JS frontend is served from the same server, so no CORS setup is needed.
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes(db, jwtSecret));
  app.use('/api/missions', requireAuth(jwtSecret), missionRoutes(db));

  // Unknown API route
  app.use('/api', (req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` }));

  // Central error handler. Express 5 forwards errors thrown in async handlers here automatically.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body must be valid JSON' });
    }
    if (err.status && err.status < 500) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side' });
  });

  return app;
}

module.exports = { createApp };
