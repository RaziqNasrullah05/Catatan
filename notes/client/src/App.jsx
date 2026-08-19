import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api.js';
import Home from './pages/Home.jsx';
import Invite from './pages/Invite.jsx';
import Login from './pages/Login.jsx';
import NoteEditor from './pages/NoteEditor.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = belum diketahui
  const location = useLocation();

  useEffect(() => {
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  async function signOut() {
    await api.logout().catch(() => {});
    setUser(null);
  }

  if (user === undefined) {
    return <div className="page"><p className="lede">Memuat…</p></div>;
  }

  const publicRoute = location.pathname.startsWith('/login') || location.pathname.startsWith('/invite');
  if (!user && !publicRoute) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/invite/:token" element={<Invite />} />
      <Route path="/" element={<Home user={user} onSignOut={signOut} />} />
      <Route path="/catatan/:id" element={<NoteEditor />} />
      <Route path="/pengaturan" element={<Settings user={user} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}