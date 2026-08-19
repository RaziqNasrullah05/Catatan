import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';

export default function Invite() {
  const { token } = useParams();
  const [state, setState] = useState('memeriksa');
  const [email, setEmail] = useState('');
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .checkInvite(token)
      .then((data) => {
        setState('siap');
        if (data.email) {
          setEmail(data.email);
          setLocked(true);
        }
      })
      .catch((err) => {
        setState('tidak-berlaku');
        setError(err.message);
      });
  }, [token]);

  async function accept() {
    setState('mengirim');
    try {
      await api.acceptInvite(token, email);
      setState('terkirim');
    } catch (err) {
      setError(err.message);
      setState('siap');
    }
  }

  if (state === 'memeriksa') return <div className="page"><p className="lede">Memeriksa undangan…</p></div>;

  if (state === 'tidak-berlaku') {
    return (
      <div className="page">
        <h1 className="mark">Undangan tidak berlaku</h1>
        <p className="lede">{error} Minta tautan undangan baru dari pemilik aplikasi.</p>
        <a className="btn" href="/login" style={{ display: 'block', textAlign: 'center', color: '#fff' }}>
          Ke halaman masuk
        </a>
      </div>
    );
  }

  if (state === 'terkirim') {
    return (
      <div className="page">
        <h1 className="mark">Akun siap</h1>
        <p className="notice">
          Tautan masuk sudah dikirim ke <b>{email}</b>. Buka tautan itu untuk mulai menulis.
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="mark">Kamu diundang</h1>
      <p className="lede">Isi alamat email untuk membuat akun. Tidak perlu kata sandi.</p>
      <label className="field">
        <span>Alamat email</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          readOnly={locked}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@contoh.id"
        />
      </label>
      <button className="btn" onClick={accept} disabled={state === 'mengirim' || !email}>
        {state === 'mengirim' ? 'Menyiapkan…' : 'Buat akun'}
      </button>
      {error && <p className="notice bad">{error}</p>}
    </div>
  );
}
