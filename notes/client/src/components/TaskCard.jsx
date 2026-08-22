import { useRef, useState } from 'react';
import { CalendarClock, Trash2 } from 'lucide-react';
import Sheet from './Sheet.jsx';

const HOLD_MS = 420;

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "22 Agu 2026" dari teks TTTT-BB-HH, tanpa melewati Date sama sekali. */
export function tanggalPendek(s) {
  if (!s) return '';
  const [t, b, h] = s.split('-');
  return `${+h} ${BULAN[+b - 1]} ${t}`;
}

/** Tanggal hari ini menurut jam perangkat, sebagai teks TTTT-BB-HH. */
export function hariIni() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Satu tugas sebagai kontainer: judul, tanggal dibuat, isi, lalu tenggat di
 * bawah garis pemisah.
 *
 * Tenggat dipisah garis, bukan ditaruh sebaris dengan tanggal dibuat, karena
 * keduanya menjawab hal yang berlawanan — satu bercerita dari mana tugas ini
 * datang, satu lagi menuntut sesuatu. Menyandingkannya membuat mata harus
 * membaca dua-duanya untuk tahu mana yang mendesak.
 *
 * Menyunting lewat tekan-lama, bukan ketukan biasa: mencentang selesai adalah
 * hal yang paling sering dilakukan pada tugas, dan ia tidak boleh kalah cepat
 * dari membuka formulir.
 */
export default function TaskCard({ tugas, onCentang, onSunting }) {
  const timer = useRef(null);
  const awal = useRef(null);
  const [ditekan, setDitekan] = useState(false);

  const batal = () => {
    clearTimeout(timer.current);
    setDitekan(false);
  };

  const mulaiTekan = (e) => {
    // Ketukan pada kotak centang bukan urusan tekan-lama.
    if (e.target.closest('.md-check, .task-hapus')) return;
    awal.current = { x: e.clientX, y: e.clientY };
    setDitekan(true);
    timer.current = setTimeout(() => {
      setDitekan(false);
      onSunting(tugas);
    }, HOLD_MS);
  };

  const gerak = (e) => {
    const a = awal.current;
    // Jari yang bergeser sedang menggulir, bukan menekan lama.
    if (a && Math.hypot(e.clientX - a.x, e.clientY - a.y) > 10) batal();
  };

  const lewat = tugas.tenggat && !tugas.selesai && tugas.tenggat < hariIni();

  return (
    <div
      className={`task-card ${tugas.selesai ? 'selesai' : ''} ${ditekan ? 'ditekan' : ''}`}
      onPointerDown={mulaiTekan}
      onPointerMove={gerak}
      onPointerUp={batal}
      onPointerCancel={batal}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="task-kepala">
        <input
          type="checkbox"
          className="md-check"
          checked={tugas.selesai}
          onChange={() => onCentang(tugas)}
          aria-label={`Tandai "${tugas.judul}" ${tugas.selesai ? 'belum selesai' : 'selesai'}`}
        />
        <div className="task-judul-blok">
          <h3>{tugas.judul}</h3>
          <span className="task-dibuat">Dibuat {tanggalPendek(tugas.createdAt.slice(0, 10))}</span>
        </div>
      </div>

      {tugas.isi && <p className="task-isi">{tugas.isi}</p>}

      {tugas.tenggat && (
        <>
          <div className="task-pisah" />
          <span className={`task-tenggat ${lewat ? 'lewat' : ''}`}>
            <CalendarClock size={13} strokeWidth={1.9} />
            Tenggat {tanggalPendek(tugas.tenggat)}
            {lewat && ' · terlewat'}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Formulir tugas, dipakai untuk membuat maupun mengubah.
 *
 * Satu komponen untuk dua keperluan karena isiannya persis sama; yang berbeda
 * hanya judul lembar dan adanya tombol hapus.
 */
export function TaskForm({ awal, onTutup, onSimpan, onHapus }) {
  const ubah = Boolean(awal.id);
  const [judul, setJudul] = useState(awal.judul || '');
  const [isi, setIsi] = useState(awal.isi || '');
  const [tenggat, setTenggat] = useState(awal.tenggat || '');
  const [error, setError] = useState('');
  const [sibuk, setSibuk] = useState(false);

  return (
    <Sheet onTutup={onTutup}>
      {(tutup) => (
        <>
          <h3>{ubah ? 'Ubah tugas' : 'Tugas baru'}</h3>

          <div className="acara-form">
            <label className="grup-field">
              <span>Judul</span>
              <input
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                placeholder="Apa yang harus dikerjakan"
                autoFocus={!ubah}
              />
            </label>

            <label className="grup-field">
              <span>Isi tugas</span>
              <textarea
                rows={3}
                value={isi}
                onChange={(e) => setIsi(e.target.value)}
                placeholder="Opsional"
              />
            </label>

            <label className="grup-field">
              <span>Tenggat</span>
              <input type="date" value={tenggat} onChange={(e) => setTenggat(e.target.value)} />
              <p className="m3-hint">Kosongkan kalau tidak ada tenggatnya.</p>
            </label>

            {error && <p className="m3-note bad">{error}</p>}
          </div>

          <div className="row">
            {ubah ? (
              <button
                className="btn ghost danger-text"
                disabled={sibuk}
                onClick={async () => {
                  setSibuk(true);
                  try {
                    await onHapus(awal);
                    tutup();
                  } catch (err) {
                    setError(err.message);
                    setSibuk(false);
                  }
                }}
              >
                <Trash2 size={16} strokeWidth={1.9} />
                Hapus
              </button>
            ) : (
              <button className="btn ghost" onClick={tutup} disabled={sibuk}>
                Batal
              </button>
            )}
            <button
              className="btn"
              disabled={sibuk || !judul.trim()}
              onClick={async () => {
                setSibuk(true);
                setError('');
                try {
                  await onSimpan({ judul: judul.trim(), isi, tenggat });
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