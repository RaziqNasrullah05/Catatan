import { useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Users, X } from 'lucide-react';
import { api } from '../api.js';

const MAX_TAG = 12;

/**
 * Baris di antara judul dan isi: tag milik pembaca, dan grup tempat catatan ini
 * terbit.
 *
 * Keduanya sengaja disatukan dalam satu baris meski asalnya berbeda. Yang
 * dijawab baris ini satu pertanyaan yang sama — "catatan ini termasuk apa" —
 * dan memisahkannya jadi dua deret chip hanya membuat ruang antara judul dan
 * kalimat pertama makin tebal.
 *
 * Bedanya tetap terbaca: tag bisa dihapus dan ditambah, grup tidak. Grup
 * ditentukan lewat menu catatan di daftar, dan menampilkannya sebagai chip yang
 * tidak bisa disentuh di sini lebih jujur daripada memberi silang yang ternyata
 * tidak melakukan apa-apa.
 */
export default function TagRow({ noteId, tagAwal, grup = [], bisaSunting = true }) {
  const [tag, setTag] = useState(tagAwal);
  const [menulis, setMenulis] = useState(false);
  const [teks, setTeks] = useState('');
  const [semua, setSemua] = useState([]);
  const [error, setError] = useState('');
  const isian = useRef(null);

  // Tag catatan ini dimuat bersama catatannya; yang perlu diambil terpisah
  // hanya daftar tag yang pernah dipakai, dan itu hanya saat mulai mengetik.
  useEffect(() => {
    if (!menulis || semua.length) return;
    api
      .semuaTag()
      .then((d) => setSemua(d.tag.map((t) => t.nama)))
      .catch(() => setSemua([]));
  }, [menulis, semua.length]);

  useEffect(() => {
    setTag(tagAwal);
  }, [tagAwal]);

  /*
   * Saran dicocokkan tanpa peduli huruf besar-kecil.
   *
   * Sejak v1.58 nama tag disimpan apa adanya — "Pekerjaan Rumah", bukan
   * "pekerjaan-rumah". Versi lama mengecilkan huruf yang diketik lalu
   * membandingkannya apa adanya dengan nama tersimpan, jadi mengetik "peker"
   * tidak pernah cocok dengan "Pekerjaan Rumah" dan sarannya menghilang sama
   * sekali. Yang dikecilkan sekarang kedua sisinya, bukan salah satu.
   */
  const saran = useMemo(() => {
    const kata = teks.trim().replace(/^#/, '').toLowerCase();
    if (!kata) return [];
    const dipakai = new Set(tag.map((t) => t.toLowerCase()));
    return semua
      .filter((t) => t.toLowerCase().startsWith(kata) && !dipakai.has(t.toLowerCase()))
      .slice(0, 6);
  }, [teks, semua, tag]);

  /**
   * Seluruh daftar dikirim sekaligus, bukan satu tag per permintaan. Server
   * menetapkan daftarnya utuh, jadi tampilan dan simpanan tidak bisa berselisih
   * kalau satu permintaan gagal di tengah.
   */
  async function simpan(daftar) {
    const sebelumnya = tag;
    setTag(daftar);
    setError('');
    try {
      const d = await api.simpanTag(noteId, daftar);
      // Yang dipasang hasil dari server, bukan tebakan kita: normalisasinya
      // terjadi di sana, jadi bentuk akhirnya bisa saja berbeda dari yang
      // diketik.
      setTag(d.tag);
      setSemua((lama) => [...new Set([...lama, ...d.tag])]);
    } catch (err) {
      setTag(sebelumnya);
      setError(err.message);
    }
  }

  function tambah(mentah) {
    // Huruf yang diketik dipertahankan: server menyimpan nama tag apa adanya
    // sejak v1.58, dan mengecilkannya di sini akan membuat "Produktivitastung"
    // tersimpan sebagai "Produktivitastung" tanpa alasan.
    const kata = String(mentah || teks)
      .replace(/^\s*#+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    setTeks('');
    // Pemeriksaan kembar tetap tanpa peduli huruf besar-kecil, sama seperti
    // server — kalau tidak, "Jantung" tampak bisa ditambahkan padahal server
    // akan membuangnya sebagai kembaran, dan chip-nya hilang tanpa penjelasan.
    if (!kata || tag.some((t) => t.toLowerCase() === kata.toLowerCase())) return;
    if (tag.length >= MAX_TAG) {
      setError(`Paling banyak ${MAX_TAG} tag per catatan.`);
      return;
    }
    simpan([...tag, kata]);
  }

  const kosong = tag.length === 0 && grup.length === 0;
  if (kosong && !bisaSunting) return null;

  return (
    <div className="tag-row">
      {tag.map((t) => (
        <span key={t} className="chip tag">
          <Hash size={11} strokeWidth={2.2} />
          {t}
          {bisaSunting && (
            <button
              className="chip-x"
              aria-label={`Hapus tag ${t}`}
              onClick={() => simpan(tag.filter((x) => x !== t))}
            >
              <X size={11} strokeWidth={2.4} />
            </button>
          )}
        </span>
      ))}

      {grup.map((g) => (
        <span key={g} className="chip grup" title={`Terbit di grup ${g}`}>
          <Users size={11} strokeWidth={2.2} />
          {g}
        </span>
      ))}

      {bisaSunting &&
        (menulis ? (
          // autoCapitalize sengaja tidak dipasang: nama tag kini bebas huruf
          // besar (v1.58), dan memaksa huruf kecil di papan ketik membuat
          // "Produktivitastung" merepotkan diketik tanpa alasan.
          <span className="chip-isian">
            <Hash size={11} strokeWidth={2.2} />
            <input
              ref={isian}
              autoFocus
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  tambah();
                } else if (e.key === 'Escape') {
                  setTeks('');
                  setMenulis(false);
                } else if (e.key === 'Backspace' && !teks && tag.length) {
                  // Backspace pada isian kosong menghapus tag terakhir, seperti
                  // kolom penerima di aplikasi surel.
                  simpan(tag.slice(0, -1));
                }
              }}
              onBlur={() => {
                // Jeda sekejap supaya ketukan pada saran sempat terbaca lebih
                // dulu; tanpa itu daftarnya lenyap sebelum jarinya mendarat.
                setTimeout(() => setMenulis(false), 140);
              }}
              placeholder="Tag baru"
              aria-label="Tambah tag"
              autoCorrect="off"
              spellCheck="false"
            />
          </span>
        ) : (
          <button className="chip tambah" onClick={() => setMenulis(true)}>
            <Hash size={11} strokeWidth={2.2} />
            {tag.length ? 'Tag' : 'Tambah tag'}
          </button>
        ))}

      {menulis && saran.length > 0 && (
        <div className="tag-saran" role="listbox" aria-label="Tag yang pernah dipakai">
          {saran.map((t) => (
            <button key={t} role="option" aria-selected="false" onMouseDown={() => tambah(t)}>
              #{t}
            </button>
          ))}
        </div>
      )}

      {error && <span className="tag-error">{error}</span>}
    </div>
  );
}