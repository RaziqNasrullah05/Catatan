/**
 * Mengecilkan gambar di peramban sebelum diunggah.
 *
 * Foto ponsel sekarang lazimnya 3–6 MB dan 4000 piksel lebih di sisi
 * panjangnya, sementara server menolak apa pun di atas 2 MB. Tanpa langkah ini,
 * jalur yang paling wajar — memotret lalu menyisipkannya ke catatan — hampir
 * selalu berakhir dengan penolakan, dan pengguna tidak punya cara memperbaikinya
 * dari dalam aplikasi.
 *
 * Yang dilakukan: menggambar ulang gambarnya ke kanvas dengan sisi panjang
 * dibatasi, lalu mengekspornya sebagai JPEG. Kalau hasilnya masih terlalu besar,
 * mutunya diturunkan bertahap dan dicoba lagi.
 *
 * Beberapa keputusan yang mudah salah kalau tidak ditulis:
 *
 *   - **GIF tidak disentuh.** Menggambar GIF ke kanvas hanya menyalin frame
 *     pertama, jadi animasinya hilang tanpa peringatan. Lebih baik ditolak
 *     karena besar daripada diterima dalam keadaan rusak.
 *   - **PNG jadi JPEG, kecuali kecil.** PNG besar hampir selalu foto atau
 *     tangkapan layar, dan JPEG jauh lebih ringan untuk keduanya. Tapi PNG kecil
 *     biasanya logo, diagram, atau tangkapan layar bertulisan tajam, dan
 *     mengubahnya jadi JPEG menambahkan cacat di sekitar garis — jadi yang sudah
 *     di bawah batas dibiarkan apa adanya.
 *   - **Yang sudah cukup kecil dibiarkan.** Memproses ulang berkas yang tidak
 *     bermasalah hanya menurunkan mutunya tanpa manfaat.
 *   - **Kalau pengecilan gagal, berkas aslinya dikembalikan.** Biar server yang
 *     menolak dengan pesannya sendiri, daripada aplikasi ini menampilkan galat
 *     yang tidak dimengerti siapa pun.
 */

/*
 * Dicoba berlapis: setiap ukuran sisi dijajal dengan seluruh tingkat mutu
 * sebelum turun ke ukuran berikutnya.
 *
 * Satu putaran mutu saja ternyata tidak cukup. Foto 12 megapiksel yang penuh
 * detail — dedaunan, kerumunan, tulisan kecil — masih di atas 2 MB pada mutu
 * 0,55 di 2000 piksel, karena yang membuatnya besar bukan mutunya melainkan
 * banyaknya detail yang harus disimpan. Yang menolong di situ mengecilkan
 * ukurannya, bukan menurunkan mutunya lebih jauh: 0,55 pada 2000 piksel sudah
 * mulai terlihat kotor, sedangkan 0,85 pada 1400 piksel masih bersih.
 */
const SISI = [2000, 1600, 1200, 900];
const MUTU = [0.85, 0.72, 0.6];

/*
 * Hanya GIF yang tidak pernah disentuh.
 *
 * Versi pertama memakai daftar putih tiga tipe (jpeg, png, webp), dan itu
 * meleset: kamera ponsel sekarang kerap menghasilkan HEIC atau HEIF, sebagian
 * pemilih berkas mengirim tipe kosong, dan semuanya lolos tanpa dikecilkan lalu
 * ditolak server. Sekarang kebalikannya — semua dicoba kecuali GIF, dan yang
 * peramban tidak bisa membacanya jatuh ke penanganan galat di bawah.
 */
const JANGAN_SENTUH = new Set(['image/gif']);

function muatGambar(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // URL objek dilepas begitu gambarnya terbaca; kalau tidak, berkasnya
      // ditahan di memori selama halaman hidup.
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gambar tidak bisa dibaca.'));
    };
    img.src = url;
  });
}

function keBlob(canvas, mutu) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', mutu));
}

/**
 * @param {File} file    Berkas asli dari pemilih berkas.
 * @param {number} batas Ukuran maksimum dalam byte.
 * @returns {Promise<{berkas: File, dikecilkan: boolean, asal: number}>}
 */
export async function kecilkanGambar(file, batas) {
  const asal = file.size;
  const hasilApaAdanya = { berkas: file, dikecilkan: false, asal };

  if (JANGAN_SENTUH.has(file.type)) return hasilApaAdanya;
  if (file.size <= batas) return hasilApaAdanya;

  const namaBaru = `${file.name.replace(/\.[^.]+$/, '') || 'gambar'}.jpg`;
  let terkecil = null;

  try {
    const img = await muatGambar(file);
    const sisiTerpanjang = Math.max(img.naturalWidth, img.naturalHeight);
    if (!sisiTerpanjang) return hasilApaAdanya;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    for (const sisi of SISI) {
      const skala = Math.min(1, sisi / sisiTerpanjang);
      canvas.width = Math.round(img.naturalWidth * skala);
      canvas.height = Math.round(img.naturalHeight * skala);
      if (!canvas.width || !canvas.height) continue;

      // JPEG tidak punya alfa; tanpa latar putih, bagian tembus pandang pada
      // PNG keluar jadi hitam pekat. Digambar ulang tiap putaran karena
      // mengubah ukuran kanvas mengosongkan isinya.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      for (const mutu of MUTU) {
        const blob = await keBlob(canvas, mutu);
        if (!blob) continue;
        if (!terkecil || blob.size < terkecil.size) terkecil = blob;
        if (blob.size <= batas) {
          return {
            berkas: new File([blob], namaBaru, { type: 'image/jpeg', lastModified: Date.now() }),
            dikecilkan: true,
            asal,
          };
        }
      }
    }
  } catch {
    // Peramban tidak bisa membaca berkasnya — HEIC di peramban yang belum
    // mendukungnya, berkas rusak, atau kanvas kehabisan memori pada gambar
    // raksasa. Kembalikan aslinya; server yang menolak dengan pesannya sendiri.
    return hasilApaAdanya;
  }

  /*
   * Sampai sini artinya semua kombinasi ukuran dan mutu masih di atas batas.
   * Yang terkecil tetap dikembalikan, bukan berkas aslinya: ia sudah jauh lebih
   * ringan, dan kalaupun server tetap menolak, angka yang muncul di pesan
   * penolakan jadi angka yang masuk akal — bukan 34 MB yang membuat orang
   * mengira tidak terjadi apa-apa.
   */
  if (terkecil) {
    return {
      berkas: new File([terkecil], namaBaru, { type: 'image/jpeg', lastModified: Date.now() }),
      dikecilkan: true,
      asal,
    };
  }

  return hasilApaAdanya;
}

/** "3,4 MB" atau "820 KB" — untuk pesan yang dibaca orang, bukan log. */
export function ukuranTerbaca(byte) {
  return byte >= 1024 * 1024
    ? `${(byte / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(byte / 1024))} KB`;
}