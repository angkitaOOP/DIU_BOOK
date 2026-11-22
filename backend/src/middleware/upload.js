import multer from 'multer';
import { AppError } from '../utils/errors.js';

const IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VID = ['video/mp4', 'video/webm', 'video/quicktime'];

const make = (allowed, maxBytes) => multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: 1 },
  fileFilter: (_req, file, cb) =>
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new AppError(400, 'This file type is not allowed.', 'BAD_FILE_TYPE')),
});

export const imageUpload = make(IMG, 5 * 1024 * 1024).single('file');
export const mediaUpload = make([...IMG, ...VID], 50 * 1024 * 1024).single('file');
export const proofUpload = make([...IMG, 'application/pdf'], 5 * 1024 * 1024).single('proof');
export const IMAGE_TYPES = IMG;
