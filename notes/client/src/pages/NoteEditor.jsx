import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import Editor from '../components/Editor.jsx';
import FormatRail from '../components/FormatRail.jsx';
import { NoteEditorSkeleton } from '../components/Skeleton.jsx';
import { withMinDelay } from '../utils.js';
import TableEditor from '../components/TableEditor.jsx';
import { findTableAtLine } from '../cm/table.js';

// Pratinjau dimuat saat dibutuhkan agar berkas awal tetap ringan.
const Preview = lazy(() => import('../components/Preview.jsx'));

const SAVE_DELAY = 800;
const CLOSE_ANIM = 260;
const DRAG_THRESHOLD = 96;

export default function NoteEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [note, setNote] = useState(null);
  const [status, setStatus] = useState('memuat');
  // Catatan dibuka dalam mode baca; menulis dimulai lewat ikon pensil.
  const [mode, setMode] = useState('baca');

  // Catatan milik anggota grup lain: tidak ada tombol sunting, semat, atau hapus.
  // Server juga menolaknya, jadi ini semata agar antarmukanya tidak menjanjikan
  // sesuatu yang akan ditolak.
  const milikOrangLain = note ? note.bisaSunting === false : false;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState(null);
  const [table, setTable] = useState(null);
  // Dinaikkan setiap isi berubah dari luar editor, agar pratinjau ikut segar.
  const [rev, setRev] = useState(0);

  const draft = useRef({ title: '', content: '' });
  const timer = useRef(null);
  const dirty = useRef(false);
  const sheet = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    let alive = true;
    withMinDelay(api.getNote(id))
      .then(({ note }) => {
        if (!alive) return;
        setNote(note);
        draft.current = { title: note.title, content: note.content };
        setStatus('tersimpan');
      })
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [id]);

  const save = useCallback(
    async (patch) => {
      setStatus('menyimpan');
      try {
        await api.updateNote(id, patch);
        dirty.current = false;
        setStatus('tersimpan');
        setError('');
      } catch (err) {
        setStatus('gagal');
        setError(err.message);
      }
    },
    [id]
  );

  const queueSave = useCallback(() => {
    dirty.current = true;
    setStatus('mengetik');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save({ ...draft.current }), SAVE_DELAY);
  }, [save]);

  /**
   * Menutup panel. Perubahan yang belum sempat tersimpan dituntaskan lebih dulu,
   * supaya daftar di halaman utama sudah memuat versi terbaru saat muncul.
   */
  /** Menurunkan panel dari posisinya saat ini, bukan dari awal. */
  const slideOut = useCallback(() => {
    const el = sheet.current;
    if (!el) return;
    el.style.animation = 'none';
    el.style.transition = `transform ${CLOSE_ANIM}ms cubic-bezier(0.4, 0, 1, 1)`;
    // Satu frame jeda supaya peramban mencatat posisi awal transisi.
    requestAnimationFrame(() => {
      el.style.transform = 'translateY(100%)';
    });
  }, []);

  /**
   * Menutup panel. Perubahan yang belum sempat tersimpan dituntaskan lebih dulu,
   * supaya daftar di halaman utama sudah memuat versi terbaru saat muncul.
   * Penyimpanan dan animasi berjalan bersamaan, jadi tidak ada jeda tambahan.
   */
  const close = useCallback(async () => {
    clearTimeout(timer.current);
    slideOut();
    const flush = dirty.current
      ? api.updateNote(id, { ...draft.current }).catch(() => {})
      : Promise.resolve();
    await Promise.all([flush, new Promise((r) => setTimeout(r, CLOSE_ANIM))]);
    navigate('/', { replace: true });
  }, [id, navigate, slideOut]);

  // Jaring pengaman kalau tab ditutup mendadak.
  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      clearTimeout(timer.current);
      save({ ...draft.current });
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [save]);

  /* ---------- Seret panel ke bawah untuk menutup ---------- */

  function onPointerDown(e) {
    if (e.target.closest('button')) return;
    const el = sheet.current;
    if (!el) return;
    drag.current = { startY: e.clientY, dy: 0 };
    // Animasi masuk dimatikan agar tidak beradu dengan posisi jari.
    el.style.animation = 'none';
    el.style.transition = 'none';
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  // Posisi diubah langsung lewat DOM, tanpa setState, supaya isi catatan
  // tidak ikut dirender ulang setiap gerakan jari — inilah sumber kedipan.
  function onPointerMove(e) {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    drag.current.dy = dy;
    sheet.current.style.transform = `translateY(${dy}px)`;
  }

  function onPointerUp() {
    const info = drag.current;
    if (!info) return;
    drag.current = null;

    if (info.dy > DRAG_THRESHOLD) {
      close();
      return;
    }
    // Kembali ke posisi semula dari titik jari terakhir, bukan melompat.
    const el = sheet.current;
    el.style.transition = `transform ${CLOSE_ANIM}ms cubic-bezier(0.32, 0.72, 0, 1)`;
    el.style.transform = 'translateY(0px)';
  }

  /** Membuka penyunting kisi untuk tabel yang diketuk di mode baca. */
  function editTableAtLine(line) {
    const found = findTableAtLine(draft.current.content, line);
    if (found) setTable(found);
  }

  function applyTable(markdown) {
    const { from, to } = table;
    const isi = draft.current.content;
    draft.current.content = isi.slice(0, from) + markdown + isi.slice(to);
    setRev((n) => n + 1);
    queueSave();
  }

  async function togglePin() {
    const pinned = !note.pinned;
    setNote((n) => ({ ...n, pinned }));
    await save({ ...draft.current, pinned });
  }

  async function remove() {
    try {
      await api.deleteNote(id);
      slideOut();
      setTimeout(() => navigate('/', { replace: true }), CLOSE_ANIM);
    } catch (err) {
      setError(err.message);
      setConfirmDelete(false);
    }
  }

  const statusLabel = {
    memuat: 'Memuat…',
    mengetik: 'Perubahan belum disimpan',
    menyimpan: 'Menyimpan…',
    tersimpan: 'Tersimpan',
    gagal: 'Gagal menyimpan',
  }[status];

  return (
    <div className="app sheet-page" ref={sheet}>
      <header
        className="topbar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="grabber" aria-hidden="true" />
        <button className="icon-btn" aria-label="Kembali" onClick={close}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </button>
        {milikOrangLain ? (
          <span className="baca-saja" style={{ marginRight: 'auto' }}>
            Catatan {note.penulis} · baca saja
          </span>
        ) : (
          <span style={{ marginRight: 'auto' }} />
        )}
        {!milikOrangLain && (
        <button
          className={`icon-btn ${note?.pinned ? 'is-on' : ''}`}
          aria-label={note?.pinned ? 'Lepas sematan' : 'Sematkan catatan'}
          onClick={togglePin}
          disabled={!note}
        >
          {note?.pinned ? <PinOff size={19} strokeWidth={1.75} /> : <Pin size={19} strokeWidth={1.75} />}
        </button>
        )}
        {!milikOrangLain && (
        <button
          className={`icon-btn ${mode === 'tulis' ? 'is-on' : ''}`}
          aria-label={mode === 'baca' ? 'Sunting catatan' : 'Baca hasil akhir'}
          onClick={() => setMode(mode === 'baca' ? 'tulis' : 'baca')}
          disabled={!note}
        >
          {mode === 'baca' ? <Pencil size={19} strokeWidth={1.75} /> : <Eye size={19} strokeWidth={1.75} />}
        </button>
        )}
        {!milikOrangLain && (
        <button className="icon-btn" aria-label="Hapus catatan" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={19} strokeWidth={1.75} />
        </button>
        )}
      </header>

      {error && <p className="notice bad" style={{ margin: '0 16px 8px' }}>{error}</p>}

      <div className="editor-wrap">
        {!note ? (
          <NoteEditorSkeleton />
        ) : (
          <>
            <input
              className="title-input"
              defaultValue={note.title}
              key={note.id}
              placeholder="Judul catatan"
              aria-label="Judul catatan"
              readOnly={mode === 'baca'}
              onChange={(e) => {
                draft.current.title = e.target.value;
                queueSave();
              }}
            />
            <p className="save-state" aria-live="polite">{statusLabel}</p>

            <div className="editor-scroll">
              {mode === 'baca' ? (
                <Suspense fallback={<NoteEditorSkeleton />}>
                  <Preview key={rev} content={draft.current.content} onEditTable={editTableAtLine} />
                </Suspense>
              ) : (
                <Editor
                  docKey={note.id}
                  initialValue={draft.current.content}
                  onReady={setView}
                  onChange={(value) => {
                    draft.current.content = value;
                    queueSave();
                  }}
                />
              )}
            </div>

            {mode === 'tulis' && <FormatRail view={view} />}
          </>
        )}
      </div>

      {table && (
        <TableEditor
          initial={table}
          onApply={applyTable}
          onClose={() => setTable(null)}
        />
      )}

      {confirmDelete && (
        <div className="sheet-backdrop" onClick={() => setConfirmDelete(false)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Hapus catatan ini?</h3>
            <p>Catatan dipindahkan ke tempat sampah dan dihapus permanen setelah 30 hari.</p>
            <div className="row">
              <button className="btn ghost" onClick={() => setConfirmDelete(false)}>
                Batal
              </button>
              <button className="btn danger" onClick={remove}>
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}