import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sözleşme portalı — app'ten açılır. dist/ statik host'a (contract.turquz.app) yüklenir.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..'] }, port: 5183, host: true },
  build: { outDir: 'dist' },
});
