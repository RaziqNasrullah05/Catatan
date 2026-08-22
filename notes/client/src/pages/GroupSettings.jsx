import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Crown, LogOut, Trash2, UserPlus, Users } from 'lucide-react';
import { api } from '../api.js';
import { withMinDelay } from '../utils.js';
import { PeopleSkeleton } from '../components/Skeleton.jsx';
import GroupConfirm from '../components/GroupConfirm.jsx';
import { KEMBALI_KE_GRUP } from '../nav.js';

/** Jeda sebelum kata kunci dikirim, supaya tiap huruf tidak jadi satu permintaan. */
const JEDA_SARAN = 250;

export default function GroupSettings({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [grup, setGrup] = useState(null);
  const [orang, setOrang] = useState('');
  const [saran, setSaran] = useState([]);
  const [pesan, setPesan] = useState('');
  const [error, setError] = useState('');
  const [konfirmasi, setKonfirmasi] = useState(null);

  const muat = () =>
    withMinDelay(api.getGrup(id))
      .then((d) => setGrup(d.grup))
      .catch((err) => setError(err.message));

  useEffect(() => {
    muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const pemimpin = grup?.peran === 'leader';

  /**
   * Saran nama pengguna saat mengetik. Hasil yang datang terlambat dibuang
   * lewat penanda urutan: tanpa itu, jawaban untuk "si" bisa tiba setelah
   * jawaban untuk "sig" dan menimpanya dengan daftar yang lebih lama.
   */
  const urutan = useRef(0);
  useEffect(() => {
    if (!pemimpin) return undefined;
    const kata = orang.trim();
    // Alamat email tidak dicari: server sengaja hanya mencocokkan nama
    // pengguna, jadi mengirimkannya cuma menghasilkan daftar kosong.
    const sepertiEmail = kata.includes('@') && !kata.startsWith('@');
    if (kata.length < 2 || sepertiEmail) {
      setSaran([]);
      return undefined;
    }
    const punyaKu = ++urutan.current;
    const timer = setTimeout(() => {
      api
        .saranAnggota(id, kata)
        .then((d) => {
          if (punyaKu === urutan.current) setSaran(d.orang);
        })
        .catch(() => {
          if (punyaKu === urutan.current) setSaran([]);
        });
    }, JEDA_SARAN);
    return () => clearTimeout(timer);
  }, [orang, id, pemimpin]);

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

  async function undang(isi) {
    const nama = (isi ?? orang).trim();
    if (!nama) return;
    setError('');
    setPesan('');
    try {
      const res = await api.undangKeGrup(id, nama);
      setOrang('');
      setSaran([]);
      setPesan(`Undangan dikirim ke ${res.nama}. Menunggu jawabannya.`);
      await muat();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app settings-page m3-scope">
      <header className="topbar">
        <button className="icon-btn" aria-label="Kembali" onClick={() => navigate(`/grup/${id}`)}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="wordmark">Pengaturan grup</span>
      </header>

      <div className="scroll">
        <div className="m3-container">
          {!grup ? (
            <PeopleSkeleton />
          ) : (
            <>
              <h2 className="m3-section-title">{grup.nama}</h2>

              {error && <p className="m3-note bad">{error}</p>}
              {pesan && <p className="m3-note">{pesan}</p>}

              {pemimpin && (
                <div className="m3-card pad">
                  <label className="m3-field">
                    <span>Undang orang</span>
                    <div className="m3-baris">
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
                        className="m3-btn tonal bulat"
                        onClick={() => undang()}
                        disabled={!orang.trim()}
                        aria-label="Kirim undangan"
                        title="Kirim undangan"
                      >
                        <UserPlus size={18} strokeWidth={1.9} />
                      </button>
                    </div>
                  </label>

                  {saran.length > 0 && (
                    <div className="m3-saran" role="listbox" aria-label="Saran orang">
                      {saran.map((s) => (
                        <button key={s.id} role="option" aria-selected="false" onClick={() => undang(s.nama)}>
                          <span className="m3-avatar kecil">{s.nama.replace('@', '')[0]}</span>
                          <span>{s.nama}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="m3-hint">
                    Saran mencari nama pengguna. Yang sudah jadi anggota atau sudah diundang tidak
                    ikut muncul. Untuk mengundang lewat email, ketik alamatnya lengkap.
                  </p>
                </div>
              )}

              <h2 className="m3-section-title">Anggota · {grup.anggota.length}</h2>
              <div className="m3-card">
                {grup.anggota.map((a, i) => (
                  <div key={a.id}>
                    {i > 0 && <div className="m3-divider" />}
                    <div className="m3-row">
                      <span className="m3-avatar">{a.nama.replace('@', '')[0]}</span>
                      <div className="m3-body">
                        <div className="m3-title">
                          {a.nama}
                          {a.peran === 'leader' && <span className="m3-status">Pemimpin</span>}
                          {a.id === user?.id && <span className="m3-status abu">Kamu</span>}
                        </div>
                        <p className="m3-desc">{a.email}</p>
                      </div>
                      {pemimpin && a.id !== user?.id && (
                        <span className="m3-action grup-aksi">
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
                  </div>
                ))}
              </div>

              {grup.undangan.length > 0 && (
                <>
                  <h2 className="m3-section-title">Menunggu jawaban · {grup.undangan.length}</h2>
                  <div className="m3-card">
                    {grup.undangan.map((u, i) => (
                      <div key={u.id}>
                        {i > 0 && <div className="m3-divider" />}
                        <div className="m3-row">
                          <span className="m3-avatar kosong">{u.nama.replace('@', '')[0]}</span>
                          <div className="m3-body">
                            <div className="m3-title">{u.nama}</div>
                            <p className="m3-desc">Belum menjawab undangan</p>
                          </div>
                          {pemimpin && (
                            <span className="m3-action">
                              <button
                                className="m3-btn text"
                                onClick={() =>
                                  jalankan(() => api.batalUndangan(id, u.id), 'Undangan dibatalkan.')
                                }
                              >
                                Batalkan
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <h2 className="m3-section-title">Grup ini</h2>
              <div className="m3-card">
                <div className="m3-row">
                  <span className="m3-icon">
                    <Users size={19} strokeWidth={1.8} />
                  </span>
                  <div className="m3-body">
                    <div className="m3-title">
                      {pemimpin ? 'Bubarkan grup' : 'Keluar dari grup'}
                    </div>
                    <p className="m3-desc">
                      {pemimpin
                        ? 'Grup hilang untuk semua anggotanya. Catatan milik masing-masing orang tetap aman.'
                        : 'Kamu berhenti melihat catatan yang dibagikan di sini. Tidak ada yang terhapus.'}
                    </p>
                  </div>
                  <span className="m3-action">
                    <button
                      className="m3-btn danger-text"
                      onClick={() => setKonfirmasi({ jenis: pemimpin ? 'bubarkan' : 'keluar' })}
                    >
                      {pemimpin ? (
                        <Trash2 size={16} strokeWidth={1.9} />
                      ) : (
                        <LogOut size={16} strokeWidth={1.9} />
                      )}
                      {pemimpin ? 'Bubarkan' : 'Keluar'}
                    </button>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {konfirmasi && (
        <GroupConfirm
          data={konfirmasi}
          grup={grup}
          onBatal={() => setKonfirmasi(null)}
          onLanjut={async () => {
            const k = konfirmasi;
            setKonfirmasi(null);
            if (k.jenis === 'bubarkan') {
              await jalankan(() => api.deleteGrup(id));
              navigate('/', KEMBALI_KE_GRUP);
            } else if (k.jenis === 'keluar') {
              await jalankan(() => api.keluarGrup(id));
              navigate('/', KEMBALI_KE_GRUP);
            } else if (k.jenis === 'keluarkan') {
              await jalankan(
                () => api.keluarkanAnggota(id, k.anggota.id),
                `${k.anggota.nama} dikeluarkan.`
              );
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