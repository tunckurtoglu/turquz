// App CV/translit ile senkron (lokal). Vercel'de parent yok → mevcut src/shared kullanılır.
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'src/shared');
const srcHtml = join(root, '../cv/buildContractHtml.js');
const srcTr = join(root, '../lib/translit.js');

if (!existsSync(srcHtml) || !existsSync(srcTr)) {
  if (existsSync(join(dest, 'buildContractHtml.js')) && existsSync(join(dest, 'translit.js'))) {
    console.log('shared deps already present (CI) — skip sync');
    process.exit(0);
  }
  console.error('missing shared sources and no cached copies');
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
copyFileSync(srcHtml, join(dest, 'buildContractHtml.js'));
copyFileSync(srcTr, join(dest, 'translit.js'));
console.log('synced shared contract deps');
