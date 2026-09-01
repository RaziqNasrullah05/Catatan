import { useState } from 'react';
import { Palette, Pencil } from 'lucide-react';
import Sheet from './Sheet.jsx';

/**
 * Menu yang muncul saat sebuah folder ditekan lama.
 *
 * Bentuknya mengikuti menu tekan-lama pada catatan: daftar tindakan, bukan
 * langsung membuka salah satunya. Versi pertama (v1.57) langsung membuka lembar
 * kustomisasi, dan itu menutup pintu bagi tindakan lain — tidak ada tempat
 * untuk "ganti nama" tanpa menambahkan gerakan baru yang harus dipelajari.
 */
export default function FolderMenu({ nama, onTutup, onKustomisasi, onGantiNama }) {
  const [mode, setMode] = useState('menu');
  const [teks, setTeks] = useState(nama);
  const [sibuk, setSibuk] = useState(false);
  const [error, setError] = useState('');

  if (mode === 'nama') {
    return (
      <Sheet onTutup={onTutup}>
        {(tutup) => (
          <>
            <h3>Ganti nama folder</h3>
            <p>
              Nama folder adalah tagnya. Menggantinya mengubah tag itu di semua catatan yang
              memakainya.
            </p>

            <label className="task-field">
              <span>Nama</span>
              <input
                value={teks}
                autoFocus
                onChange={(e) => setTeks(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                placeholder="Nama folder"
                aria-label="Nama folder"
              />
              <p className="task-hint">
                Kalau namanya sudah dipakai folder lain, keduanya digabung jadi satu.
              </p>
            </label>

            {error && <p className="notice bad">{error}</p>}

            <div className="row">
              <button className="btn ghost" onClick={tutup} disabled={sibuk}>
                Batal
              </button>
              <button
                className="btn"
                disabled={sibuk || !teks.trim() || teks.trim() === nama}
                onClick={async () => {
                  setSibuk(true);
                  setError('');
                  try {
                    await onGantiNama(teks.trim());
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

  return (
    <Sheet onTutup={onTutup}>
      {(tutup) => (
        <>
          <h3>{nama}</h3>
          <div className="pilih-grup">
            <button className="grup-aksi-baris" onClick={() => setMode('nama')}>
              <Pencil size={17} strokeWidth={1.8} />
              Ganti nama
            </button>
            <button
              className="grup-aksi-baris"
              onClick={() => {
                tutup();
                onKustomisasi();
              }}
            >
              <Palette size={17} strokeWidth={1.8} />
              Kustomisasi
            </button>
          </div>
          <div className="row">
            <button className="btn ghost" onClick={tutup}>
              Batal
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}