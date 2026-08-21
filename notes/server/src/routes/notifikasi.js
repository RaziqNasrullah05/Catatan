import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../security.js';

export const notifikasiRouter = Router();
notifikasiRouter.use(requireAuth);

const sebutan = (row) => (row.aktor_username ? `@${row.aktor_username}` : row.aktor_email || 'Seseorang');

/**
 * Kalimat notifikasi dirakit di server supaya klien tidak perlu tahu aturan
 * penamaan tiap jenis, dan jenis baru cukup ditambahkan di satu tempat.
 */
function kalimat(row) {
  if (row.jenis === 'undangan_grup') {
    return {
      judul: `${sebutan(row)} mengundangmu ke grup`,
      isi: row.grup_nama || 'Grup sudah dibubarkan',
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
  SELECT n.*, u.email AS aktor_email, u.username AS aktor_username, g.nama AS grup_nama
    FROM notifikasi n
    LEFT JOIN users u ON u.id = n.aktor_id
    LEFT JOIN grup  g ON g.id = n.grup_id
   WHERE n.penerima_id = ?`;

notifikasiRouter.get('/', (req, res) => {
  const rows = db.prepare(`${AMBIL} ORDER BY n.created_at DESC LIMIT 100`).all(req.user.id);
  const belumDibaca = rows.filter((r) => !r.read_at).length;
  res.json({ notifikasi: rows.map(bentuk), belumDibaca });
});

/** Dipanggil sering oleh titik merah di bilah atas, jadi sengaja seringan mungkin. */
notifikasiRouter.get('/jumlah', (req, res) => {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM notifikasi WHERE penerima_id = ? AND read_at IS NULL')
    .get(req.user.id);
  res.json({ belumDibaca: row.n });
});

notifikasiRouter.post('/dibaca', (req, res) => {
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

notifikasiRouter.post('/:id/terima', (req, res) => {
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

  db.prepare("UPDATE notifikasi SET status = 'diterima', read_at = ? WHERE id = ?").run(now, n.id);
  res.json({ ok: true });
});

notifikasiRouter.post('/:id/tolak', (req, res) => {
  const n = ambilMenunggu(req.params.id, req.user.id);
  if (!n) return res.status(404).json({ error: 'Pemberitahuan itu sudah tidak berlaku.' });
  db.prepare("UPDATE notifikasi SET status = 'ditolak', read_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    req.params.id
  );
  res.json({ ok: true });
});