import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  BookOpen,
  CalendarCheck,
  Code,
  Heading1,
  Heading2,
  Heading3,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Square,
  SquareCheck,
  Stethoscope,
  Strikethrough,
  Link2 as LinkIcon2,
  ImagePlus,
  Search,
  Table,
  Users,
} from 'lucide-react';
import { changeIndent, insertBlock, insertLink, toggleLinePrefix, wrapInline } from '../cm/actions.js';
import { templates } from '../templates.js';
import TableEditor from './TableEditor.jsx';
import { emptyTable, findTableAtOffset } from '../cm/table.js';
import { api } from '../api.js';

/** 2 MB, sama dengan batas di server. */
const BATAS_GAMBAR = 2 * 1024 * 1024;

const TEMPLATE_ICONS = { CalendarCheck, ListChecks, Users, Stethoscope, Table, BookOpen };

export default function FormatRail({ view, noteId }) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [table, setTable] = useState(null);
  const [sebutan, setSebutan] = useState(null);
  const [gambarSibuk, setGambarSibuk] = useState(false);
  const [gambarError, setGambarError] = useState('');
  const berkasRef = useRef(null);
  const guard = (fn) => () => view && fn(view);

  /** Membuka penyunting kisi: memuat tabel di posisi kursor, atau membuat yang baru. */
  function openTable(v) {
    const text = v.state.doc.toString();
    const found = findTableAtOffset(text, v.state.selection.main.head);
    setTable(found ? { data: found, range: { from: found.from, to: found.to } } : { data: emptyTable() });
  }

  /** Menulis hasil suntingan kembali ke dokumen. */
  function applyTable(markdown) {
    if (!view) return;
    if (table.range) {
      view.dispatch({ changes: { ...table.range, insert: markdown } });
    } else {
      const line = view.state.doc.lineAt(view.state.selection.main.head);
      const perluBaris = line.text.trim().length > 0;
      const at = perluBaris ? line.to : line.from;
      view.dispatch({
        changes: { from: at, to: at, insert: `${perluBaris ? '\n\n' : ''}${markdown}\n` },
      });
    }
    view.focus();
  }

  async function unggah(file) {
    setGambarError('');
    if (!noteId) return setGambarError('Simpan catatannya dulu sebelum menambahkan gambar.');

    // Diperiksa juga di sini, bukan hanya di server: menolak 2 MB setelah
    // terkirim berarti membuang kuota data penggunanya lebih dulu.
    if (file.size > BATAS_GAMBAR) {
      return setGambarError(`Gambar terlalu besar (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimal 2 MB.`);
    }

    setGambarSibuk(true);
    try {
      const g = await api.unggahGambar(noteId, file);
      const nama = file.name?.replace(/\.[^.]+$/, '') || 'gambar';
      insertBlock(view, `![${nama}](${g.url})`);
    } catch (err) {
      setGambarError(err.message);
    } finally {
      setGambarSibuk(false);
    }
  }

  const buttons = [
    { key: 'b', label: 'Tebal', Icon: Bold, run: (v) => wrapInline(v, '**') },
    { key: 'i', label: 'Miring', Icon: Italic, run: (v) => wrapInline(v, '*') },
    { key: 's', label: 'Coret', Icon: Strikethrough, run: (v) => wrapInline(v, '~~') },
    { sep: true, key: 'sep1' },
    { key: 'h1', label: 'Judul besar', Icon: Heading1, run: (v) => toggleLinePrefix(v, '# ') },
    { key: 'h2', label: 'Judul sedang', Icon: Heading2, run: (v) => toggleLinePrefix(v, '## ') },
    { key: 'h3', label: 'Judul kecil', Icon: Heading3, run: (v) => toggleLinePrefix(v, '### ') },
    { sep: true, key: 'sep2' },
    { key: 'task', label: 'Tugas', Icon: SquareCheck, run: (v) => toggleLinePrefix(v, '- [ ] ') },
    { key: 'ul', label: 'Daftar', Icon: List, run: (v) => toggleLinePrefix(v, '- ') },
    { key: 'ol', label: 'Daftar bernomor', Icon: ListOrdered, run: (v) => toggleLinePrefix(v, '1. ') },
    { key: 'quote', label: 'Kutipan', Icon: Quote, run: (v) => toggleLinePrefix(v, '> ') },
    { sep: true, key: 'sep3' },
    { key: 'outdent', label: 'Kurangi indentasi (Shift+Tab)', Icon: IndentDecrease, run: (v) => changeIndent(v, -1) },
    { key: 'indent', label: 'Tambah indentasi (Tab)', Icon: IndentIncrease, run: (v) => changeIndent(v, 1) },
    { sep: true, key: 'sep4' },
    { key: 'link', label: 'Tautan', Icon: LinkIcon, run: insertLink },
    { key: 'sebut', label: 'Sebut catatan', Icon: LinkIcon2, run: () => setSebutan({ daftar: null, cari: '' }) },
    { key: 'gambar', label: 'Tambah gambar', Icon: ImagePlus, run: () => berkasRef.current?.click() },
    { key: 'code', label: 'Kode', Icon: Code, run: (v) => wrapInline(v, '`') },
    { key: 'table', label: 'Tabel', Icon: Table, run: openTable },
    { key: 'hr', label: 'Garis pemisah', Icon: Minus, run: (v) => insertBlock(v, '---') },
  ];

  return (
    <div className="rail">
      {showTemplates && (
        <div className="template-row" role="group" aria-label="Sisipkan template">
          {templates.map((tpl) => {
            const Icon = TEMPLATE_ICONS[tpl.icon] || Square;
            return (
              <button
                key={tpl.id}
                type="button"
                className="template-chip"
                onClick={() => {
                  if (!view) return;
                  insertBlock(view, tpl.build().trimEnd());
                  setShowTemplates(false);
                }}
              >
                <Icon size={15} strokeWidth={1.75} />
                {tpl.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="rail-scroll" role="toolbar" aria-label="Format tulisan">
        <button
          type="button"
          className={`rail-btn ${showTemplates ? 'is-on' : ''}`}
          aria-pressed={showTemplates}
          aria-label="Template"
          title="Template"
          onClick={() => setShowTemplates((v) => !v)}
        >
          <ListChecks size={19} strokeWidth={1.75} />
        </button>
        <span className="rail-sep" aria-hidden="true" />

        {buttons.map((btn) =>
          btn.sep ? (
            <span key={btn.key} className="rail-sep" aria-hidden="true" />
          ) : (
            <button
              key={btn.key}
              type="button"
              className="rail-btn"
              title={btn.label}
              aria-label={btn.label}
              // mousedown dicegah agar fokus tidak lepas dari editor di desktop.
              onMouseDown={(e) => e.preventDefault()}
              onClick={guard(btn.run)}
            >
              <btn.Icon size={19} strokeWidth={1.75} />
            </button>
          )
        )}
      </div>

      {/* Pemilih berkas disembunyikan; tombol di rail yang membukanya, supaya
          tampilannya seragam dengan tombol format lain. */}
      <input
        ref={berkasRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Nilai dikosongkan agar memilih berkas yang sama dua kali tetap memicu.
          e.target.value = '';
          if (file) unggah(file);
        }}
      />

      {(gambarSibuk || gambarError) && (
        <p className={`rail-kabar ${gambarError ? 'bad' : ''}`} aria-live="polite">
          {gambarError || 'Mengunggah gambar…'}
        </p>
      )}

      {sebutan && (
        <PemilihSebutan
          view={view}
          onTutup={() => setSebutan(null)}
        />
      )}

      {table && (
        <TableEditor
          initial={table.data}
          isNew={!table.range}
          onApply={applyTable}
          onClose={() => setTable(null)}
        />
      )}
    </div>
  );
}

/**
 * Pemilih catatan untuk disebut. Menyisipkan `[[Judul|id]]`, bukan `[[Judul]]`
 * saja, supaya tautannya tetap benar bila judul catatan itu berubah kemudian.
 */
function PemilihSebutan({ view, onTutup }) {
  const [daftar, setDaftar] = useState(null);
  const [cari, setCari] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let hidup = true;
    api
      .indeksCatatan()
      .then((d) => hidup && setDaftar(d.catatan))
      .catch((err) => hidup && setError(err.message));
    return () => {
      hidup = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onTutup();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTutup]);

  const kata = cari.trim().toLowerCase();
  const tersaring = (daftar || []).filter((c) => !kata || c.judul.toLowerCase().includes(kata));

  function sisipkan(c) {
    if (!view) return onTutup();
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: `[[${c.judul}|${c.id}]]` },
      selection: { anchor: from + c.judul.length + c.id.length + 5 },
    });
    onTutup();
    view.focus();
  }

  return (
    <div className="sheet-backdrop" onClick={onTutup}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>Sebut catatan</h3>
        <p>Judulnya jadi tautan; diketuk saat membaca akan membuka catatan itu.</p>

        <label className="grup-field">
          <div className="baris">
            <input
              autoFocus
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari judul catatan"
              aria-label="Cari judul catatan"
            />
          </div>
        </label>

        {error && <p className="m3-note bad">{error}</p>}

        {daftar === null ? (
          <p className="pilih-kosong">Memuat catatan…</p>
        ) : tersaring.length === 0 ? (
          <p className="pilih-kosong">
            {kata ? 'Tidak ada judul yang cocok.' : 'Belum ada catatan lain untuk disebut.'}
          </p>
        ) : (
          <div className="pilih-grup">
            {tersaring.slice(0, 50).map((c) => (
              <button key={c.id} className="pilih-baris tombol" onClick={() => sisipkan(c)}>
                <Search size={15} strokeWidth={1.9} />
                <span>{c.judul}</span>
                {!c.milikku && <span className="pilih-tanda">grup</span>}
              </button>
            ))}
          </div>
        )}

        <div className="row">
          <button className="btn ghost" onClick={onTutup}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}