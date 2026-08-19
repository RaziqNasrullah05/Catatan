import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db.js';
import { sendInvite, sendLoginLink } from '../mailer.js';
import {
  createSession,
  destroySession,
  hashToken,
  newId,
  newToken,
  normalizeEmail,
  requireAdmin,
  requireAuth,
} from '../security.js';

export const authRouter = Router();

const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
// Saat pengembangan, antarmuka dan API berada di port berbeda; tautan email harus menuju API.
const API_URL = (process.env.API_URL || APP_URL).replace(/\/$/, '');
const LOGIN_TOKEN_MINUTES = 15;
const INVITE_DAYS = 7;

const emailSchema = z.string().trim().toLowerCase().email().max(254);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' },
});

const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });

function issueLoginLink(user) {
  const token = newToken();
  db.prepare(
    `INSERT INTO login_tokens (id, user_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    newId(),
    user.id,
    hashToken(token),
    new Date().toISOString(),
    new Date(Date.now() + LOGIN_TOKEN_MINUTES * 60 * 1000).toISOString()
  );
  return `${API_URL}/api/auth/verify?token=${token}`;
}

/* ---------- Masuk ---------- */

authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = emailSchema.safeParse(req.body?.email);
  // Jawaban selalu sama agar alamat email yang terdaftar tidak bisa ditebak.
  const generic = { ok: true };
  if (!parsed.success) return res.json(generic);

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND disabled = 0').get(parsed.data);
  if (user) {
    try {
      await sendLoginLink(user.email, issueLoginLink(user));
    } catch (err) {
      console.error('Gagal mengirim tautan masuk:', err);
      return res.status(502).json({ error: 'Email gagal dikirim. Coba lagi sebentar lagi.' });
    }
  }
  res.json(generic);
});

authRouter.get('/verify', verifyLimiter, (req, res) => {
  const token = String(req.query.token || '');
  const row = token
    ? db
        .prepare(
          `SELECT * FROM login_tokens
            WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`
        )
        .get(hashToken(token), new Date().toISOString())
    : null;

  if (!row) return res.redirect(`${APP_URL}/login?error=kedaluwarsa`);

  db.prepare('UPDATE login_tokens SET used_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  createSession(res, row.user_id, req.get('user-agent'));
  res.redirect(`${APP_URL}/`);
});

authRouter.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user || null });
});

/* ---------- Undangan ---------- */

authRouter.get('/invite/:token', verifyLimiter, (req, res) => {
  const invite = db
    .prepare(
      `SELECT email, expires_at FROM invites
        WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`
    )
    .get(hashToken(String(req.params.token)), new Date().toISOString());
  if (!invite) return res.status(404).json({ error: 'Undangan tidak berlaku lagi.' });
  res.json({ valid: true, email: invite.email });
});

const acceptLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10 });

authRouter.post('/invite/:token/accept', acceptLimiter, async (req, res) => {
  const parsed = emailSchema.safeParse(req.body?.email);
  if (!parsed.success) return res.status(400).json({ error: 'Alamat email tidak valid.' });

  const tokenHash = hashToken(String(req.params.token));
  const invite = db
    .prepare(`SELECT * FROM invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`)
    .get(tokenHash, new Date().toISOString());
  if (!invite) return res.status(404).json({ error: 'Undangan tidak berlaku lagi.' });
  if (invite.email && invite.email !== parsed.data) {
    return res.status(400).json({ error: 'Undangan ini ditujukan untuk alamat email lain.' });
  }

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(parsed.data);
  const now = new Date().toISOString();
  if (!user) {
    const id = newId();
    db.prepare('INSERT INTO users (id, email, role, created_at) VALUES (?, ?, ?, ?)').run(
      id,
      parsed.data,
      'member',
      now
    );
    user = { id, email: parsed.data };
  }
  db.prepare('UPDATE invites SET used_at = ?, used_by = ? WHERE id = ?').run(now, user.id, invite.id);

  try {
    await sendLoginLink(user.email, issueLoginLink(user));
  } catch (err) {
    console.error('Gagal mengirim tautan masuk:', err);
    return res.status(502).json({ error: 'Email gagal dikirim. Coba lagi sebentar lagi.' });
  }
  res.json({ ok: true });
});

/* ---------- Admin ---------- */

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/users', (_req, res) => {
  res.json({
    users: db
      .prepare('SELECT id, email, role, disabled, created_at, last_seen_at FROM users ORDER BY created_at')
      .all(),
  });
});

adminRouter.get('/invites', (_req, res) => {
  res.json({
    invites: db
      .prepare(
        `SELECT id, email, created_at, expires_at, used_at FROM invites
          ORDER BY created_at DESC LIMIT 50`
      )
      .all(),
  });
});

adminRouter.post('/invites', async (req, res) => {
  const raw = req.body?.email ? emailSchema.safeParse(req.body.email) : null;
  if (raw && !raw.success) return res.status(400).json({ error: 'Alamat email tidak valid.' });
  const email = raw ? raw.data : null;

  const token = newToken();
  db.prepare(
    `INSERT INTO invites (id, token_hash, email, created_by, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    newId(),
    hashToken(token),
    email,
    req.user.id,
    new Date().toISOString(),
    new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  );

  const url = `${APP_URL}/invite/${token}`;
  let mailed = false;
  if (email) {
    try {
      mailed = await sendInvite(email, url);
    } catch (err) {
      console.error('Gagal mengirim undangan:', err);
    }
  }
  res.json({ url, mailed });
});

adminRouter.post('/users/:id/access', (req, res) => {
  const disabled = req.body?.disabled ? 1 : 0;
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Kamu tidak bisa menonaktifkan akunmu sendiri.' });
  }
  db.prepare('UPDATE users SET disabled = ? WHERE id = ?').run(disabled, req.params.id);
  if (disabled) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
  res.json({ ok: true });
});

/** Membuat akun admin pertama dari variabel lingkungan. */
export function bootstrapAdmin() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  if (!email) return;
  const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);
  if (existing) {
    if (existing.role !== 'admin') db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
    return;
  }
  db.prepare("INSERT INTO users (id, email, role, created_at) VALUES (?, ?, 'admin', ?)").run(
    newId(),
    email,
    new Date().toISOString()
  );
  console.log(`Akun admin dibuat untuk ${email}. Masuk lewat halaman /login.`);
}
