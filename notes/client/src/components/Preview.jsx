import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { remarkSebutan, kunciJudul } from '../wikilink.js';

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

export default function Preview({ content, onEditTable, indeks, stateNavigasi }) {
  const navigate = useNavigate();

  // Peta judul → id dibangun sekali per daftar, bukan tiap sebutan ditemui.
  const cariId = useMemo(() => {
    const peta = new Map();
    for (const c of indeks || []) {
      const k = kunciJudul(c.judul);
      // Judul kembar: yang pertama menang, dan yang kedua tetap bisa ditunjuk
      // lewat bentuk [[Judul|id]] yang ditulis pemilih.
      if (!peta.has(k)) peta.set(k, c.id);
    }
    return (judul) => peta.get(kunciJudul(judul)) || null;
  }, [indeks]);

  // Tabel dibungkus tombol sunting; posisi baris diambil dari pohon markdown
  // supaya tabel yang tepat bisa ditemukan lagi di teks sumbernya.
  const components = {
    // Sebutan catatan menuju halaman lain di aplikasi ini, jadi ditangani router
    // alih-alih memuat ulang seluruh halaman.
    a({ node, href, children, ...props }) {
      if (href?.startsWith('/catatan/')) {
        return (
          <a
            href={href}
            className="sebutan"
            onClick={(e) => {
              e.preventDefault();
              // Asal navigasi diteruskan agar tombol kembali tetap tahu jalan pulang.
              navigate(href, stateNavigasi ? { state: stateNavigasi } : undefined);
            }}
          >
            {children}
          </a>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
          {children}
        </a>
      );
    },
    ...(onEditTable
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
    : {}),
  };

  return (
    <div className="preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkSebutan, { cariId }]]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={components}
      >
        {content || '_Catatan ini masih kosong._'}
      </ReactMarkdown>
    </div>
  );
}