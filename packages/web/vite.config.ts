/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { configDefaults } from 'vitest/config';

const apiTarget = process.env['VITE_API_TARGET'] ?? 'http://127.0.0.1:3400';
const wsTarget = process.env['VITE_WS_TARGET'] ?? apiTarget.replace(/^http/i, 'ws');

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: [...configDefaults.exclude, 'e2e/**', 'tests/e2e/**'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/ws': { target: wsTarget, ws: true },
    },
  },
});
