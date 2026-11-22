import { Router } from 'express';
import { z } from 'zod';
import { q, one, tx } from '../db.js';
import { AppError, asyncHandler, notFound } from '../utils/errors.js';
import { brief, camel, connStatusSql, likeEscape, pageParams, userCols } from '../utils/helpers.js';
import { mergeSettings, parseJson } from '../utils/settings.js';
import { isOurAsset } from '../utils/cloudinary.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { profileStrength, toMe, getUserById } from '../services/users.js';
import { isOnline } from '../realtime.js';

const router = Router();
router.use(auth);

const url = z.string().trim().url().max(255);
const optUrl = z.union([url, z.literal('')]).transform(v => v || null);
const asset = z.union([z.string().refine(isOurAsset, 'Upload the file through /api/upload first.'), z.null()]);
const text = (max) => z.string().trim().max(max).transform(v => v || null);

/* ------------------------------------------------------------------ me */
const patchMe = z.object({
  name: z.string().trim().min(2).max(120),
  headline: text(160), bio: text(3000), location: text(120), department: text(120),
  githubUrl: optUrl, linkedinUrl: optUrl, avatarUrl: asset, coverUrl: asset,
  company: text(120), jobTitle: text(120), industry: text(60),
}).partial();
const COLS = { name: 'name', headline: 'headline', bio: 'bio', location: 'location', department: 'department', githubUrl: 'github_url',
  linkedinUrl: 'linkedin_url', avatarUrl: 'avatar_url', coverUrl: 'cover_url', company: 'company', jobTitle: 'job_title', industry: 'industry' };

router.patch('/me', validate(patchMe), asyncHandler(async (req, res) => {
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(req.body)) { if (COLS[k]) { sets.push(`${COLS[k]} = ?`); vals.push(v); } }
  if (!sets.length) throw new AppError(400, 'Nothing to update.', 'EMPTY_UPDATE');
  await q(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...vals, req.user.id]);
  res.json({ user: toMe(await getUserById(req.user.id)) });
}));

const settingsSchema = z.object({
  notifications: z.object({ reactions: z.boolean(), messages: z.boolean(), jobs: z.boolean(), events: z.boolean() }).partial().optional(),
  privacy: z.object({ visible: z.boolean(), alumniMessages: z.boolean(), showActive: z.boolean() }).partial().optional(),
});
router.patch('/me/settings', validate(settingsSchema), asyncHandler(async (req, res) => {
  const cur = mergeSettings((await getUserById(req.user.id)).settings);
  const next = { notifications: { ...cur.notifications, ...req.body.notifications }, privacy: { ...cur.privacy, ...req.body.privacy } };
  await q('UPDATE users SET settings = ? WHERE id = ?', [JSON.stringify(next), req.user.id]);
  res.json({ settings: next });
}));

router.put('/me/skills', validate(z.object({ skills: z.array(z.string().trim().min(1).max(60)).max(40) })), asyncHandler(async (req, res) => {
  const skills = [...new Set(req.body.skills)];
  await tx(async c => {
    await c.query('DELETE FROM user_skills WHERE user_id = ?', [req.user.id]);
    if (skills.length) await c.query('INSERT INTO user_skills (user_id, skill) VALUES ?', [skills.map(s => [req.user.id, s])]);
  });
  res.json({ skills });
}));

/* ---- owned list sections: education / experience / projects ---- */
const year = z.number().int().min(1950).max(2100).nullable().optional();
const date = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional();
const sections = {
  education: { table: 'education', schema: z.object({ institution: z.string().trim().min(1).max(160), degree: text(160).nullable().optional(), startYear: year, endYear: year, isExpected: z.boolean().optional() }),
    fields: { institution: 'institution', degree: 'degree', startYear: 'start_year', endYear: 'end_year', isExpected: 'is_expected' } },
  experience: { table: 'experience', schema: z.object({ company: z.string().trim().min(1).max(160), title: z.string().trim().min(1).max(160), startDate: date, endDate: date, description: text(2000).nullable().optional() }),
    fields: { company: 'company', title: 'title', startDate: 'start_date', endDate: 'end_date', description: 'description' } },
  projects: { table: 'projects', schema: z.object({ title: z.string().trim().min(1).max(160), type: text(80).nullable().optional(), description: text(2000).nullable().optional(), imageUrl: asset.optional(), projectUrl: optUrl.optional(), tags: z.array(z.string().trim().min(1).max(30)).max(10).optional() }),
    fields: { title: 'title', type: 'type', description: 'description', imageUrl: 'image_url', projectUrl: 'project_url', tags: 'tags' } },
};
for (const [path, { table, schema, fields }] of Object.entries(sections)) {
  const toDb = body => {
    const cols = [], vals = [];
    for (const [k, v] of Object.entries(body)) if (fields[k] && v !== undefined) { cols.push(fields[k]); vals.push(k === 'tags' ? JSON.stringify(v) : v); }
    return { cols, vals };
  };
  router.post(`/me/${path}`, validate(schema), asyncHandler(async (req, res) => {
    const { cols, vals } = toDb(req.body);
    const r = await q(`INSERT INTO ${table} (user_id, ${cols.join(',')}) VALUES (?, ${cols.map(() => '?').join(',')})`, [req.user.id, ...vals]);
    res.status(201).json({ item: camel(await one(`SELECT * FROM ${table} WHERE id = ?`, [r.insertId])) });
  }));
  router.patch(`/me/${path}/:id(\\d+)`, validate(schema.partial()), asyncHandler(async (req, res) => {
    const { cols, vals } = toDb(req.body);
    if (!cols.length) throw new AppError(400, 'Nothing to update.', 'EMPTY_UPDATE');
    const r = await q(`UPDATE ${table} SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ? AND user_id = ?`, [...vals, req.params.id, req.user.id]);
    if (!r.affectedRows) throw notFound('Item');
    res.json({ item: camel(await one(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id])) });
  }));
  router.delete(`/me/${path}/:id(\\d+)`, asyncHandler(async (req, res) => {
    const r = await q(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
    if (!r.affectedRows) throw notFound('Item');
    res.status(204).end();
  }));
}

router.get('/me/strength', asyncHandler(async (req, res) => res.json(await profileStrength(req.user.id))));

/* ----------------------------------------------------- directory/search */
// GET /api/users?q=&role=student|alumni&department=&batch=&industry=&page=&limit=
const dirQuery = z.object({
  q: z.string().trim().max(80).optional(), role: z.enum(['student', 'alumni']).optional(),
  department: z.string().trim().max(120).optional(), batch: z.coerce.number().int().optional(), industry: z.string().trim().max(60).optional(),
  page: z.any().optional(), limit: z.any().optional(),
});
router.get('/', validate(dirQuery, 'query'), asyncHandler(async (req, res) => {
  const f = req.query, { limit, offset } = pageParams(f, 20, 50), me = req.user.id;
  const where = ["u.status = 'active'", 'u.id <> ?'], wp = [me];
  if (f.role) { where.push('u.role = ?'); wp.push(f.role); }
  if (f.department) { where.push('u.department = ?'); wp.push(f.department); }
  if (f.batch) { where.push('u.graduation_year = ?'); wp.push(f.batch); }
  if (f.industry) { where.push('u.industry = ?'); wp.push(f.industry); }
  if (f.q) { const l = `%${likeEscape(f.q)}%`; where.push('(u.name LIKE ? OR u.company LIKE ? OR u.job_title LIKE ? OR u.headline LIKE ?)'); wp.push(l, l, l, l); }
  const rows = await q(
    `SELECT ${userCols('u', '')}, u.company, u.job_title, u.industry, u.graduation_year, ${connStatusSql('u')}
     FROM users u WHERE ${where.join(' AND ')} ORDER BY u.name LIMIT ? OFFSET ?`,
    [me, me, me, ...wp, limit, offset]); // conn_status placeholders come first (SELECT), then WHERE, then paging
  res.json({ items: rows.map(r => ({ ...brief(r), company: r.company, jobTitle: r.job_title, industry: r.industry, batch: r.graduation_year, connectionStatus: r.conn_status })), page: Math.max(parseInt(f.page, 10) || 1, 1) });
}));

router.get('/suggestions', asyncHandler(async (req, res) => {
  const me = req.user.id;
  const rows = await q(
    `SELECT ${userCols('u', '')},
       (SELECT COUNT(*) FROM connection_edges a JOIN connection_edges b ON a.friend_id = b.friend_id WHERE a.user_id = u.id AND b.user_id = ?) AS mutual
     FROM users u
     WHERE u.status = 'active' AND u.id <> ?
       AND NOT EXISTS (SELECT 1 FROM connections c WHERE c.pair_key = CONCAT(LEAST(?, u.id), '-', GREATEST(?, u.id)))
     ORDER BY mutual DESC, u.created_at DESC LIMIT 6`, [me, me, me, me]);
  res.json({ items: rows.map(r => ({ ...brief(r), mutualConnections: r.mutual })) });
}));

/* -------------------------------------------------------- public profile */
router.get('/:id(\\d+)', asyncHandler(async (req, res) => {
  const id = Number(req.params.id), me = req.user.id;
  const u = await one(`SELECT u.*, ${connStatusSql('u')} FROM users u WHERE u.id = ? AND u.status = 'active'`, [me, me, me, id]);
  if (!u) throw notFound('Member');
  const isSelf = id === me;
  const connectionStatus = isSelf ? 'self' : (u.conn_status || 'none');
  const privacy = mergeSettings(u.settings).privacy;
  const canSee = isSelf || privacy.visible || connectionStatus === 'connected' || req.user.role === 'admin';
  const base = { ...brief({ id: u.id, name: u.name, role: u.role, avatar: u.avatar_url, headline: u.headline, department: u.department }), coverUrl: u.cover_url, connectionStatus };
  if (!canSee) return res.json({ profile: { ...base, restricted: true } });

  const [counts, skills, education, experience, projects] = await Promise.all([
    one(`SELECT (SELECT COUNT(*) FROM connection_edges WHERE user_id = ?) AS connections,
                (SELECT COUNT(*) FROM posts WHERE user_id = ? AND kind <> 'share') AS posts,
                (SELECT COUNT(*) FROM projects WHERE user_id = ?) AS projects`, [id, id, id]),
    q('SELECT skill FROM user_skills WHERE user_id = ? ORDER BY skill', [id]),
    q('SELECT * FROM education WHERE user_id = ? ORDER BY COALESCE(end_year, 9999) DESC, start_year DESC', [id]),
    q('SELECT * FROM experience WHERE user_id = ? ORDER BY COALESCE(end_date, "9999-12-31") DESC, start_date DESC', [id]),
    q('SELECT * FROM projects WHERE user_id = ? ORDER BY id DESC', [id]),
  ]);
  res.json({ profile: {
    ...base, bio: u.bio, location: u.location, githubUrl: u.github_url, linkedinUrl: u.linkedin_url,
    studentId: isSelf ? u.student_id : undefined, email: isSelf ? u.email : undefined,
    graduationYear: u.graduation_year, company: u.company, jobTitle: u.job_title, industry: u.industry,
    joinedAt: u.created_at, online: privacy.showActive && isOnline(id),
    counts: { connections: counts.connections, posts: counts.posts, projects: counts.projects, skills: skills.length },
    skills: skills.map(s => s.skill), education: education.map(camel), experience: experience.map(camel), projects: projects.map(camel),
    strength: isSelf ? await profileStrength(id) : undefined,
  } });
}));

export default router;
