import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, LogOut, Pin, Search, Settings, SquarePen } from 'lucide-react';
import { api } from '../api.js';

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
  const [tab, setTab] = useState('catatan');
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        setError('');
        const data = tab === 'catatan' ? await api.listNotes(query) : await api.listTasks();
        if (!alive) return;
        if (tab === 'catatan') setNotes(data.notes);
        else setTasks(data.tasks);
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
  }, [tab, query]);

  async function createNote() {
    try {
      const { note } = await api.createNote();
      navigate(`/catatan/${note.id}`);
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

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">Catatan</span>
        {user?.role === 'admin' && (
          <button className="icon-btn" aria-label="Pengaturan" onClick={() => navigate('/pengaturan')}>
            <Settings size={20} strokeWidth={1.75} />
          </button>
        )}
        <button className="icon-btn" aria-label="Keluar" onClick={onSignOut}>
          <LogOut size={20} strokeWidth={1.75} />
        </button>
      </header>

      {tab === 'catatan' && (
        <div className="search">
          <Search size={17} strokeWidth={1.75} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul atau isi catatan"
            aria-label="Cari catatan"
          />
        </div>
      )}

      <div className="segmented" role="group" aria-label="Tampilan">
        <button aria-pressed={tab === 'catatan'} onClick={() => setTab('catatan')}>
          Catatan
        </button>
        <button aria-pressed={tab === 'tugas'} onClick={() => setTab('tugas')}>
          Tugas
        </button>
      </div>

      {error && <p className="notice bad" style={{ margin: '10px 16px' }}>{error}</p>}

      <div className="scroll">
        {tab === 'catatan' ? (
          <div className="note-list">
            {!loading && notes.length === 0 && (
              <div className="empty">
                <h2>{query ? 'Tidak ada yang cocok' : 'Belum ada catatan'}</h2>
                <p>{query ? 'Coba kata kunci lain.' : 'Ketuk Tulis untuk memulai catatan pertama.'}</p>
              </div>
            )}
            {notes.map((note) => (
              <button key={note.id} className="note-row" onClick={() => navigate(`/catatan/${note.id}`)}>
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
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="task-group">
            {!loading && tasks.length === 0 && (
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
      </div>

      {tab === 'catatan' && (
        <button className="fab" onClick={createNote}>
          <SquarePen size={18} strokeWidth={1.75} />
          Tulis
        </button>
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
