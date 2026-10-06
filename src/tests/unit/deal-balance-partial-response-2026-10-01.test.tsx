/**
 * 🛡️ **응답 필드 하나가 비어도 정산 화면이 죽지 않는다** (2026-10-01)
 *
 * ## 무엇이 문제였나 (실측)
 *
 * 마이 시트 철거 결재의 측정을 하다가 `/seller/settlements` 만 ErrorBoundary 로 떨어지는 것을 발견했다.
 * 프로덕션 빌드는 `drop_console: true` 라 원인이 안 보였다 — 콘솔을 살린 빌드로 다시 재니:
 *
 * ```
 * TypeError: Cannot read properties of undefined (reading 'toLocaleString')
 *   at SellerSettlementsPage…
 * ```
 *
 * `DealBalanceCard` 가 `balance.total.toLocaleString()` 처럼 **응답 필드에 직접** 호출하고 있었다.
 * `if (!balance) return null` 가드는 `null` 만 막는다 — **빈 객체·배열·필드 누락은 통과**하고,
 * 그러면 카드 하나가 아니라 **정산 화면 전체**가 날아간다(ErrorBoundary 는 트리를 통째로 바꾼다).
 *
 * CLAUDE.md 가 이 패턴을 이미 금지하고 있다 — *"`value.toLocaleString()` 직접 호출 금지,
 * `formatNumber`/`formatWon`/`safeNum` 사용"*. 그 룰은 2026-05-17 ₩NaN 사고에서 나왔다.
 *
 * ## ⚠️ 정직하게 — 이게 라이브에서 터지는 것을 본 적은 없다
 *
 * 재현은 **하네스**에서 했고, 거기선 스텁이 `{ data: [] }` 를 줘서 `balance` 가 배열이 된다.
 * 라이브 `/api/seller/deal-balance` 는 제대로 된 객체를 준다. 그러니 *"정산 화면이 지금 깨져 있다"*
 * 는 주장은 하지 않는다. 고친 것은 **깨지기 쉬움**이다: 응답이 한 번 어긋나면 화면 전체를 잃는다.
 *
 * ## 이 시험이 못 보는 것
 *   · 실제 라이브 응답 모양 · 다른 화면의 같은 패턴(`VoucherRedeemModal` 등은 손대지 않았다)
 *   · 숫자가 **맞는지** — 여기서 보는 것은 "안 죽는가"와 "0 으로 보이는가"뿐이다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from '../helpers/source-text'

/**
 * 🩸 첫 판의 render 시험 둘이 **헛돌았다**: `vi.doMock` 을 호출 뒤에 썼는데 모듈은 이미 import 된
 *   뒤라 안 먹었고, `api.get` 이 영원히 pending 이라 `balance` 가 `null` → `return null` →
 *   **아무것도 안 그린 채 통과**했다. 결함을 되살려도 초록이었다(되돌려-검증이 잡았다).
 *   ⇒ `vi.hoisted` 로 **응답을 바꿔 끼울 수 있는 자리**를 만들고 실제로 그린다.
 */
const H = vi.hoisted(() => ({ balance: null as unknown, tax: null as unknown }))
vi.mock('@/lib/api', () => ({
  default: {
    get: (url: string) => Promise.resolve({
      data: { success: true, data: String(url).includes('deal-balance') ? H.balance : H.tax },
    }),
    post: () => new Promise(() => {}),
  },
}))
vi.mock('@/hooks/useToast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/components/ui/confirm-dialog', () => ({ confirmDialog: vi.fn() }))
vi.mock('./VoucherRedeemModal', () => ({ default: () => null }))
vi.mock('@/pages/seller-settlements/VoucherRedeemModal', () => ({ default: () => null }))

import DealBalanceCard from '@/pages/seller-settlements/DealBalanceCard'

const SRC = stripComments(readFileSync(join(process.cwd(), 'src/pages/seller-settlements/DealBalanceCard.tsx'), 'utf8'))

beforeEach(() => {
  // 토큰이 없으면 effect 가 바로 return 한다 — 그러면 또 "아무것도 안 그린 채 통과" 다.
  localStorage.setItem('seller_token', 'test')
  H.balance = null
  H.tax = null
})

/** 응답을 심고 **실제로 그려질 때까지 기다린다**. */
async function renderWith(balance: unknown, tax: unknown = null) {
  H.balance = balance
  H.tax = tax
  const r = render(<DealBalanceCard />)
  // 상태가 들어와 카드가 그려지는 시점까지(= 사고가 나는 바로 그 렌더) 기다린다.
  await waitFor(() => expect(r.container.textContent).toContain('딜 잔액'))
  return r
}

describe('① 깨진 응답에도 화면이 살아 있다 (실제로 그려서 판정)', () => {
  it('필드가 통째로 빠진 객체 — 던지지 않고 0 으로 보인다', async () => {
    const r = await renderWith({})
    expect(r.container.textContent).toContain('딜 잔액')
    expect(r.container.textContent).not.toContain('NaN')
  })

  it('하네스가 실제로 만든 모양(배열)에서도 안 죽는다', async () => {
    // `{ success: true, data: [] }` → balance 가 **배열**이다(truthy 라 null 가드를 통과한다).
    const r = await renderWith([])
    expect(r.container.textContent).toContain('딜 잔액')
    expect(r.container.textContent).not.toContain('NaN')
  })

  it('한쪽 필드만 있어도 뺄셈이 NaN 이 되지 않는다', async () => {
    const r = await renderWith({ total: 5000 })   // withdrawable 누락
    expect(r.container.textContent).not.toContain('NaN')
  })
})

describe('② 포매팅은 SSOT 를 쓴다 (CLAUDE.md 숫자 룰)', () => {
  it('응답 필드에 raw .toLocaleString() 을 직접 부르지 않는다', () => {
    // 🔑 이 한 줄이 사고의 모양 그 자체다 — `balance.X.toLocaleString()` / `tax.X.toLocaleString()`.
    expect(SRC, '응답 필드에 직접 부르면 필드 하나가 비는 순간 화면 전체가 죽는다')
      .not.toMatch(/\b(balance|tax)\.[A-Za-z_]+\.toLocaleString\(/)
  })

  it('formatNumber 를 쓴다', () => {
    expect(SRC).toContain("from '@/utils/format'")
    expect((SRC.match(/formatNumber\(/g) || []).length).toBeGreaterThanOrEqual(6)
  })

  it('산술 결과도 NaN 이 되지 않는다 (CLAUDE.md "산술 후 포매팅")', () => {
    // `(balance.total - balance.withdrawable)` 는 한쪽만 비어도 NaN 이 된다 → 화면에 "NaN".
    expect(SRC).not.toMatch(/\(balance\.total - balance\.withdrawable\)\.toLocaleString/)
    expect(SRC).toContain('safeMinus')
  })

  it('빈 입력이 ₩NaN 으로 새지 않는다', () => {
    // 2026-05-17 사고와 같은 클래스: `Number('')` → NaN → "₩NaN".
    expect(SRC).not.toMatch(/Number\(withdrawAmount\)\.toLocaleString/)
  })
})

describe('🧪 이 시험이 헛돌지 않는가', () => {
  it('검사 대상 파일을 실제로 읽었다', () => {
    expect(SRC.length).toBeGreaterThan(2000)
    expect(SRC).toContain('DealBalanceCard')
  })
})
