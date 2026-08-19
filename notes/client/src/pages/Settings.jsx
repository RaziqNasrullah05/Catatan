import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Columns2, Columns3, Copy, Rows3 } from 'lucide-react';
import { api } from '../api.js';
import { LAYOUTS, readLayout, writeLayout } from '../prefs.js';

export default function Settings({ user }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [users, setUsers] = useState([]);
  const [lastInvite, setLastInvite] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [layout, setLayout] = useState(readLayout);
  const isAdmin = user?.role === 'admin';

  const refresh = () => api.users().then((d) => setUsers(d.users)).catch((err) => setError(err.message));
  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  function chooseLayout(id) {
    setLayout(id);
    writeLayout(id);
  }

  async function invite() {
    setError('');
    setMessage('');
    try {
      const res = await api.createInvite(email.trim() || null);
      setLastInvite(res.url);
      setMessage(res.mailed ? `Undangan dikirim ke ${email}.` : 'Tautan undangan dibuat. Salin dan kirimkan sendiri.');
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
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" aria-label="Kembali" onClick={() => navigate('/')}>
          <ArrowLeft size={20} strokeWidth={1.75} />
        </button>
        <span className="wordmark">Pengaturan</span>
      </header>

      <div className="scroll" style={{ padding: '4px 16px 60px' }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 500, margin: '8px 0 2px' }}>Tampilan daftar catatan</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, margin: '0 0 12px' }}>
          Pilihan ini tersimpan di peramban ini saja.
        </p>
        <div className="layout-picker" role="radiogroup" aria-label="Tampilan daftar catatan">
          {LAYOUTS.map((option) => {
            const Icon = { list: Rows3, 'grid-2': Columns2, 'grid-3': Columns3 }[option.id];
            return (
              <button
                key={option.id}
                role="radio"
                aria-checked={layout === option.id}
                className={`layout-option ${layout === option.id ? 'is-on' : ''}`}
                onClick={() => chooseLayout(option.id)}
              >
                <Icon size={20} strokeWidth={1.6} />
                {option.label}
              </button>
            );
          })}
        </div>

        {!isAdmin ? null : (
        <>
        <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 500, margin: '26px 0 2px' }}>Undang orang</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, margin: '0 0 12px' }}>
          Isi email untuk mengirim undangan langsung, atau kosongkan untuk membuat tautan yang bisa kamu bagikan
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

        <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 500, margin: '26px 0 2px' }}>Orang di aplikasi ini</h3>
        <div className="admin-list">
          {users.map((u) => (
            <div className="admin-item" key={u.id}>
              <span className="grow">
                <b>{u.email}</b>
                <small>
                  {u.role === 'admin' ? 'Admin' : 'Anggota'}
                  {u.disabled ? ' · akses dicabut' : ''}
                  {u.last_seen_at ? ` · terakhir aktif ${new Date(u.last_seen_at).toLocaleDateString('id-ID')}` : ''}
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
        </>
        )}
      </div>
    </div>
  );
}