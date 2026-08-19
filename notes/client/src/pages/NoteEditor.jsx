import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import Editor from '../components/Editor.jsx';
import FormatRail from '../components/FormatRail.jsx';
import { NoteEditorSkeleton } from '../components/Skeleton.jsx';

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState(null);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(null);

  const draft = useRef({ title: '', content: '' });
  const timer = useRef(null);
  const dirty = useRef(false);

  useEffect(() => {
    let alive = true;
    api
      .getNote(id)
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
  const close = useCallback(async () => {
    clearTimeout(timer.current);
    setClosing(true);
    const flush = dirty.current ? api.updateNote(id, { ...draft.current }).catch(() => {}) : Promise.resolve();
    await Promise.all([flush, new Promise((r) => setTimeout(r, CLOSE_ANIM))]);
    navigate('/', { replace: true });
  }, [id, navigate]);

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
    setDrag({ startY: e.clientY, dy: 0, settling: false });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!drag || drag.settling) return;
    const dy = e.clientY - drag.startY;
    if (dy > 0) setDrag((d) => ({ ...d, dy }));
  }

  function onPointerUp() {
    if (!drag) return;
    if (drag.dy > DRAG_THRESHOLD) {
      setDrag(null);
      close();
    } else {
      // Kembali ke posisi semula dengan animasi, bukan lompat.
      setDrag((d) => ({ ...d, dy: 0, settling: true }));
      setTimeout(() => setDrag(null), CLOSE_ANIM);
    }
  }

  async function togglePin() {
    const pinned = !note.pinned;
    setNote((n) => ({ ...n, pinned }));
    await save({ ...draft.current, pinned });
  }

  async function remove() {
    try {
      await api.deleteNote(id);
      setClosing(true);
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

  const sheetClass = [
    'app',
    'sheet-page',
    closing && 'is-closing',
    drag && !drag.settling && 'is-dragging',
    drag?.settling && 'is-settling',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={sheetClass}
      style={drag ? { transform: `translateY(${drag.dy}px)` } : undefined}
    >
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
        <span style={{ marginRight: 'auto' }} />
        <button
          className={`icon-btn ${note?.pinned ? 'is-on' : ''}`}
          aria-label={note?.pinned ? 'Lepas sematan' : 'Sematkan catatan'}
          onClick={togglePin}
          disabled={!note}
        >
          {note?.pinned ? <PinOff size={19} strokeWidth={1.75} /> : <Pin size={19} strokeWidth={1.75} />}
        </button>
        <button
          className={`icon-btn ${mode === 'tulis' ? 'is-on' : ''}`}
          aria-label={mode === 'baca' ? 'Sunting catatan' : 'Baca hasil akhir'}
          onClick={() => setMode(mode === 'baca' ? 'tulis' : 'baca')}
          disabled={!note}
        >
          {mode === 'baca' ? <Pencil size={19} strokeWidth={1.75} /> : <Eye size={19} strokeWidth={1.75} />}
        </button>
        <button className="icon-btn" aria-label="Hapus catatan" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={19} strokeWidth={1.75} />
        </button>
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
                  <Preview content={draft.current.content} />
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