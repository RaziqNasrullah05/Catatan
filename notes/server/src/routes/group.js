import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { newId, requireAuth } from '../security.js';

export const groupRouter = Router();
groupRouter.use(requireAuth);

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

groupRouter.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT g.id, g.nama, g.created_at, a.peran,
              (SELECT COUNT(*) FROM grup_anggota x WHERE x.grup_id = g.id) AS jumlah_anggota
              ,(SELECT COUNT(*) FROM grup_catatan c JOIN notes n ON n.id = c.note_id
                 WHERE c.grup_id = g.id AND n.deleted_at IS NULL) AS jumlah_catatan
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
      jumlahCatatan: r.jumlah_catatan,
      createdAt: r.created_at,
    })),
  });
});

groupRouter.post('/', (req, res) => {
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

groupRouter.get('/:id', (req, res) => {
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

groupRouter.patch('/:id', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
  if (ada.peran !== 'leader') return res.status(403).json({ error: 'Hanya pemimpin grup yang bisa mengubah ini.' });

  const parsed = namaSchema.safeParse(req.body?.nama);
  if (!parsed.success) return res.status(400).json({ error: 'Nama grup 2–60 karakter.' });
  db.prepare('UPDATE grup SET nama = ? WHERE id = ?').run(parsed.data, req.params.id);
  res.json({ ok: true, nama: parsed.data });
});

groupRouter.delete('/:id', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
  if (ada.peran !== 'leader') return res.status(403).json({ error: 'Hanya pemimpin grup yang bisa membubarkan grup.' });
  // Anggota, undangan, dan kaitan catatan ikut terhapus lewat ON DELETE CASCADE.
  db.prepare('DELETE FROM grup WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ---------- Undangan ---------- */

groupRouter.post('/:id/invite', (req, res) => {
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

/**
 * Saran orang yang bisa diundang, dicari per kata kunci.
 *
 * Sengaja sempit, karena endpoint ini pada dasarnya membacakan daftar orang
 * yang terdaftar di aplikasi — persis hal yang ditutup di v1.17 pada jalur
 * masuk. Yang membatasinya:
 *
 *   - hanya pemimpin grup yang boleh memanggilnya;
 *   - hanya `username` yang dicari, dan hanya dari awal kata. Email tidak
 *     dicari dan tidak pernah ikut dikembalikan, jadi tidak ada cara memungut
 *     alamat orang lain dari sini. Mengundang lewat email tetap bisa lewat
 *     `POST /:id/invite`, yang menuntut alamat lengkap dan tepat;
 *   - minimal dua huruf, supaya satu huruf tidak menarik separuh basis data;
 *   - paling banyak delapan hasil.
 *
 * Yang sudah jadi anggota dan yang undangannya belum dijawab tidak ikut
 * ditampilkan — mengundang mereka toh akan ditolak `POST /:id/invite`, dan
 * menawarkan nama yang pasti gagal hanya membuang waktu penggunanya.
 */
groupRouter.get('/:id/candidates', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
  if (ada.peran !== 'leader') {
    return res.status(403).json({ error: 'Hanya pemimpin grup yang bisa mengundang.' });
  }

  const q = String(req.query.q || '').trim().toLowerCase().replace(/^@/, '');
  if (q.length < 2) return res.json({ orang: [] });

  // Karakter jokernya di-escape supaya "%" yang diketik dicari apa adanya,
  // bukan mencocokkan segalanya. Pola LIKE ... ESCAPE mengikuti pencarian
  // catatan yang sudah ada.
  const pola = `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const rows = db
    .prepare(
      `SELECT u.id, u.username FROM users u
        WHERE u.disabled = 0
          AND u.username IS NOT NULL
          AND u.username LIKE ? ESCAPE '\\'
          AND u.id <> ?
          AND u.id NOT IN (SELECT user_id FROM grup_anggota WHERE grup_id = ?)
          AND u.id NOT IN (
                SELECT penerima_id FROM notifikasi
                 WHERE grup_id = ? AND jenis = 'undangan_grup' AND status = 'menunggu')
        ORDER BY u.username
        LIMIT 8`
    )
    .all(pola, req.user.id, req.params.id, req.params.id);

  res.json({ orang: rows.map((u) => ({ id: u.id, nama: `@${u.username}` })) });
});

groupRouter.delete('/:id/invites/:notifId', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada || ada.peran !== 'leader') return res.status(403).json({ error: 'Hanya pemimpin grup yang bisa membatalkan undangan.' });
  db.prepare("DELETE FROM notifikasi WHERE id = ? AND grup_id = ? AND jenis = 'undangan_grup' AND status = 'menunggu'").run(
    req.params.notifId,
    req.params.id
  );
  res.json({ ok: true });
});

/* ---------- Keanggotaan ---------- */

groupRouter.post('/:id/leave', (req, res) => {
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

groupRouter.delete('/:id/members/:userId', (req, res) => {
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

/* ---------- Catatan di dalam grup ---------- */

groupRouter.get('/:id/notes', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Grup tidak ditemukan.' });

  const rows = db
    .prepare(
      `SELECT n.id, n.title, n.content, n.updated_at, n.user_id,
              u.email, u.username, gc.added_at
         FROM grup_catatan gc
         JOIN notes n ON n.id = gc.note_id AND n.deleted_at IS NULL
         JOIN users u ON u.id = n.user_id
        WHERE gc.grup_id = ?
        ORDER BY n.updated_at DESC
        LIMIT 200`
    )
    .all(req.params.id);

  const kolab = db
    .prepare(
      `SELECT k.note_id, u.email, u.username FROM catatan_kolaborator k
         JOIN users u ON u.id = k.user_id
        WHERE k.note_id IN (SELECT note_id FROM grup_catatan WHERE grup_id = ?)`
    )
    .all(req.params.id);
  const perCatatan = new Map();
  for (const k of kolab) {
    if (!perCatatan.has(k.note_id)) perCatatan.set(k.note_id, []);
    perCatatan.get(k.note_id).push(sebutan(k));
  }

  res.json({
    catatan: rows.map((n) => ({
      id: n.id,
      title: n.title,
      kolaborator: perCatatan.get(n.id) || [],
      excerpt: n.content
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/[*_`>~]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160),
      updatedAt: n.updated_at,
      penulis: sebutan(n),
      milikku: n.user_id === req.user.id,
    })),
  });
});

/** Mengeluarkan catatan dari grup. Boleh oleh pemiliknya atau pemimpin grup. */
groupRouter.delete('/:id/notes/:noteId', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Grup tidak ditemukan.' });

  const n = db.prepare('SELECT user_id FROM notes WHERE id = ?').get(req.params.noteId);
  if (!n) return res.status(404).json({ error: 'Catatan tidak ditemukan.' });
  if (n.user_id !== req.user.id && ada.peran !== 'leader') {
    return res.status(403).json({ error: 'Hanya penulisnya atau pemimpin grup yang bisa mengeluarkan catatan ini.' });
  }

  db.prepare('DELETE FROM grup_catatan WHERE grup_id = ? AND note_id = ?').run(
    req.params.id,
    req.params.noteId
  );
  res.json({ ok: true });
});

/* ---------- Kolaborasi ---------- */

/**
 * Pemimpin grup mengusulkan seseorang jadi kolaborator sebuah catatan. Usulannya
 * dikirim ke penulis catatan, dan izinnya baru berlaku setelah ia menyetujui —
 * pemimpin menggerakkan, penulis yang memutuskan atas tulisannya sendiri.
 */
groupRouter.post('/:id/notes/:noteId/collaborators', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Grup tidak ditemukan.' });
  if (ada.peran !== 'leader') {
    return res.status(403).json({ error: 'Hanya pemimpin grup yang bisa mengatur kolaborasi.' });
  }

  const diGrup = db
    .prepare('SELECT 1 FROM grup_catatan WHERE grup_id = ? AND note_id = ?')
    .get(req.params.id, req.params.noteId);
  if (!diGrup) return res.status(404).json({ error: 'Catatan itu tidak ada di grup ini.' });

  const note = db
    .prepare('SELECT id, user_id, title FROM notes WHERE id = ? AND deleted_at IS NULL')
    .get(req.params.noteId);
  if (!note) return res.status(404).json({ error: 'Catatan tidak ditemukan.' });

  const targetId = String(req.body?.userId || '');
  if (!peranDi(req.params.id, targetId)) {
    return res.status(400).json({ error: 'Orang itu bukan anggota grup ini.' });
  }
  if (targetId === note.user_id) {
    return res.status(400).json({ error: 'Dia penulisnya sendiri, sudah bisa menyunting.' });
  }

  const sudah = db
    .prepare('SELECT 1 FROM catatan_kolaborator WHERE note_id = ? AND user_id = ?')
    .get(note.id, targetId);
  if (sudah) return res.status(409).json({ error: 'Dia sudah jadi kolaborator catatan ini.' });

  const now = new Date().toISOString();

  // Kalau pemimpin adalah penulisnya sendiri, tidak ada yang perlu disetujui.
  if (note.user_id === req.user.id) {
    db.transaction(() => {
      db.prepare(
        `INSERT INTO catatan_kolaborator (note_id, user_id, granted_by, granted_at)
         VALUES (?, ?, ?, ?)`
      ).run(note.id, targetId, req.user.id, now);
      db.prepare(
        `INSERT INTO notifikasi (id, penerima_id, aktor_id, jenis, grup_id, note_id, status, created_at)
         VALUES (?, ?, ?, 'kolaborasi_aktif', ?, ?, 'info', ?)`
      ).run(newId(), targetId, req.user.id, req.params.id, note.id, now);
    })();
    return res.status(201).json({ ok: true, langsung: true });
  }

  const menggantung = db
    .prepare(
      `SELECT id FROM notifikasi
        WHERE note_id = ? AND target_id = ? AND jenis = 'usul_kolaborasi' AND status = 'menunggu'`
    )
    .get(note.id, targetId);
  if (menggantung) {
    return res.status(409).json({ error: 'Usulan untuk orang itu sudah dikirim dan belum dijawab.' });
  }

  db.prepare(
    `INSERT INTO notifikasi (id, penerima_id, aktor_id, target_id, jenis, grup_id, note_id, status, created_at)
     VALUES (?, ?, ?, ?, 'usul_kolaborasi', ?, ?, 'menunggu', ?)`
  ).run(newId(), note.user_id, req.user.id, targetId, req.params.id, note.id, now);

  res.status(201).json({ ok: true, langsung: false });
});

/** Mencabut izin kolaborasi. Boleh oleh penulis catatan atau pemimpin grup. */
groupRouter.delete('/:id/notes/:noteId/collaborators/:userId', (req, res) => {
  const ada = ambilGrup(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Grup tidak ditemukan.' });

  const note = db.prepare('SELECT user_id FROM notes WHERE id = ?').get(req.params.noteId);
  if (!note) return res.status(404).json({ error: 'Catatan tidak ditemukan.' });
  if (note.user_id !== req.user.id && ada.peran !== 'leader') {
    return res.status(403).json({ error: 'Hanya penulisnya atau pemimpin grup yang bisa mencabut izin.' });
  }

  db.prepare('DELETE FROM catatan_kolaborator WHERE note_id = ? AND user_id = ?').run(
    req.params.noteId,
    req.params.userId
  );
  res.json({ ok: true });
});

/** Mengalihkan jabatan pemimpin ke anggota lain. */
groupRouter.post('/:id/leader/:userId', (req, res) => {
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