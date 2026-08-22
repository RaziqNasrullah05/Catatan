import { syntaxTree } from '@codemirror/language';
import { StateField } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';
import { TableWidget, parseTable } from './tableWidget.js';

/**
 * Pratinjau langsung ala Obsidian: tanda markdown disembunyikan dan teks tampil
 * sudah tergaya, kecuali pada baris tempat kursor berada — di sana sintaks asli
 * muncul kembali supaya tetap bisa disunting.
 */

class CheckboxWidget extends WidgetType {
  constructor(checked, pos) {
    super();
    this.checked = checked;
    this.pos = pos;
  }
  eq(other) {
    return other.checked === this.checked && other.pos === this.pos;
  }
  toDOM(view) {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'md-check';
    box.checked = this.checked;
    box.setAttribute('aria-label', this.checked ? 'Tugas selesai' : 'Tugas belum selesai');
    box.addEventListener('mousedown', (e) => e.preventDefault());
    box.addEventListener('change', () => {
      const line = view.state.doc.lineAt(this.pos);
      const replaced = line.text.replace(/\[([ xX])\]/, this.checked ? '[ ]' : '[x]');
      view.dispatch({ changes: { from: line.from, to: line.to, insert: replaced } });
    });
    return box;
  }
  ignoreEvent() {
    return false;
  }
}

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span');
    span.className = 'md-bullet';
    span.textContent = '•';
    return span;
  }
}

const hidden = Decoration.replace({});

const MARK_CLASS = {
  StrongEmphasis: 'tok-strong',
  Emphasis: 'tok-em',
  Strikethrough: 'tok-strike',
  InlineCode: 'tok-code',
  Link: 'tok-link',
};

const HIDEABLE = new Set([
  'HeaderMark',
  'EmphasisMark',
  'CodeMark',
  'StrikethroughMark',
  'QuoteMark',
  'LinkMark',
  'URL',
]);

function activeLineNumbers(state) {
  const lines = new Set();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return lines;
}

/**
 * Kursor sedang berada di dalam tabel ini?
 *
 * Kalau ya, sintaks aslinya ditampilkan supaya tabelnya masih bisa disunting
 * sebagai teks biasa. Dipakai dua tempat — penyedia widget dan penanda baris —
 * dan keduanya harus sepakat, kalau tidak tabelnya bisa tergantikan widget
 * sekaligus ditandai sebagai teks.
 */
function kursorDiDalamTabel(state, node, active) {
  if (active.has(state.doc.lineAt(node.from).number)) return true;
  if (active.has(state.doc.lineAt(node.to).number)) return true;
  return [...active].some((n) => {
    const line = state.doc.line(Math.min(n, state.doc.lines));
    return line.from >= node.from && line.to <= node.to;
  });
}

/**
 * Widget tabel disediakan StateField, bukan ViewPlugin.
 *
 * CodeMirror menolak dekorasi blok yang datang dari plugin — ia melempar
 * "Block decorations may not be specified via plugins", dan penyunting gagal
 * dipasang sama sekali. Alasannya: tinggi blok ikut menentukan perhitungan
 * viewport, sedangkan plugin baru dijalankan setelah viewport dihitung. Jadi
 * yang mengubah tinggi baris harus berasal dari state.
 *
 * Konsekuensinya seluruh dokumen dipindai, bukan hanya bagian yang terlihat:
 * state tidak tahu apa-apa tentang viewport. Untuk tabel itu tidak apa-apa —
 * yang dicari cuma simpul `Table` di puncak pohon, dan pemindaiannya berhenti
 * begitu satu ditemukan (`return false`).
 */
function tableBlocks(state) {
  const active = activeLineNumbers(state);
  const items = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'Table') return undefined;
      const teks = state.sliceDoc(node.from, node.to);
      // Tabel yang sedang disunting, atau yang tidak terbaca sebagai tabel,
      // dibiarkan tampil sebagai teks — penandaan barisnya diurus ViewPlugin.
      if (kursorDiDalamTabel(state, node, active) || !parseTable(teks)) return false;
      items.push(
        Decoration.replace({ widget: new TableWidget(teks), block: true }).range(node.from, node.to)
      );
      return false;
    },
  });
  return Decoration.set(items, true);
}

export const tabelBlok = StateField.define({
  create: (state) => tableBlocks(state),
  update(lama, tr) {
    // Selain isi dokumen, letak kursor juga menentukan: masuk ke dalam tabel
    // menukar widget dengan sintaks aslinya.
    if (!tr.docChanged && tr.startState.selection.eq(tr.state.selection)) return lama;
    return tableBlocks(tr.state);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function buildDecorations(view) {
  const { state } = view;
  const active = activeLineNumbers(state);
  const items = [];
  const linesTagged = new Set();

  const tagLines = (from, to, cls) => {
    let pos = from;
    while (pos <= to) {
      const line = state.doc.lineAt(pos);
      const key = `${line.number}:${cls}`;
      if (!linesTagged.has(key)) {
        linesTagged.add(key);
        items.push(Decoration.line({ class: cls }).range(line.from));
      }
      if (line.to >= to) break;
      pos = line.to + 1;
    }
  };

  const isActive = (pos) => active.has(state.doc.lineAt(pos).number);

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;

        if (/^ATXHeading(\d)$/.test(name)) {
          tagLines(node.from, node.to, `cm-h${name.slice(-1)}`);
          return;
        }
        if (name === 'Blockquote') return tagLines(node.from, node.to, 'cm-quote');
        if (name === 'FencedCode' || name === 'CodeBlock') return tagLines(node.from, node.to, 'cm-codeblock');
        if (name === 'Table') {
          const teks = state.sliceDoc(node.from, node.to);
          if (kursorDiDalamTabel(state, node, active) || !parseTable(teks)) {
            // Ditampilkan sebagai teks: tandai barisnya, lalu biarkan isinya
            // ditelusuri seperti biasa.
            tagLines(node.from, node.to, 'cm-table');
            return;
          }
          // Diganti widget oleh `tabelBlok`. Isinya tidak perlu ditelusuri —
          // apa pun yang ditambahkan di dalam rentang itu toh tertutup.
          return false;
        }
        if (name === 'HorizontalRule') return tagLines(node.from, node.to, 'cm-hr');

        if (MARK_CLASS[name] && node.to > node.from) {
          items.push(Decoration.mark({ class: MARK_CLASS[name] }).range(node.from, node.to));
          return;
        }

        if (name === 'TaskMarker') {
          if (isActive(node.from)) return;
          const checked = state.sliceDoc(node.from, node.to).toLowerCase().includes('x');
          items.push(
            Decoration.replace({ widget: new CheckboxWidget(checked, node.from) }).range(node.from, node.to)
          );
          if (checked) tagLines(node.from, node.to, 'cm-task-done');
          return;
        }

        if (name === 'ListMark') {
          const text = state.sliceDoc(node.from, node.to);
          if (text === '-' || text === '*' || text === '+') {
            if (isActive(node.from)) return;
            items.push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to));
          }
          return;
        }

        if (HIDEABLE.has(name) && node.to > node.from && !isActive(node.from)) {
          items.push(hidden.range(node.from, node.to));
        }
      },
    });
  }

  return Decoration.set(items, true);
}

export const livePreview = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildDecorations(view);
    }
    update(update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
);