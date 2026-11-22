import 'dotenv/config';

const env = process.env;
const isProd = env.NODE_ENV === 'production';

if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET is missing or shorter than 32 characters.\n' +
    '  1) Copy .env.example to a file named exactly ".env" in the backend folder.\n' +
    '  2) Put a long random value in JWT_SECRET (generate: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))").');
}

export const config = {
  isProd,
  port: +(env.PORT || 5000),
  clientUrls: (env.CLIENT_URL || 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean),
  db: {
    host: env.DB_HOST || 'localhost',
    port: +(env.DB_PORT || 3306),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'diulink',
  },
  jwt: { secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN || '7d' },
  bcryptRounds: 12,
  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: env.CLOUDINARY_API_KEY || '',
    apiSecret: env.CLOUDINARY_API_SECRET || '',
  },
  smtp: {
    host: env.SMTP_HOST || '', port: +(env.SMTP_PORT || 587),
    user: env.SMTP_USER || '', pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'DIULink <no-reply@diulink.app>',
  },
};
