import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.GAMEHUB_API_TARGET || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target: apiTarget, changeOrigin: true } } },
  preview: { proxy: { '/api': { target: apiTarget, changeOrigin: true } } },
});
