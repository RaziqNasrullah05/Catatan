import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  LogOut,
  MoreVertical,
  NotebookPen,
  Pin,
  Plus,
  Search,
  Settings,
  SquarePen,
  Users,
} from 'lucide-react';
import NoteMenu from '../components/NoteMenu.jsx';
import PullRefresh from '../components/PullRefresh.jsx';
import Agenda from '../components/Agenda.jsx';
import { NoteListSkeleton, PeopleSkeleton, TaskListSkeleton } from '../components/Skeleton.jsx';
import { api } from '../api.js';
import { readLayout } from '../prefs.js';
import { withMinDelay } from '../utils.js';

const TABS = [
  { id: 'grup', label: 'Grup', Icon: Users },
  { id: 'catatan', label: 'Catatan', Icon: NotebookPen },
  { id: 'tugas', label: 'Tugas', Icon: CircleCheck },
  { id: 'agenda', label: 'Agenda', Icon: CalendarDays },
];

// Grup berada di kiri, tapi yang dibuka pertama tetap Catatan.
const TAB_GRUP = TABS.findIndex((t) => t.id === 'grup');
const TAB_CATATAN = TABS.findIndex((t) => t.id === 'catatan');
const TAB_AGENDA = TABS.findIndex((t) => t.id === 'agenda');

/**
 * Halaman lain bisa meminta tab tertentu lewat state navigasi, mis.
 * `navigate('/', { state: { tab: 'grup' } })`. Tanpa ini, kembali dari sebuah
 * grup selalu mendarat di Catatan — tab yang tidak ada hubungannya dengan
 * tempat pengguna barusan berada. Nama tab yang tidak dikenali diabaikan
 * diam-diam, bukan membuat halaman kosong.
 */
function tabDariState(state) {
  const i = TABS.findIndex((t) => t.id === state?.tab);
  return i >= 0 ? i : TAB_CATATAN;
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Home({ user, onSignOut }) {
  const navigate = useNavigate();
  const location = useLocation();
  // Dibaca sekali lewat inisialisasi useState: tab awal ditentukan saat halaman
  // dipasang, dan sesudah itu jari penggunalah yang menentukan.
  const [index, setIndex] = useState(() => tabDariState(location.state));
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [layout, setLayout] = useState(readLayout);
  const [newTask, setNewTask] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [menu, setMenu] = useState(null);
  const [held, setHeld] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const lastScroll = useRef(0);
  const searchInput = useRef(null);

  const holdTimer = useRef(null);
  const holdStart = useRef(null);
  const suppressClick = useRef(false);

  const pagerRef = useRef(null);
  // Menandai geseran yang dipicu tombol, bukan jari pengguna.
  const programmatic = useRef(false);
  const settleTimer = useRef(null);

  useEffect(() => {
    const sync = () => setLayout(readLayout());
    window.addEventListener('catatan:tampilan', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('catatan:tampilan', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Kedua panel dimuat bersamaan supaya geseran terasa instan.
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        setError('');
        const [noteData, taskData] = await withMinDelay(
          Promise.all([api.listNotes(query), api.listTasks()])
        );
        if (!alive) return;
        setNotes(noteData.notes);
        setTasks(taskData.tasks);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    }, query ? 220 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, reloadKey]);

  /**
   * Menggeser panel saat tombol segmented ditekan.
   * scroll-snap dimatikan sementara karena ia beradu dengan animasi scrollTo —
   * snap menarik balik posisi sementara animasi masih berjalan, dan itulah
   * yang terlihat sebagai kedipan.
   */
  const goTo = useCallback((next) => {
    const pager = pagerRef.current;
    if (!pager) return;

    programmatic.current = true;
    pager.style.scrollSnapType = 'none';
    pager.scrollTo({ left: next * pager.clientWidth, behavior: 'smooth' });
    setIndex(next);

    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      pager.style.scrollSnapType = '';
      programmatic.current = false;
    }, 420);
  }, []);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  /**
   * Panel pertama dalam urutan DOM adalah Grup, sedangkan yang harus terlihat
   * saat halaman dibuka biasanya Catatan — atau tab lain bila pemanggilnya
   * meminta. Posisinya digeser sebelum lukisan pertama supaya tidak terlihat
   * melompat. scroll-snap dimatikan sekejap karena ia menolak penetapan
   * scrollLeft secara langsung.
   *
   * Dipakai `indexAwal`, bukan `index`, karena efek ini berjalan di setiap
   * render: memakai `index` berarti posisi gulir ditetapkan ulang di tengah
   * geseran jari.
   */
  const sudahDitempatkan = useRef(false);
  const indexAwal = useRef(index);
  useLayoutEffect(() => {
    const pager = pagerRef.current;
    if (!pager || sudahDitempatkan.current || !pager.clientWidth) return;
    sudahDitempatkan.current = true;
    pager.style.scrollSnapType = 'none';
    pager.scrollLeft = indexAwal.current * pager.clientWidth;
    requestAnimationFrame(() => {
      pager.style.scrollSnapType = '';
    });
  });

  /** Menyesuaikan tab aktif saat pengguna menggeser dengan jari. */
  function onPagerScroll(e) {
    // Selama geseran otomatis, posisi sudah ditentukan — abaikan agar tidak
    // memicu render ulang di setiap frame.
    if (programmatic.current) return;
    const el = e.currentTarget;
    if (!el.clientWidth) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== index && next >= 0 && next < TABS.length) setIndex(next);
  }

  /* ---------- Tekan lama pada kartu catatan ---------- */

  function openMenu(note, el) {
    setHeld(null);
    // Kalau peramban terlanjur memblok teks sebelum menu muncul, lepaskan.
    window.getSelection?.()?.removeAllRanges?.();
    setMenu({ note, anchor: el.getBoundingClientRect() });
  }

  function onCardPointerDown(note, e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('.row-more')) return;
    const el = e.currentTarget;
    holdStart.current = { x: e.clientX, y: e.clientY };
    setHeld(note.id);
    holdTimer.current = setTimeout(() => {
      suppressClick.current = true;
      // Getaran singkat sebagai penanda, kalau perangkat mendukung.
      navigator.vibrate?.(12);
      openMenu(note, el);
    }, 480);
  }

  function cancelHold() {
    clearTimeout(holdTimer.current);
    setHeld(null);
  }

  function onCardPointerMove(e) {
    const awal = holdStart.current;
    if (!awal) return;
    if (Math.hypot(e.clientX - awal.x, e.clientY - awal.y) > 10) cancelHold();
  }

  async function pinFromMenu() {
    const note = menu.note;
    setMenu(null);
    setNotes((list) => list.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)));
    try {
      await api.updateNote(note.id, { pinned: !note.pinned });
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteFromMenu() {
    const note = confirmDelete;
    setConfirmDelete(null);
    setNotes((list) => list.filter((n) => n.id !== note.id));
    try {
      await api.deleteNote(note.id);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  /** Dipanggil tarik-untuk-muat-ulang; menunggu data benar-benar datang. */
  const refresh = useCallback(async () => {
    // Kerangka ditampilkan juga saat muat ulang manual, dengan jeda minimum yang
    // sama seperti pemuatan awal — supaya kedua jalur terasa seragam.
    setLoading(true);
    try {
      const [noteData, taskData] = await withMinDelay(
        Promise.all([api.listNotes(query), api.listTasks()])
      );
      setNotes(noteData.notes);
      setTasks(taskData.tasks);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  /**
   * Kolom pencarian muncul saat menggulir ke arah atas dan menyingkir saat
   * menggulir ke bawah, jadi ruang layar dipakai untuk catatan lebih dulu.
   */
  function onListScroll(e) {
    const el = e.currentTarget;
    const batas = el.scrollHeight - el.clientHeight;
    // Di kedua ujung, peramban seluler memantulkan posisi gulir bolak-balik.
    // Nilai itu dijepit dulu supaya pantulan tidak terbaca sebagai perubahan arah.
    const atas = Math.max(0, Math.min(el.scrollTop, batas));
    const selisih = atas - lastScroll.current;
    lastScroll.current = atas;

    // Sudah mentok di bawah: tidak ada arah baru untuk dibaca, jadi biarkan.
    if (batas > 0 && atas >= batas - 2) return;

    if (atas <= 4) setSearchOpen(true);
    else if (selisih < -8) setSearchOpen(true);
    else if (selisih > 8 && atas > 40) setSearchOpen(false);
  }

  async function createNote() {
    try {
      const { note } = await api.createNote();
      navigate(`/catatan/${note.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addTask() {
    const text = newTask.trim();
    if (!text) return;
    setNewTask('');
    try {
      await api.addTask(text);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleTask(task) {
    setTasks((list) =>
      list.map((t) => (t.noteId === task.noteId && t.line === task.line ? { ...t, done: !t.done } : t))
    );
    try {
      await api.toggleTask(task.noteId, task.line);
    } catch (err) {
      setError(err.message);
    }
  }

  const [belumDibaca, setBelumDibaca] = useState(0);
  const [grup, setGrup] = useState(null);
  const [grupBaru, setGrupBaru] = useState(null);

  // Sekali dibuka, panel Agenda dibiarkan terpasang supaya geseran bolak-balik
  // tidak memuat ulang kalendernya tiap kali.
  const [agendaPernahDibuka, setAgendaPernahDibuka] = useState(false);

  const adaBaru = belumDibaca > 0;

  /**
   * Tidak ada sambungan langsung ke server, jadi jumlahnya diperiksa saat
   * halaman dibuka dan tiap kali tab ini kembali aktif — cukup untuk pemakaian
   * sehari-hari tanpa menambah polling berkala.
   */
  useEffect(() => {
    const periksa = () =>
      api
        .jumlahNotifikasi()
        .then((d) => setBelumDibaca(d.belumDibaca))
        .catch(() => {});
    periksa();
    const saatKembali = () => document.visibilityState === 'visible' && periksa();
    document.addEventListener('visibilitychange', saatKembali);
    window.addEventListener('focus', periksa);
    return () => {
      document.removeEventListener('visibilitychange', saatKembali);
      window.removeEventListener('focus', periksa);
    };
  }, [reloadKey]);

  useEffect(() => {
    if (index === TAB_AGENDA) setAgendaPernahDibuka(true);
  }, [index]);

  // Grup dimuat saat panelnya pertama kali dikunjungi, bukan di awal — pemakaian
  // sehari-hari berada di Catatan dan Tugas.
  useEffect(() => {
    if (index !== TAB_GRUP || grup !== null) return;
    api
      .listGrup()
      .then((d) => setGrup(d.grup))
      .catch(() => setGrup([]));
  }, [index, grup]);

  const [pemilihGrup, setPemilihGrup] = useState(null);
  const [menyimpanGrup, setMenyimpanGrup] = useState(false);

  async function bukaPemilihGrup(note) {
    setPemilihGrup({ note, grup: null });
    try {
      const { grup: daftar } = await api.grupCatatan(note.id);
      setPemilihGrup({ note, grup: daftar });
    } catch (err) {
      setError(err.message);
      setPemilihGrup(null);
    }
  }

  async function simpanPemilihGrup() {
    const { note, grup: daftar } = pemilihGrup;
    setMenyimpanGrup(true);
    try {
      await api.simpanGrupCatatan(
        note.id,
        daftar.filter((g) => g.terpilih).map((g) => g.id)
      );
      setPemilihGrup(null);
      // Daftar catatan perlu dimuat ulang agar penanda grupnya ikut segar.
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setMenyimpanGrup(false);
    }
  }

  async function buatGrup() {
    const nama = (grupBaru || '').trim();
    if (nama.length < 2) return;
    try {
      const { grup: g } = await api.createGrup(nama);
      setGrupBaru(null);
      setGrup((lama) => [g, ...(lama || [])]);
      navigate(`/grup/${g.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="app">
      <header className="topbar">
        <button
          className={`icon-btn bel ${adaBaru ? 'ada-baru' : ''}`}
          aria-label={adaBaru ? 'Pemberitahuan, ada yang baru' : 'Pemberitahuan'}
          onClick={() => navigate('/notifikasi')}
        >
          <Bell size={20} strokeWidth={1.75} />
          {adaBaru && <span className="titik" aria-hidden="true" />}
        </button>
        {index === TAB_CATATAN && (
          <button
            className={`icon-btn ${searchOpen ? 'is-on' : ''}`}
            aria-label="Cari catatan"
            aria-expanded={searchOpen}
            onClick={() => {
              const buka = !searchOpen;
              setSearchOpen(buka);
              if (buka) setTimeout(() => searchInput.current?.focus(), 220);
            }}
          >
            <Search size={19} strokeWidth={1.75} />
          </button>
        )}
        <button className="icon-btn" aria-label="Pengaturan" onClick={() => navigate('/pengaturan')}>
          <Settings size={20} strokeWidth={1.75} />
        </button>
        <button className="icon-btn" aria-label="Keluar" onClick={() => setConfirmSignOut(true)}>
          <LogOut size={20} strokeWidth={1.75} />
        </button>
      </header>

      <div className="segmented" role="tablist" aria-label="Tampilan">
        {TABS.map(({ id, label, Icon }, i) => (
          <button
            key={id}
            role="tab"
            aria-selected={index === i}
            aria-pressed={index === i}
            aria-label={label}
            onClick={() => goTo(i)}
          >
            <Icon size={17} strokeWidth={1.85} />
            <span className="label">{label}</span>
          </button>
        ))}
      </div>

      {error && <p className="notice bad" style={{ margin: '10px 16px' }}>{error}</p>}

      <div className="pager" ref={pagerRef} onScroll={onPagerScroll}>
        <div className="pane" role="tabpanel" aria-label="Grup">
          {grup === null ? (
            <PeopleSkeleton />
          ) : grup.length === 0 ? (
            <div className="empty">
              <h2>Belum ada grup</h2>
              <p>Grup jadi wadah bersama untuk catatan yang sengaja kamu simpan di dalamnya.</p>
            </div>
          ) : (
            <div className="grup-list m3-scope">
              <div className="m3-container">
                <div className="m3-card">
              {grup.map((g, i) => (
                <div key={g.id}>
                  {i > 0 && <div className="m3-divider" />}
                  <button className="m3-row tappable" onClick={() => navigate(`/grup/${g.id}`)}>
                    <span className="m3-avatar">{g.nama[0]}</span>
                    <span className="m3-body">
                      <span className="m3-title">
                        {g.nama}
                        {g.peran === 'leader' && <span className="m3-status">Pemimpin</span>}
                      </span>
                      <span className="m3-desc blok">{g.jumlahAnggota} anggota</span>
                    </span>
                    <span className="m3-action">
                      <ChevronRight size={18} strokeWidth={1.75} />
                    </span>
                  </button>
                </div>
              ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <PullRefresh
          onRefresh={refresh}
          onScroll={onListScroll}
          role="tabpanel"
          aria-label="Catatan"
          header={
            <div className={`search-slot ${searchOpen ? 'is-open' : ''}`}>
              <div className="search">
                <Search size={17} strokeWidth={1.75} />
                <input
                  ref={searchInput}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari judul atau isi catatan"
                  aria-label="Cari catatan"
                />
              </div>
            </div>
          }
        >
          {loading ? (
            <NoteListSkeleton layout={layout} />
          ) : (
          <div className={`note-list layout-${layout}`}>
            {notes.length === 0 && (
              <div className="empty">
                <h2>{query ? 'Tidak ada yang cocok' : 'Belum ada catatan'}</h2>
                <p>{query ? 'Coba kata kunci lain.' : 'Ketuk Tulis untuk memulai catatan pertama.'}</p>
              </div>
            )}
            {notes.map((note) => (
              <button
                key={note.id}
                className={`note-row ${held === note.id ? 'is-held' : ''}`}
                onPointerDown={(e) => onCardPointerDown(note, e)}
                onPointerMove={onCardPointerMove}
                onPointerUp={cancelHold}
                onPointerCancel={cancelHold}
                onContextMenu={(e) => {
                  e.preventDefault();
                  suppressClick.current = true;
                  openMenu(note, e.currentTarget);
                }}
                onClick={(e) => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    e.preventDefault();
                    return;
                  }
                  navigate(`/catatan/${note.id}`);
                }}
              >
                {layout === 'list' && (
                  <span
                    className="row-more"
                    role="button"
                    tabIndex={0}
                    aria-label={`Tindakan untuk ${note.title || 'catatan tanpa judul'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openMenu(note, e.currentTarget.closest('.note-row'));
                    }}
                  >
                    <MoreVertical size={18} strokeWidth={1.9} />
                  </span>
                )}
                <h2>
                  {note.pinned && <Pin size={14} strokeWidth={2} />}
                  {note.title || 'Tanpa judul'}
                </h2>
                {note.excerpt && <p>{note.excerpt}</p>}
                <span className="note-meta">
                  {timeAgo(note.updatedAt)}
                  {note.openTasks > 0 && (
                    <span className="badge">
                      <CircleCheck size={11} strokeWidth={2} />
                      {note.openTasks} tugas
                    </span>
                  )}
                  {note.grup?.length > 0 && (
                    <span
                      className="badge grup"
                      title={`Terlihat oleh anggota: ${note.grup.join(', ')}`}
                    >
                      <Users size={11} strokeWidth={2} />
                      {note.grup.length === 1 ? note.grup[0] : `${note.grup.length} grup`}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
          )}
        </PullRefresh>

        <PullRefresh
          onRefresh={refresh}
          role="tabpanel"
          aria-label="Tugas"
          header={
            <div className="task-add">
              <Plus size={17} strokeWidth={2} />
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="Tambah tugas lalu tekan Enter"
                aria-label="Tambah tugas baru"
              />
            </div>
          }
        >
          {loading ? (
            <TaskListSkeleton />
          ) : (
          <div className="task-group">
            {tasks.length === 0 && (
              <div className="empty">
                <h2>Belum ada tugas</h2>
                <p>Setiap baris ceklis di catatanmu akan muncul di sini.</p>
              </div>
            )}
            {open.length > 0 && <h3>Belum selesai</h3>}
            {open.map((task) => (
              <TaskRow key={`${task.noteId}-${task.line}`} task={task} onToggle={toggleTask} navigate={navigate} />
            ))}
            {done.length > 0 && <h3>Selesai</h3>}
            {done.map((task) => (
              <TaskRow key={`${task.noteId}-${task.line}`} task={task} onToggle={toggleTask} navigate={navigate} />
            ))}
          </div>
          )}
        </PullRefresh>

        <div className="pane" role="tabpanel" aria-label="Agenda">
          {/* Dipasang hanya saat panelnya dikunjungi: kisi kalender memuat acara
              sebulan penuh, dan itu tidak perlu terjadi saat membuka Catatan. */}
          {agendaPernahDibuka && <Agenda aktif={index === TAB_AGENDA} />}
        </div>
      </div>

      {menu && (
        <NoteMenu
          anchor={menu.anchor}
          note={menu.note}
          onPin={pinFromMenu}
          onDelete={() => {
            setConfirmDelete(menu.note);
            setMenu(null);
          }}
          onGrup={() => {
            bukaPemilihGrup(menu.note);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}

      {pemilihGrup && (
        <div className="sheet-backdrop" onClick={() => setPemilihGrup(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Simpan ke grup</h3>
            <p>
              Anggota grup yang dicentang bisa membaca “{pemilihGrup.note.title || 'Tanpa judul'}”,
              tapi tidak menyuntingnya.
            </p>

            {pemilihGrup.grup === null ? (
              <p className="pilih-kosong">Memuat grup…</p>
            ) : pemilihGrup.grup.length === 0 ? (
              <p className="pilih-kosong">
                Kamu belum ikut grup mana pun. Buat grup dulu di tab Grup.
              </p>
            ) : (
              <div className="pilih-grup">
                {pemilihGrup.grup.map((g) => (
                  <label key={g.id} className="pilih-baris">
                    <input
                      type="checkbox"
                      checked={g.terpilih}
                      onChange={() =>
                        setPemilihGrup((p) => ({
                          ...p,
                          grup: p.grup.map((x) => (x.id === g.id ? { ...x, terpilih: !x.terpilih } : x)),
                        }))
                      }
                    />
                    <span>{g.nama}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="row">
              <button className="btn ghost" onClick={() => setPemilihGrup(null)}>
                Batal
              </button>
              <button
                className="btn"
                onClick={simpanPemilihGrup}
                disabled={!pemilihGrup.grup?.length || menyimpanGrup}
              >
                {menyimpanGrup ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="sheet-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Hapus catatan ini?</h3>
            <p>
              “{confirmDelete.title || 'Tanpa judul'}” dipindahkan ke tempat sampah dan dihapus permanen
              setelah 30 hari.
            </p>
            <div className="row">
              <button className="btn ghost" onClick={() => setConfirmDelete(null)}>
                Batal
              </button>
              <button className="btn danger" onClick={deleteFromMenu}>
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmSignOut && (
        <div className="sheet-backdrop" onClick={() => setConfirmSignOut(false)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Keluar dari akun ini?</h3>
            <p>
              Catatanmu tetap tersimpan. Untuk masuk lagi kamu perlu kata sandi, atau tautan yang dikirim ke
              emailmu.
            </p>
            <div className="row">
              <button className="btn ghost" onClick={() => setConfirmSignOut(false)}>
                Batal
              </button>
              <button className="btn danger" onClick={onSignOut}>
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {index === TAB_CATATAN && (
        <button className="fab" onClick={createNote}>
          <SquarePen size={18} strokeWidth={1.75} />
          Tulis
        </button>
      )}

      {index === TAB_GRUP && (
        <button className="fab" onClick={() => setGrupBaru('')}>
          <Plus size={18} strokeWidth={2} />
          Grup baru
        </button>
      )}

      {grupBaru !== null && (
        <div className="sheet-backdrop" onClick={() => setGrupBaru(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Grup baru</h3>
            <p>Kamu jadi pemimpinnya, dan bisa mengundang orang setelah grupnya dibuat.</p>
            <label className="grup-field">
              <input
                autoFocus
                value={grupBaru}
                onChange={(e) => setGrupBaru(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buatGrup()}
                placeholder="Buat Grup"
                aria-label="Nama grup"
              />
            </label>
            <div className="row">
              <button className="btn ghost" onClick={() => setGrupBaru(null)}>
                Batal
              </button>
              <button className="btn" onClick={buatGrup} disabled={grupBaru.trim().length < 2}>
                Buat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, navigate }) {
  return (
    <div className={`task-row ${task.done ? 'done' : ''}`}>
      <input
        type="checkbox"
        className="md-check"
        checked={task.done}
        onChange={() => onToggle(task)}
        aria-label={task.text}
        style={{ marginTop: 4 }}
      />
      <span className="text">
        {task.text || '(tugas tanpa teks)'}
        <button className="source" onClick={() => navigate(`/catatan/${task.noteId}`)}>
          {task.noteTitle}
        </button>
      </span>
    </div>
  );
}