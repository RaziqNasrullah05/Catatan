import { db } from './db.js';

/**
 * Menjawab satu pertanyaan: boleh apa orang ini atas catatan ini.
 *
 *   'pemilik' → baca, tulis, hapus, atur grupnya
 *   'tulis'   → baca dan menyunting, karena diberi izin kolaborasi. Tidak boleh
 *               menghapus, menyematkan, atau mengatur grup catatan itu.
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

  // Catatan ini masih berada di grup yang juga diikuti orang ini? Pertanyaan
  // yang sama menopang izin baca maupun izin sunting: grup adalah wadah yang
  // membuat berbagi mungkin, jadi begitu wadahnya hilang — orangnya keluar
  // grup, atau catatannya dikeluarkan — kedua izin ikut gugur.
  const bersama = db
    .prepare(
      `SELECT 1 FROM grup_catatan gc
         JOIN grup_anggota ga ON ga.grup_id = gc.grup_id
        WHERE gc.note_id = ? AND ga.user_id = ?
        LIMIT 1`
    )
    .get(noteId, userId);
  if (!bersama) return null;

  const kolaborator = db
    .prepare('SELECT 1 FROM catatan_kolaborator WHERE note_id = ? AND user_id = ?')
    .get(noteId, userId);

  return kolaborator ? 'tulis' : 'baca';
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