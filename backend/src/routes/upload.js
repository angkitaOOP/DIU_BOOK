import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError, asyncHandler } from '../utils/errors.js';
import { uploadBuffer } from '../utils/cloudinary.js';
import { auth } from '../middleware/auth.js';
import { mediaUpload, IMAGE_TYPES } from '../middleware/upload.js';

const router = Router();
router.use(auth, rateLimit({ windowMs: 10 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many uploads. Try again shortly.' } } }));

const FOLDERS = new Set(['avatars', 'covers', 'posts', 'clubs', 'events', 'projects']);

// POST /api/upload?folder=posts   multipart field "file"   -> { url, type, width, height }
router.post('/', mediaUpload, asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'Choose a file to upload.', 'NO_FILE');
  const folder = FOLDERS.has(req.query.folder) ? req.query.folder : 'posts';
  const isImage = IMAGE_TYPES.includes(req.file.mimetype);
  if (isImage && req.file.size > 5 * 1024 * 1024) throw new AppError(400, 'Images must be 5 MB or smaller.', 'FILE_TOO_LARGE');
  if (!isImage && folder !== 'posts') throw new AppError(400, 'Only images are allowed here.', 'BAD_FILE_TYPE');
  const r = await uploadBuffer(req.file.buffer, { folder, resourceType: isImage ? 'image' : 'video' });
  res.status(201).json({ url: r.secure_url, type: isImage ? 'image' : 'video', width: r.width, height: r.height });
}));

export default router;
