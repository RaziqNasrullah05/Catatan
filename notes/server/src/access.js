import { db } from './db.js';

/**
 * Menjawab satu pertanyaan: boleh apa orang ini atas catatan ini.
 *
 *   'pemilik' → baca, tulis, hapus, atur grupnya
 *   'baca'    → hanya membaca, karena catatannya ada di grup yang sama-sama diikuti
 *   null      → tidak ada akses
 *
 * Semua rute yang menyentuh catatan orang lain harus lewat sini, supaya aturannya
 * hanya ada di satu tempat dan tidak berbeda-beda antar endpoint.
 */
export function aksesCatatan(userId, noteId) {
  const n = db
    .prepare('SELECT user_id FROM notes WHERE id = ? AND deleted_at IS NULL')
    .get(noteId);
  if (!n) return null;
  if (n.user_id === userId) return 'pemilik';

  const bersama = db
    .prepare(
      `SELECT 1 FROM grup_catatan gc
         JOIN grup_anggota ga ON ga.grup_id = gc.grup_id
        WHERE gc.note_id = ? AND ga.user_id = ?
        LIMIT 1`
    )
    .get(noteId, userId);

  return bersama ? 'baca' : null;
}

/** Grup mana saja yang memuat catatan ini dan juga diikuti orang ini. */
export function grupCatatan(userId, noteId) {
  return db
    .prepare(
      `SELECT g.id, g.nama FROM grup_catatan gc
         JOIN grup g ON g.id = gc.grup_id
         JOIN grup_anggota ga ON ga.grup_id = g.id AND ga.user_id = ?
        WHERE gc.note_id = ?
        ORDER BY g.nama`
    )
    .all(userId, noteId);
}

/** Nama yang ditampilkan ke orang lain: username kalau ada, kalau tidak email. */
export const sebutan = (u) => (u?.username ? `@${u.username}` : u?.email || 'Seseorang');