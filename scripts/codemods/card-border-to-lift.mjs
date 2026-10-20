#!/usr/bin/env node
/**
 * 🎫 카드 테두리 → 들림 (2026-09-29, 대표 UI 네 트랙 중 ④)
 *
 * 확정 디자인 시스템 규칙 ① — *"표면 두 톤 · **카드 테두리 0**(화이트에서 카드는 `shadow-lift` 한 값)"*.
 *
 * ⚠️ **전수 변환을 일부러 안 한다.** 실측 304건 중 테두리가 *일하고 있는* 자리가 섞여 있다:
 *   - 떠 있는 면(드롭다운·토스트·모달) — 그림자로만은 페이지와 안 갈린다
 *   - 선택 신호(`border-brand`·`ring-`·굵은 선) — UI① 이 방금 세운 언어다. 지우면 눌러도 표시가 없다
 *   - 틴트 상자(`bg-amber-50` 류) — `shadow-lift`(잉크 6%)가 그 면 위에서 거의 안 보인다
 *   - 잠금표 파일 — 색 하나도 대표 승인이 필요하다
 * 그래서 **흐름 속 평범한 흰 카드**만 바꾸고 나머지는 래칫으로 얼린다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const LOCK = new Set([...readFileSync('CLAUDE.md', 'utf8').matchAll(/^\| `(src\/[^`]+?)`/gm)].map((m) => m[1]))
const MIRRORS = new Set(['src/pages/vouchers/TopChromeReserve.tsx'])

const CARDISH = /\bborder\b(?!-(?:b|t|l|r|x|y|0|transparent|rule|none|collapse|separate|spacing|dashed|dotted))/
const ROUND = /\brounded-(lg|xl|2xl|3xl)\b/
const SIGNAL = /\bborder-brand|\bring-|\bborder-(2|4|8)\b|border-\[/
const FLOAT = /\b(absolute|fixed|sticky)\b|\bz-\[|\bshadow-(xl|2xl)\b/
const TINT = /\bbg-(amber|red|rose|blue|green|emerald|yellow|orange|purple|indigo|brand|gray|slate|zinc|neutral)/

const files = execSync(
  "git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/*.tsx' 'src/components/**/*.tsx'",
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)
  .filter((f) => !/(admin|seller|agency|wholesale|supplier|marketing|debug|design-variants|Admin|Seller|Agency|Wholesale|Supplier)/.test(f))
  .filter((f) => !LOCK.has(f) && !MIRRORS.has(f))
  // 떠 있는 면은 파일 이름으로도 한 번 더 거른다(모달·시트·피커·오버레이)
  .filter((f) => !/(Modal|Sheet|Picker|Popover|Dropdown|Toast|Overlay|Tooltip)/.test(f))

const write = !process.argv.includes('--dry')
let n = 0, touched = 0
for (const f of files) {
  const orig = readFileSync(f, 'utf8')
  let out = ''
  let last = 0
  for (const m of orig.matchAll(/className="([^"]*)"/g)) {
    const cls = m[1]
    if (!CARDISH.test(cls) || !ROUND.test(cls) || SIGNAL.test(cls) || FLOAT.test(cls)) continue
    const tag = ([...orig.slice(0, m.index).matchAll(/<([A-Za-z][\w.]*)/g)].pop() || [])[1] || '?'
    if (!/^(div|section|article|li)$/.test(tag)) continue
    // 변형 접두사(dark: 등)를 뗀 **기본 토큰**으로만 면을 판정한다
    //   (`dark:bg-white/[0.04]` 가 "흰 카드" 로 잡히던 첫 판 오류)
    const base = cls.split(/\s+/).filter((t) => !t.includes(':')).join(' ')
    if (!/\bbg-(white|surface)\b/.test(base) || TINT.test(base)) continue

    const kept = cls.split(/\s+/).filter((t) => !/^(dark:)?border(-(?!rule)[a-z0-9[\]#/.-]+)?$/.test(t))
    if (!kept.some((t) => /^shadow-/.test(t))) kept.push('shadow-lift')
    else for (let i = 0; i < kept.length; i++) if (/^shadow-(sm|md|lg)?$/.test(kept[i])) kept[i] = 'shadow-lift'
    out += orig.slice(last, m.index) + `className="${kept.join(' ')}"`
    last = m.index + m[0].length
    n++
  }
  if (last) { out += orig.slice(last); touched++; if (write) writeFileSync(f, out) }
}
console.log(`${write ? '✍️' : '👀'} 파일 ${touched} · 테두리 → 들림 ${n}건`)
