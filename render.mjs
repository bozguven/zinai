// Renders the visuals listed in clients/<client>/visuals.json to PNG files in out/<client>/.
// Usage: node render.mjs [client] [visual-id ...]
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)('playwright');
const client = process.argv[2] || 'bosphore-sur-seine';
const only = new Set(process.argv.slice(3));
const visuals = JSON.parse(readFileSync(resolve(here, 'clients', client, 'visuals.json'), 'utf8'))
  .filter((v) => only.size === 0 || only.has(v.id));
const outDir = resolve(here, 'out', client);
mkdirSync(outDir, { recursive: true });

const template = pathToFileURL(resolve(here, 'templates', 'card.html')).href;
const browser = await chromium.launch();
for (const v of visuals) {
  const height = v.format === 'story' ? 1920 : 1350;
  const page = await browser.newPage({ viewport: { width: 1080, height }, deviceScaleFactor: 1 });
  await page.addInitScript((card) => { window.CARD = card; }, v);
  await page.goto(template);
  await page.waitForSelector('body[data-ready="1"]');
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.locator('.card').screenshot({ path: resolve(outDir, `${v.id}.png`) });
  await page.close();
  console.log('rendered', v.id);
}
await browser.close();
