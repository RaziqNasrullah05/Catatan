/**
 * Penomoran ulang daftar bernomor.
 *
 * Markdown mengabaikan angka yang ditulis: `1. 3. 7.` tetap tampil sebagai 1, 2, 3
 * di pratinjau. Akibatnya teks sumber dan hasilnya bisa berbeda — angka melompat
 * di penyunting, rapi di pratinjau — dan itu membingungkan saat menulis.
 *
 * Modul ini menyamakan keduanya dengan menulis ulang angkanya menjadi urutan
 * logis. Setiap tingkat indentasi punya hitungannya sendiri dan selalu mulai
 * dari 1, jadi baris yang di-indent menjadi anak yang bernomor 1, lalu 2, dan
 * seterusnya sampai tingkat berapa pun.
 *
 * Fungsinya sengaja murni — masuk teks, keluar teks — supaya bisa diuji tanpa
 * menjalankan CodeMirror.
 */

const ITEM_BERNOMOR = /^([ \t]*)(\d+)([.)])([ \t]+)(.*)$/;
const ITEM_BULAT = /^([ \t]*)[-*+][ \t]+/;
const PAGAR = /^[ \t]*(```|~~~)/;

/** Tab dihitung setara dua spasi, sama seperti INDENT di actions.js. */
function lebarIndentasi(spasi) {
  let n = 0;
  for (const c of spasi) n += c === '\t' ? 2 : 1;
  return n;
}

/**
 * Mengembalikan larik berisi teks pengganti untuk tiap baris, atau `null` bila
 * baris itu tidak berubah. Pemanggilnya yang memutuskan cara menerapkannya.
 */
export function hitungPenomoran(baris) {
  const hasil = new Array(baris.length).fill(null);

  // Kunci: lebar indentasi. Nilai: nomor terakhir yang dipakai di tingkat itu.
  let hitungan = new Map();
  let dalamKode = false;

  const buangLebihDalam = (lebar) => {
    for (const kunci of [...hitungan.keys()]) {
      if (kunci > lebar) hitungan.delete(kunci);
    }
  };

  for (let i = 0; i < baris.length; i++) {
    const teks = baris[i];

    // Isi blok kode adalah teks apa adanya — sebuah baris `1. foo` di dalamnya
    // mungkin justru kode yang sedang ditulis, bukan daftar.
    if (PAGAR.test(teks)) {
      dalamKode = !dalamKode;
      continue;
    }
    if (dalamKode) continue;

    // Baris kosong tidak memutus daftar: markdown mengizinkan daftar renggang.
    if (!teks.trim()) continue;

    const bernomor = teks.match(ITEM_BERNOMOR);
    if (bernomor) {
      const [, spasi, , tanda, jarak, isi] = bernomor;
      const lebar = lebarIndentasi(spasi);

      // Tingkat yang lebih dalam sudah selesai begitu kita kembali ke luar.
      buangLebihDalam(lebar);

      const nomor = (hitungan.get(lebar) ?? 0) + 1;
      hitungan.set(lebar, nomor);

      const baru = `${spasi}${nomor}${tanda}${jarak}${isi}`;
      if (baru !== teks) hasil[i] = baru;
      continue;
    }

    const bulat = teks.match(ITEM_BULAT);
    if (bulat) {
      const lebar = lebarIndentasi(bulat[1]);
      // Butir bulat menempati tingkatnya sendiri. Daftar bernomor yang muncul
      // setelahnya di tingkat yang sama adalah daftar baru, jadi mulai dari 1.
      buangLebihDalam(lebar);
      hitungan.delete(lebar);
      continue;
    }

    // Baris biasa yang menempel di tepi kiri mengakhiri seluruh daftar.
    // Baris menjorok dianggap lanjutan isi butir, jadi hitungannya dibiarkan.
    if (!/^[ \t]/.test(teks)) hitungan = new Map();
  }

  return hasil;
}

/** Bentuk sederhana untuk pengujian dan pemakaian di luar CodeMirror. */
export function penomoranUlang(teks) {
  const baris = teks.split('\n');
  const ganti = hitungPenomoran(baris);
  return baris.map((b, i) => ganti[i] ?? b).join('\n');
}