import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { requireAuth } from '../security.js';

export const notificationRouter = Router();
notificationRouter.use(requireAuth);

const sebutan = (row) => (row.aktor_username ? `@${row.aktor_username}` : row.aktor_email || 'Seseorang');

/**
 * Kalimat notifikasi dirakit di server supaya klien tidak perlu tahu aturan
 * penamaan tiap jenis, dan jenis baru cukup ditambahkan di satu tempat.
 */
function kalimat(row) {
  const namaTarget = row.target_username ? `@${row.target_username}` : row.target_email;

  if (row.jenis === 'undangan_grup') {
    return {
      judul: `${sebutan(row)} mengundangmu ke grup`,
      isi: row.grup_nama || 'Grup sudah dibubarkan',
    };
  }
  if (row.jenis === 'usul_kolaborasi') {
    return {
      judul: `${sebutan(row)} mengusulkan ${namaTarget} ikut menyunting catatanmu`,
      isi: row.note_title || 'Tanpa judul',
    };
  }
  if (row.jenis === 'kolaborasi_aktif') {
    return {
      judul: `Kamu kini bisa menyunting catatan ${sebutan(row)}`,
      isi: row.note_title || 'Tanpa judul',
    };
  }
  return { judul: 'Pemberitahuan', isi: '' };
}

const bentuk = (row) => ({
  id: row.id,
  jenis: row.jenis,
  status: row.status,
  dibaca: Boolean(row.read_at),
  grupId: row.grup_id,
  noteId: row.note_id,
  createdAt: row.created_at,
  ...kalimat(row),
});

const AMBIL = `
  SELECT n.*,
         u.email AS aktor_email,  u.username AS aktor_username,
         t.email AS target_email, t.username AS target_username,
         g.nama  AS grup_nama,    c.title    AS note_title
    FROM notifikasi n
    LEFT JOIN users u ON u.id = n.aktor_id
    LEFT JOIN users t ON t.id = n.target_id
    LEFT JOIN grup  g ON g.id = n.grup_id
    LEFT JOIN notes c ON c.id = n.note_id
   WHERE n.penerima_id = ?`;

notificationRouter.get('/', (req, res) => {
  const rows = db.prepare(`${AMBIL} ORDER BY n.created_at DESC LIMIT 100`).all(req.user.id);
  const belumDibaca = rows.filter((r) => !r.read_at).length;
  res.json({ notifikasi: rows.map(bentuk), belumDibaca });
});

/** Dipanggil sering oleh titik merah di bilah atas, jadi sengaja seringan mungkin. */
notificationRouter.get('/count', (req, res) => {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM notifikasi WHERE penerima_id = ? AND read_at IS NULL')
    .get(req.user.id);
  res.json({ belumDibaca: row.n });
});

notificationRouter.post('/read', (req, res) => {
  db.prepare('UPDATE notifikasi SET read_at = ? WHERE penerima_id = ? AND read_at IS NULL').run(
    new Date().toISOString(),
    req.user.id
  );
  res.json({ ok: true });
});

function ambilMenunggu(id, userId) {
  return db
    .prepare("SELECT * FROM notifikasi WHERE id = ? AND penerima_id = ? AND status = 'menunggu'")
    .get(id, userId);
}

notificationRouter.post('/:id/accept', (req, res) => {
  const n = ambilMenunggu(req.params.id, req.user.id);
  if (!n) return res.status(404).json({ error: 'Pemberitahuan itu sudah tidak berlaku.' });
  const now = new Date().toISOString();

  if (n.jenis === 'undangan_grup') {
    const grup = db.prepare('SELECT id FROM grup WHERE id = ?').get(n.grup_id);
    if (!grup) {
      db.prepare("UPDATE notifikasi SET status = 'ditolak', read_at = ? WHERE id = ?").run(now, n.id);
      return res.status(410).json({ error: 'Grup itu sudah dibubarkan.' });
    }
    db.transaction(() => {
      db.prepare(
        `INSERT OR IGNORE INTO grup_anggota (grup_id, user_id, peran, joined_at)
         VALUES (?, ?, 'anggota', ?)`
      ).run(n.grup_id, req.user.id, now);
      db.prepare("UPDATE notifikasi SET status = 'diterima', read_at = ? WHERE id = ?").run(now, n.id);
    })();
    return res.json({ ok: true, grupId: n.grup_id });
  }

  if (n.jenis === 'usul_kolaborasi') {
    const note = db
      .prepare('SELECT id, user_id FROM notes WHERE id = ? AND deleted_at IS NULL')
      .get(n.note_id);
    // Penerima usulan harus penulisnya; kalau catatannya sudah hilang, usulannya
    // ikut gugur alih-alih memberi izin atas sesuatu yang tidak ada.
    if (!note || note.user_id !== req.user.id) {
      db.prepare("UPDATE notifikasi SET status = 'ditolak', read_at = ? WHERE id = ?").run(now, n.id);
      return res.status(410).json({ error: 'Catatan itu sudah tidak ada.' });
    }
    db.transaction(() => {
      db.prepare(
        `INSERT OR IGNORE INTO catatan_kolaborator (note_id, user_id, granted_by, granted_at)
         VALUES (?, ?, ?, ?)`
      ).run(n.note_id, n.target_id, req.user.id, now);
      db.prepare("UPDATE notifikasi SET status = 'diterima', read_at = ? WHERE id = ?").run(now, n.id);
      // Yang diusulkan diberi tahu bahwa izinnya sudah berlaku.
      db.prepare(
        `INSERT INTO notifikasi (id, penerima_id, aktor_id, jenis, grup_id, note_id, status, created_at)
         VALUES (?, ?, ?, 'kolaborasi_aktif', ?, ?, 'info', ?)`
      ).run(randomUUID(), n.target_id, req.user.id, n.grup_id, n.note_id, now);
    })();
    return res.json({ ok: true, noteId: n.note_id });
  }

  db.prepare("UPDATE notifikasi SET status = 'diterima', read_at = ? WHERE id = ?").run(now, n.id);
  res.json({ ok: true });
});

notificationRouter.post('/:id/reject', (req, res) => {
  const n = ambilMenunggu(req.params.id, req.user.id);
  if (!n) return res.status(404).json({ error: 'Pemberitahuan itu sudah tidak berlaku.' });
  db.prepare("UPDATE notifikasi SET status = 'ditolak', read_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    req.params.id
  );
  res.json({ ok: true });
});