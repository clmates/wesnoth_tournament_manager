import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Force rebuild cache invalidation - 2025-01-14-rebuild-v3-css-players-fix
// CSS verified in local build: index-BxADfcRE.css contains .players-container styles
// Forcing Cloudflare rebuild with unique timestamp cache bust
export default defineConfig({
  plugins: [react()],
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
