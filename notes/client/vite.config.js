import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) hanya menerima manualChunks berbentuk fungsi.
        manualChunks(id) {
          if (id.includes('@codemirror') || id.includes('@lezer')) return 'editor';
        },
      },
    },
  },
});