import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Turquz Kariyer — bağımsız landing. Kendi domaininde (ör. kariyer.turquz.com) yayınlanır.
// dist/ klasörü Netlify / Vercel / Cloudflare Pages gibi statik host'a yüklenir.
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.JPG', '**/*.JPEG', '**/*.PNG', '**/*.WEBP'],
  server: { port: 5181, host: true, fs: { allow: ['..'] } },
  preview: { port: 5181, host: true },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
