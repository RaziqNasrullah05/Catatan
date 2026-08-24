import { useEffect, useState } from 'react';
import { usePanel } from '../panel.js';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
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
  Check,
  Rows3,
  Search,
  ShieldCheck,
  Sun,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import { api } from '../api.js';
import { LAYOUTS, THEMES, readLayout, readTheme, writeLayout, writeTheme } from '../prefs.js';
import { PeopleSkeleton } from '../components/Skeleton.jsx';
import { withMinDelay } from '../utils.js';

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

function ChoiceDialog({ title, subtitle, options, icons, value, onPick, onClose }) {
  // Menutup dialog dengan tombol Esc, seperti dialog bawaan peramban.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="m3-scrim" onClick={onClose}>
      <div
        className="m3-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{title}</h3>
        {subtitle && <p className="sub">{subtitle}</p>}
        <div role="radiogroup" aria-label={title}>
          {options.map(({ id, label }) => {
            const Icon = icons[id];
            return (
              <button
                key={id}
                role="radio"
                aria-checked={value === id}
                className="m3-option"
                onClick={() => {
                  onPick(id);
                  onClose();
                }}
              >
                <span className="lead">
                  <Icon size={20} strokeWidth={1.7} />
                </span>
                {label}
                {value === id && (
                  <span className="tick">
                    <Check size={19} strokeWidth={2.2} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="actions">
          <button className="m3-btn text" onClick={onClose}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tanggal ISO menjadi bentuk yang enak dibaca, mis. 12 Mei 1998. */
function tanggalPanjang(iso) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function ProfilDialog({ user, onSimpan, onClose }) {
  const [username, setUsername] = useState(user?.username || '');
  const [birthdate, setBirthdate] = useState(user?.birthdate || '');
  const [error, setError] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function simpan() {
    setError('');
    setMenyimpan(true);
    try {
      // Keduanya selalu dikirim, termasuk saat kosong, supaya mengosongkan
      // kolom juga tersimpan — server membaca '' sebagai penghapusan.
      const { profile } = await api.updateProfile({ username: username.trim(), birthdate });
      onSimpan(profile);
      onClose();
    } catch (err) {
      setError(err.message);
      setMenyimpan(false);
    }
  }

  // Tanggal lahir tidak mungkin di masa depan; batasnya dipasang di input agar
  // pemilih tanggal bawaan peramban tidak menawarkannya sama sekali.
  const hariIni = new Date().toISOString().slice(0, 10);

  return (
    <div className="m3-scrim" onClick={onClose}>
      <div
        className="m3-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Edit profil"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Edit profil</h3>
        <p className="sub">Nama pengguna dipakai saat orang lain menyebut atau berbagi catatan denganmu.</p>

        <div className="m3-dialog-form">
          <label className="m3-field">
            <span>Nama pengguna</span>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              inputMode="text"
              placeholder="Username Anda"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="m3-field">
            <span>Tanggal lahir</span>
            <input
              type="date"
              max={hariIni}
              min="1900-01-01"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
            />
          </label>
          <p className="m3-hint">
            3–20 karakter: huruf kecil, angka, titik, dan garis bawah. Kosongkan salah satunya kalau
            belum ingin diisi.
          </p>
          {error && <p className="m3-note bad">{error}</p>}
        </div>

        <div className="actions">
          <button className="m3-btn text" onClick={onClose} disabled={menyimpan}>
            Batal
          </button>
          <button className="m3-btn" onClick={simpan} disabled={menyimpan}>
            {menyimpan ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Halaman ---------- */

export default function Settings({ user, onUserChange }) {
  const { kelas, tutup } = usePanel('kanan');
  const isAdmin = user?.role === 'admin';

  const sections = [
    { id: 'keamanan', label: 'Keamanan', Icon: ShieldCheck },
    { id: 'tampilan', label: 'Tampilan', Icon: Palette },
    ...(isAdmin ? [{ id: 'undang', label: 'Undang orang', Icon: UserPlus }] : []),
  ];
  const [section, setSection] = useState('keamanan');

  return (
    <div className={`app settings-page ${kelas}`}>
      <header className="topbar">
        <button className="icon-btn" aria-label="Kembali" onClick={() => tutup('/')}>
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
          {section === 'keamanan' && <Security user={user} onUserChange={onUserChange} />}
          {section === 'tampilan' && <Appearance />}
          {section === 'undang' && isAdmin && (
            <Invites user={user} keOrang={() => tutup('/pengaturan/orang')} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Keamanan ---------- */

function Security({ user, onUserChange }) {
  const [pwd, setPwd] = useState('');
  const [oldPwd, setOldPwd] = useState('');
  const [hasPassword, setHasPassword] = useState(Boolean(user?.hasPassword));
  const [editing, setEditing] = useState(!user?.hasPassword);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dialogProfil, setDialogProfil] = useState(false);

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

  const lahir = tanggalPanjang(user?.birthdate);
  const ringkasanProfil = user?.username
    ? [`@${user.username}`, lahir].filter(Boolean).join(' · ')
    : 'Belum diisi. Nama pengguna dipakai saat orang lain menyebut atau berbagi catatan denganmu.';

  return (
    <>
      <h2 className="m3-section-title">Akun</h2>
      <div className="m3-card">
        <div className="m3-row">
          <span className="m3-avatar">{(user?.username || user?.email)?.[0] || '?'}</span>
          <span className="m3-body">
            <span className="m3-title">
              {user?.email}
              <span className="m3-status">{user?.role === 'admin' ? 'Admin' : 'Anggota'}</span>
            </span>
            <p className="m3-desc">Sesi berlaku 30 hari sejak terakhir kamu masuk.</p>
          </span>
        </div>

        <div className="m3-divider" />

        <button className="m3-row tappable" onClick={() => setDialogProfil(true)}>
          <span className="m3-icon">
            <UserRound size={19} strokeWidth={1.7} />
          </span>
          <span className="m3-body">
            <span className="m3-title">Profil</span>
            <p className="m3-desc">{ringkasanProfil}</p>
          </span>
          <span className="m3-action m3-chevron">
            <ChevronRight size={20} strokeWidth={1.7} />
          </span>
        </button>
      </div>

      {dialogProfil && (
        <ProfilDialog
          user={user}
          onSimpan={(profile) => {
            onUserChange?.({ ...user, ...profile });
            setMessage('Profil tersimpan.');
          }}
          onClose={() => setDialogProfil(false)}
        />
      )}

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
  const [dialog, setDialog] = useState(null);

  const layoutLabel = LAYOUTS.find((l) => l.id === layout)?.label;
  const themeLabel = THEMES.find((t) => t.id === theme)?.label;

  return (
    <>
      <h2 className="m3-section-title">Tampilan</h2>
      <div className="m3-card">
        <button className="m3-row tappable" onClick={() => setDialog('layout')}>
          <span className="m3-icon">
            <LayoutList size={19} strokeWidth={1.7} />
          </span>
          <span className="m3-body">
            <span className="m3-title">Daftar catatan</span>
            <p className="m3-desc">Cara catatan disusun di halaman utama.</p>
          </span>
          <span className="m3-action">
            <span className="m3-status">{layoutLabel}</span>
          </span>
        </button>

        <div className="m3-divider" />

        <button className="m3-row tappable" onClick={() => setDialog('theme')}>
          <span className="m3-icon">
            <Palette size={19} strokeWidth={1.7} />
          </span>
          <span className="m3-body">
            <span className="m3-title">Mode warna</span>
            <p className="m3-desc">Otomatis mengikuti pengaturan perangkatmu.</p>
          </span>
          <span className="m3-action">
            <span className="m3-status">{themeLabel}</span>
          </span>
        </button>
      </div>

      <p className="m3-note" style={{ marginTop: 16 }}>
        Pilihan di halaman ini tersimpan di peramban ini saja, jadi HP dan komputermu bisa berbeda.
      </p>

      {dialog === 'layout' && (
        <ChoiceDialog
          title="Daftar catatan"
          subtitle="Cara catatan disusun di halaman utama."
          options={LAYOUTS}
          icons={LAYOUT_ICONS}
          value={layout}
          onPick={(id) => {
            setLayout(id);
            writeLayout(id);
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === 'theme' && (
        <ChoiceDialog
          title="Mode warna"
          subtitle="Otomatis mengikuti pengaturan perangkatmu."
          options={THEMES}
          icons={THEME_ICONS}
          value={theme}
          onPick={(id) => {
            setTheme(id);
            writeTheme(id);
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

/* ---------- Undang orang ---------- */

function Invites({ user, keOrang }) {
  const [email, setEmail] = useState('');
  const [users, setUsers] = useState(null);
  const [lastInvite, setLastInvite] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = () =>
    withMinDelay(api.users())
      .then((d) => setUsers(d.users))
      .catch((err) => setError(err.message));
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
        {/* Sejak v1.46 daftarnya halaman tersendiri. Sebagai kartu yang
            dibuka-tutup, pencarian dan hasilnya terdorong jauh ke bawah oleh
            kartu di atasnya, dan menggulirnya berarti menggulir seluruh
            halaman Pengaturan. */}
        <button className="m3-row tappable" onClick={() => keOrang()}>
          <span className="m3-icon">
            <Users size={19} strokeWidth={1.7} />
          </span>
          <span className="m3-body">
            <span className="m3-title">{users ? `${users.length} akun` : 'Memuat…'}</span>
            <p className="m3-desc">Cari, cabut, dan pulihkan akses.</p>
          </span>
          <span className="m3-action">
            <ChevronRight size={18} strokeWidth={1.75} />
          </span>
        </button>
      </div>
    </>
  );
}