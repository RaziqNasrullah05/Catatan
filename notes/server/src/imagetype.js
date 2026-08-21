/**
 * Menentukan jenis gambar dari beberapa byte pertama berkasnya.
 *
 * Header `Content-Type` yang dikirim peramban tidak dipercaya: ia datang dari
 * sisi klien dan bisa diisi apa saja. Berkas berisi HTML atau skrip yang mengaku
 * `image/png` akan lolos kalau yang diperiksa hanya headernya, lalu tersimpan dan
 * disajikan kembali dari domain yang sama.
 *
 * Hanya empat jenis yang diterima. SVG sengaja tidak: ia dokumen XML yang bisa
 * memuat skrip, dan menyajikannya dari domain sendiri berarti membuka jalan
 * skrip pihak ketiga betapapun ketatnya CSP.
 */

const cocok = (buf, tanda, mulai = 0) =>
  tanda.every((b, i) => b === null || buf[mulai + i] === b);

const H = (s) => [...s].map((c) => c.charCodeAt(0));

export function deteksiGambar(buf) {
  if (!buf || buf.length < 12) return null;

  // PNG: \x89PNG\r\n\x1a\n
  if (cocok(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: 'image/png', ext: 'png' };
  }

  // JPEG: FF D8 FF
  if (cocok(buf, [0xff, 0xd8, 0xff])) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // GIF87a / GIF89a
  if (cocok(buf, H('GIF8')) && (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61) {
    return { mime: 'image/gif', ext: 'gif' };
  }

  // WebP: RIFF????WEBP — empat byte ukuran di tengah diabaikan.
  if (cocok(buf, H('RIFF')) && cocok(buf, H('WEBP'), 8)) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  return null;
}