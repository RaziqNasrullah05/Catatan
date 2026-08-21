import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { newId, requireAuth } from '../security.js';
import { sebarkanAcara, ULANGAN } from '../recurrence.js';

export const eventsRouter = Router();
eventsRouter.use(requireAuth);

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Menolak tanggal yang bentuknya benar tapi tidak ada, mis. 2026-02-31. */
const tanggalSah = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const kosongJadiNull = (v) => (v === '' || v === null || v === undefined ? null : v);

const acaraSchema = z
  .object({
    judul: z.string().trim().min(1, 'Judul acara tidak boleh kosong.').max(120),
    deskripsi: z.string().trim().max(2000).optional().default(''),
    tanggal: z.string().regex(TANGGAL, 'Tanggal harus berbentuk TTTT-BB-HH.').refine(tanggalSah, 'Tanggal itu tidak ada.'),
    mulai: z.preprocess(kosongJadiNull, z.string().regex(JAM, 'Jam mulai harus berbentuk JJ:MM.').nullable().optional()),
    selesai: z.preprocess(kosongJadiNull, z.string().regex(JAM, 'Jam selesai harus berbentuk JJ:MM.').nullable().optional()),
    ulang: z.preprocess(kosongJadiNull, z.enum(ULANGAN, { errorMap: () => ({ message: 'Jenis pengulangan tidak dikenal.' }) }).nullable().optional()),
    ulangSampai: z.preprocess(
      kosongJadiNull,
      z.string().regex(TANGGAL, 'Tanggal berhenti harus berbentuk TTTT-BB-HH.').refine(tanggalSah, 'Tanggal berhenti itu tidak ada.').nullable().optional()
    ),
  })
  .refine((v) => !(v.selesai && !v.mulai), {
    message: 'Isi jam mulai dulu sebelum jam selesai.',
  })
  .refine((v) => !(v.mulai && v.selesai) || v.selesai > v.mulai, {
    message: 'Jam selesai harus setelah jam mulai.',
  })
  .refine((v) => !v.ulangSampai || v.ulang, {
    message: 'Tanggal berhenti hanya berlaku untuk acara berulang.',
  })
  .refine((v) => !v.ulangSampai || v.ulangSampai >= v.tanggal, {
    message: 'Tanggal berhenti tidak boleh sebelum tanggal acara.',
  });

const bentuk = (row, tanggal) => ({
  // Kejadian berulang berbagi satu baris, jadi kuncinya digabung dengan tanggal
  // agar tiap kemunculan punya identitas sendiri di daftar React.
  key: row.ulang ? `${row.id}@${tanggal}` : row.id,
  id: row.id,
  judul: row.judul,
  deskripsi: row.deskripsi,
  tanggal,
  tanggalAsal: row.tanggal,
  mulai: row.mulai,
  selesai: row.selesai,
  ulang: row.ulang,
  ulangSampai: row.ulang_sampai,
});

/** Mengurutkan: acara sepanjang hari lebih dulu, sisanya menurut jam mulai. */
const urut = (a, b) =>
  a.tanggal.localeCompare(b.tanggal) ||
  (a.mulai || '').localeCompare(b.mulai || '') ||
  a.judul.localeCompare(b.judul);

eventsRouter.get('/', (req, res) => {
  const dari = String(req.query.dari || '');
  const sampai = String(req.query.sampai || '');
  if (!TANGGAL.test(dari) || !TANGGAL.test(sampai)) {
    return res.status(400).json({ error: 'Rentang tanggal tidak valid.' });
  }

  // Baris yang jelas tidak mungkin muncul disaring lebih dulu di SQL: acara sekali
  // pakai di luar rentang, dan acara berulang yang sudah berhenti sebelum rentang.
  const rows = db
    .prepare(
      `SELECT * FROM acara
        WHERE user_id = ?
          AND tanggal <= ?
          AND (ulang IS NULL AND tanggal >= ? OR ulang IS NOT NULL)
          AND (ulang_sampai IS NULL OR ulang_sampai >= ?)`
    )
    .all(req.user.id, sampai, dari, dari);

  const acara = [];
  for (const row of rows) {
    for (const tgl of sebarkanAcara(row, dari, sampai)) acara.push(bentuk(row, tgl));
  }

  res.json({ acara: acara.sort(urut) });
});

eventsRouter.post('/', (req, res) => {
  const parsed = acaraSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Isian tidak valid.' });
  }
  const v = parsed.data;
  const id = newId();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO acara (id, user_id, judul, deskripsi, tanggal, mulai, selesai, ulang, ulang_sampai, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.id, v.judul, v.deskripsi, v.tanggal, v.mulai ?? null, v.selesai ?? null, v.ulang ?? null, v.ulangSampai ?? null, now, now);

  const row = db.prepare('SELECT * FROM acara WHERE id = ?').get(id);
  res.status(201).json({ acara: bentuk(row, row.tanggal) });
});

eventsRouter.patch('/:id', (req, res) => {
  const ada = db.prepare('SELECT * FROM acara WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!ada) return res.status(404).json({ error: 'Acara tidak ditemukan.' });

  // Seluruh isian dikirim ulang, bukan sebagian, supaya aturan antar-bidang
  // (jam selesai setelah jam mulai) selalu diperiksa pada gambaran yang utuh.
  const parsed = acaraSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Isian tidak valid.' });
  }
  const v = parsed.data;

  db.prepare(
    `UPDATE acara SET judul = ?, deskripsi = ?, tanggal = ?, mulai = ?, selesai = ?,
            ulang = ?, ulang_sampai = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`
  ).run(v.judul, v.deskripsi, v.tanggal, v.mulai ?? null, v.selesai ?? null, v.ulang ?? null, v.ulangSampai ?? null, new Date().toISOString(), req.params.id, req.user.id);

  const row = db.prepare('SELECT * FROM acara WHERE id = ?').get(req.params.id);
  res.json({ acara: bentuk(row, row.tanggal) });
});

eventsRouter.delete('/:id', (req, res) => {
  // Acara berulang terhapus sebagai satu kesatuan; belum ada penghapusan satu
  // kemunculan saja, karena itu menuntut penyimpanan daftar pengecualian.
  const info = db.prepare('DELETE FROM acara WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Acara tidak ditemukan.' });
  res.json({ ok: true });
});