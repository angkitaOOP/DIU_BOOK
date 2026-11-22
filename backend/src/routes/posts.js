import { Router } from 'express';
import { z } from 'zod';
import { q, one, tx } from '../db.js';
import { AppError, asyncHandler, notFound } from '../utils/errors.js';
import { brief, extractTags, userCols } from '../utils/helpers.js';
import { isOurAsset } from '../utils/cloudinary.js';
import { notify } from '../utils/notify.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { fetchPost, fetchPosts, isClubAdmin } from '../services/posts.js';

const router = Router();
router.use(auth);

const CATEGORIES = ['Promotional', 'Events', 'Campus life', 'Tech', 'Creative', 'Career'];
const asset = z.string().refine(isOurAsset, 'Upload the file through /api/upload first.');
const idParam = z.object({ id: z.coerce.number().int().positive() });
const feedLimit = q_ => Math.min(Math.max(parseInt(q_.limit, 10) || 15, 1), 30);
const page = async (req, res, opts) => {
  const limit = feedLimit(req.query), cursor = Number(req.query.cursor) || 0;
  const where = [opts.where || '1=1'], params = [...(opts.params || [])];
  if (cursor) { where.push('p.id < ?'); params.push(cursor); }
  const items = await fetchPosts(req.user.id, { where: where.join(' AND '), params, limit });
  res.json({ items, nextCursor: items.length === limit ? items[items.length - 1].id : null });
};

/* ---- Feeds (frontend tabs: For you / Following / Latest) ---- */
router.get('/feed', asyncHandler(async (req, res) => {
  const me = req.user.id;
  if (req.query.tab === 'following') {
    return page(req, res, { where: `(p.user_id = ? OR p.user_id IN (SELECT friend_id FROM connection_edges WHERE user_id = ?)
      OR p.club_id IN (SELECT club_id FROM club_members WHERE user_id = ? AND status = 'active'))`, params: [me, me, me] });
  }
  return page(req, res, {}); // "forYou" and "latest": newest first. TODO later: engagement-based ranking for forYou.
}));
router.get('/saved', asyncHandler(async (req, res) =>
  page(req, res, { where: 'p.id IN (SELECT post_id FROM saved_posts WHERE user_id = ?)', params: [req.user.id] })));
router.get('/user/:id', validate(idParam, 'params'), asyncHandler(async (req, res) =>
  page(req, res, { where: 'p.user_id = ?', params: [req.params.id] })));
router.get('/club/:id', validate(idParam, 'params'), asyncHandler(async (req, res) =>
  page(req, res, { where: 'p.club_id = ?', params: [req.params.id] })));
router.get('/tag/:tag', asyncHandler(async (req, res) =>
  page(req, res, { where: 'p.id IN (SELECT post_id FROM post_hashtags WHERE tag = ?)', params: [String(req.params.tag).replace(/^#/, '').toLowerCase()] })));

router.get('/trending/tags', asyncHandler(async (_req, res) => {
  const rows = await q(
    `SELECT h.tag, COUNT(*) AS posts FROM post_hashtags h JOIN posts p ON p.id = h.post_id
     WHERE p.created_at > (NOW() - INTERVAL 7 DAY) GROUP BY h.tag ORDER BY posts DESC, h.tag LIMIT 6`);
  res.json({ items: rows.map(r => ({ tag: `#${r.tag}`, posts: r.posts })) });
}));

/* ---- Create / read / edit / delete ---- */
const createSchema = z.object({
  content: z.string().trim().max(5000).optional(),
  kind: z.enum(['post', 'project', 'event', 'announcement']).default('post'),
  imageUrl: asset.optional(), videoUrl: asset.optional(),
  clubId: z.coerce.number().int().positive().optional(),
  category: z.enum(CATEGORIES).optional(),
}).refine(v => v.content || v.imageUrl || v.videoUrl, { message: 'Write something or add a photo/video.', path: ['content'] })
  .refine(v => !(v.imageUrl && v.videoUrl), { message: 'Add either a photo or a video, not both.', path: ['videoUrl'] });

router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  if (b.kind === 'announcement' && !b.clubId) throw new AppError(400, 'Announcements must belong to a club.', 'CLUB_REQUIRED');
  if (b.clubId && req.user.role !== 'admin' && !(await isClubAdmin(req.user.id, b.clubId)))
    throw new AppError(403, 'Only club admins can post for a club.', 'NOT_CLUB_ADMIN');
  const id = await tx(async c => {
    const [r] = await c.query('INSERT INTO posts (user_id, club_id, kind, content, image_url, video_url, category) VALUES (?,?,?,?,?,?,?)',
      [req.user.id, b.clubId || null, b.kind, b.content || null, b.imageUrl || null, b.videoUrl || null, b.category || null]);
    const tags = extractTags(b.content);
    if (tags.length) await c.query('INSERT INTO post_hashtags (post_id, tag) VALUES ?', [tags.map(t => [r.insertId, t])]);
    return r.insertId;
  });
  res.status(201).json({ post: await fetchPost(req.user.id, id) });
}));

router.get('/:id(\\d+)', asyncHandler(async (req, res) => {
  const post = await fetchPost(req.user.id, req.params.id);
  if (!post) throw notFound('Post');
  res.json({ post });
}));

router.patch('/:id(\\d+)', validate(z.object({ content: z.string().trim().min(1).max(5000) })), asyncHandler(async (req, res) => {
  const row = await one('SELECT user_id, kind FROM posts WHERE id = ?', [req.params.id]);
  if (!row) throw notFound('Post');
  if (row.user_id !== req.user.id) throw new AppError(403, 'You can only edit your own posts.', 'FORBIDDEN');
  await tx(async c => {
    await c.query('UPDATE posts SET content = ? WHERE id = ?', [req.body.content, req.params.id]);
    await c.query('DELETE FROM post_hashtags WHERE post_id = ?', [req.params.id]);
    const tags = extractTags(req.body.content);
    if (tags.length) await c.query('INSERT INTO post_hashtags (post_id, tag) VALUES ?', [tags.map(t => [req.params.id, t])]);
  });
  res.json({ post: await fetchPost(req.user.id, req.params.id) });
}));

router.delete('/:id(\\d+)', asyncHandler(async (req, res) => {
  const row = await one('SELECT user_id FROM posts WHERE id = ?', [req.params.id]);
  if (!row) throw notFound('Post');
  if (row.user_id !== req.user.id && req.user.role !== 'admin') throw new AppError(403, 'You can only delete your own posts.', 'FORBIDDEN');
  await q('DELETE FROM posts WHERE id = ?', [req.params.id]);
  res.status(204).end();
}));

/* ---- Reactions ---- */
router.put('/:id(\\d+)/reaction', validate(z.object({ type: z.enum(['like', 'love', 'celebrate', 'insightful', 'support']).default('like') })), asyncHandler(async (req, res) => {
  const post = await one('SELECT id, user_id FROM posts WHERE id = ?', [req.params.id]);
  if (!post) throw notFound('Post');
  const r = await q('INSERT INTO reactions (post_id, user_id, type) VALUES (?,?,?) ON DUPLICATE KEY UPDATE type = VALUES(type)', [post.id, req.user.id, req.body.type]);
  if (r.affectedRows === 1) // brand-new reaction (2 means it was only changed)
    await notify({ userId: post.user_id, actorId: req.user.id, type: 'reaction', entityType: 'post', entityId: post.id, message: `${req.user.name} reacted to your post` });
  const c = await one('SELECT COUNT(*) AS n FROM reactions WHERE post_id = ?', [post.id]);
  res.json({ reactions: c.n, myReaction: req.body.type });
}));
router.delete('/:id(\\d+)/reaction', asyncHandler(async (req, res) => {
  await q('DELETE FROM reactions WHERE post_id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ reactions: (await one('SELECT COUNT(*) AS n FROM reactions WHERE post_id = ?', [req.params.id])).n, myReaction: null });
}));

/* ---- Save / bookmark ---- */
router.put('/:id(\\d+)/save', asyncHandler(async (req, res) => {
  if (!(await one('SELECT id FROM posts WHERE id = ?', [req.params.id]))) throw notFound('Post');
  await q('INSERT IGNORE INTO saved_posts (user_id, post_id) VALUES (?,?)', [req.user.id, req.params.id]);
  res.json({ saved: true });
}));
router.delete('/:id(\\d+)/save', asyncHandler(async (req, res) => {
  await q('DELETE FROM saved_posts WHERE user_id = ? AND post_id = ?', [req.user.id, req.params.id]);
  res.json({ saved: false });
}));

/* ---- Share (creates a new post that points at the original) ---- */
router.post('/:id(\\d+)/share', validate(z.object({ comment: z.string().trim().max(2000).optional() })), asyncHandler(async (req, res) => {
  const original = await one('SELECT id, user_id, shared_post_id FROM posts WHERE id = ?', [req.params.id]);
  if (!original) throw notFound('Post');
  const targetId = original.shared_post_id || original.id; // re-sharing a share points at the root post
  const id = await tx(async c => {
    const [r] = await c.query("INSERT INTO posts (user_id, kind, content, shared_post_id) VALUES (?, 'share', ?, ?)", [req.user.id, req.body.comment || null, targetId]);
    const tags = extractTags(req.body.comment);
    if (tags.length) await c.query('INSERT INTO post_hashtags (post_id, tag) VALUES ?', [tags.map(t => [r.insertId, t])]);
    return r.insertId;
  });
  await notify({ userId: original.user_id, actorId: req.user.id, type: 'share', entityType: 'post', entityId: targetId, message: `${req.user.name} shared your post` });
  res.status(201).json({ post: await fetchPost(req.user.id, id) });
}));

/* ---- View counter (Explore "most viewed") ---- */
router.post('/:id(\\d+)/view', asyncHandler(async (req, res) => {
  await q('UPDATE posts SET view_count = view_count + 1 WHERE id = ?', [req.params.id]);
  res.status(204).end();
}));

/* ---- Comments (flat list; replies carry parentId) ---- */
router.get('/:id(\\d+)/comments', asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100), after = Number(req.query.after) || 0;
  const rows = await q(
    `SELECT cm.id, cm.parent_id, cm.content, cm.created_at, ${userCols('u', 'a_')} FROM comments cm JOIN users u ON u.id = cm.user_id
     WHERE cm.post_id = ? AND cm.id > ? ORDER BY cm.id ASC LIMIT ?`, [req.params.id, after, limit]);
  res.json({ items: rows.map(r => ({ id: r.id, parentId: r.parent_id, content: r.content, createdAt: r.created_at, author: brief(r, 'a_') })),
    nextCursor: rows.length === limit ? rows[rows.length - 1].id : null });
}));

router.post('/:id(\\d+)/comments', validate(z.object({ content: z.string().trim().min(1, 'Write a comment.').max(2000), parentId: z.coerce.number().int().positive().optional() })), asyncHandler(async (req, res) => {
  const post = await one('SELECT id, user_id FROM posts WHERE id = ?', [req.params.id]);
  if (!post) throw notFound('Post');
  let parent = null;
  if (req.body.parentId) {
    parent = await one('SELECT id, user_id, parent_id FROM comments WHERE id = ? AND post_id = ?', [req.body.parentId, post.id]);
    if (!parent) throw new AppError(400, 'The comment you are replying to no longer exists.', 'BAD_PARENT');
  }
  const parentId = parent ? (parent.parent_id || parent.id) : null; // keep threads one level deep
  const r = await q('INSERT INTO comments (post_id, user_id, parent_id, content) VALUES (?,?,?,?)', [post.id, req.user.id, parentId, req.body.content]);
  await notify({ userId: post.user_id, actorId: req.user.id, type: 'comment', entityType: 'post', entityId: post.id, message: `${req.user.name} commented: “${req.body.content.slice(0, 80)}”` });
  if (parent && parent.user_id !== post.user_id)
    await notify({ userId: parent.user_id, actorId: req.user.id, type: 'comment', entityType: 'post', entityId: post.id, message: `${req.user.name} replied to your comment` });
  const row = await one(`SELECT cm.id, cm.parent_id, cm.content, cm.created_at, ${userCols('u', 'a_')} FROM comments cm JOIN users u ON u.id = cm.user_id WHERE cm.id = ?`, [r.insertId]);
  res.status(201).json({ comment: { id: row.id, parentId: row.parent_id, content: row.content, createdAt: row.created_at, author: brief(row, 'a_') } });
}));

router.delete('/:id(\\d+)/comments/:commentId(\\d+)', asyncHandler(async (req, res) => {
  const row = await one('SELECT cm.user_id, p.user_id AS post_owner FROM comments cm JOIN posts p ON p.id = cm.post_id WHERE cm.id = ? AND cm.post_id = ?', [req.params.commentId, req.params.id]);
  if (!row) throw notFound('Comment');
  if (![row.user_id, row.post_owner].includes(req.user.id) && req.user.role !== 'admin') throw new AppError(403, 'You cannot delete this comment.', 'FORBIDDEN');
  await q('DELETE FROM comments WHERE id = ?', [req.params.commentId]);
  res.status(204).end();
}));

export default router;
