import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Force rebuild cache invalidation - 2025-01-14-rebuild-v2-css-fix
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
