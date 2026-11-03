import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = [
  'index.html', 'engine.js', 'search-worker.js', 'sw.js', 'manifest.webmanifest',
  'privacy.html', 'licenses.html', 'licenses', 'favicon.ico', 'fonts', 'icons', 'voices',
];

// Check both the rules and inline page scripts before copying a release.
for (const file of ['engine.js', 'search-worker.js', 'sw.js']) {
  new vm.Script(await readFile(path.join(root, file), 'utf8'), { filename: file });
}
const html = await readFile(path.join(root, 'index.html'), 'utf8');
let count = 0;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\bsrc\s*=/.test(match[1])) continue;
  new vm.Script(match[2], { filename: `index-inline-${++count}.js` });
}
JSON.parse(await readFile(path.join(root, 'manifest.webmanifest'), 'utf8'));
for (const destination of ['dist', 'ios-app/www']) {
  const out = path.join(root, destination);
  await mkdir(out, { recursive: true });
  for (const file of files) {
    await cp(path.join(root, file), path.join(out, file), { recursive: true, force: true });
  }
}
// Capacitor's CLI expects www/ to exist before syncing the native project.
const info = { source: 'https://github.com/Yasuic/literature', revision: '8074fb1af2a76841efcd0b315927eda5ff525630' };
await writeFile(path.join(root, 'dist', 'source.json'), JSON.stringify(info, null, 2) + '\n');
console.log(`Checked ${count} page scripts. Built dist/ and ios-app/www/ from the same game files.`);
