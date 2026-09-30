#!/usr/bin/env node
/**
 * 🔒🔠 **잠금표 파일의 타입 스케일·간격 이행** (2026-09-30 — 대표 승인 "다 순서대로 이상적으로 해줘")
 *
 * 2026-09-29 에 소비자 전 화면을 정본으로 옮기면서 **잠금표 12파일만 남겼다** — 클래스만 바꾸는
 * 일이어도 잠금 절대 룰이 걸려 대표 승인이 필요했기 때문이다(`LOCKED_BASELINE` 으로 늘지 않게만
 * 막아 뒀다). 승인이 났으므로 그 baseline 을 0 으로 만든다.
 *
 * ## 매핑 (CLAUDE.md 규칙 ⑧ 정본)
 *   본문      ≤12.5→12 · 13~13.5→13 · 14~16→15 · 17~19→17 · 20~25→24
 *   tailwind  xs→12 · sm·base→15 · lg·xl→17 · 2xl→24 · 3xl~→디스플레이 rung
 *   디스플레이 28·34·40·48·60·76·96 (96 초과는 그래픽이라 무접촉)
 *   간격      *-0.5→*-1 · *-1.5→*-2 · *-2.5→*-2 · *-3.5→*-4  (음수 광학 보정 `-mt-0.5` 는 예외)
 *
 * ## ⚠️ 잠긴 계약은 손대지 않는다
 * 이 코드모드는 **className 토큰만** 바꾼다. `requestPayment`·`widgets()`·`setAmount`·SDK 마운트 id·
 * `linkshopPath`·`isActivePath`·`React.memo`·`rootMargin`·`__SSR_INITIAL_*`·`price_low` 는 문자열에
 * 손이 닿지 않는다. 이행 전후 grep 카운트로 대조한다(핸드오프에 기록).
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const DRY = process.argv.includes('--dry')
const RUNGS = [28, 34, 40, 48, 60, 76, 96]
const nearest = (n) => RUNGS.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a))
const bodyPx = (n) => (n <= 12.5 ? 12 : n <= 13.5 ? 13 : n <= 16 ? 15 : n <= 19 ? 17 : 24)
const TW = { xs: 12, sm: 15, base: 15, lg: 17, xl: 17, '2xl': 24, '3xl': 28, '4xl': 34, '5xl': 48, '6xl': 60, '7xl': 76, '8xl': 96 }
const HALF = { '0.5': '1', '1.5': '2', '2.5': '2', '3.5': '4' }
// 🕳️ 2026-09-30: `ml`·`mr` 이 빠져 있었다 — `ml-1.5` 가 코드모드도 가드도 통과해 워커 SSOT 와
//    컴포넌트가 갈렸다(상세 첫 화면 온누리 뱃지). 실측 35건이 그 구멍에 있었다.
const PROPS = '(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)'

const LOCK_ROWS = new Set([...fs.readFileSync('CLAUDE.md', 'utf8').matchAll(/^\| `(src\/[^`]+?)`/gm)].map((m) => m[1]))
const MIRRORS = ['src/pages/vouchers/TopChromeReserve.tsx']
const files = execSync(
  "git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/*.tsx' 'src/components/**/*.tsx'",
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)
  .filter((f) => !/(admin|seller|agency|wholesale|supplier|marketing|debug|design-variants|Admin|Seller|Agency|Wholesale|Supplier)/.test(f))
  .filter((f) => LOCK_ROWS.has(f) || MIRRORS.includes(f))

const moves = new Map()
const bump = (k) => moves.set(k, (moves.get(k) || 0) + 1)
let changed = 0
for (const f of files) {
  const before = fs.readFileSync(f, 'utf8')
  let s = before
  s = s.replace(/text-\[([0-9.]+)px\]/g, (w, num) => {
    const n = parseFloat(num)
    if (n > 96) return w                      // 그래픽
    const to = n >= 26 ? nearest(n) : bodyPx(n)
    if (to === n) return w
    bump(`${n}px→${to}px`)
    return `text-[${to}px]`
  })
  s = s.replace(/(^|[\s"'`{:])((?:[a-z-]+:)*)text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl)\b/g, (w, pre, variants, step) => {
    bump(`text-${step}→${TW[step]}px`)
    return `${pre}${variants}text-[${TW[step]}px]`
  })
  s = s.replace(new RegExp(`(^|[\\s"'\`{:])((?:[a-z-]+:)*)(${PROPS})-(0\\.5|1\\.5|2\\.5|3\\.5)(?![\\w-])`, 'g'),
    (w, pre, variants, prop, half) => { bump(`${prop}-${half}→${prop}-${HALF[half]}`); return `${pre}${variants}${prop}-${HALF[half]}` })
  if (s !== before) { changed++; if (!DRY) fs.writeFileSync(f, s) }
}
console.log(`${DRY ? '[dry] ' : ''}잠금표 타입 스케일 이행 — ${changed}/${files.length}파일`)
for (const [k, v] of [...moves.entries()].sort()) console.log(`   ${k.padEnd(20)} × ${v}`)
