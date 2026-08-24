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

const SISI_MAKS = 2000;
const MUTU = [0.85, 0.75, 0.65, 0.55];

/** Format yang aman digambar ulang. GIF sengaja tidak termasuk. */
const BISA_DIKECILKAN = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

  if (!BISA_DIKECILKAN.has(file.type)) return hasilApaAdanya;
  if (file.size <= batas) return hasilApaAdanya;

  try {
    const img = await muatGambar(file);
    const sisiTerpanjang = Math.max(img.naturalWidth, img.naturalHeight);
    const skala = Math.min(1, SISI_MAKS / sisiTerpanjang);

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * skala);
    canvas.height = Math.round(img.naturalHeight * skala);
    if (!canvas.width || !canvas.height) return hasilApaAdanya;

    const ctx = canvas.getContext('2d');
    // JPEG tidak punya alfa; tanpa latar putih, bagian tembus pandang pada PNG
    // keluar jadi hitam pekat.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const mutu of MUTU) {
      const blob = await keBlob(canvas, mutu);
      if (!blob) break;
      if (blob.size <= batas) {
        const nama = `${file.name.replace(/\.[^.]+$/, '') || 'gambar'}.jpg`;
        return {
          berkas: new File([blob], nama, { type: 'image/jpeg', lastModified: Date.now() }),
          dikecilkan: true,
          asal,
        };
      }
    }
  } catch {
    // Kanvas bisa gagal pada gambar yang sangat besar di perangkat berumur
    // pendek memori. Kembalikan aslinya; server yang memutuskan.
  }

  return hasilApaAdanya;
}

/** "3,4 MB" atau "820 KB" — untuk pesan yang dibaca orang, bukan log. */
export function ukuranTerbaca(byte) {
  return byte >= 1024 * 1024
    ? `${(byte / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(byte / 1024))} KB`;
}