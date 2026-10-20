/**
 * 🎫 카드 표면 정렬 — 다크에서 카드가 페이지에 묻히지 않는다 (2026-09-15 대표 승인 "1번 진행")
 *
 * ## 무엇을 고쳤나
 * 코레일톡 체계의 표면은 둘뿐이다: **페이지** `--bg`(#F8F7FC/#11141C) · **카드** `--surface`(#FFFFFF/#1D1F29).
 * 그런데 **카드 모양인데 다크 배경만 페이지색**인 자리가 141곳 있었다.
 *
 * 🔴 다크에서 그 카드들은 **경계가 사라진다**. 다크는 `--lift: none`(그림자 0)이고 규칙 ①이 카드
 * 테두리를 0으로 두므로, 배경이 페이지와 같으면 남는 단서가 없다. 실측 28곳이 테두리·그림자 둘 다 없었다
 * (주문 상세 모달 · 교환권 바텀시트 · 상권 쿠폰 시트 …).
 *
 * ## 왜 이런 게 생겼나 — 취향이 아니라 **라이트가 구분을 못 해서**다
 * 라이트에서 페이지(#F8F7FC)와 카드(#FFFFFF)가 거의 같은 흰색이라, 작성자는 라이트만 보고는
 * "이게 페이지냐 카드냐"를 물을 이유가 없었다. 그 판단이 **다크 값을 고를 때 처음 강제**되고,
 * 그때마다 손으로 골랐다. 367곳 중 **173곳이 페이지색을 골랐다.**
 *
 * ## 이 시험이 **못** 막는 것
 *   ① 그 자리가 정말 카드인지(`rounded-` 로 근사한다) — 눈으로 봐야 한다.
 *   ② **오버레이**(`bg-white/90` 류)는 대상이 아니다 — 토큰이 다르고 짝도 `/90` 이어야 한다.
 *   ③ 대시보드는 화이트 고정이라 `dark:` 가 애초에 죽은 코드다(범위 밖).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SKIP_DIR = /(^|\/)(admin|seller|agency|wholesale|supplier|marketing)([-/]|$)/i
const SKIP_FILE = /(Admin|Agency|Wholesale|Supplier|Marketing|Distributor)/
/** 잠금표(Toss V2) — 이 정리의 이득이 hex 몇 줄이고 잃을 수 있는 것이 결제다. */
const LOCKED = new Set([
  'src/pages/TossWidgetPayPage.tsx',
  'src/pages/PaymentSuccessPage.tsx',
  'src/components/payments/TossPaymentWidget.tsx',
])

function consumerTsx(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!SKIP_DIR.test(p)) consumerTsx(p, out); continue }
    if (!e.name.endsWith('.tsx') || SKIP_DIR.test(p) || SKIP_FILE.test(e.name) || /\/tests?\//.test(p)) continue
    if (LOCKED.has(p.replace(/\\/g, '/'))) continue
    out.push(p)
  }
  return out
}

const FILES = ['src/pages', 'src/components', 'src/features', 'src/shared'].flatMap((d) => consumerTsx(d))
const CLASS_VALUE = /className=(?:\{)?["'`]([^"'`]*)["'`]/g

/** 카드 모양인데 다크 배경이 페이지색인 자리. */
function pageColoredCards() {
  const bad: string[] = []
  for (const f of FILES) {
    const src = readFileSync(f, 'utf-8')
    for (const m of src.matchAll(CLASS_VALUE)) {
      const cn = m[1]
      if (!cn.includes('dark:bg-[#11141C]')) continue
      if (!/\bbg-white\b/.test(cn)) continue                        // 오버레이(bg-white/90) 제외
      if (/bg-white\/\d|dark:bg-\[#11141C\]\/\d/.test(cn)) continue
      if (!/rounded-(?!full\b)/.test(cn)) continue                  // 알약·아바타는 카드가 아니다
      bad.push(`${f}:${src.slice(0, m.index).split('\n').length}  ${cn.slice(0, 80)}`)
    }
  }
  return bad
}

describe('카드는 카드 표면을 쓴다', () => {
  it('검사가 성립하는지 — 소비자 tsx 를 실제로 모았는가', () => {
    // 🛡️ 0건은 통과가 아니다. 경로가 낡아 조용히 비는 것을 차단한다.
    expect(FILES.length, '소비자 tsx 를 하나도 못 찾았다 — 경로가 낡았다').toBeGreaterThan(300)
    expect(FILES.some((f) => f.includes('DistrictCouponPage'))).toBe(true)
  })

  it('카드 모양에 페이지색 다크 배경을 쓰지 않는다', () => {
    const bad = pageColoredCards()
    expect(bad, [
      '다크는 `--lift: none` 이고 체계 규칙 ①이 카드 테두리를 0으로 둔다.',
      '그래서 배경이 페이지색(#11141C)이면 **카드의 경계가 통째로 사라진다**.',
      '카드면 `bg-surface`(#FFFFFF / #1D1F29)를 쓸 것 — 라이트는 한 픽셀도 안 바뀐다.',
      ...bad,
    ].join('\n')).toEqual([])
  })

  it('실제로 카드 표면을 쓰고 있다 — 전환이 일어났는지', () => {
    const users = FILES.filter((f) => /\bbg-surface\b/.test(readFileSync(f, 'utf-8')))
    expect(users.length, 'bg-surface 를 쓰는 소비자 파일이 없다 — 전환이 통째로 되돌아갔다').toBeGreaterThan(60)
  })
})
