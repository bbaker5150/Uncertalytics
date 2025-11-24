import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Keeps the port consistent with CRA
    open: true, // Automatically open browser on start
  },
  build: {
    outDir: 'build', // CRA outputs to 'build', Vite defaults to 'dist'. This keeps it consistent.
  },
});