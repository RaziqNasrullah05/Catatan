import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Repeat, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import PullRefresh from './PullRefresh.jsx';
import { withMinDelay } from '../utils.js';

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const LABEL_ULANG = {
  harian: 'Tiap hari',
  mingguan: 'Tiap minggu',
  bulanan: 'Tiap bulan',
  tahunan: 'Tiap tahun',
};

/** Tanggal hari ini menurut jam perangkat, sebagai teks TTTT-BB-HH. */
function hariIni() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const iso = (tahun, bulan, tgl) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${tahun}-${p(bulan + 1)}-${p(tgl)}`;
};

/** Enam baris tujuh kolom, termasuk tanggal bulan sebelah yang menutup barisnya. */
function petakBulan(tahun, bulan) {
  const awal = new Date(Date.UTC(tahun, bulan, 1)).getUTCDay();
  const jumlah = new Date(Date.UTC(tahun, bulan + 1, 0)).getUTCDate();
  const sel = [];
  for (let i = 0; i < awal; i++) sel.push(null);
  for (let t = 1; t <= jumlah; t++) sel.push(iso(tahun, bulan, t));
  while (sel.length % 7 !== 0) sel.push(null);
  return sel;
}

function tanggalPanjang(s) {
  const d = new Date(`${s}T00:00:00`);
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "Hari ini" dan "Besok" lebih mudah dibaca daripada tanggalnya. */
function kepalaTanggal(s, ini) {
  if (s === ini) return 'Hari ini';
  const besok = new Date(`${ini}T00:00:00`);
  besok.setDate(besok.getDate() + 1);
  const p = (n) => String(n).padStart(2, '0');
  const isoBesok = `${besok.getFullYear()}-${p(besok.getMonth() + 1)}-${p(besok.getDate())}`;
  if (s === isoBesok) return 'Besok';
  return tanggalPanjang(s);
}

const jam = (a) => (a.mulai ? `${a.mulai}${a.selesai ? `–${a.selesai}` : ''}` : 'Sepanjang hari');

export default function Agenda({ aktif = true }) {
  const ini = hariIni();
  const [kursor, setKursor] = useState(() => ({ tahun: +ini.slice(0, 4), bulan: +ini.slice(5, 7) - 1 }));
  const [acara, setAcara] = useState(null);
  const [dipilih, setDipilih] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [hapus, setHapus] = useState(null);
  const [muatUlang, setMuatUlang] = useState(0);
  // Kalender menempel di puncak begitu kisinya tergulir keluar layar.
  const [menempel, setMenempel] = useState(false);
  const penjaga = useRef(null);

  const sel = useMemo(() => petakBulan(kursor.tahun, kursor.bulan), [kursor]);

  useEffect(() => {
    const isiSel = sel.filter(Boolean);
    // Rentangnya sedikit lebih lebar dari bulan yang tampil, supaya daftar
    // "yang akan datang" tetap terisi saat bulan berjalan hampir habis.
    const dari = isiSel[0];
    const akhirBulan = isiSel[isiSel.length - 1];
    const sampai = akhirBulan > ini ? akhirBulan : ini;
    let hidup = true;
    api
      .listAcara(dari, sampai)
      .then((d) => hidup && setAcara(d.acara))
      .catch((err) => hidup && setError(err.message));
    return () => {
      hidup = false;
    };
  }, [sel, ini, muatUlang]);

  const perTanggal = useMemo(() => {
    const m = new Map();
    for (const a of acara || []) {
      if (!m.has(a.tanggal)) m.set(a.tanggal, []);
      m.get(a.tanggal).push(a);
    }
    return m;
  }, [acara]);

  // Daftar di bawah kisi: acara yang belum lewat, atau isi tanggal yang diketuk.
  const daftar = useMemo(() => {
    const semua = acara || [];
    return dipilih ? semua.filter((a) => a.tanggal === dipilih) : semua.filter((a) => a.tanggal >= ini);
  }, [acara, dipilih, ini]);

  const kelompok = useMemo(() => {
    const out = [];
    for (const a of daftar) {
      const akhir = out[out.length - 1];
      if (akhir && akhir.tanggal === a.tanggal) akhir.isi.push(a);
      else out.push({ tanggal: a.tanggal, isi: [a] });
    }
    return out;
  }, [daftar]);

  /**
   * Tarik-untuk-muat-ulang. `muatUlang` hanya memicu efek pemuatan; ia tidak
   * memberi tahu kapan datanya sampai, sedangkan PullRefresh menahan batangnya
   * sampai janji yang dikembalikan selesai. Jadi permintaannya diulang di sini
   * dan hasilnya dipasang langsung.
   */
  const muatUlangTarik = useCallback(async () => {
    const isiSel = sel.filter(Boolean);
    const akhirBulan = isiSel[isiSel.length - 1];
    try {
      const d = await withMinDelay(api.listAcara(isiSel[0], akhirBulan > ini ? akhirBulan : ini));
      setAcara(d.acara);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [sel, ini]);

  /**
   * Kalender lengket. Sebuah penjaga setinggi nol ditaruh tepat di bawah kisi;
   * begitu ia keluar dari puncak daerah gulir, kalender dianggap menempel dan
   * isinya diburamkan. IntersectionObserver dipilih daripada kejadian scroll
   * karena ia tidak menjalankan apa pun di setiap frame gulir.
   */
  useEffect(() => {
    const el = penjaga.current;
    if (!el) return undefined;
    const pengamat = new IntersectionObserver(
      ([masuk]) => setMenempel(!masuk.isIntersecting),
      { threshold: 0 }
    );
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, []);

  const geserBulan = (arah) => {
    setDipilih(null);
    setKursor(({ tahun, bulan }) => {
      const b = bulan + arah;
      if (b < 0) return { tahun: tahun - 1, bulan: 11 };
      if (b > 11) return { tahun: tahun + 1, bulan: 0 };
      return { tahun, bulan: b };
    });
  };

  return (
    <>
      <PullRefresh onRefresh={muatUlangTarik} className="agenda" role="tabpanel" aria-label="Agenda">
      <div className={`kalender ${menempel ? 'menempel' : ''}`}>
        <div className="kalender-kepala">
          <button className="icon-btn" aria-label="Bulan sebelumnya" onClick={() => geserBulan(-1)}>
            <ChevronLeft size={19} strokeWidth={1.8} />
          </button>
          <span className="judul-bulan">
            {BULAN[kursor.bulan]} {kursor.tahun}
          </span>
          <button className="icon-btn" aria-label="Bulan berikutnya" onClick={() => geserBulan(1)}>
            <ChevronRight size={19} strokeWidth={1.8} />
          </button>
        </div>

        <div className="kalender-hari" aria-hidden="true">
          {HARI.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>

        <div className="kalender-kisi" role="grid">
          {sel.map((tgl, i) => {
            if (!tgl) return <span key={`kosong-${i}`} className="sel kosong" />;
            // Titik menandai "ada yang menunggu". Tanggal yang sudah lewat tidak
            // menunggu apa pun lagi, jadi titiknya dilepas — kisi bulan berjalan
            // jadi hanya berisi penanda yang masih berarti.
            const jumlah = tgl >= ini ? perTanggal.get(tgl)?.length ?? 0 : 0;
            return (
              <button
                key={tgl}
                role="gridcell"
                className={`sel ${tgl === ini ? 'ini' : ''} ${tgl === dipilih ? 'dipilih' : ''}`}
                aria-label={`${tanggalPanjang(tgl)}${jumlah ? `, ${jumlah} acara` : ''}`}
                aria-pressed={tgl === dipilih}
                onClick={() => setDipilih((lama) => (lama === tgl ? null : tgl))}
              >
                <span className="angka">{+tgl.slice(8, 10)}</span>
                {/* Titik menandai ada isinya; jumlahnya tidak ditulis karena
                    di sel selebar ini angka kecil justru sulit dibaca. */}
                {jumlah > 0 && <span className="titik" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
      {/* Setinggi nol dan tak terlihat; hanya penanda posisi bagi pengamat. */}
      <div ref={penjaga} className="kalender-penjaga" aria-hidden="true" />

      {error && <p className="notice bad" style={{ margin: '10px 16px' }}>{error}</p>}

      <div className="agenda-kepala">
        <h3>{dipilih ? tanggalPanjang(dipilih) : 'Yang akan datang'}</h3>
        {dipilih && (
          <button className="btn ghost kecil" onClick={() => setDipilih(null)}>
            Tampilkan semua
          </button>
        )}
      </div>

      {acara === null ? (
        <p className="agenda-kosong">Memuat…</p>
      ) : kelompok.length === 0 ? (
        <div className="empty">
          <h2>{dipilih ? 'Tidak ada acara di tanggal ini' : 'Belum ada acara'}</h2>
          <p>Acara punya jam mulai, jam selesai, dan keterangan singkat.</p>
        </div>
      ) : (
        kelompok.map((k) => (
          <div key={k.tanggal} className="agenda-kelompok">
            {!dipilih && <h4 className="agenda-tanggal">{kepalaTanggal(k.tanggal, ini)}</h4>}
            {k.isi.map((a) => (
              <div key={a.key} className="acara-baris">
                <button className="acara-isi" onClick={() => setForm({ ...a, mode: 'ubah' })}>
                  <span className="acara-jam">
                    <Clock size={12} strokeWidth={2} />
                    {jam(a)}
                    {a.ulang && (
                      <span className="acara-ulang">
                        <Repeat size={11} strokeWidth={2} />
                        {LABEL_ULANG[a.ulang]}
                      </span>
                    )}
                  </span>
                  <span className="acara-judul">{a.judul}</span>
                  {a.deskripsi && <span className="acara-desc">{a.deskripsi}</span>}
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Hapus ${a.judul}`}
                  onClick={() => setHapus(a)}
                >
                  <Trash2 size={17} strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>
        ))
      )}

      </PullRefresh>

      {/* fab dan lembar sengaja di luar PullRefresh: isinya digeser dengan
          transform saat ditarik, dan sebuah transform membuat elemen
          position: fixed di dalamnya berpatokan ke situ, bukan ke layar —
          akibatnya tombolnya ikut melorot mengikuti tarikan jari. */}
      {/* fab pakai position: fixed, jadi posisinya lepas dari .pane — kalau selalu
          dirender, ia tetap menempel di layar walau tab Agenda sudah digeser
          keluar layar (Agenda tidak dilepas dari DOM, hanya tergulir). Digerbang
          dengan aktif supaya cuma tampil selagi tab ini yang sedang dilihat. */}
      {aktif && (
        <button
          className="fab"
          onClick={() => setForm({ mode: 'baru', tanggal: dipilih || ini, judul: '', deskripsi: '' })}
        >
          <CalendarDays size={18} strokeWidth={1.85} />
          Acara baru
        </button>
      )}

      {form && (
        <FormAcara
          awal={form}
          onTutup={() => setForm(null)}
          onSimpan={() => {
            setForm(null);
            setMuatUlang((n) => n + 1);
          }}
        />
      )}

      {hapus && (
        <div className="sheet-backdrop" onClick={() => setHapus(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Hapus acara ini?</h3>
            <p>
              “{hapus.judul}” dihapus.
              {hapus.ulang && ' Acara ini berulang, jadi seluruh kemunculannya ikut hilang.'}
            </p>
            <div className="row">
              <button className="btn ghost" onClick={() => setHapus(null)}>
                Batal
              </button>
              <button
                className="btn danger"
                onClick={async () => {
                  const a = hapus;
                  setHapus(null);
                  try {
                    await api.hapusAcara(a.id);
                    setMuatUlang((n) => n + 1);
                  } catch (err) {
                    setError(err.message);
                  }
                }}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FormAcara({ awal, onTutup, onSimpan }) {
  const [judul, setJudul] = useState(awal.judul || '');
  const [deskripsi, setDeskripsi] = useState(awal.deskripsi || '');
  // Kemunculan berulang disunting sebagai satu kesatuan, jadi yang ditampilkan
  // adalah tanggal asalnya — bukan tanggal kemunculan yang kebetulan diketuk.
  const [tanggal, setTanggal] = useState(awal.tanggalAsal || awal.tanggal || '');
  const [mulai, setMulai] = useState(awal.mulai || '');
  const [selesai, setSelesai] = useState(awal.selesai || '');
  const [ulang, setUlang] = useState(awal.ulang || '');
  const [ulangSampai, setUlangSampai] = useState(awal.ulangSampai || '');
  const [error, setError] = useState('');
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onTutup();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTutup]);

  async function simpan() {
    setError('');
    setSibuk(true);
    const isi = { judul, deskripsi, tanggal, mulai, selesai, ulang, ulangSampai: ulang ? ulangSampai : '' };
    try {
      if (awal.mode === 'ubah') await api.ubahAcara(awal.id, isi);
      else await api.buatAcara(isi);
      onSimpan();
    } catch (err) {
      setError(err.message);
      setSibuk(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onTutup}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>{awal.mode === 'ubah' ? 'Ubah acara' : 'Acara baru'}</h3>

        <div className="acara-form">
          <label className="grup-field">
            <span>Judul</span>
            <input value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Buat Acara" autoFocus />
          </label>

          <label className="grup-field">
            <span>Tanggal</span>
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </label>

          <div className="acara-jam-baris">
            <label className="grup-field">
              <span>Mulai</span>
              <input type="time" value={mulai} onChange={(e) => setMulai(e.target.value)} />
            </label>
            <label className="grup-field">
              <span>Selesai</span>
              <input type="time" value={selesai} onChange={(e) => setSelesai(e.target.value)} />
            </label>
          </div>
          <p className="m3-hint">Kosongkan keduanya kalau acaranya sepanjang hari.</p>

          <label className="grup-field">
            <span>Pengulangan</span>
            <select value={ulang} onChange={(e) => setUlang(e.target.value)}>
              <option value="">Tidak berulang</option>
              <option value="harian">Tiap hari</option>
              <option value="mingguan">Tiap minggu</option>
              <option value="bulanan">Tiap bulan</option>
              <option value="tahunan">Tiap tahun</option>
            </select>
          </label>

          {ulang && (
            <label className="grup-field">
              <span>Berhenti pada</span>
              <input type="date" value={ulangSampai} onChange={(e) => setUlangSampai(e.target.value)} />
              <p className="m3-hint">Kosongkan kalau tidak ada tanggal berhentinya.</p>
            </label>
          )}

          <label className="grup-field">
            <span>Keterangan</span>
            <textarea
              rows={3}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Opsional"
            />
          </label>

          {awal.mode === 'ubah' && awal.ulang && (
            <p className="m3-hint">
              Perubahan berlaku untuk seluruh kemunculan acara ini, bukan tanggal ini saja.
            </p>
          )}
          {error && <p className="m3-note bad">{error}</p>}
        </div>

        <div className="row">
          <button className="btn ghost" onClick={onTutup} disabled={sibuk}>
            Batal
          </button>
          <button className="btn" onClick={simpan} disabled={sibuk || !judul.trim() || !tanggal}>
            {sibuk ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}