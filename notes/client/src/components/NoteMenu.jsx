import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pin, PinOff, Trash2, Users } from 'lucide-react';

const GAP = 8;
const MARGIN = 12;

/**
 * Menu kontekstual untuk satu catatan. Diposisikan di ruang kosong terdekat —
 * di bawah kartu bila muat, kalau tidak di atasnya — supaya kartu yang sedang
 * ditekan tetap terlihat.
 */
export default function NoteMenu({ anchor, note, onPin, onDelete, onGrup, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const menu = el.getBoundingClientRect();
    const ruangBawah = window.innerHeight - anchor.bottom;

    const top =
      ruangBawah >= menu.height + GAP + MARGIN
        ? anchor.bottom + GAP
        : Math.max(MARGIN, anchor.top - menu.height - GAP);

    const left = Math.min(
      Math.max(MARGIN, anchor.left),
      window.innerWidth - menu.width - MARGIN
    );
    setPos({ top, left });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return (
    <div className="menu-scrim" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div
        ref={ref}
        className="note-menu"
        role="menu"
        aria-label={`Tindakan untuk ${note.title || 'catatan tanpa judul'}`}
        style={pos ? { top: pos.top, left: pos.left } : { opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button role="menuitem" onClick={onPin}>
          {note.pinned ? <PinOff size={17} strokeWidth={1.8} /> : <Pin size={17} strokeWidth={1.8} />}
          {note.pinned ? 'Lepas sematan' : 'Sematkan'}
        </button>
        <button role="menuitem" onClick={onGrup}>
          <Users size={17} strokeWidth={1.8} />
          Simpan ke grup
        </button>
        <button role="menuitem" className="danger" onClick={onDelete}>
          <Trash2 size={17} strokeWidth={1.8} />
          Hapus
        </button>
      </div>
    </div>
  );
}