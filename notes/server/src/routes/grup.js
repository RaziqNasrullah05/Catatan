import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { newId, requireAuth } from '../security.js';

export const grupRouter = Router();
grupRouter.use(requireAuth);

const namaSchema = z.string().trim().min(2).max(60);

/** Nama yang ditampilkan ke orang lain: username kalau ada, kalau tidak email. */
const sebutan = (u) => (u.username ? `@${u.username}` : u.email);

const bentukAnggota = (row) => ({
  id: row.id,
  email: row.email,
  username: row.username,
  nama: sebutan(row),
  peran: row.peran,
  joinedAt: row.joined_at,
});

/** Peran orang ini di grup tersebut, atau null kalau bukan anggota. */
function peranDi(grupId, userId) {
  const row = db
    .prepare('SELECT peran FROM grup_anggota WHERE grup_id = ? AND user_id = ?')
    .get(grupId, userId);
  return row?.peran ?? null;
}

function ambilGrup(grupId, userId) {
  const peran = peranDi(grupId, userId);
  if (!peran) return null;
  const g = db.prepare('SELECT * FROM grup WHERE id = ?').get(grupId);
  if (!g) return null;
  return { g, peran };
}

/* ---------- Daftar dan pembuatan ---------- */

grupRouter.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT g.id, g.nama, g.created_at, a.peran,
              (SELECT COUNT(*) FROM grup_anggota x WHERE x.grup_id = g.id) AS jumlah_anggota
         FROM grup_anggota a JOIN grup g ON g.id = a.grup_id
        WHERE a.user_id = ?
        ORDER BY g.created_at DESC`
    )
    .all(req.user.id);

  res.json({
    grup: rows.map((r) => ({
      id: r.id,
      nama: r.nama,
      peran: r.peran,
      jumlahAnggota: r.jumlah_anggota,
      createdAt: r.created_at,
    })),
  });
});

grupRouter.post('/', (req, res) => {
  const parsed = namaSchema.safeParse(req.body?.nama);
  if (!parsed.success) return res.status(400).json({ error: 'Nama grup 2–60 karakter.' });

  const id = newId();
  const now = new Date().toISOString();
  // Pembuat langsung menjadi pemimpin; grup tanpa pemimpin tidak boleh ada.
  db.transaction(() => {
    db.prepare('INSERT INTO grup (id, nama, leader_id, created_at) VALUES (?, ?, ?, ?)').run(
      id,
      parsed.data,
      req.user.id,
      now
    );
    db.prepare(
      "INSERT INTO grup_anggota (grup_id, user_id, peran, joined_at) VALUES (?, ?, 'leader', ?)"
    ).run(id, req.user.id, now);
  })();

  res.status(201).json({ grup: { id, nama: parsed.data, peran: 'leader', jumlahAnggota: 1, createdAt: now } });
});

/* ---------- Satu grup ---------- */

grupRouter.get('/:id', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Grup tidak ditemukan.' });

  const anggota = db
    .prepare(
      `SELECT u.id, u.email, u.username, a.peran, a.joined_at
         FROM grup_anggota a JOIN users u ON u.id = a.user_id
        WHERE a.grup_id = ?
        ORDER BY CASE a.peran WHEN 'leader' THEN 0 ELSE 1 END, a.joined_at`
    )
    .all(req.params.id);

  const undangan = db
    .prepare(
      `SELECT n.id, n.created_at, u.email, u.username
         FROM notifikasi n JOIN users u ON u.id = n.penerima_id
        WHERE n.grup_id = ? AND n.jenis = 'undangan_grup' AND n.status = 'menunggu'
        ORDER BY n.created_at DESC`
    )
    .all(req.params.id);

  res.json({
    grup: {
      id: ada.g.id,
      nama: ada.g.nama,
      peran: ada.peran,
      createdAt: ada.g.created_at,
      anggota: anggota.map(bentukAnggota),
      undangan: undangan.map((u) => ({
        id: u.id,
        nama: sebutan(u),
        createdAt: u.created_at,
      })),
    },
  });
});

grupRouter.patch('/:id', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
  if (ada.peran !== 'leader') return res.status(403).json({ error: 'Hanya pemimpin grup yang bisa mengubah ini.' });

  const parsed = namaSchema.safeParse(req.body?.nama);
  if (!parsed.success) return res.status(400).json({ error: 'Nama grup 2–60 karakter.' });
  db.prepare('UPDATE grup SET nama = ? WHERE id = ?').run(parsed.data, req.params.id);
  res.json({ ok: true, nama: parsed.data });
});

grupRouter.delete('/:id', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
  if (ada.peran !== 'leader') return res.status(403).json({ error: 'Hanya pemimpin grup yang bisa membubarkan grup.' });
  // Anggota, undangan, dan kaitan catatan ikut terhapus lewat ON DELETE CASCADE.
  db.prepare('DELETE FROM grup WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ---------- Undangan ---------- */

grupRouter.post('/:id/undang', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
  if (ada.peran !== 'leader') return res.status(403).json({ error: 'Hanya pemimpin grup yang bisa mengundang.' });

  const raw = String(req.body?.orang || '').trim().toLowerCase();
  if (!raw) return res.status(400).json({ error: 'Isi nama pengguna atau email orang yang diundang.' });

  // Tanda @ menandai email; selain itu dianggap nama pengguna. Awalan @ pada
  // nama pengguna dilepas supaya "@sigit" dan "sigit" sama saja.
  const sasaran = raw.includes('@') && !raw.startsWith('@')
    ? db.prepare('SELECT * FROM users WHERE email = ? AND disabled = 0').get(raw)
    : db.prepare('SELECT * FROM users WHERE username = ? AND disabled = 0').get(raw.replace(/^@/, ''));

  if (!sasaran) return res.status(404).json({ error: 'Orang itu tidak ditemukan.' });
  if (sasaran.id === req.user.id) return res.status(400).json({ error: 'Kamu sudah ada di grup ini.' });
  if (peranDi(req.params.id, sasaran.id)) {
    return res.status(409).json({ error: `${sebutan(sasaran)} sudah menjadi anggota grup ini.` });
  }

  const menggantung = db
    .prepare(
      `SELECT id FROM notifikasi
        WHERE penerima_id = ? AND grup_id = ? AND jenis = 'undangan_grup' AND status = 'menunggu'`
    )
    .get(sasaran.id, req.params.id);
  if (menggantung) {
    return res.status(409).json({ error: `${sebutan(sasaran)} sudah diundang dan belum menjawab.` });
  }

  db.prepare(
    `INSERT INTO notifikasi (id, penerima_id, aktor_id, jenis, grup_id, status, created_at)
     VALUES (?, ?, ?, 'undangan_grup', ?, 'menunggu', ?)`
  ).run(newId(), sasaran.id, req.user.id, req.params.id, new Date().toISOString());

  res.status(201).json({ ok: true, nama: sebutan(sasaran) });
});

grupRouter.delete('/:id/undangan/:notifId', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada || ada.peran !== 'leader') return res.status(403).json({ error: 'Hanya pemimpin grup yang bisa membatalkan undangan.' });
  db.prepare("DELETE FROM notifikasi WHERE id = ? AND grup_id = ? AND jenis = 'undangan_grup' AND status = 'menunggu'").run(
    req.params.notifId,
    req.params.id
  );
  res.json({ ok: true });
});

/* ---------- Keanggotaan ---------- */

grupRouter.post('/:id/keluar', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
  // Grup tanpa pemimpin tidak punya siapa pun yang bisa mengelolanya, jadi
  // pemimpin harus mengalihkan jabatannya dulu atau membubarkan grup.
  if (ada.peran === 'leader') {
    return res.status(400).json({
      error: 'Kamu pemimpin grup ini. Alihkan dulu jabatannya ke anggota lain, atau bubarkan grupnya.',
    });
  }
  db.prepare('DELETE FROM grup_anggota WHERE grup_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

grupRouter.delete('/:id/anggota/:userId', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
  if (ada.peran !== 'leader') return res.status(403).json({ error: 'Hanya pemimpin grup yang bisa mengeluarkan anggota.' });
  if (req.params.userId === req.user.id) {
    return res.status(400).json({ error: 'Pemimpin tidak bisa mengeluarkan dirinya sendiri.' });
  }
  const info = db
    .prepare('DELETE FROM grup_anggota WHERE grup_id = ? AND user_id = ?')
    .run(req.params.id, req.params.userId);
  if (!info.changes) return res.status(404).json({ error: 'Orang itu bukan anggota grup ini.' });
  res.json({ ok: true });
});

/** Mengalihkan jabatan pemimpin ke anggota lain. */
grupRouter.post('/:id/pemimpin/:userId', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
  if (ada.peran !== 'leader') return res.status(403).json({ error: 'Hanya pemimpin grup yang bisa mengalihkan jabatan.' });
  if (!peranDi(req.params.id, req.params.userId)) {
    return res.status(404).json({ error: 'Orang itu bukan anggota grup ini.' });
  }

  db.transaction(() => {
    db.prepare("UPDATE grup_anggota SET peran = 'anggota' WHERE grup_id = ? AND user_id = ?").run(
      req.params.id,
      req.user.id
    );
    db.prepare("UPDATE grup_anggota SET peran = 'leader' WHERE grup_id = ? AND user_id = ?").run(
      req.params.id,
      req.params.userId
    );
    db.prepare('UPDATE grup SET leader_id = ? WHERE id = ?').run(req.params.userId, req.params.id);
  })();

  res.json({ ok: true });
});