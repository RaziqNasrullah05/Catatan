import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePanel } from '../panel.js';
import { ArrowLeft, Search, Settings2, Users, X } from 'lucide-react';
import { api } from '../api.js';
import { withMinDelay } from '../utils.js';
import { NoteListSkeleton } from '../components/Skeleton.jsx';
import GroupConfirm from '../components/GroupConfirm.jsx';
import Sheet from '../components/Sheet.jsx';
import { KEMBALI_KE_GRUP } from '../nav.js';

/** Penanda "aku sedang masuk ke subhalaman grup ini". Lihat penjelasan di bawah. */
const KUNCI_KEMBALI = 'grup-kembali';

/** Lama menekan sebelum lembar tindakan terbuka. Sama dengan kartu tugas. */
const HOLD_MS = 420;

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
  const [tab, setTab] = useState('catatan');
  const [cari, setCari] = useState('');
  // Catatan yang lembar tindakannya sedang terbuka karena ditekan lama.
  const [aksiUntuk, setAksiUntuk] = useState(null);

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
   * Penyaringan dan pengelompokan dilakukan di peramban. Seluruh catatan grup
   * memang sudah diambil sekaligus, jadi mengetik tidak menyentuh jaringan —
   * dan pada isi sebanyak ini itu terasa jauh lebih ringan daripada menunggu.
   */
  const kata = cari.trim().toLowerCase();
  const tersaring = (catatan || []).filter(
    (c) =>
      !kata ||
      (c.title || '').toLowerCase().includes(kata) ||
      (c.penulis || '').toLowerCase().includes(kata) ||
      (c.excerpt || '').toLowerCase().includes(kata)
  );

  /**
   * Dikelompokkan menurut penulis, milik sendiri selalu di puncak.
   *
   * Pada dua puluh catatan atau lebih, "punya siapa" adalah cara orang mengingat
   * isinya — jauh lebih sering daripada "kapan ditambahkan", yang jadi dasar
   * urutan sebelumnya. Kelompok juga memberi mata tempat beristirahat: daftar
   * rata dua puluh baris terbaca sebagai satu tembok.
   */
  const perPenulis = (() => {
    const peta = new Map();
    for (const c of tersaring) {
      const kunci = c.milikku ? 'Punyamu' : c.penulis || 'Tanpa nama';
      if (!peta.has(kunci)) peta.set(kunci, []);
      peta.get(kunci).push(c);
    }
    return [...peta.entries()].sort(([a], [b]) =>
      a === 'Punyamu' ? -1 : b === 'Punyamu' ? 1 : a.localeCompare(b, 'id')
    );
  })();

  /**
   * Tekan lama membuka pilihan tindakan, menggantikan dua tombol ikon yang dulu
   * menempel di setiap baris. Dua puluh baris berarti empat puluh tombol yang
   * hampir tidak pernah disentuh, dan semuanya memakan lebar yang dibutuhkan
   * judul. Jari yang bergeser membatalkannya, karena itu tandanya menggulir.
   */
  const timer = useRef(null);
  const awal = useRef(null);
  const tekanTerpakai = useRef(false);

  const batalTekan = () => clearTimeout(timer.current);

  const mulaiTekan = (c, e) => {
    if (!c.milikku && !pemimpin) return;
    awal.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      tekanTerpakai.current = true;
      setAksiUntuk(c);
    }, HOLD_MS);
  };

  const gerak = (e) => {
    const a = awal.current;
    if (a && Math.hypot(e.clientX - a.x, e.clientY - a.y) > 10) batalTekan();
  };

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

      <nav className="grup-tabs" role="tablist" aria-label="Bagian grup">
        {['catatan', 'pengumuman'].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t === 'catatan' ? 'Catatan' : 'Pengumuman'}
            {t === 'catatan' && catatan && <span className="grup-tab-jumlah">{catatan.length}</span>}
          </button>
        ))}
      </nav>

      {tab === 'catatan' ? (
        <>
          {/* Kolom pencarian selalu ada, tidak muncul-hilang mengikuti gulir
              seperti di daftar catatan pribadi: di sini ia satu-satunya cara
              menemukan sesuatu begitu isinya lewat dua puluhan. */}
          <div className="grup-cari">
            <Search size={16} strokeWidth={1.9} />
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari judul, penulis, atau isi"
              aria-label="Cari catatan di grup ini"
            />
            {cari && (
              <button className="icon-btn kecil" aria-label="Kosongkan pencarian" onClick={() => setCari('')}>
                <X size={15} strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="scroll">
            {error && <p className="notice bad" style={{ margin: '10px 16px' }}>{error}</p>}

            {catatan === null ? (
              <NoteListSkeleton />
            ) : catatan.length === 0 ? (
              <div className="empty">
                <h2>Belum ada catatan di sini</h2>
                <p>Tekan lama sebuah catatan di tab Catatan, lalu pilih “Simpan ke grup”.</p>
              </div>
            ) : tersaring.length === 0 ? (
              <div className="empty">
                <h2>Tidak ada yang cocok</h2>
                <p>Tidak ada catatan yang cocok dengan “{cari.trim()}”.</p>
              </div>
            ) : (
              /* Dikelompokkan menurut penulis. Pada dua puluh catatan atau lebih,
                 "punya siapa" adalah cara orang mengingat isinya — jauh lebih
                 sering daripada "kapan ditambahkan". Kelompok milik sendiri
                 selalu di puncak. */
              perPenulis.map(([penulis, daftar]) => (
                <section key={penulis} className="grup-kelompok">
                  <h3>
                    {penulis}
                    <span>{daftar.length}</span>
                  </h3>
                  {daftar.map((c) => (
                    <button
                      key={c.id}
                      className="grup-item"
                      onPointerDown={(e) => mulaiTekan(c, e)}
                      onPointerMove={gerak}
                      onPointerUp={batalTekan}
                      onPointerCancel={batalTekan}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (c.milikku || pemimpin) setAksiUntuk(c);
                      }}
                      onClick={() => {
                        if (tekanTerpakai.current) {
                          tekanTerpakai.current = false;
                          return;
                        }
                        keSubhalaman(`/catatan/${c.id}`, { state: { dariGrup: id } });
                      }}
                    >
                      <span className="grup-item-judul">
                        {c.title || 'Tanpa judul'}
                        {c.kolaborator?.length > 0 && (
                          <span className="grup-item-kolab" title={`Disunting bersama ${c.kolaborator.join(', ')}`}>
                            <Users size={11} strokeWidth={2.2} />
                            {c.kolaborator.length}
                          </span>
                        )}
                      </span>
                      {c.excerpt && <span className="grup-item-cuplik">{c.excerpt}</span>}
                    </button>
                  ))}
                </section>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="scroll">
          <div className="empty">
            <h2>Pengumuman</h2>
            <p>Belum ada apa-apa di sini. Tempat ini disiapkan lebih dulu; isinya menyusul.</p>
          </div>
        </div>
      )}

      {aksiUntuk && (
        <Sheet onTutup={() => setAksiUntuk(null)}>
          {(tutupLembar) => (
            <>
              <h3>{aksiUntuk.title || 'Tanpa judul'}</h3>
              <p>Ditulis {aksiUntuk.milikku ? 'olehmu' : aksiUntuk.penulis}.</p>
              <div className="pilih-grup">
                {pemimpin && (
                  <button
                    className="grup-aksi-baris"
                    onClick={() => {
                      const c = aksiUntuk;
                      tutupLembar();
                      setKolabUntuk(c);
                    }}
                  >
                    <Users size={17} strokeWidth={1.8} />
                    Atur siapa yang boleh menyunting
                  </button>
                )}
                <button
                  className="grup-aksi-baris bahaya"
                  onClick={() => {
                    const c = aksiUntuk;
                    tutupLembar();
                    setKonfirmasi({ jenis: 'keluarkanCatatan', catatan: c });
                  }}
                >
                  <X size={17} strokeWidth={1.9} />
                  Keluarkan dari grup
                </button>
              </div>
              <div className="row">
                <button className="btn ghost" onClick={tutupLembar}>
                  Batal
                </button>
              </div>
            </>
          )}
        </Sheet>
      )}

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