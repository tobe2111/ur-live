/**
 * 💸 **부분환불 금액 입구** 불변식 〔세션 ④-c · 머니 경로〕
 *
 * ## 🔴 무엇이 없었나
 * `returns.refund_amount` 는 **반품 신청 시점에 주문 총액으로 한 번 박히고**,
 * **그 값을 바꾸는 엔드포인트가 하나도 없었다.** 환불 실행기는 그 값을 충실히 쓰므로
 * **실질적으로 전액 환불만 가능**했다.
 *
 * 정작 실행기는 **이미 부분환불을 전제로** 쓰여 있었다 — 딜 복원이 `refunded / paidCash` 비례고
 * Toss 취소도 `amount` 를 넘긴다. 빠진 건 계산이 아니라 **값을 정할 입구** 하나였다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 운영자가 **틀린 금액**을 넣는 것(경계만 본다 — 얼마가 옳은지는 사람의 판단)
 *   - Toss 가 그 금액으로 실제 취소했는지(**실결제 검증** — `STAGING_CHECKLIST` P11)
 *   - 부분환불 후 셀러 정산 clawback 이 비례로 맞는지(기존 코드 경로, 이 PR 무접촉)
 */
import { describe, it, expect } from 'vitest'
import { resolveRefundAmount, canEditRefundAmount } from '../../shared/refund-amount'
import { readCode, readRaw, sliceFrom } from '../helpers/source-text'

describe('🔴 상한 — 결제액을 넘지 않는다', () => {
  it('결제액보다 큰 값은 결제액으로 잘린다', () => {
    const r = resolveRefundAmount({ requested: 999_999, orderPaidAmount: 12_000 })
    expect(r).toEqual({ ok: true, amount: 12_000, clamped: true })
  })

  it('🔴 잘렸으면 잘렸다고 알린다 — 말없이 깎으면 장부가 왜 안 맞는지 못 찾는다', () => {
    expect(resolveRefundAmount({ requested: 20_000, orderPaidAmount: 10_000 }))
      .toMatchObject({ clamped: true })
    expect(resolveRefundAmount({ requested: 10_000, orderPaidAmount: 10_000 }))
      .toMatchObject({ clamped: false })
  })

  it('결제액을 모르면 거부한다 — 상한 없이 환불하지 않는다', () => {
    for (const bad of [0, -1, Number.NaN, null as unknown as number]) {
      expect(resolveRefundAmount({ requested: 5_000, orderPaidAmount: bad }).ok, String(bad)).toBe(false)
    }
  })
})

describe('🔴 입력 정규화 — ④-b 에서 실제로 났던 버그 클래스', () => {
  it('빈 문자열은 0원이 아니라 거부다', () => {
    // `Number('')` 이 0 이라, 이 가드가 없으면 칸을 비운 채 저장했을 때 환불이 0원이 된다.
    expect(resolveRefundAmount({ requested: '', orderPaidAmount: 10_000 }).ok).toBe(false)
    expect(resolveRefundAmount({ requested: '   ', orderPaidAmount: 10_000 }).ok).toBe(false)
    expect(resolveRefundAmount({ requested: null, orderPaidAmount: 10_000 }).ok).toBe(false)
    expect(resolveRefundAmount({ requested: undefined, orderPaidAmount: 10_000 }).ok).toBe(false)
  })

  it('0원은 유효한 값이다 — "환불 안 함"도 결정이다', () => {
    expect(resolveRefundAmount({ requested: 0, orderPaidAmount: 10_000 }))
      .toEqual({ ok: true, amount: 0, clamped: false })
  })

  it('음수는 거부 — 소비자에게서 돈을 빼앗는 방향', () => {
    expect(resolveRefundAmount({ requested: -1, orderPaidAmount: 10_000 }).ok).toBe(false)
  })

  it('Infinity·문자는 거부', () => {
    for (const bad of [Number.POSITIVE_INFINITY, 'abc', {}, []]) {
      expect(resolveRefundAmount({ requested: bad, orderPaidAmount: 10_000 }).ok, String(bad)).toBe(false)
    }
  })

  it('쉼표 섞인 입력·소수점을 사람 입력답게 처리한다', () => {
    expect(resolveRefundAmount({ requested: '12,000', orderPaidAmount: 20_000 }))
      .toMatchObject({ ok: true, amount: 12_000 })
    // 내림 — 1원이라도 더 주지 않는다(PG 는 소수점을 거부한다)
    expect(resolveRefundAmount({ requested: '3999.9', orderPaidAmount: 20_000 }))
      .toMatchObject({ ok: true, amount: 3_999 })
  })
})

describe('🔴 환불이 나간 뒤엔 못 바꾼다', () => {
  it('처리 전 상태만 편집 가능', () => {
    for (const s of ['requested', 'approved', 'received', 'inspected']) {
      expect(canEditRefundAmount(s), s).toBe(true)
    }
    for (const s of ['refunded', 'rejected', 'cancelled', 'shipped_unknown', '', null, undefined]) {
      expect(canEditRefundAmount(s as string), String(s)).toBe(false)
    }
  })
})

/**
 * 아래는 **배선** 검사다. 순수함수가 옳아도 라우트가 안 붙으면 라이브는 안 바뀐다.
 */
describe('🔴 배선', () => {
  const route = readCode('src/features/returns/api/return-amount.routes.ts')
  // ⚠️ `readCode`(주석 제거본)를 쓰면 안 된다. `stripComments` 의 블록주석 정규식이
  //    **문자열 안의 `/*`**(워커의 `'/*'` 라우트 패턴)을 주석 시작으로 보고 그 뒤를 통째로 지운다.
  //    실제로 이 파일에서 마운트 줄이 사라져 **정상 코드에 빨간불**이 떴다.
  //    line-anchored 정규식이라 주석 처리된 줄은 매치되지 않는다.
  const worker = readRaw('src/worker/index.ts')
  const barrel = readRaw('src/features/returns/api/index.ts')
  const page = readCode('src/pages/AdminReturnsPage.tsx')
  const legacy = readCode('src/features/returns/api/returns.routes.ts')

  it('워커에 마운트돼 있다 — 라우트만 만들면 아무도 못 부른다', () => {
    // 배럴이 두 라우터를 합쳐 내보내고, 워커는 그 배럴 **하나만** 마운트한다
    // (워커는 2664줄 god 파일이라 마운트를 늘리면 래칫이 막는다 — 실제로 막혔다).
    expect(barrel).toMatch(/\.route\('\/', returnAmountRoutes\)/)
    expect(worker).toMatch(/^import \{ returnsRoutes \} from '\.\.\/features\/returns\/api';/m)
    expect(worker).toMatch(/^app\.route\('\/api\/returns', returnsRoutes\)/m)
  })

  it('🔴 게이트 뒤에 있다 (기본 OFF)', () => {
    expect(route).toContain("'partial_refund_enabled'")
    const gate = sliceFrom(route, 'async function partialRefundEnabled', undefined, 700)
    // 조회 실패는 '허용'이 아니다 — 머니 경로에서 fail-open 금지.
    expect(gate).toMatch(/catch[\s\S]{0,120}return false/)
  })

  it('🔴 상한을 서버에서 건다 — 클라 값을 그대로 쓰지 않는다', () => {
    const h = sliceFrom(route, "patch(\n  '/:id/amount'", undefined, 4000)
    expect(h).toContain('resolveRefundAmount(')
    expect(h).toMatch(/orderPaidAmount: Number\(order\?\.total_amount/)
  })

  it('🔴 처리된 반품은 거부한다', () => {
    expect(route).toContain('canEditRefundAmount(rec.status)')
  })

  it('🔴 상태 CAS 로 쓴다 — 그 사이 환불이 나갔으면 덮어쓰지 않는다', () => {
    expect(route).toMatch(/WHERE id = \? AND status = \?/)
    expect(route).toMatch(/if \(!res\.meta\?\.changes\)/)
  })

  it('IDOR — 남의 반품과 없는 반품이 같은 404 다', () => {
    expect(route).toMatch(/!rec \|\| \(!isAdminActor && rec\.seller_id !== sellerId\)/)
  })

  it('🔴 돈을 내보내는 엔드포인트를 건드리지 않았다', () => {
    // `PUT /:id/refund` 는 저장된 값을 집행할 뿐이다. 금액 설정이 거기 섞이면
    // rateLimit(3/시간) 예산이 오타 한 번에 타고, 실행 경로의 회귀 위험도 생긴다.
    const refund = sliceFrom(legacy, "put('/:id/refund'", undefined, 1200)
    expect(refund).not.toContain('resolveRefundAmount')
    expect(refund).not.toContain('body.amount')
  })

  it('어드민 화면에서 실제로 렌더된다', () => {
    expect(page).toContain('<RefundAmountEditor')
    expect(page).toContain("from '@/components/admin/RefundAmountEditor'")
  })

  it('🔴 "환불 완료" 표시가 status 를 본다 — 신청만 해도 뜨던 버그', () => {
    // `refund_amount` 는 신청 시점에 채워진다. status 를 안 보면 돈이 안 나갔는데 나간 것처럼 보인다.
    expect(page).toMatch(/r\.status === 'refunded' && r\.refund_amount/)
  })
})
