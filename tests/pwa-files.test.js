import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('manifest en serviceworker verwijzen alleen naar aanwezige appbestanden', async () => {
  const manifest = JSON.parse(await readFile(path.join(projectRoot, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  for (const icon of manifest.icons) {
    await access(path.join(projectRoot, icon.src.replace(/^\.\//, '')));
  }

  const serviceWorker = await readFile(path.join(projectRoot, 'sw.js'), 'utf8');
  assert.match(serviceWorker, /CACHE_PREFIX\s*=\s*['"]voeding-pwa-/);
  assert.match(serviceWorker, /key\.startsWith\(CACHE_PREFIX\)/);
  const shellBlock = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1] ?? '';
  const shellPaths = [...shellBlock.matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
  assert.ok(shellPaths.length >= 10);
  for (const shellPath of shellPaths.filter((item) => item !== './')) {
    await access(path.join(projectRoot, shellPath.replace(/^\.\//, '')));
  }
});

test('HTML laadt de module, het manifest en lokale styles', async () => {
  const html = await readFile(path.join(projectRoot, 'index.html'), 'utf8');
  assert.match(html, /<html lang="nl">/);
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /src="\.\/src\/app\.js"/);
  assert.match(html, /id="reload-app"/);
  assert.match(html, /src="\.\/src\/pwa-update\.js"/);
  assert.match(html, /href="\.\/assets\/styles\.css"/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i);
});

test('bedieningsknoppen voorkomen dubbel-tik-zoom zonder pinch-zoom uit te schakelen', async () => {
  const styles = await readFile(path.join(projectRoot, 'assets/styles.css'), 'utf8');
  assert.match(styles, /button,\s*a\s*{\s*touch-action:\s*manipulation;/);
  assert.doesNotMatch(styles, /touch-action:\s*none/);
});
