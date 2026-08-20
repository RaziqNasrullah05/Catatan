import { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Plus, Trash2, X } from 'lucide-react';
import { emptyTable, findTableAt, serializeTable } from '../cm/table.js';

const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight };
const NEXT_ALIGN = { left: 'center', center: 'right', right: 'left' };

/**
 * Menyunting tabel sebagai kisi, bukan sebagai teks berisi tanda pipa.
 * Data dibaca dari tabel tempat kursor berada; kalau tidak ada, tabel baru dibuat.
 */
export default function TableEditor({ view, onClose }) {
  const target = useRef(null);
  const [align, setAlign] = useState([]);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const found = findTableAt(view.state, view.state.selection.main.head);
    target.current = found ? { from: found.from, to: found.to } : null;
    const data = found || emptyTable();
    setAlign(data.align);
    setRows(data.rows);
  }, [view]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setCell = (r, c, value) =>
    setRows((prev) => prev.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)));

  const addColumn = () => {
    setAlign((a) => [...a, 'left']);
    setRows((prev) => prev.map((row) => [...row, '']));
  };
  const addRow = () => setRows((prev) => [...prev, Array(align.length).fill('')]);

  const removeColumn = (c) => {
    if (align.length <= 1) return;
    setAlign((a) => a.filter((_, i) => i !== c));
    setRows((prev) => prev.map((row) => row.filter((_, i) => i !== c)));
  };
  const removeRow = (r) => {
    // Baris pertama adalah kepala tabel; markdown mewajibkannya ada.
    if (r === 0 || rows.length <= 2) return;
    setRows((prev) => prev.filter((_, i) => i !== r));
  };

  const cycleAlign = (c) => setAlign((a) => a.map((v, i) => (i === c ? NEXT_ALIGN[v] : v)));

  function save() {
    const markdown = serializeTable(rows, align);
    const spot = target.current;
    if (spot) {
      view.dispatch({ changes: { from: spot.from, to: spot.to, insert: markdown } });
    } else {
      const line = view.state.doc.lineAt(view.state.selection.main.head);
      const perluBaris = line.text.trim().length > 0;
      view.dispatch({
        changes: {
          from: perluBaris ? line.to : line.from,
          to: perluBaris ? line.to : line.to,
          insert: `${perluBaris ? '\n\n' : ''}${markdown}\n`,
        },
      });
    }
    view.focus();
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
          <h3>{target.current ? 'Sunting tabel' : 'Tabel baru'}</h3>
          <button className="icon-btn" aria-label="Tutup" onClick={onClose}>
            <X size={19} strokeWidth={1.75} />
          </button>
        </div>

        <div className="table-grid-wrap">
          <table className="table-grid">
            <thead>
              <tr>
                <th aria-hidden="true" />
                {align.map((a, c) => {
                  const Icon = ALIGN_ICONS[a];
                  return (
                    <th key={c}>
                      <div className="col-tools">
                        <button
                          onClick={() => cycleAlign(c)}
                          aria-label={`Perataan kolom ${c + 1}: ${a}`}
                          title="Ubah perataan"
                        >
                          <Icon size={14} strokeWidth={1.9} />
                        </button>
                        <button
                          onClick={() => removeColumn(c)}
                          aria-label={`Hapus kolom ${c + 1}`}
                          title="Hapus kolom"
                          disabled={align.length <= 1}
                        >
                          <Trash2 size={14} strokeWidth={1.9} />
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  <td className="row-tool">
                    <button
                      onClick={() => removeRow(r)}
                      aria-label={`Hapus baris ${r + 1}`}
                      title={r === 0 ? 'Baris kepala tidak bisa dihapus' : 'Hapus baris'}
                      disabled={r === 0 || rows.length <= 2}
                    >
                      <Trash2 size={14} strokeWidth={1.9} />
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
          <button onClick={addRow}>
            <Plus size={15} strokeWidth={2} /> Baris
          </button>
          <button onClick={addColumn}>
            <Plus size={15} strokeWidth={2} /> Kolom
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
      </div>
    </div>
  );
}