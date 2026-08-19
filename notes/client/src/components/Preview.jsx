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

export default function Preview({ content }) {
  return (
    <div className="preview">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, schema]]}>
        {content || '_Catatan ini masih kosong._'}
      </ReactMarkdown>
    </div>
  );
}
