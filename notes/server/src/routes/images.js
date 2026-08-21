import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import { db } from '../db.js';
import { newId, requireAuth } from '../security.js';
import { aksesCatatan } from '../access.js';
import { deteksiGambar } from '../imagetype.js';

export const imagesRouter = Router();

/** 2 MB. Cukup untuk foto dari kamera ponsel setelah dikompres peramban. */
export const BATAS_BYTE = 2 * 1024 * 1024;

export const folderGambar = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
fs.mkdirSync(folderGambar, { recursive: true });

/** Menghapus berkas gambar yang catatannya sudah lenyap. Dipanggil dari purge. */
export function hapusBerkasYatim(daftarBerkas) {
  for (const nama of daftarBerkas || []) {
    // basename menutup jalan bila isi kolomnya pernah tercemar jalur relatif.
    fs.rm(path.join(folderGambar, path.basename(nama)), { force: true }, () => {});
  }
}

imagesRouter.use(requireAuth);

/**
 * Unggah. Badan permintaan adalah berkasnya apa adanya, bukan multipart — dengan
 * begitu tidak perlu penguraian multipart tambahan, dan batas ukurannya dijaga
 * Express sebelum satu byte pun menyentuh cakram.
 */
imagesRouter.post(
  '/',
  express.raw({ type: () => true, limit: BATAS_BYTE }),
  (req, res) => {
    const noteId = String(req.query.noteId || '');
    // Gambar menumpang izin catatannya, jadi hanya yang boleh menulis di catatan
    // itu yang boleh menaruh gambar di sana.
    const akses = aksesCatatan(req.user.id, noteId);
    if (akses !== 'pemilik' && akses !== 'tulis') {
      return res.status(404).json({ error: 'Catatan tidak ditemukan.' });
    }

    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      return res.status(400).json({ error: 'Tidak ada berkas yang terkirim.' });
    }

    const jenis = deteksiGambar(buf);
    if (!jenis) {
      return res.status(415).json({ error: 'Hanya PNG, JPEG, GIF, dan WebP yang bisa diunggah.' });
    }

    const id = newId();
    const berkas = `${id}.${jenis.ext}`;
    try {
      fs.writeFileSync(path.join(folderGambar, berkas), buf);
    } catch {
      return res.status(500).json({ error: 'Gambar gagal disimpan di server.' });
    }

    db.prepare(
      `INSERT INTO gambar (id, user_id, note_id, berkas, mime, ukuran, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.user.id, noteId, berkas, jenis.mime, buf.length, new Date().toISOString());

    res.status(201).json({ gambar: { id, url: `/api/images/${id}`, mime: jenis.mime, ukuran: buf.length } });
  }
);

imagesRouter.get('/:id', (req, res) => {
  const g = db.prepare('SELECT * FROM gambar WHERE id = ?').get(req.params.id);
  if (!g) return res.status(404).json({ error: 'Gambar tidak ditemukan.' });

  // Izinnya dihitung ulang tiap permintaan, bukan disimpan saat unggah: catatan
  // bisa keluar-masuk grup, dan gambarnya harus ikut.
  if (!aksesCatatan(req.user.id, g.note_id)) {
    return res.status(404).json({ error: 'Gambar tidak ditemukan.' });
  }

  const jalur = path.join(folderGambar, path.basename(g.berkas));
  if (!fs.existsSync(jalur)) return res.status(404).json({ error: 'Berkas gambar sudah tidak ada.' });

  res.type(g.mime);
  // Isi berkas tidak pernah berubah untuk id yang sama, tapi izinnya bisa —
  // jadi private, agar tidak tersimpan di cache bersama milik proksi.
  res.setHeader('Cache-Control', 'private, max-age=604800, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(jalur);
});

imagesRouter.delete('/:id', (req, res) => {
  const g = db.prepare('SELECT * FROM gambar WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!g) return res.status(404).json({ error: 'Gambar tidak ditemukan.' });

  db.prepare('DELETE FROM gambar WHERE id = ?').run(g.id);
  fs.rm(path.join(folderGambar, path.basename(g.berkas)), { force: true }, () => {});
  res.json({ ok: true });
});

/**
 * express.raw melempar galat sendiri saat badan permintaan melampaui batas, dan
 * tanpa penangan ini ia jatuh ke penangan galat umum yang menjawab 500 — pesan
 * yang tidak memberi tahu apa pun kepada orang yang berkasnya kebesaran.
 */
imagesRouter.use((err, _req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      error: `Gambar terlalu besar. Maksimal ${Math.round(BATAS_BYTE / (1024 * 1024))} MB.`,
    });
  }
  next(err);
});