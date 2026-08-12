/**
 * 🎟️ 유어딜 **소비자 공구** 결제 결함 3건 회귀 가드 (2026-08-12)
 *
 * 세 결함은 전부 **조용했다** — 에러도 로그도 실패도 없이 잘못된 값이 저장되거나 검사가 헛돌았다.
 * 그래서 "고쳤다"를 사람 눈이 아니라 이 파일이 지킨다.
 *
 * ⚠️ **이 테스트가 못 막는 것**(과신 방지):
 *   - 실제 토스 승인/취소 응답 — 외부 PG 라 여기서는 mock 이다. **실결제 검증은 별도**(STAGING_CHECKLIST).
 *   - 웹훅이 실제로 이 주문을 찾아 상태를 바꾸는지 — 웹훅 실행은 Workers 런타임 밖에서 재현 못 한다.
 *     여기서는 **저장하는 값이 토스 orderId 와 같은가**까지만 고정한다(그게 연결의 전제였다).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  isSelfOwnedGroupBuy,
  resolveGbOrderNumber,
  guardAwaitingDeposit,
  issuedVoucherLabel,
} from '@/features/group-buy/api/gb-purchase-guards'

const cancelTossPayment = vi.fn()
const createDashboardNotification = vi.fn()
vi.mock('@/worker/utils/toss-gateway', () => ({ cancelTossPayment: (...a: unknown[]) => cancelTossPayment(...a) }))
vi.mock('@/features/notifications/api/dashboard-notifications.routes', () => ({
  createDashboardNotification: (...a: unknown[]) => createDashboardNotification(...a),
}))

// ── 최소 D1 스텁 ───────────────────────────────────────────────────────────────
interface Call { sql: string; binds: unknown[] }
function fakeDB(opts: { first?: unknown; throwOn?: RegExp } = {}) {
  const calls: Call[] = []
  const DB = {
    prepare(sql: string) {
      const rec: Call = { sql, binds: [] }
      const stmt = {
        bind(...binds: unknown[]) { rec.binds = binds; calls.push(rec); return stmt },
        async first() {
          if (opts.throwOn?.test(sql)) throw new Error('db down')
          return opts.first ?? null
        },
        async run() {
          if (opts.throwOn?.test(sql)) throw new Error('db down')
          return { meta: { changes: 1 } }
        },
      }
      return stmt
    },
  }
  return { DB: DB as never, calls }
}

const src = (p: string) => readFileSync(p, 'utf8')
/** 주석을 지우고 본다 — 설명 주석에 남은 문자열이 초록/빨강을 만들어 낸 사고가 이 레포에 있었다. */
const code = (p: string) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

const ROUTES = 'src/features/group-buy/api/group-buy.routes.ts'
const SELLER = 'src/features/group-buy/api/group-buy-seller.routes.ts'

beforeEach(() => { cancelTossPayment.mockReset(); createDashboardNotification.mockReset() })

// ──────────────────────────────────────────────────────────────────────────────
describe('① 주문번호 = 토스 orderId (웹훅 연결)', () => {
  it('토스가 되돌려준 orderId 를 그대로 쓴다', () => {
    expect(resolveGbOrderNumber('GB-42-1754900000000', 'GB-42-1754000000000', '42')).toBe('GB-42-1754900000000')
  })

  it('토스 값이 없으면 요청 orderId 로 폴백한다', () => {
    expect(resolveGbOrderNumber(undefined, 'GB-42-1754000000000', '42')).toBe('GB-42-1754000000000')
  })

  it('토스 규격(영숫자/-/_ 6~64자) 밖이면 새로 만든다 — 잘못된 값을 저장하지 않는다', () => {
    for (const bad of ['', 'GB', 'GB 42', 'GB-42-<script>', 'x'.repeat(65)]) {
      expect(resolveGbOrderNumber(bad, bad, '42')).toMatch(/^GB-42-\d+$/)
    }
  })

  it('userId 의 비영숫자는 제거된다(폴백 경로)', () => {
    expect(resolveGbOrderNumber('', '', 'user:9/9')).toMatch(/^GB-user99-\d+$/)
  })

  it('배선: /confirm-toss 가 자체 주문번호를 만들지 않는다', () => {
    const c = code(ROUTES)
    // 🔴 이 문자열이 되살아나면 웹훅이 다시 주문을 못 찾는다(값이 갈린다).
    expect(c).not.toMatch(/orderNumber\s*=\s*`GB-\$\{userId\}-\$\{Date\.now\(\)\}`/)
    expect(c).toMatch(/const\s+orderNumber\s*=\s*resolveGbOrderNumber\(\s*tossResult\.data\?\.orderId/)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('② 자기 참여 판정 — sellers.linked_user_id', () => {
  it('연결된 유저면 true', async () => {
    const { DB } = fakeDB({ first: { hit: 1 } })
    await expect(isSelfOwnedGroupBuy(DB, 7, '1234')).resolves.toBe(true)
  })

  it('연결이 없으면 false — 무고한 구매자를 막지 않는다', async () => {
    const { DB } = fakeDB({ first: null })
    await expect(isSelfOwnedGroupBuy(DB, 7, '7')).resolves.toBe(false)
  })

  it('sellers.linked_user_id 로 조회한다(users.id 직접 비교 아님)', async () => {
    const { DB, calls } = fakeDB({ first: null })
    await isSelfOwnedGroupBuy(DB, 7, '1234')
    expect(calls).toHaveLength(1)
    expect(calls[0].sql).toMatch(/linked_user_id/)
    expect(calls[0].binds).toEqual([7, '1234', '1234'])
  })

  it('셀러 없는 상품/빈 유저는 조회조차 하지 않는다', async () => {
    const { DB, calls } = fakeDB({ first: { hit: 1 } })
    await expect(isSelfOwnedGroupBuy(DB, null, '1234')).resolves.toBe(false)
    await expect(isSelfOwnedGroupBuy(DB, 0, '1234')).resolves.toBe(false)
    await expect(isSelfOwnedGroupBuy(DB, 7, '')).resolves.toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('조회 실패는 fail-open — DB 순단이 구매 전체를 막으면 안 된다', async () => {
    const { DB } = fakeDB({ throwOn: /sellers/ })
    await expect(isSelfOwnedGroupBuy(DB, 7, '1234')).resolves.toBe(false)
  })

  it('배선: 라우트에 sellers.id ↔ users.id 직접 비교가 남아 있지 않다', () => {
    const c = code(ROUTES)
    expect(c).not.toMatch(/Number\(product\.seller_id\)\s*===\s*Number\(userId\)/)
    expect((c.match(/isSelfOwnedGroupBuy\(/g) ?? []).length).toBeGreaterThanOrEqual(2) // 딜·카드 두 경로
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('③ 가상계좌 — 입금 전 발급 금지', () => {
  const ctx = { paymentKey: 'pk_1', orderNumber: 'GB-42-1', userId: '42', productId: 9, sellerId: 3, amount: 12000 }

  it('카드 결제(DONE)는 무접촉 — null 반환, DB 조차 안 본다', async () => {
    const { DB, calls } = fakeDB()
    await expect(guardAwaitingDeposit({ DB }, { status: 'DONE' }, ctx)).resolves.toBeNull()
    await expect(guardAwaitingDeposit({ DB }, undefined, ctx)).resolves.toBeNull()
    expect(calls).toHaveLength(0)
    expect(cancelTossPayment).not.toHaveBeenCalled()
  })

  it('WAITING_FOR_DEPOSIT 이면 막고, 흔적 주문을 남기고, 결제를 취소한다', async () => {
    const { DB, calls } = fakeDB()
    cancelTossPayment.mockResolvedValue({ ok: true })
    const r = await guardAwaitingDeposit({ DB }, { status: 'WAITING_FOR_DEPOSIT' }, ctx)
    expect(r?.code).toBe('VIRTUAL_ACCOUNT_UNSUPPORTED')
    const insert = calls.find((x) => /INSERT/i.test(x.sql))
    expect(insert?.sql).toMatch(/AWAITING_PAYMENT/)
    expect(insert?.binds).toContain('GB-42-1')
    expect(cancelTossPayment).toHaveBeenCalledTimes(1)
    // 취소가 성공했으면 사람을 부르지 않는다(계좌가 죽었으므로 조치할 것이 없다).
    expect(createDashboardNotification).not.toHaveBeenCalled()
  })

  it('취소 실패면 어드민을 부르고 "입금하지 마세요"를 안내한다', async () => {
    const { DB } = fakeDB()
    cancelTossPayment.mockRejectedValue(new Error('toss down'))
    const r = await guardAwaitingDeposit({ DB }, { status: 'WAITING_FOR_DEPOSIT' }, ctx)
    expect(r?.code).toBe('VIRTUAL_ACCOUNT_UNSUPPORTED')
    expect(r?.error).toMatch(/입금하지/)
    expect(createDashboardNotification).toHaveBeenCalledTimes(1)
  })

  it('배선: 가드가 confirmTossPayment 직후 · 교환권 발급보다 앞에 있다', () => {
    // ⚠️ 파일 전체에서 찾으면 **딜 `/join` 의 발급문**(앞쪽)에 걸려 늘 초록이 된다 — 핸들러로 잘라서 본다.
    const whole = code(ROUTES)
    const start = whole.indexOf("groupBuyRoutes.post('/confirm-toss'")
    expect(start).toBeGreaterThan(0)
    const c = whole.slice(start)
    const guard = c.indexOf('guardAwaitingDeposit(')
    const voucherInsert = c.indexOf('INSERT INTO vouchers')
    const idempotent = c.indexOf('SELECT id, order_number FROM orders WHERE payment_key')
    expect(guard).toBeGreaterThan(0)
    expect(voucherInsert).toBeGreaterThan(0)
    expect(voucherInsert).toBeGreaterThan(guard)
    // 멱등 조회보다도 앞 — 뒤에 두면 가상계좌 주문이 `success: true, qty: 0` 으로 응답된다.
    expect(idempotent).toBeGreaterThan(guard)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('④ 발급 알림 문구 — 교환권 ≠ 이용권', () => {
  it('카드로 산 매장 이용권은 "교환권"이라 부르지 않는다', () => {
    expect(issuedVoucherLabel({ deal_only: 0, category: 'meal_voucher' })).toBe('식사 이용권')
    expect(issuedVoucherLabel({ deal_only: null, category: 'stay_voucher' })).toBe('숙소 이용권')
    expect(issuedVoucherLabel({ category: 'beauty_voucher' })).not.toContain('교환권')
  })

  it('deal_only=1(기프티콘·KT)만 교환권이다', () => {
    expect(issuedVoucherLabel({ deal_only: 1, category: 'etc_voucher' })).toBe('교환권')
  })

  it('카테고리를 모르면 우산말 "이용권" — 없는 정보를 지어내지 않는다', () => {
    expect(issuedVoucherLabel({})).toBe('이용권')
    expect(issuedVoucherLabel(null)).toBe('이용권')
  })

  it('배선: 알림 문구가 "교환권" 하드코드로 되돌아가지 않았다', () => {
    const c = code(ROUTES)
    expect(c).not.toMatch(/'🎟️ 교환권이 발급됐어요'/)
    expect(c).toMatch(/issuedVoucherLabel\(product\)/)
    // 라벨이 상품을 실제로 보려면 deal_only 가 SELECT 돼 있어야 한다(안 뽑으면 늘 undefined → 늘 '이용권').
    expect(c).toMatch(/referral_disabled,\s*deal_only\s+FROM products/)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('⑤ 셀러 환불 범위 = 판매 범위', () => {
  it('환불 조회가 식사 카테고리로 좁혀져 있지 않다', () => {
    const c = code(SELLER)
    expect(c).not.toMatch(/category\s*=\s*'meal_voucher'/)
    expect(c).toMatch(/voucherCategoriesSqlClause\(\)/)
    expect(c).toMatch(/deal_only/)
  })

  it('SSOT 카테고리 목록이 4종 + 레거시 3종을 모두 포함한다', async () => {
    const { voucherCategoriesSqlClause } = await import('@/shared/constants/voucher-categories')
    const vc = voucherCategoriesSqlClause()
    for (const cat of ['meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher']) {
      expect(vc.values).toContain(cat)
    }
    expect(vc.placeholders.split(',')).toHaveLength(vc.values.length)
  })
})
