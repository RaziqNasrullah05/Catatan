import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Columns2,
  Columns3,
  Copy,
  KeyRound,
  LayoutList,
  Link2,
  Mail,
  Monitor,
  Moon,
  Palette,
  Rows3,
  ShieldCheck,
  Sun,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '../api.js';
import { LAYOUTS, THEMES, readLayout, readTheme, writeLayout, writeTheme } from '../prefs.js';

const LAYOUT_ICONS = { list: Rows3, 'grid-2': Columns2, 'grid-3': Columns3 };
const THEME_ICONS = { auto: Monitor, light: Sun, dark: Moon };

/* ---------- Bagian yang dipakai ulang ---------- */

function Row({ icon: Icon, title, desc, action, chip }) {
  return (
    <div className="m3-row">
      <span className="m3-icon">
        <Icon size={19} strokeWidth={1.7} />
      </span>
      <span className="m3-body">
        <span className="m3-title">
          {title}
          {chip}
        </span>
        {desc && <p className="m3-desc">{desc}</p>}
      </span>
      {action && <span className="m3-action">{action}</span>}
    </div>
  );
}

function ChipGroup({ label, options, icons, value, onChange }) {
  return (
    <div className="m3-chips" role="radiogroup" aria-label={label}>
      {options.map(({ id, label: text }) => {
        const Icon = icons[id];
        return (
          <button
            key={id}
            role="radio"
            aria-checked={value === id}
            className={`m3-chip ${value === id ? 'is-on' : ''}`}
            onClick={() => onChange(id)}
          >
            <Icon size={16} strokeWidth={1.7} />
            {text}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Halaman ---------- */

export default function Settings({ user }) {
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const sections = [
    { id: 'keamanan', label: 'Keamanan', Icon: ShieldCheck },
    { id: 'tampilan', label: 'Tampilan', Icon: Palette },
    ...(isAdmin ? [{ id: 'undang', label: 'Undang orang', Icon: UserPlus }] : []),
  ];
  const [section, setSection] = useState('keamanan');

  return (
    <div className="app settings-page">
      <header className="topbar">
        <button className="icon-btn" aria-label="Kembali" onClick={() => navigate('/')}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="wordmark">Pengaturan</span>
      </header>

      <nav className="m3-tabs" role="tablist" aria-label="Bagian pengaturan">
        {sections.map(({ id, label, Icon }) => (
          <button key={id} role="tab" aria-selected={section === id} onClick={() => setSection(id)}>
            <Icon size={16} strokeWidth={1.7} />
            {label}
          </button>
        ))}
      </nav>

      <div className="scroll">
        <div className="m3-container">
          {section === 'keamanan' && <Security user={user} />}
          {section === 'tampilan' && <Appearance />}
          {section === 'undang' && isAdmin && <Invites user={user} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- Keamanan ---------- */

function Security({ user }) {
  const [pwd, setPwd] = useState('');
  const [oldPwd, setOldPwd] = useState('');
  const [hasPassword, setHasPassword] = useState(Boolean(user?.hasPassword));
  const [editing, setEditing] = useState(!user?.hasPassword);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save() {
    setMessage('');
    setError('');
    try {
      await api.setPassword(pwd, oldPwd || undefined);
      setHasPassword(true);
      setEditing(false);
      setPwd('');
      setOldPwd('');
      setMessage('Kata sandi tersimpan. Lain kali kamu bisa langsung masuk tanpa membuka email.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <h2 className="m3-section-title">Akun</h2>
      <div className="m3-card">
        <div className="m3-row">
          <span className="m3-avatar">{user?.email?.[0] || '?'}</span>
          <span className="m3-body">
            <span className="m3-title">
              {user?.email}
              <span className="m3-status">{user?.role === 'admin' ? 'Admin' : 'Anggota'}</span>
            </span>
            <p className="m3-desc">Sesi berlaku 30 hari sejak terakhir kamu masuk.</p>
          </span>
        </div>
      </div>

      <h2 className="m3-section-title">Masuk</h2>
      <div className="m3-card">
        <Row
          icon={KeyRound}
          title="Kata sandi"
          desc={
            hasPassword
              ? 'Aktif. Kamu bisa masuk langsung tanpa membuka email.'
              : 'Belum dipasang. Saat ini kamu hanya bisa masuk lewat tautan email.'
          }
          chip={hasPassword ? <span className="m3-status">Aktif</span> : null}
          action={
            !editing && (
              <button className="m3-btn text" onClick={() => setEditing(true)}>
                Ubah
              </button>
            )
          }
        />

        {editing && (
          <>
            <div className="m3-divider" />
            <div style={{ padding: '18px 22px 22px' }}>
              {hasPassword && (
                <label className="m3-field">
                  <span>Kata sandi lama</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={oldPwd}
                    onChange={(e) => setOldPwd(e.target.value)}
                  />
                </label>
              )}
              <label className="m3-field">
                <span>Kata sandi baru — minimal 10 karakter</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                />
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="m3-btn" onClick={save} disabled={pwd.length < 10}>
                  Simpan
                </button>
                {hasPassword && (
                  <button
                    className="m3-btn text"
                    onClick={() => {
                      setEditing(false);
                      setPwd('');
                      setOldPwd('');
                      setError('');
                    }}
                  >
                    Batal
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        <div className="m3-divider" />
        <Row
          icon={Mail}
          title="Tautan masuk lewat email"
          desc="Selalu tersedia sebagai cadangan kalau kata sandi lupa. Tautan berlaku 15 menit dan sekali pakai."
          chip={<span className="m3-status">Aktif</span>}
        />
      </div>

      {message && <p className="m3-note">{message}</p>}
      {error && <p className="m3-note bad">{error}</p>}
    </>
  );
}

/* ---------- Tampilan ---------- */

function Appearance() {
  const [layout, setLayout] = useState(readLayout);
  const [theme, setTheme] = useState(readTheme);

  return (
    <>
      <h2 className="m3-section-title">Tampilan</h2>
      <div className="m3-card">
        <Row
          icon={LayoutList}
          title="Daftar catatan"
          desc="Cara catatan disusun di halaman utama."
        />
        <ChipGroup
          label="Tampilan daftar catatan"
          options={LAYOUTS}
          icons={LAYOUT_ICONS}
          value={layout}
          onChange={(id) => {
            setLayout(id);
            writeLayout(id);
          }}
        />

        <div className="m3-divider" />

        <Row icon={Palette} title="Mode warna" desc="Otomatis mengikuti pengaturan perangkatmu." />
        <ChipGroup
          label="Mode warna"
          options={THEMES}
          icons={THEME_ICONS}
          value={theme}
          onChange={(id) => {
            setTheme(id);
            writeTheme(id);
          }}
        />
      </div>

      <p className="m3-note" style={{ marginTop: 16 }}>
        Pilihan di halaman ini tersimpan di peramban ini saja, jadi HP dan komputermu bisa berbeda.
      </p>
    </>
  );
}

/* ---------- Undang orang ---------- */

function Invites({ user }) {
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
      <h2 className="m3-section-title">Undang orang</h2>
      <div className="m3-card">
        <Row
          icon={Link2}
          title="Buat undangan"
          desc="Isi email untuk mengirim undangan langsung, atau kosongkan untuk membuat tautan yang kamu bagikan sendiri. Tautan berlaku 7 hari."
        />
        <div style={{ padding: '4px 22px 22px 78px' }}>
          <label className="m3-field">
            <span>Email — opsional</span>
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rekan@contoh.id"
            />
          </label>
          <button className="m3-btn" onClick={invite}>
            Buat undangan
          </button>

          {lastInvite && (
            <div className="m3-note">
              <code>{lastInvite}</code>
              <button className="m3-btn tonal" onClick={() => copy(lastInvite)}>
                <Copy size={15} strokeWidth={1.75} />
                Salin tautan
              </button>
            </div>
          )}
          {message && <p className="m3-note">{message}</p>}
          {error && <p className="m3-note bad">{error}</p>}
        </div>
      </div>

      <h2 className="m3-section-title">Orang di aplikasi ini</h2>
      <div className="m3-card">
        <Row
          icon={Users}
          title={`${users.length} akun`}
          desc="Mencabut akses langsung menghapus semua sesi aktif orang tersebut."
        />
        {users.map((u) => (
          <div key={u.id}>
            <div className="m3-divider" />
            <div className="m3-row">
              <span className="m3-avatar">{u.email[0]}</span>
              <span className="m3-body">
                <span className="m3-title">
                  {u.email}
                  {u.role === 'admin' && <span className="m3-status">Admin</span>}
                  {Boolean(u.disabled) && <span className="m3-status muted">Dicabut</span>}
                </span>
                <p className="m3-desc">
                  {u.last_seen_at
                    ? `Terakhir aktif ${new Date(u.last_seen_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}`
                    : 'Belum pernah masuk'}
                </p>
              </span>
              {u.id !== user.id && (
                <span className="m3-action">
                  <button
                    className={u.disabled ? 'm3-btn text' : 'm3-btn danger-text'}
                    onClick={async () => {
                      await api.setAccess(u.id, !u.disabled);
                      refresh();
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
    </>
  );
}