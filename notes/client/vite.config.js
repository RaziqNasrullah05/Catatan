import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Dengarkan semua antarmuka agar bisa dijangkau lewat Nginx / jaringan luar.
    host: true,
    // Vite menolak Host yang tidak dikenal sebagai perlindungan DNS rebinding.
    allowedHosts: ['catatan.warkophajisobirin.fun'],
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
    // HMR lewat domain ber-HTTPS harus memakai WebSocket aman di port 443.
    hmr: { host: 'catatan.warkophajisobirin.fun', protocol: 'wss', clientPort: 443 },
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: ['catatan.warkophajisobirin.fun'],
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