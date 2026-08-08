import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Turquz Sağlık — bağımsız landing. Örn. saglik.turquz.app
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.JPG', '**/*.JPEG', '**/*.PNG', '**/*.WEBP'],
  server: { port: 5182, host: true },
  preview: { port: 5182, host: true },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
