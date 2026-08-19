/** Perintah penyuntingan markdown yang dipakai tombol-tombol rail format. */

export function wrapInline(view, before, after = before) {
  const range = view.state.selection.main;
  const text = view.state.sliceDoc(range.from, range.to);
  const wrapped =
    text.length >= before.length + after.length && text.startsWith(before) && text.endsWith(after);

  // Menekan tombol yang sama pada teks yang sudah diformat akan melepas formatnya.
  const inner = wrapped ? text.slice(before.length, text.length - after.length) : `${before}${text}${after}`;
  const start = wrapped ? range.from : range.from + before.length;
  const length = wrapped ? inner.length : text.length;

  view.dispatch({
    changes: { from: range.from, to: range.to, insert: inner },
    selection: { anchor: start, head: start + length },
  });
  view.focus();
}

/** Menambah atau melepas awalan baris, mis. "## " atau "> ". */
export function toggleLinePrefix(view, prefix, { exclusive = /^(#{1,6}|>|[-*+]|\d+\.)\s+/ } = {}) {
  const { state } = view;
  const changes = [];
  const seen = new Set();

  for (const range of state.selection.ranges) {
    let pos = range.from;
    while (pos <= range.to) {
      const line = state.doc.lineAt(pos);
      if (!seen.has(line.number)) {
        seen.add(line.number);
        const text = line.text;
        if (text.startsWith(prefix)) {
          changes.push({ from: line.from, to: line.from + prefix.length, insert: '' });
        } else {
          const existing = text.match(exclusive);
          const cut = existing && !prefix.startsWith('- [') ? existing[0].length : 0;
          changes.push({ from: line.from, to: line.from + cut, insert: prefix });
        }
      }
      if (line.to >= range.to) break;
      pos = line.to + 1;
    }
  }
  view.dispatch({ changes });
  view.focus();
}

/** Menyisipkan blok pada baris baru, mis. tabel atau garis pemisah. */
export function insertBlock(view, block) {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const needsBreakBefore = line.text.trim().length > 0;
  const insert = `${needsBreakBefore ? '\n\n' : ''}${block}\n`;
  const at = needsBreakBefore ? line.to : line.from;
  view.dispatch({
    changes: { from: at, to: at, insert },
    selection: { anchor: at + insert.length - 1 },
  });
  view.focus();
}

const INDENT = '  ';

/**
 * Menambah atau mengurangi indentasi baris terpilih. Dipakai tombol rail dan
 * tombol Tab / Shift-Tab, terutama untuk membuat daftar bersarang.
 */
export function changeIndent(view, direction) {
  const { state } = view;
  const changes = [];
  const seen = new Set();

  for (const range of state.selection.ranges) {
    let pos = range.from;
    while (pos <= range.to) {
      const line = state.doc.lineAt(pos);
      if (!seen.has(line.number)) {
        seen.add(line.number);
        if (direction > 0) {
          changes.push({ from: line.from, to: line.from, insert: INDENT });
        } else {
          const lead = line.text.match(/^[ \t]+/)?.[0] ?? '';
          if (lead) {
            const cut = lead.startsWith('\t') ? 1 : Math.min(INDENT.length, lead.length);
            changes.push({ from: line.from, to: line.from + cut, insert: '' });
          }
        }
      }
      if (line.to >= range.to) break;
      pos = line.to + 1;
    }
  }

  if (!changes.length) return false;
  view.dispatch({ changes });
  view.focus();
  return true;
}

export function insertLink(view) {
  const { state } = view;
  const range = state.selection.main;
  const label = state.sliceDoc(range.from, range.to) || 'teks tautan';
  const insert = `[${label}](url)`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: range.from + label.length + 3, head: range.from + label.length + 6 },
  });
  view.focus();
}