import { useEffect, useRef } from 'react';
import { EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { livePreview } from '../cm/livePreview.js';
import { changeIndent } from '../cm/actions.js';

/**
 * Editor markdown. Instance CodeMirror sengaja dibuat sekali saja; perubahan isi
 * dari luar (mis. memuat catatan lain) dikirim lewat prop `docKey`.
 */
export default function Editor({ docKey, initialValue, onChange, onReady }) {
  const host = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialValue ?? '',
        extensions: [
          history(),
          // Tab menggeser baris keluar-masuk, terutama untuk daftar bersarang.
          Prec.highest(
            keymap.of([
              { key: 'Tab', run: (v) => changeIndent(v, 1), shift: (v) => changeIndent(v, -1) },
            ])
          ),
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