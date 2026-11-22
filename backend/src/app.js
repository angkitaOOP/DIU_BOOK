import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

const app = express();
app.disable('x-powered-by');
if (config.isProd) app.set('trust proxy', 1); // behind Render/Railway/Nginx so rate limiting sees real IPs

app.use(helmet());
// In development accept any localhost / LAN origin (5173, 5174, 127.0.0.1 ...). In production only CLIENT_URL.
const devOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\d{1,3}(\.\d{1,3}){3})(:\d+)?$/;
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || config.clientUrls.includes(origin) || (!config.isProd && devOrigin.test(origin))),
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } } }));
app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
