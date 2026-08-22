/*
 * Konfigurasi ESLint untuk seluruh proyek — klien dan server sekaligus.
 *
 * Alasan berkas ini ada: `npm run build` TIDAK menangkap variabel yang tidak
 * terdefinisi di dalam komponen. Dua bug produksi lolos karenanya
 * (`reload is not defined`, `indeks is not defined`). Bundler hanya menyusun
 * modul; ia tidak tahu bahwa sebuah nama tidak pernah dideklarasikan di mana
 * pun. Yang menangkapnya adalah `no-undef`.
 *
 * Aturannya sengaja sedikit. Ini bukan penata gaya penulisan — proyek ini tidak
 * memakainya, dan menyalakan puluhan aturan gaya hanya akan menghasilkan ratusan
 * peringatan yang tidak satu pun berupa bug. Yang dicari cuma kesalahan nyata.
 */

import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

/** Aturan yang berlaku sama di klien maupun server. */
const aturanUmum = {
  'no-undef': 'error',
  // Argumen yang tak terpakai sering wajar (penangan galat Express butuh empat
  // parameter agar dikenali sebagai penangan galat), jadi hanya variabel yang
  // diperiksa. Awalan garis bawah dipakai untuk menandai "sengaja tidak dipakai".
  'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
  'no-const-assign': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-duplicate-case': 'error',
  'no-unreachable': 'error',
  'no-self-assign': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-fallthrough': 'error',
  'valid-typeof': 'error',
  'use-isnan': 'error',
};

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/data/**', '**/*.txt'],
  },

  /* ---------- Klien: React di peramban ---------- */
  {
    files: ['client/src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...aturanUmum,
      // JSX memakai nama komponen sebagai nilai; tanpa ini `no-unused-vars`
      // mengira setiap komponen yang diimpor tidak terpakai.
      'no-unused-vars': [
        'error',
        { args: 'none', varsIgnorePattern: '^(_|[A-Z])' },
      ],
      'react-hooks/rules-of-hooks': 'error',
      // Diturunkan ke peringatan, bukan galat: beberapa efek di proyek ini
      // memang sengaja tidak menyebut seluruh dependensinya (mis. penempatan
      // posisi gulir yang hanya boleh jalan sekali). Tetap ditampilkan supaya
      // yang tidak sengaja tetap terlihat.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  /* ---------- Server: Node ---------- */
  {
    files: ['server/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: aturanUmum,
  },
];