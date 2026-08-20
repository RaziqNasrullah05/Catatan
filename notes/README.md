# Catatan

Aplikasi catatan berbasis web dengan markdown live preview, agregasi tugas lintas catatan, dan akses
khusus undangan. Ditulis dalam Bahasa Indonesia sepenuhnya — antarmuka, pesan error, maupun komentar kode.

Dokumen ini ditulis sebagai **serah terima**: cukup dibaca sendiri untuk melanjutkan proyek di sesi lain
tanpa konteks percakapan sebelumnya.

---

## 1. Ringkasan

| Aspek | Pilihan |
| --- | --- |
| Antarmuka | React 18 + Vite 8 (Rolldown), tanpa framework CSS |
| Editor | CodeMirror 6 dengan dekorasi live preview buatan sendiri |
| Server | Express 4 + SQLite (`better-sqlite3`) |
| Autentikasi | Kata sandi (scrypt) **dan** magic link sekali pakai |
| Pendaftaran | Hanya lewat undangan admin |
| Ikon | `lucide-react` |
| Font | Newsreader (serif), Golos Text (sans), JetBrains Mono |
| Deploy | Satu origin: Express melayani hasil build Vite |

Domain produksi: `https://catatan.warkophajisobirin.fun`

---

## 2. Struktur berkas

```
notes/
├── client/
│   ├── index.html              # font Google, meta theme-color
│   ├── vite.config.js          # proxy /api, allowedHosts, manualChunks (fungsi!)
│   └── src/
│       ├── main.jsx            # entry; applyTheme() dipanggil sebelum render
│       ├── App.jsx             # routing + status sesi
│       ├── api.js              # klien fetch, menyisipkan header anti-CSRF
│       ├── prefs.js            # preferensi tampilan & tema (localStorage)
│       ├── templates.js        # 6 template catatan siap pakai
│       ├── styles.css          # SELURUH gaya aplikasi + token desain
│       ├── cm/
│       │   ├── livePreview.js  # ViewPlugin dekorasi CodeMirror
│       │   └── actions.js      # perintah format (bold, heading, indent, dll)
│       ├── components/
│       │   ├── Editor.jsx      # instance CodeMirror
│       │   ├── FormatRail.jsx  # rail format bawah + baris template
│       │   ├── Preview.jsx     # render markdown tersanitasi
│       │   └── ErrorBoundary.jsx
│       └── pages/
│           ├── Home.jsx        # daftar catatan + tugas, panel geser
│           ├── NoteEditor.jsx  # menulis, simpan otomatis
│           ├── Login.jsx       # kata sandi / magic link
│           ├── Invite.jsx      # penerimaan undangan
│           └── Settings.jsx    # Keamanan / Tampilan / Undang orang
└── server/
    ├── .env.example
    └── src/
        ├── index.js            # middleware keamanan, penyajian dist
        ├── db.js               # skema + migrasi + pembersihan token
        ├── security.js         # sesi, hashing, guard CSRF & peran
        ├── mailer.js           # nodemailer, fallback ke log
        └── routes/
            ├── auth.js         # masuk, kata sandi, undangan, admin
            └── notes.js        # CRUD catatan + tugas
```

---

## 3. Menjalankan

### Pengembangan

```bash
# Terminal 1
cd notes/server
npm install
cp .env.example .env      # WAJIB: isi ADMIN_EMAIL
npm run dev               # http://localhost:3000

# Terminal 2
cd notes/client
npm install
npm run dev               # http://localhost:5173  ← buka yang INI
```

Buka `localhost:5173`, bukan `:3000`. Express baru melayani halaman kalau `client/dist` sudah ada.

### Produksi

```bash
cd notes/client && npm run build     # menghasilkan client/dist
cd ../server && NODE_ENV=production npm start
```

Express otomatis melayani `client/dist`, jadi antarmuka dan API satu origin. Nginx cukup diarahkan ke
port 3000 saja.

### Variabel lingkungan

| Variabel | Keterangan |
| --- | --- |
| `APP_URL` | Origin antarmuka. Dipakai untuk CORS **dan** tujuan pengalihan setelah verifikasi magic link. |
| `API_URL` | Basis tautan di email. **Kosongkan saat produksi** agar mengikuti `APP_URL`. Hanya perlu diisi saat pengembangan (port berbeda). |
| `PORT` | Default 3000. |
| `NODE_ENV` | `production` mengaktifkan cookie `Secure`, HSTS, dan `upgrade-insecure-requests`. |
| `DATABASE_FILE` | Default `./data/catatan.db`. |
| `CLIENT_DIR` | Default `../client/dist`, relatif terhadap direktori kerja. |
| `ADMIN_EMAIL` | Akun admin dibuat otomatis saat start. |
| `SMTP_*`, `MAIL_FROM` | Kalau `SMTP_HOST` kosong, tautan dicetak ke log server. |

---

## 4. Autentikasi

Dua jalur masuk yang berdampingan:

**Kata sandi** — jalur utama. Hash memakai `crypto.scryptSync` bawaan Node (N=2^15, r=8, p=1), sengaja
bukan bcrypt/argon2 supaya tidak menambah dependensi native yang harus dikompilasi saat deploy. Minimal
10 karakter. Mengganti kata sandi wajib menyertakan yang lama.

**Magic link** — jalur pendaftaran pertama dan pemulihan. Token 32 byte, berlaku 15 menit, sekali pakai.

Alur pengguna baru:

```
Admin buat undangan  →  tautan /invite/<token>
      ↓
Penerima isi email   →  akun dibuat, magic link dikirim
      ↓
Buka magic link      →  sesi aktif
      ↓
Pengaturan → Keamanan → pasang kata sandi
      ↓
Selanjutnya cukup email + kata sandi
```

Sesi disimpan sebagai token acak di cookie `sid` (`httpOnly`, `Secure` di produksi, `SameSite=Lax`),
berlaku 30 hari. Hanya hash SHA-256-nya yang masuk basis data.

---

## 5. API

Semua endpoint diawali `/api`. Permintaan yang mengubah data **wajib** membawa header
`X-Requested-With: catatan-app` — ini pertahanan CSRF, dan `api.js` sudah menyisipkannya otomatis.

### Autentikasi (`/api/auth`)

| Metode | Jalur | Keterangan |
| --- | --- | --- |
| POST | `/login` | Kirim magic link. Selalu balas `{ok:true}` agar tak bocor siapa terdaftar. |
| POST | `/password/login` | Masuk dengan email + kata sandi. |
| GET | `/verify?token=` | Verifikasi magic link, pasang sesi, alihkan ke `APP_URL`. |
| POST | `/logout` | Hapus sesi. |
| GET | `/me` | `{user: {id, email, role, hasPassword}}` atau `{user: null}`. |
| POST | `/password` | Pasang/ganti kata sandi (butuh sesi; ganti butuh `currentPassword`). |
| DELETE | `/password` | Lepas kata sandi. |
| GET | `/invite/:token` | Cek keabsahan undangan. |
| POST | `/invite/:token/accept` | Buat akun, kirim magic link. |

### Catatan (`/api/notes`, semua butuh sesi)

| Metode | Jalur | Keterangan |
| --- | --- | --- |
| GET | `/?q=` | Daftar catatan + `excerpt` dan `openTasks`. |
| POST | `/` | Buat catatan kosong. |
| GET/PATCH/DELETE | `/:id` | Ambil, ubah, hapus (soft delete 30 hari). |
| GET | `/tasks/all` | Semua checkbox dari seluruh catatan. |
| POST | `/tasks` | Tambah tugas cepat ke catatan berjudul "Tugas". |
| POST | `/:id/tasks/:line/toggle` | Centang satu baris tugas. |

### Admin (`/api/admin`, butuh peran admin)

`GET /users`, `GET /invites`, `POST /invites`, `POST /users/:id/access`

---

## 6. Basis data

Tabel: `users`, `invites`, `login_tokens`, `sessions`, `notes`. Skema dibuat lewat `CREATE TABLE IF NOT
EXISTS` di `db.js`, jadi aman dijalankan berulang.

Migrasi kolom baru memakai pola pemeriksaan `PRAGMA table_info`:

```js
const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!cols.includes('password_hash')) db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
```

**Ikuti pola ini untuk setiap kolom baru** agar basis data lama tidak perlu dibuat ulang.

`purgeExpired()` jalan saat start dan tiap jam: membuang sesi/token kedaluwarsa dan catatan terhapus
yang lebih tua dari 30 hari.

Tugas **bukan** tabel tersendiri — tugas adalah baris `- [ ]` di dalam markdown catatan, diurai dengan
regex saat dibaca. Ini disengaja: tugas tetap bisa disunting sebagai teks biasa.

---

## 7. Editor

`cm/livePreview.js` adalah `ViewPlugin` yang membangun dekorasi dari `syntaxTree`:

- Tanda markdown (`**`, `#`, `>`, `~~`) disembunyikan, **kecuali** pada baris tempat kursor berada —
  di situ sintaks asli muncul kembali agar bisa disunting. Ini inti rasa "ala Obsidian".
- `TaskMarker` diganti widget checkbox yang bisa diklik.
- `ListMark` diganti bullet `•`.
- Heading, blockquote, blok kode, tabel, dan garis pemisah mendapat kelas per baris.

**Batasan yang disengaja:** tabel tidak dirender inline. Merender tabel di dalam CodeMirror sambil tetap
bisa disunting jauh lebih rumit daripada nilainya. Tabel tampil monospace saat menulis, dan penuh di mode
Baca (ikon mata). Obsidian pun begitu.

Tab menambah indentasi 2 spasi, Shift+Tab menguranginya, keduanya bekerja pada seleksi banyak baris.
Di ponsel tersedia tombol indentasi di rail format.

Rail format bawah bisa digeser horizontal. Tombol paling kiri membuka baris template: rencana harian,
ceklis, rapat, catatan SOAP, tabel, jurnal bacaan (`templates.js`).

---

## 8. Keamanan

| Lapisan | Penerapan |
| --- | --- |
| Sesi | Token acak 256-bit, cookie `httpOnly`/`Secure`/`SameSite=Lax`, hanya hash SHA-256 disimpan. |
| Kata sandi | scrypt N=2^15, salt acak 16 byte, perbandingan `timingSafeEqual`. |
| Enumerasi akun | Pesan error login sandi salah dan email tak terdaftar **identik**; akun tanpa sandi tetap menjalankan hash palsu agar waktu respons seragam. |
| CSRF | Header `X-Requested-With` wajib pada semua metode pengubah data. |
| Rate limit | Login 5/IP/15 menit, terima undangan 10/jam, API umum 300/menit. |
| SQL injection | Seluruh kueri `prepared statement`; pencarian meng-escape `%`, `_`, `\`. |
| XSS | `rehype-sanitize` dengan skema ketat; protokol dibatasi `http`, `https`, `mailto`. |
| Header | Helmet: CSP tanpa script inline, `frame-ancestors 'none'`, HSTS di produksi. |
| Otorisasi | Setiap kueri catatan disaring `user_id` — ID orang lain tidak bisa ditebak. |
| Pencabutan akses | Menonaktifkan pengguna langsung menghapus seluruh sesinya. |

Belum ada: 2FA, cadangan otomatis berkas SQLite, audit log.

CSP mengizinkan `style-src 'unsafe-inline'` karena CodeMirror menyuntikkan `<style>` saat berjalan.

---

## 9. Jebakan yang sudah pernah menggigit

Baca bagian ini sebelum menghabiskan waktu men-debug hal yang sama.

**`client/dist` ada di `.gitignore`.** Setelah `git clone` atau `git pull` di server, **wajib** jalankan
`npm run build` di `client`. Kalau tidak, Express tidak menemukan folder itu dan `/` membalas
`Cannot GET /`.

**`manualChunks` harus berupa fungsi.** Vite 8 memakai Rolldown, yang menolak bentuk objek dengan
`TypeError: manualChunks is not a function`.

**`@vitejs/plugin-react-oxc` sudah usang** dan hanya mendukung Vite 6–7. Untuk Vite 8 pakai
`@vitejs/plugin-react` v6 — versi itu sudah memakai Oxc di dalamnya.

**`better-sqlite3` perlu kompilasi native.** Di Ubuntu bersih: `sudo apt install -y build-essential
python3`. Node minimal v18; hindari `nodejs` bawaan `apt` yang sering usang, pakai NodeSource.

**`.env` hanya dibaca saat start.** Setelah menyuntingnya, restart server.

**`APP_URL` salah = magic link mengarah ke localhost.** Ini penyebab paling umum "halaman kosong setelah
klik tautan email".

**`WorkingDirectory` di systemd** harus menunjuk folder `server`, karena `CLIENT_DIR` relatif terhadap
direktori kerja. Alternatifnya pakai jalur absolut.

**`NODE_ENV=production` tanpa HTTPS = layar putih.** Header `upgrade-insecure-requests` memaksa semua
permintaan ke HTTPS. Pastikan Certbot sudah jalan.

---

## 10. Konvensi

- Seluruh teks antarmuka, pesan error, dan komentar kode dalam **Bahasa Indonesia**.
- Komentar hanya ditulis untuk menjelaskan **kenapa**, bukan mengulang apa yang sudah jelas dari kode.
- Tidak ada framework CSS. Semua gaya di `styles.css`, memakai variabel CSS di `:root`.
- Tidak ada state management library. `useState` + prop cukup untuk ukuran aplikasi ini.
- Warna diambil dari variabel (`var(--accent)`), jangan pernah hardcode nilai heksadesimal di komponen.
- Preferensi per-perangkat (tema, tata letak) di `localStorage` lewat `prefs.js`; data yang perlu ikut
  pindah perangkat masuk ke server.

### Token desain (`styles.css`)

```
--bg          latar aplikasi          --ink        teks utama
--paper       permukaan kartu/editor  --ink-soft   teks sekunder
--rule        garis halus             --ink-faint  teks samar
--rule-strong garis tegas             --accent     hijau pinus (aksi, aktif)
--danger      merah bata (hapus)
```

Tema gelap ditulis dua kali di CSS: satu untuk `@media (prefers-color-scheme: dark)` dengan selektor
`:root:not([data-theme='light'])`, satu lagi untuk `:root[data-theme='dark']`. `applyTheme()` di
`main.jsx` dipanggil sebelum render agar tidak ada kedipan warna.

---

## 11. Backlog

### 11.1 Lainnya

- Cadangan otomatis berkas SQLite (mis. `sqlite3 .backup` via cron)
- Ekspor catatan ke `.md` atau `.zip`
- Tempat sampah yang bisa dilihat dan dipulihkan sebelum 30 hari
- Pencarian dengan FTS5 (sekarang masih `LIKE`, cukup sampai ribuan catatan)
- Mode luring dengan service worker
- Unggah gambar
- 2FA (TOTP)
- Render tabel inline di editor — sengaja ditunda, lihat bagian 7

---

## 12. Riwayat perubahan

**v1.0** — Rilis awal. Catatan markdown, live preview, agregasi tugas, autentikasi magic link,
undangan admin, desain mobile-first.

**v1.1** — Naik ke Vite 8 + `@vitejs/plugin-react` v6 + React Router 7. `manualChunks` diubah ke bentuk
fungsi. `allowedHosts` ditambahkan untuk domain produksi.

**v1.2** — Indentasi Tab/Shift+Tab dan tombolnya di rail. Tambah tugas cepat dari tab Tugas
(`POST /api/notes/tasks`). Tata letak daftar catatan: daftar / 2 kolom / 3 kolom. Halaman pengaturan
dibuka untuk semua pengguna, bukan admin saja.

**v1.3** — Masuk dengan kata sandi (scrypt), dapat dipasang dan diganti dari Pengaturan; magic link
tetap ada sebagai pemulihan. `ErrorBoundary` agar kegagalan render tidak lagi berupa layar kosong.

**v1.4** — Panel Catatan/Tugas bisa digeser dengan scroll-snap horizontal, penanda segmented ikut
bergeser. Pengaturan dipecah jadi tiga bagian. Mode warna terang/gelap/otomatis.

**v1.5** — Halaman Pengaturan dirombak ke bahasa visual Material 3: latar biru-abu muda, kartu putih
membulat besar, baris ikon-judul-deskripsi, chip pilihan berbentuk pil, kolom isian *outlined*, dan
tombol pil. Token `--s-*` dibatasi ke `.settings-page` dan mewarisi nilai dari token global, sehingga warna latar
sama persis dengan halaman lain — yang membedakan hanya bentuk dan jaraknya. Pilihan tata letak dan mode
warna dibuka lewat dialog saat barisnya diketuk, bukan chip inline.

**v1.6** — Kerangka pemuatan (skeleton) di halaman utama, editor catatan, pemeriksaan sesi, dan daftar
orang. Konfirmasi sebelum keluar akun. Catatan kini dibuka dalam mode baca; menulis dimulai lewat ikon
pensil. Editor tampil sebagai panel yang naik dari bawah dan bisa ditutup dengan menyeret bilah atasnya
ke bawah — simpan otomatis dituntaskan lebih dulu sebelum kembali, sehingga daftar di halaman utama
selalu memuat versi terbaru.

**v1.7** — Kerangka pemuatan ditahan minimal 500 ms (`utils.js`) agar tidak berkedip saat respons cepat.
Seret panel catatan dikendalikan lewat `ref` dan gaya inline, bukan `useState`, sehingga isi catatan
tidak dirender ulang setiap gerakan jari; animasi tutup kini berlanjut dari posisi jari terakhir alih-alih
melompat ke posisi awal.