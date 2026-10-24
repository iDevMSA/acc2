const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = process.argv[2];
const which = process.argv.slice(3);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: Number(process.env.W||1700), height: 900 }, deviceScaleFactor: 1.5 });
  for (const n of which) {
    delete require.cache[require.resolve('./lib')];
    delete require.cache[require.resolve('./' + n)];
    const html = require('./' + n);
    const f = path.join(__dirname, n + '.html');
    fs.writeFileSync(f, html);
    await p.goto('file://' + f);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(out, n + '.png'), fullPage: true });
    console.log('ok', n);
  }
  await b.close();
})();
