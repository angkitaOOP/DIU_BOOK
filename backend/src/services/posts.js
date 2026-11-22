import { q } from '../db.js';
import { brief, userCols } from '../utils/helpers.js';

const SELECT = `
  p.id, p.user_id, p.club_id, p.kind, p.content, p.image_url, p.video_url, p.category, p.shared_post_id, p.view_count, p.created_at, p.updated_at,
  ${userCols('u', 'a_')}, c.name AS club_name, c.image_url AS club_image,
  (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS reaction_count,
  (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) AS comment_count,
  (SELECT COUNT(*) FROM posts s WHERE s.shared_post_id = p.id) AS share_count,
  (SELECT r.type FROM reactions r WHERE r.post_id = p.id AND r.user_id = ?) AS my_reaction,
  EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = ?) AS is_saved`;
const FROM = `FROM posts p JOIN users u ON u.id = p.user_id AND u.status = 'active' LEFT JOIN clubs c ON c.id = p.club_id`;

const shape = (r, tags, shared) => ({
  id: r.id, kind: r.kind, content: r.content, imageUrl: r.image_url, videoUrl: r.video_url, category: r.category,
  createdAt: r.created_at, updatedAt: r.updated_at, viewCount: r.view_count,
  mediaType: r.video_url ? 'video' : r.image_url ? 'photo' : 'post',
  author: brief(r, 'a_'),
  club: r.club_id ? { id: r.club_id, name: r.club_name, imageUrl: r.club_image } : null,
  tags: tags.get(r.id) || [],
  counts: { reactions: r.reaction_count, comments: r.comment_count, shares: r.share_count },
  myReaction: r.my_reaction || null, liked: !!r.my_reaction, saved: !!r.is_saved,
  sharedPost: r.shared_post_id ? (shared?.get(r.shared_post_id) ?? { unavailable: true }) : null,
});

async function hydrate(rows, viewerId, withShared = true) {
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const tagRows = await q('SELECT post_id, tag FROM post_hashtags WHERE post_id IN (?)', [ids]);
  const tags = new Map();
  for (const t of tagRows) (tags.get(t.post_id) || tags.set(t.post_id, []).get(t.post_id)).push(`#${t.tag}`);
  let shared = null;
  const sharedIds = [...new Set(rows.map(r => r.shared_post_id).filter(Boolean))];
  if (withShared && sharedIds.length) {
    const originals = await fetchPosts(viewerId, { where: 'p.id IN (?)', params: [sharedIds], limit: sharedIds.length, withShared: false });
    shared = new Map(originals.map(p => [p.id, p]));
  }
  return rows.map(r => shape(r, tags, shared));
}

/** Core post query. `where` may use aliases p, u, c. */
export async function fetchPosts(viewerId, { where = '1=1', params = [], order = 'p.id DESC', limit = 20, offset = 0, withShared = true } = {}) {
  const rows = await q(`SELECT ${SELECT} ${FROM} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [viewerId, viewerId, ...params, limit, offset]);
  return hydrate(rows, viewerId, withShared);
}

export const fetchPost = async (viewerId, id) => (await fetchPosts(viewerId, { where: 'p.id = ?', params: [id], limit: 1 }))[0] || null;

export const isClubAdmin = async (userId, clubId) =>
  !!(await q("SELECT 1 FROM club_members WHERE club_id=? AND user_id=? AND role='admin' AND status='active'", [clubId, userId]))[0];
