import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { newId, requireAuth } from '../security.js';
import { aksesCatatan, grupCatatan, sebutan } from '../access.js';

export const notesRouter = Router();
notesRouter.use(requireAuth);

const MAX_CONTENT = 200_000;

const noteSchema = z.object({
  title: z.string().max(300).optional(),
  content: z.string().max(MAX_CONTENT).optional(),
  pinned: z.boolean().optional(),
  version: z.number().int().optional(),
});

const excerpt = (content) =>
  content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>~]/g, '')
    .replace(/^\s*[-+*]\s+\[[ xX]\]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

notesRouter.get('/', (req, res) => {
  const q = String(req.query.q || '').trim();
  const rows = q
    ? db
        .prepare(
          `SELECT * FROM notes
            WHERE user_id = ? AND deleted_at IS NULL
              AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')
            ORDER BY pinned DESC, updated_at DESC LIMIT 200`
        )
        .all(req.user.id, ...Array(2).fill(`%${q.replace(/[%_\\]/g, '\\$&')}%`))
    : db
        .prepare(
          `SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NULL
            ORDER BY pinned DESC, updated_at DESC LIMIT 200`
        )
        .all(req.user.id);

  // Satu kueri untuk semua kaitan grup sekaligus, bukan satu per catatan.
  const kaitan = db
    .prepare(
      `SELECT gc.note_id, g.nama FROM grup_catatan gc
         JOIN grup g ON g.id = gc.grup_id
        WHERE gc.note_id IN (SELECT id FROM notes WHERE user_id = ? AND deleted_at IS NULL)`
    )
    .all(req.user.id);
  const perCatatan = new Map();
  for (const k of kaitan) {
    if (!perCatatan.has(k.note_id)) perCatatan.set(k.note_id, []);
    perCatatan.get(k.note_id).push(k.nama);
  }

  res.json({
    notes: rows.map((n) => ({
      id: n.id,
      title: n.title,
      excerpt: excerpt(n.content),
      pinned: Boolean(n.pinned),
      updatedAt: n.updated_at,
      openTasks: (n.content.match(/^\s*[-+*]\s+\[ \]/gm) || []).length,
      grup: perCatatan.get(n.id) || [],
    })),
  });
});

notesRouter.post('/', (req, res) => {
  const parsed = noteSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Isi catatan tidak valid.' });
  const now = new Date().toISOString();
  const id = newId();
  db.prepare(
    `INSERT INTO notes (id, user_id, title, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.id, parsed.data.title ?? '', parsed.data.content ?? '', now, now);
  res.status(201).json({ note: getNote(req.user.id, id) });
});

function getNote(userId, id) {
  const n = db
    .prepare('SELECT * FROM notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .get(id, userId);
  if (!n) return null;
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    pinned: Boolean(n.pinned),
    createdAt: n.created_at,
    updatedAt: n.updated_at,
    version: n.version,
  };
}

/**
 * Daftar ringkas id dan judul untuk pemilih "sebut catatan". Termasuk catatan
 * milik sendiri dan catatan grup yang boleh dibaca, supaya sebutan bisa menunjuk
 * tulisan orang lain di grup yang sama.
 *
 * Harus didaftarkan sebelum '/:id', kalau tidak "index" akan ditangkap sebagai id.
 */
notesRouter.get('/index', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, updated_at, 1 AS milikku FROM notes
        WHERE user_id = ? AND deleted_at IS NULL
        UNION
       SELECT n.id, n.title, n.updated_at, 0 AS milikku FROM grup_catatan gc
         JOIN notes n ON n.id = gc.note_id AND n.deleted_at IS NULL
         JOIN grup_anggota ga ON ga.grup_id = gc.grup_id AND ga.user_id = ?
        WHERE n.user_id <> ?
        ORDER BY updated_at DESC
        LIMIT 500`
    )
    .all(req.user.id, req.user.id, req.user.id);

  res.json({
    catatan: rows.map((r) => ({
      id: r.id,
      judul: r.title || 'Tanpa judul',
      milikku: Boolean(r.milikku),
    })),
  });
});

/**
 * Membersihkan satu tag: huruf dikecilkan, spasi jadi tanda hubung, dan hanya
 * huruf-angka-hubung yang bertahan.
 *
 * Dinormalkan di server, bukan di peramban, karena aturan inilah yang menentukan
 * apakah dua tag dianggap sama. Kalau normalisasinya cuma di klien, permintaan
 * dari mana pun selain layar penyunting akan menyelundupkan bentuk lain, dan
 * "Gagal Jantung" jadi tag yang berbeda dari "gagal-jantung".
 */
function rapikanTag(mentah) {
  return String(mentah || '')
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

const MAX_TAG = 12;

/** Tag milik seseorang pada sebuah catatan, urut abjad. */
function tagCatatan(userId, noteId) {
  return db
    .prepare('SELECT nama FROM catatan_tag WHERE note_id = ? AND user_id = ? ORDER BY nama')
    .all(noteId, userId)
    .map((r) => r.nama);
}

notesRouter.get('/:id', (req, res) => {
  const akses = aksesCatatan(req.user.id, req.params.id);
  if (!akses) return res.status(404).json({ error: 'Catatan tidak ditemukan.' });

  if (akses === 'pemilik') {
    return res.json({
      note: {
        ...getNote(req.user.id, req.params.id),
        bisaSunting: true,
        milikSendiri: true,
        tag: tagCatatan(req.user.id, req.params.id),
        grup: grupCatatan(req.user.id, req.params.id).map((g) => g.nama),
      },
    });
  }

  // Milik orang lain, dibaca lewat grup bersama. Penulisnya disebut supaya
  // jelas ini bukan tulisan sendiri, dan tidak ada jalan menyuntingnya.
  const n = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  const penulis = db.prepare('SELECT email, username FROM users WHERE id = ?').get(n.user_id);
  res.json({
    note: {
      id: n.id,
      title: n.title,
      content: n.content,
      pinned: false,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
      version: n.version,
      bisaSunting: akses === 'tulis',
      milikSendiri: false,
      penulis: sebutan(penulis),
      // Tag milik pembaca sendiri, bukan milik penulisnya: tag tidak ikut
      // dibagikan lewat grup. Pembaca boleh menandai catatan orang lain untuk
      // keperluannya sendiri tanpa terlihat siapa pun.
      tag: tagCatatan(req.user.id, n.id),
      grup: grupCatatan(req.user.id, n.id).map((g) => g.nama),
    },
  });
});

/** Grup mana saja yang memuat catatan ini — dipakai pemilih di menu catatan. */
notesRouter.get('/:id/groups', (req, res) => {
  if (aksesCatatan(req.user.id, req.params.id) !== 'pemilik') {
    return res.status(404).json({ error: 'Catatan tidak ditemukan.' });
  }
  const milikku = db
    .prepare(
      `SELECT g.id, g.nama FROM grup_anggota a JOIN grup g ON g.id = a.grup_id
        WHERE a.user_id = ? ORDER BY g.nama`
    )
    .all(req.user.id);
  const terpakai = new Set(
    db.prepare('SELECT grup_id FROM grup_catatan WHERE note_id = ?').all(req.params.id).map((r) => r.grup_id)
  );
  res.json({ grup: milikku.map((g) => ({ ...g, terpilih: terpakai.has(g.id) })) });
});

/**
 * Menetapkan seluruh daftar grup sekaligus, bukan menambah/menghapus satu per
 * satu — pemilihnya berupa daftar centang, jadi satu simpan lebih jujur
 * menggambarkan apa yang dilihat pengguna.
 */
notesRouter.put('/:id/groups', (req, res) => {
  if (aksesCatatan(req.user.id, req.params.id) !== 'pemilik') {
    return res.status(404).json({ error: 'Catatan tidak ditemukan.' });
  }
  const diminta = Array.isArray(req.body?.grupIds) ? req.body.grupIds.map(String) : null;
  if (!diminta) return res.status(400).json({ error: 'Daftar grup tidak valid.' });

  // Hanya grup yang benar-benar diikuti; sisanya diabaikan diam-diam.
  const sah = new Set(
    db.prepare('SELECT grup_id FROM grup_anggota WHERE user_id = ?').all(req.user.id).map((r) => r.grup_id)
  );
  const dipakai = diminta.filter((id) => sah.has(id));
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare('DELETE FROM grup_catatan WHERE note_id = ?').run(req.params.id);
    const sisip = db.prepare(
      'INSERT INTO grup_catatan (grup_id, note_id, added_by, added_at) VALUES (?, ?, ?, ?)'
    );
    for (const gid of dipakai) sisip.run(gid, req.params.id, req.user.id, now);
  })();

  res.json({ grup: grupCatatan(req.user.id, req.params.id) });
});

/**
 * Menetapkan seluruh daftar tag sekaligus, mengikuti pola `PUT /:id/groups`.
 *
 * Tag boleh dipasang pada catatan apa pun yang bisa dibaca, termasuk milik
 * orang lain — yang dicatat adalah bagaimana *pembaca* menandai sesuatu, bukan
 * bagaimana penulisnya menamainya. Karena itu syaratnya cuma `aksesCatatan`
 * mengembalikan sesuatu, bukan harus 'pemilik'.
 */
notesRouter.put('/:id/tags', (req, res) => {
  if (!aksesCatatan(req.user.id, req.params.id)) {
    return res.status(404).json({ error: 'Catatan tidak ditemukan.' });
  }
  if (!Array.isArray(req.body?.tag)) return res.status(400).json({ error: 'Daftar tag tidak valid.' });

  // Set membuang kembaran yang muncul setelah dirapikan: "Gagal Jantung" dan
  // "gagal-jantung" jadi satu tag yang sama.
  const bersih = [...new Set(req.body.tag.map(rapikanTag).filter(Boolean))].slice(0, MAX_TAG);
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare('DELETE FROM catatan_tag WHERE note_id = ? AND user_id = ?').run(
      req.params.id,
      req.user.id
    );
    const sisip = db.prepare(
      'INSERT INTO catatan_tag (note_id, user_id, nama, created_at) VALUES (?, ?, ?, ?)'
    );
    for (const nama of bersih) sisip.run(req.params.id, req.user.id, nama, now);
  })();

  res.json({ tag: tagCatatan(req.user.id, req.params.id) });
});

/**
 * Semua tag yang pernah dipakai orang ini, beserta jumlah catatannya. Dipakai
 * saran saat mengetik, supaya tag yang sudah ada dipakai ulang alih-alih
 * ditulis ulang sedikit berbeda.
 */
notesRouter.get('/tags/all', (req, res) => {
  res.json({
    tag: db
      .prepare(
        `SELECT nama, COUNT(*) AS jumlah FROM catatan_tag
          WHERE user_id = ? GROUP BY nama ORDER BY jumlah DESC, nama`
      )
      .all(req.user.id),
  });
});

notesRouter.patch('/:id', (req, res) => {
  const parsed = noteSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Isi catatan tidak valid.' });

  const akses = aksesCatatan(req.user.id, req.params.id);
  if (akses !== 'pemilik' && akses !== 'tulis') {
    return res.status(404).json({ error: 'Catatan tidak ditemukan.' });
  }

  const current = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);

  /**
   * Penjaga versi. Simpan otomatis mengirim seluruh isi catatan, jadi tanpa ini
   * orang yang menyimpan belakangan menimpa pekerjaan yang lain tanpa jejak.
   * Klien mengirim versi yang sedang dipegangnya; kalau di server sudah bergerak,
   * simpanannya ditolak dan isi terbaru dikembalikan agar bisa ditampilkan.
   */
  if (req.body?.version !== undefined && Number(req.body.version) !== current.version) {
    const penulis = db.prepare('SELECT email, username FROM users WHERE id = ?').get(current.user_id);
    return res.status(409).json({
      error: 'Catatan ini baru diubah orang lain. Muat ulang dulu supaya tulisanmu tidak menimpanya.',
      note: {
        id: current.id,
        title: current.title,
        content: current.content,
        version: current.version,
        updatedAt: current.updated_at,
        penulis: sebutan(penulis),
      },
    });
  }

  // Sematan milik pemilik; kolaborator tidak ikut mengubahnya.
  const pinned = akses === 'pemilik' && parsed.data.pinned !== undefined
    ? parsed.data.pinned
    : Boolean(current.pinned);

  const title = parsed.data.title ?? current.title;
  const content = parsed.data.content ?? current.content;
  const berubah = title !== current.title || content !== current.content;

  db.prepare(
    `UPDATE notes SET title = ?, content = ?, pinned = ?, updated_at = ?,
            version = version + ?
      WHERE id = ?`
  ).run(title, content, pinned ? 1 : 0, new Date().toISOString(), berubah ? 1 : 0, req.params.id);

  const n = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  res.json({
    note: {
      id: n.id,
      title: n.title,
      content: n.content,
      pinned: Boolean(n.pinned),
      createdAt: n.created_at,
      updatedAt: n.updated_at,
      version: n.version,
      bisaSunting: true,
      milikSendiri: akses === 'pemilik',
    },
  });
});

notesRouter.delete('/:id', (req, res) => {
  const info = db
    .prepare('UPDATE notes SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .run(new Date().toISOString(), req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Catatan tidak ditemukan.' });
  res.json({ ok: true });
});

/** Semua checkbox dari seluruh catatan, dikumpulkan jadi satu daftar tugas. */
notesRouter.get('/tasks/all', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, content, updated_at FROM notes
        WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`
    )
    .all(req.user.id);

  const tasks = [];
  for (const note of rows) {
    const lines = note.content.split('\n');
    lines.forEach((line, i) => {
      const m = line.match(/^\s*[-+*]\s+\[([ xX])\]\s+(.*)$/);
      if (!m) return;
      tasks.push({
        noteId: note.id,
        noteTitle: note.title || 'Tanpa judul',
        line: i,
        done: m[1].toLowerCase() === 'x',
        text: m[2].trim(),
        updatedAt: note.updated_at,
      });
    });
  }
  res.json({ tasks });
});

/**
 * Menambah tugas tanpa membuka catatan. Semua tugas cepat dikumpulkan di satu
 * catatan bernama "Tugas", yang dibuat otomatis saat pertama kali dibutuhkan.
 */
notesRouter.post('/tasks', (req, res) => {
  const parsed = z.string().trim().min(1).max(500).safeParse(req.body?.text);
  if (!parsed.success) return res.status(400).json({ error: 'Teks tugas tidak boleh kosong.' });

  const now = new Date().toISOString();
  let inbox = db
    .prepare(
      `SELECT id, content FROM notes
        WHERE user_id = ? AND title = 'Tugas' AND deleted_at IS NULL
        ORDER BY created_at LIMIT 1`
    )
    .get(req.user.id);

  if (!inbox) {
    const id = newId();
    db.prepare(
      `INSERT INTO notes (id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, 'Tugas', '', ?, ?)`
    ).run(id, req.user.id, now, now);
    inbox = { id, content: '' };
  }

  const line = `- [ ] ${parsed.data.replace(/\r?\n/g, ' ')}`;
  const content = inbox.content.trim() ? `${inbox.content.replace(/\s+$/, '')}\n${line}` : line;
  db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(
    content,
    now,
    inbox.id,
    req.user.id
  );
  res.status(201).json({ ok: true, noteId: inbox.id });
});

/** Menandai satu baris checkbox selesai / belum, langsung dari layar Tugas. */
notesRouter.post('/:id/tasks/:line/toggle', (req, res) => {
  const note = getNote(req.user.id, req.params.id);
  if (!note) return res.status(404).json({ error: 'Catatan tidak ditemukan.' });
  const lineNo = Number(req.params.line);
  const lines = note.content.split('\n');
  const line = lines[lineNo];
  if (!Number.isInteger(lineNo) || line === undefined) {
    return res.status(400).json({ error: 'Baris tugas tidak ditemukan.' });
  }
  const m = line.match(/^(\s*[-+*]\s+\[)([ xX])(\].*)$/);
  if (!m) return res.status(400).json({ error: 'Baris ini bukan tugas.' });

  lines[lineNo] = `${m[1]}${m[2] === ' ' ? 'x' : ' '}${m[3]}`;
  // Versinya ikut naik: ini mengubah isi catatan, sama seperti menyunting biasa,
  // jadi penyunting yang sedang membuka catatan ini harus tahu.
  db.prepare(
    `UPDATE notes SET content = ?, updated_at = ?, version = version + 1
      WHERE id = ? AND user_id = ?`
  ).run(lines.join('\n'), new Date().toISOString(), note.id, req.user.id);
  res.json({ ok: true });
});