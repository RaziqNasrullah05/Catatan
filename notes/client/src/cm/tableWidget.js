import { WidgetType } from '@codemirror/view';

/**
 * Tabel markdown ditampilkan sebagai tabel sungguhan yang bisa disunting per sel,
 * lengkap dengan tombol tambah dan hapus baris/kolom. Sumber kebenarannya tetap
 * teks markdown di dokumen — widget ini hanya menulis ulang teks itu.
 */

const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));

const escapeCell = (text) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** Membaca perataan kolom dari baris pemisah, mis. `:---:` menjadi 'center'. */
function readAlign(line) {
  return splitRow(line).map((spec) => {
    const kiri = spec.startsWith(':');
    const kanan = spec.endsWith(':');
    if (kiri && kanan) return 'center';
    if (kanan) return 'right';
    if (kiri) return 'left';
    return null;
  });
}

const writeAlign = (align) =>
  ({ center: ':---:', right: '---:', left: ':---' }[align] || '---');

export function parseTable(text) {
  const lines = text.split('\n').filter((l) => l.trim().startsWith('|'));
  if (lines.length < 2) return null;
  const header = splitRow(lines[0]);
  const align = readAlign(lines[1]);
  const rows = lines.slice(2).map((l) => splitRow(l));
  const width = Math.max(header.length, ...rows.map((r) => r.length), 1);

  const pad = (arr) => Array.from({ length: width }, (_, i) => arr[i] ?? '');
  return {
    header: pad(header),
    align: Array.from({ length: width }, (_, i) => align[i] ?? null),
    rows: rows.map(pad),
  };
}

export function serializeTable({ header, align, rows }) {
  const baris = (cells) => `| ${cells.map(escapeCell).join(' | ')} |`;
  return [baris(header), `| ${align.map(writeAlign).join(' | ')} |`, ...rows.map(baris)].join('\n');
}

export class TableWidget extends WidgetType {
  constructor(text) {
    super();
    this.text = text;
    this.data = parseTable(text);
  }

  eq(other) {
    return other.text === this.text;
  }

  ignoreEvent() {
    return true;
  }

  /**
   * Menemukan rentang baris tabel di dokumen saat ini. Posisi dicari ulang tiap
   * kali menulis, karena isi dokumen bisa bergeser sejak widget dibuat.
   */
  range(view) {
    const pos = view.posAtDOM(this.dom);
    const doc = view.state.doc;
    if (pos == null || pos > doc.length) return null;
    let awal = doc.lineAt(pos).number;
    if (!/^\s*\|/.test(doc.line(awal).text)) return null;
    let akhir = awal;
    while (awal > 1 && /^\s*\|/.test(doc.line(awal - 1).text)) awal--;
    while (akhir < doc.lines && /^\s*\|/.test(doc.line(akhir + 1).text)) akhir++;
    return { from: doc.line(awal).from, to: doc.line(akhir).to };
  }

  commit(view) {
    const rentang = this.range(view);
    if (!rentang) return;
    view.dispatch({ changes: { ...rentang, insert: serializeTable(this.data) } });
  }

  toDOM(view) {
    const wrap = document.createElement('div');
    wrap.className = 'md-table';
    // Penting: CodeMirror hanya membiarkan isi widget kalau akarnya tidak editable.
    wrap.contentEditable = 'false';
    this.dom = wrap;
    this.render(view);
    return wrap;
  }

  render(view) {
    const { header, rows } = this.data;
    const wrap = this.dom;
    wrap.textContent = '';

    const scroll = document.createElement('div');
    scroll.className = 'md-table-scroll';

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');

    header.forEach((teks, kolom) => {
      const th = document.createElement('th');
      th.append(this.cellInput(view, teks, 'header', kolom, null));
      const hapus = this.smallButton('×', `Hapus kolom ${kolom + 1}`, () => {
        if (header.length <= 1) return;
        this.data.header.splice(kolom, 1);
        this.data.align.splice(kolom, 1);
        this.data.rows.forEach((r) => r.splice(kolom, 1));
        this.commit(view);
      });
      hapus.classList.add('col-del');
      th.append(hapus);
      headRow.append(th);
    });

    const sudut = document.createElement('th');
    sudut.className = 'gutter';
    headRow.append(sudut);
    thead.append(headRow);
    table.append(thead);

    const tbody = document.createElement('tbody');
    rows.forEach((cells, baris) => {
      const tr = document.createElement('tr');
      cells.forEach((teks, kolom) => {
        const td = document.createElement('td');
        td.append(this.cellInput(view, teks, 'body', kolom, baris));
        tr.append(td);
      });
      const aksi = document.createElement('td');
      aksi.className = 'gutter';
      aksi.append(
        this.smallButton('×', `Hapus baris ${baris + 1}`, () => {
          this.data.rows.splice(baris, 1);
          this.commit(view);
        })
      );
      tr.append(aksi);
      tbody.append(tr);
    });
    table.append(tbody);
    scroll.append(table);
    wrap.append(scroll);

    const bar = document.createElement('div');
    bar.className = 'md-table-bar';
    bar.append(
      this.textButton('+ Baris', () => {
        this.data.rows.push(new Array(this.data.header.length).fill(''));
        this.commit(view);
      }),
      this.textButton('+ Kolom', () => {
        this.data.header.push('');
        this.data.align.push(null);
        this.data.rows.forEach((r) => r.push(''));
        this.commit(view);
      })
    );
    wrap.append(bar);
  }

  cellInput(view, nilai, jenis, kolom, baris) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = nilai;
    input.className = 'md-cell';
    input.setAttribute(
      'aria-label',
      jenis === 'header' ? `Judul kolom ${kolom + 1}` : `Baris ${baris + 1} kolom ${kolom + 1}`
    );

    input.addEventListener('input', () => {
      if (jenis === 'header') this.data.header[kolom] = input.value;
      else this.data.rows[baris][kolom] = input.value;
    });
    // Dokumen ditulis saat sel ditinggalkan, bukan tiap ketikan, supaya
    // fokus tidak hilang di tengah mengetik.
    input.addEventListener('blur', () => this.commit(view));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
    return input;
  }

  smallButton(label, aria, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'md-table-x';
    b.textContent = label;
    b.setAttribute('aria-label', aria);
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', onClick);
    return b;
  }

  textButton(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'md-table-add';
    b.textContent = label;
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', onClick);
    return b;
  }
}