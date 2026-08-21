/**
 * Sebutan catatan gaya Obsidian: `[[Judul catatan]]`.
 *
 * Ditulis sebagai plugin remark, bukan penggantian teks dengan regex sebelum
 * dirender. Alasannya penting: regex tidak bisa membedakan `[[...]]` yang ditulis
 * sebagai isi tulisan dari yang berada di dalam blok kode atau kode sebaris.
 * Pohon markdown sudah memisahkan keduanya, jadi plugin ini cukup menyentuh
 * simpul teks dan blok kode aman dengan sendirinya.
 *
 * Dua bentuk dikenali:
 *   [[Judul]]      dicari berdasarkan judulnya
 *   [[Judul|id]]   menyimpan id catatannya, dipakai pemilih di rail format
 *
 * Bentuk kedua tetap bekerja walau judul catatannya berubah kemudian. Yang gagal
 * dikenali dibiarkan apa adanya sebagai teks — lebih jujur daripada menampilkan
 * tautan yang tidak menuju ke mana-mana.
 */

const POLA = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

/** Judul disamakan tanpa memandang huruf besar-kecil dan spasi berlebih. */
export const kunciJudul = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function remarkSebutan({ cariId }) {
  return (tree) => {
    telusuri(tree, null, -1);

    function telusuri(simpul, induk, urutan) {
      if (simpul.type === 'text' && induk && simpul.value.includes('[[')) {
        const pengganti = pecah(simpul.value);
        if (pengganti) {
          induk.children.splice(urutan, 1, ...pengganti);
          return;
        }
      }
      // Judul tautan tidak diproses ulang; `[[x]]` di dalam tautan biarkan saja.
      if (simpul.type === 'link' || simpul.type === 'linkReference') return;
      if (!simpul.children) return;
      // Mundur, karena splice mengubah panjang larik di depannya.
      for (let i = simpul.children.length - 1; i >= 0; i--) {
        telusuri(simpul.children[i], simpul, i);
      }
    }

    function pecah(teks) {
      POLA.lastIndex = 0;
      const keluar = [];
      let akhir = 0;
      let ada = false;
      let m;

      while ((m = POLA.exec(teks))) {
        const [utuh, judul, idTertulis] = m;
        const id = idTertulis?.trim() || cariId(judul);

        if (m.index > akhir) keluar.push({ type: 'text', value: teks.slice(akhir, m.index) });

        if (id) {
          ada = true;
          keluar.push({
            type: 'link',
            url: `/catatan/${id}`,
            children: [{ type: 'text', value: judul.trim() }],
          });
        } else {
          keluar.push({ type: 'text', value: utuh });
        }
        akhir = m.index + utuh.length;
      }

      if (!ada) return null;
      if (akhir < teks.length) keluar.push({ type: 'text', value: teks.slice(akhir) });
      return keluar;
    }
  };
}