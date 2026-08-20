import { Pencil } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

// Markdown ditulis pengguna, jadi HTML hasil render selalu disanitasi.
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    input: [['type', 'checkbox'], 'checked', 'disabled'],
    a: [...(defaultSchema.attributes?.a || []), ['target', '_blank'], ['rel', 'noreferrer noopener']],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
};

export default function Preview({ content, onEditTable }) {
  // Tabel dibungkus tombol sunting; posisi baris diambil dari pohon markdown
  // supaya tabel yang tepat bisa ditemukan lagi di teks sumbernya.
  const components = onEditTable
    ? {
        table({ node, children, ...props }) {
          const line = node?.position?.start?.line;
          return (
            <div className="table-block">
              <table {...props}>{children}</table>
              {line && (
                <button className="table-edit" onClick={() => onEditTable(line)}>
                  <Pencil size={13} strokeWidth={2} />
                  Sunting tabel
                </button>
              )}
            </div>
          );
        },
      }
    : undefined;

  return (
    <div className="preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={components}
      >
        {content || '_Catatan ini masih kosong._'}
      </ReactMarkdown>
    </div>
  );
}