/**
 * Penyebaran acara berulang menjadi tanggal-tanggal nyata.
 *
 * Acara berulang disimpan sebagai satu baris beserta aturannya, bukan ratusan
 * baris. Penyebarannya dilakukan saat dibaca, dibatasi rentang tanggal yang
 * diminta — tanpa batas itu, pengulangan tanpa tanggal akhir tidak akan pernah
 * selesai dihitung.
 *
 * Tanggal diperlakukan sebagai teks `TTTT-BB-HH` dan seluruh perhitungan memakai
 * UTC. Ini disengaja: yang disimpan adalah tanggal kalender, bukan penanda waktu.
 * Kalau memakai waktu lokal, acara pagi hari bisa bergeser ke tanggal sebelumnya
 * dan seluruh agenda melompat satu hari.
 */

const HARI = 86400000;

const keUtc = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const keIso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Jumlah hari dalam sebuah bulan, mis. Februari 2024 → 29. */
const hariDalamBulan = (tahun, bulan) => new Date(Date.UTC(tahun, bulan + 1, 0)).getUTCDate();

export const ULANGAN = ['harian', 'mingguan', 'bulanan', 'tahunan'];

/**
 * Mengembalikan larik tanggal `TTTT-BB-HH` tempat acara ini muncul, dibatasi
 * rentang [dari, sampai] yang keduanya inklusif.
 */
export function sebarkanAcara(acara, dari, sampai) {
  const mulai = keUtc(acara.tanggal);
  const batasBawah = Math.max(mulai, keUtc(dari));
  let batasAtas = keUtc(sampai);

  // Pengulangan boleh punya tanggal berhenti sendiri.
  if (acara.ulang_sampai) batasAtas = Math.min(batasAtas, keUtc(acara.ulang_sampai));
  if (batasAtas < batasBawah) return [];

  if (!acara.ulang) {
    return mulai >= keUtc(dari) && mulai <= batasAtas ? [acara.tanggal] : [];
  }

  const hasil = [];

  if (acara.ulang === 'harian' || acara.ulang === 'mingguan') {
    const langkah = acara.ulang === 'harian' ? HARI : 7 * HARI;
    // Melompat langsung ke kejadian pertama di dalam rentang, bukan menghitung
    // satu per satu dari tanggal awal — rentangnya bisa bertahun-tahun jauhnya.
    const lewat = Math.max(0, Math.ceil((batasBawah - mulai) / langkah));
    for (let t = mulai + lewat * langkah; t <= batasAtas; t += langkah) hasil.push(keIso(t));
    return hasil;
  }

  const tglAsal = +acara.tanggal.slice(8, 10);

  if (acara.ulang === 'bulanan') {
    const awal = new Date(batasBawah);
    let tahun = awal.getUTCFullYear();
    let bulan = awal.getUTCMonth();
    // Mundur satu bulan agar kejadian di awal rentang tidak terlewat.
    if (--bulan < 0) {
      bulan = 11;
      tahun--;
    }
    for (let i = 0; i < 3000; i++) {
      // Bulan yang tidak punya tanggal itu dilewati, bukan digeser. Acara
      // tanggal 31 tidak muncul di Februari — menggesernya ke tanggal 28
      // berarti mengarang jadwal yang tidak pernah dibuat penggunanya.
      if (tglAsal <= hariDalamBulan(tahun, bulan)) {
        const t = Date.UTC(tahun, bulan, tglAsal);
        if (t > batasAtas) break;
        if (t >= batasBawah) hasil.push(keIso(t));
      }
      if (Date.UTC(tahun, bulan, 1) > batasAtas) break;
      if (++bulan > 11) {
        bulan = 0;
        tahun++;
      }
    }
    return hasil;
  }

  if (acara.ulang === 'tahunan') {
    const bulanAsal = +acara.tanggal.slice(5, 7) - 1;
    const tahunAwal = new Date(batasBawah).getUTCFullYear();
    const tahunAkhir = new Date(batasAtas).getUTCFullYear();
    for (let tahun = tahunAwal; tahun <= tahunAkhir; tahun++) {
      // 29 Februari hanya ada di tahun kabisat, dengan alasan yang sama.
      if (tglAsal > hariDalamBulan(tahun, bulanAsal)) continue;
      const t = Date.UTC(tahun, bulanAsal, tglAsal);
      if (t >= batasBawah && t <= batasAtas) hasil.push(keIso(t));
    }
    return hasil;
  }

  return [];
}