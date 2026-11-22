import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from '../db.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export const signToken = user => jwt.sign({ sub: user.id, role: user.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

export const verifyToken = token => {
  try { return jwt.verify(token, config.jwt.secret); }
  catch { throw new AppError(401, 'Your session has expired. Please sign in again.', 'INVALID_TOKEN'); }
};

export const loadUser = id => one('SELECT id, name, email, role, status, avatar_url, settings FROM users WHERE id = ?', [id]);

export const auth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new AppError(401, 'Please sign in to continue.', 'UNAUTHENTICATED');
  const payload = verifyToken(header.slice(7));
  const user = await loadUser(payload.sub);
  if (!user || user.status !== 'active') throw new AppError(401, 'This account cannot be used right now.', 'ACCOUNT_INACTIVE');
  req.user = user;
  next();
});

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError(403, 'You do not have permission to do that.', 'FORBIDDEN'));
