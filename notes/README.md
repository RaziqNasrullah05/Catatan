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
├── README.md
├── .gitignore                      # dist/, data/, .env, node_modules/
├── client/
│   ├── package.json                # Vite 8, plugin-react 6, React Router 7
│   ├── index.html                  # font Google, meta theme-color
│   ├── vite.config.js              # proxy /api, allowedHosts, manualChunks (fungsi!)
│   └── src/
│       ├── main.jsx                # entry; applyTheme() dipanggil sebelum render
│       ├── App.jsx                 # routing + status sesi + kerangka pemuatan awal
│       ├── api.js                  # klien fetch, menyisipkan header anti-CSRF
│       ├── prefs.js                # preferensi tata letak & tema (localStorage)
│       ├── utils.js                # withMinDelay — jeda minimum kerangka pemuatan
│       ├── templates.js            # 6 template catatan siap pakai
│       │
│       ├── cm/                     # semua yang menempel ke CodeMirror
│       │   ├── livePreview.js      # ViewPlugin dekorasi: sembunyikan sintaks, checkbox, tabel
│       │   ├── actions.js          # perintah format (tebal, heading, indent, dll)
│       │   ├── tableWidget.js      # widget tabel yang bisa disunting di dalam editor
│       │   └── table.js            # baca/tulis tabel markdown ⇄ data kisi
│       │
│       ├── components/
│       │   ├── Editor.jsx          # instance CodeMirror
│       │   ├── FormatRail.jsx      # rail format bawah + baris template
│       │   ├── Preview.jsx         # render markdown tersanitasi + tombol sunting tabel
│       │   ├── TableEditor.jsx     # penyunting tabel berbentuk kisi (tanpa CodeMirror)
│       │   ├── NoteMenu.jsx        # menu kontekstual: sematkan / hapus
│       │   ├── Skeleton.jsx        # kerangka pemuatan untuk tiap jenis daftar
│       │   └── ErrorBoundary.jsx   # menangkap error render agar layar tak kosong
│       │
│       ├── pages/
│       │   ├── Home.jsx            # daftar catatan + tugas, panel geser, tekan lama
│       │   ├── NoteEditor.jsx      # panel naik dari bawah, mode baca/tulis, simpan otomatis
│       │   ├── Login.jsx           # kata sandi / magic link
│       │   ├── Invite.jsx          # penerimaan undangan
│       │   └── Settings.jsx        # Keamanan / Tampilan / Undang orang (Material 3)
│       │
│       └── styles/                 # URUTAN IMPOR PENTING — lihat index.css
│           ├── index.css           # titik masuk; mendaftarkan semua modul
│           ├── base/
│           │   ├── tokens.css      # variabel warna, font, ukuran; tema gelap
│           │   └── reset.css       # dasar dokumen, tipografi, elemen mentah
│           ├── layout/
│           │   ├── shell.css       # kerangka .app, topbar, pencarian
│           │   ├── pager.css       # panel geser Catatan/Tugas (menimpa .segmented)
│           │   └── responsive.css  # penyesuaian layar lebar — dimuat paling akhir
│           ├── pages/
│           │   ├── notes-list.css  # kartu catatan, tata letak grid, menu kontekstual
│           │   ├── tasks.css       # daftar tugas + tambah tugas cepat
│           │   ├── auth.css        # halaman masuk dan undangan
│           │   └── settings.css    # komponen Material 3 (token --s-* di sini)
│           ├── editor/
│           │   ├── editor.css      # kerangka editor, judul, rail format
│           │   ├── codemirror.css  # penimpaan kelas .cm-* dan gaya live preview
│           │   ├── table-widget.css# tabel yang disunting langsung di editor
│           │   ├── preview.css     # render markdown mode baca
│           │   └── sheet.css       # animasi panel catatan naik dari bawah
│           └── components/
│               ├── sheet.css       # lembar konfirmasi
│               ├── dialog.css      # dialog pilihan (tata letak, mode warna)
│               ├── table-editor.css
│               └── skeleton.css
└── server/
    ├── package.json                # Express, better-sqlite3, helmet, nodemailer
    ├── .env.example
    └── src/
        ├── index.js                # middleware keamanan, penyajian client/dist
        ├── db.js                   # skema + migrasi + pembersihan token kedaluwarsa
        ├── security.js             # sesi, scrypt, guard CSRF & peran
        ├── mailer.js               # nodemailer, fallback cetak ke log
        └── routes/
            ├── auth.js             # masuk, kata sandi, undangan, admin
            └── notes.js            # CRUD catatan + agregasi tugas
```

Dua berkas bernama mirip dan mudah tertukar: `cm/table.js` mengurai teks tabel markdown menjadi data
kisi (dipakai `TableEditor` dan widget editor), sementara `cm/tableWidget.js` adalah widget CodeMirror
yang menampilkan tabel itu di dalam editor.

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

**Daftar bernomor bersarang** tampil sebagai 1.1, 1.2, 1.2.1 di mode baca — tingkatnya ditentukan
indentasi di markdown. Diterapkan lewat penghitung CSS di `styles/editor/preview.css`, memakai
`counters()` (merangkai semua tingkat), bukan `counter()` (hanya tingkat terdalam).

**Tabel** tidak dirender inline di dalam CodeMirror — menyuntingnya lewat penyunting kisi tersendiri
(`components/TableEditor.jsx`). Ada dua jalan masuk: tombol tabel di rail saat menulis (memuat tabel di posisi kursor,
atau membuat 3×3 baru), dan tombol "Sunting tabel" di bawah setiap tabel saat mode baca. `TableEditor`
sendiri tidak tahu-menahu soal CodeMirror — ia menerima data awal dan mengembalikan markdown, sehingga
dipakai bersama oleh kedua jalur. Mode baca menemukan tabel lewat `node.position.start.line` dari pohon
markdown; posisi ini terbukti selamat melewati `rehype-sanitize`. Tiap kepala kolom dan sisi kiri
baris punya tombol menu untuk menyisipkan kolom/baris **sebelum atau sesudahnya**, mengubah perataan,
dan menghapus; tombol di bawah kisi menambah di posisi akhir. Konversinya ada di `cm/table.js`
(`findTableAt`, `serializeTable`) — menangani pipa ter-escape, sel yang jumlahnya kurang, dan penulisan
ulang dengan lebar kolom yang disamakan. Baris pertama selalu jadi kepala tabel: tidak bisa dihapus dan tidak
bisa didahului baris baru, karena markdown mewajibkan kepala berada paling atas.

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

**`scroll-snap` beradu dengan `scrollTo({behavior:'smooth'})`.** Snap menarik balik posisi sementara
animasi masih berjalan, terlihat sebagai kedipan. `Home.jsx` mematikan `scrollSnapType` selama geseran
yang dipicu tombol, lalu memulihkannya. Kejadian scroll juga diabaikan selama itu agar tidak memicu
render ulang tiap frame.

**`NODE_ENV=production` tanpa HTTPS = layar putih.** Header `upgrade-insecure-requests` memaksa semua
permintaan ke HTTPS. Pastikan Certbot sudah jalan.

---

## 10. Konvensi

- Seluruh teks antarmuka, pesan error, dan komentar kode dalam **Bahasa Indonesia**.
- Komentar hanya ditulis untuk menjelaskan **kenapa**, bukan mengulang apa yang sudah jelas dari kode.
- Tidak ada framework CSS. Gaya dipecah per modul di `client/src/styles/`, dimuat lewat `styles/index.css`.
  **Urutan impor di berkas itu menentukan pemenang kaskade** — ketergantungan yang sudah diketahui
  dicatat sebagai komentar di sana. Modul baru: buat berkas di folder yang sesuai (`base/`, `layout/`,
  `pages/`, `editor/`, `components/`), lalu daftarkan pada kelompok yang tepat.
- Tidak ada state management library. `useState` + prop cukup untuk ukuran aplikasi ini.
- Warna diambil dari variabel (`var(--accent)`), jangan pernah hardcode nilai heksadesimal di komponen.
- Preferensi per-perangkat (tema, tata letak) di `localStorage` lewat `prefs.js`; data yang perlu ikut
  pindah perangkat masuk ke server.

### Token desain (`styles/base/tokens.css`)

```
--bg          latar aplikasi          --ink        teks utama
--paper       permukaan kartu/editor  --ink-soft   teks sekunder
--rule        garis halus             --ink-faint  teks samar
--rule-strong garis tegas             --accent     hijau pinus (aksi, aktif)
--danger      merah bata (hapus)
```

Tema gelap ditulis dua kali di `base/tokens.css`: satu untuk `@media (prefers-color-scheme: dark)` dengan selektor
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

**v1.8** — Tabel disunting lewat kisi sungguhan (`TableEditor.jsx` + `cm/table.js`), lengkap dengan tambah
dan hapus baris/kolom serta perataan per kolom. Semua lembar konfirmasi kini naik dari bawah dengan
animasi yang sama seperti panel catatan.

**v1.9** — Tabel yang sudah ada bisa disunting dari mode baca lewat tombol di bawah tabel; `TableEditor`
dilepas dari CodeMirror agar dipakai bersama oleh mode tulis dan mode baca (`cm/table.js` kini bekerja
pada teks biasa lewat `findTableAtLine` / `findTableAtOffset`). Menekan lama kartu catatan memunculkan
menu Sematkan dan Hapus, diposisikan di ruang kosong terdekat agar tidak menutupi kartu, dengan animasi
goyang halus sebagai umpan balik. Pada tampilan daftar tersedia tombol tiga titik.

**v1.10** — Perbaikan: kedipan latar saat berpindah tab lewat tombol (bentrok `scroll-snap` dengan
`scrollTo` smooth), dan teks kartu catatan yang ikut terblok saat ditekan lama (`user-select` dan
`-webkit-touch-callout` dimatikan pada kartu; pratinjau dan editor tetap bisa disalin).

**v1.11** — `styles.css` (1.429 baris) dipecah jadi 18 modul di `client/src/styles/`, dikelompokkan
menjadi `base`, `layout`, `pages`, `editor`, dan `components`, dimuat lewat `styles/index.css`. Sekalian
dibersihkan: satu blok 63 baris yang terduplikasi persis, tujuh aturan sisa halaman pengaturan lama yang
sudah tidak dipakai komponen mana pun, dan satu keyframes mati. CSS hasil build diverifikasi setara
aturan demi aturan dengan versi sebelumnya, termasuk urutan relatif selektor yang saling menimpa.

**v1.12** — Bagian struktur berkas di README disusun ulang mengikuti isi folder sebenarnya, termasuk
modul CSS dan berkas yang belum sempat tercatat. Satu berkas yatim (`src/md/table.js`, versi lama dari
`cm/table.js` yang tidak diimpor siapa pun) dihapus.

**v1.13** — Penyunting tabel: menyisipkan kolom di kiri/kanan dan baris di atas/bawah lewat menu pada
kepala kolom dan sisi baris. Daftar bernomor bersarang kini tampil sebagai 1.1, 1.2, 1.2.1 di mode baca.