const KEY = 'catatan:tampilan';
export const LAYOUTS = [
  { id: 'list', label: 'Daftar' },
  { id: 'grid-2', label: 'Kartu 2 kolom' },
  { id: 'grid-3', label: 'Kartu 3 kolom' },
];

export function readLayout() {
  try {
    const saved = localStorage.getItem(KEY);
    return LAYOUTS.some((l) => l.id === saved) ? saved : 'list';
  } catch {
    return 'list';
  }
}

export function writeLayout(id) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Mode privat bisa memblokir penyimpanan; abaikan saja.
  }
  window.dispatchEvent(new CustomEvent('catatan:tampilan', { detail: id }));
}