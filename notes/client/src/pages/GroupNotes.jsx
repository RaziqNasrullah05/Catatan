import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { usePanel } from '../panel.js';
import { ArrowLeft, FileText, Settings2, Users, X } from 'lucide-react';
import { api } from '../api.js';
import { withMinDelay } from '../utils.js';
import { NoteListSkeleton } from '../components/Skeleton.jsx';
import GroupConfirm from '../components/GroupConfirm.jsx';
import { KEMBALI_KE_GRUP } from '../nav.js';

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
  const location = useLocation();

  /**
   * Halaman ini naik dari bawah saat dibuka dari tab Grup. Tapi kembali dari
   * sebuah catatan grup juga memasang ulang halaman ini, dan menganimasikannya
   * lagi di situ terasa salah: yang barusan terjadi adalah menutup catatan yang
   * terbuka di atasnya, bukan membuka grupnya lagi. `NoteEditor` menitipkan
   * penanda lewat state navigasi; dibaca sekali saat dipasang supaya perubahan
   * state berikutnya tidak memicu animasi di tengah pemakaian.
   */
  const { kelas, tutup } = usePanel('naik', { tanpaMasuk: Boolean(location.state?.tanpaAnimasi) });
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
            onClick={() => navigate(`/grup/${id}/pengaturan`)}
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
                onClick={() => navigate(`/catatan/${c.id}`, { state: { dariGrup: id } })}
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