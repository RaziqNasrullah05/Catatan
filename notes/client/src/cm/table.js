/**
 * Membaca dan menulis tabel markdown sebagai data kisi, supaya bisa disunting
 * lewat antarmuka tabel sungguhan alih-alih mengetik di antara tanda pipa.
 */

const isDivider = (text) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(text) && text.includes('-');
const isRow = (text) => text.trim().startsWith('|');

function splitCells(text) {
  return text
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    // Pipa yang di-escape bukan pemisah kolom.
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function readAlign(text) {
  return splitCells(text).map((cell) => {
    const kiri = cell.startsWith(':');
    const kanan = cell.endsWith(':');
    if (kiri && kanan) return 'center';
    if (kanan) return 'right';
    return 'left';
  });
}

/** Mencari tabel yang memuat posisi kursor. Mengembalikan null bila tidak ada. */
export function findTableAt(state, pos) {
  const doc = state.doc;
  const here = doc.lineAt(pos);
  if (!isRow(here.text)) return null;

  let first = here.number;
  while (first > 1 && isRow(doc.line(first - 1).text)) first--;
  let last = here.number;
  while (last < doc.lines && isRow(doc.line(last + 1).text)) last++;

  const lines = [];
  for (let n = first; n <= last; n++) lines.push(doc.line(n));

  const dividerAt = lines.findIndex((line) => isDivider(line.text));
  if (dividerAt < 1) return null;

  const align = readAlign(lines[dividerAt].text);
  const rows = lines.filter((_, i) => i !== dividerAt).map((line) => splitCells(line.text));
  const width = Math.max(align.length, ...rows.map((r) => r.length));

  return {
    from: lines[0].from,
    to: lines[lines.length - 1].to,
    align: Array.from({ length: width }, (_, i) => align[i] || 'left'),
    rows: rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? '')),
  };
}

/** Mengubah data kisi kembali menjadi teks tabel markdown yang rapi. */
export function serializeTable(rows, align) {
  const escape = (cell) => String(cell ?? '').replace(/\|/g, '\\|').trim();
  const width = align.length;
  const grid = rows.map((row) => Array.from({ length: width }, (_, i) => escape(row[i])));

  // Lebar kolom disamakan supaya sumber markdown-nya tetap enak dibaca.
  const widths = Array.from({ length: width }, (_, i) =>
    Math.max(3, ...grid.map((row) => row[i].length))
  );

  const line = (cells) => `| ${cells.map((c, i) => c.padEnd(widths[i])).join(' | ')} |`;
  const divider = align
    .map((a, i) => {
      const dash = '-'.repeat(Math.max(3, widths[i]));
      if (a === 'center') return `:${dash.slice(1, -1)}:`;
      if (a === 'right') return `${dash.slice(1)}:`;
      return dash;
    })
    .map((d, i) => d.padEnd(widths[i]));

  return [line(grid[0] || []), `| ${divider.join(' | ')} |`, ...grid.slice(1).map(line)].join('\n');
}

export const emptyTable = (cols = 3, rows = 3) => ({
  align: Array(cols).fill('left'),
  rows: Array.from({ length: rows }, () => Array(cols).fill('')),
});