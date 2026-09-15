#!/usr/bin/env node
/**
 * 🎨 표면 토큰 채택 — `bg-white dark:bg-[#1D1F29]` → `bg-surface` (2026-09-15 대표 "색 정리도 진행해줘")
 *
 * ## 무엇을 바꾸나
 * **값이 한 글자도 안 바뀌는 짝만** 접는다. 라이트 값과 다크 값이 토큰의 두 값과 **정확히** 같을 때만이다:
 *
 * | 접기 전 | 접은 뒤 | 근거 |
 * |---|---|---|
 * | `bg-white` + `dark:bg-[#1D1F29]` | `bg-surface` | `--surface` = #FFFFFF / #1D1F29 |
 * | `border-gray-200` + `dark:border-[#2C2F35]` | `border-line` | `--line` = #EAE4E0(=INK.200) / #2C2F35 |
 * | `divide-gray-200` + `dark:divide-[#2C2F35]` | `divide-line` | 〃 |
 * | `bg-gray-50` + `dark:bg-[#11141C]` | `bg-warm` | `--bg` = #F8F7FC(=INK.50) / #11141C |
 * | `bg-[#F8F7FC]` + `dark:bg-[#11141C]` | `bg-warm` | 〃 |
 *
 * ## 무엇을 **안** 바꾸나 (중요 — 이건 디자인 결정이지 기계 작업이 아니다)
 *   - `bg-white` + `dark:bg-[#11141C]` (321곳) — 라이트 흰색인데 다크에선 **페이지** 색이다.
 *     같은 `bg-white` 가 168곳에선 **카드**(#1D1F29)로 간다. 한 라이트 값에 다크 답이 둘이라
 *     기계가 고를 수 없다. 어느 쪽이 맞는지는 대표 판단.
 *   - `border-gray-100`(#F3EEEA) — `--line`(#EAE4E0)과 **다른 값**이다. 접으면 화면이 바뀐다.
 *   - `bg-gray-100`(#F3EEEA) — 체계의 두 톤(bg·surface) 밖의 **세 번째 톤**이다. 같은 이유로 보류.
 *
 * ## 쓰는 법
 *   node scripts/codemods/adopt-surface-tokens.mjs --dry    # 세기만
 *   node scripts/codemods/adopt-surface-tokens.mjs          # 적용
 *
 * ⚠️ 대시보드(admin/seller/agency/wholesale)는 **건드리지 않는다** — 자체 팔레트이고 라이트 고정이다.
 */
import fs from 'node:fs'
import path from 'node:path'

const SKIP_DIR = /(^|\/)(admin|seller|agency|wholesale|supplier|marketing)([-/]|$)/i
const SKIP_FILE = /(Admin|Seller|Agency|Wholesale|Supplier|Marketing|Distributor)/
/**
 * 🔒 Toss V2 감사 잠금 (CLAUDE.md "🚫 절대 룰") — 대표 명시 허가 없이 수정 금지.
 * "색 정리" 지시는 일반 지시이지 이 표의 허가가 아니다. 얻는 것이 hex 5줄이고
 * 잃을 수 있는 것이 결제라, 아예 건드리지 않는다.
 */
const LOCKED = new Set([
  'src/pages/TossWidgetPayPage.tsx',
  'src/pages/PaymentSuccessPage.tsx',
  'src/components/payments/TossPaymentWidget.tsx',
  'src/shared/types/index.ts',
])
const DRY = process.argv.includes('--dry')

/** [라이트 클래스, 다크 클래스, 합친 토큰 클래스] — 순서 무관하게 둘 다 있으면 접는다. */
const RULES = [
  ['bg-white', 'dark:bg-[#1D1F29]', 'bg-surface'],
  ['border-gray-200', 'dark:border-[#2C2F35]', 'border-line'],
  ['divide-gray-200', 'dark:divide-[#2C2F35]', 'divide-line'],
  ['bg-gray-50', 'dark:bg-[#11141C]', 'bg-warm'],
  ['bg-[#F8F7FC]', 'dark:bg-[#11141C]', 'bg-warm'],
]

const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!SKIP_DIR.test(p)) walk(p); continue }
    if (!/\.(tsx|ts)$/.test(e.name) || SKIP_DIR.test(p) || SKIP_FILE.test(e.name) || /\/tests?\//.test(p)) continue
    if (LOCKED.has(p.replace(/\\/g, '/'))) continue
    files.push(p)
  }
}
for (const r of ['src/pages', 'src/components', 'src/features', 'src/shared']) if (fs.existsSync(r)) walk(r)

/** className 값(따옴표 한 쌍) 안에서만 바꾼다 — 주석·문자열 본문은 건드리지 않는다. */
const CLASS_VALUE = /(className=(?:\{)?["'`])([^"'`]*)(["'`])/g

let changed = 0
const per = new Map()

/**
 * 한 className 값 안에서 짝을 접는다.
 * 🩸 **토큰화(split/join) 금지** — className 이 템플릿 리터럴이면 그 안에 `${...}` 표현식과
 *    줄바꿈이 들어 있다. 공백으로 쪼갰다가 다시 이으면 표현식의 공백까지 먹어 치운다
 *    (첫 판에서 `isWide ?'absolute...'` 로 망가뜨렸다). 그래서 **문자열 치환만** 한다.
 */
function collapse(val) {
  let out = val
  let n = 0
  for (const [light, dark, merged] of RULES) {
    const has = (t) => new RegExp(`(^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`).test(out)
    if (!has(light) || !has(dark)) continue
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // 다크 토큰을 앞 공백 하나와 함께 제거(줄바꿈·들여쓰기는 건드리지 않는다).
    out = out.replace(new RegExp(`[ \\t]${esc(dark)}(?=\\s|$)`), '')
             .replace(new RegExp(`(^|\\s)${esc(dark)}[ \\t]?`), '$1')
    // 라이트 토큰 → 합친 토큰 (첫 1회만)
    out = out.replace(new RegExp(`(^|\\s)${esc(light)}(?=\\s|$)`), `$1${merged}`)
    n++
    per.set(merged, (per.get(merged) || 0) + 1)
  }
  return { out, n }
}

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const out = src.replace(CLASS_VALUE, (whole, open, val, close) => {
    const r = collapse(val)
    return r.n ? open + r.out + close : whole
  })
  if (out !== src) {
    changed++
    if (!DRY) fs.writeFileSync(f, out)
  }
}
console.log(`${DRY ? '[dry] ' : ''}파일 ${changed}개 변경`)
for (const [k, v] of [...per.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}  ×${v}`)
