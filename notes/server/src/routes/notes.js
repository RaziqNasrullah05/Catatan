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
  };
}

notesRouter.get('/:id', (req, res) => {
  const akses = aksesCatatan(req.user.id, req.params.id);
  if (!akses) return res.status(404).json({ error: 'Catatan tidak ditemukan.' });

  if (akses === 'pemilik') {
    return res.json({ note: { ...getNote(req.user.id, req.params.id), bisaSunting: true } });
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
      bisaSunting: false,
      penulis: sebutan(penulis),
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

notesRouter.patch('/:id', (req, res) => {
  const parsed = noteSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Isi catatan tidak valid.' });
  const current = getNote(req.user.id, req.params.id);
  if (!current) return res.status(404).json({ error: 'Catatan tidak ditemukan.' });

  const next = { ...current, ...parsed.data };
  db.prepare(
    `UPDATE notes SET title = ?, content = ?, pinned = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`
  ).run(
    next.title,
    next.content,
    next.pinned ? 1 : 0,
    new Date().toISOString(),
    req.params.id,
    req.user.id
  );
  res.json({ note: getNote(req.user.id, req.params.id) });
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
  db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(
    lines.join('\n'),
    new Date().toISOString(),
    note.id,
    req.user.id
  );
  res.json({ ok: true });
});