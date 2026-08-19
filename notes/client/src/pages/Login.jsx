import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

export default function Login({ onSignedIn }) {
  const [params] = useSearchParams();
  const [mode, setMode] = useState('sandi');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    params.get('error') === 'kedaluwarsa'
      ? 'Tautan itu sudah dipakai atau kedaluwarsa. Minta tautan baru di bawah.'
      : ''
  );

  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (mode === 'sandi') {
        await api.loginWithPassword(email, password);
        const { user } = await api.me();
        onSignedIn?.(user);
      } else {
        await api.login(email);
        setSent(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="page">
        <h1 className="mark">Cek emailmu</h1>
        <p className="notice">
          Kalau <b>{email}</b> terdaftar, tautan masuk sudah dikirim ke sana. Tautan berlaku 15 menit.
        </p>
        <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => setSent(false)}>
          Kembali
        </button>
      </div>
    );
  }

  const canSubmit = mode === 'sandi' ? Boolean(email && password) : Boolean(email);

  return (
    <div className="page">
      <h1 className="mark">Catatan</h1>
      <p className="lede">
        {mode === 'sandi'
          ? 'Masuk dengan email dan kata sandimu.'
          : 'Kami kirimkan satu tautan sekali pakai ke emailmu.'}
      </p>

      <label className="field">
        <span>Alamat email</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()}
          placeholder="nama@contoh.id"
        />
      </label>

      {mode === 'sandi' && (
        <label className="field">
          <span>Kata sandi</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()}
            placeholder="••••••••••"
          />
        </label>
      )}

      <button className="btn" onClick={submit} disabled={busy || !canSubmit}>
        {busy ? 'Sebentar…' : mode === 'sandi' ? 'Masuk' : 'Kirim tautan masuk'}
      </button>

      {error && <p className="notice bad">{error}</p>}

      <button
        className="btn ghost"
        style={{ marginTop: 12 }}
        onClick={() => {
          setMode(mode === 'sandi' ? 'tautan' : 'sandi');
          setError('');
          setPassword('');
        }}
      >
        {mode === 'sandi' ? 'Lupa kata sandi — kirim tautan ke email' : 'Masuk dengan kata sandi'}
      </button>

      <p className="lede" style={{ marginTop: 22, fontSize: 14 }}>
        Aplikasi ini khusus undangan. Belum punya akun? Minta tautan undangan dari pemilik aplikasi.
      </p>
    </div>
  );
}