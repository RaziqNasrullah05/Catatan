import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  MoreVertical,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { serializeTable } from '../cm/table.js';

const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight };
const NEXT_ALIGN = { left: 'center', center: 'right', right: 'left' };
const ALIGN_LABEL = { left: 'kiri', center: 'tengah', right: 'kanan' };

/** Menu kecil yang menempel pada tombol pemicunya. */
function GridMenu({ anchor, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const menu = ref.current.getBoundingClientRect();
    const bawah = anchor.bottom + 6;
    const muat = window.innerHeight - anchor.bottom > menu.height + 16;
    setPos({
      top: muat ? bawah : Math.max(12, anchor.top - menu.height - 6),
      left: Math.min(Math.max(12, anchor.left - 8), window.innerWidth - menu.width - 12),
    });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="grid-menu-scrim" onClick={onClose}>
      <div
        ref={ref}
        className="grid-menu"
        role="menu"
        style={pos ? { top: pos.top, left: pos.left } : { opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map(({ label, Icon, run, danger, disabled }) => (
          <button
            key={label}
            role="menuitem"
            className={danger ? 'danger' : ''}
            disabled={disabled}
            onClick={() => {
              run();
              onClose();
            }}
          >
            <Icon size={16} strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Menyunting tabel sebagai kisi, bukan sebagai teks berisi tanda pipa.
 * Komponen ini tidak tahu-menahu soal CodeMirror: ia menerima data awal dan
 * menyerahkan hasilnya sebagai markdown lewat onApply, sehingga bisa dipakai
 * baik dari editor maupun dari mode baca.
 */
export default function TableEditor({ initial, isNew = false, onApply, onClose }) {
  const [align, setAlign] = useState(initial.align);
  const [rows, setRows] = useState(initial.rows);
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !menu && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, menu]);

  const setCell = (r, c, value) =>
    setRows((prev) => prev.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)));

  /* ---------- Sisip dan hapus ---------- */

  function insertColumn(at) {
    setAlign((a) => [...a.slice(0, at), 'left', ...a.slice(at)]);
    setRows((prev) => prev.map((row) => [...row.slice(0, at), '', ...row.slice(at)]));
  }

  function insertRow(at) {
    setRows((prev) => [...prev.slice(0, at), Array(align.length).fill(''), ...prev.slice(at)]);
  }

  function removeColumn(c) {
    if (align.length <= 1) return;
    setAlign((a) => a.filter((_, i) => i !== c));
    setRows((prev) => prev.map((row) => row.filter((_, i) => i !== c)));
  }

  function removeRow(r) {
    // Baris pertama adalah kepala tabel; markdown mewajibkannya ada.
    if (r === 0 || rows.length <= 2) return;
    setRows((prev) => prev.filter((_, i) => i !== r));
  }

  const cycleAlign = (c) => setAlign((a) => a.map((v, i) => (i === c ? NEXT_ALIGN[v] : v)));

  function openColumnMenu(c, el) {
    setMenu({
      anchor: el.getBoundingClientRect(),
      items: [
        { label: 'Sisip kolom di kiri', Icon: ArrowLeftToLine, run: () => insertColumn(c) },
        { label: 'Sisip kolom di kanan', Icon: ArrowRightToLine, run: () => insertColumn(c + 1) },
        {
          label: `Perataan: ${ALIGN_LABEL[align[c]]}`,
          Icon: ALIGN_ICONS[align[c]],
          run: () => cycleAlign(c),
        },
        {
          label: 'Hapus kolom',
          Icon: Trash2,
          danger: true,
          disabled: align.length <= 1,
          run: () => removeColumn(c),
        },
      ],
    });
  }

  function openRowMenu(r, el) {
    const kepala = r === 0;
    setMenu({
      anchor: el.getBoundingClientRect(),
      items: [
        {
          label: 'Sisip baris di atas',
          Icon: ArrowUpToLine,
          // Menyisip di atas kepala akan menggeser kepala tabel — tidak diizinkan.
          disabled: kepala,
          run: () => insertRow(r),
        },
        { label: 'Sisip baris di bawah', Icon: ArrowDownToLine, run: () => insertRow(r + 1) },
        {
          label: kepala ? 'Baris kepala tak bisa dihapus' : 'Hapus baris',
          Icon: Trash2,
          danger: !kepala,
          disabled: kepala || rows.length <= 2,
          run: () => removeRow(r),
        },
      ],
    });
  }

  function save() {
    onApply(serializeTable(rows, align));
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet table-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Sunting tabel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="table-sheet-head">
          <h3>{isNew ? 'Tabel baru' : 'Sunting tabel'}</h3>
          <button className="icon-btn" aria-label="Tutup" onClick={onClose}>
            <X size={19} strokeWidth={1.75} />
          </button>
        </div>

        <div className="table-grid-wrap">
          <table className="table-grid">
            <thead>
              <tr>
                <th aria-hidden="true" />
                {align.map((a, c) => (
                  <th key={c}>
                    <button
                      className="grid-tool"
                      aria-label={`Pilihan kolom ${c + 1}`}
                      onClick={(e) => openColumnMenu(c, e.currentTarget)}
                    >
                      <MoreVertical size={15} strokeWidth={2} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  <td className="row-tool">
                    <button
                      className="grid-tool"
                      aria-label={`Pilihan baris ${r + 1}`}
                      onClick={(e) => openRowMenu(r, e.currentTarget)}
                    >
                      <MoreVertical size={15} strokeWidth={2} />
                    </button>
                  </td>
                  {row.map((cell, c) => (
                    <td key={c}>
                      <input
                        value={cell}
                        style={{ textAlign: align[c] }}
                        placeholder={r === 0 ? `Kolom ${c + 1}` : ''}
                        aria-label={`Baris ${r + 1} kolom ${c + 1}`}
                        onChange={(e) => setCell(r, c, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-add">
          <button onClick={() => insertRow(rows.length)}>
            <Plus size={15} strokeWidth={2} /> Baris di akhir
          </button>
          <button onClick={() => insertColumn(align.length)}>
            <Plus size={15} strokeWidth={2} /> Kolom di akhir
          </button>
        </div>

        <div className="row">
          <button className="btn ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn" onClick={save}>
            Simpan tabel
          </button>
        </div>

        {menu && <GridMenu anchor={menu.anchor} items={menu.items} onClose={() => setMenu(null)} />}
      </div>
    </div>
  );
}