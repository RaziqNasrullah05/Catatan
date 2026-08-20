import { syntaxTree } from '@codemirror/language';
import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view';
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
          // Saat kursor berada di dalam tabel, sintaks aslinya ditampilkan agar
          // masih bisa disunting sebagai teks biasa.
          const teks = state.sliceDoc(node.from, node.to);
          const kursorDiDalam =
            active.has(state.doc.lineAt(node.from).number) ||
            active.has(state.doc.lineAt(node.to).number) ||
            [...active].some((n) => {
              const line = state.doc.line(Math.min(n, state.doc.lines));
              return line.from >= node.from && line.to <= node.to;
            });

          if (kursorDiDalam || !parseTable(teks)) {
            tagLines(node.from, node.to, 'cm-table');
            return;
          }
          items.push(
            Decoration.replace({ widget: new TableWidget(teks), block: true }).range(node.from, node.to)
          );
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