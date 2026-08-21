const BASE = '/api';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      // Header ini diwajibkan server sebagai pertahanan CSRF.
      'X-Requested-With': 'catatan-app',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error(data?.error || 'Permintaan gagal. Periksa koneksi lalu coba lagi.');
    // Status dan badan balasan dibawa serta: penjaga versi membalas 409 beserta
    // isi catatan terbaru, dan pemanggilnya perlu keduanya.
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request('/auth/me'),
  login: (email) => request('/auth/login', { method: 'POST', body: { email } }),
  loginWithPassword: (email, password) =>
    request('/auth/password/login', { method: 'POST', body: { email, password } }),
  setPassword: (password, currentPassword) =>
    request('/auth/password', { method: 'POST', body: { password, currentPassword } }),
  removePassword: () => request('/auth/password', { method: 'DELETE' }),
  updateProfile: (patch) => request('/auth/profile', { method: 'PATCH', body: patch }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  checkInvite: (token) => request(`/auth/invite/${encodeURIComponent(token)}`),
  acceptInvite: (token, email) =>
    request(`/auth/invite/${encodeURIComponent(token)}/accept`, { method: 'POST', body: { email } }),

  listNotes: (q) => request(`/notes${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getNote: (id) => request(`/notes/${id}`),
  createNote: (isi = {}) => request('/notes', { method: 'POST', body: isi }),
  updateNote: (id, patch) => request(`/notes/${id}`, { method: 'PATCH', body: patch }),
  deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),

  listTasks: () => request('/notes/tasks/all'),
  addTask: (text) => request('/notes/tasks', { method: 'POST', body: { text } }),
  toggleTask: (noteId, line) => request(`/notes/${noteId}/tasks/${line}/toggle`, { method: 'POST' }),

  listGrup: () => request('/groups'),
  getGrup: (id) => request(`/groups/${id}`),
  createGrup: (nama) => request('/groups', { method: 'POST', body: { nama } }),
  renameGrup: (id, nama) => request(`/groups/${id}`, { method: 'PATCH', body: { nama } }),
  deleteGrup: (id) => request(`/groups/${id}`, { method: 'DELETE' }),
  undangKeGrup: (id, orang) => request(`/groups/${id}/invite`, { method: 'POST', body: { orang } }),
  batalUndangan: (id, notifId) => request(`/groups/${id}/invites/${notifId}`, { method: 'DELETE' }),
  keluarGrup: (id) => request(`/groups/${id}/leave`, { method: 'POST' }),
  keluarkanAnggota: (id, userId) => request(`/groups/${id}/members/${userId}`, { method: 'DELETE' }),
  alihkanPemimpin: (id, userId) => request(`/groups/${id}/leader/${userId}`, { method: 'POST' }),

  grupCatatan: (noteId) => request(`/notes/${noteId}/groups`),
  simpanGrupCatatan: (noteId, grupIds) =>
    request(`/notes/${noteId}/groups`, { method: 'PUT', body: { grupIds } }),
  catatanGrup: (grupId) => request(`/groups/${grupId}/notes`),
  keluarkanCatatan: (grupId, noteId) =>
    request(`/groups/${grupId}/notes/${noteId}`, { method: 'DELETE' }),

  usulKolaborasi: (grupId, noteId, userId) =>
    request(`/groups/${grupId}/notes/${noteId}/collaborators`, { method: 'POST', body: { userId } }),
  cabutKolaborasi: (grupId, noteId, userId) =>
    request(`/groups/${grupId}/notes/${noteId}/collaborators/${userId}`, { method: 'DELETE' }),

  indeksCatatan: () => request('/notes/index'),

  listAcara: (dari, sampai) => request(`/events?dari=${dari}&sampai=${sampai}`),
  buatAcara: (isi) => request('/events', { method: 'POST', body: isi }),
  ubahAcara: (id, isi) => request(`/events/${id}`, { method: 'PATCH', body: isi }),
  hapusAcara: (id) => request(`/events/${id}`, { method: 'DELETE' }),

  listNotifikasi: () => request('/notifications'),
  jumlahNotifikasi: () => request('/notifications/count'),
  tandaiDibaca: () => request('/notifications/read', { method: 'POST' }),
  terimaNotifikasi: (id) => request(`/notifications/${id}/accept`, { method: 'POST' }),
  tolakNotifikasi: (id) => request(`/notifications/${id}/reject`, { method: 'POST' }),

  users: () => request('/admin/users'),
  invites: () => request('/admin/invites'),
  createInvite: (email) => request('/admin/invites', { method: 'POST', body: { email: email || null } }),
  setAccess: (id, disabled) => request(`/admin/users/${id}/access`, { method: 'POST', body: { disabled } }),
};