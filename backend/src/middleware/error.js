import multer from 'multer';
import { AppError } from '../utils/errors.js';
import { config } from '../config.js';

export const notFoundHandler = (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large.' : 'Upload failed.';
    return res.status(400).json({ error: { code: err.code, message: msg } });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Invalid JSON body' } });
  if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: { code: 'DUPLICATE', message: 'That already exists.' } });
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: config.isProd ? 'Something went wrong.' : String(err.message) } });
};
