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
├── package.json                    # hanya untuk lint; klien dan server tetap paket terpisah
├── eslint.config.js                # no-undef untuk client/src dan server/src
├── CONTEXT.md                      # orientasi untuk sesi lanjutan: keputusan,
│                                   #   cara kerja, dan hal yang masih menggantung
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
│       ├── nav.js                  # tujuan navigasi yang dipakai lebih dari satu halaman
│       ├── image.js                # mengecilkan gambar sebelum diunggah
│       ├── panel.js                # usePanel: animasi masuk & keluar halaman
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
│       │   ├── PullRefresh.jsx     # tarik untuk muat ulang, efek ketapel
│       │   ├── GroupConfirm.jsx    # lembar konfirmasi, dipakai dua halaman grup
│       │   ├── Sheet.jsx         # lembar yang naik dan turun; tangani Esc
│       │   ├── TagRow.jsx        # deret tag + grup di antara judul dan isi
│       │   ├── TaskCard.jsx      # kontainer tugas + formulirnya
│       │   ├── Skeleton.jsx        # kerangka pemuatan untuk tiap jenis daftar
│       │   └── ErrorBoundary.jsx   # menangkap error render agar layar tak kosong
│       │
│       ├── pages/
│       │   ├── Home.jsx            # daftar catatan + tugas, panel geser, tekan lama
│       │   ├── NoteEditor.jsx      # panel naik dari bawah, mode baca/tulis, simpan otomatis
│       │   ├── GroupNotes.jsx      # halaman utama sebuah grup: catatan di dalamnya
│       │   ├── GroupSettings.jsx   # undang, anggota, bubarkan (Material 3)
│       │   ├── Notification.jsx    # daftar pemberitahuan
│       │   ├── Login.jsx           # kata sandi / magic link
│       │   ├── Invite.jsx          # penerimaan undangan
│       │   └── Settings.jsx        # Keamanan / Tampilan / Undang orang (Material 3)
│       │
│       └── styles/                 # URUTAN IMPOR PENTING — lihat index.css
│           ├── index.css           # titik masuk; mendaftarkan semua modul
│           ├── base/
│           │   ├── tokens.css      # variabel warna, font, ukuran; tema gelap
│           │   ├── reset.css       # dasar dokumen, tipografi, elemen mentah
│           │   └── selection.css   # seleksi teks dimatikan di halaman utama
│           ├── layout/
│           │   ├── shell.css       # kerangka .app, topbar, pencarian
│           │   ├── transitions.css # cara halaman masuk (naik, kiri, kanan)
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
│               ├── pull-refresh.css
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
            ├── auth.js             # masuk, kata sandi, profil, undangan, admin
            ├── events.js           # agenda: acara dan pengulangannya
            ├── images.js           # unggah, sajikan, hapus gambar
            ├── group.js            # grup, anggota, undangan, catatan di grup
            ├── notification.js     # daftar, terima, tolak, tandai dibaca
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

### Mencadangkan

```bash
cd notes/server
npm run backup                  # ke ./backups, menyimpan 7 terakhir
node scripts/backup.mjs /media/hdd/catatan   # ke folder lain
SIMPAN=14 npm run backup        # simpan 14 terakhir
```

Aman dijalankan selagi server hidup. Untuk menjadwalkannya tiap malam pukul 02.00, tambahkan ke
crontab (`crontab -e`), dengan jalur mutlak karena cron tidak mewarisi PATH milikmu:

```
0 2 * * * cd /path/ke/notes/server && /usr/bin/node scripts/backup.mjs >> /var/log/catatan-backup.log 2>&1
```

**Uji pemulihannya sesekali.** Cadangan yang belum pernah dipulihkan belum tentu cadangan. Langkahnya
ada di `INFO.txt` dalam setiap folder cadangan.

### Memeriksa kode

```bash
cd notes
npm install      # sekali saja, hanya ESLint
npm run lint     # memeriksa client/src dan server/src
```

**Jalankan ini sebelum menganggap sebuah perubahan selesai.** `npm run build` tidak menangkap variabel
yang tidak terdefinisi di dalam komponen — dua bug produksi pernah lolos karenanya. Yang
menangkapnya `no-undef`. Aturannya sengaja sedikit: ini bukan penata gaya penulisan, hanya penjaring
kesalahan nyata.

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
| `UPLOAD_DIR` | Folder berkas gambar. Bawaan `./data/uploads`. Harus ikut dicadangkan. |
| `SMTP_*`, `MAIL_FROM` | Kalau `SMTP_HOST` kosong, tautan dicetak ke log server. |

Saat start, server memeriksa konfigurasi ini dan mencetak peringatan `[konfigurasi]` untuk `APP_URL`
yang masih `http://` di produksi, `API_URL` yang terisi padahal satu origin, `ADMIN_EMAIL` kosong,
`client/dist` yang belum dibangun, dan sambungan SMTP yang gagal. Server tetap jalan — peringatannya
ada supaya salah konfigurasi terlihat di log, bukan baru ketahuan sebagai halaman kosong di layar
orang lain.

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
| GET | `/me` | `{user: {id, email, role, username, birthdate, hasPassword}}` atau `{user: null}`. |
| POST | `/password` | Pasang/ganti kata sandi (butuh sesi; ganti butuh `currentPassword`). |
| DELETE | `/password` | Lepas kata sandi. |
| PATCH | `/profile` | Ubah `username` dan `birthdate`. Kirim `''` atau `null` untuk mengosongkan. |
| GET | `/invite/:token` | Cek keabsahan undangan. |
| POST | `/invite/:token/accept` | Buat akun, kirim magic link. |

### Catatan (`/api/notes`, semua butuh sesi)

| Metode | Jalur | Keterangan |
| --- | --- | --- |
| GET | `/?q=` | Daftar catatan + `excerpt` dan `openTasks`. |
| POST | `/` | Buat catatan kosong. |
| GET/PATCH/DELETE | `/:id` | Ambil, ubah, hapus (soft delete 30 hari). |
| GET | `/tasks/all` | Semua checkbox dari seluruh catatan. |
| PUT | `/:id/tags` | Menetapkan seluruh daftar tag sekaligus. Cukup bisa membaca catatannya; tag milik pemanggil, bukan penulis. |
| GET | `/tags/all` | Semua tag yang pernah dipakai orang ini, beserta jumlah catatannya. |
| POST | `/tasks` | Tambah tugas cepat ke catatan berjudul "Tugas". |
| POST | `/:id/tasks/:line/toggle` | Centang satu baris tugas. |

### Tugas (`/api/tasks`, semua butuh sesi)

| Metode | Jalur | Keterangan |
| --- | --- | --- |
| GET | `/` | Daftar tugas. Urut: belum selesai, tenggat terdekat, terbaru. |
| POST | `/` | Buat tugas. `judul` wajib; `isi` dan `tenggat` opsional. |
| PATCH | `/:id` | Ubah sebagian. Semua kolom opsional, termasuk `selesai`. |
| DELETE | `/:id` | Hapus permanen; tidak ada tempat sampah. |

### Grup (`/api/groups`, semua butuh sesi)

| Metode | Jalur | Keterangan |
| --- | --- | --- |
| GET | `/` | Grup yang kamu ikuti, beserta peran dan jumlah anggota. |
| POST | `/` | Buat grup; pembuatnya langsung jadi pemimpin. |
| GET/PATCH/DELETE | `/:id` | Rincian, ganti nama, bubarkan. Ubah dan bubarkan khusus pemimpin. |
| POST | `/:id/invite` | Undang lewat nama pengguna atau email; membuat notifikasi. |
| GET | `/:id/candidates?q=` | Saran orang yang bisa diundang. Pemimpin saja; mencocokkan awal `username` (bukan email), minimal 2 huruf, maksimal 8 hasil. Anggota dan yang sudah diundang tidak ikut. Email tidak pernah dikembalikan. |
| DELETE | `/:id/invites/:notifId` | Batalkan undangan yang belum dijawab. |
| POST | `/:id/leave` | Keluar dari grup. Pemimpin harus mengalihkan jabatan dulu. |
| DELETE | `/:id/members/:userId` | Keluarkan anggota (pemimpin). |
| POST | `/:id/leader/:userId` | Alihkan jabatan pemimpin. |
| GET | `/:id/notes` | Catatan yang disimpan di grup ini, beserta penulis dan kolaboratornya. |
| DELETE | `/:id/notes/:noteId` | Keluarkan catatan dari grup (penulisnya atau pemimpin). |
| POST | `/:id/notes/:noteId/collaborators` | Pemimpin mengusulkan seorang anggota jadi kolaborator. Membalas `langsung: true` bila pengusulnya penulis sendiri. |
| DELETE | `/:id/notes/:noteId/collaborators/:userId` | Cabut izin (penulis atau pemimpin). |

### Pemberitahuan (`/api/notifications`, semua butuh sesi)

| Metode | Jalur | Keterangan |
| --- | --- | --- |
| GET | `/` | 100 terbaru, plus `belumDibaca`. |
| GET | `/count` | Hanya jumlah belum dibaca — dipakai titik di bilah atas. |
| POST | `/read` | Tandai semuanya sudah dilihat. |
| POST | `/:id/accept`, `/:id/reject` | Menjawab yang berstatus `menunggu`. |

### Gambar (`/api/images`, semua butuh sesi)

| Metode | Jalur | Keterangan |
| --- | --- | --- |
| POST | `/?noteId=` | Badan permintaan adalah berkasnya apa adanya, bukan multipart. Maksimal 2 MB. |
| GET | `/:id` | Menyajikan gambar bila catatannya boleh dibaca. |
| DELETE | `/:id` | Hapus (pemiliknya). |

### Agenda (`/api/events`, semua butuh sesi)

| Metode | Jalur | Keterangan |
| --- | --- | --- |
| GET | `/?dari=&sampai=` | Acara dalam rentang tanggal, acara berulang sudah disebar. |
| POST | `/` | Buat acara. |
| PATCH | `/:id` | Ubah. Seluruh isian dikirim ulang, bukan sebagian. |
| DELETE | `/:id` | Hapus. Acara berulang terhapus sebagai satu kesatuan. |

### Admin (`/api/admin`, butuh peran admin)

`GET /users` (termasuk `username`), `GET /invites`, `POST /invites`, `POST /users/:id/access`

---

## 6. Basis data

Tabel: `users`, `invites`, `login_tokens`, `sessions`, `notes`, `grup`, `grup_anggota`, `grup_catatan`,
`catatan_kolaborator`, `notifikasi`, `acara`, `gambar`.
Tabel domain baru dinamai dalam Bahasa Indonesia — sekalian menghindari `groups`, yang sejak SQLite
3.28 dipakai sebagai kata kunci window function. Skema dibuat lewat `CREATE TABLE IF NOT
EXISTS` di `db.js`, jadi aman dijalankan berulang.

Migrasi kolom baru memakai pola pemeriksaan `PRAGMA table_info`:

```js
const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!cols.includes('password_hash')) db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
```

**Ikuti pola ini untuk setiap kolom baru** agar basis data lama tidak perlu dibuat ulang.

SQLite tidak bisa menambahkan batasan `UNIQUE` lewat `ALTER TABLE`, jadi keunikan `users.username`
dijaga indeks terpisah (`idx_users_username`). Baris ber-`NULL` tidak saling bentrok karena SQLite
menganggap setiap `NULL` berbeda — akun yang belum mengisi username tetap sah semuanya.

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

**`npm run build` tidak menangkap nama yang tidak terdefinisi.** Bundler hanya menyusun modul; ia tidak
tahu bahwa sebuah nama tidak pernah dideklarasikan di mana pun. Sejak v1.31 ada `npm run lint` di akar
proyek — jalankan sebelum menyerahkan perubahan.

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

### Meminjam bentuk Material 3 di luar Pengaturan

Kelas `.m3-*` (`m3-card`, `m3-row`, `m3-btn`, `m3-avatar`, …) global sejak v1.5. Yang dulu mengunci
mereka ke halaman Pengaturan bukan selektornya, melainkan tidak adanya nilai token `--s-*` di luar
sana. Sejak v1.32 kelas **`.m3-scope`** mendeklarasikan token itu, jadi bagian mana pun bisa
memakainya: pasang `.m3-scope` pada pembungkusnya, lalu gunakan kelas `.m3-*` seperti biasa. Latar
halaman penuh tetap hanya dipasang `.settings-page`.

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

**v1.53** — Pengerasan rute hari libur.

Dua celah yang ketahuan saat memeriksa ulang v1.52, keduanya soal memercayai layanan pihak ketiga
lebih dari seharusnya.

**Besar jawaban tidak dibatasi.** `res.json()` membaca sampai habis tanpa bertanya berapa panjangnya.
Satu bulan berisi segelintir hari libur, jadi jawaban wajar cuma ratusan byte — tapi layanan gratis
bisa berpindah tangan, disusupi, atau sekadar mengembalikan halaman galat raksasa. Sekarang badannya
dibaca potong demi potong dengan batas 256 KB dan sambungannya diputus begitu lewat. Diuji dengan
cermin yang mengirim 50 MB sampah tanpa `content-length`: permintaannya gagal rapi, dan memori server
tidak bergerak.

**Rentang bulan tidak dibatasi.** Bentuk `TTTT-BB` saja tidak cukup — siapa pun yang sudah masuk bisa
meminta sepuluh ribu bulan berbeda, dan tiap bulan yang belum tersinggah memicu satu permintaan
keluar. Itu menjadikan server ini pengeras serangan terhadap layanan orang lain, sekaligus mengisi
tabel `libur` dengan baris yang tidak akan dilihat siapa pun. Sekarang dibatasi lima tahun ke belakang
dan ke depan, dan bulan di luar 01–12 ditolak.

**v1.52** — Tanggal merah di Agenda, diambil dari API.

**Tanggalnya tidak pernah ditulis di dalam kode.** Idul Fitri, Nyepi, dan Waisak bergeser tiap tahun
mengikuti kalender Hijriah, Saka, dan lunar, dan cuti bersama ditetapkan lewat SKB yang kadang berubah
di tengah tahun. Apa pun yang ditulis sekarang akan salah dalam dua belas bulan — dan salahnya
diam-diam, sebab tidak ada yang gagal, cuma tanggalnya keliru.

Sumbernya **api-harilibur**, yang menyediakan tiga domain cermin untuk layanan yang sama; ketiganya
dicoba berurutan, karena layanan gratis mati bukan kejadian langka. Bisa diganti lewat `HOLIDAY_API`
di `.env` (dipisah koma) kalau suatu saat sumbernya berpindah.

**Diambil server, bukan peramban.** Dua alasan: CSP tidak perlu dibuka ke domain luar, dan jawabannya
bisa disinggah di tabel `libur` — satu baris per bulan, dianggap segar tujuh hari. Kalau pengambilan
baru gagal, **singgahan yang sudah basi tetap dipakai**: hari libur tidak berubah sesering itu, dan
yang tersimpan minggu lalu hampir pasti masih benar. Kalau tidak ada singgahan sama sekali, balasannya
daftar kosong dengan status 200, bukan galat — kalender yang kehilangan tanggal merahnya masih
berguna, kalender yang gagal dimuat tidak.

**Hanya libur nasional.** Sumber ini juga memuat hari raya daerah Bali; menampilkannya sebagai merah
akan salah memberi tahu siapa pun di luar Bali. Sumbernya juga kadang menulis `2026-8-1` tanpa nol di
depan, jadi tanggalnya dinormalkan supaya klien bisa membandingkannya sebagai teks biasa.

Di kisi kalender, **angkanya yang merah, bukan latarnya** — latar merah akan berebut dengan penanda
"hari ini" dan "dipilih" yang dua-duanya sudah memakai latar. Nama liburnya masuk ke `aria-label` dan
`title`, sebab warna saja tidak memberi tahu apa pun bagi pembaca layar, dan tidak semua orang
membedakan merah. Di bawah kalender ada blok **tanggal merah bulan yang sedang dilihat** — hanya bulan
itu, sebab menampilkan libur bulan lain berarti menyebut tanggal yang tidak terlihat di kisi mana pun.
Blok itu ikut hilang saat sebuah tanggal diketuk, karena di situ pertanyaannya sudah berubah.

**v1.51** — Perbaikan: pengecilan gagal diam-diam, dan galatnya ditelan.

Pesan yang muncul di lapangan: *"Gambar terlalu besar (2,3 MB). Peramban ini tidak bisa membacanya
untuk dikecilkan."* Kalimat itu keluar untuk berkas PNG dan JPEG biasa — yang jelas bisa dibaca
peramban — dan itu menandakan dua kesalahan sekaligus.

**Kesalahan pertama: galatnya ditelan.** `catch` di v1.49 membuang pesan aslinya dan mengembalikan
berkas apa adanya, sehingga apa pun yang salah di dalam sana keluar sebagai satu kalimat yang sama.
Itu menyembunyikan satu-satunya petunjuk yang ada. Sekarang alasannya dibawa keluar lewat medan
`sebab` dan ditampilkan apa adanya di pesan penolakan.

**Kesalahan kedua: satu jalur dekode saja.** v1.49 dan v1.50 hanya memakai elemen `<img>` lewat URL
objek. Sekarang `createImageBitmap` dicoba lebih dulu — ia mendekode di luar utas utama, tidak lewat
URL objek, dan menangani lebih banyak format — dengan `<img>` tetap sebagai cadangan, sebab
`createImageBitmap` belum ada di peramban lama dan pada sebagian versi Safari justru menolak berkas
yang bisa dibaca `<img>`. Dua jalur, dan yang satu menutupi kegagalan yang lain.

Ikutannya: `ImageBitmap` ditutup di blok `finally`. Ia menahan memori sampai ditutup, dan pada foto 12
megapiksel itu puluhan megabyte yang tidak akan dilepas sendiri di ponsel. Ketiadaan konteks kanvas 2D
juga kini dilempar dengan pesannya sendiri, bukan jadi kegagalan senyap.

Diuji empat jalur: tanpa `createImageBitmap` (peramban lama), lewat `createImageBitmap`,
`createImageBitmap` yang menolak sehingga cadangan `<img>` dipakai, dan berkas yang benar-benar tidak
terbaca — yang terakhir mengembalikan sebab yang bisa dibaca orang, bukan kalimat umum.

**v1.50** — Perbaikan: gambar besar masih ditolak meski pengecilan sudah ada.

Dua lubang di v1.49, keduanya membuat berkas lolos tanpa pernah dikecilkan.

**Daftar putih tipe berkas meleset.** v1.49 hanya mencoba `image/jpeg`, `image/png`, dan `image/webp`.
Kamera ponsel sekarang kerap menghasilkan HEIC atau HEIF, dan sebagian pemilih berkas mengirim tipe
kosong — semuanya lewat tanpa disentuh lalu ditolak server. Sekarang kebalikannya: **semua dicoba
kecuali GIF**, dan yang peramban tidak bisa membacanya jatuh ke penanganan galat. `accept` pada
pemilih berkas ikut dibuka ke `image/*`, sebab daftar lama menyembunyikan foto HEIC dari daftar
padahal sekarang semuanya dikonversi ke JPEG.

**Satu putaran mutu tidak cukup.** v1.49 mengecilkan ke 2000 piksel lalu menjajal empat tingkat mutu.
Foto 12 megapiksel yang penuh detail — dedaunan, kerumunan, tulisan kecil — masih di atas 2 MB pada
mutu 0,55, karena yang membuatnya besar bukan mutunya melainkan banyaknya detail yang harus disimpan.
Yang menolong di situ mengecilkan ukurannya, bukan menurunkan mutunya lebih jauh: 0,55 pada 2000
piksel sudah mulai terlihat kotor, sedangkan 0,85 pada 1400 piksel masih bersih. Sekarang empat ukuran
(2000, 1600, 1200, 900) dijajal, masing-masing dengan tiga tingkat mutu.

Kalau semua kombinasi masih di atas batas, yang dikembalikan **hasil terkecil**, bukan berkas aslinya
— supaya angka di pesan penolakan jadi angka yang masuk akal, bukan 34 MB yang membuat orang mengira
tidak terjadi apa-apa. Pesan penolakannya sekarang menyebut sebabnya: GIF, sudah dikecilkan tapi masih
kurang, atau tidak bisa dibaca peramban.

Diuji dengan PNG 4032×3024 berisi derau murni — kasus terburuk, hampir tidak bisa dikompresi:
**34,9 MB → 1,5 MB**. Berkas yang sama dengan tipe `image/heic` dan dengan tipe kosong ikut lulus.

**v1.49** — Gambar dikecilkan sebelum diunggah, dan halaman grup dirombak.

**Gambar dikecilkan di peramban** (`client/src/image.js`). Foto ponsel lazimnya 3–6 MB dan 4000 piksel
lebih di sisi panjangnya, sementara server menolak apa pun di atas 2 MB — artinya jalur yang paling
wajar, memotret lalu menyisipkannya, hampir selalu berakhir ditolak tanpa jalan keluar dari dalam
aplikasi. Sekarang gambarnya digambar ulang ke kanvas dengan sisi panjang dibatasi 2000 piksel lalu
diekspor sebagai JPEG; kalau masih terlalu besar, mutunya diturunkan bertahap (0,85 → 0,55) dan dicoba
lagi. Diuji dengan PNG 4032×3024 sungguhan: **33,9 MB → 1,5 MB**.

Empat keputusan yang mudah salah kalau tidak ditulis: **GIF tidak disentuh** (menggambarnya ke kanvas
hanya menyalin frame pertama, jadi animasinya hilang tanpa peringatan — lebih baik ditolak karena besar
daripada diterima dalam keadaan rusak); **yang sudah di bawah batas dibiarkan** (memproses ulang berkas
yang tidak bermasalah cuma menurunkan mutunya); **latar putih digambar dulu** karena JPEG tidak punya
alfa dan bagian tembus pandang pada PNG akan keluar hitam pekat; dan **kalau pengecilan gagal, berkas
aslinya dikembalikan** supaya server yang menolak dengan pesannya sendiri. Pengecilan yang terjadi
diberitahukan ke pengguna, tidak diam-diam — yang terunggah memang bukan berkas yang ia pilih.

**Halaman grup punya dua bagian: Catatan dan Pengumuman.** Pengumuman masih tempat kosong yang
disiapkan lebih dulu. Rencana "Agenda masuk grup" dibatalkan dan digantikan ini.

**Daftar catatan grup dirombak untuk isi yang banyak.** Bentuk lamanya memakai empat baris per catatan
ditambah avatar dan dua tombol ikon; pada dua puluh catatan itu berarti empat puluh tombol yang hampir
tidak pernah disentuh, semuanya memakan lebar yang dibutuhkan judul, dan layar cuma memuat empat
entri. Sekarang: dua baris per catatan, muat kira-kira dua kali lipat, dan tindakannya pindah ke
tekan-lama seperti kartu tugas (v1.39).

Catatan **dikelompokkan menurut penulis**, kelompok sendiri di puncak, kepala kelompoknya lengket.
Pada isi sebanyak ini "punya siapa" adalah cara orang mengingat isinya, jauh lebih sering daripada
"kapan ditambahkan" yang jadi dasar urutan sebelumnya — dan kelompok memberi mata tempat beristirahat,
sebab daftar rata dua puluh baris terbaca sebagai satu tembok. Nama penulis karenanya hilang dari
barisnya sendiri. **Kolom pencarian** ditambahkan, mencocokkan judul, penulis, dan cuplikan; ia tidak
muncul-hilang mengikuti gulir seperti di daftar catatan pribadi, karena di sini ia satu-satunya cara
menemukan sesuatu.

**v1.48** — Dokumen dikunci mendatar, dan daftar akun berhenti beranimasi.

**`html, body { overflow-x: hidden }`.** Ini kunci ketiga untuk keluhan yang sama. v1.45 mengunci
daerah gulir halaman Pengaturan, v1.47 mengunci halamannya sendiri, dan keduanya tidak
menghentikannya — artinya yang melebar bukan anak halaman itu melainkan sesuatu di luar jangkauan
keduanya. **Saya belum berhasil menunjuk apa.** Yang dilakukan di sini memotong akibatnya, bukan
menghilangkan sebabnya, dan itu ditulis terang-terangan di komentar berkasnya supaya tidak dikira
sudah beres: kalau nanti ada yang terlihat terpotong di tepi kanan, sebabnya masih ada di sana.

Aman terhadap elemen sticky, karena semuanya berada di dalam `.pane`, `.scroll`, atau
`.agenda-daftar` — masing-masing daerah gulirnya sendiri, dan tidak satu pun berpatokan pada gulir
dokumen.

**Daftar akun tidak beranimasi sama sekali,** masuk maupun keluar. v1.47 melepas animasi masuknya
tapi menahan yang keluar; ternyata itu sama janggalnya. Halaman ini dan Pengaturan adalah satu tempat
yang sama dilihat dari dua kedalaman, bukan dua layar yang saling menggantikan. `usePanel` dilepas
seluruhnya dari sana.

**v1.47** — Empat perbaikan navigasi dan tata letak.

**Halaman grup akhirnya berhenti naik ulang saat kembali dari pengaturan grup.** Ini percobaan ketiga,
dan dua yang sebelumnya salah menebak sebabnya. v1.33 dan v1.43 menitipkan penanda lewat state
navigasi, yang hanya sampai kalau yang menavigasi adalah tombol di dalam aplikasi — sedangkan gestur
kembali dan tombol kembali peramban memunculkan lagi entri riwayat lama, yang tidak membawa penanda
apa pun. Sekarang penandanya ditulis ke `sessionStorage` oleh halaman grup itu sendiri, sesaat sebelum
ia pergi ke subhalaman, lalu dibaca dan dihapus saat ia dipasang kembali. Siapa pun yang menavigasi,
penandanya sudah ada di sana. Kunci penandanya menyertakan id grup, sehingga kembali ke grup lain tidak
ikut memakainya.

**Halaman Pengaturan dikunci mendatar di dua lapis.** v1.45 hanya mengunci daerah gulirnya, dan itu
belum cukup: bilah bagian (`.m3-tabs`) berada di luar `.scroll`, jadi apa pun yang melebar di sana
tetap melebarkan halaman. Sekarang `.settings-page` sendiri ikut `overflow: hidden` — ia sudah
`height: 100dvh` dengan anak yang mengurus gulir tegaknya sendiri, jadi tidak ada gulir yang hilang.

**Daftar akun tidak lagi beranimasi saat dibuka.** Ia dijangkau dari sebuah baris di dalam Pengaturan,
dan Pengaturan sendiri sudah masuk dari kanan; menggeser lagi dari arah yang sama membuatnya terbaca
seperti berpindah dua kali untuk satu ketukan. Keluarnya tetap beranimasi, karena di situ layar memang
pergi.

**Keluar dari daftar akun mendarat kembali di "Undang orang"**, bukan di "Keamanan". Bagian itu
satu-satunya jalan menuju daftar akun, jadi mendarat di bagian pertama berarti pengguna harus mencari
jalannya kembali sendiri. `Settings` kini membaca `location.state.section`, mengikuti pola tab yang
sudah dipakai `Home` sejak v1.31.

**v1.46** — Saring catatan menurut tag, dan daftar akun jadi halaman sendiri.

**Tombol saring di samping kolom pencarian**, satu baris, kira-kira 80 : 20. Diketuk, ia membuka
lembar berisi semua tag yang pernah dipakai beserta jumlah catatannya. Pilihannya baru berlaku saat
Terapkan ditekan — bukan demi menghemat permintaan, melainkan karena memilih tiga tag berarti tiga
kali daftar di belakang lembar berubah susunan, dan yang terlihat justru kekacauan. Tombolnya
beraksen selama masih ada tag terpilih; tanpa penanda itu, catatan yang "hilang" akan terbaca sebagai
kerusakan.

Maknanya **"atau"**, bukan "dan": memilih dua tag menampilkan catatan yang punya salah satunya.
Saringan ini untuk melihat lebih banyak, bukan menyempitkan sampai habis — memilih tag kedua yang tak
pernah dipasang bersama tag pertama seharusnya tidak mengosongkan layar. Bisa dipadu dengan kata
kunci; keduanya berlaku bersamaan. `GET /api/notes` menerima `?tag=a,b`, dirapikan dengan aturan yang
sama seperti saat disimpan sehingga `#STEMI` tetap mencocokkan `stemi`.

Penyaringan dilakukan setelah pengambilan, bukan lewat JOIN di kueri utama: kuerinya ada dua bentuk
(dengan dan tanpa kata kunci), dan menyisipkan klausa tag ke keduanya menggandakan tempat yang bisa
salah demi menghemat satu langkah atas paling banyak 200 baris.

**"Orang di aplikasi ini" jadi halaman tersendiri** (`/pengaturan/orang`). Sebagai kartu yang
dibuka-tutup, kolom pencarian dan hasilnya terdorong jauh ke bawah oleh kartu di atasnya, dan
menggulirnya berarti menggulir seluruh halaman Pengaturan. Sekarang pencariannya di puncak dan yang
tergulir hanya daftarnya. Kartunya di Pengaturan tinggal satu baris berisi jumlah akun.

**v1.45** — Tiga perbaikan kecil dan satu tambahan.

**Kilatan biru saat mengetuk, ronde kedua.** v1.37 memasang `-webkit-tap-highlight-color: transparent`
di `html` dengan alasan sifat ini diwariskan; ternyata itu tidak cukup di semua peramban seluler.
Sekarang dipasang lagi lewat pemilih semesta, yang tidak bergantung pada pewarisan sama sekali.
Sekalian, `cursor: pointer` dilepas dari `.pilih-baris` di lembar kolaborasi: barisnya sendiri tidak
bisa diketuk — yang bisa cuma tombol Ajak/Cabut di ujungnya — dan penunjuk tangan pada daerah mati
membuat peramban menganggap seluruh baris itu tempat ketukan, lalu mengecatnya biru.

**Halaman Pengaturan tidak lagi bisa digeser mendatar dan diperkecil.** `.m3-title` adalah wadah flex,
dan isi flex menolak menyempit lebih kecil dari isinya (`min-width: auto`). Satu email panjang tanpa
spasi karenanya melebarkan barisnya, lalu halamannya, lalu seluruh layar — gejalanya jauh dari
sebabnya, dan tidak pernah muncul sampai ada yang mendaftar dengan alamat panjang. Ditambah
`min-width: 0` dan `overflow-wrap: anywhere`, plus `overflow-x: hidden` pada daerah gulir halaman itu
sebagai jaring pengaman — sengaja di `.settings-page .scroll`, bukan di `.app`, supaya tidak mengubah
induk penampung bagi elemen sticky di halaman lain.

**Kartu grup menampilkan jumlah catatan** di samping jumlah anggota. `GET /api/groups` kini ikut
mengembalikan `jumlahCatatan`; catatan yang ada di tempat sampah tidak dihitung.

**v1.44** — Pencadangan (`server/scripts/backup.mjs`).

Satu-satunya item yang risikonya bertambah setiap hari aplikasinya dipakai, dan sampai sekarang tidak
ada sama sekali. Sekali perintah, `npm run backup` di folder `server`, menghasilkan satu folder
bertanggal berisi salinan basis data, arsip gambar, dan `INFO.txt` dengan langkah pemulihannya.

**Berkas `.db` tidak boleh disalin begitu saja.** Basis data ini berjalan dalam mode WAL, jadi
sebagian tulisan terbaru berada di berkas `-wal` yang terpisah. Diuji pada basis data yang sedang
dilayani: `catatan.db` berukuran 462 KB sementara `-wal`-nya 4,1 MB, dan `cp catatan.db` menghasilkan
salinan berisi **245 dari 500 catatan** — lulus `integrity_check`, jadi kerusakannya tidak akan
ketahuan sampai datanya dicari. Skrip ini memakai `VACUUM INTO`, yang menuliskan satu berkas utuh dan
konsisten dari dalam SQLite sendiri; hasilnya 500 catatan, sama persis dengan aslinya, dan aman
dijalankan selagi server melayani permintaan. Sambungannya dibuka baca-saja supaya skrip ini tidak
bisa menyentuh apa pun bahkan tidak sengaja.

**Urutannya disengaja: basis data dulu, gambar sesudahnya.** Kalau ada gambar diunggah di antara
keduanya, ia ikut tersalin tapi tidak dirujuk basis data — berkas nganggur, tidak merusak apa pun.
Urutan sebaliknya menghasilkan kerusakan sungguhan: basis data merujuk gambar yang tidak ada di
cadangan.

Cadangan lama dibuang otomatis; `SIMPAN` menentukan berapa yang ditahan (bawaan 7). Nama foldernya
`TTTT-BB-HH_JJMM`, sehingga urut abjad sama dengan urut waktu.

**v1.43** — Halaman kini juga beranimasi saat keluar.

Sampai v1.42 hanya masuknya yang beranimasi. Keluarnya seketika, karena navigasi langsung melepas
komponennya dari DOM. Hasilnya timpang: halaman datang dengan lembut lalu hilang begitu saja, seolah
tidak pergi ke mana-mana melainkan sekadar berhenti ada. Yang hilang adalah keterangan arah — geseran
keluar itulah yang memberi tahu bahwa layar kembali ke tempat asalnya.

Mesinnya ditaruh di `src/panel.js` sebagai hook `usePanel(arah)`, yang mengembalikan kelas dan sebuah
fungsi `tutup(tujuan)`. Cara kerjanya sama dengan `Sheet` (v1.34), hanya lapisannya berbeda: di sana
yang ditunda pelepasan komponen, di sini perpindahan rute. Kalau gerak dikurangi, penundaannya
dilewati sepenuhnya. Dipakai Pemberitahuan (kiri), Pengaturan (kanan), Pengaturan grup (kanan), dan
halaman catatan grup (naik).

**Pengaturan grup ikut beranimasi masuk,** yang sebelumnya terlewat sama sekali.

**Halaman catatan grup tidak lagi naik ulang saat kembali dari pengaturan grup.** Ini bug yang sama
dengan v1.33 tapi lewat jalur lain: penanda `tanpaAnimasi` sudah dititipkan `NoteEditor`, tapi tidak
oleh `GroupSettings`. Sekarang keduanya menitipkannya. `usePanel` menerimanya lewat opsi `tanpaMasuk`,
yang melewati animasi masuk **tanpa** ikut mematikan animasi keluar — halaman yang dipasang diam-diam
tetap harus pergi dengan bergeser. Karena itu kelas arahnya tetap dipasang saat menutup; tanpa itu
selektor `.panel-kanan.keluar` tidak cocok dengan apa pun dan halamannya hilang seketika.

**v1.42** — Agenda: kepala dan daftar jadi satu kotak.

Di v1.40 kepala "Yang akan datang" masih elemen tersendiri yang kebetulan berada di dekat daftarnya,
dan yang naik menimpa kalender hanya daftarnya. Sekarang keduanya satu lapisan: kepala tinggal di
dalam kotak yang sama, sebab ia judul bagi acara di bawahnya. Kotak itu yang bergerak naik, utuh
bersama judulnya. Kepalanya menempel di puncak lapisan, dan sudut membulatnya diteruskan supaya ia
tidak menutupi lengkungan kotak.

**Tinggi lapisan mengikuti banyaknya acara.** `min-height: 100vh` dari v1.40 dilepas: kalau acaranya
cuma dua, kotaknya memang pendek dan kalender tetap terlihat seluruhnya. Memaksa tinggi layar penuh
hanya menghasilkan ruang kosong yang bisa digulir tanpa ada apa-apa di dalamnya. Konsekuensinya
disengaja — kalender baru benar-benar tertutup kalau acaranya cukup banyak untuk menutupinya.

Kalender kini menempel di `top: 0` karena tidak ada lagi kepala di atasnya, dan variabel
`--agenda-kepala-h` ikut dilepas.

**v1.41** — Perbaikan: seluruh lembar modal kehilangan gayanya.

Gejalanya: tidak ada latar gelap, kartunya tidak membulat, isian menempel ke tepi layar, dan tombol
Batal/Simpan menumpuk alih-alih berjajar. Sebabnya bukan aturan yang salah melainkan berkas yang
hilang — ada **dua berkas berbeda yang sama-sama bernama `sheet.css`**, satu di `styles/components/`
(lembar modal) dan satu di `styles/editor/` (panel catatan). Keduanya sempat dikirim di batch yang
berbeda sebagai "sheet.css", dan yang satu menimpa yang lain.

Yang di penyunting diganti nama jadi `styles/editor/note-panel.css`, sehingga tidak ada lagi dua
berkas bernama sama di seluruh `client/src`. Aturannya sendiri tidak diubah sebaris pun.

**Aturan baru:** tidak boleh ada dua berkas dengan nama sama di seluruh pohon sumber, sekalipun
foldernya berbeda. Berkas dikirim sebagai daftar nama, dan nama yang kembar cepat atau lambat akan
disalin ke tempat yang salah — tanpa galat, tanpa peringatan lint, tanpa build gagal.

**v1.40** — Dua perbaikan: formulir tugas berantakan, dan Agenda ditata ulang lagi.

**Formulir tugas berhenti meminjam kelas milik halaman lain.** Versi v1.39 memakai `.acara-form` dan
`.grup-field`, dan hasilnya bertabrakan: `.grup-field input` memasang `flex: 1` sementara
`.acara-form input` memasang `width: 100%`, jarak bawah isian diatur dua aturan berbeda (18px dan
14px), dan `danger-text` ternyata hanya berlaku untuk `.m3-btn` — pada `.btn` biasa ia tidak
melakukan apa pun, apalagi tokennya `--s-danger` tidak ada di luar `.m3-scope`. Sekarang ada
`.task-form` dan `.task-field` sendiri. `autoFocus` dilepas karena papan ketik yang naik bersamaan
dengan lembar yang sedang beranimasi membuat tata letaknya melompat. Tombol Hapus diratakan sebagai
flex, sebab `.btn` bukan flex dan ikonnya jatuh ke garis dasar yang berbeda dari teksnya.

Pelajarannya dicatat: meminjam kelas milik halaman lain menghemat beberapa baris dan membayarnya
dengan tabrakan yang baru kelihatan di layar, bukan di lint maupun build.

**Agenda: yang bergerak sekarang daftarnya, bukan kalendernya.** v1.33 membuat kalender lengket dan
daftar lewat di belakangnya; v1.34 membalik dan membuat kalender tergulir pergi sambil memudar.
Keduanya salah dalam hal yang sama — yang bergerak selalu kalendernya. Sekarang kalender `sticky`
tepat di bawah kepala sebagai lapisan bawah, dan daftar "yang akan datang" diberi latar padat serta
sudut membulat di atas sehingga ia naik **menimpa** kalender seperti lembar yang ditarik.

`min-height: 100vh` pada lapisan daftar memastikan ia bisa naik sampai menutup kalender sepenuhnya
meski acaranya cuma satu atau kosong; tanpa itu tidak ada yang bisa digulir dan efeknya tidak pernah
terjadi. Pemudaran kalender dipertahankan tapi diturunkan (opacity berhenti di 0,15, blur 6px):
kalender yang tertutup separuh terlihat aneh kalau masih setajam aslinya. Latar daftar harus padat —
kalender ada tepat di belakangnya, dan latar tembus pandang membuat angka tanggal terbaca menembus
acara.

Tinggi kepala hidup di `--agenda-kepala-h`, dideklarasikan di `.agenda`, bukan di `.agenda-kepala`
sendiri: variabel CSS diwariskan ke bawah dan tidak menyeberang ke elemen saudara.

**v1.39** — Fase 5f: tugas jadi barang tersendiri. Fase 5 selesai.

Sampai v1.38 tugas cuma baris `- [ ]` di dalam markdown, dan tab Tugas bekerja dengan menyisir
seluruh catatan. Itu murah dibangun tapi menutup semua yang bukan teks: tugas tidak bisa punya
tenggat, tidak punya tanggal dibuat sendiri, dan tidak bisa disunting tanpa membuka catatan induknya.
Sekarang ada tabel `tugas` dan rute `/api/tasks` tersendiri.

**Ceklis lama tidak dipindahkan dan tidak dihapus.** Ia tetap hidup di dalam catatannya dan tetap
tampil sebagai ceklis di penyunting; yang berubah hanya tab Tugas tidak lagi mengumpulkannya. Karena
tidak ada data yang disentuh, keputusan ini bisa dibatalkan kapan saja tanpa kehilangan apa pun.
Akibatnya `GET /api/notes/tasks/all` dan `POST /api/notes/tasks` kini tidak dipanggil siapa pun —
dibiarkan dulu, bukan dibuang, sampai jelas tidak ada yang merindukannya.

**Kartu, bukan baris.** Judul, tanggal dibuat, isi, lalu tenggat di bawah garis pemisah. Tenggat
dipisah garis alih-alih disandingkan dengan tanggal dibuat karena keduanya menjawab hal yang
berlawanan: satu bercerita dari mana tugas ini datang, satu lagi menuntut sesuatu. Tenggat yang
terlewat berubah merah.

**Menyunting lewat tekan-lama**, bukan ketukan biasa — mencentang selesai adalah hal yang paling
sering dilakukan pada tugas, dan ia tidak boleh kalah cepat dari membuka formulir. Kartunya menciut
sedikit selagi ditekan; tanpa itu tekan-lama terasa tidak berfungsi sampai formulirnya tiba-tiba
muncul. Jari yang bergeser membatalkannya, karena itu tandanya sedang menggulir.

**Bilah "Tambah tugas lalu tekan Enter" dilepas,** diganti fab `Tugas baru` seperti tab lain.
Formulirnya memakai `Sheet` (v1.34), jadi ikut turun saat ditutup. Satu komponen dipakai untuk
membuat maupun mengubah; yang berbeda hanya judul lembar dan adanya tombol hapus.

**Urutannya** belum selesai dulu, lalu tenggat terdekat, lalu terbaru. `tenggat IS NULL` jadi kunci
urut tersendiri supaya tugas tanpa tenggat jatuh ke bawah — SQLite menganggap NULL lebih kecil dari
nilai apa pun, jadi tanpa baris itu tugas tak bertenggat justru menempati posisi paling mendesak.

Di `PATCH`, nilai baru diambil dengan `??` bukan `||`: isi yang sengaja dikosongkan dan
`selesai: false` harus tersimpan, sedangkan `||` mengembalikannya ke nilai lama.

**v1.38** — Fase 5e: tag catatan.

Baris baru di antara judul dan isi penyunting (`components/TagRow.jsx`) memuat tag milik pembaca dan
grup tempat catatan itu terbit. Keduanya disatukan dalam satu deret meski asalnya berbeda: yang
dijawab baris ini satu pertanyaan yang sama — "catatan ini termasuk apa" — dan memisahkannya jadi dua
deret hanya menebalkan ruang antara judul dan kalimat pertama. Bedanya tetap terbaca: tag beraksen
dan bersilang, grup abu-abu tanpa silang, karena grup ditentukan lewat menu catatan di daftar dan
memberi silang yang tidak melakukan apa-apa lebih membingungkan daripada tidak memberinya.

**Tag milik masing-masing orang.** Ia tidak ikut pindah ke grup, dan `PUT /:id/tags` sengaja hanya
menuntut catatannya bisa dibaca — bukan harus milik sendiri. Yang dicatat adalah bagaimana *pembaca*
menandai sesuatu, bukan bagaimana penulisnya menamainya, jadi menandai catatan orang lain untuk
keperluan sendiri itu sah dan tidak terlihat siapa pun.

**Disimpan sebagai tabel kaitan `catatan_tag`,** bukan satu kolom teks dipisah koma. Pertanyaan yang
harus dijawab cepat adalah "catatan apa saja yang bertag X", dan kolom teks memaksa seluruh tabel
dibaca untuk menjawabnya. `user_id` ikut jadi bagian kunci, sehingga dua orang boleh memakai kata
yang sama tanpa saling mengganggu.

**Normalisasi terjadi di server, bukan di peramban** — aturan itulah yang menentukan apakah dua tag
dianggap sama, dan kalau ia hanya ada di klien, permintaan dari mana pun selain layar penyunting akan
menyelundupkan bentuk lain. Huruf dikecilkan, spasi jadi tanda hubung, awalan pagar dilepas, dan
hanya huruf-angka-hubung yang bertahan; hasilnya dipotong 32 huruf, paling banyak 12 tag per catatan.
Klien memasang apa yang dikembalikan server, bukan apa yang diketik, karena bentuk akhirnya bisa
berbeda.

**v1.37** — Kilatan biru bawaan saat mengetuk dimatikan untuk seluruh dokumen.

`-webkit-tap-highlight-color: transparent` sudah ada sejak awal, tapi hanya pada `button` — dan itu
meleset. Kilatannya digambar peramban pada elemen terdekat yang punya penangan klik, bukan pada
elemen yang benar-benar disentuh. Di lembar konfirmasi, elemen itu adalah latar gelapnya, yang
menutupi seluruh layar; jadi mengetuk tombol di dalam lembar membuat satu layar penuh berkedip biru
sementara tombolnya sendiri sudah bersih. Sifat ini diwariskan, jadi dipindah ke `html` sekali dan
menutup semua elemen, termasuk `div` dan `span` yang diberi penangan klik.

**v1.36** — Fase 5d: animasi navigasi, dan dua berkas berganti nama.

**Pemberitahuan masuk dari kiri, Pengaturan dari kanan** (`.panel-kiri`, `.panel-kanan` di
`styles/layout/transitions.css`). Arahnya bukan hiasan: ia mengikuti letak tombol yang membukanya —
lonceng di kiri bilah atas, gerigi di kanan — sehingga layar terasa berpindah ke arah yang sama
dengan jari. Menukar keduanya akan terasa salah, dan itu satu-satunya alasan ada dua kelas.

Keluar tetap seketika, seperti `.panel-naik`. Menahan pelepasan halaman berarti menyalin mesin
penunda milik `Sheet` ke lapisan perutean, dan itu pekerjaan tersendiri.

**Jebakan penyusun:** aturannya harus ditulis sebagai properti panjang
(`animation-duration`, `animation-timing-function`, `animation-fill-mode`), bukan ringkasan
`animation`. Ringkasan tanpa nama animasi disederhanakan penyusun menjadi `animation: none` dan
durasinya ikut hilang, sehingga animasinya diam sama sekali. Ini hanya terlihat di CSS hasil build,
tidak di sumbernya.

**Dua berkas diinggriskan** agar konsisten dengan aturan penamaan: `components/KonfirmasiGrup.jsx`
→ `components/GroupConfirm.jsx` (beserta nama komponennya) dan `styles/layout/transisi.css` →
`styles/layout/transitions.css`. Nama kelas CSS di dalamnya tidak ikut berubah — itu nama domain,
bukan nama berkas.

**v1.35** — Perbaikan: penyunting gagal terbuka pada catatan bertabel.

`RangeError: Block decorations may not be specified via plugins`. Widget tabel dibuat sebagai
`Decoration.replace({ block: true })` dari dalam `livePreview`, dan CodeMirror menolak dekorasi blok
yang datang dari sebuah `ViewPlugin` — bukan karena rewel, melainkan karena tinggi blok ikut
menentukan perhitungan viewport, sedangkan plugin baru dijalankan setelah viewport dihitung. Apa pun
yang mengubah tinggi baris harus berasal dari state.

Widget tabel kini disediakan `tabelBlok`, sebuah `StateField` yang dipasang sebelum `livePreview`;
`livePreview` tetap mengurus sisanya (judul, penanda, ceklis, butir, penandaan baris untuk tabel yang
sedang disunting). Karena state tidak tahu apa-apa soal viewport, `tabelBlok` memindai seluruh
dokumen alih-alih bagian yang terlihat saja — untuk tabel itu murah, sebab yang dicari hanya simpul
`Table` di puncak pohon dan penelusuran berhenti begitu satu ditemukan. Ia dihitung ulang saat isi
berubah **dan** saat kursor berpindah, karena masuk ke dalam tabel menukar widget dengan sintaks
aslinya. Uji kursor itu ditarik jadi satu fungsi bersama, `kursorDiDalamTabel`: kalau kedua sisi
tidak sepakat, sebuah tabel bisa tergantikan widget sekaligus ditandai sebagai teks.

Ini bug lama yang baru terlihat — hanya menyerang catatan yang memuat tabel yang benar-benar terbaca
sebagai tabel, sehingga catatan lain terbuka normal.

**v1.34** — Agenda ditata ulang, dan lembar kini turun saat ditutup.

**Lembar punya animasi keluar.** Selama ini `.sheet` hanya beranimasi saat masuk; menutupnya melepas
komponennya dari DOM, jadi lembarnya lenyap dalam satu frame — terbuka dengan lembut, hilang dengan
kasar. Yang hilang bukan cuma keindahan: gerakan turun itulah yang memberi tahu bahwa lembarnya
kembali ke tempat asalnya dan tidak ada yang berubah, sedangkan lenyap seketika terbaca seperti
sesuatu yang gagal. Komponen baru `components/Sheet.jsx` menunda pelepasan selama animasi turun dan
menyerahkan fungsi `tutup` lewat children, supaya tombol Batal ikut beranimasi — bukan hanya ketukan
di luar lembar. Ia juga mengambil alih penanganan tombol Esc. Kalau pengguna meminta gerak dikurangi,
penundaannya dilewati sama sekali: menunggu selama animasi yang tidak berjalan hanya terasa macet.
Dipakai dua lembar Agenda; lembar lain (`KonfirmasiGrup`, `TableEditor`, konfirmasi hapus di Home)
masih memakai markah lama dan bisa ikut kapan saja.

**Urutan Agenda dibalik dari v1.33.** Dulu kalender yang menempel di puncak dan daftar acara lewat di
belakangnya. Sekarang kepala "Yang akan datang" berada **di atas** kalender dan menempel di puncak,
sementara kalender memudar bertahap sampai tertutup penuh olehnya. Bedanya bukan selera: dengan
urutan ini layar yang tergulir penuh dipakai seluruhnya oleh acara, bukan separuhnya oleh kisi
tanggal yang sudah tidak dilihat lagi.

Pemudarannya digerakkan posisi gulir, bukan `IntersectionObserver` seperti v1.33 — efek bertahap butuh
nilai yang berubah terus-menerus, sedangkan pengamat hanya bisa menjawab "sudah lewat atau belum".
Dua hal menjaga ongkosnya: pembacaan dikumpulkan ke satu `requestAnimationFrame`, dan hasilnya
ditulis sebagai variabel CSS `--pudar` langsung ke elemen. Lewat state React, setiap frame gulir akan
merender ulang seluruh daftar acara. Blur dibatasi 8px karena di atas itu ongkosnya naik tajam di
ponsel sementara bedanya tidak lagi terlihat. Saat gerak dikurangi, pemudarannya dipertahankan —
itulah yang memberi tahu kalendernya pergi — dan hanya blur serta penyusutan yang dilepas.

Catatan penyusun: minifier membuang `backdrop-filter` tanpa awalan dan menyisakan yang `-webkit-`.
Firefox karenanya tidak mengaburkan latar kepala, tapi tetap mendapat latar 86% pekat, jadi teksnya
tetap terbaca di atas kalender yang lewat.

**v1.33** — Fase 5c: poles halaman utama dan Agenda, plus dua perbaikan.

**Perbaikan: halaman grup tidak lagi naik ulang saat keluar dari catatan grup.** `.panel-naik`
terpasang setiap kali halaman itu dipasang, termasuk saat `NoteEditor` kembali ke sana — panelnya
melompat ke bawah lalu naik lagi, padahal yang barusan terjadi adalah menutup sesuatu yang terbuka di
atasnya. `NoteEditor` kini menitipkan penanda lewat state navigasi, dan `GroupNotes` membacanya sekali
saat dipasang.

**Perbaikan: kerangka pemuatan halaman grup berkedip.** Daftar catatannya diambil tanpa
`withMinDelay`, jadi pada sambungan cepat kerangkanya lewat begitu saja dan yang terlihat cuma
kedipan. Sekarang mengikuti jeda minimum yang sama seperti daftar lain sejak v1.7.

**Tarik-untuk-muat-ulang di semua tab.** Sebelumnya hanya Catatan dan Tugas. Panel Grup memuat
datanya sendiri dan tidak ikut `reloadKey`, jadi ia mendapat `refreshGrup` terpisah — menyatukannya
berarti menarik daftar catatan tiap kali orang menyegarkan daftar grup. `Agenda` sekarang merender
pane-nya sendiri lewat `PullRefresh`; fab dan lembar formulirnya sengaja **di luar** komponen itu,
karena isinya digeser dengan `transform` saat ditarik, dan sebuah transform membuat elemen
`position: fixed` di dalamnya berpatokan ke situ alih-alih ke layar — akibatnya tombolnya ikut
melorot mengikuti jari.

**Kalender Agenda menempel dan mengabur** saat daftar "yang akan datang" digulir naik. Yang lengket
kotak kalendernya, bukan seluruh kepala panel, sehingga tanggal yang sedang dilihat tetap terlihat
sementara acaranya lewat di belakangnya. Keadaan menempel dibaca `IntersectionObserver` atas sebuah
penjaga setinggi nol di bawah kisi, bukan kejadian scroll — supaya tidak ada perhitungan di setiap
frame gulir. Peramban tanpa `backdrop-filter` mendapat latar padat lewat `@supports not`, kalau tidak
daftar acaranya terbaca menembus kalender.

**Titik pada tanggal yang sudah lewat dilepas.** Titik itu berarti "ada yang menunggu"; tanggal yang
sudah lewat tidak menunggu apa pun lagi. **Batang gulir di lembar buat/ubah acara disembunyikan** —
gulirnya tetap jalan, yang dilepas hanya penandanya, karena batang tipis yang menempel di tepi kotak
membulat terlihat seperti cacat gambar.

**Animasi saat menyematkan catatan.** Kartu dipudarkan di posisi lamanya, baru daftarnya disusun
ulang, sehingga ia muncul kembali di tempat barunya alih-alih melompat. Yang dianimasikan `opacity`
dan `transform`; lamanya dijaga sama di `PUDAR_MS` (Home.jsx) dan CSS — kalau CSS lebih lambat,
daftar tersusun ulang sementara kartunya masih setengah terlihat, dan yang tampak justru kedipan.

**Lencana grup di kartu catatan jadi ikon saja.** Nama grupnya sudah dipanjangkan di halaman grup,
dan di kartu sempit teks itu memakan ruang yang dibutuhkan judul; yang perlu terbaca sekilas cuma
"ada orang lain yang melihat ini". Namanya tetap ada sebagai `title` dan `aria-label`.

**Kartu "Orang di aplikasi ini" kini tertutup secara bawaan** dan hanya menampilkan jumlah akun.
Diketuk, ia membuka kolom pencarian beserta daftarnya; nama pengguna jadi judul baris dan emailnya
turun ke keterangan. Penyaringan dilakukan di peramban karena seluruh daftar memang sudah diambil
untuk menghitung jumlahnya, jadi mengetik tidak menyentuh jaringan. `GET /api/admin/users` kini ikut
mengembalikan `username`.

**v1.32** — Fase 5b: halaman grup dipecah dua.

`GroupDetail.jsx` memuat empat urusan berbeda dalam satu gulungan — undangan, catatan, anggota,
tombol bubarkan — dan yang paling sering dibuka justru berada di tengah. Sekarang `/grup/:id` adalah
`GroupNotes.jsx` yang hanya berisi catatan grup, dan pengelolaannya pindah ke
`/grup/:id/pengaturan` (`GroupSettings.jsx`), dijangkau lewat tombol gerigi di kanan nama grup.
Lembar konfirmasi ditarik ke `components/KonfirmasiGrup.jsx` karena kini dipakai dua halaman:
mengeluarkan catatan ditanyakan di halaman catatan, sisanya di halaman pengaturan. Konstanta tujuan
"kembali ke tab Grup" pindah ke `src/nav.js` dengan alasan yang sama.

**Token Material 3 dibuka lewat `.m3-scope`.** Kelas `.m3-*` sudah global sejak v1.5; yang mengunci
mereka ke Pengaturan hanyalah tidak adanya nilai `--s-*` di luar sana, sehingga warnanya jatuh ke
kosong. Menambahkan satu selektor pada blok deklarasi token membuat halaman pengaturan grup dan
kartu grup di tab Grup memakai bentuk yang sama tanpa satu pun aturan digandakan. Latar halaman
penuh tetap hanya `.settings-page`, karena `.m3-scope` sering cuma membungkus sepotong halaman.

**Halaman grup naik dari bawah** lewat `.panel-naik` di modul baru `styles/layout/transisi.css`.
Sengaja bukan `.sheet-page`: kelas itu juga memasang gagang seret, mematikan `touch-action` di bilah
atas, dan sejak v1.31 dikecualikan dari `user-select: none` karena isinya tulisan untuk disalin.
Halaman grup tidak menginginkan satu pun dari itu — yang dipinjam hanya cara masuknya.

**Saran orang saat mengundang** (`GET /api/groups/:id/candidates?q=`). Endpoint ini pada dasarnya
membacakan daftar orang yang terdaftar, yaitu hal yang ditutup di v1.17 pada jalur masuk, jadi
batasnya sengaja ketat: pemimpin grup saja, hanya `username` dan hanya dari awal kata, **email tidak
pernah dikembalikan**, minimal dua huruf, maksimal delapan hasil. Yang sudah jadi anggota dan yang
undangannya belum dijawab tidak ditawarkan — mengundang mereka toh akan ditolak, dan menawarkan nama
yang pasti gagal cuma membuang waktu. Konsekuensinya orang yang belum mengisi username tidak muncul
di saran; mengundangnya tetap bisa dengan mengetik alamat email lengkap, dan itu tertulis sebagai
keterangan di bawah isiannya. Di sisi klien kata kuncinya ditahan 250 ms, dan jawaban yang datang
terlambat dibuang lewat penanda urutan — tanpa itu hasil untuk "si" bisa tiba setelah hasil untuk
"sig" dan menimpanya dengan daftar yang lebih lama.

**v1.31** — Fase 5a: dua bug ditutup, dan ESLint dipasang.

**Kembali dari sebuah grup kini mendarat di tab Grup.** Sebelumnya `GroupDetail` memanggil
`navigate('/')` dan `Home` selalu membuka `TAB_CATATAN`, jadi siapa pun yang menekan tombol kembali —
atau baru saja keluar dari grup, atau membubarkannya — menemukan dirinya di tab yang tidak ada
hubungannya dengan tempat ia barusan berada, dan harus menggeser balik satu tab setiap kali. `Home`
sekarang membaca `location.state.tab` sebagai nilai awal `index`, dan `GroupDetail` menyertakannya di
ketiga jalan keluarnya. Bentuknya mengikuti pola `dariGrup` milik `NoteEditor` (v1.26): asal dibawa
lewat state navigasi, bukan disimpan di tempat lain. Nama tab yang tidak dikenali diabaikan diam-diam,
sehingga tautan lama tetap membuka Catatan, bukan halaman kosong.

Penempatan posisi gulir awal ikut disesuaikan. Efeknya berjalan di setiap render, jadi ia memakai
`indexAwal` yang direkam sekali lewat `useRef` — memakai `index` berarti posisi gulir ditetapkan ulang
di tengah geseran jari. Sekalian, tiga indeks tab yang masih ditulis sebagai angka (`index === 0`,
`TABS.length - 1`) diganti konstanta bernama.

**Seleksi teks dimatikan di seluruh halaman utama** (`styles/base/selection.css`). Tekan-lama dipakai
sebagai gerakan sungguhan di aplikasi ini, sementara di peramban ponsel gerakan yang sama berarti
"blokir kata ini" — yang muncul adalah gagang seleksi dan menu salin bawaan, menutupi menu aplikasi
yang justru diminta. v1.10 menambalnya per kartu catatan; sekarang diselesaikan sekali lewat
`.app:not(.sheet-page)`. Penyunting catatan sengaja dikecualikan: di sana isinya tulisan untuk dibaca
dan disalin. Isian, `.preview`, dan `.cm-editor` tetap bisa diseleksi, karena tanpa itu memindahkan
kursor di kolom pencarian terasa rusak. `-webkit-touch-callout` diikutkan karena Safari iOS
memunculkan menu bawaannya lewat jalur terpisah dari `user-select`.

**ESLint dipasang di akar proyek** — `package.json` dan `eslint.config.js` baru, dengan `npm run lint`
yang memeriksa `client/src` dan `server/src` sekaligus. Klien dan server tetap paket terpisah; yang di
akar hanya perkakas. Aturannya sengaja sedikit dan berpusat pada `no-undef`, ditambah `no-unused-vars`
dan segelintir penangkap kesalahan nyata; `react-hooks/rules-of-hooks` galat, `exhaustive-deps` hanya
peringatan karena beberapa efek di proyek ini memang sengaja tidak menyebut seluruh dependensinya.
Kode yang ada lolos tanpa satu pun galat — pemasangannya diuji dengan menyisipkan variabel yang tidak
terdefinisi lebih dulu, untuk memastikan ia benar-benar memeriksa dan bukan diam karena berkasnya
terlewat.

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

**v1.14** — Kolom pencarian tersembunyi secara bawaan: muncul saat menggulir ke arah atas atau kembali
ke puncak daftar, menyingkir saat menggulir ke bawah, dan tetap bisa dibuka lewat ikon cari di bilah atas
(penting untuk layar lebar yang daftarnya tidak cukup panjang untuk digulir). Tarik-untuk-muat-ulang
dengan tarikan elastis: batang membulat memanjang mengikuti jari dengan hambatan menaik lalu melesat
balik memakai kurva yang melewati titik akhir. Hambatannya disetel lewat uji numerik agar ambang tercapai
di sekitar 100px tarikan; nilai awalnya menuntut hampir 180px dan terasa seret.

**v1.15** — Perbaikan dan penyempurnaan tarik-untuk-muat-ulang: tombol cari tidak lagi berkedip saat
gulir mentok (posisi gulir dijepit ke rentang sah, dan pantulan di ujung diabaikan); batang kini hanya
bergaris hijau tanpa isian; batang dipindah ke bawah header panel, dan isi daftar digeser dengan
`transform` mengikuti ujung batang memakai kurva yang sama — transform dipilih agar peramban tidak
menghitung ulang tata letak seluruh daftar di setiap frame.

**v1.16** — Kerangka pemuatan kini ikut tampil setelah tarik-untuk-muat-ulang, dengan jeda minimum yang
sama seperti pemuatan awal. Ditambahkan `CONTEXT.md` sebagai dokumen orientasi sesi lanjutan.

**v1.30** — Perbaikan bug: tombol "Acara baru" di tab Agenda menempel di layar saat digeser ke tab lain.

`.fab` memakai `position: fixed`, jadi posisinya lepas dari `.pane` tempat ia dirender — hanya
soal koordinat layar, tidak peduli pane mana yang sedang terlihat. Fab "Tulis" (Catatan) dan "Grup baru"
(Grup) tidak kena masalah ini karena keduanya dirender di `Home.jsx` sebagai saudara `.pager`, digerbang
`index === TAB_CATATAN` / `index === 0` — otomatis lenyap begitu `index` berubah saat digeser. Fab
"Acara baru" berbeda: ia dirender di dalam `Agenda.jsx` sendiri, dan `Agenda` tidak pernah dilepas dari
DOM setelah tabnya sekali dibuka (`agendaPernahDibuka`) — ia hanya tergulir keluar layar. Hasilnya, fab
tetap tampil menimpa tab manapun yang sedang dilihat pengguna.

Diperbaiki dengan mengikuti pola yang sama seperti dua fab lain: `Home.jsx` mengirim prop `aktif` ke
`<Agenda>` berisi `index === TAB_AGENDA`, dan `Agenda.jsx` hanya merender tombol fab-nya saat `aktif`
bernilai benar. Sheet formulir acara (`FormAcara`) tidak ikut digerbang — itu modal penuh layar yang
memang wajar tetap terbuka walau pengguna sempat menggeser tab lain sebelum menutupnya.

**v1.29** — Penyunting dimuat malas. `Editor.jsx` kini di balik `lazy()` seperti `Preview.jsx`, jadi
CodeMirror (~180 kB terkompresi) tidak lagi ikut terunduh di halaman pertama. Sebelumnya ia bahkan
ter-`modulepreload` di `index.html`, sehingga siapa pun yang cuma membuka daftar catatan tetap membayar
ukurannya. Ini sejalan dengan keputusan lama bahwa catatan dibuka dalam mode baca: penyunting baru
diperlukan setelah ikon pensil ditekan.

Peringatan Vite tentang chunk di atas 500 kB **tetap muncul dan itu wajar** — ambangnya menghitung
ukuran mentah satu chunk, bukan apa yang diunduh di halaman pertama. Chunk `editor` memang 527 kB, tapi
kini hanya diambil saat dibutuhkan.

**v1.28** — Tambah gambar, maksimal 2 MB. Tombol di rail format membuka pemilih berkas; gambarnya
diunggah lalu disisipkan sebagai `![nama](/api/images/ID)`.

Berkasnya disimpan di cakram (`UPLOAD_DIR`, bawaan `./data/uploads`), sedangkan barisnya di tabel
`gambar` hanya keterangan. **Ini mengubah cerita cadangan:** sejak sekarang mencadangkan berkas SQLite
saja tidak lagi cukup, folder unggahan harus ikut.

Izin gambar menumpang catatan tempat ia diunggah, dan dihitung ulang tiap permintaan lewat
`aksesCatatan` — jadi anggota grup yang boleh membaca catatannya otomatis boleh melihat gambarnya, dan
kehilangan akses begitu catatan itu keluar dari grup.

Jenis berkas ditentukan dari beberapa byte pertama isinya (`src/imagetype.js`), bukan dari header
`Content-Type` yang datang dari klien dan bisa diisi apa saja. **SVG sengaja ditolak:** ia dokumen XML
yang bisa memuat skrip, dan menyajikannya dari domain sendiri berarti membuka jalan skrip pihak ketiga.
Yang diterima hanya PNG, JPEG, GIF, dan WebP.

Batas 2 MB dijaga `express.raw` sebelum satu byte pun menyentuh cakram, dengan penangan galat sendiri
supaya jawabannya 413 beserta pesan yang jelas, bukan 500. Klien juga memeriksanya lebih dulu agar kuota
data penggunanya tidak terbuang. Pembersihan berkala kini ikut menghapus berkas gambar yang catatannya
sudah lenyap setelah 30 hari.

**v1.27** — Kurung menutup sendiri, dan saran sebutan muncul saat mengetik.

`closeBrackets()` dari `@codemirror/autocomplete` memasangkan `(`, `[`, `{`, dan kutip. Paketnya sudah
ada sebagai dependensi turunan, tapi kini didaftarkan eksplisit di `package.json` — bersandar pada paket
yang kebetulan terbawa itu rapuh. **Jalankan `npm install` di `client` setelah menarik perubahan ini.**

Mengetik `[[` lalu satu huruf memunculkan daftar judul. Pencocokannya tidak harfiah: huruf yang diketik
cukup muncul berurutan di dalam judul, jadi "efpl" menemukan "Efusi Pleura" dan "vp" menemukan "Visite
Pagi". Judul yang cocok di awal tetap diletakkan teratas supaya mengetik lengkap tidak kalah oleh
kecocokan kebetulan. Yang dicari hanya judul, bukan isi catatan. Di dasar daftar selalu ada "Buat
catatan …" yang membuat catatan kosong berjudul apa yang sedang diketik, lalu menyisipkan sebutannya —
catatan baru itu langsung masuk indeks tanpa memuat ulang halaman.

Penyisipan memeriksa apakah `]]` sudah dipasang penutupan otomatis, jadi tidak pernah muncul `]]]]`.
`closeBracketsKeymap` dan `completionKeymap` dipasang pada `Prec.high` agar mendahului keymap bawaan:
Backspace menghapus sepasang kurung sekaligus, dan Enter memilih saran alih-alih menyisipkan baris baru
saat daftarnya terbuka. Saran dibatasi hanya untuk sebutan lewat `override`, supaya CodeMirror tidak
ikut menawarkan kata dari dokumen saat menulis biasa.

**v1.26** — Sebut catatan lain, gaya Obsidian. `[[Judul catatan]]` menjadi tautan di pratinjau; diketuk
akan membuka catatan itu tanpa memuat ulang halaman. Pemilih di rail format menulis `[[Judul|id]]`,
sehingga tautannya tetap benar bila judulnya berubah kemudian. Yang tidak dikenali dibiarkan apa adanya
sebagai teks — lebih jujur daripada tautan yang tidak menuju ke mana-mana.

Ditulis sebagai plugin remark (`src/wikilink.js`), bukan penggantian teks dengan regex sebelum render.
Regex tidak bisa membedakan `[[...]]` yang ditulis sebagai isi tulisan dari yang berada di dalam blok
kode atau kode sebaris; pohon markdown sudah memisahkan keduanya. `GET /api/notes/index` menyediakan id
dan judul catatan yang boleh dibaca, termasuk catatan grup, jadi sebutan bisa menunjuk tulisan orang
lain di grup yang sama. Gayanya dipasang lewat pemilih atribut `a[href^='/catatan/']` karena
rehype-sanitize membuang atribut `class` dari `<a>`.

Sekalian: catatan yang dibuka dari halaman grup kini kembali ke grup itu saat penyunting ditutup, bukan
ke daftar catatan pribadi yang tidak memuatnya. Asalnya dibawa lewat state navigasi dan diteruskan saat
sebuah sebutan membuka catatan berikutnya, supaya rantainya tidak putus. State hilang bila halaman
dimuat ulang; dalam hal itu tujuannya kembali ke beranda.

**v1.25** — Bagikan catatan sebagai PDF. Ikon printer di bilah atas penyunting membuka dialog cetak
peramban; di Android dan iOS pilihannya "Simpan sebagai PDF", lalu bisa dibagikan seperti berkas lain.
Tidak dirender di server — itu berarti memasang Chromium di VPS demi satu fitur, sementara peramban di
tangan penggunanya sudah bisa melakukannya.

Yang dicetak adalah pratinjau, bukan markdown mentah, jadi mode baca dinyalakan dulu bila sedang
menulis, dan cetak ditunda sampai pratinjau yang dimuat malas selesai terpasang. `styles/print.css`
diimpor paling akhir agar menang kaskade: tinggi setinggi layar dan gulir di dalamnya dilepas — tanpa
itu yang tercetak hanya sepotong yang kebetulan terlihat — perkakas layar disembunyikan, judul tetap
berupa `input` supaya nilainya selalu terbaru tapi tampil sebagai judul biasa, dan pemenggalan halaman
dijaga agar judul tidak tertinggal di kaki halaman serta baris tabel tidak terbelah.

**v1.24** — Agenda. Tab keempat kini berisi kisi kalender bulanan di dalam kotak, dengan daftar acara
yang belum lewat di bawahnya; mengetuk sebuah tanggal menyaring daftarnya ke tanggal itu.

Tabel `acara` menyimpan tanggal dan jam sebagai **teks lokal** (`TTTT-BB-HH` dan `JJ:MM`), bukan
penanda waktu UTC. Yang dicatat adalah tanggal kalender, dan menyimpannya sebagai instan membuat acara
pagi hari bergeser ke tanggal sebelumnya begitu ada pembacaan beda zona. Jam boleh dikosongkan — artinya
sepanjang hari.

Pengulangan tidak aktif secara bawaan, tapi bisa dipilih: harian, mingguan, bulanan, tahunan, dengan
tanggal berhenti opsional. Aturannya disimpan sebagai satu baris, lalu disebar saat dibaca dalam
rentang yang diminta (`server/src/recurrence.js`) — tanpa batas rentang, pengulangan tanpa tanggal
akhir tidak akan pernah selesai dihitung. Bulan yang tidak punya tanggalnya **dilewati, bukan digeser**:
acara tanggal 31 tidak muncul di Februari, dan 29 Februari hanya muncul di tahun kabisat. Menggesernya
ke tanggal terdekat berarti mengarang jadwal yang tidak pernah dibuat penggunanya.

Menyunting atau menghapus acara berulang berlaku untuk seluruh kemunculannya. Mengubah satu kemunculan
saja menuntut penyimpanan daftar pengecualian, dan itu belum ada.

**v1.23** — Penomoran daftar dijaga tetap urut, dan indentasi ikut menomori ulang.

Markdown mengabaikan angka yang ditulis: `1. 3. 7.` tetap tampil 1, 2, 3 di pratinjau. Teks sumber dan
hasilnya jadi berbeda — angka melompat di penyunting, rapi di pratinjau. Modul baru `cm/numbering.js`
menyamakan keduanya dengan menulis ulang angkanya. Tiap tingkat indentasi punya hitungannya sendiri dan
selalu mulai dari 1, jadi baris yang di-indent menjadi anak bernomor 1, lalu 2, sampai tingkat berapa pun.

Dipasang di dua tempat. `changeIndent` menomori ulang dalam transaksi yang sama setelah barisnya
bergeser. Dan sebuah `transactionFilter` di `Editor.jsx` menjalankannya tiap kali susunan baris berubah
— baris dihapus, Enter, atau tempelan banyak baris. Mengetik huruf biasa tidak memicunya, supaya angka
yang sedang diketik tidak ditimpa di tengah jalan; urung dan ulang juga dilewati, karena Ctrl+Z harus
mengembalikan teks apa adanya. Isi blok kode berpagar tidak disentuh.

**v1.22** — Kolaborasi dan penjaga versi.

Izin menyunting catatan orang lain hidup di `catatan_kolaborator`. Pemimpin grup **mengusulkan**,
penulisnya **menyetujui** lewat pemberitahuan — tidak ada tulisan yang bisa disunting orang lain tanpa
sepengetahuan penulisnya. Bila pengusulnya kebetulan penulis sendiri, izinnya langsung berlaku tanpa
usulan. Kolaborator boleh membaca dan menulis, tapi tidak menghapus, menyematkan, atau mengatur grup
catatan itu. Kolom `notifikasi.target_id` menyimpan orang yang dibicarakan usulan, berbeda dari pengirim
dan penerimanya.

Kolom `notes.version` naik tiap penyimpanan. `PATCH /api/notes/:id` yang menyertakan `version` basi
dibalas **409** beserta salinan terbaru dari server, dan penyunting menampilkan kedua versi
berdampingan supaya penggunanya memilih, bukan kehilangan tulisan diam-diam. Permintaan tanpa `version`
tetap diterima demi kompatibilitas.

Satu lubang ditemukan lewat pengujian dan ditutup di versi yang sama: izin kolaborasi dulu diperiksa
sebelum keanggotaan grup, sehingga seseorang yang sudah keluar grup — atau catatan yang sudah
dikeluarkan dari grup — masih bisa disunting. Sekarang `aksesCatatan` memastikan lebih dulu bahwa
catatan dan orangnya masih berbagi grup; baru setelah itu ditentukan `tulis` atau `baca`. Grup adalah
wadah yang membuat berbagi mungkin, jadi hilangnya wadah menggugurkan kedua izin sekaligus.

**v1.21** — Catatan bisa disimpan ke grup, dan berkas rute dinamai ulang ke Bahasa Inggris.

Tabel `grup_catatan` mengaitkan catatan ke grup tanpa menyalinnya — satu catatan boleh berada di banyak
grup, dan mengeluarkannya tidak menghapus apa pun. Seluruh pertanyaan izin dijawab satu fungsi di
`server/src/access.js`: pemilik boleh segalanya, sesama anggota grup hanya membaca, selain itu tidak ada
akses. `GET /api/notes/:id` kini melayani catatan orang lain dengan `bisaSunting: false` dan nama
penulisnya; `PATCH` dan `DELETE` tetap terkunci ke pemilik lewat `WHERE user_id = ?` yang tidak diubah.

Pintu masuknya lewat menu tekan-lama di kartu catatan — "Simpan ke grup" membuka daftar centang, dan
seluruh daftar dikirim sekaligus lewat `PUT /api/notes/:id/groups`, bukan tambah-hapus satu per satu.
Kartu catatan yang sedang berada di grup mendapat penanda beraksen; tab Catatan tetap berisi catatan
sendiri saja. Membuka catatan orang lain menyembunyikan tombol sunting, semat, dan hapus, dengan
keterangan penulisnya di bilah atas.

Berkas rute dan halaman dinamai dalam Bahasa Inggris (`group.js`, `notification.js`, `GroupDetail.jsx`,
`Notification.jsx`, `group.css`), begitu pula jalur API (`/api/groups`, `/api/notifications`, beserta
segmen `invite`, `leave`, `members`, `leader`, `count`, `read`, `accept`, `reject`). Rute yang dilihat
pengguna tetap Bahasa Indonesia (`/grup/:id`, `/notifikasi`), mengikuti `/pengaturan` dan `/catatan/:id`
yang sudah ada. Nama tabel tidak ikut diubah karena datanya sudah ada di produksi.

**v1.20** — Grup dan pemberitahuan. Tabel `grup`, `grup_anggota`, dan `notifikasi`; rute `/api/grup`
dan `/api/notifikasi`. Grup punya satu pemimpin yang berwenang mengundang, mengeluarkan, mengalihkan
jabatan, dan membubarkan; pemimpin tidak bisa keluar begitu saja karena grup tanpa pemimpin tidak punya
siapa pun yang bisa mengelolanya. Undangan dikirim lewat nama pengguna atau email, tiba sebagai
pemberitahuan, dan baru menjadi keanggotaan setelah diterima. Ikon lonceng menggantikan tulisan
"Catatan" di kiri bilah atas, dengan titik hijau kecil saat ada yang belum dilihat; jumlahnya diperiksa
saat halaman dibuka dan tiap kali tab kembali aktif. Panel Grup dimuat saat pertama kali dikunjungi,
bukan bersama Catatan dan Tugas.

**v1.19** — Halaman utama jadi empat tab: Grup, Catatan, Tugas, Agenda. Grup dan Agenda masih panel
kosong; isinya menyusul. Tab yang aktif menampilkan ikon beserta teksnya, sisanya ikon saja. Penanda
geser `.thumb` dilepas karena lebarnya dihitung dengan persen dan itu hanya sahih saat semua tab sama
lebar — sekarang tombol aktif sendiri yang jadi penanda, melebar lewat animasi `flex-grow` (`width:
auto` tidak bisa ditransisikan). Urutan DOM menaruh Grup paling kiri, jadi posisi gulir pager
ditempatkan ke panel Catatan di `useLayoutEffect` sebelum lukisan pertama, dengan `scroll-snap`
dimatikan sekejap karena ia menolak penetapan `scrollLeft` langsung.

**v1.18** — Profil pengguna: `username` dan `birthdate` di tabel `users`, `PATCH /api/auth/profile`,
dan barisnya di kartu Akun pada Pengaturan → Keamanan yang membuka dialog Edit profil. Username
dinormalkan ke huruf kecil, dibatasi 3–20 karakter (huruf kecil, angka, titik, garis bawah, dengan
huruf atau angka di kedua ujung), dan wajib unik. Tanggal lahir divalidasi sebagai tanggal sungguhan —
`1998-02-31` ditolak, bukan digeser ke Maret seperti perilaku bawaan `Date`.

**v1.17** — Persiapan multi-pengguna, tahap nol: pengiriman email diaktifkan dan salah konfigurasi
dibuat terlihat. Sambungan SMTP diuji saat start (`verifikasiSmtp`), dan server mencetak peringatan
`[konfigurasi]` untuk `APP_URL` yang masih `http://` di produksi, `API_URL` yang terisi padahal satu
origin, `ADMIN_EMAIL` kosong, serta `client/dist` yang belum dibangun. Sekalian ditutup satu kebocoran
enumerasi akun: `POST /api/auth/login` dulu membalas 502 kalau pengiriman email gagal, sehingga email
terdaftar bisa dibedakan dari yang tidak lewat kode statusnya; sekarang kegagalan hanya dicatat ke log
dan jawabannya tetap seragam.