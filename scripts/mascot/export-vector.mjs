#!/usr/bin/env node
/**
 * 유달이 벡터 정본(SVG) → 투명 PNG 내보내기 (2026-10-11 대표 "벡터 원본으로도 만들어주고").
 *
 * 사용: node scripts/mascot/export-vector.mjs [폭...]   (기본 1024 4096)
 * 결과: docs/design/assets/mascot/vector/<이름>-<폭>.png
 *
 * ⚠️ 레포에는 1024 미리보기만 둔다. 인쇄용 큰 PNG(4096 등)는 필요할 때 이 명령으로 다시 만든다
 *    (정본은 SVG 이고 PNG 는 언제든 같은 값으로 재생성된다 — 공개 레포를 수 MB 씩 키우지 않는다).
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'docs/design/assets/mascot/vector'
const widths = process.argv.slice(2).map(Number).filter(Boolean)
const targets = widths.length ? widths : [1024, 4096]
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.svg'))
if (!files.length) { console.error('SVG 가 없습니다 — 통과가 아니라 실패'); process.exit(1) }

const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }))
for (const f of files) {
  const svg = fs.readFileSync(path.join(DIR, f), 'utf8')
  const [, , vw, vh] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number)
  for (const w of targets) {
    const page = await browser.newPage({ viewport: { width: Math.ceil(vw), height: Math.ceil(vh) }, deviceScaleFactor: w / vw })
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)
    const out = path.join(DIR, `${f.replace(/\.svg$/, '')}-${w}.png`)
    await (await page.$('svg')).screenshot({ path: out, omitBackground: true })
    await page.close()
    console.log(out)
  }
}
await browser.close()
