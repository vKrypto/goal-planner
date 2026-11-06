import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = (await readdir('dist', { recursive: true, withFileTypes: true })).filter(f => f.isFile() && f.name !== 'sw.js').map(f => `${f.parentPath}/${f.name}`.replace(/^dist\//, '')).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(await readFile(`dist/${file}`));
const source = await readFile('public/sw.js', 'utf8');
hash.update(source);
await writeFile('dist/sw.js', source.replace('__BUILD_VERSION__', hash.digest('hex').slice(0, 12)).replace('__PRECACHE_ASSETS__', JSON.stringify(files.map(f => `./${f}`))));
console.log(`PWA: precaching ${files.length} assets.`);
