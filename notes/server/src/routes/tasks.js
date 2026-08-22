import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { newId, requireAuth } from '../security.js';

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

const MAX_ISI = 5000;

/**
 * Tenggat berupa tanggal kalender, bukan instan. Formatnya dijaga di sini
 * supaya yang masuk ke basis data selalu bisa dibandingkan sebagai teks —
 * itulah yang membuat "tenggat < hari ini" bisa dijawab tanpa mengurai apa pun.
 * String kosong berarti "tidak ada tenggat", dan disimpan sebagai NULL.
 */
const tanggal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()
  .or(z.literal(''));

const tugasSchema = z.object({
  judul: z.string().trim().min(1).max(200),
  isi: z.string().max(MAX_ISI).optional(),
  tenggat: tanggal,
});

// Semua kolom opsional saat mengubah: mencentang selesai tidak boleh menuntut
// judul dan isi ikut dikirim ulang.
const ubahSchema = z.object({
  judul: z.string().trim().min(1).max(200).optional(),
  isi: z.string().max(MAX_ISI).optional(),
  tenggat: tanggal,
  selesai: z.boolean().optional(),
});

const bentuk = (t) => ({
  id: t.id,
  judul: t.judul,
  isi: t.isi,
  tenggat: t.tenggat,
  selesai: Boolean(t.selesai),
  createdAt: t.created_at,
  updatedAt: t.updated_at,
});

/**
 * Urutannya: yang belum selesai dulu, lalu yang bertenggat paling dekat, lalu
 * yang terbaru.
 *
 * `tenggat IS NULL` diurutkan lebih dulu sebagai kunci tersendiri supaya tugas
 * tanpa tenggat jatuh ke bawah, bukan ke atas — SQLite menganggap NULL lebih
 * kecil dari nilai apa pun, jadi tanpa baris itu tugas tak bertenggat justru
 * menempati posisi paling mendesak.
 */
tasksRouter.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM tugas WHERE user_id = ?
        ORDER BY selesai ASC, tenggat IS NULL ASC, tenggat ASC, created_at DESC`
    )
    .all(req.user.id);
  res.json({ tugas: rows.map(bentuk) });
});

tasksRouter.post('/', (req, res) => {
  const parsed = tugasSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Isi tugas tidak valid.' });

  const now = new Date().toISOString();
  const id = newId();
  db.prepare(
    `INSERT INTO tugas (id, user_id, judul, isi, tenggat, selesai, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(id, req.user.id, parsed.data.judul, parsed.data.isi || '', parsed.data.tenggat || null, now, now);

  res.status(201).json({ tugas: bentuk(db.prepare('SELECT * FROM tugas WHERE id = ?').get(id)) });
});

tasksRouter.patch('/:id', (req, res) => {
  const parsed = ubahSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Isi tugas tidak valid.' });

  const ada = db.prepare('SELECT * FROM tugas WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Tugas tidak ditemukan.' });

  const d = parsed.data;
  // `??` bukan `||`: isi yang sengaja dikosongkan dan `selesai: false` harus
  // tersimpan, sedangkan `||` akan mengembalikannya ke nilai lama.
  const judul = d.judul ?? ada.judul;
  const isi = d.isi ?? ada.isi;
  const tenggat = d.tenggat === undefined ? ada.tenggat : d.tenggat || null;
  const selesai = d.selesai === undefined ? ada.selesai : Number(d.selesai);

  db.prepare(
    'UPDATE tugas SET judul = ?, isi = ?, tenggat = ?, selesai = ?, updated_at = ? WHERE id = ?'
  ).run(judul, isi, tenggat, selesai, new Date().toISOString(), req.params.id);

  res.json({ tugas: bentuk(db.prepare('SELECT * FROM tugas WHERE id = ?').get(req.params.id)) });
});

tasksRouter.delete('/:id', (req, res) => {
  // Tanpa tempat sampah: tugas berumur pendek, dan menahan yang terhapus selama
  // 30 hari seperti catatan hanya menumpuk baris yang tidak akan dicari siapa pun.
  const hasil = db
    .prepare('DELETE FROM tugas WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (!hasil.changes) return res.status(404).json({ error: 'Tugas tidak ditemukan.' });
  res.json({ ok: true });
});