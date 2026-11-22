import { Router } from 'express';
import { z } from 'zod';
import { q, one } from '../db.js';
import { AppError, asyncHandler, notFound } from '../utils/errors.js';
import { proofDownloadUrl } from '../utils/cloudinary.js';
import { sendMail } from '../utils/mailer.js';
import { auth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { camel, likeEscape } from '../utils/helpers.js';

const router = Router();
router.use(auth, requireRole('admin'));
const idParam = z.object({ id: z.coerce.number().int().positive() });

router.get('/stats', asyncHandler(async (_req, res) => {
  const r = await one(`SELECT
    (SELECT COUNT(*) FROM users WHERE status='active') AS active_users,
    (SELECT COUNT(*) FROM users WHERE status='active' AND role='student') AS students,
    (SELECT COUNT(*) FROM users WHERE status='active' AND role='alumni') AS alumni,
    (SELECT COUNT(*) FROM users WHERE status='pending_review') AS pending_alumni,
    (SELECT COUNT(*) FROM posts) AS posts, (SELECT COUNT(*) FROM clubs) AS clubs,
    (SELECT COUNT(*) FROM events WHERE starts_at >= NOW()) AS upcoming_events, (SELECT COUNT(*) FROM jobs WHERE is_active = 1) AS open_jobs`);
  res.json({ stats: camel(r) });
}));

// Alumni waiting for manual verification (personal-email signups with proof)
router.get('/pending-alumni', asyncHandler(async (_req, res) => {
  const rows = await q("SELECT id, name, email, student_id, department, graduation_year, created_at FROM users WHERE status = 'pending_review' ORDER BY id");
  res.json({ items: rows.map(camel) });
}));
router.get('/users/:id/proof', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const u = await one('SELECT proof_public_id, proof_format FROM users WHERE id = ?', [req.params.id]);
  if (!u?.proof_public_id) throw notFound('Proof document');
  res.json({ url: proofDownloadUrl(u.proof_public_id, u.proof_format), expiresInSeconds: 600 });
}));
router.post('/users/:id/approve', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const u = await one("SELECT id, email, name FROM users WHERE id = ? AND status = 'pending_review'", [req.params.id]);
  if (!u) throw notFound('Pending alumni request');
  await q("UPDATE users SET status = 'active', email_verified = 1, review_note = NULL WHERE id = ?", [u.id]);
  await sendMail({ to: u.email, subject: 'Welcome to DIULink', text: `Hi ${u.name}, your alumni account is approved. You can sign in now.` });
  res.json({ ok: true });
}));
router.post('/users/:id/reject', validate(idParam, 'params'), validate(z.object({ reason: z.string().trim().max(255).optional() })), asyncHandler(async (req, res) => {
  const u = await one("SELECT id, email, name FROM users WHERE id = ? AND status = 'pending_review'", [req.params.id]);
  if (!u) throw notFound('Pending alumni request');
  await q("UPDATE users SET status = 'rejected', review_note = ? WHERE id = ?", [req.body.reason || null, u.id]);
  await sendMail({ to: u.email, subject: 'Your DIULink request', text: `Hi ${u.name}, we could not verify your alumni request.${req.body.reason ? ' Reason: ' + req.body.reason : ''}` });
  res.json({ ok: true });
}));

// Suspend / restore any member (cannot touch other admins)
router.post('/users/:id/:action(suspend|restore)', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const u = await one('SELECT id, role FROM users WHERE id = ?', [req.params.id]);
  if (!u) throw notFound('Member');
  if (u.role === 'admin') throw new AppError(403, 'Admins cannot be suspended here.', 'FORBIDDEN');
  await q('UPDATE users SET status = ? WHERE id = ?', [req.params.action === 'suspend' ? 'suspended' : 'active', u.id]);
  res.json({ ok: true });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const where = ['1=1'], params = [];
  if (req.query.status) { where.push('status = ?'); params.push(String(req.query.status)); }
  if (req.query.q) { const l = `%${likeEscape(String(req.query.q).slice(0, 80))}%`; where.push('(name LIKE ? OR email LIKE ? OR student_id LIKE ?)'); params.push(l, l, l); }
  const rows = await q(`SELECT id, name, email, role, status, student_id, department, created_at FROM users WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 100`, params);
  res.json({ items: rows.map(camel) });
}));

export default router;
