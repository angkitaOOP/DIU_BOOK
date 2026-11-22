import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { q, one } from '../db.js';
import { config } from '../config.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { DIU_EMAIL, STUDENT_ID, sha256, safeEqual, sixDigitCode } from '../utils/helpers.js';
import { defaultSettings } from '../utils/settings.js';
import { sendMail } from '../utils/mailer.js';
import { uploadBuffer } from '../utils/cloudinary.js';
import { validate } from '../middleware/validate.js';
import { proofUpload } from '../middleware/upload.js';
import { auth, signToken } from '../middleware/auth.js';
import { toMe, getUserById } from '../services/users.js';

const router = Router();
const strict = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again in a few minutes.' } } });
router.use(strict);

const CODE_TTL_MIN = 10, MAX_ATTEMPTS = 5, RESEND_COOLDOWN_S = 60;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12); // keeps login timing similar for unknown emails
const emailField = z.string().trim().toLowerCase().email('Enter a valid email address.').max(190);
const passwordField = z.string().min(8, 'Password needs at least 8 characters.').max(72, 'Password is too long (max 72 characters).');
const thisYear = new Date().getFullYear();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: emailField,
  password: passwordField,
  studentId: z.string().trim().regex(STUDENT_ID, 'Enter your student ID, like 231-35-1234.'),
  role: z.enum(['student', 'alumni']),
  via: z.enum(['diu', 'personal']).default('diu'),
  graduationYear: z.preprocess(v => (v === '' ? undefined : v), z.coerce.number().int().min(2000).max(thisYear).optional()),
  department: z.string().trim().max(120).optional(),
});

async function issueCode(userId, purpose, email) {
  const last = await one('SELECT created_at FROM email_codes WHERE user_id=? AND purpose=? ORDER BY id DESC LIMIT 1', [userId, purpose]);
  if (last) {
    const age = (Date.now() - new Date(last.created_at).getTime()) / 1000;
    if (age < RESEND_COOLDOWN_S) throw new AppError(429, `Please wait ${Math.ceil(RESEND_COOLDOWN_S - age)}s before requesting another code.`, 'CODE_COOLDOWN');
  }
  const code = sixDigitCode();
  await q('DELETE FROM email_codes WHERE user_id=? AND purpose=?', [userId, purpose]);
  await q('INSERT INTO email_codes (user_id, purpose, code_hash, expires_at) VALUES (?,?,?, NOW() + INTERVAL ? MINUTE)', [userId, purpose, sha256(code), CODE_TTL_MIN]);
  const subject = purpose === 'verify_email' ? 'Your DIULink verification code' : 'Your DIULink password reset code';
  await sendMail({ to: email, subject, text: `Your DIULink code is ${code}. It expires in ${CODE_TTL_MIN} minutes. If you did not request it, ignore this email.` });
}

async function checkCode(userId, purpose, code) {
  const row = await one('SELECT * FROM email_codes WHERE user_id=? AND purpose=? ORDER BY id DESC LIMIT 1', [userId, purpose]);
  if (!row) throw new AppError(400, 'Request a new code first.', 'NO_CODE');
  if (new Date(row.expires_at).getTime() < Date.now()) throw new AppError(400, 'That code has expired. Request a new one.', 'CODE_EXPIRED');
  if (row.attempts >= MAX_ATTEMPTS) throw new AppError(429, 'Too many wrong attempts. Request a new code.', 'CODE_LOCKED');
  if (!safeEqual(sha256(code), row.code_hash)) {
    await q('UPDATE email_codes SET attempts = attempts + 1 WHERE id=?', [row.id]);
    throw new AppError(400, 'That code doesn’t match. Check your inbox and try again.', 'CODE_INVALID');
  }
  await q('DELETE FROM email_codes WHERE user_id=? AND purpose=?', [userId, purpose]);
}

/* ---- POST /api/auth/register  (JSON, or multipart when an alumnus uploads proof) ---- */
router.post('/register', proofUpload, validate(registerSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  const personal = b.role === 'alumni' && b.via === 'personal';
  if (!personal && !DIU_EMAIL.test(b.email)) throw new AppError(400, 'Only @diu.edu.bd emails can be used for this option.', 'DIU_EMAIL_REQUIRED', { email: 'Use your DIU email, like name@diu.edu.bd' });
  if (b.role === 'alumni' && !b.graduationYear) throw new AppError(400, 'Choose your graduation year.', 'VALIDATION_ERROR', { graduationYear: 'Choose your graduation year.' });
  if (personal && !req.file) throw new AppError(400, 'Upload your student ID card or certificate.', 'PROOF_REQUIRED', { proof: 'Upload your student ID card or certificate.' });

  const dup = await one('SELECT email, student_id FROM users WHERE email=? OR student_id=?', [b.email, b.studentId]);
  if (dup) throw new AppError(409, dup.email === b.email ? 'An account with this email already exists.' : 'An account with this student ID already exists.', 'ACCOUNT_EXISTS');

  let proof = {};
  if (personal) {
    const up = await uploadBuffer(req.file.buffer, { folder: 'proofs', type: 'authenticated' });
    proof = { id: up.public_id, format: up.format || (req.file.mimetype === 'application/pdf' ? 'pdf' : 'jpg') };
  }
  const hash = await bcrypt.hash(b.password, config.bcryptRounds);
  const status = personal ? 'pending_review' : 'pending_email';
  const result = await q(
    `INSERT INTO users (name,email,password_hash,role,status,student_id,department,graduation_year,proof_public_id,proof_format,settings)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [b.name, b.email, hash, b.role, status, b.studentId, b.department || null, b.role === 'alumni' ? b.graduationYear : null,
      proof.id || null, proof.format || null, JSON.stringify(defaultSettings)]);

  if (!personal) await issueCode(result.insertId, 'verify_email', b.email);
  res.status(201).json({ status, email: b.email,
    message: personal ? 'Request received. The DIU team will review your proof within 2 working days.' : 'We sent a 6-digit code to your DIU email.' });
}));

/* ---- POST /api/auth/verify-email ---- */
router.post('/verify-email', validate(z.object({ email: emailField, code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.') })),
  asyncHandler(async (req, res) => {
    const user = await one("SELECT * FROM users WHERE email=? AND status='pending_email'", [req.body.email]);
    if (!user) throw new AppError(400, 'That code doesn’t match. Check your inbox and try again.', 'CODE_INVALID');
    await checkCode(user.id, 'verify_email', req.body.code);
    await q("UPDATE users SET email_verified=1, status='active' WHERE id=?", [user.id]);
    const fresh = await getUserById(user.id);
    res.json({ token: signToken(fresh), user: toMe(fresh) });
  }));

/* ---- POST /api/auth/resend-code ---- */
router.post('/resend-code', validate(z.object({ email: emailField })), asyncHandler(async (req, res) => {
  const user = await one("SELECT id, email FROM users WHERE email=? AND status='pending_email'", [req.body.email]);
  if (user) await issueCode(user.id, 'verify_email', user.email);
  res.json({ message: 'If that account is waiting for verification, we sent a new code.' }); // same reply either way
}));

/* ---- POST /api/auth/login ---- */
router.post('/login', validate(z.object({ email: emailField, password: z.string().min(1).max(72) })), asyncHandler(async (req, res) => {
  const user = await one('SELECT * FROM users WHERE email=?', [req.body.email]);
  const ok = await bcrypt.compare(req.body.password, user?.password_hash || DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'Incorrect email or password.', 'BAD_CREDENTIALS');
  const blocked = {
    pending_email: [403, 'EMAIL_NOT_VERIFIED', 'Verify your email with the 6-digit code first.'],
    pending_review: [403, 'PENDING_REVIEW', 'Your alumni request is still being reviewed.'],
    rejected: [403, 'REJECTED', 'Your alumni request was not approved. Contact the DIU team.'],
    suspended: [403, 'SUSPENDED', 'This account has been suspended.'],
  }[user.status];
  if (blocked) throw new AppError(blocked[0], blocked[2], blocked[1]);
  await q('UPDATE users SET last_seen_at = NOW() WHERE id=?', [user.id]);
  res.json({ token: signToken(user), user: toMe(user) });
}));

/* ---- Password reset (code by email) ---- */
router.post('/forgot-password', validate(z.object({ email: emailField })), asyncHandler(async (req, res) => {
  const user = await one("SELECT id, email FROM users WHERE email=? AND status='active'", [req.body.email]);
  if (user) await issueCode(user.id, 'reset_password', user.email).catch(e => { if (e.code !== 'CODE_COOLDOWN') throw e; });
  res.json({ message: 'If that email has an account, we sent a reset code.' });
}));

router.post('/reset-password', validate(z.object({ email: emailField, code: z.string().regex(/^\d{6}$/), newPassword: passwordField })),
  asyncHandler(async (req, res) => {
    const user = await one("SELECT id FROM users WHERE email=? AND status='active'", [req.body.email]);
    if (!user) throw new AppError(400, 'That code doesn’t match. Check your inbox and try again.', 'CODE_INVALID');
    await checkCode(user.id, 'reset_password', req.body.code);
    await q('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(req.body.newPassword, config.bcryptRounds), user.id]);
    res.json({ message: 'Password updated. You can sign in now.' });
  }));

/* ---- Authenticated ---- */
router.get('/me', auth, asyncHandler(async (req, res) => res.json({ user: toMe(await getUserById(req.user.id)) })));

router.post('/change-password', auth, validate(z.object({ currentPassword: z.string().min(1).max(72), newPassword: passwordField })),
  asyncHandler(async (req, res) => {
    const u = await getUserById(req.user.id);
    if (!(await bcrypt.compare(req.body.currentPassword, u.password_hash))) throw new AppError(400, 'Your current password is incorrect.', 'BAD_PASSWORD');
    await q('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(req.body.newPassword, config.bcryptRounds), u.id]);
    res.json({ message: 'Password changed.' });
  }));

export default router;
