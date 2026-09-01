import { Folder, Inbox } from 'lucide-react';

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
      if (!peta.has(t)) peta.set(t, []);
      peta.get(t).push(n);
    }
  }

  // Urut abjad, bukan menurut jumlah isi: urutan yang berubah setiap kali
  // sebuah catatan ditambahkan membuat folder yang sama berpindah tempat, dan
  // ingatan otot orang soal "folderku ada di kiri atas" jadi tidak berlaku.
  const folder = [...peta.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'id'))
    .map(([nama, isi]) => ({ nama, jumlah: isi.length }));

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
export function FolderItem({ nama, jumlah, layout, onBuka }) {
  const yatim = nama === YATIM;
  const label = yatim ? 'Tidak Terkategori' : nama;
  const Ikon = yatim ? Inbox : Folder;

  return (
    <button
      className={`folder ${layout === 'list' ? 'baris' : 'kisi'} ${yatim ? 'yatim' : ''}`}
      onClick={() => onBuka(nama)}
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