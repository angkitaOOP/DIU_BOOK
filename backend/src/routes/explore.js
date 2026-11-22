import { Router } from 'express';
import { q } from '../db.js';
import { asyncHandler } from '../utils/errors.js';
import { brief, likeEscape, pageParams, userCols } from '../utils/helpers.js';
import { auth } from '../middleware/auth.js';
import { fetchPosts } from '../services/posts.js';

const router = Router();
router.use(auth);

// GET /api/explore?type=all|video|photo|post&topic=Events&sort=views|latest&q=&page=&limit=
router.get('/', asyncHandler(async (req, res) => {
  const { type = 'all', topic, sort = 'views', q: term } = req.query;
  const { limit, offset } = pageParams(req.query, 18, 40);
  const where = ["p.kind <> 'share'"], params = [];
  if (type === 'video') where.push('p.video_url IS NOT NULL');
  else if (type === 'photo') where.push('p.image_url IS NOT NULL AND p.video_url IS NULL');
  else if (type === 'post') where.push('p.image_url IS NULL AND p.video_url IS NULL');
  if (topic && topic !== 'All topics') { where.push('p.category = ?'); params.push(String(topic)); }
  if (term) { const l = `%${likeEscape(String(term).slice(0, 80))}%`; where.push('(p.content LIKE ? OR u.name LIKE ? OR c.name LIKE ?)'); params.push(l, l, l); }
  const items = await fetchPosts(req.user.id, {
    where: where.join(' AND '), params, limit, offset, withShared: false,
    order: sort === 'latest' ? 'p.id DESC' : 'p.view_count DESC, p.id DESC',
  });
  res.json({ items, page: Math.floor(offset / limit) + 1, hasMore: items.length === limit });
}));

// GET /api/search?q=...   (top-bar search: people, clubs, posts, jobs, events)
export const searchRouter = Router();
searchRouter.use(auth);
searchRouter.get('/', asyncHandler(async (req, res) => {
  const term = String(req.query.q || '').trim().slice(0, 80);
  if (term.length < 2) return res.json({ people: [], clubs: [], posts: [], jobs: [], events: [] });
  const l = `%${likeEscape(term)}%`;
  const [people, clubs, posts, jobs, events] = await Promise.all([
    q(`SELECT ${userCols('u', '')} FROM users u WHERE u.status='active' AND (u.name LIKE ? OR u.headline LIKE ? OR u.company LIKE ?) ORDER BY u.name LIMIT 5`, [l, l, l]),
    q('SELECT id, name, category, image_url FROM clubs WHERE name LIKE ? OR description LIKE ? LIMIT 5', [l, l]),
    fetchPosts(req.user.id, { where: 'p.content LIKE ?', params: [l], limit: 5, withShared: false }),
    q("SELECT id, title, company, kind FROM jobs WHERE is_active=1 AND (title LIKE ? OR company LIKE ?) ORDER BY id DESC LIMIT 5", [l, l]),
    q('SELECT id, title, starts_at, location FROM events WHERE title LIKE ? OR description LIKE ? ORDER BY starts_at DESC LIMIT 5', [l, l]),
  ]);
  res.json({
    people: people.map(r => brief(r)),
    clubs: clubs.map(c => ({ id: c.id, name: c.name, category: c.category, imageUrl: c.image_url })),
    posts, jobs: jobs.map(j => ({ id: j.id, title: j.title, company: j.company, kind: j.kind })),
    events: events.map(e => ({ id: e.id, title: e.title, startsAt: e.starts_at, location: e.location })),
  });
}));

export default router;
