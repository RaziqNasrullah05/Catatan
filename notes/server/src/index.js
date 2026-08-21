import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { purgeExpired } from './db.js';
import { mailAktif, verifikasiSmtp } from './mailer.js';
import { attachUser, isProd, requireFetchHeader } from './security.js';
import { adminRouter, authRouter, bootstrapAdmin } from './routes/auth.js';
import { notesRouter } from './routes/notes.js';
import { groupRouter } from './routes/group.js';
import { notificationRouter } from './routes/notification.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');

// Di belakang Nginx: percaya satu lapis proxy agar rate limit membaca IP asli.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // CodeMirror menyuntikkan gaya lewat elemen <style> saat berjalan.
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'same-origin' },
    hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  })
);

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(cors({ origin: APP_URL, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'] }));

app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.use('/api', requireFetchHeader, attachUser);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notes', notesRouter);
app.use('/api/groups', groupRouter);
app.use('/api/notifications', notificationRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Alamat tidak dikenal.' }));

// Melayani hasil build antarmuka bila tersedia (satu origin saat produksi).
const clientDir = path.resolve(process.cwd(), process.env.CLIENT_DIR || '../client/dist');
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server.' });
});

/**
 * Salah konfigurasi di sini tidak membuat server gagal start — ia hanya mematahkan
 * tautan masuk secara diam-diam, dan yang terlihat pengguna cuma halaman kosong.
 * Karena itu semuanya dilaporkan lantang saat start.
 */
async function periksaKonfigurasi() {
  const peringatan = [];

  if (!process.env.APP_URL) {
    peringatan.push('APP_URL belum diisi. Tautan masuk akan mengarah ke http://localhost:5173.');
  } else if (isProd && APP_URL.startsWith('http://')) {
    peringatan.push(
      `APP_URL memakai http:// (${APP_URL}) padahal NODE_ENV=production. ` +
        'Cookie sesi bertanda Secure tidak akan terpasang lewat http, jadi tautan masuk ' +
        'berakhir di halaman kosong. Ganti ke https://.'
    );
  }

  if (isProd && process.env.API_URL) {
    peringatan.push(
      `API_URL diisi (${process.env.API_URL}) padahal produksi memakai satu origin. ` +
        'Kosongkan agar tautan email mengikuti APP_URL.'
    );
  }

  if (!process.env.ADMIN_EMAIL) {
    peringatan.push('ADMIN_EMAIL kosong. Tidak ada akun admin yang dibuat, jadi tidak ada yang bisa mengundang orang.');
  }

  if (!fs.existsSync(clientDir)) {
    peringatan.push(`Folder ${clientDir} tidak ada. Jalankan "npm run build" di client, atau "/" akan membalas Cannot GET /.`);
  }

  const smtp = await verifikasiSmtp();
  if (!mailAktif) {
    peringatan.push('SMTP_HOST kosong. Tautan masuk dan undangan hanya dicetak ke log, tidak dikirim ke email.');
  } else if (!smtp.ok) {
    peringatan.push(`Sambungan SMTP gagal: ${smtp.alasan}. Email tidak akan terkirim.`);
  } else {
    console.log(`SMTP siap lewat ${process.env.SMTP_HOST}, pengirim: ${process.env.MAIL_FROM || '(MAIL_FROM kosong)'}`);
  }

  for (const pesan of peringatan) console.warn(`[konfigurasi] ${pesan}`);
}

bootstrapAdmin();
purgeExpired();
setInterval(purgeExpired, 60 * 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  periksaKonfigurasi();
});