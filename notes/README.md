# Catatan

Aplikasi catatan berbasis web. Menulis dengan markdown yang langsung tampil bergaya, setiap baris ceklis
otomatis terkumpul jadi satu daftar tugas, dan akses dibatasi lewat undangan.

- **Antarmuka:** React + Vite, CodeMirror 6, mobile-first
- **Server:** Express + SQLite (better-sqlite3)
- **Masuk:** tautan sekali pakai lewat email — tanpa kata sandi

## Jalankan di komputer sendiri

```bash
# 1. Server
cd server
npm install
cp .env.example .env       # isi ADMIN_EMAIL dengan emailmu
npm run dev                # http://localhost:3000

# 2. Antarmuka (terminal lain)
cd client
npm install
npm run dev                # http://localhost:5173
```

Tanpa pengaturan SMTP, tautan masuk **dicetak ke log server**. Buka terminal server, salin tautannya,
tempel di peramban. Ini cukup untuk pengembangan.

## Cara pakai

1. Buka `/login`, masukkan email admin, lalu buka tautan yang dikirim.
2. Sebagai admin, masuk ke ikon gir → **Buat undangan**. Isi email untuk mengirim langsung, atau kosongkan
   untuk mendapat tautan yang bisa kamu bagikan lewat WhatsApp.
3. Penerima membuka tautan, mengisi email, lalu masuk lewat tautan yang dikirim ke email itu.

## Menulis

Editor memakai pratinjau langsung: tanda markdown disembunyikan dan teks tampil sudah tergaya, tapi begitu
kursor masuk ke suatu baris, sintaks aslinya muncul lagi supaya bisa disunting. Tabel dan blok kode
ditampilkan rapi dalam mode **Baca** (ikon mata di kanan atas).

Rail di bawah layar berisi tombol format — geser ke samping untuk melihat semuanya. Tombol paling kiri
membuka baris template: rencana harian, ceklis, catatan rapat, catatan SOAP, tabel, dan jurnal bacaan.

Ceklis `- [ ]` bisa diketuk langsung di editor. Semua ceklis dari seluruh catatan muncul di tab **Tugas**,
dan mencentangnya di sana ikut mengubah catatan asalnya.

## Keamanan

| Lapisan | Penerapan |
| --- | --- |
| Sesi | Token acak 256-bit di cookie `httpOnly`, `Secure`, `SameSite=Lax`. Hanya hash SHA-256 yang disimpan di basis data. |
| Masuk | Tautan sekali pakai, berlaku 15 menit, dihapus setelah dipakai. Tidak ada kata sandi yang bisa bocor. |
| Enumerasi akun | Endpoint masuk selalu menjawab sama, baik email terdaftar maupun tidak. |
| CSRF | Semua permintaan yang mengubah data wajib membawa header `X-Requested-With`, yang tidak bisa dipasang form HTML lintas situs. |
| Rate limit | 5 percobaan masuk per IP per 15 menit, 10 penerimaan undangan per jam, 300 permintaan API per menit. |
| Injeksi SQL | Semua kueri memakai *prepared statement*; pencarian meng-escape `%`, `_`, dan `\`. |
| XSS | Markdown dirender lewat `rehype-sanitize` dengan skema ketat; protokol tautan dibatasi `http`, `https`, `mailto`. |
| Header | Helmet: CSP tanpa `script-src` inline, `frame-ancestors 'none'`, HSTS saat produksi. |
| Otorisasi | Setiap kueri catatan disaring dengan `user_id`, sehingga catatan orang lain tidak bisa diakses lewat tebakan ID. |
| Undangan | Token 7 hari, sekali pakai, opsional dikunci ke satu alamat email. |
| Pencabutan akses | Admin bisa mencabut akses; seluruh sesi pengguna itu langsung dihapus. |

Yang **belum** ada dan sebaiknya kamu tambahkan sebelum dipakai serius: cadangan otomatis berkas SQLite,
dan enkripsi cakram di server.

## Deploy

```bash
cd client && npm run build          # menghasilkan client/dist
cd ../server
NODE_ENV=production APP_URL=https://catatan.domainmu.id npm start
```

Server otomatis melayani `client/dist` bila ada, jadi antarmuka dan API berbagi satu origin. Saat produksi,
kosongkan `API_URL` agar mengikuti `APP_URL`.

Contoh unit systemd:

```ini
[Unit]
Description=Catatan
After=network.target

[Service]
WorkingDirectory=/srv/catatan/server
EnvironmentFile=/srv/catatan/server/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
User=catatan
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/srv/catatan/server/data

[Install]
WantedBy=multi-user.target
```

Contoh Nginx (letakkan di belakang HTTPS, mis. Certbot):

```nginx
server {
  server_name catatan.domainmu.id;
  client_max_body_size 2m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Server sudah memakai `trust proxy = 1`, jadi rate limit membaca IP asli dari `X-Forwarded-For`.

## Struktur

```
server/src/
  index.js         middleware keamanan, penyajian antarmuka
  db.js            skema SQLite dan pembersihan token kedaluwarsa
  security.js      sesi, hashing token, guard CSRF dan peran
  mailer.js        pengiriman email (fallback ke log)
  routes/auth.js   masuk, undangan, admin
  routes/notes.js  CRUD catatan dan agregasi tugas
client/src/
  cm/livePreview.js  dekorasi CodeMirror untuk pratinjau langsung
  cm/actions.js      perintah format markdown
  components/        Editor, FormatRail, Preview
  pages/             Home, NoteEditor, Login, Invite, Settings
  templates.js       template siap pakai
  styles.css         token desain dan seluruh gaya
```
