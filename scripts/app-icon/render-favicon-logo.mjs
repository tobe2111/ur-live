// 파비콘 원본 1024px 찍기 — urdeal. 로고(2026-10-17 대표 "유달이 말고 urdeal 로고로").
//   node scripts/app-icon/render-favicon-logo.mjs && python3 scripts/app-icon/make-favicon.py
// 글꼴은 서비스와 같은 Poppins 800 서브셋(public/static/fonts) — 브라우저로 찍어야 글꼴이 같다.
import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } })
await p.goto('file://' + process.cwd() + '/scripts/app-icon/favicon-logo.html')
await p.evaluate(() => document.fonts.ready)
if (!(await p.evaluate(() => document.fonts.check('800 20px P')))) throw new Error('Poppins 가 안 실렸다 — 시스템 글꼴로 찍힌다')
await p.screenshot({ path: 'docs/design/assets/favicon-logo-1024.png' })
await b.close()
