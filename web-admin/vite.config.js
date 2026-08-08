import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const shared = path.resolve(root, '_shared');

function withJs(p) {
  return p.endsWith('.js') || p.endsWith('.jsx') || p.endsWith('.json') ? p : `${p}.js`;
}

function monorepoShared() {
  return {
    name: 'monorepo-shared',
    enforce: 'pre',
    resolveId(id) {
      if (id.startsWith('../../../lib/')) {
        return withJs(path.resolve(shared, 'lib', id.slice('../../../lib/'.length)));
      }
      if (id.startsWith('../../../cv/')) {
        return withJs(path.resolve(shared, 'cv', id.slice('../../../cv/'.length)));
      }
      if (id.startsWith('../../../i18n/')) {
        return withJs(path.resolve(shared, 'i18n', id.slice('../../../i18n/'.length)));
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [monorepoShared(), react()],
  server: { fs: { allow: ['..', shared] }, port: 5175 },
});
