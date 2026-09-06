// Pixel-diff two PNG directories with zero dependencies: Chromium decodes the
// images onto canvases and compares pixel data.
// Usage: node scripts/qa/qa-diff.mjs <dirA> <dirB> [--threshold=0.1]
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
const [dirA, dirB] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.slice(2), true]; }));
const THRESH = Number(args.threshold ?? 0.1); // per-channel tolerance in 0..1
if (!dirA || !dirB) { console.error('usage: qa-diff <dirA> <dirB>'); process.exit(2); }
const files = readdirSync(dirA).filter(f => f.endsWith('.png') && statSync(join(dirA, f)).isFile());
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', headless: true });
const page = await browser.newPage();
await page.setContent('<canvas id=a></canvas><canvas id=b></canvas>');
let worst = 0;
for (const f of files) {
  const a = readFileSync(join(dirA, f)).toString('base64'); let b; try { b = readFileSync(join(dirB, f)).toString('base64'); } catch { console.log(`MISSING ${f} in ${dirB}`); continue; }
  const r = await page.evaluate(async ({ a, b, t }) => {
    const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
    const draw = (img, id) => { const c = document.getElementById(id); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#ff00ff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = draw(ia, 'a'), db = draw(ib, 'b');
    let diff = 0; const tol = t * 255;
    for (let i = 0; i < da.length; i += 4) { if (Math.abs(da[i] - db[i]) > tol || Math.abs(da[i+1] - db[i+1]) > tol || Math.abs(da[i+2] - db[i+2]) > tol) diff++; }
    return { diffPct: (100 * diff / (w * h)).toFixed(3), sizeA: `${ia.width}x${ia.height}`, sizeB: `${ib.width}x${ib.height}` };
  }, { a, b, t: THRESH });
  worst = Math.max(worst, Number(r.diffPct));
  console.log(`${r.diffPct.padStart(7)}%  ${basename(f)}  ${r.sizeA === r.sizeB ? r.sizeA : r.sizeA + ' -> ' + r.sizeB}`);
}
console.log(`worst: ${worst}%`);
await browser.close();
