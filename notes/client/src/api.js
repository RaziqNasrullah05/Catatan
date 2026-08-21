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
  if (!res.ok) throw new Error(data?.error || 'Permintaan gagal. Periksa koneksi lalu coba lagi.');
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
  createNote: () => request('/notes', { method: 'POST', body: {} }),
  updateNote: (id, patch) => request(`/notes/${id}`, { method: 'PATCH', body: patch }),
  deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),

  listTasks: () => request('/notes/tasks/all'),
  addTask: (text) => request('/notes/tasks', { method: 'POST', body: { text } }),
  toggleTask: (noteId, line) => request(`/notes/${noteId}/tasks/${line}/toggle`, { method: 'POST' }),

  users: () => request('/admin/users'),
  invites: () => request('/admin/invites'),
  createInvite: (email) => request('/admin/invites', { method: 'POST', body: { email: email || null } }),
  setAccess: (id, disabled) => request(`/admin/users/${id}/access`, { method: 'POST', body: { disabled } }),
};