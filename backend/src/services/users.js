import { q, one } from '../db.js';
import { mergeSettings } from '../utils/settings.js';

/** Full "me" object returned after login and from GET /auth/me. */
export const toMe = u => ({
  id: u.id, name: u.name, email: u.email, role: u.role, status: u.status,
  studentId: u.student_id ?? null, department: u.department ?? null, graduationYear: u.graduation_year ?? null,
  headline: u.headline ?? null, avatarUrl: u.avatar_url ?? null, coverUrl: u.cover_url ?? null,
  settings: mergeSettings(u.settings),
});

export const getUserById = id => one('SELECT * FROM users WHERE id = ?', [id]);

export async function profileStrength(userId) {
  const [u, counts] = await Promise.all([
    one('SELECT avatar_url, cover_url, bio, headline, location, github_url, linkedin_url FROM users WHERE id=?', [userId]),
    one(`SELECT (SELECT COUNT(*) FROM education WHERE user_id=?) AS edu, (SELECT COUNT(*) FROM experience WHERE user_id=?) AS exp,
                (SELECT COUNT(*) FROM user_skills WHERE user_id=?) AS skills, (SELECT COUNT(*) FROM projects WHERE user_id=?) AS projects`,
      [userId, userId, userId, userId]),
  ]);
  const checks = [
    ['Profile photo added', !!u.avatar_url], ['Cover photo added', !!u.cover_url], ['Headline added', !!u.headline],
    ['Bio added', !!u.bio], ['Location added', !!u.location], ['Education added', counts.edu > 0],
    ['Add work experience', counts.exp > 0], ['Add at least 3 skills', counts.skills >= 3],
    ['Add a project', counts.projects > 0], ['Link GitHub or LinkedIn', !!(u.github_url || u.linkedin_url)],
  ];
  const done = checks.filter(c => c[1]).length;
  return { percent: Math.round((done / checks.length) * 100), checklist: checks.map(([label, ok]) => ({ label, done: ok })) };
}
