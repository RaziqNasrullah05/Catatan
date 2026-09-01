import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import Sheet from './Sheet.jsx';

/**
 * Dasar pengurutan daftar catatan.
 *
 * Menggantikan saringan tag yang dulu ada di tempat ini: sejak tag jadi folder
 * (v1.55), menyaring tag lewat lembar terpisah berarti dua cara melakukan hal
 * yang sama, dan yang satu tersembunyi di balik tombol sementara yang lain
 * terpampang sebagai folder.
 *
 * Bawaannya "terakhir diubah, terbaru dulu" — pertanyaan yang paling sering
 * dibawa orang ke daftar catatan adalah "yang barusan kukerjakan mana", bukan
 * "yang mana yang paling awal kubuat".
 */
export const URUTAN = [
  { id: 'diubah', label: 'Terakhir diubah' },
  { id: 'dibuat', label: 'Tanggal dibuat' },
  { id: 'nama', label: 'Nama' },
];

export const ARAH = [
  { id: 'turun', label: 'Menurun', Ikon: ArrowDown },
  { id: 'naik', label: 'Menaik', Ikon: ArrowUp },
];

/**
 * Keterangan arah sengaja berubah mengikuti dasar urutannya.
 *
 * "Menurun" pada tanggal berarti terbaru dulu, sedangkan pada nama berarti Z ke
 * A — dua hal yang tidak berhubungan sama sekali. Menuliskan "Menurun" saja
 * memaksa orang menebak yang mana yang berlaku, dan tebakannya sering salah.
 */
const KETERANGAN = {
  diubah: { turun: 'Terbaru dulu', naik: 'Terlama dulu' },
  dibuat: { turun: 'Terbaru dulu', naik: 'Terlama dulu' },
  nama: { turun: 'Z ke A', naik: 'A ke Z' },
};

export default function SortSheet({ urut, arah, onTutup, onPilih }) {
  return (
    <Sheet onTutup={onTutup}>
      {() => (
        <>
          <h3>Urut berdasarkan</h3>

          <div className="urut-daftar">
            {URUTAN.map((u) => (
              <button
                key={u.id}
                className={`urut-baris ${urut === u.id ? 'terpilih' : ''}`}
                aria-pressed={urut === u.id}
                onClick={() => onPilih(u.id, arah)}
              >
                <span>{u.label}</span>
                {urut === u.id && <Check size={17} strokeWidth={2.4} />}
              </button>
            ))}
          </div>

          {/* Dipisah garis: arah bukan pilihan keempat sejajar dengan ketiganya,
              melainkan keterangan atas pilihan yang sudah diambil di atas. */}
          <div className="urut-pisah" />

          <div className="urut-daftar">
            {ARAH.map((a) => (
              <button
                key={a.id}
                className={`urut-baris ${arah === a.id ? 'terpilih' : ''}`}
                aria-pressed={arah === a.id}
                onClick={() => onPilih(urut, a.id)}
              >
                <a.Ikon size={16} strokeWidth={2} />
                <span>{KETERANGAN[urut][a.id]}</span>
                {arah === a.id && <Check size={17} strokeWidth={2.4} />}
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

/**
 * Mengurutkan catatan. Yang tersemat selalu di puncak apa pun dasarnya —
 * menyematkan berarti "taruh di atas", dan urutan apa pun yang mengalahkannya
 * membuat penyematan tidak ada gunanya.
 */
export function urutkanCatatan(notes, urut, arah) {
  const kali = arah === 'naik' ? 1 : -1;
  const banding = {
    diubah: (a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)),
    dibuat: (a, b) => String(a.createdAt).localeCompare(String(b.createdAt)),
    nama: (a, b) => (a.title || '').localeCompare(b.title || '', 'id', { sensitivity: 'base' }),
  }[urut];

  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

    /*
     * "Tanpa judul" selalu jatuh ke bawah, tidak peduli arahnya.
     *
     * Versi pertama menanganinya dengan mengganti judul kosong jadi karakter
     * tertinggi lalu membiarkannya ikut diurutkan. Itu benar saat menaik dan
     * salah saat menurun: membalik arah ikut membalik penandanya, dan catatan
     * tanpa judul justru naik ke puncak. Karena itu diperiksa sebelum arah
     * dikenakan — ia bukan nama yang punya tempat di abjad, jadi ia tidak boleh
     * ikut dibalik bersama abjadnya.
     */
    if (urut === 'nama') {
      const kosongA = !a.title;
      const kosongB = !b.title;
      if (kosongA !== kosongB) return kosongA ? 1 : -1;
    }

    return banding(a, b) * kali;
  });
}