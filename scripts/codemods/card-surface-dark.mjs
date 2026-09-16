#!/usr/bin/env node
/**
 * 🎫 카드 표면 정렬 — `bg-white dark:bg-[#11141C]` → `bg-surface` (2026-09-15 대표 승인 "1번 진행")
 *
 * ## 무엇이 문제였나 (실측)
 * 코레일톡 체계의 표면은 둘뿐이다: **페이지** `--bg`(#F8F7FC/#11141C) · **카드** `--surface`(#FFFFFF/#1D1F29).
 * 그런데 **카드 모양인데 다크 배경만 페이지색**인 자리가 141곳 있었다 — 라이트에서 카드와 페이지가
 * 둘 다 흰색이라 구분이 안 되니, 작성자가 다크 값을 매번 손으로 골랐고 절반쯤 페이지색을 골랐다.
 *
 * 🔴 **다크에서 그 카드들은 경계가 사라진다.** 다크는 `--lift: none`(그림자 0)이고 체계 규칙 ①이
 * 카드 테두리를 0으로 두므로, 배경색이 페이지와 같으면 남는 단서가 없다. 실측 28곳이 테두리·그림자
 * 둘 다 없었다(주문 상세 모달·교환권 바텀시트·쿠폰 시트 등).
 *
 * ## 무엇이 바뀌나
 * **라이트는 한 픽셀도 안 바뀐다** — `bg-white`(#FFFFFF) ↔ `bg-surface`(라이트 `--surface` = #FFFFFF).
 * **다크만** #11141C → #1D1F29 (카드가 페이지에서 한 톤 떠오른다).
 *
 * ## 안 건드리는 것
 *   - 투명도 변형(`bg-white/90` 류) — 오버레이라 토큰이 다르고 짝도 `/90` 이어야 한다
 *   - `rounded-full` 만 있는 것 — 알약·아바타이지 카드가 아니다
 *   - 대시보드(admin/seller/agency/wholesale/supplier/marketing) — 화이트 고정이라 `dark:` 가 죽은 코드
 *   - Toss 잠금 파일 — 잠금표의 명시 허가가 없다
 *
 * ## 이 코드모드가 **못** 하는 것
 * "그 자리가 정말 카드인가" 는 안 본다(`rounded-`로 근사한다). 카드 안의 **파 넣은 우물**이었다면
 * 부모와 같은 색이 되어 사라진다 — 실행 전 조상 검사에서 **0곳**이라 안전하다고 판단했다.
 * 조상이 카드색(`bg-surface`)인 자식은 하나도 없었다(부모들도 전부 같은 혼합 철자였다).
 */
import fs from 'node:fs'
import path from 'node:path'

const LOCKED = new Set([
  'src/pages/TossWidgetPayPage.tsx',
  'src/pages/PaymentSuccessPage.tsx',
  'src/components/payments/TossPaymentWidget.tsx',
])
const SKIP_DIR = /(^|\/)(admin|seller|agency|wholesale|supplier|marketing)([-/]|$)/i
const SKIP_FILE = /(Admin|Agency|Wholesale|Supplier|Marketing|Distributor)/
const DRY = process.argv.includes('--dry')

const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!SKIP_DIR.test(p)) walk(p); continue }
    if (!/\.tsx$/.test(e.name) || SKIP_DIR.test(p) || SKIP_FILE.test(e.name) || /\/tests?\//.test(p)) continue
    if (LOCKED.has(p.replace(/\\/g, '/'))) continue
    files.push(p)
  }
}
for (const r of ['src/pages', 'src/components', 'src/features', 'src/shared']) if (fs.existsSync(r)) walk(r)

/** className 값(따옴표 한 쌍) 안에서만 바꾼다 — 주석·문자열 본문은 건드리지 않는다. */
const CLASS_VALUE = /(className=(?:\{)?["'`])([^"'`]*)(["'`])/g

let changed = 0
const per = new Map()
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  let hits = 0
  const out = src.replace(CLASS_VALUE, (whole, open, cn, close) => {
    if (!cn.includes('dark:bg-[#11141C]')) return whole
    if (!/\bbg-white\b/.test(cn)) return whole              // 투명도 변형(bg-white/90) 제외
    if (/bg-white\/\d|dark:bg-\[#11141C\]\/\d/.test(cn)) return whole
    if (!/rounded-(?!full\b)/.test(cn)) return whole         // 카드 모양만
    const next = cn
      .replace(/(^|\s)dark:bg-\[#11141C\](?=\s|$)/g, '$1')
      .replace(/(^|\s)bg-white(?=\s|$)/g, '$1bg-surface')
      .replace(/\s{2,}/g, ' ')
      .trim()
    hits++
    return open + next + close
  })
  if (hits) { fs.existsSync(f) && !DRY && fs.writeFileSync(f, out); changed += hits; per.set(f, hits) }
}
console.log(`${DRY ? '[dry] ' : ''}카드 표면 정렬: ${changed}곳 / ${per.size}파일`)
for (const [f, n] of [...per].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`   ${String(n).padStart(3)}  ${f}`)
