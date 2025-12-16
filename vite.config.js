import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
  },
  test: {
    globals: true,             // Enables describe, test, expect
    environment: 'jsdom',      // Simulates browser for React components
    setupFiles: './src/setupTests.js', // Runs setup before tests
    css: true,
  },
});