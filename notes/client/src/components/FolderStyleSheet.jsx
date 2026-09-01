import { useState } from 'react';
import { Check } from 'lucide-react';
import Sheet from './Sheet.jsx';
import { IKON_FOLDER, WARNA_FOLDER, ikonFolder, warnaFolder } from '../folderStyle.js';

/**
 * Mengubah warna dan ikon sebuah folder.
 *
 * Keduanya ada di satu lembar, bukan dua langkah berurutan. Warna dan ikon
 * dilihat bersama-sama — orang memilih ikon stetoskop *dan* merah karena
 * keduanya bersama-sama berarti "medis", bukan satu lalu yang lain. Memisahkan
 * keduanya memaksa pengguna mengingat pilihan pertama sambil memilih yang kedua.
 *
 * Pratinjaunya di puncak berubah seketika saat dipilih, sedangkan yang
 * dikirimkan ke server baru terjadi saat Simpan. Jadi mencoba-coba tidak
 * menghasilkan satu permintaan per ketukan, dan Batal benar-benar membatalkan.
 */
export default function FolderStyleSheet({ nama, gaya, onTutup, onSimpan }) {
  const [warna, setWarna] = useState(gaya?.warna || 'default');
  const [ikon, setIkon] = useState(gaya?.ikon || 'folder');
  const [sibuk, setSibuk] = useState(false);
  const [error, setError] = useState('');

  const Pratinjau = ikonFolder(ikon);
  const nilaiWarna = warnaFolder(warna);

  return (
    <Sheet onTutup={onTutup}>
      {(tutup) => (
        <>
          <h3>Ubah folder</h3>
          <p>{nama}</p>

          <div className="gaya-pratinjau">
            <span
              className="folder kisi pratinjau"
              style={nilaiWarna ? { '--folder-warna': nilaiWarna } : undefined}
            >
              <span className="folder-ikon">
                <Pratinjau size={26} strokeWidth={1.6} />
              </span>
            </span>
          </div>

          <div className="gaya-blok">
            <h4>Warna</h4>
            <div className="gaya-warna">
              {WARNA_FOLDER.map((w) => (
                <button
                  key={w.id}
                  className={`warna-titik ${warna === w.id ? 'terpilih' : ''} ${
                    w.nilai ? '' : 'bawaan'
                  }`}
                  style={w.nilai ? { background: w.nilai } : undefined}
                  onClick={() => setWarna(w.id)}
                  aria-label={w.label}
                  aria-pressed={warna === w.id}
                >
                  {warna === w.id && <Check size={13} strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          <div className="gaya-blok">
            <h4>Ikon</h4>
            <div className="gaya-ikon">
              {IKON_FOLDER.map(({ id, Ikon }) => (
                <button
                  key={id}
                  className={`ikon-pilih ${ikon === id ? 'terpilih' : ''}`}
                  onClick={() => setIkon(id)}
                  aria-label={id}
                  aria-pressed={ikon === id}
                >
                  <Ikon size={19} strokeWidth={1.7} />
                </button>
              ))}
            </div>
          </div>

          {error && <p className="notice bad">{error}</p>}

          <div className="row">
            <button className="btn ghost" onClick={tutup} disabled={sibuk}>
              Batal
            </button>
            <button
              className="btn"
              disabled={sibuk}
              onClick={async () => {
                setSibuk(true);
                setError('');
                try {
                  // 'default' dan 'folder' dikirim sebagai null: itu artinya
                  // "tidak ada pilihan", dan server membuang barisnya alih-alih
                  // menyimpan pilihan yang sama dengan bawaan.
                  await onSimpan({
                    warna: warna === 'default' ? null : warna,
                    ikon: ikon === 'folder' ? null : ikon,
                  });
                  tutup();
                } catch (err) {
                  setError(err.message);
                  setSibuk(false);
                }
              }}
            >
              {sibuk ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}