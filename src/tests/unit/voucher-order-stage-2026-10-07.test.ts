/**
 * 🎟️ **이용권 주문이 "처리 대기" 에 영원히 쌓이지 않는다** (2026-10-07 대표 *"남은 것들 다 이상적으로 진행해줘"*).
 *
 * 주문 탭이 택배용([처리 대기 → 준비 중 → 완료])이라 배송이 없는 이용권은 끝날 길이 없었다.
 * 그 숫자가 홈 티켓·마이 판매 구역·매장 요약에 그대로 찍혀 할 일 없는 사장님을 매일 재촉했다.
 *
 * 이 시험이 지키는 것:
 *   ① 단계 판정 SSOT(`order-stage`)의 **동작** — 이용권은 waiting 이 될 수 없다
 *   ② 서버 집계 술어(`shipping-order-sql`)를 **실제 SQLite 에서 실행**해 클라 판정과 같은 결론인지
 *   ③ 세 화면(폰 주문 목록 · 홈 · 마이)과 서버 요약이 그 SSOT 를 실제로 쓰는지
 *
 * ⚠️ 못 보는 것: 탭이 폰 폭에 어떻게 보이는지(그려서 봐야 한다) · PC 주문 표(이번 범위 밖 —
 *   `SellerOrdersPage` 는 600줄 래칫 + 환불 머니 경로가 같이 있어 별건).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { orderStageOf, needsSellerConfirm } from '@/shared/order-stage'
import { shippingOrderSql } from '@/shared/db/shipping-order-sql'

const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => { exec: (s: string) => void; prepare: (s: string) => { all: (...a: unknown[]) => unknown[] } }
}

describe('① 단계 판정', () => {
  it('이용권 주문은 결제가 끝나도 "처리 대기" 가 아니다 — 미사용이면 사용 전', () => {
    for (const status of ['PAID', 'DONE', 'PAY_COMPLETE']) {
      const o = { status, order_kind: 'voucher', vouchers: [{ status: 'unused' }] }
      expect(orderStageOf(o)).toBe('unused')
      expect(needsSellerConfirm(o)).toBe(false)
    }
  })
  it('이용권을 다 쓰면 완료, 한 장이라도 남으면 사용 전', () => {
    expect(orderStageOf({ status: 'DONE', order_kind: 'voucher', vouchers: [{ status: 'used' }, { status: 'used' }] })).toBe('done')
    expect(orderStageOf({ status: 'DONE', order_kind: 'voucher', vouchers: [{ status: 'used' }, { status: 'unused' }] })).toBe('unused')
  })
  it('발급 목록을 모르면(구 응답) 사용 전으로 둔다 — 완료라고 단정하지 않는다', () => {
    expect(orderStageOf({ status: 'DONE', order_kind: 'voucher' })).toBe('unused')
    expect(orderStageOf({ status: 'DONE', order_kind: 'voucher', vouchers: [] })).toBe('unused')
  })
  it('교환권은 발송되면 끝 — 완료', () => {
    expect(orderStageOf({ status: 'PAID', order_kind: 'deal' })).toBe('done')
  })
  it('배송 주문은 종전 그대로 — 처리 대기 → 준비 중 → 완료', () => {
    expect(orderStageOf({ status: 'PAID', order_kind: 'shipping' })).toBe('waiting')
    expect(needsSellerConfirm({ status: 'DONE', order_kind: 'shipping' })).toBe(true)
    expect(orderStageOf({ status: 'SHIPPING', order_kind: 'shipping' })).toBe('preparing')
    expect(orderStageOf({ status: 'DELIVERED', order_kind: 'shipping' })).toBe('done')
  })
  it('종류를 모르면 배송으로 읽는다(운송장 칸을 지우지 않는 쪽) — order_kind 없는 결제 주문은 처리 대기', () => {
    expect(orderStageOf({ status: 'PAID' })).toBe('waiting')
  })
  it('취소·환불은 종류 무관 refunded, 결제 전은 other', () => {
    expect(orderStageOf({ status: 'REFUNDED', order_kind: 'voucher' })).toBe('refunded')
    expect(orderStageOf({ status: 'CANCELLED', order_kind: 'shipping' })).toBe('refunded')
    expect(orderStageOf({ status: 'PENDING', order_kind: 'voucher' })).toBe('other')
  })
})

describe('② 서버 집계 술어 — 실제 SQLite 에서 클라 판정과 같은 결론', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE orders (id INTEGER PRIMARY KEY, seller_id INTEGER, status TEXT);
    CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER);
    CREATE TABLE products (id INTEGER PRIMARY KEY, category TEXT, deal_only INTEGER);
    INSERT INTO products VALUES (1,'meal_voucher',0),(2,'fashion',0),(3,'편의점',1),(4,'pet_voucher',0);
    -- 10: 이용권만 / 11: 배송만 / 12: 이용권+배송 섞임 / 13: 교환권 / 14: 라인 없음 / 15: 상품 행 없음 / 16: 레거시 이용권 카테고리
    INSERT INTO orders VALUES (10,1,'PAID'),(11,1,'PAID'),(12,1,'PAID'),(13,1,'PAID'),(14,1,'PAID'),(15,1,'PAID'),(16,1,'PAID');
    INSERT INTO order_items VALUES (1,10,1),(2,11,2),(3,12,1),(4,12,2),(5,13,3),(6,15,999),(7,16,4);
  `)
  const ids = (db.prepare(`SELECT o.id FROM orders o WHERE ${shippingOrderSql('o')} ORDER BY o.id`).all() as { id: number }[]).map((r) => r.id)

  it('배송으로 세는 것: 배송만 · 섞임 · 라인 없음 · 상품 못 찾음 (모르면 배송)', () => {
    expect(ids).toEqual([11, 12, 14, 15])
  })
  it('이용권·교환권·레거시 이용권 카테고리는 "처리 대기" 집계에서 빠진다', () => {
    expect(ids).not.toContain(10)
    expect(ids).not.toContain(13)
    expect(ids).not.toContain(16)
  })
})

describe('③ 배선 — 화면 셋과 서버 요약이 SSOT 를 쓴다', () => {
  it('매장 요약의 처리 대기 쿼리가 배송 주문 술어를 건다', () => {
    const r = readCode('src/features/seller/api/seller-operators.routes.ts')
    const i = r.indexOf("app.get('/my-stores/summary'")
    expect(i, '요약 라우트를 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(0)
    expect(r.slice(i, i + 4000)).toMatch(/AND \$\{shippingOrderSql\('o'\)\}/)
  })
  it('홈 "처리 대기" 숫자가 needsSellerConfirm 으로 센다 (상태 집합 직접 비교 금지)', () => {
    const h = readCode('src/pages/seller-page/useSellerHome.ts')
    expect(h).toMatch(/orders\.filter\(needsSellerConfirm\)\.length/)
    expect(h).not.toMatch(/AWAITING_CONFIRM\.has/)
  })
  it('마이 판매 구역의 확인할 주문이 needsSellerConfirm 으로 거른다', () => {
    const w = readCode('src/pages/user-profile/seller-section/useSellerWork.ts')
    expect(w).toMatch(/\.filter\(\(o\) => needsSellerConfirm\(/)
    expect(w).not.toMatch(/AWAITING_CONFIRM\.has/)
  })
  it('폰 주문 목록이 단계 SSOT 로 거르고, 이용권 탭(사용 전)이 있고, 확인 칩은 처리 대기에만', () => {
    const m = readCode('src/pages/seller-orders/MobileOrderList.tsx')
    expect(m).toMatch(/orderStageOf\(o\)/)
    expect(m).toMatch(/id: 'unused'/)
    expect(m, '처리 대기 말고 다른 단계에도 [주문 확인] 이 켜졌다').toMatch(/const hot = stage === 'waiting'$/m)
    expect(m).toMatch(/\{hot && onConfirm && \(/)
    expect(m).not.toMatch(/WAITING\.has\(o\.status\)/)
  })
})
