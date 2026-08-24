import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Repeat, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import PullRefresh from './PullRefresh.jsx';
import Sheet from './Sheet.jsx';
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

/** "Agustus 2026" dari teks TTTT-BB. */
function namaBulan(bulan) {
  const [t, b] = bulan.split('-');
  return `${BULAN[+b - 1]} ${t}`;
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
  // Kalender diburamkan bertahap mengikuti gulir; nilainya ditulis langsung ke
  // gaya elemen, bukan ke state React (lihat onGulir).
  const kalender = useRef(null);
  const rafId = useRef(0);

  const sel = useMemo(() => petakBulan(kursor.tahun, kursor.bulan), [kursor]);

  /**
   * Hari libur nasional bulan yang sedang dilihat.
   *
   * Diambil per bulan, bukan per tahun, karena yang perlu ditandai hanya bulan
   * di layar — dan bulan yang tidak pernah dibuka tidak perlu membebani siapa
   * pun. Server yang menyinggahnya; di sini cukup diminta.
   *
   * Kegagalan diabaikan dengan sengaja: tanggal merah itu tambahan, dan
   * kalender tanpa penanda merah masih berguna. Menampilkan pesan galat untuk
   * ini justru membuat sesuatu yang tidak penting terlihat seperti kerusakan.
   */
  const bulanKursor = `${kursor.tahun}-${String(kursor.bulan + 1).padStart(2, '0')}`;
  const [libur, setLibur] = useState([]);

  useEffect(() => {
    let hidup = true;
    api
      .liburBulan(bulanKursor)
      .then((d) => hidup && setLibur(d.libur))
      .catch(() => hidup && setLibur([]));
    return () => {
      hidup = false;
    };
  }, [bulanKursor]);

  /** Urut tanggal, dan hanya yang benar-benar jatuh di bulan yang tampil. */
  const liburBulanIni = useMemo(
    () => libur.filter((l) => l.tanggal.startsWith(bulanKursor)).sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
    [libur, bulanKursor]
  );

  const liburPerTanggal = useMemo(() => {
    const m = new Map();
    for (const l of libur) m.set(l.tanggal, l.nama);
    return m;
  }, [libur]);

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
   * Kalender memudar bertahap mengikuti gulir.
   *
   * Efek yang bertahap butuh nilai yang berubah terus-menerus, jadi kali ini
   * kejadian scroll memang harus dibaca — IntersectionObserver hanya bisa
   * menjawab "sudah lewat atau belum". Dua hal menjaga ongkosnya tetap kecil:
   * pembacaannya dikumpulkan ke satu requestAnimationFrame, dan hasilnya
   * ditulis sebagai variabel CSS langsung ke elemen. Lewat state React, setiap
   * frame gulir akan merender ulang seluruh daftar acara.
   *
   * Ukurannya adalah tinggi kalender itu sendiri: setelah tergulir sejauh itu,
   * ia sudah sepenuhnya tertutup daftar di atasnya, dan nilainya berhenti di 1.
   */
  const onGulir = (e) => {
    const atas = e.currentTarget.scrollTop;
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0;
      const el = kalender.current;
      if (!el) return;
      const p = Math.min(1, Math.max(0, atas / (el.offsetHeight || 1)));
      el.style.setProperty('--pudar', p.toFixed(3));
    });
  };

  useEffect(() => () => rafId.current && cancelAnimationFrame(rafId.current), []);

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
      <PullRefresh
        onRefresh={muatUlangTarik}
        onScroll={onGulir}
        className="agenda"
        role="tabpanel"
        aria-label="Agenda"
      >
      <div className="kalender" ref={kalender}>
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
            const namaLibur = liburPerTanggal.get(tgl);
            return (
              <button
                key={tgl}
                role="gridcell"
                className={`sel ${tgl === ini ? 'ini' : ''} ${tgl === dipilih ? 'dipilih' : ''} ${
                  namaLibur ? 'libur' : ''
                }`}
                // Nama liburnya masuk ke aria-label, bukan cuma jadi warna:
                // merah saja tidak memberi tahu apa-apa bagi yang memakai
                // pembaca layar, dan tidak semua orang membedakan merah.
                aria-label={`${tanggalPanjang(tgl)}${namaLibur ? `, ${namaLibur}` : ''}${
                  jumlah ? `, ${jumlah} acara` : ''
                }`}
                title={namaLibur || undefined}
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

      {/*
        Daftar acara dibungkus lapisannya sendiri. Ia berlatar padat dan
        bersudut membulat di atas, jadi saat digulir ia naik menimpa kalender —
        kalendernya diam di tempat (sticky) dan tertutup dari bawah, bukan ikut
        tergulir pergi. Itulah yang membuat daftar terasa seperti lembar yang
        ditarik ke atas.
      */}
      <div className="agenda-daftar">
      {/* Kepala tinggal di dalam lapisan yang sama dengan daftarnya — ia judul
          bagi acara di bawahnya, bukan elemen terpisah yang kebetulan berada
          di dekatnya. Menempel di puncak lapisan saat digulir. */}
      <div className="agenda-kepala">
        <h3>{dipilih ? tanggalPanjang(dipilih) : 'Yang akan datang'}</h3>
        {dipilih && (
          <button className="btn ghost kecil" onClick={() => setDipilih(null)}>
            Tampilkan semua
          </button>
        )}
      </div>

      {error && <p className="notice bad" style={{ margin: '10px 16px' }}>{error}</p>}

      {/*
        Tanggal merah bulan yang sedang dilihat.
        
        Hanya bulan ini, bukan seluruh tahun: daftar ini menemani kalender di
        atasnya, dan menampilkan libur bulan-bulan lain berarti menyebut tanggal
        yang tidak terlihat di kisi mana pun. Ikut hilang saat sebuah tanggal
        diketuk, karena di situ pertanyaannya sudah berubah jadi "ada apa di
        hari ini", bukan "apa saja libur bulan ini".
      */}
      {!dipilih && liburBulanIni.length > 0 && (
        <section className="libur-blok">
          <h4>Tanggal merah {namaBulan(bulanKursor)}</h4>
          {liburBulanIni.map((l) => (
            <div key={l.tanggal} className={`libur-baris ${l.tanggal < ini ? 'lewat' : ''}`}>
              <span className="libur-tanggal">{+l.tanggal.slice(8, 10)}</span>
              <span className="libur-nama">{l.nama}</span>
            </div>
          ))}
        </section>
      )}

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

      </div>
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
        <Sheet onTutup={() => setHapus(null)}>
          {(tutup) => (
            <>
              <h3>Hapus acara ini?</h3>
              <p>
                “{hapus.judul}” dihapus.
                {hapus.ulang && ' Acara ini berulang, jadi seluruh kemunculannya ikut hilang.'}
              </p>
              <div className="row">
                <button className="btn ghost" onClick={tutup}>
                  Batal
                </button>
                <button
                  className="btn danger"
                  onClick={async () => {
                    const a = hapus;
                    tutup();
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
            </>
          )}
        </Sheet>
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

  // Tombol Esc dan animasi turun ditangani komponen Sheet.

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
    <Sheet onTutup={onTutup}>
      {(tutup) => (
        <>
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
          <button className="btn ghost" onClick={tutup} disabled={sibuk}>
            Batal
          </button>
          <button className="btn" onClick={simpan} disabled={sibuk || !judul.trim() || !tanggal}>
            {sibuk ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
        </>
      )}
    </Sheet>
  );
}