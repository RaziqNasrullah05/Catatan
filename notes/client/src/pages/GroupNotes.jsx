import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePanel } from '../panel.js';
import { ArrowLeft, FileText, Settings2, Users, X } from 'lucide-react';
import { api } from '../api.js';
import { withMinDelay } from '../utils.js';
import { NoteListSkeleton } from '../components/Skeleton.jsx';
import GroupConfirm from '../components/GroupConfirm.jsx';
import { KEMBALI_KE_GRUP } from '../nav.js';

/** Penanda "aku sedang masuk ke subhalaman grup ini". Lihat penjelasan di bawah. */
const KUNCI_KEMBALI = 'grup-kembali';

/**
 * Halaman utama sebuah grup: catatan yang disimpan di dalamnya.
 *
 * Dulu halaman ini juga memuat undangan, daftar anggota, dan tombol bubarkan —
 * empat urusan berbeda dalam satu gulungan panjang, dan yang paling sering
 * dibuka (catatan) berada paling bawah. Pengelolaan grup kini pindah ke
 * `/grup/:id/pengaturan`, dijangkau lewat tombol di kanan nama grup.
 */
export default function GroupNotes() {
  const { id } = useParams();
  const navigate = useNavigate();

  /**
   * Halaman ini naik dari bawah saat dibuka dari tab Grup, tapi tidak saat
   * kembali dari sesuatu yang terbuka di atasnya — catatan grup atau pengaturan
   * grup. Yang barusan terjadi di situ adalah menutup, bukan membuka.
   *
   * Penandanya dititipkan ke sessionStorage oleh halaman ini sendiri sesaat
   * sebelum ia pergi ke subhalaman, bukan dibawa balik oleh subhalamannya.
   * Bedanya penting: state navigasi hanya sampai kalau yang menavigasi adalah
   * tombol di dalam aplikasi. Gestur kembali dan tombol kembali peramban
   * memunculkan lagi entri riwayat lama, yang tidak membawa penanda apa pun —
   * dan di situlah animasinya dulu tetap muncul meski sudah "diperbaiki".
   *
   * Dibaca dan langsung dihapus, sehingga hanya berlaku untuk satu kali kembali.
   */
  const [tanpaMasuk] = useState(() => {
    try {
      const dari = sessionStorage.getItem(KUNCI_KEMBALI);
      if (dari === id) {
        sessionStorage.removeItem(KUNCI_KEMBALI);
        return true;
      }
    } catch {
      // Mode penyamaran di sebagian peramban melarang sessionStorage. Kehilangan
      // penanda cuma berarti animasinya muncul lagi, bukan halaman yang rusak.
    }
    return false;
  });
  const { kelas, tutup } = usePanel('naik', { tanpaMasuk });

  /** Dipanggil sesaat sebelum pergi ke sesuatu yang terbuka di atas halaman ini. */
  const keSubhalaman = (tujuan, opsi) => {
    try {
      sessionStorage.setItem(KUNCI_KEMBALI, id);
    } catch {
      // lihat catatan di atas
    }
    navigate(tujuan, opsi);
  };
  const [grup, setGrup] = useState(null);
  const [catatan, setCatatan] = useState(null);
  const [error, setError] = useState('');
  const [konfirmasi, setKonfirmasi] = useState(null);
  const [kolabUntuk, setKolabUntuk] = useState(null);

  // Kerangka pemuatannya ditahan seperti daftar lain (v1.7): tanpa jeda minimum
  // ia berkedip sekejap pada sambungan cepat, dan kedipan itu lebih kacau
  // daripada menunggu setengah detik.
  const muatCatatan = () =>
    withMinDelay(api.catatanGrup(id))
      .then((d) => setCatatan(d.catatan))
      .catch(() => setCatatan([]));

  useEffect(() => {
    withMinDelay(api.getGrup(id))
      .then((d) => setGrup(d.grup))
      .catch((err) => setError(err.message));
    muatCatatan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const pemimpin = grup?.peran === 'leader';

  /**
   * Menyegarkan daftar catatan setelah kolaborasi berubah. Nama kolaborator
   * ikut ditampilkan di setiap baris, jadi daftarnya harus dibaca ulang —
   * `grup` sendiri tidak memuat informasi itu.
   */
  async function setelahKolaborasi(aksi) {
    setError('');
    try {
      await aksi();
    } catch (err) {
      setError(err.message);
    }
    setKolabUntuk(null);
    await muatCatatan();
  }

  return (
    <div className={`app ${kelas}`}>
      <header className="topbar">
        <button className="icon-btn" aria-label="Kembali" onClick={() => tutup('/', KEMBALI_KE_GRUP)}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="wordmark">{grup?.nama || 'Grup'}</span>
        {grup && (
          <button
            className="icon-btn"
            aria-label="Pengaturan grup"
            title="Pengaturan grup"
            onClick={() => keSubhalaman(`/grup/${id}/pengaturan`)}
          >
            <Settings2 size={19} strokeWidth={1.75} />
          </button>
        )}
      </header>

      <div className="scroll">
        {error && <p className="notice bad" style={{ margin: '10px 16px' }}>{error}</p>}

        {catatan === null ? (
          <NoteListSkeleton />
        ) : catatan.length === 0 ? (
          <div className="empty">
            <h2>Belum ada catatan di sini</h2>
            <p>Tekan lama sebuah catatan di tab Catatan, lalu pilih “Simpan ke grup”.</p>
          </div>
        ) : (
          catatan.map((c) => (
            <div key={c.id} className="grup-row">
              <span className="grup-avatar catatan">
                <FileText size={17} strokeWidth={1.8} />
              </span>
              <button
                className="grup-teks tombol"
                onClick={() => keSubhalaman(`/catatan/${c.id}`, { state: { dariGrup: id } })}
              >
                <span className="nama">
                  {c.title || 'Tanpa judul'}
                  {c.milikku && <span className="tanda samar">Punyamu</span>}
                </span>
                <span className="sub">{c.penulis}{c.excerpt ? ` · ${c.excerpt}` : ''}</span>
                {c.kolaborator?.length > 0 && (
                  <span className="sub kolab">
                    <Users size={12} strokeWidth={2} /> {c.kolaborator.join(', ')}
                  </span>
                )}
              </button>
              {(c.milikku || pemimpin) && (
                <span className="grup-aksi">
                  {pemimpin && (
                    <button
                      className="icon-btn"
                      aria-label={`Atur kolaborasi untuk ${c.title || 'catatan'}`}
                      onClick={() => setKolabUntuk(c)}
                    >
                      <Users size={17} strokeWidth={1.8} />
                    </button>
                  )}
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
          ))
        )}
      </div>

      {kolabUntuk && grup && (
        <div className="sheet-backdrop" onClick={() => setKolabUntuk(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Siapa yang boleh ikut menyunting?</h3>
            <p>
              {kolabUntuk.milikku
                ? `Izin langsung berlaku karena “${kolabUntuk.title || 'Tanpa judul'}” tulisanmu sendiri.`
                : `Usulan dikirim ke ${kolabUntuk.penulis}. Izinnya berlaku setelah dia menyetujui.`}
            </p>

            <div className="pilih-grup">
              {grup.anggota
                .filter((a) => a.nama !== kolabUntuk.penulis)
                .map((a) => {
                  const sudah = kolabUntuk.kolaborator?.includes(a.nama);
                  return (
                    <div key={a.id} className="pilih-baris">
                      <span style={{ flex: 1 }}>{a.nama}</span>
                      {sudah ? (
                        <button
                          className="btn ghost kecil"
                          onClick={() =>
                            setelahKolaborasi(() => api.cabutKolaborasi(id, kolabUntuk.id, a.id))
                          }
                        >
                          Cabut
                        </button>
                      ) : (
                        <button
                          className="btn kecil"
                          onClick={() =>
                            setelahKolaborasi(() => api.usulKolaborasi(id, kolabUntuk.id, a.id))
                          }
                        >
                          Ajak
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="row">
              <button className="btn ghost" onClick={() => setKolabUntuk(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {konfirmasi && (
        <GroupConfirm
          data={konfirmasi}
          grup={grup}
          onBatal={() => setKonfirmasi(null)}
          onLanjut={async () => {
            const k = konfirmasi;
            setKonfirmasi(null);
            setError('');
            try {
              await api.keluarkanCatatan(id, k.catatan.id);
            } catch (err) {
              setError(err.message);
            }
            await muatCatatan();
          }}
        />
      )}
    </div>
  );
}