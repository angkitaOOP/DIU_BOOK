# DIULink backend progress

Status legend: [x] done, [~] partly done, [ ] not started

- [x] database/schema.sql
- [x] scripts (migrate, seed)
- [x] core (config, db, errors, auth middleware, upload, cloudinary, mailer, notify, realtime)
- [x] auth routes
- [x] users/profile routes
- [x] connections
- [x] posts, reactions, comments, shares, saves
- [x] explore + search
- [x] clubs
- [x] events
- [x] jobs
- [x] messages + Socket.IO
- [x] notifications
- [x] admin
- [x] frontend integration client (docs/api.js)
- [x] README

## NOT YET TESTED (important)
The sandbox had no network, so `npm install` and a real MySQL run were impossible.
All files pass `node --check` and a static import/export check, but the API has never been executed.
First thing to do: `npm install`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`, then try the flows below and fix any SQL/typo issues.

## Suggested smoke test order
1. POST /api/auth/register (student, @diu.edu.bd) -> read OTP in server console -> POST /api/auth/verify-email -> token
2. POST /api/auth/login, GET /api/auth/me
3. POST /api/posts, GET /api/posts/feed, PUT /api/posts/:id/reaction, POST /api/posts/:id/comments
4. Register a second user; POST /api/connections/request; accept; open a chat with POST /api/messages/conversations; test sockets
5. Admin: login with the seeded admin; register an alumnus with a personal email + proof; approve via /api/admin

## Next steps / ideas
- Wire the React frontend to the API (docs/api.js is ready); replace mock data page by page.
- Student ID registry check (optional table with valid DIU IDs) to stop fake IDs.
- Group chats / club chats (schema already has conversations.type = 'group'; routes not written).
- Blocking/reporting users and posts; admin moderation queue.
- Bulk-insert notifications for large audiences (jobs.js notifies one by one, fine for hundreds, slow for thousands).
- Refresh tokens / token revocation; Redis adapter for Socket.IO; automated tests (Vitest + Supertest).
