/**
 * Saran sebutan catatan di dalam penyunting.
 *
 * Pencocokannya tidak harfiah: huruf yang diketik cukup muncul berurutan di
 * dalam judul, tidak harus berdempetan. "efpl" menemukan "Efusi Pleura".
 * Judul yang cocok persis di awal tetap diletakkan paling atas, supaya mengetik
 * lengkap tidak kalah oleh kecocokan kebetulan.
 */

/**
 * Nilai kecocokan sebuah judul terhadap kueri, atau `null` bila tidak cocok
 * sama sekali. Semakin besar semakin relevan.
 */
export function skorCocok(judul, kueri) {
  const j = judul.toLowerCase();
  const q = kueri.toLowerCase();
  if (!q) return 0;

  if (j.startsWith(q)) return 10000 - j.length;

  const posisi = j.indexOf(q);
  // Cocok berdempetan di tengah: makin awal makin tinggi.
  if (posisi >= 0) return 5000 - posisi * 10 - j.length;

  // Berurutan tapi berselang. Awal kata dihargai lebih, karena begitulah orang
  // menyingkat: "vp" untuk "Visite Pagi".
  let nilai = 1000;
  let i = 0;
  let terakhir = -1;
  for (const huruf of q) {
    const at = j.indexOf(huruf, i);
    if (at < 0) return null;
    if (at === 0 || /[\s\-_/]/.test(j[at - 1])) nilai += 40;
    if (at === terakhir + 1) nilai += 15;
    nilai -= at - i;
    terakhir = at;
    i = at + 1;
  }
  return nilai - j.length;
}

/** Judul yang paling cocok lebih dulu, dibatasi `batas` teratas. */
export function cocokJudul(daftar, kueri, batas = 8) {
  const q = kueri.trim();
  if (!q) return daftar.slice(0, batas);

  return daftar
    .map((c) => ({ c, nilai: skorCocok(c.judul, q) }))
    .filter((x) => x.nilai !== null)
    .sort((a, b) => b.nilai - a.nilai || a.c.judul.localeCompare(b.c.judul))
    .slice(0, batas)
    .map((x) => x.c);
}

/**
 * Menyisipkan sebutan pada rentang kueri. Kurung penutup yang sudah dipasang
 * penutupan otomatis dibiarkan, kalau belum ada baru ditambahkan — supaya tidak
 * pernah muncul `]]]]`.
 */
export function sisipkanSebutan(view, from, to, isi) {
  const sesudah = view.state.doc.sliceString(to, to + 2);
  const perluTutup = sesudah !== ']]';
  const teks = perluTutup ? `${isi}]]` : isi;
  view.dispatch({
    changes: { from, to, insert: teks },
    selection: { anchor: from + isi.length + (perluTutup ? 2 : 2) },
  });
  view.focus();
}

/**
 * Sumber saran untuk CodeMirror. `ambilDaftar` dibaca saat saran diminta, bukan
 * saat penyunting dibuat, karena instance CodeMirror sengaja dibuat sekali saja
 * sementara daftar catatannya datang belakangan.
 *
 * `onBuat(judul)` harus mengembalikan Promise berisi `{id, judul}` catatan baru,
 * atau null bila gagal.
 */
export function sumberSebutan({ ambilDaftar, onBuat }) {
  return (context) => {
    const cocok = context.matchBefore(/\[\[[^\]\n]*/);
    if (!cocok) return null;

    const kueri = cocok.text.slice(2);
    // Saran muncul sejak huruf pertama, bukan langsung setelah `[[` — daftar
    // penuh yang menyembul begitu kurung diketik lebih mengganggu daripada
    // membantu.
    if (!context.explicit && kueri.length < 1) return null;

    const from = cocok.from + 2;
    const daftar = ambilDaftar() || [];
    const options = cocokJudul(daftar, kueri).map((c) => ({
      label: c.judul,
      detail: c.milikku === false ? 'grup' : undefined,
      type: 'text',
      apply: (view, _c, dari, sampai) => sisipkanSebutan(view, dari, sampai, `${c.judul}|${c.id}`),
    }));

    if (onBuat && kueri.trim()) {
      options.push({
        label: `Buat catatan “${kueri.trim()}”`,
        type: 'keyword',
        // Selalu di dasar daftar, berapa pun nilai kecocokan di atasnya.
        boost: -99,
        apply: (view, _c, dari, sampai) => {
          const judul = kueri.trim();
          onBuat(judul).then((baru) => {
            if (!baru) return;
            // Posisi bisa bergeser selama menunggu server. Sisipkan hanya kalau
            // teks di rentang itu masih kueri yang sama.
            const masih = view.state.doc.sliceString(dari, sampai);
            if (masih !== kueri) return;
            sisipkanSebutan(view, dari, sampai, `${baru.judul}|${baru.id}`);
          });
        },
      });
    }

    return { from, options, validFor: /^[^\]\n]*$/ };
  };
}