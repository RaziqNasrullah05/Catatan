import { useEffect, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { api } from '../api.js';
import { withMinDelay } from '../utils.js';
import { PeopleSkeleton } from '../components/Skeleton.jsx';
import { usePanel } from '../panel.js';

/**
 * Daftar akun, sebagai halaman tersendiri.
 *
 * Sampai v1.45 ini kartu yang bisa dibuka-tutup di dalam Pengaturan. Bentuk itu
 * menyulitkan begitu daftarnya panjang: kolom pencarian dan hasilnya terdorong
 * jauh ke bawah oleh kartu-kartu di atasnya, dan menggulirnya berarti
 * menggulir seluruh halaman Pengaturan. Sebagai halaman sendiri, pencariannya
 * ada di puncak dan yang tergulir hanya daftarnya.
 */
export default function People({ user }) {
  /**
   * Tanpa animasi masuk. Halaman ini dibuka dari sebuah baris di dalam
   * Pengaturan, dan Pengaturan sendiri sudah masuk dari kanan — menggeser lagi
   * dari arah yang sama membuatnya terbaca seperti berpindah dua kali untuk
   * satu ketukan. Keluarnya tetap beranimasi: di situ layar memang pergi.
   */
  const { kelas, tutup } = usePanel('kanan', { tanpaMasuk: true });

  /**
   * Kembali ke bagian yang membuka halaman ini, bukan ke bagian pertama.
   * Daftar akun hanya bisa dijangkau dari "Undang orang", jadi mendarat di
   * "Keamanan" berarti pengguna harus mencari jalannya kembali sendiri.
   */
  const kembali = () => tutup('/pengaturan', { state: { section: 'undang' } });
  const [users, setUsers] = useState(null);
  const [cari, setCari] = useState('');
  const [error, setError] = useState('');

  const muat = () =>
    withMinDelay(api.users())
      .then((d) => setUsers(d.users))
      .catch((err) => {
        setError(err.message);
        setUsers([]);
      });

  useEffect(() => {
    muat();
  }, []);

  /**
   * Disaring di peramban, bukan lewat permintaan baru: seluruh daftar memang
   * sudah diambil sekaligus untuk menghitung jumlahnya, jadi mengetik tidak
   * perlu menyentuh jaringan sama sekali.
   */
  const kata = cari.trim().toLowerCase().replace(/^@/, '');
  const terpakai = kata
    ? (users || []).filter(
        (u) =>
          u.email.toLowerCase().includes(kata) || (u.username || '').toLowerCase().includes(kata)
      )
    : users || [];

  return (
    <div className={`app settings-page m3-scope ${kelas}`}>
      <header className="topbar">
        <button className="icon-btn" aria-label="Kembali" onClick={kembali}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="wordmark">Orang di aplikasi ini</span>
      </header>

      <div className="scroll">
        <div className="m3-container">
          <div className="m3-cari luar">
            <Search size={16} strokeWidth={1.9} />
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama pengguna atau email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              aria-label="Cari akun"
            />
          </div>

          {error && <p className="m3-note bad">{error}</p>}

          <h2 className="m3-section-title">
            {users ? `${terpakai.length} dari ${users.length} akun` : 'Memuat…'}
          </h2>

          {!users ? (
            <div className="m3-card">
              <PeopleSkeleton />
            </div>
          ) : terpakai.length === 0 ? (
            <div className="m3-card">
              <p className="m3-hint" style={{ padding: '18px 22px' }}>
                Tidak ada akun yang cocok dengan “{cari.trim()}”.
              </p>
            </div>
          ) : (
            <div className="m3-card">
              {terpakai.map((u, i) => (
                <div key={u.id}>
                  {i > 0 && <div className="m3-divider" />}
                  <div className="m3-row">
                    <span className="m3-avatar">{(u.username || u.email)[0]}</span>
                    <span className="m3-body">
                      <span className="m3-title">
                        {u.username ? `@${u.username}` : u.email}
                        {u.role === 'admin' && <span className="m3-status">Admin</span>}
                        {Boolean(u.disabled) && <span className="m3-status muted">Dicabut</span>}
                      </span>
                      {/* Nama pengguna jadi judul kalau ada, dan emailnya turun ke
                          baris keterangan — keduanya tetap terlihat, karena
                          pencarian di atas mencocokkan dua-duanya. */}
                      <p className="m3-desc">
                        {u.username ? `${u.email} · ` : ''}
                        {u.last_seen_at
                          ? `Terakhir aktif ${new Date(u.last_seen_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}`
                          : 'Belum pernah masuk'}
                      </p>
                    </span>
                    {u.id !== user?.id && (
                      <span className="m3-action">
                        <button
                          className={u.disabled ? 'm3-btn text' : 'm3-btn danger-text'}
                          onClick={async () => {
                            setError('');
                            try {
                              await api.setAccess(u.id, !u.disabled);
                              await muat();
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          {u.disabled ? 'Pulihkan' : 'Cabut'}
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="m3-hint" style={{ padding: '0 4px 24px' }}>
            Mencabut akses langsung menghapus semua sesi aktif orang tersebut.
          </p>
        </div>
      </div>
    </div>
  );
}