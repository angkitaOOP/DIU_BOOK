import { Router } from 'express';
import { z } from 'zod';
import { q, one } from '../db.js';
import { AppError, asyncHandler, notFound } from '../utils/errors.js';
import { brief, camel, likeEscape, userCols } from '../utils/helpers.js';
import { isOurAsset } from '../utils/cloudinary.js';
import { notify, notifyMany } from '../utils/notify.js';
import { auth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { parseJson } from '../utils/settings.js';

const router = Router();
router.use(auth);

const KINDS = ['job', 'internship', 'alumni_referral', 'on_campus'];
const SELECT = `j.id, j.title, j.company, j.kind, j.location, j.description, j.tags, j.apply_url, j.event_date, j.deadline, j.is_active, j.created_at,
  ${userCols('u', 'p_')},
  EXISTS(SELECT 1 FROM job_saves s WHERE s.job_id = j.id AND s.user_id = ?) AS is_saved,
  (SELECT status FROM job_applications a WHERE a.job_id = j.id AND a.user_id = ?) AS my_application
  FROM jobs j JOIN users u ON u.id = j.posted_by`;
const shape = r => ({ id: r.id, title: r.title, company: r.company, kind: r.kind, location: r.location, description: r.description,
  tags: parseJson(r.tags) || [], applyUrl: r.apply_url, eventDate: r.event_date, deadline: r.deadline, isActive: !!r.is_active,
  createdAt: r.created_at, postedBy: brief(r, 'p_'), saved: !!r.is_saved, applicationStatus: r.my_application || null });

// GET /api/jobs?kind=job|internship|alumni_referral|on_campus&q=&saved=1
router.get('/', asyncHandler(async (req, res) => {
  const where = ['j.is_active = 1', '(j.deadline IS NULL OR j.deadline >= CURDATE())'], params = [req.user.id, req.user.id];
  if (KINDS.includes(req.query.kind)) { where.push('j.kind = ?'); params.push(req.query.kind); }
  if (req.query.saved === '1') where.push('EXISTS (SELECT 1 FROM job_saves s2 WHERE s2.job_id = j.id AND s2.user_id = ?)') && params.push(req.user.id);
  if (req.query.q) { const l = `%${likeEscape(String(req.query.q).slice(0, 80))}%`; where.push('(j.title LIKE ? OR j.company LIKE ? OR j.location LIKE ?)'); params.push(l, l, l); }
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100), offset = (Math.max(parseInt(req.query.page, 10) || 1, 1) - 1) * limit;
  const rows = await q(`SELECT ${SELECT} WHERE ${where.join(' AND ')} ORDER BY j.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  res.json({ items: rows.map(shape) });
}));

router.get('/applications/mine', asyncHandler(async (req, res) => {
  const rows = await q(`SELECT a.id, a.status, a.created_at, j.id AS job_id, j.title, j.company, j.kind FROM job_applications a JOIN jobs j ON j.id = a.job_id WHERE a.user_id = ? ORDER BY a.id DESC`, [req.user.id]);
  res.json({ items: rows.map(camel) });
}));

router.get('/:id(\\d+)', asyncHandler(async (req, res) => {
  const row = await one(`SELECT ${SELECT} WHERE j.id = ?`, [req.user.id, req.user.id, req.params.id]);
  if (!row) throw notFound('Job');
  res.json({ job: shape(row) });
}));

const body = z.object({
  title: z.string().trim().min(3).max(160), company: z.string().trim().min(2).max(160), kind: z.enum(KINDS),
  location: z.string().trim().max(160).optional(), description: z.string().trim().max(6000).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  applyUrl: z.string().trim().url().max(500).optional(), eventDate: z.coerce.date().optional(), deadline: z.coerce.date().optional(),
});

// Alumni and admins post; only admins (DIU Career Office) post on-campus drives.
router.post('/', requireRole('alumni', 'admin'), validate(body), asyncHandler(async (req, res) => {
  const b = req.body;
  if (b.kind === 'on_campus' && req.user.role !== 'admin') throw new AppError(403, 'Only the DIU Career Office can post on-campus drives.', 'FORBIDDEN');
  const r = await q('INSERT INTO jobs (posted_by, title, company, kind, location, description, tags, apply_url, event_date, deadline) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [req.user.id, b.title, b.company, b.kind, b.location || null, b.description || null, JSON.stringify(b.tags), b.applyUrl || null,
      b.eventDate || null, b.deadline ? b.deadline.toISOString().slice(0, 10) : null]);
  // Tell the poster's connections (capped) — respects their "Job alerts" setting.
  const audience = b.kind === 'on_campus'
    ? await q("SELECT id AS user_id FROM users WHERE status = 'active' AND id <> ? LIMIT 5000", [req.user.id])
    : await q('SELECT friend_id AS user_id FROM connection_edges WHERE user_id = ? LIMIT 500', [req.user.id]);
  const label = { job: 'posted a job', internship: 'posted an internship', alumni_referral: 'posted a referral', on_campus: 'announced a campus hiring drive' }[b.kind];
  notifyMany(audience.map(a => a.user_id), { actorId: req.user.id, type: 'job', entityType: 'job', entityId: r.insertId, message: `${req.user.name} ${label}: ${b.title}` }).catch(console.error);
  res.status(201).json({ job: shape(await one(`SELECT ${SELECT} WHERE j.id = ?`, [req.user.id, req.user.id, r.insertId])) });
}));

router.delete('/:id(\\d+)', asyncHandler(async (req, res) => {
  const job = await one('SELECT posted_by FROM jobs WHERE id = ?', [req.params.id]);
  if (!job) throw notFound('Job');
  if (job.posted_by !== req.user.id && req.user.role !== 'admin') throw new AppError(403, 'You cannot delete this listing.', 'FORBIDDEN');
  await q('DELETE FROM jobs WHERE id = ?', [req.params.id]);
  res.status(204).end();
}));

router.put('/:id(\\d+)/save', asyncHandler(async (req, res) => {
  if (!(await one('SELECT id FROM jobs WHERE id = ?', [req.params.id]))) throw notFound('Job');
  await q('INSERT IGNORE INTO job_saves (user_id, job_id) VALUES (?,?)', [req.user.id, req.params.id]);
  res.json({ saved: true });
}));
router.delete('/:id(\\d+)/save', asyncHandler(async (req, res) => {
  await q('DELETE FROM job_saves WHERE user_id = ? AND job_id = ?', [req.user.id, req.params.id]);
  res.json({ saved: false });
}));

// Apply (or "Register" for on-campus drives)
router.post('/:id(\\d+)/apply', validate(z.object({
  note: z.string().trim().max(3000).optional(),
  resumeUrl: z.string().refine(isOurAsset, 'Upload the file through /api/upload first.').optional(),
})), asyncHandler(async (req, res) => {
  const job = await one('SELECT id, title, posted_by FROM jobs WHERE id = ? AND is_active = 1', [req.params.id]);
  if (!job) throw notFound('Job');
  if (job.posted_by === req.user.id) throw new AppError(400, 'You cannot apply to your own listing.', 'SELF_APPLY');
  const r = await q('INSERT IGNORE INTO job_applications (job_id, user_id, note, resume_url) VALUES (?,?,?,?)', [job.id, req.user.id, req.body.note || null, req.body.resumeUrl || null]);
  if (r.affectedRows) await notify({ userId: job.posted_by, actorId: req.user.id, type: 'job', entityType: 'job', entityId: job.id, message: `${req.user.name} applied to ${job.title}` });
  res.status(r.affectedRows ? 201 : 200).json({ applied: true });
}));
router.delete('/:id(\\d+)/apply', asyncHandler(async (req, res) => {
  await q("DELETE FROM job_applications WHERE job_id = ? AND user_id = ? AND status = 'submitted'", [req.params.id, req.user.id]);
  res.json({ applied: false });
}));

// Poster reviews applicants
router.get('/:id(\\d+)/applications', asyncHandler(async (req, res) => {
  const job = await one('SELECT posted_by FROM jobs WHERE id = ?', [req.params.id]);
  if (!job) throw notFound('Job');
  if (job.posted_by !== req.user.id && req.user.role !== 'admin') throw new AppError(403, 'Only the poster can see applicants.', 'FORBIDDEN');
  const rows = await q(`SELECT a.id, a.note, a.resume_url, a.status, a.created_at, ${userCols('u', '')} FROM job_applications a JOIN users u ON u.id = a.user_id WHERE a.job_id = ? ORDER BY a.id DESC`, [req.params.id]);
  res.json({ items: rows.map(r => ({ id: r.id, note: r.note, resumeUrl: r.resume_url, status: r.status, appliedAt: r.created_at, applicant: brief(r) })) });
}));
router.patch('/applications/:appId(\\d+)', validate(z.object({ status: z.enum(['shortlisted', 'rejected', 'hired']) })), asyncHandler(async (req, res) => {
  const app = await one('SELECT a.id, a.user_id, j.posted_by, j.title FROM job_applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?', [req.params.appId]);
  if (!app) throw notFound('Application');
  if (app.posted_by !== req.user.id && req.user.role !== 'admin') throw new AppError(403, 'Only the poster can update this application.', 'FORBIDDEN');
  await q('UPDATE job_applications SET status = ? WHERE id = ?', [req.body.status, app.id]);
  await notify({ userId: app.user_id, actorId: req.user.id, type: 'job', entityType: 'job', entityId: null, message: `Your application for ${app.title} was marked ${req.body.status}` });
  res.json({ ok: true });
}));

export default router;
