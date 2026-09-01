import { useRef, useState } from 'react';
import { Inbox } from 'lucide-react';
import { ikonFolder, warnaFolder } from '../folderStyle.js';

/** Lama menekan sebelum lembar ubah folder terbuka. Sama dengan kartu tugas. */
const HOLD_MS = 420;

/** Nama folder untuk catatan tanpa tag. Bukan tag, jadi tidak bisa dipilih di saringan. */
export const YATIM = '\u0000yatim';

/**
 * Menyusun catatan jadi folder menurut tagnya.
 *
 * Folder di sini bukan wadah tersendiri: tidak ada tabel folder, dan sebuah
 * catatan tidak "berada di dalam" satu folder. Yang ada tetap tag, dan folder
 * cuma cara melihatnya. Konsekuensinya disengaja dan perlu diingat — catatan
 * bertag dua muncul di dua folder, dan jumlah seluruh folder bisa lebih besar
 * dari jumlah catatan.
 *
 * Yang tersemat sengaja tidak dikeluarkan dari folder. Menyematkan berarti
 * "sering kubuka", bukan "pindahkan ke luar"; mengeluarkannya membuat folder
 * terlihat kehilangan isi tanpa alasan yang terbaca.
 */
export function susunFolder(notes) {
  const peta = new Map();
  let yatim = [];

  for (const n of notes) {
    if (!n.tag?.length) {
      yatim.push(n);
      continue;
    }
    for (const t of n.tag) {
      /*
       * Dikelompokkan dengan kunci huruf kecil, tapi yang ditampilkan bentuk
       * asli yang pertama ditemui.
       *
       * Sejak v1.58 nama tag bebas huruf besar, jadi dua catatan bisa memuat
       * "Jantung" dan "jantung". Server memperlakukan keduanya sebagai satu tag
       * saat menyaring; kalau di sini dipisah, akan muncul dua folder yang
       * namanya tampak sama dan isinya terbelah — persis jenis kebingungan yang
       * tidak akan ketahuan sebabnya.
       */
      const k = t.toLowerCase();
      if (!peta.has(k)) peta.set(k, { nama: t, isi: [] });
      peta.get(k).isi.push(n);
    }
  }

  // Urut abjad, bukan menurut jumlah isi: urutan yang berubah setiap kali
  // sebuah catatan ditambahkan membuat folder yang sama berpindah tempat, dan
  // ingatan otot orang soal "folderku ada di kiri atas" jadi tidak berlaku.
  const folder = [...peta.values()]
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' }))
    .map(({ nama, isi }) => ({ nama, jumlah: isi.length }));

  return { folder, yatim };
}

/**
 * Satu folder.
 *
 * Bentuknya mengikuti tata letak daftar catatan. Pada kisi, ia digambar sebagai
 * ikon folder — bentuk yang sudah dikenal semua orang, dan sejajar dengan kartu
 * catatan di sekitarnya. Pada daftar baris, ikon besar akan merusak irama baris
 * yang rapat, jadi yang dipakai baris bergaya map arsip: bertepi tebal di kiri
 * dengan ikon kecil.
 */
export function FolderItem({ nama, jumlah, layout, gaya, onBuka, onUbah }) {
  const yatim = nama === YATIM;
  const label = yatim ? 'Tidak Terkategori' : nama;

  /*
   * "Tidak Terkategori" tidak bisa diubah warna maupun ikonnya. Ia bukan folder
   * yang dibuat orang melainkan tempat sisa, dan hiasannya tidak punya tempat
   * untuk disimpan — kuncinya adalah nama tag, dan folder ini tidak punya tag.
   */
  const bisaDiubah = !yatim && Boolean(onUbah);
  const Ikon = yatim ? Inbox : ikonFolder(gaya?.ikon);
  const warna = yatim ? null : warnaFolder(gaya?.warna);

  const timer = useRef(null);
  const awal = useRef(null);
  const tekanTerpakai = useRef(false);
  const [ditekan, setDitekan] = useState(false);

  const batal = () => {
    clearTimeout(timer.current);
    setDitekan(false);
  };

  const mulaiTekan = (e) => {
    if (!bisaDiubah) return;
    awal.current = { x: e.clientX, y: e.clientY };
    setDitekan(true);
    timer.current = setTimeout(() => {
      setDitekan(false);
      tekanTerpakai.current = true;
      onUbah(nama);
    }, HOLD_MS);
  };

  const gerak = (e) => {
    const a = awal.current;
    // Jari yang bergeser sedang menggulir, bukan menekan lama.
    if (a && Math.hypot(e.clientX - a.x, e.clientY - a.y) > 10) batal();
  };

  return (
    <button
      className={`folder ${layout === 'list' ? 'baris' : 'kisi'} ${yatim ? 'yatim' : ''} ${
        ditekan ? 'ditekan' : ''
      }`}
      style={warna ? { '--folder-warna': warna } : undefined}
      onPointerDown={mulaiTekan}
      onPointerMove={gerak}
      onPointerUp={batal}
      onPointerCancel={batal}
      onContextMenu={(e) => {
        e.preventDefault();
        if (bisaDiubah) onUbah(nama);
      }}
      onClick={() => {
        // Tekan lama sudah membuka lembar ubah; ketukan yang menyusul sesudahnya
        // jangan ikut membuka foldernya.
        if (tekanTerpakai.current) {
          tekanTerpakai.current = false;
          return;
        }
        onBuka(nama);
      }}
      aria-label={`Buka folder ${label}, ${jumlah} catatan`}
    >
      <span className="folder-ikon">
        <Ikon size={layout === 'list' ? 18 : 26} strokeWidth={1.6} />
      </span>
      <span className="folder-teks">
        <span className="folder-nama">{label}</span>
        <span className="folder-jumlah">{jumlah} catatan</span>
      </span>
    </button>
  );
}