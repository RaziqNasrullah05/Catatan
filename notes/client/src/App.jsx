import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api.js';
import { NoteListSkeleton } from './components/Skeleton.jsx';
import { withMinDelay } from './utils.js';
import Home from './pages/Home.jsx';
import GroupNotes from './pages/GroupNotes.jsx';
import GroupSettings from './pages/GroupSettings.jsx';
import Invite from './pages/Invite.jsx';
import Login from './pages/Login.jsx';
import NoteEditor from './pages/NoteEditor.jsx';
import Notification from './pages/Notification.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = belum diketahui
  const location = useLocation();

  useEffect(() => {
    withMinDelay(api.me())
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  async function signOut() {
    await api.logout().catch(() => {});
    setUser(null);
  }

  // Kerangka ringan selagi status sesi diperiksa, agar tidak ada layar kosong.
  if (user === undefined) {
    return (
      <div className="app" aria-hidden="true">
        <header className="topbar">
          <span className="sk" style={{ height: 22, width: 96 }} />
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <span className="sk" style={{ width: 34, height: 34, borderRadius: 10 }} />
            <span className="sk" style={{ width: 34, height: 34, borderRadius: 10 }} />
          </span>
        </header>
        <div className="segmented"><span className="sk" style={{ height: 32, width: '100%' }} /></div>
        <NoteListSkeleton />
      </div>
    );
  }

  const publicRoute = location.pathname.startsWith('/login') || location.pathname.startsWith('/invite');
  if (!user && !publicRoute) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onSignedIn={setUser} />} />
      <Route path="/invite/:token" element={<Invite />} />
      <Route path="/" element={<Home user={user} onSignOut={signOut} />} />
      <Route path="/catatan/:id" element={<NoteEditor />} />
      <Route path="/notifikasi" element={<Notification />} />
      <Route path="/grup/:id" element={<GroupNotes />} />
      <Route path="/grup/:id/pengaturan" element={<GroupSettings user={user} />} />
      <Route path="/pengaturan" element={<Settings user={user} onUserChange={setUser} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}