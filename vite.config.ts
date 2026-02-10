import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 8414,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
