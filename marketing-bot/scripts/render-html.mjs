// 인스타 카드 그리기 — HTML(src/card-html.mjs) → Chromium 스크린샷 (1080x1350 JPEG).
// 사용: node scripts/render-html.mjs spec.json   (spec 은 card-html.mjs 머리말 + out_dir)
// 출력: 표준출력 마지막 줄에 파일 목록 JSON (render-post.py 와 같은 약속 — visual.mjs render() 가 둘 중 하나를 쓴다)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildDeckHtml } from '../src/card-html.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
fs.mkdirSync(spec.out_dir, { recursive: true });
const html = path.join(spec.out_dir, 'deck.html');
fs.writeFileSync(html, buildDeckHtml(spec));
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await p.goto('file://' + html);
  await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 15_000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const els = await p.$$('section.s');
  const out = [];
  for (let i = 0; i < els.length; i++) {
    const f = path.join(spec.out_dir, `slide-${i + 1}.jpg`);
    await els[i].screenshot({ path: f, type: 'jpeg', quality: 92 });
    out.push(f);
  }
  console.log(JSON.stringify(out));
} finally { await b.close(); }
