import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// CRITICAL REBUILD TRIGGER - Jan 14 2026 14:30 UTC
// CSS fully bundled: Players, Rankings, Statistics, ReportMatch
// Build cache DISABLED - forcing complete Cloudflare rebuild
// Asset hash regeneration enforced for all files
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash:8].[ext]',
        entryFileNames: 'assets/[name]-[hash:8].js',
        chunkFileNames: 'assets/[name]-[hash:8].js'
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
