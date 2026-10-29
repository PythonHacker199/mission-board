const jwt = require('jsonwebtoken');

/**
 * Protects a route. Expects the header:  Authorization: Bearer <token>
 * On success it sets req.userId, which every mission query uses to stay
 * inside the logged-in user's own data.
 */
function requireAuth(secret) {
  return (req, res, next) => {
    const header = req.get('Authorization') || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Login required' });
    }

    try {
      const payload = jwt.verify(token, secret);
      req.userId = Number(payload.sub);
      next();
    } catch {
      // Expired, tampered with, or signed with a different secret.
      return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    }
  };
}

module.exports = { requireAuth };
