require('dotenv').config();
const { createApp } = require('./app');
const { createDb } = require('./db');

const PORT = process.env.PORT || 3000;
let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('JWT_SECRET must be set in production. See .env.example');
    process.exit(1);
  }
  JWT_SECRET = 'dev-only-secret-change-me';
  console.warn('⚠️  JWT_SECRET not set — using an insecure development secret.');
}

const app = createApp({ db: createDb(), jwtSecret: JWT_SECRET });

app.listen(PORT, () => {
  console.log(`🕷️  Mission Board running at http://localhost:${PORT}`);
});
