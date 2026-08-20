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

/** Memecah teks jadi baris beserta posisi karakternya. */
function indexLines(text) {
  const out = [];
  let from = 0;
  for (const t of text.split('\n')) {
    out.push({ text: t, from, to: from + t.length });
    from += t.length + 1;
  }
  return out;
}

/**
 * Mencari tabel yang memuat baris ke-`lineNo` (mulai dari 1).
 * Mengembalikan rentang karakter beserta isinya, atau null bila bukan tabel.
 */
export function findTableAtLine(text, lineNo) {
  const lines = indexLines(text);
  const idx = lineNo - 1;
  if (!lines[idx] || !isRow(lines[idx].text)) return null;

  let first = idx;
  while (first > 0 && isRow(lines[first - 1].text)) first--;
  let last = idx;
  while (last < lines.length - 1 && isRow(lines[last + 1].text)) last++;

  const block = lines.slice(first, last + 1);
  const dividerAt = block.findIndex((line) => isDivider(line.text));
  if (dividerAt < 1) return null;

  const align = readAlign(block[dividerAt].text);
  const rows = block.filter((_, i) => i !== dividerAt).map((line) => splitCells(line.text));
  const width = Math.max(align.length, ...rows.map((r) => r.length));

  return {
    from: block[0].from,
    to: block[block.length - 1].to,
    align: Array.from({ length: width }, (_, i) => align[i] || 'left'),
    rows: rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? '')),
  };
}

/** Mencari tabel pada posisi karakter tertentu. */
export function findTableAtOffset(text, offset) {
  const lines = indexLines(text);
  const idx = lines.findIndex((l) => offset >= l.from && offset <= l.to);
  return idx < 0 ? null : findTableAtLine(text, idx + 1);
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