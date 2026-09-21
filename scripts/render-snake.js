const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const htmlFile = process.argv[2];
  const outDir = process.argv[3] || 'frames';
  const fps = parseInt(process.argv[4] || '10', 10);
  const seconds = parseInt(process.argv[5] || '32', 10);
  const dpr = parseInt(process.argv[6] || '2', 10);

  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 880, height: 192 }, deviceScaleFactor: dpr });
  const client = await page.context().newCDPSession(page);
  const html = fs.readFileSync(htmlFile, 'utf8');
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  const N = Math.round(fps * seconds);
  const step = 1000 / fps;
  const t0 = Date.now();
  let missed = 0;
  for (let i = 0; i < N; i++) {
    const target = t0 + i * step;
    const wait = target - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    else if (wait < -15) missed++;
    const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, `frame-${String(i).padStart(4, '0')}.png`), Buffer.from(data, 'base64'));
  }
  console.log(`rendered ${N} frames in ${(Date.now() - t0) / 1000}s (late frames: ${missed})`);
  await browser.close();
})();
