import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: process.env.VITE_FRONTEND_PORT || 3001
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Отключаем sourcemaps для продакшена
    minify: 'esbuild' // Минификация для оптимизации
  }
});