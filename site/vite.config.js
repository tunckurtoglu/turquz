import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vitrin sitesi bağımsız bir Vite uygulamasıdır (acente paneli web/ ile karışmaz).
// Statik host'a (Netlify / Vercel / GitHub Pages / Cloudflare Pages) dist/ olarak deploy edilir.
export default defineConfig({
  plugins: [react()],
  // Telefon fotoğrafları büyük harfli uzantıyla gelebilir (.JPG/.PNG) — asset say.
  assetsInclude: ['**/*.JPG', '**/*.JPEG', '**/*.PNG', '**/*.WEBP'],
  server: { port: 5180, host: true },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
