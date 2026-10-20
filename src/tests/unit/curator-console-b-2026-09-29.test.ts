/**
 * 🎫 2026-09-29 (대표 확정 **B안 — 통장형**) 소개 콘솔 재설계.
 *
 * ## 무엇이었나
 * 대표: *"소개 콘솔도 페이지 너무 별로다"* → 앞선 판(PR #1575)은 **규칙 위반**(이모지 12 · 카드 테두리 ·
 * 강조색 3색)만 걷어내고 구조는 그대로 뒀다 → *"근데 마음에 들진 않아"*. 무엇이 걸리는지 물었더니
 * **셋 다** 골랐다: **섹션이 많다 · 차트가 밋밋하다 · 목록 문법이 안 맞는다.** 시안 둘 중 B안 확정.
 *
 * | | 전 | 후 |
 * |---|---|---|
 * | 판 | 8개 | **3개**(돈 · 성과 · 진입) |
 * | 돈 | 요약·출금·차트가 따로, 출금은 화면 중간 | `EarningsPanel` 한 판, 받을 돈이 첫 줄 |
 * | 성과 | 인기핀·영입매장·최근적립이 따로 | `PerformancePanel` 탭 셋 |
 * | 목록 | 마이의 `ListRow`(아이콘 원 + 화살표) | 콘솔 전용 **순위표** |
 *
 * ## 이 시험이 지키는 것
 *   ① **서버 무변경** — 새 엔드포인트를 부르지 않는다(대시보드·출금·영입매장 셋 그대로).
 *   ② **없는 숫자를 지어내지 않는다** — 상품 순위는 `recent_earnings`(LIMIT 30) 합산이고
 *      화면이 그 사실("최근 30건 기준")을 **말한다**. 서버엔 상품별 매출액이 없다.
 *   ③ 옛 판 여덟이 되살아나지 않는다(요약카드·출금카드·인기핀·최근적립·일별차트 함수 0).
 *   ④ 마이의 목록 문법(`list-grammar`)을 **쓰지 않는다** — 대표가 고른 항목이다.
 *   ⑤ 그라디언트 0(옛 출금 카드는 `bg-gradient-to-br from-gray-800`) · 이모지 0 · 카드 테두리 0.
 *   ⑥ **막대가 30칸**이다(빈 날 0으로 채움) — 이게 "차트가 밋밋하다"의 진짜 원인이었다.
 *   ⑦ 추이 비율은 **앞 절반이 0이면 만들지 않는다**(0 에서 늘어난 것은 ∞% 다).
 *   ⑧ 매장 줄에 `공구 대행 등록` 버튼이 없고, **줄 자체가** 그 동작이다(2026-09-29 대표 확정).
 *
 * ## ⚠️ 못 하는 것
 *   - **픽셀은 못 잰다.** jsdom 엔 레이아웃이 없다 — "한 화면에 들어오는가"는 브라우저가 판정한다.
 *   - 실제 서버 응답 모양(필드가 비는 경우)은 라이브에서만 드러난다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { fillDays, halfOverHalf } from '../../pages/curator-earnings/EarningsPanel'
import { byProduct } from '../../pages/curator-earnings/PerformancePanel'

const PAGE = 'src/pages/CuratorEarningsPage.tsx'
const EARN = 'src/pages/curator-earnings/EarningsPanel.tsx'
const PERF = 'src/pages/curator-earnings/PerformancePanel.tsx'

const read = (p: string) => stripComments(readFileSync(p, 'utf-8'))
const page = read(PAGE)
const earn = read(EARN)
const perf = read(PERF)
const all = page + earn + perf

describe('① 서버는 한 글자도 안 바꿨다', () => {
  it('측정이 비어 있지 않다', () => {
    expect(page.length).toBeGreaterThan(2000)
    expect(earn.length).toBeGreaterThan(1500)
    expect(perf.length).toBeGreaterThan(1500)
  })

  it('🔴 부르는 API 가 종전 셋뿐이다 (새 쿼리·새 필드 0)', () => {
    const calls = all.match(/curatorApi\.\w+/g) || []
    expect([...new Set(calls)].sort()).toEqual(
      ['curatorApi.acknowledgeUpgradeOffer', 'curatorApi.getIntroducedStores', 'curatorApi.getWithdrawalInfo'],
    )
    expect(all, '대시보드는 종전 경로 그대로').toContain("'/api/curator/me/dashboard'")
    // 시안의 "지난달 대비" 를 위해 새 엔드포인트를 만들지 않았다 — 30일치로 나눠서 말한다.
    expect(all, '전월 전용 호출 0').not.toMatch(/prev_month|last_month|month_compare/)
  })
})

describe('② 없는 숫자를 지어내지 않는다', () => {
  it('🔴 상품 순위의 근거를 화면이 말한다', () => {
    expect(perf, '최근 30건 기준이라고 적는다').toContain('최근 30건 기준')
  })

  it('🔴 상품별 매출액을 지어내지 않는다 — 서버엔 그 값이 없다', () => {
    // `top_pins` 는 click_count 만, `recent_earnings` 는 commission/order_amount 만 준다.
    expect(perf).not.toMatch(/total_sales_by_product|product_revenue/)
  })

  it('합산은 적립액 기준 · refunded 제외 · 최대 5개', () => {
    const rows = byProduct([
      { id: 1, product_id: 10, product_name: 'A', commission: 1000, order_amount: 0, created_at: '' },
      { id: 2, product_id: 10, product_name: 'A', commission: 500, order_amount: 0, created_at: '' },
      { id: 3, product_id: 20, product_name: 'B', commission: 3000, order_amount: 0, created_at: '' },
      { id: 4, product_id: 30, product_name: 'C', commission: 9999, order_amount: 0, created_at: '', status: 'refunded' },
    ])
    expect(rows.map((r) => [r.id, r.total, r.count])).toEqual([[20, 3000, 1], [10, 1500, 2]])
    const many = Array.from({ length: 9 }, (_, i) => ({ id: i, product_id: i, product_name: `P${i}`, commission: i, order_amount: 0, created_at: '' }))
    expect(byProduct(many)).toHaveLength(5)
  })
})

describe('③④⑤ 옛 판·옛 문법·팔레트 밖 값이 되살아나지 않는다', () => {
  it('🔴 옛 섹션 함수가 0개다', () => {
    for (const fn of ['function SummaryCards', 'function WithdrawalCard', 'function TopPinsSection', 'function RecentEarningsSection', 'function DailyChart', 'function IntroducedStoresSection']) {
      expect(all, `${fn} 이 되살아났다`).not.toContain(fn)
    }
  })

  it('🔴 마이의 목록 문법을 쓰지 않는다 (대표가 고른 항목)', () => {
    expect(all).not.toContain('list-grammar')
    for (const tag of ['<ListRow', '<ListPlate', '<GroupLabel>']) expect(all, tag).not.toContain(tag)
  })

  it('🔴 그라디언트 0 · 이모지 0 · 카드 테두리 0', () => {
    expect(all, '옛 출금 카드의 검정 그라디언트').not.toMatch(/bg-gradient-to-/)
    const emoji = all.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []
    expect(emoji, `남은 이모지: ${emoji.join(' ')}`).toHaveLength(0)
    const borders = all.match(/border border-(gray|line)[^"'`]*/g) || []
    expect(borders, `남은 테두리: ${borders.join(' | ')}`).toHaveLength(0)
  })

  it('티켓 은유 — 브랜드 면 위에 받을 돈, 그 아래 카드 면 (규칙 ④)', () => {
    expect(earn).toMatch(/bg-brand text-white/)
    expect(earn).toMatch(/bg-surface/)
  })
})

describe('⑥ 막대는 30칸 — 적립이 있는 날만 그리지 않는다', () => {
  it('🔴 빈 날을 0으로 채운다', () => {
    const slots = fillDays([{ date: new Date().toISOString().slice(0, 10), amount: 5000 }])
    expect(slots, '칸 수').toHaveLength(30)
    expect(slots[29].amount, '오늘 값이 들어간다').toBe(5000)
    expect(slots.filter((s) => s.amount === 0), '나머지는 0').toHaveLength(29)
  })

  it('🔴 화면이 실제로 fillDays 를 거친다 (순수함수만 재면 배선이 빠져도 초록이다)', () => {
    // 🩸 주입 러너가 잡았다: 첫 판은 `fillDays` 만 시험해서, 호출부를 raw map 으로 되돌려도 통과했다.
    expect(earn, 'fillDays 호출 형태').toMatch(/fillDays\(stats\.earnings_daily_30d/)
    expect(earn, '막대는 그 결과만 그린다').toMatch(/slots\.map\(/)
  })

  it('오래된 날 → 오늘 순서이고 날짜가 하루씩 이어진다', () => {
    const slots = fillDays([])
    const days = slots.map((s) => Date.parse(s.date))
    for (let i = 1; i < days.length; i++) expect(days[i] - days[i - 1]).toBe(86400000)
  })

  it('🔴 서버와 같은 UTC 날짜 키를 쓴다 (KST 로 만들면 하루 어긋난다)', () => {
    // 서버는 `date(created_at)` = UTC. 화면이 KST 로 키를 만들면 오늘 적립이 내일 칸에 꽂힌다.
    expect(earn).toContain("toISOString().slice(0, 10)")
    expect(earn, 'KST 로 키를 만들지 않는다').not.toMatch(/Asia\/Seoul[\s\S]{0,120}utcDay/)
  })
})

describe('⑦ 추이 비율은 정직하게', () => {
  it('🔴 앞 절반이 0이면 비율을 만들지 않는다', () => {
    const slots = [...Array(15).fill({ amount: 0 }), ...Array(15).fill({ amount: 100 })]
    expect(halfOverHalf(slots)).toBeNull()
  })

  it('늘면 +, 줄면 −', () => {
    expect(halfOverHalf([...Array(2).fill({ amount: 100 }), ...Array(2).fill({ amount: 150 })])?.pct).toBe(50)
    expect(halfOverHalf([...Array(2).fill({ amount: 100 }), ...Array(2).fill({ amount: 50 })])?.pct).toBe(-50)
  })

  it('라벨이 무엇을 비교했는지 그대로 적는다', () => {
    expect(earn, '"지난달" 이라고 쓰지 않는다').not.toContain('지난달')
    expect(earn).toContain('최근 2주')
  })
})

describe('⑧ 매장 줄이 곧 그 동작이다', () => {
  it('🔴 목록에 공구 대행 버튼이 없다 (대표 확정 — 물었더니 "아니")', () => {
    expect(perf).not.toMatch(/>\s*공구 대행 등록\s*</)
  })

  it('🔴 그런데 동작은 살아 있다 — 줄을 누르면 대행 모달이 열린다', () => {
    expect(perf, '매장 줄이 onProxy 를 부른다').toMatch(/onClick=\{\(\) => onProxy\(\{ id: s\.id/)
    expect(page, '페이지가 모달을 그린다').toContain('<ProxyProductModal')
  })
})
