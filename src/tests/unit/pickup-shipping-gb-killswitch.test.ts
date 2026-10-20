/**
 * 📦🔌 픽업 비배송 + 공구가 킬스위치 불변식 (2026-08-11) 〔대표 "모두 진행"〕
 *
 * ## 왜 (실측 2건)
 * ① **픽업 상품에 배송비 3,000원**이 붙었다. 비배송 판정이 `deal_only=1 || isVoucherCategory` 뿐이라
 *    운영자 몰의 픽업 공구(물리 재화·비이용권)가 **둘 다 아니어서** 배송으로 분류됐다.
 *    손님은 가지러 가는데 배송비를 낸다.
 * ② **체크아웃이 상시가**를 보여줬다. 견적(`/quote`)이 `Number(p.price)` 였고 주문 생성만
 *    공구가라 **청구는 맞고 화면은 틀렸다.**
 *
 * ## 이 파일이 못 막는 것
 * 실제 배송비 숫자(`calculateShippingFeeV2` 결과)와 Toss 청구액은 검증하지 않는다.
 * 그 축은 **staging 실결제**가 담당한다 — 통과 전에는 파일럿을 열지 않는다.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { itemHasNoShipping, allItemsNoShipping } from '@/shared/order-type'
import { pickupToMeta } from '@/shared/pickup'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

/**
 * 🔴 픽업 메타 조회를 가짜로 세워 **헬퍼의 동작 자체**를 본다.
 *
 * ⚠️ 왜 문자열 앵커로 안 되는가: 되돌려-검증에서 헬퍼의 `has_pickup: pick.has(...)` 를
 *   `false` 로 바꿔 봤더니 **초록이 그대로 떴다.** 배선 검사는 "호출이 있는지"만 보지
 *   "그 값이 실제로 쓰이는지"는 못 본다 — 이 레포가 반복해서 만난 *헛도는 가드* 클래스다.
 */
vi.mock('@/worker/utils/product-supply-meta', () => ({
  getSupplyMeta: vi.fn(async (_db: unknown, ids: number[]) => {
    const m = new Map<number, Record<string, string>>()
    // 상품 1 만 픽업(11월 3일 · 냉장). 나머지는 메타 없음 = 배송 상품.
    if (ids.includes(1)) m.set(1, pickupToMeta({ date: '2026-11-03', place: '가게 앞', storage: 'cold' }))
    return m
  }),
}))

describe('비배송 판정 — 픽업이 포함된다', () => {
  it('교환권·이용권은 기존대로 비배송', () => {
    expect(itemHasNoShipping({ deal_only: 1, category: 'etc' })).toBe(true)
    expect(itemHasNoShipping({ deal_only: 0, category: 'meal_voucher' })).toBe(true)
  })

  it('🔴 픽업 정보가 있으면 비배송 — 이 줄이 3,000원 오청구를 막는다', () => {
    // 운영자 몰의 픽업 공구: deal_only 도 아니고 이용권 카테고리도 아니다.
    expect(itemHasNoShipping({ deal_only: 0, category: 'food', has_pickup: true })).toBe(true)
  })

  it('일반 배송 상품은 그대로 배송비 대상', () => {
    expect(itemHasNoShipping({ deal_only: 0, category: 'food' })).toBe(false)
    expect(itemHasNoShipping({ deal_only: 0, category: 'food', has_pickup: false })).toBe(false)
    expect(itemHasNoShipping(null)).toBe(false)
  })

  it('하나라도 배송이면 그룹 전체는 배송이다', () => {
    expect(allItemsNoShipping([{ has_pickup: true }, { category: 'food' }])).toBe(false)
    expect(allItemsNoShipping([{ has_pickup: true }, { deal_only: 1 }])).toBe(true)
  })

  it('⚠️ 빈 목록은 비배송이 아니다 — `every` 가 빈 배열에 true 를 주는 함정', () => {
    // 이 레포에서 실제로 난 클래스다(픽스처에 항목이 없어 가드가 늘 통과).
    expect(allItemsNoShipping([])).toBe(false)
    expect(allItemsNoShipping(null)).toBe(false)
  })
})

describe('🔴 헬퍼 동작 — 픽업 조회 결과가 실제로 판정에 쓰인다', () => {
  const fakeDB = {} as never   // getSupplyMeta 가 모킹돼 DB 를 안 쓴다

  it('픽업 상품은 비배송으로 판정된다 (조회 → has_pickup 배선)', async () => {
    const { resolveNoShipping } = await import('@/worker/utils/pickup-flags')
    // 카테고리 'food' · deal_only 0 — **픽업 메타만이** 비배송의 근거다.
    expect(await resolveNoShipping(fakeDB, [{ id: 1, deal_only: 0, category: 'food' }])).toBe(true)
  })

  it('픽업이 아닌 상품은 배송비 대상 그대로', async () => {
    const { resolveNoShipping } = await import('@/worker/utils/pickup-flags')
    expect(await resolveNoShipping(fakeDB, [{ id: 2, deal_only: 0, category: 'food' }])).toBe(false)
  })

  it('한 건이라도 배송이면 주문 전체가 배송', async () => {
    const { resolveNoShipping } = await import('@/worker/utils/pickup-flags')
    expect(await resolveNoShipping(fakeDB, [{ id: 1, category: 'food' }, { id: 2, category: 'food' }])).toBe(false)
  })

  it('견적용 판정기도 같은 결과를 낸다 (두 경로가 갈리지 않는다)', async () => {
    const { loadNoShippingCheck } = await import('@/worker/utils/pickup-flags')
    const check = await loadNoShippingCheck(fakeDB, [1, 2])
    expect(check({ id: 1, deal_only: 0, category: 'food' })).toBe(true)
    expect(check({ id: 2, deal_only: 0, category: 'food' })).toBe(false)
  })

  it('id 가 문자열이어도 맞는다 — 캐스팅 누락이면 그 상품만 조용히 배송비가 붙는다', async () => {
    const { resolveNoShipping } = await import('@/worker/utils/pickup-flags')
    expect(await resolveNoShipping(fakeDB, [{ id: '1', deal_only: 0, category: 'food' }])).toBe(true)
  })
})

describe('배선 — 주문 생성과 견적이 같은 판정·같은 가격을 쓴다', () => {
  const routes = read('src/worker/routes/order.routes.ts')

  it('두 곳 모두 pickup-flags 헬퍼를 쓴다 — 인라인 규칙 복제 금지', () => {
    // ⚠️ 2026-08-11 — 처음엔 `allItemsNoShipping(` 호출 2회를 셌는데, 파일 크기 래칫 때문에
    //   판정을 `pickup-flags` 헬퍼로 옮기자 **동작이 같은데 빨강**이 됐다. 불변식은
    //   *"두 경로가 같은 판정을 쓴다 · 옛 인라인 규칙이 없다"* 이므로 그 둘로 고정한다.
    expect(routes).toContain('resolveNoShipping(c.env.DB')   // 주문 생성
    expect(routes).toContain('qNoShip(p)')                    // 견적
    const helper = read('src/worker/utils/pickup-flags.ts')
    expect((helper.match(/allItemsNoShipping\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
    // 🔴 옛 인라인 규칙이 되살아나면 즉시 빨강. 픽업이 빠진 그 규칙이 오청구의 원인이었다.
    expect(/deal_only\) === 1 \|\| isVoucherCategory\(/.test(routes)).toBe(false)
  })

  it('견적 단가가 공구가다 — 상시가(Number(p.price))로 되돌아가지 않는다', () => {
    expect(routes).toContain('quoteGb.basePrice(Number(p.id)')
    // 되돌리면 화면(상시가)과 청구(공구가)가 다시 갈린다.
    expect(/const unitPrice = Math\.max\(0, Number\(p\.price\) \|\| 0\);/.test(routes)).toBe(false)
  })
})

describe('🔌 공구가 킬스위치 — 기본 ON · fail-open', () => {
  const helper = read('src/worker/utils/gb-order-pricing.ts')

  it("정확히 'false' 일 때만 끈다 (미설정·오타는 켠 것)", () => {
    // 🔴 `!== 'true'` 로 뒤집으면 **미설정 = OFF** 가 되어 몰 화면은 공구가인데 청구는 상시가가 된다
    //   — 지금보다 나쁜 상태다. 그래서 방향을 값으로 고정한다.
    expect(/=== 'false'/.test(helper)).toBe(true)
    expect(/!== 'true'/.test(helper)).toBe(false)
  })

  it('조회 실패는 fail-open(켬) — DB 한 번 흔들려 전 주문이 상시가가 되면 안 된다', () => {
    expect(/catch \{ killed = false \}/.test(helper)).toBe(true)
  })

  it('🔴 gb_engine_enabled 를 이 자리에 쓰지 않는다 (그 키는 기본 false — 쓰면 몰이 깨진다)', () => {
    expect(helper).toContain("'gb_pricing_enabled'")
    // 주석에는 왜 안 쓰는지가 적혀 있으므로, **조회 쿼리**에 그 키가 들어갔는지만 본다.
    expect(/key = 'gb_engine_enabled'/.test(helper)).toBe(false)
  })
})

describe('문서 정정 — "적용은 게이트 뒤" 라는 거짓말이 되살아나지 않는다', () => {
  it('seller-gb · gb-cockpit 이 공구가를 gb_engine_enabled 뒤라고 주장하지 않는다', () => {
    for (const p of ['src/features/seller/api/seller-gb.routes.ts', 'src/features/group-buy/api/gb-cockpit.routes.ts']) {
      const s = read(p)
      // 두 파일 모두 정정 문구와 실제 스위치 이름을 갖고 있어야 한다.
      expect(s, p).toContain('gb_pricing_enabled')
      expect(s, p).toContain('2026-08-11 정정')
    }
  })
})
