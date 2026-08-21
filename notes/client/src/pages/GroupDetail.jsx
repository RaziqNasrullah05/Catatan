import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Crown, FileText, LogOut, Trash2, UserPlus, X } from 'lucide-react';
import { api } from '../api.js';
import { withMinDelay } from '../utils.js';
import { PeopleSkeleton } from '../components/Skeleton.jsx';

export default function GroupDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [grup, setGrup] = useState(null);
  const [orang, setOrang] = useState('');
  const [pesan, setPesan] = useState('');
  const [error, setError] = useState('');
  const [konfirmasi, setKonfirmasi] = useState(null);
  const [catatan, setCatatan] = useState(null);

  const muat = () =>
    withMinDelay(api.getGrup(id))
      .then((d) => setGrup(d.grup))
      .catch((err) => setError(err.message));

  useEffect(() => {
    muat();
    api
      .catatanGrup(id)
      .then((d) => setCatatan(d.catatan))
      .catch(() => setCatatan([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const pemimpin = grup?.peran === 'leader';

  async function jalankan(aksi, sukses) {
    setError('');
    setPesan('');
    try {
      await aksi();
      if (sukses) setPesan(sukses);
      await muat();
    } catch (err) {
      setError(err.message);
    }
  }

  async function undang() {
    const isi = orang.trim();
    if (!isi) return;
    setError('');
    setPesan('');
    try {
      const res = await api.undangKeGrup(id, isi);
      setOrang('');
      setPesan(`Undangan dikirim ke ${res.nama}. Menunggu jawabannya.`);
      await muat();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" aria-label="Kembali" onClick={() => navigate('/')}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="wordmark">{grup?.nama || 'Grup'}</span>
      </header>

      <div className="scroll">
        {error && <p className="notice bad" style={{ margin: '10px 16px' }}>{error}</p>}
        {pesan && <p className="notice" style={{ margin: '10px 16px' }}>{pesan}</p>}
        {!grup && <PeopleSkeleton />}

        {grup && (
          <>
            {pemimpin && (
              <div className="grup-undang">
                <label className="grup-field">
                  <span>Undang orang</span>
                  <div className="baris">
                    <input
                      value={orang}
                      onChange={(e) => setOrang(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && undang()}
                      placeholder="nama pengguna atau email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck="false"
                      aria-label="Nama pengguna atau email orang yang diundang"
                    />
                    <button
                      className="btn kotak"
                      onClick={undang}
                      disabled={!orang.trim()}
                      aria-label="Kirim undangan"
                      title="Kirim undangan"
                    >
                      <UserPlus size={18} strokeWidth={1.9} />
                    </button>
                  </div>
                </label>
              </div>
            )}

            <h3 className="grup-judul">Catatan · {catatan?.length ?? 0}</h3>
            {catatan?.length === 0 && (
              <p className="grup-kosong">
                Belum ada catatan di sini. Tekan lama sebuah catatan di tab Catatan, lalu pilih
                “Simpan ke grup”.
              </p>
            )}
            {(catatan || []).map((c) => (
              <div key={c.id} className="grup-row">
                <span className="grup-avatar catatan">
                  <FileText size={17} strokeWidth={1.8} />
                </span>
                <button className="grup-teks tombol" onClick={() => navigate(`/catatan/${c.id}`)}>
                  <span className="nama">
                    {c.title || 'Tanpa judul'}
                    {c.milikku && <span className="tanda samar">Punyamu</span>}
                  </span>
                  <span className="sub">{c.penulis}{c.excerpt ? ` · ${c.excerpt}` : ''}</span>
                </button>
                {(c.milikku || pemimpin) && (
                  <span className="grup-aksi">
                    <button
                      className="icon-btn"
                      aria-label={`Keluarkan ${c.title || 'catatan'} dari grup`}
                      onClick={() => setKonfirmasi({ jenis: 'keluarkanCatatan', catatan: c })}
                    >
                      <X size={17} strokeWidth={1.9} />
                    </button>
                  </span>
                )}
              </div>
            ))}

            <h3 className="grup-judul">Anggota · {grup.anggota.length}</h3>
            {grup.anggota.map((a) => (
              <div key={a.id} className="grup-row">
                <span className="grup-avatar">{a.nama.replace('@', '')[0]}</span>
                <span className="grup-teks">
                  <span className="nama">
                    {a.nama}
                    {a.peran === 'leader' && <span className="tanda">Pemimpin</span>}
                    {a.id === user?.id && <span className="tanda samar">Kamu</span>}
                  </span>
                  <span className="sub">{a.email}</span>
                </span>
                {pemimpin && a.id !== user?.id && (
                  <span className="grup-aksi">
                    <button
                      className="icon-btn"
                      aria-label={`Jadikan ${a.nama} pemimpin`}
                      onClick={() => setKonfirmasi({ jenis: 'alihkan', anggota: a })}
                    >
                      <Crown size={17} strokeWidth={1.8} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`Keluarkan ${a.nama}`}
                      onClick={() => setKonfirmasi({ jenis: 'keluarkan', anggota: a })}
                    >
                      <Trash2 size={17} strokeWidth={1.8} />
                    </button>
                  </span>
                )}
              </div>
            ))}

            {grup.undangan.length > 0 && (
              <>
                <h3 className="grup-judul">Menunggu jawaban · {grup.undangan.length}</h3>
                {grup.undangan.map((u) => (
                  <div key={u.id} className="grup-row samar">
                    <span className="grup-avatar kosong">{u.nama.replace('@', '')[0]}</span>
                    <span className="grup-teks">
                      <span className="nama">{u.nama}</span>
                      <span className="sub">Belum menjawab undangan</span>
                    </span>
                    {pemimpin && (
                      <span className="grup-aksi">
                        <button
                          className="btn ghost kecil"
                          onClick={() => jalankan(() => api.batalUndangan(id, u.id), 'Undangan dibatalkan.')}
                        >
                          Batalkan
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}

            <div className="grup-bawah">
              {pemimpin ? (
                <button className="btn danger" onClick={() => setKonfirmasi({ jenis: 'bubarkan' })}>
                  <Trash2 size={16} strokeWidth={1.9} />
                  Bubarkan grup
                </button>
              ) : (
                <button className="btn ghost" onClick={() => setKonfirmasi({ jenis: 'keluar' })}>
                  <LogOut size={16} strokeWidth={1.9} />
                  Keluar dari grup
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {konfirmasi && (
        <Konfirmasi
          data={konfirmasi}
          grup={grup}
          onBatal={() => setKonfirmasi(null)}
          onLanjut={async () => {
            const k = konfirmasi;
            setKonfirmasi(null);
            if (k.jenis === 'bubarkan') {
              await jalankan(() => api.deleteGrup(id));
              navigate('/');
            } else if (k.jenis === 'keluar') {
              await jalankan(() => api.keluarGrup(id));
              navigate('/');
            } else if (k.jenis === 'keluarkan') {
              await jalankan(() => api.keluarkanAnggota(id, k.anggota.id), `${k.anggota.nama} dikeluarkan.`);
            } else if (k.jenis === 'keluarkanCatatan') {
              await jalankan(() => api.keluarkanCatatan(id, k.catatan.id));
              const d = await api.catatanGrup(id).catch(() => ({ catatan: [] }));
              setCatatan(d.catatan);
            } else if (k.jenis === 'alihkan') {
              await jalankan(
                () => api.alihkanPemimpin(id, k.anggota.id),
                `${k.anggota.nama} kini pemimpin grup ini.`
              );
            }
          }}
        />
      )}
    </div>
  );
}

function Konfirmasi({ data, grup, onBatal, onLanjut }) {
  const teks = {
    bubarkan: {
      judul: 'Bubarkan grup ini?',
      isi: `“${grup?.nama}” hilang untuk semua anggotanya. Catatan milik masing-masing orang tetap aman — yang hilang hanya wadahnya.`,
      tombol: 'Bubarkan',
      bahaya: true,
    },
    keluar: {
      judul: 'Keluar dari grup ini?',
      isi: 'Kamu berhenti melihat catatan yang dibagikan di sini, dan catatanmu sendiri ikut keluar dari grup. Tidak ada yang terhapus.',
      tombol: 'Keluar',
      bahaya: true,
    },
    keluarkan: {
      judul: `Keluarkan ${data.anggota?.nama}?`,
      isi: 'Dia berhenti melihat catatan grup ini, dan catatannya ikut keluar dari grup. Kamu bisa mengundangnya lagi kapan saja.',
      tombol: 'Keluarkan',
      bahaya: true,
    },
    keluarkanCatatan: {
      judul: 'Keluarkan catatan dari grup?',
      isi: `“${data.catatan?.title || 'Tanpa judul'}” berhenti terlihat oleh anggota grup ini. Catatannya sendiri tidak terhapus.`,
      tombol: 'Keluarkan',
      bahaya: true,
    },
    alihkan: {
      judul: `Jadikan ${data.anggota?.nama} pemimpin?`,
      isi: 'Kamu berubah jadi anggota biasa dan kehilangan wewenang mengundang, mengeluarkan, serta membubarkan grup. Ini tidak bisa kamu batalkan sendiri.',
      tombol: 'Alihkan',
      bahaya: false,
    },
  }[data.jenis];

  return (
    <div className="sheet-backdrop" onClick={onBatal}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>{teks.judul}</h3>
        <p>{teks.isi}</p>
        <div className="row">
          <button className="btn ghost" onClick={onBatal}>
            Batal
          </button>
          <button className={teks.bahaya ? 'btn danger' : 'btn'} onClick={onLanjut}>
            {teks.tombol}
          </button>
        </div>
      </div>
    </div>
  );
}