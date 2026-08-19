import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

export default function Login() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('error') === 'kedaluwarsa' ? 'Tautan itu sudah dipakai atau kedaluwarsa. Minta tautan baru di bawah.' : '');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api.login(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1 className="mark">Catatan</h1>
      <p className="lede">Masuk dengan email. Tanpa kata sandi — kami kirimkan satu tautan sekali pakai.</p>

      {sent ? (
        <p className="notice">
          Kalau <b>{email}</b> terdaftar, tautan masuk sudah dikirim ke sana. Tautan berlaku 15 menit.
        </p>
      ) : (
        <>
          <label className="field">
            <span>Alamat email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && email && submit()}
              placeholder="nama@contoh.id"
            />
          </label>
          <button className="btn" onClick={submit} disabled={busy || !email}>
            {busy ? 'Mengirim…' : 'Kirim tautan masuk'}
          </button>
          {error && <p className="notice bad">{error}</p>}
          <p className="lede" style={{ marginTop: 22, fontSize: 14 }}>
            Aplikasi ini khusus undangan. Belum punya akun? Minta tautan undangan dari pemilik aplikasi.
          </p>
        </>
      )}
    </div>
  );
}
