import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { newId, requireAuth } from '../security.js';

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

  res.json({
    notes: rows.map((n) => ({
      id: n.id,
      title: n.title,
      excerpt: excerpt(n.content),
      pinned: Boolean(n.pinned),
      updatedAt: n.updated_at,
      openTasks: (n.content.match(/^\s*[-+*]\s+\[ \]/gm) || []).length,
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
  const note = getNote(req.user.id, req.params.id);
  if (!note) return res.status(404).json({ error: 'Catatan tidak ditemukan.' });
  res.json({ note });
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
