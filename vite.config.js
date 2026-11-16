import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api goes to the backend (default http://localhost:4000).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000' } },
});
