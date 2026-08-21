import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';
import { api } from '../api.js';
import { withMinDelay } from '../utils.js';
import { NoteListSkeleton } from '../components/Skeleton.jsx';

function kapan(iso) {
  const beda = (Date.now() - new Date(iso).getTime()) / 1000;
  if (beda < 60) return 'baru saja';
  if (beda < 3600) return `${Math.floor(beda / 60)} menit lalu`;
  if (beda < 86400) return `${Math.floor(beda / 3600)} jam lalu`;
  if (beda < 604800) return `${Math.floor(beda / 86400)} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

const LABEL_STATUS = { diterima: 'Diterima', ditolak: 'Ditolak' };

export default function Notification() {
  const navigate = useNavigate();
  const [daftar, setDaftar] = useState(null);
  const [error, setError] = useState('');
  const [sibuk, setSibuk] = useState(null);

  useEffect(() => {
    let hidup = true;
    withMinDelay(api.listNotifikasi())
      .then((d) => {
        if (!hidup) return;
        setDaftar(d.notifikasi);
        // Ditandai dibaca begitu halamannya dibuka — titik hijau di bilah atas
        // menandakan "ada yang belum kamu lihat", bukan "ada yang belum dijawab".
        if (d.belumDibaca > 0) api.tandaiDibaca().catch(() => {});
      })
      .catch((err) => hidup && setError(err.message));
    return () => {
      hidup = false;
    };
  }, []);

  async function jawab(n, terima) {
    setError('');
    setSibuk(n.id);
    try {
      if (terima) await api.terimaNotifikasi(n.id);
      else await api.tolakNotifikasi(n.id);
      setDaftar((lama) =>
        lama.map((x) => (x.id === n.id ? { ...x, status: terima ? 'diterima' : 'ditolak' } : x))
      );
      if (terima && n.grupId) navigate(`/grup/${n.grupId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSibuk(null);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" aria-label="Kembali" onClick={() => navigate('/')}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="wordmark">Pemberitahuan</span>
      </header>

      <div className="scroll">
        {error && <p className="notice bad" style={{ margin: '10px 16px' }}>{error}</p>}
        {!daftar && <NoteListSkeleton layout="list" />}

        {daftar && daftar.length === 0 && (
          <div className="empty">
            <h2>Belum ada pemberitahuan</h2>
            <p>Undangan grup dan permintaan dari orang lain muncul di sini.</p>
          </div>
        )}

        {(daftar || []).map((n) => (
          <div key={n.id} className={`notif-row ${n.dibaca ? '' : 'is-baru'}`}>
            <span className="notif-ikon">
              <Bell size={17} strokeWidth={1.8} />
            </span>
            <div className="notif-isi">
              <p className="judul">{n.judul}</p>
              {n.isi && <p className="sub">{n.isi}</p>}
              <span className="waktu">{kapan(n.createdAt)}</span>

              {n.status === 'menunggu' ? (
                <div className="notif-aksi">
                  <button className="btn" disabled={sibuk === n.id} onClick={() => jawab(n, true)}>
                    Terima
                  </button>
                  <button className="btn ghost" disabled={sibuk === n.id} onClick={() => jawab(n, false)}>
                    Tolak
                  </button>
                </div>
              ) : (
                LABEL_STATUS[n.status] && <span className="notif-status">{LABEL_STATUS[n.status]}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}