/**
 * 2026-10-18 — 대표 신고 두 장(현정 님 유어샵 · 내 이용권의 "30,000원 구매하기").
 *
 * ① 주인 판정은 서버 한 함수(`isSelfOwnedGroupBuy`) — 구매 차단과 화면이 같은 답을 쓴다.
 *    `/store/new` 사장님(주인 좌석만, `linked_user_id` 없음)을 이제 주인으로 본다. 중개는 주인이 아니다.
 * ② 주인이 보면 구매 자리(PC 상자·모바일 바)에 [관리하기] — 누르면 혼나는 버튼을 안 보인다.
 * ③ 유어샵 '이번 주 픽' — 사진 있는 것만 · 칩은 두 목록이 다 있을 때만 · 링크는 SSOT.
 *
 * ⚠️ 못 보는 것: 실제 화면 모양(렌더는 jsdom) · 라이브 사장님 계정으로 본 결과(로그인 필요).
 */
import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'module'
import { render, screen } from '@testing-library/react'
import { readCode } from '../helpers/source-text'
import { isSelfOwnedGroupBuy } from '@/features/group-buy/api/gb-purchase-guards'
import { photoOf, pickFeatured } from '@/pages/seller-public/featured-pick'
import type { Product } from '@/pages/seller-public/types'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(async () => ({ data: {} })), post: vi.fn() } }))
import DealBottomBar from '@/pages/group-buy/DealBottomBar'
import DealPurchaseBox from '@/pages/group-buy/DealPurchaseBox'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

function d1(withSeats = true) {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT);
    CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, email TEXT);
    INSERT INTO users VALUES (1,'a@x.kr'),(2,'b@x.kr'),(3,'c@x.kr'),(4,'d@x.kr'),(5,'e@x.kr');
    INSERT INTO sellers VALUES (10, 1, 'a@x.kr'), (20, NULL, NULL), (30, NULL, 'E@x.kr');`)
  if (withSeats) db.exec(`CREATE TABLE seller_operators (seller_id INTEGER, user_id INTEGER, role TEXT, revoked_at DATETIME);
    INSERT INTO seller_operators VALUES (20, 2, 'owner', NULL), (20, 3, 'operator', NULL), (20, 4, 'owner', '2026-10-01');`)
  return {
    prepare(sql: string) {
      let binds: unknown[] = []
      const st = {
        bind(...b: unknown[]) { binds = b; return st },
        async first() { return db.prepare(sql).get(...(binds as never[])) ?? null },
      }
      return st
    },
  } as unknown as D1Database
}

describe('① 주인 판정 — 구매 차단과 같은 함수', () => {
  it('연결 계정(linked_user_id)은 주인', async () => {
    expect(await isSelfOwnedGroupBuy(d1(), 10, '1')).toBe(true)
  })
  it('/store/new 사장님(주인 좌석만)도 주인 — 종전엔 통과해서 자기 이용권을 살 수 있었다', async () => {
    expect(await isSelfOwnedGroupBuy(d1(), 20, '2')).toBe(true)
  })
  it('중개(operator)·회수된 좌석·남은 주인이 아니다', async () => {
    expect(await isSelfOwnedGroupBuy(d1(), 20, '3')).toBe(false)
    expect(await isSelfOwnedGroupBuy(d1(), 20, '4')).toBe(false)
    expect(await isSelfOwnedGroupBuy(d1(), 20, '5')).toBe(false)
  })
  it('같은 이메일 폴백은 유지', async () => {
    expect(await isSelfOwnedGroupBuy(d1(), 30, '5')).toBe(true)
  })
  it('좌석 테이블이 없는 DB 도 종전 판정은 산다(fail-open 이 통째로 꺼지지 않는다)', async () => {
    expect(await isSelfOwnedGroupBuy(d1(false), 10, '1')).toBe(true)
    expect(await isSelfOwnedGroupBuy(d1(false), 20, '2')).toBe(false)
  })
})

describe('② 화면 — 주인에겐 [관리하기]', () => {
  const common = {
    isJoinable: true, isPrelaunch: false, buyable: true, joining: false, quantity: 1, total: 30000,
    setQuantity: () => {}, maxQty: 5, unitPrice: 30000, refPrice: 35000, discountPct: 14,
  }
  it('모바일 바: 주인이면 구매 버튼이 없고 관리하기가 있다', () => {
    render(<DealBottomBar {...common} dealPlan={null} dealUse={null} setDealUse={() => {}} canPayWithDeal={false} dealBalance={0} productId={1} onJoin={() => {}} isOwner onManage={() => {}} />)
    expect(screen.getByRole('button', { name: '관리하기' })).toBeTruthy()
    expect(screen.queryByText('구매하기')).toBeNull()
  })
  it('모바일 바: 주인이 아니면 종전 그대로', () => {
    render(<DealBottomBar {...common} dealPlan={null} dealUse={null} setDealUse={() => {}} canPayWithDeal={false} dealBalance={0} productId={1} onJoin={() => {}} />)
    expect(screen.getAllByText('구매하기').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: '관리하기' })).toBeNull()
  })
  it('PC 상자: 주인이면 결제 버튼이 없다', () => {
    render(<DealPurchaseBox {...common} unitSaving={5000} onBuy={() => {}} onPrelaunchApply={() => {}} isOwner onManage={() => {}} />)
    expect(screen.getByRole('button', { name: '관리하기' })).toBeTruthy()
    expect(screen.queryByText(/원 구매하기/)).toBeNull()
  })
  it('배선: 상세가 localStorage 셀러 번호로 주인을 정하지 않고, 두 자리에 같은 값을 넘긴다', () => {
    const c = readCode('src/pages/GroupBuyDetailPage.tsx')
    expect(c).not.toMatch(/getItem\('seller_id'\)/)
    // 2026-10-19: 판정은 세 상세가 같이 쓰는 훅(`useOwnerManage` → `useOwnedView`)으로 옮겨갔다 — 불변식 그대로.
    expect(c).toMatch(/useOwnerManage\(productId, isLoggedIn, 'pass'\)/)
    expect((c.match(/isOwner=\{isOwnProduct\}/g) ?? []).length).toBe(2)
  })
  it('배선: 판정 엔드포인트는 엣지 캐시 경로(/products/*) 밖이고 구매 차단과 같은 함수를 쓴다', () => {
    // 2026-10-19: 판정 라우트가 `owner-viewer.routes.ts` 로 옮겨갔다(관리 시트의 숫자·판매 중지와 한 곳).
    const r = readCode('src/features/group-buy/api/owner-viewer.routes.ts')
    expect(readCode('src/features/group-buy/api/group-buy.routes.ts')).toMatch(/registerOwnerViewerEndpoints\(groupBuyRoutes\)/)
    const i = r.indexOf("router.get('/viewer/:id'")
    expect(i).toBeGreaterThan(-1)
    const block = r.slice(i, r.indexOf('\n})', i))
    expect(block).toMatch(/requireAuth\(\)/)
    expect(block).toMatch(/no-store/)
    expect(block).toMatch(/isSelfOwnedGroupBuy\(/)
    expect(readCode('src/pages/group-buy/useViewerIsOwner.ts')).toMatch(/\/api\/group-buy\/viewer\//)
  })
})

describe('③ 유어샵 이번 주 픽', () => {
  const v = (id: number, extra: Partial<Product> = {}): Product => ({ id, name: `v${id}`, price: 1000, category: 'meal_voucher', ...extra })
  const s = (id: number, extra: Partial<Product> = {}): Product => ({ id, name: `s${id}`, price: 1000, category: 'lifestyle', ...extra })

  it('사진: 대표 → 갤러리 첫 장(배열·JSON 문자열) → 없음', () => {
    expect(photoOf({ image_url: 'a.jpg' })).toBe('a.jpg')
    expect(photoOf({ image_url: '', images: ['', 'b.jpg'] })).toBe('b.jpg')
    expect(photoOf({ images: '["c.jpg"]' })).toBe('c.jpg')
    expect(photoOf({ image_url: '  ', images: 'broken' })).toBeNull()
  })
  it('사진 없는 첫 이용권은 건너뛰고 사진 있는 이용권을 고른다(남색 빈 판 방지)', () => {
    const r = pickFeatured([v(1), v(2, { image_url: 'x.jpg' })], [s(9, { image_url: 'y.jpg' })])
    expect(r.featured?.id).toBe(2)
    expect(r.gridVouchers.map(p => p.id)).toEqual([1])
  })
  it('사진이 하나도 없으면 히어로를 안 그리고 전부 목록으로', () => {
    const r = pickFeatured([v(1)], [s(9)])
    expect(r.featured).toBeNull()
    expect(r.gridVouchers).toHaveLength(1)
    expect(r.gridProducts).toHaveLength(1)
  })
  it('이용권 1개가 히어로로 올라가면 칩을 안 낸다(눌러도 갈 곳 없는 [이용권] 칩)', () => {
    const r = pickFeatured([v(1, { image_url: 'x.jpg' })], [s(8), s(9)])
    expect(r.showChips).toBe(false)
    const both = pickFeatured([v(1, { image_url: 'x.jpg' }), v(2)], [s(8)])
    expect(both.showChips).toBe(true)
  })
  it('배선: 히어로 링크는 SSOT(detailHref), 칩 조건은 showChips', () => {
    const c = readCode('src/pages/SellerPublicPage.tsx')
    expect(c).toMatch(/to=\{detailHref\(featured\)\}/)
    expect(c).not.toMatch(/to=\{`\/products\/\$\{featured\.id\}`\}/)
    expect(c).toMatch(/\{showChips && \(/)
  })
})
