import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import purgeCss from 'vite-plugin-purgecss-updated-v5'; // [!code ++]

export default defineConfig({
  plugins: [
    react(),
    purgeCss({ // [!code ++]
      // Optional: Add variables: true to strip unused CSS variables // [!code ++]
      variables: true, // [!code ++]
    }), // [!code ++]
  ],
  base: './',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: true,
  },
});