import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Columns2,
  Columns3,
  Copy,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  Rows3,
  Sun,
  UserPlus,
} from 'lucide-react';
import { api } from '../api.js';
import { LAYOUTS, THEMES, readLayout, readTheme, writeLayout, writeTheme } from '../prefs.js';

const LAYOUT_ICONS = { list: Rows3, 'grid-2': Columns2, 'grid-3': Columns3 };
const THEME_ICONS = { auto: Monitor, light: Sun, dark: Moon };

export default function Settings({ user }) {
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const sections = [
    { id: 'keamanan', label: 'Keamanan', Icon: KeyRound },
    { id: 'tampilan', label: 'Tampilan', Icon: Palette },
    ...(isAdmin ? [{ id: 'undang', label: 'Undang orang', Icon: UserPlus }] : []),
  ];
  const [section, setSection] = useState('keamanan');

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" aria-label="Kembali" onClick={() => navigate('/')}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="wordmark">Pengaturan</span>
      </header>

      <nav className="settings-nav" role="tablist" aria-label="Bagian pengaturan">
        {sections.map(({ id, label, Icon }) => (
          <button key={id} role="tab" aria-selected={section === id} onClick={() => setSection(id)}>
            <Icon size={15} strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </nav>

      <div className="scroll">
        <div className="settings-body">
          {section === 'keamanan' && <SecuritySection user={user} />}
          {section === 'tampilan' && <AppearanceSection />}
          {section === 'undang' && isAdmin && <InviteSection user={user} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- Keamanan ---------- */

function SecuritySection({ user }) {
  const [pwd, setPwd] = useState('');
  const [oldPwd, setOldPwd] = useState('');
  const [hasPassword, setHasPassword] = useState(Boolean(user?.hasPassword));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save() {
    setMessage('');
    setError('');
    try {
      await api.setPassword(pwd, oldPwd || undefined);
      setHasPassword(true);
      setPwd('');
      setOldPwd('');
      setMessage('Kata sandi tersimpan. Lain kali kamu bisa langsung masuk tanpa membuka email.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="card">
        <h3>Kata sandi</h3>
        <p className="hint">
          {hasPassword
            ? 'Kata sandi sudah aktif. Isi kolom di bawah untuk menggantinya.'
            : 'Pasang kata sandi supaya tidak perlu membuka email setiap kali masuk.'}
        </p>
        {hasPassword && (
          <label className="field">
            <span>Kata sandi lama</span>
            <input
              type="password"
              autoComplete="current-password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
            />
          </label>
        )}
        <label className="field">
          <span>Kata sandi baru (minimal 10 karakter)</span>
          <input
            type="password"
            autoComplete="new-password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
          />
        </label>
        <button className="btn" onClick={save} disabled={pwd.length < 10}>
          {hasPassword ? 'Ganti kata sandi' : 'Pasang kata sandi'}
        </button>
        {message && <p className="notice">{message}</p>}
        {error && <p className="notice bad">{error}</p>}
      </div>

      <div className="card">
        <h3>Akun</h3>
        <p className="hint" style={{ margin: 0 }}>
          Masuk sebagai <b>{user?.email}</b> · {user?.role === 'admin' ? 'Admin' : 'Anggota'}
        </p>
      </div>
    </>
  );
}

/* ---------- Tampilan ---------- */

function AppearanceSection() {
  const [layout, setLayout] = useState(readLayout);
  const [theme, setTheme] = useState(readTheme);

  return (
    <>
      <div className="card">
        <h3>Daftar catatan</h3>
        <p className="hint">Cara catatan disusun di halaman utama.</p>
        <div className="choice-row" role="radiogroup" aria-label="Tampilan daftar catatan">
          {LAYOUTS.map(({ id, label }) => {
            const Icon = LAYOUT_ICONS[id];
            return (
              <button
                key={id}
                role="radio"
                aria-checked={layout === id}
                className={`choice ${layout === id ? 'is-on' : ''}`}
                onClick={() => {
                  setLayout(id);
                  writeLayout(id);
                }}
              >
                <Icon size={20} strokeWidth={1.6} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3>Mode warna</h3>
        <p className="hint">Otomatis mengikuti pengaturan perangkatmu.</p>
        <div className="choice-row" role="radiogroup" aria-label="Mode warna">
          {THEMES.map(({ id, label }) => {
            const Icon = THEME_ICONS[id];
            return (
              <button
                key={id}
                role="radio"
                aria-checked={theme === id}
                className={`choice ${theme === id ? 'is-on' : ''}`}
                onClick={() => {
                  setTheme(id);
                  writeTheme(id);
                }}
              >
                <Icon size={20} strokeWidth={1.6} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3>Catatan</h3>
        <p className="hint" style={{ margin: 0 }}>
          Pilihan di halaman ini tersimpan di peramban ini saja, jadi HP dan komputermu bisa berbeda.
        </p>
      </div>
    </>
  );
}

/* ---------- Undang orang ---------- */

function InviteSection({ user }) {
  const [email, setEmail] = useState('');
  const [users, setUsers] = useState([]);
  const [lastInvite, setLastInvite] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = () => api.users().then((d) => setUsers(d.users)).catch((err) => setError(err.message));
  useEffect(() => {
    refresh();
  }, []);

  async function invite() {
    setError('');
    setMessage('');
    try {
      const res = await api.createInvite(email.trim() || null);
      setLastInvite(res.url);
      setMessage(
        res.mailed ? `Undangan dikirim ke ${email}.` : 'Tautan undangan dibuat. Salin dan kirimkan sendiri.'
      );
      setEmail('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Tautan disalin.');
    } catch {
      setMessage('Salin manual: pilih teks tautan di atas.');
    }
  }

  return (
    <>
      <div className="card">
        <h3>Undang orang</h3>
        <p className="hint">
          Isi email untuk mengirim undangan langsung, atau kosongkan untuk membuat tautan yang kamu bagikan
          sendiri.
        </p>
        <label className="field">
          <span>Email (opsional)</span>
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="rekan@contoh.id"
          />
        </label>
        <button className="btn" onClick={invite}>
          Buat undangan
        </button>

        {lastInvite && (
          <div className="notice">
            <p className="copy-url" style={{ margin: '0 0 8px' }}>{lastInvite}</p>
            <button className="btn ghost" onClick={() => copy(lastInvite)}>
              <Copy size={15} strokeWidth={1.75} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              Salin tautan
            </button>
          </div>
        )}
        {message && <p className="notice">{message}</p>}
        {error && <p className="notice bad">{error}</p>}
      </div>

      <div className="card">
        <h3>Orang di aplikasi ini</h3>
        <p className="hint">Mencabut akses akan langsung menghapus semua sesi aktif orang tersebut.</p>
        <div className="admin-list">
          {users.map((u) => (
            <div className="admin-item" key={u.id}>
              <span className="grow">
                <b>{u.email}</b>
                <small>
                  {u.role === 'admin' ? 'Admin' : 'Anggota'}
                  {u.disabled ? ' · akses dicabut' : ''}
                  {u.last_seen_at
                    ? ` · terakhir aktif ${new Date(u.last_seen_at).toLocaleDateString('id-ID')}`
                    : ''}
                </small>
              </span>
              {u.id !== user.id && (
                <button
                  className="btn ghost"
                  style={{ width: 'auto', padding: '7px 12px', fontSize: 13 }}
                  onClick={async () => {
                    await api.setAccess(u.id, !u.disabled);
                    refresh();
                  }}
                >
                  {u.disabled ? 'Pulihkan' : 'Cabut akses'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}