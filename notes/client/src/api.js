const BASE = '/api';

/**
 * Versi kode klien. Harus sama dengan `VERSI` di `server/src/index.js`.
 *
 * Dipakai `periksaVersi` di bawah untuk menangkap keadaan yang sudah beberapa
 * kali membuang waktu: berkas klien tersalin, berkas server tidak — atau
 * servernya belum dijalankan ulang. Gejalanya "Alamat tidak dikenal" pada
 * fitur yang jelas-jelas ada kodenya, dan dari luar tidak ada bedanya dengan
 * bug sungguhan.
 */
export const VERSI = '1.60';

/**
 * Membandingkan versi klien dan server.
 *
 * Balasannya `null` kalau cocok atau kalau tidak bisa diperiksa — server lama
 * belum punya rute ini, dan itu justru berarti ia jauh tertinggal, tapi
 * pesannya tetap harus bisa dibaca. Kegagalan jaringan tidak dianggap
 * ketidakcocokan; yang sedang tidak tersambung tidak perlu diberi tahu soal
 * versi.
 */
export async function periksaVersi() {
  try {
    const res = await fetch(`${BASE}/version`, { credentials: 'same-origin' });
    if (res.status === 404) return { klien: VERSI, server: 'lebih lama dari 1.59' };
    if (!res.ok) return null;
    const data = await res.json();
    return data?.versi === VERSI ? null : { klien: VERSI, server: data?.versi || 'tidak diketahui' };
  } catch {
    return null;
  }
}

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
    let pesan = data?.error || 'Permintaan gagal. Periksa koneksi lalu coba lagi.';
    // Jalur ikut disebut pada 404: pesan server untuk alamat tak dikenal sama
    // bunyinya untuk semua rute, jadi tanpa ini tidak ada cara tahu rute mana
    // yang hilang — dan penyebab tersering adalah berkas server yang belum
    // tersalin atau server yang belum dijalankan ulang.
    if (res.status === 404) pesan += ` (${method} ${path})`;
    const err = new Error(pesan);
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

  listNotes: (q, tag = []) => {
    // Dirangkai lewat URLSearchParams, bukan sambungan teks: kata kunci bisa
    // memuat & dan =, dan nama tag bisa memuat huruf non-Latin.
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (tag.length) p.set('tag', tag.join(','));
    const s = p.toString();
    return request(`/notes${s ? `?${s}` : ''}`);
  },
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
  // Tugas sebagai barang tersendiri (v1.39). Ceklis "- [ ]" di dalam catatan
  // tetap ada, tapi tidak lagi dikumpulkan ke tab Tugas.
  listTugas: () => request('/tasks'),
  buatTugas: (isi) => request('/tasks', { method: 'POST', body: isi }),
  ubahTugas: (id, isi) => request(`/tasks/${id}`, { method: 'PATCH', body: isi }),
  hapusTugas: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  semuaTag: () => request('/notes/tags/all'),
  semuaGayaFolder: () => request('/notes/folders/style'),
  gantiNamaFolder: (lama, baru) =>
    request('/notes/folders/rename', { method: 'PUT', body: { lama, baru } }),
  gayaFolder: (tag, pilihan) =>
    request(`/notes/folders/style/${encodeURIComponent(tag)}`, { method: 'PUT', body: pilihan }),
  simpanTag: (id, tag) => request(`/notes/${id}/tags`, { method: 'PUT', body: { tag } }),
  undangKeGrup: (id, orang) => request(`/groups/${id}/invite`, { method: 'POST', body: { orang } }),
  saranAnggota: (id, q) => request(`/groups/${id}/candidates?q=${encodeURIComponent(q)}`),
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

  /**
   * Berkas dikirim apa adanya sebagai badan permintaan, bukan multipart, sesuai
   * yang diterima server. Karena itu tidak lewat `request` yang selalu memasang
   * Content-Type JSON.
   */
  unggahGambar: async (noteId, file) => {
    const res = await fetch(`${BASE}/images?noteId=${encodeURIComponent(noteId)}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'catatan-app', 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Gambar gagal diunggah.');
    return data.gambar;
  },

  liburBulan: (bulan) => request(`/holidays?bulan=${bulan}`),

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