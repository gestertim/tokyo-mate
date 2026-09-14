import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        'service-worker': 'src/service-worker.ts',
      },
      output: {
        // Service worker must be an unhashed root-scope file so it can be registered at /service-worker.js.
        entryFileNames: (chunk) => (chunk.name === 'service-worker' ? '[name].js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});