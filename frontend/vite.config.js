import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_URL = 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/shorten': API_URL,
      '/api': API_URL,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
});
