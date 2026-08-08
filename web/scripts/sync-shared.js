// Parent i18n/cv/lib → web/_shared (Vercel alt dizinden deploy için).
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, '_shared');
const parents = {
  i18n: join(root, '../i18n'),
  cv: join(root, '../cv'),
  lib: join(root, '../lib'),
};
const libFiles = [
  'candidateCode.js',
  'translit.js',
  'pipeline.js',
  'cvDates.js',
  'cvTranslate.js',
  'lastSeenFormat.js',
];

const hasParent = existsSync(parents.i18n) && existsSync(parents.cv) && existsSync(parents.lib);
const hasCache = existsSync(join(dest, 'i18n')) && existsSync(join(dest, 'cv')) && existsSync(join(dest, 'lib'));

if (!hasParent) {
  if (hasCache) {
    console.log('_shared already present (CI) — skip sync');
    process.exit(0);
  }
  console.error('missing parent monorepo dirs and no _shared cache');
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(join(dest, 'lib'), { recursive: true });
cpSync(parents.i18n, join(dest, 'i18n'), { recursive: true });
cpSync(parents.cv, join(dest, 'cv'), { recursive: true });
for (const f of libFiles) {
  cpSync(join(parents.lib, f), join(dest, 'lib', f));
}
// RN supabase yerine stub; vite web supabase'e yönlendirir.
writeFileSync(join(dest, 'lib', 'supabase.js'), 'export const supabase = null;\n');
console.log('synced web/_shared');
