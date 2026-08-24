import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../security.js';

export const holidaysRouter = Router();
holidaysRouter.use(requireAuth);

/**
 * Sumber data hari libur nasional.
 *
 * Tanggalnya sengaja tidak pernah ditulis di dalam kode: Idul Fitri, Nyepi, dan
 * Waisak bergeser tiap tahun mengikuti kalender Hijriah, Saka, dan lunar, dan
 * cuti bersama ditetapkan pemerintah lewat SKB yang kadang berubah di tengah
 * tahun. Apa pun yang ditulis sekarang akan salah dalam dua belas bulan, dan
 * salahnya diam-diam — tidak ada yang gagal, cuma tanggalnya keliru.
 *
 * Dipakai api-harilibur, yang menyediakan tiga domain cermin untuk layanan yang
 * sama. Ketiganya dicoba berurutan: layanan gratis mati bukan kejadian langka,
 * dan tiga alamat berarti tiga kesempatan sebelum menyerah ke singgahan.
 * Bisa diganti lewat `HOLIDAY_API` di .env kalau suatu saat sumbernya berpindah.
 */
const SUMBER = (process.env.HOLIDAY_API || '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

const CERMIN = SUMBER.length
  ? SUMBER
  : [
      'https://api-harilibur.vercel.app/api',
      'https://api-harilibur.pages.dev/api',
      'https://api-harilibur.netlify.app/api',
    ];

/** Singgahan dianggap segar selama tujuh hari. */
const SEGAR_MS = 7 * 24 * 60 * 60 * 1000;

/** Batas menunggu satu cermin sebelum pindah ke berikutnya. */
const TIMEOUT_MS = 6000;

/**
 * Batas besar jawaban yang mau dibaca.
 *
 * Satu bulan berisi paling banyak segelintir hari libur, jadi jawaban yang
 * wajar cuma ratusan byte. Batas ini bukan untuk kasus wajar melainkan untuk
 * kasus buruk: layanan gratis pihak ketiga bisa berpindah tangan, disusupi,
 * atau sekadar mengembalikan halaman galat raksasa. Tanpa batas, `res.json()`
 * akan menelan berapa pun yang dikirim ke dalam memori server ini.
 */
const BATAS_JAWABAN = 256 * 1024;

/**
 * Membaca badan jawaban dengan batas, lalu mengurainya sebagai JSON.
 *
 * `res.json()` sengaja tidak dipakai: ia membaca sampai habis tanpa bertanya
 * berapa panjangnya. Di sini potongannya dihitung sambil jalan dan sambungannya
 * diputus begitu melewati batas.
 */
async function bacaJson(res) {
  const panjangDilapor = Number(res.headers.get('content-length') || 0);
  if (panjangDilapor > BATAS_JAWABAN) throw new Error('jawaban terlalu besar');

  const pembaca = res.body?.getReader();
  if (!pembaca) throw new Error('jawaban tanpa badan');

  const potongan = [];
  let total = 0;
  for (;;) {
    const { done, value } = await pembaca.read();
    if (done) break;
    total += value.length;
    if (total > BATAS_JAWABAN) {
      await pembaca.cancel();
      throw new Error('jawaban terlalu besar');
    }
    potongan.push(value);
  }

  return JSON.parse(Buffer.concat(potongan).toString('utf8'));
}

/**
 * Mengambil hari libur **setahun penuh** sekali jalan.
 *
 * Sumbernya menerima `?year=` tanpa `month`, dan setahun hanya berisi belasan
 * baris — sama murahnya dengan meminta satu bulan. Karena itu yang diminta
 * selalu setahun, lalu dipecah ke dua belas baris singgahan sekaligus.
 *
 * Bedanya terasa saat menggeser bulan: dulu tiap bulan baru berarti satu
 * permintaan keluar dan satu jeda menunggu. Sekarang bulan pertama yang dibuka
 * membayar ongkosnya untuk sebelas bulan sisanya, dan sisa tahun itu terbuka
 * seketika.
 */
async function ambilDariLuar(tahun) {
  let galatTerakhir = null;

  for (const dasar of CERMIN) {
    try {
      // AbortSignal.timeout dipakai supaya satu cermin yang menggantung tidak
      // menahan permintaan penggunanya sampai peramban menyerah sendiri.
      const res = await fetch(`${dasar}?year=${tahun}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);

      const isi = await bacaJson(res);
      if (!Array.isArray(isi)) throw new Error('bentuk jawaban tidak dikenali');

      /*
       * Hanya libur nasional yang diambil. Sumber ini juga memuat hari raya
       * daerah Bali (`is_national_holiday: false`), dan itu bukan tanggal merah
       * bagi sebagian besar orang yang memakai aplikasi ini — menampilkannya
       * sebagai merah akan salah memberi tahu siapa pun di luar Bali.
       */
      return isi
        .filter((h) => h?.is_national_holiday && /^\d{4}-\d{1,2}-\d{1,2}$/.test(h.holiday_date || ''))
        .map((h) => {
          // Sumbernya kadang menulis "2026-1-1" tanpa nol di depan; disamakan
          // di sini supaya klien bisa membandingkannya sebagai teks biasa.
          const [t, b, hh] = h.holiday_date.split('-');
          return {
            tanggal: `${t}-${b.padStart(2, '0')}-${hh.padStart(2, '0')}`,
            nama: String(h.holiday_name || 'Hari libur').slice(0, 120),
          };
        })
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    } catch (err) {
      galatTerakhir = err;
    }
  }

  throw galatTerakhir || new Error('semua cermin gagal');
}

/**
 * Hari libur nasional pada satu bulan.
 *
 * Selalu membalas 200 selama masih ada sesuatu yang bisa diberikan, termasuk
 * singgahan yang sudah basi atau daftar kosong. Kalender yang kehilangan
 * tanggal merahnya masih berguna; kalender yang gagal dimuat tidak.
 */
holidaysRouter.get('/', async (req, res) => {
  const bulan = String(req.query.bulan || '');
  if (!/^\d{4}-\d{2}$/.test(bulan)) {
    return res.status(400).json({ error: 'Bulan harus berbentuk TTTT-BB.' });
  }

  /*
   * Rentang tahun dibatasi.
   *
   * Bentuk TTTT-BB saja tidak cukup: siapa pun yang sudah masuk bisa meminta
   * sepuluh ribu bulan berbeda, dan tiap bulan yang belum tersinggah memicu
   * satu permintaan keluar ke layanan pihak ketiga. Itu menjadikan server ini
   * pengeras serangan terhadap layanan orang lain, dan mengisi tabel `libur`
   * dengan baris yang tidak akan pernah dilihat siapa pun.
   *
   * Lima tahun ke belakang dan ke depan jauh melebihi apa yang bisa dijangkau
   * dengan menggeser bulan di kalender, dan sumbernya sendiri hanya menyediakan
   * data untuk tahun berjalan dan berikutnya.
   */
  const tahunMinta = Number(bulan.slice(0, 4));
  const bulanMinta = Number(bulan.slice(5, 7));
  const tahunKini = new Date().getFullYear();
  if (bulanMinta < 1 || bulanMinta > 12) {
    return res.status(400).json({ error: 'Bulan harus antara 01 dan 12.' });
  }
  if (Math.abs(tahunMinta - tahunKini) > 5) {
    return res.json({ libur: [], sumber: 'di-luar-rentang' });
  }

  const baris = db.prepare('SELECT * FROM libur WHERE bulan = ?').get(bulan);
  const segar = baris && Date.now() - Date.parse(baris.diambil_at) < SEGAR_MS;
  if (segar) return res.json({ libur: JSON.parse(baris.data), sumber: 'singgahan' });

  const tahun = bulan.slice(0, 4);
  try {
    const setahun = await ambilDariLuar(tahun);

    /*
     * Seluruh dua belas bulan ditulis, bukan hanya yang diminta — termasuk
     * bulan yang tidak punya libur sama sekali, yang disimpan sebagai daftar
     * kosong. Baris kosong itu penting: tanpanya, bulan tanpa libur akan
     * terlihat seperti "belum pernah diambil" dan memicu permintaan keluar
     * setiap kali dibuka, selamanya.
     */
    const perBulan = new Map();
    for (let b = 1; b <= 12; b++) perBulan.set(`${tahun}-${String(b).padStart(2, '0')}`, []);
    for (const l of setahun) {
      const kunci = l.tanggal.slice(0, 7);
      if (perBulan.has(kunci)) perBulan.get(kunci).push(l);
    }

    const now = new Date().toISOString();
    const simpan = db.prepare(
      `INSERT INTO libur (bulan, data, diambil_at) VALUES (?, ?, ?)
       ON CONFLICT(bulan) DO UPDATE SET data = excluded.data, diambil_at = excluded.diambil_at`
    );
    db.transaction(() => {
      for (const [b, isi] of perBulan) simpan.run(b, JSON.stringify(isi), now);
    })();

    res.json({ libur: perBulan.get(bulan) || [], sumber: 'luar' });
  } catch {
    // Singgahan basi lebih baik daripada tidak ada: hari libur tidak berubah
    // sesering itu, dan yang tersimpan minggu lalu hampir pasti masih benar.
    if (baris) return res.json({ libur: JSON.parse(baris.data), sumber: 'singgahan-basi' });
    res.json({ libur: [], sumber: 'gagal' });
  }
});