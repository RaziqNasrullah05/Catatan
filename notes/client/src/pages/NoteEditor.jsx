import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import Editor from '../components/Editor.jsx';
import FormatRail from '../components/FormatRail.jsx';
// Pratinjau dimuat saat dibutuhkan agar berkas awal tetap ringan.
const Preview = lazy(() => import('../components/Preview.jsx'));

const SAVE_DELAY = 800;

export default function NoteEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [note, setNote] = useState(null);
  const [status, setStatus] = useState('memuat');
  const [mode, setMode] = useState('tulis');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState(null);

  const draft = useRef({ title: '', content: '' });
  const timer = useRef(null);

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
    setStatus('mengetik');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save({ ...draft.current }), SAVE_DELAY);
  }, [save]);

  // Simpan sisa perubahan saat halaman ditinggalkan.
  useEffect(() => {
    const flush = () => {
      if (status === 'mengetik') {
        clearTimeout(timer.current);
        save({ ...draft.current });
      }
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [status, save]);

  async function togglePin() {
    const pinned = !note.pinned;
    setNote((n) => ({ ...n, pinned }));
    await save({ ...draft.current, pinned });
  }

  async function remove() {
    try {
      await api.deleteNote(id);
      navigate('/', { replace: true });
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
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" aria-label="Kembali" onClick={() => navigate('/')}>
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
          className={`icon-btn ${mode === 'baca' ? 'is-on' : ''}`}
          aria-label={mode === 'baca' ? 'Kembali menulis' : 'Baca hasil akhir'}
          onClick={() => setMode(mode === 'baca' ? 'tulis' : 'baca')}
        >
          {mode === 'baca' ? <Pencil size={19} strokeWidth={1.75} /> : <Eye size={19} strokeWidth={1.75} />}
        </button>
        <button className="icon-btn" aria-label="Hapus catatan" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={19} strokeWidth={1.75} />
        </button>
      </header>

      {error && <p className="notice bad" style={{ margin: '0 16px 8px' }}>{error}</p>}

      <div className="editor-wrap">
        <input
          className="title-input"
          defaultValue={note?.title ?? ''}
          key={note?.id ?? 'kosong'}
          placeholder="Judul catatan"
          aria-label="Judul catatan"
          onChange={(e) => {
            draft.current.title = e.target.value;
            queueSave();
          }}
        />
        <p className="save-state" aria-live="polite">{statusLabel}</p>

        <div className="editor-scroll">
          {note &&
            (mode === 'baca' ? (
              <Suspense fallback={<p className="save-state">Menyiapkan pratinjau…</p>}>
                <Preview content={draft.current.content} />
              </Suspense>
            ) : (
              <Editor
                docKey={note.id}
                initialValue={note.content}
                onReady={setView}
                onChange={(value) => {
                  draft.current.content = value;
                  queueSave();
                }}
              />
            ))}
        </div>

        {mode === 'tulis' && <FormatRail view={view} />}
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
