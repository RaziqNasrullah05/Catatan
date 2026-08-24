import { useEffect, useState } from 'react';
import { Hash } from 'lucide-react';
import { api } from '../api.js';
import Sheet from './Sheet.jsx';

/**
 * Memilih tag mana saja yang catatannya ditampilkan.
 *
 * Pilihannya baru berlaku saat Terapkan ditekan, bukan seketika tiap chip
 * disentuh. Alasannya bukan penghematan permintaan melainkan cara memakainya:
 * memilih tiga tag berarti tiga kali daftar di belakang lembar ini berubah
 * susunan, dan yang terlihat justru kekacauan.
 *
 * Maknanya "atau": catatan tampil kalau punya salah satu tag yang dipilih.
 * Saringan ini untuk melihat lebih banyak, bukan menyempitkan sampai habis.
 */
export default function TagFilter({ terpilih, onTutup, onTerapkan }) {
  const [semua, setSemua] = useState(null);
  const [pilihan, setPilihan] = useState(terpilih);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .semuaTag()
      .then((d) => setSemua(d.tag))
      .catch((err) => {
        setError(err.message);
        setSemua([]);
      });
  }, []);

  const alihkan = (nama) =>
    setPilihan((lama) => (lama.includes(nama) ? lama.filter((x) => x !== nama) : [...lama, nama]));

  return (
    <Sheet onTutup={onTutup}>
      {(tutup) => (
        <>
          <h3>Tampilkan tag apa saja?</h3>
          <p>
            Catatan tampil kalau punya salah satu tag yang dipilih. Tanpa satu pun terpilih, semua
            catatan tampil.
          </p>

          {error && <p className="notice bad">{error}</p>}

          <div className="saring-daftar">
            {semua === null && <p className="saring-kosong">Memuat tag…</p>}
            {semua?.length === 0 && !error && (
              <p className="saring-kosong">
                Belum ada tag. Tambahkan lewat baris di bawah judul saat menulis catatan.
              </p>
            )}
            {(semua || []).map((t) => (
              <button
                key={t.nama}
                className={`chip tag pilihan ${pilihan.includes(t.nama) ? 'terpilih' : ''}`}
                aria-pressed={pilihan.includes(t.nama)}
                onClick={() => alihkan(t.nama)}
              >
                <Hash size={11} strokeWidth={2.2} />
                {t.nama}
                <span className="chip-jumlah">{t.jumlah}</span>
              </button>
            ))}
          </div>

          <div className="row">
            <button
              className="btn ghost"
              onClick={() => (pilihan.length ? setPilihan([]) : tutup())}
            >
              {pilihan.length ? 'Kosongkan' : 'Batal'}
            </button>
            <button className="btn" onClick={() => onTerapkan(pilihan)}>
              Terapkan
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}