#!/usr/bin/env node
/**
 * 🖼️ **소비자 디스플레이 스케일 이행** (2026-09-30 — 대표 "다 순서대로 이상적으로 해줘")
 *
 * ## 왜
 * 2026-09-29 에 본문을 5단계로 묶으면서 **26px 이상은 일부러 남겼다** — 랜딩 히어로의 위계를
 * 세션이 혼자 바꾸는 일이라 제품 판단으로 대표에게 올렸고, 그때까지 `DISPLAY_BASELINE` 으로
 * 늘지 않게만 막아 뒀다. 이 코드모드가 그 결정의 이행이다.
 *
 * ## 실측(이행 전)
 *   임의 px      25단계 · 130건 · 41파일   (26·27·28·29·30·32·34·36·38·40·42·44·46·48·52·54·56·58·60·66·80·96·100·140·200)
 *   tailwind     5단계 ·  48건 · 29파일   (3xl 30 · 4xl 36 · 5xl 48 · 6xl 60 · 7xl 72)
 * ⇒ 디스플레이도 **체계가 둘**이었다. 본문이 `text-[Npx]` 로 통일돼 있으므로 그쪽에 맞춘다.
 *
 * ## 정본 — 7 rung 모듈러 스케일
 *   28 · 34 · 40 · 48 · 60 · 76 · 96     (비율 1.21 · 1.18 · 1.20 · 1.25 · 1.27 · 1.26)
 * 이동은 **최대 6px**(66→60 · 54→48)이고 대부분 ≤2px 다. 반응형 사다리도 보존된다 —
 * `AboutServicePage` 의 34→80→96 은 34/76/96, `PartnerHero` 의 34/44/58/66 은 34/48/60/60
 * 이 되는데, 뒤 두 rung 이 같아지므로 **그 한 줄만 손으로 40/48/60 으로 재배치**했다
 * (기계가 사다리를 무너뜨리는 자리라 사람이 판단해야 한다 — 아래 LADDER_FIX).
 *
 * ## ⚠️ 96px 초과는 **글자가 아니라 그래픽**이라 건드리지 않는다
 *   `IntroducePage` 100px(`opacity-[0.04] select-none` 워터마크 숫자)
 *   `NotFoundPage` 140/200px(404 글리프, `select-none` + `bg-clip-text`)
 * 이것들을 스케일에 밀어넣으면 그림이 망가진다. 가드가 "96 초과는 `select-none` 이어야 한다"를
 * 대조해, 진짜 글자가 이 예외로 새는 것을 막는다.
 *
 * ## 쓰는 법
 *   node scripts/codemods/display-scale.mjs --dry     # 무엇이 바뀔지만
 *   node scripts/codemods/display-scale.mjs           # 적용
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const DRY = process.argv.includes('--dry')
const RUNGS = [28, 34, 40, 48, 60, 76, 96]
const GRAPHIC_ABOVE = 96
/** tailwind 디스플레이 단계 → px (tailwind 기본값) */
const TW_PX = { '3xl': 30, '4xl': 36, '5xl': 48, '6xl': 60, '7xl': 72, '8xl': 96 }

const nearest = (n) => RUNGS.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a))

const LOCK_ROWS = new Set(
  [...fs.readFileSync('CLAUDE.md', 'utf8').matchAll(/^\| `(src\/[^`]+?)`/gm)].map((m) => m[1]),
)
const MIRRORS = new Set(['src/pages/vouchers/TopChromeReserve.tsx'])

const files = execSync(
  "git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/*.tsx' 'src/components/**/*.tsx'",
  { encoding: 'utf8' },
)
  .trim().split('\n').filter(Boolean)
  .filter((f) => !/(admin|seller|agency|wholesale|supplier|marketing|debug|design-variants|Admin|Seller|Agency|Wholesale|Supplier)/.test(f))
  .filter((f) => !LOCK_ROWS.has(f) && !MIRRORS.has(f))

let changedFiles = 0
const moves = new Map()
for (const f of files) {
  const before = fs.readFileSync(f, 'utf8')
  let s = before
  s = s.replace(/text-\[([0-9.]+)px\]/g, (whole, num) => {
    const n = parseFloat(num)
    if (n < 26 || n > GRAPHIC_ABOVE) return whole
    const to = nearest(n)
    if (to === n) return whole
    moves.set(`${n}→${to}`, (moves.get(`${n}→${to}`) || 0) + 1)
    return `text-[${to}px]`
  })
  s = s.replace(/\btext-(3xl|4xl|5xl|6xl|7xl|8xl)\b/g, (whole, step) => {
    const to = nearest(TW_PX[step])
    moves.set(`${step}(${TW_PX[step]})→${to}`, (moves.get(`${step}(${TW_PX[step]})→${to}`) || 0) + 1)
    return `text-[${to}px]`
  })
  if (s !== before) {
    changedFiles++
    if (!DRY) fs.writeFileSync(f, s)
  }
}
console.log(`${DRY ? '[dry] ' : ''}디스플레이 스케일 이행 — ${changedFiles}파일`)
console.log(`정본: ${RUNGS.join(' · ')}   (${GRAPHIC_ABOVE}px 초과는 그래픽이라 무접촉)`)
for (const [k, v] of [...moves.entries()].sort()) console.log(`   ${k.padEnd(16)} × ${v}`)
