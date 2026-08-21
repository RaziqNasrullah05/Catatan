import { useEffect, useRef } from 'react';
import { EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { livePreview } from '../cm/livePreview.js';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { changeIndent, perubahanPenomoran } from '../cm/actions.js';
import { sumberSebutan } from '../cm/mention.js';

/**
 * Menjaga penomoran daftar tetap urut setelah baris ditambah atau dihapus.
 *
 * Dipasang sebagai transactionFilter, bukan updateListener, karena penomorannya
 * ikut dalam transaksi yang sama: kursor terpetakan dengan benar, riwayat
 * urung-lakukan tidak terisi langkah tambahan, dan tidak ada perulangan.
 *
 * Hanya berjalan saat susunan barisnya berubah. Mengetik huruf biasa tidak
 * memicunya, supaya angka yang sedang diketik tidak ditimpa di tengah jalan.
 */
const penomoranOtomatis = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr;

  // Urung dan ulang harus mengembalikan teks apa adanya. Menomori ulang di sini
  // membuat Ctrl+Z terasa rusak karena hasilnya bukan yang tadi ditinggalkan.
  if (tr.isUserEvent('undo') || tr.isUserEvent('redo')) return tr;

  let susunanBerubah = false;
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (inserted.lines > 1) susunanBerubah = true;
    else if (tr.startState.doc.sliceString(fromA, toA).includes('\n')) susunanBerubah = true;
  });
  if (!susunanBerubah) return tr;

  const changes = perubahanPenomoran(tr.state);
  // sequential: true wajib. Tanpanya CodeMirror menghitung posisi perubahan ini
  // terhadap dokumen SEBELUM tr, padahal posisinya diambil dari dokumen sesudah —
  // hasilnya teks bertumpuk, atau RangeError kalau dokumennya memendek.
  return changes.length ? [tr, { changes, sequential: true }] : tr;
});

/**
 * Editor markdown. Instance CodeMirror sengaja dibuat sekali saja; perubahan isi
 * dari luar (mis. memuat catatan lain) dikirim lewat prop `docKey`.
 */
export default function Editor({ docKey, initialValue, onChange, onReady }) {
  const host = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Instance CodeMirror sengaja dibuat sekali saja, sedangkan daftar catatan dan
  // pembuat catatan baru datang belakangan dan bisa berubah. Keduanya dibaca
  // lewat ref saat saran diminta, jadi penyunting tidak perlu dirakit ulang.
  const indeksRef = useRef(indeks);
  indeksRef.current = indeks;
  const buatRef = useRef(onBuatCatatan);
  buatRef.current = onBuatCatatan;

  useEffect(() => {
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialValue ?? '',
        extensions: [
          history(),
          penomoranOtomatis,
          closeBrackets(),
          autocompletion({
            override: [
              sumberSebutan({
                ambilDaftar: () => indeksRef.current,
                onBuat: (judul) => buatRef.current?.(judul) ?? Promise.resolve(null),
              }),
            ],
            // Saran hanya untuk sebutan catatan; tanpa ini CodeMirror ikut
            // menawarkan kata dari dokumen dan itu mengganggu saat menulis biasa.
            defaultKeymap: false,
            icons: false,
          }),
          // Tab menggeser baris keluar-masuk, terutama untuk daftar bersarang.
          Prec.highest(
            keymap.of([
              { key: 'Tab', run: (v) => changeIndent(v, 1), shift: (v) => changeIndent(v, -1) },
            ])
          ),
          // closeBrackets dan saran harus mendahului keymap bawaan: Backspace
          // menghapus sepasang kurung sekaligus, dan Enter memilih saran alih-alih
          // menyisipkan baris baru saat daftarnya terbuka.
          Prec.high(keymap.of([...closeBracketsKeymap, ...completionKeymap])),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown({ base: markdownLanguage, addKeymap: true }),
          livePreview,
          EditorView.lineWrapping,
          cmPlaceholder('Mulai menulis. Ketik markdown atau pakai tombol format di bawah.'),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    onReady?.(view);
    return () => {
      view.destroy();
      viewRef.current = null;
      onReady?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey]);

  return <div ref={host} className="cm-host" />;
}