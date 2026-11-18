/**
 * 🪦 **깨진 화면의 문을 닫는다** — `/seller/consignment` (2026-09-28)
 *
 * 라이브 D1 에 `consignment_partnerships` **테이블이 없다**(마이그레이션 `0236` 은 레포에 있으나
 * D1 마이그레이션이 CI 에서 안 돈다 — `TECHNICAL_DEBT.md` 의 알려진 부채, `repair-schema` 에도 없다).
 * ⇒ 페이지를 열면 API 일곱 개가 전부 `no such table` 로 죽는다.
 * 진입점이 0이라 아무도 신고하지 않았을 뿐이다.
 *
 * ## ⚠️ 이 시험이 **고정하지 않는 것** (중요)
 * 기능을 없앤 게 아니라 **문만 닫았다.** API 5개 · 정비 cron ·(`checkout.ts` 자동 매핑은 2026-11-18 대표 결정으로 삭제)
 * 어드민 모니터링 · 운영 가이드 두 절(분배율 포함)은 **그대로 살아 있어야 한다** —
 * 살릴지 없앨지는 대표 판단이고(`docs/decisions/archive/2026-09-28-dead-seller-screens.md`)
 * 위탁 정산은 머니 경로다. 그래서 아래 마지막 두 건이 **"지우지 말 것"** 을 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const ROUTES = readCode('src/routes/seller.routes.tsx')
const CHECKOUT = readCode('src/worker/utils/checkout.ts')

describe('위탁 판매 — 문만 닫았다', () => {
  it('🔴 `/seller/consignment` 은 페이지 대신 리다이렉트다', () => {
    expect(ROUTES).toMatch(/path="\/seller\/consignment" element=\{<Navigate to="\/seller" replace \/>\}/)
  })

  it('🔴 깨진 페이지를 더 이상 싣지 않는다', () => {
    expect(ROUTES).not.toContain('SellerConsignmentPage')
  })

  // 🗑️ 2026-11-18 대표 결정 "응 두개 다 해줘" — 결제 경로의 위탁 자동 매핑을 지웠다(아래 두 건이 종전엔 "지우지 말 것" 을 고정했다).
  //   라이브에 `consignment_partnerships` 표가 없어 그 조회는 결제마다 실패하고 삼켜졌고, consignment_id 를 넣는 갈래는 한 번도 안 탔다.
  //   ⇒ 이제는 반대를 고정한다: 결제가 없는 표를 다시 묻지 않는다(되살리려면 표·정산부터 — 대표 판단).
  it('🗑️ 결제 경로가 없는 위탁 표를 묻지 않는다', () => {
    expect(CHECKOUT).not.toMatch(/\bconsignment_partnerships\b/)
    expect(CHECKOUT).not.toMatch(/\bconsignment_id\b/)
    expect(CHECKOUT).toMatch(/'INSERT INTO order_items \(order_id, product_id, product_name, quantity, price\) VALUES \(\?, \?, \?, \?, \?\)'/)
  })
})
