# DIULink Backend

Node.js + Express + MySQL + JWT + Socket.IO + Cloudinary API for the DIULink frontend (React + Vite).

## 1. Setup

```bash
cd backend
npm install
cp .env.example .env        # then fill in values (see below)
npm run db:migrate          # creates the database + all tables
npm run db:seed             # creates the first admin + sample clubs
npm run dev                 # http://localhost:5000  (health check: GET /api/health)
```


## Import database with phpMyAdmin (fixed for error #1046)

1. Start **Apache** and **MySQL** in XAMPP.
2. Open `http://localhost/phpmyadmin`.
3. Open the **Import** tab. You do not need to create or select a database first.
4. Choose `database/schema.sql` from this project and click **Import/Go**.
5. The SQL file now creates and selects the `diulink` database automatically.

The backend `.env` must use `DB_NAME=diulink`. If you prefer running the migration command,
`npm run db:migrate` also creates the database and tables automatically.

Requirements: Node 18.18+, **MySQL 8.0+** (uses JSON columns, generated columns and CHECK constraints).

`.env` essentials:
- `DB_*` – your MySQL connection. `JWT_SECRET` – 32+ random characters.
- `CLIENT_URL` – the Vite dev URL (`http://localhost:5173`). Comma-separate to allow several origins.
- `CLOUDINARY_*` – from your Cloudinary dashboard (needed for any upload).
- `SMTP_*` – optional in development. With `SMTP_HOST` empty, **OTP codes are printed in the server console**.
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` – the first admin (must be a `@diu.edu.bd` address).

## 2. How the main rules are enforced (server-side)

| Rule | Where |
|---|---|
| Only `@diu.edu.bd` can register (students, alumni using DIU mail) | `routes/auth.js` (regex `^[^\s@]+@diu\.edu\.bd$`) |
| Alumni with a personal email upload proof; they stay `pending_review` until an admin approves | `routes/auth.js` + `routes/admin.js`; proof is stored **privately** in Cloudinary (`authenticated`) |
| Email verified by a 6-digit code (hashed, 10 min expiry, 5 attempts, 60 s resend cooldown) | `routes/auth.js` |
| Passwords hashed with bcrypt (cost 12); JWT sent as `Authorization: Bearer <token>` | `routes/auth.js`, `middleware/auth.js` |
| Suspended/inactive users are rejected on every request and socket connect | `middleware/auth.js`, `socket.js` |
| Uploaded media must be URLs from your own Cloudinary account | `utils/cloudinary.js#isOurAsset` |

Account states: `pending_email` → `active` (DIU email) · `pending_review` → `active`/`rejected` (alumni proof) · `suspended`.

## 3. API overview (all under `/api`, JSON; errors look like `{ error: { code, message, details } }`)

- **Auth** `POST /auth/register | verify-email | resend-code | login | forgot-password | reset-password | change-password`, `GET /auth/me`
- **Users** `GET /users` (directory/alumni filters: `q, role, department, batch, industry`), `GET /users/suggestions`, `GET /users/:id`,
  `PATCH /users/me`, `PATCH /users/me/settings`, `PUT /users/me/skills`, `POST|PATCH|DELETE /users/me/{education|experience|projects}[/:id]`, `GET /users/me/strength`
- **Connections** `GET /connections`, `/connections/requests`, `/connections/sent`, `POST /connections/request`, `POST /connections/:id/accept`, `DELETE /connections/:id`, `DELETE /connections/user/:id`
- **Posts** `GET /posts/feed?tab=forYou|following|latest&cursor=`, `POST /posts`, `GET|PATCH|DELETE /posts/:id`, `PUT|DELETE /posts/:id/reaction`, `PUT|DELETE /posts/:id/save`,
  `POST /posts/:id/share`, `GET|POST /posts/:id/comments`, `DELETE /posts/:id/comments/:cid`, `GET /posts/saved | /posts/user/:id | /posts/club/:id | /posts/tag/:tag | /posts/trending/tags`
- **Explore / search** `GET /explore?type=video|photo|post&topic=&sort=views|latest&q=`, `GET /search?q=`
- **Clubs** `GET /clubs`, `GET /clubs/:id`, `POST /clubs/:id/join`, `DELETE /clubs/:id/leave`, member + approval endpoints; admins create clubs
- **Events** `GET /events`, `PUT|DELETE /events/:id/going`, `POST /events` (admin or club admin)
- **Jobs** `GET /jobs?kind=job|internship|alumni_referral|on_campus`, `POST /jobs` (alumni/admin; on-campus = admin only), `PUT|DELETE /jobs/:id/save`, `POST|DELETE /jobs/:id/apply`, applicant review endpoints
- **Messages** `GET /messages/conversations`, `POST /messages/conversations {userId}`, `GET /messages/conversations/:id/messages`, `POST .../read`
- **Notifications** `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all`
- **Upload** `POST /upload?folder=avatars|covers|posts|clubs|events|projects` (multipart field `file`) → `{ url }`; send that URL in `avatarUrl`, `imageUrl`, etc.
- **Admin** `GET /admin/stats | pending-alumni | users`, `GET /admin/users/:id/proof`, `POST /admin/users/:id/approve | reject | suspend | restore`

### Socket.IO
Connect with `io(API_URL, { auth: { token } })`. Client → server: `message:send` (with ack), `typing`, `message:read`.
Server → client: `message:new`, `message:read`, `typing`, `presence:update`, `notification:new`.

## 4. Connecting the frontend
1. Copy `docs/api.js` to `frontend/src/lib/api.js`, run `npm i socket.io-client` in the frontend, add `VITE_API_URL=http://localhost:5000` to the frontend `.env`.
2. Replace the demo data in order: `Auth.jsx` (register/verify/login) → `App.jsx` (feed, composer, like/save/comment) → profile → `Pages.jsx` screens (Messages, Notifications, Jobs, Events, Clubs, Alumni, Network, Explore, Saved, Settings).
3. Remove the client-side demo OTP (`123456`); the real code comes by email (or the server console in development).

## 5. Production checklist
- `NODE_ENV=production`, strong `JWT_SECRET`, HTTPS, real SMTP (e.g. a DIU mailbox or Brevo/Resend).
- Run behind a reverse proxy; for more than one server instance add the Socket.IO Redis adapter (presence/typing are in-memory now).
- Back up MySQL; keep `.env` out of Git (already in `.gitignore`).
