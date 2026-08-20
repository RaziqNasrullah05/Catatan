import { useState } from 'react';
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
  Table,
  Users,
} from 'lucide-react';
import { changeIndent, insertBlock, insertLink, toggleLinePrefix, wrapInline } from '../cm/actions.js';
import { templates } from '../templates.js';
import TableEditor from './TableEditor.jsx';

const TEMPLATE_ICONS = { CalendarCheck, ListChecks, Users, Stethoscope, Table, BookOpen };

export default function FormatRail({ view }) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const guard = (fn) => () => view && fn(view);

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
    { key: 'code', label: 'Kode', Icon: Code, run: (v) => wrapInline(v, '`') },
    { key: 'table', label: 'Tabel', Icon: Table, run: () => setTableOpen(true) },
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

      {tableOpen && view && <TableEditor view={view} onClose={() => setTableOpen(false)} />}
    </div>
  );
}