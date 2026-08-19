import crypto from 'node:crypto';
import { db } from './db.js';

export const SESSION_COOKIE = 'sid';
const SESSION_DAYS = 30;

export const isProd = process.env.NODE_ENV === 'production';

export const newId = () => crypto.randomUUID();

/** Token acak yang dikirim ke pengguna; hanya hash-nya yang disimpan. */
export const newToken = () => crypto.randomBytes(32).toString('base64url');
export const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: isProd,
    // Lax dibutuhkan agar cookie ikut terkirim saat pengguna membuka tautan masuk dari email.
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function createSession(res, userId, userAgent) {
  const token = newToken();
  const maxAge = SESSION_DAYS * 24 * 60 * 60 * 1000;
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    newId(),
    userId,
    hashToken(token),
    new Date().toISOString(),
    new Date(Date.now() + maxAge).toISOString(),
    String(userAgent || '').slice(0, 200)
  );
  res.cookie(SESSION_COOKIE, token, cookieOptions(maxAge));
}

export function destroySession(req, res) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(0), maxAge: undefined });
}

/** Menempelkan req.user bila cookie sesi valid. Tidak pernah melempar error. */
export function attachUser(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.role, u.disabled
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .get(hashToken(token), new Date().toISOString());
  if (row && !row.disabled) {
    req.user = { id: row.id, email: row.email, role: row.role };
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Masuk dulu untuk melanjutkan.' });
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Akses khusus admin.' });
  next();
}

/**
 * Pertahanan CSRF. Cookie sesi memakai SameSite=Lax sehingga permintaan lintas situs
 * yang berbahaya hanya mungkin lewat metode sederhana; header kustom di bawah ini
 * tidak bisa dipasang oleh form HTML biasa dan memaksa preflight CORS.
 */
export function requireFetchHeader(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'catatan-app') {
    return res.status(403).json({ error: 'Permintaan ditolak.' });
  }
  next();
}
