const LAYOUT_KEY = 'catatan:tampilan';
const THEME_KEY = 'catatan:tema';

export const LAYOUTS = [
  { id: 'list', label: 'Daftar' },
  { id: 'grid-2', label: '2 kolom' },
  { id: 'grid-3', label: '3 kolom' },
];

export const THEMES = [
  { id: 'auto', label: 'Otomatis' },
  { id: 'light', label: 'Terang' },
  { id: 'dark', label: 'Gelap' },
];

function read(key, allowed, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return allowed.some((item) => item.id === saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value, eventName) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Mode privat bisa memblokir penyimpanan; abaikan saja.
  }
  window.dispatchEvent(new CustomEvent(eventName, { detail: value }));
}

export const readLayout = () => read(LAYOUT_KEY, LAYOUTS, 'list');
export const writeLayout = (id) => write(LAYOUT_KEY, id, 'catatan:tampilan');

export const readTheme = () => read(THEME_KEY, THEMES, 'auto');

export function applyTheme(id = readTheme()) {
  document.documentElement.dataset.theme = id;
  // Warna bilah status peramban ikut menyesuaikan tema aktif.
  const dark =
    id === 'dark' || (id === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#15171a' : '#f1f2ee');
}

export function writeTheme(id) {
  write(THEME_KEY, id, 'catatan:tema');
  applyTheme(id);
}