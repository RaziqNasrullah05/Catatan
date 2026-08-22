import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const file = process.env.DATABASE_FILE || path.join(process.cwd(), 'data', 'catatan.db');
fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  role         TEXT NOT NULL DEFAULT 'member',
  disabled     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS invites (
  id         TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  email      TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  used_by    TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS login_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL DEFAULT '',
  pinned     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notes_user   ON notes(user_id, deleted_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at);

-- Nama tabel domain memakai Bahasa Indonesia, sekalian menghindari "groups"
-- yang sejak SQLite 3.28 dipakai sebagai kata kunci window function.
CREATE TABLE IF NOT EXISTS grup (
  id         TEXT PRIMARY KEY,
  nama       TEXT NOT NULL,
  leader_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grup_anggota (
  grup_id   TEXT NOT NULL REFERENCES grup(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  peran     TEXT NOT NULL DEFAULT 'anggota',
  joined_at TEXT NOT NULL,
  PRIMARY KEY (grup_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifikasi (
  id          TEXT PRIMARY KEY,
  penerima_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aktor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  jenis       TEXT NOT NULL,
  grup_id     TEXT REFERENCES grup(id) ON DELETE CASCADE,
  note_id     TEXT REFERENCES notes(id) ON DELETE CASCADE,
  -- 'menunggu' hanya dipakai notifikasi yang menuntut jawaban; sisanya 'info'.
  status      TEXT NOT NULL DEFAULT 'menunggu',
  created_at  TEXT NOT NULL,
  read_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_notif_penerima ON notifikasi(penerima_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anggota_user   ON grup_anggota(user_id);

-- Catatan tetap milik penulisnya; menaruhnya di grup hanya menambah kaitan.
-- Satu catatan boleh berada di banyak grup sekaligus.
CREATE TABLE IF NOT EXISTS grup_catatan (
  grup_id  TEXT NOT NULL REFERENCES grup(id)  ON DELETE CASCADE,
  note_id  TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  added_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL,
  PRIMARY KEY (grup_id, note_id)
);

CREATE INDEX IF NOT EXISTS idx_grup_catatan_note ON grup_catatan(note_id);

-- Izin menyunting catatan orang lain. Diusulkan pemimpin grup, berlaku hanya
-- setelah penulisnya menyetujui.
CREATE TABLE IF NOT EXISTS catatan_kolaborator (
  note_id    TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  granted_at TEXT NOT NULL,
  PRIMARY KEY (note_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_kolaborator_user ON catatan_kolaborator(user_id);

-- Agenda. Tanggal dan jam disimpan sebagai teks lokal (TTTT-BB-HH dan JJ:MM),
-- bukan penanda waktu UTC: yang dicatat adalah tanggal kalender, dan menyimpannya
-- sebagai instan membuat acara pagi hari bergeser ke tanggal sebelumnya.
-- Acara berulang disimpan satu baris beserta aturannya; penyebarannya dihitung
-- saat dibaca (lihat src/recurrence.js).
CREATE TABLE IF NOT EXISTS acara (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  judul        TEXT NOT NULL,
  deskripsi    TEXT NOT NULL DEFAULT '',
  tanggal      TEXT NOT NULL,
  mulai        TEXT,
  selesai      TEXT,
  ulang        TEXT,
  ulang_sampai TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_acara_user ON acara(user_id, tanggal);

-- Gambar disimpan sebagai berkas di cakram; barisnya hanya keterangan. Izinnya
-- menumpang catatan tempat gambar itu diunggah, jadi anggota grup yang boleh
-- membaca catatannya otomatis boleh melihat gambarnya.
CREATE TABLE IF NOT EXISTS gambar (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id    TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  berkas     TEXT NOT NULL,
  mime       TEXT NOT NULL,
  ukuran     INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gambar_note ON gambar(note_id);

-- Tag catatan. Milik masing-masing orang: tag tidak ikut pindah ke grup, dan
-- dua orang boleh memakai kata yang sama tanpa saling mengganggu — karenanya
-- user_id ikut jadi bagian kunci, bukan sekadar keterangan.
--
-- Dipilih tabel kaitan, bukan satu kolom teks dipisah koma di tabel notes.
-- Pertanyaan yang harus dijawab cepat adalah "catatan apa saja yang bertag X",
-- dan kolom teks memaksa seluruh isi tabel dibaca untuk menjawabnya. Tabel
-- kaitan menjawabnya lewat indeks.
--
-- Kolom nama disimpan sudah dikecilkan hurufnya, sehingga "Jantung" dan "jantung"
-- adalah tag yang sama. Tanpa itu daftar tag cepat penuh kembaran yang bedanya
-- cuma huruf pertama.
CREATE TABLE IF NOT EXISTS catatan_tag (
  note_id    TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (note_id, user_id, nama)
);

-- Menjawab "catatan apa saja yang bertag X, milik siapa".
CREATE INDEX IF NOT EXISTS idx_catatan_tag_nama ON catatan_tag(user_id, nama);
`);

// Migrasi: kolom-kolom ini ditambahkan belakangan, jadi dicek dulu agar
// basis data lama tetap bisa dipakai tanpa dibuat ulang.
const userColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
const tambahKolomUser = (nama, tipe) => {
  if (!userColumns.includes(nama)) db.exec(`ALTER TABLE users ADD COLUMN ${nama} ${tipe}`);
};

tambahKolomUser('password_hash', 'TEXT');
tambahKolomUser('username', 'TEXT');
tambahKolomUser('birthdate', 'TEXT');

// Nomor versi catatan, naik tiap kali isinya berubah. Dipakai menolak simpanan
// yang menimpa pekerjaan orang lain — lihat PATCH /api/notes/:id.
const noteColumns = db.prepare('PRAGMA table_info(notes)').all().map((c) => c.name);
if (!noteColumns.includes('version')) {
  db.exec('ALTER TABLE notes ADD COLUMN version INTEGER NOT NULL DEFAULT 1');
}

// Usulan kolaborasi menyebut tiga orang: pengusul, penerima usulan, dan orang
// yang diusulkan jadi kolaborator. Dua kolom pertama sudah ada.
const notifColumns = db.prepare('PRAGMA table_info(notifikasi)').all().map((c) => c.name);
if (!notifColumns.includes('target_id')) {
  db.exec('ALTER TABLE notifikasi ADD COLUMN target_id TEXT REFERENCES users(id)');
}

// SQLite tidak bisa menambahkan batasan UNIQUE lewat ALTER TABLE, jadi keunikan
// username dijaga indeks terpisah. Baris dengan NULL tidak saling bentrok —
// SQLite menganggap setiap NULL berbeda — sehingga akun yang belum mengisi
// username tetap sah semuanya.
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)');

// Housekeeping: buang token dan sesi yang sudah lewat masa berlaku.
export function purgeExpired() {
  const now = new Date().toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM login_tokens WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM invites WHERE expires_at < ? AND used_at IS NULL').run(now);
  // Gambar milik catatan yang akan lenyap dikumpulkan dulu, karena setelah
  // barisnya terhapus tidak ada lagi yang tahu berkas mana yang jadi yatim.
  const yatim = db
    .prepare(
      `SELECT g.berkas FROM gambar g JOIN notes n ON n.id = g.note_id
        WHERE n.deleted_at IS NOT NULL AND n.deleted_at < datetime('now','-30 days')`
    )
    .all()
    .map((r) => r.berkas);

  db.prepare("DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')").run();

  return yatim;
}