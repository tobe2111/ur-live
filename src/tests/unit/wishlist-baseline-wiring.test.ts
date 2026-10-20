/**
 * 💗 찜 시점 가격(base_price) 배선 — 소스로만 고정할 수 있는 것 (2026-09-03 안 B)
 *
 * 순수 계산(`wishlist-signals.test`)은 값이 주어졌을 때를 본다. 이 검사는 **그 값이 실제로
 * 생기고 살아남고 화면까지 오는가**를 본다. 넷 중 하나만 빠져도 배지가 조용히 사라진다 —
 * 에러도 빈 화면도 없이 그냥 기능만 없어지는, 이 레포가 반복해 겪은 "조용한 부재" 클래스다.
 *
 * ⚠️ 못 막는 것: 실제 D1 에 열이 만들어졌는지. 그건 배포 후 응답에 `base_price` 가 오는지로만
 *    판정된다(인계에 명령을 적어 둔다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const NOTIFY = readFileSync('src/worker/cron/wishlist-notify.ts', 'utf8')
const ROUTES = readFileSync('src/features/wishlists/api/wishlists.routes.ts', 'utf8')
const REPAIR = readFileSync('src/worker/routes/repair-schema/column-repairs.ts', 'utf8')
const PAGE = readFileSync('src/pages/WishlistPage.tsx', 'utf8')
const CARD = readFileSync('src/pages/main-home/GroupBuyFeedCard.tsx', 'utf8')

describe('찜 시점 가격 — 생성', () => {
  it('① 찜을 담는 순간 base_price 를 함께 기록한다', () => {
    const seed = NOTIFY.match(/export async function seedWishlistBaseline[\s\S]*?\n}/)?.[0] || ''
    expect(seed).toMatch(/INSERT OR IGNORE INTO wishlist_price_notifications \(user_id, product_id, last_price, base_price\)/)
  })

  it('② 인하 통지가 base_price 를 **덮어쓰지 않는다** (덮으면 배지가 알림 받은 사람에게만 사라진다)', () => {
    const claim = NOTIFY.match(/UPDATE wishlist_price_notifications SET last_price = ?[^"]*/)?.[0] || ''
    expect(claim).toContain('base_price = COALESCE(base_price, last_price)')
    expect(claim, 'base_price 를 현재가로 갱신하면 "찜한 뒤" 기준이 사라진다').not.toMatch(/base_price = \?/)
  })

  it('③ 열이 없는 기존 DB 도 스스로 갖춘다 (ensure + repair 양쪽)', () => {
    expect(NOTIFY).toMatch(/ALTER TABLE wishlist_price_notifications ADD COLUMN base_price INTEGER/)
    expect(REPAIR).toMatch(/ALTER TABLE wishlist_price_notifications ADD COLUMN base_price INTEGER/)
    // 옛 행은 last_price 가 유일하게 아는 기준값이다.
    expect(NOTIFY).toMatch(/SET base_price = last_price WHERE base_price IS NULL/)
  })
})

describe('찜 시점 가격 — 전달', () => {
  it('④ 목록 API 가 base_price · 마감 · 상태를 함께 내려준다', () => {
    expect(ROUTES).toMatch(/n\.base_price/)
    expect(ROUTES).toMatch(/LEFT JOIN wishlist_price_notifications n ON n\.user_id = w\.user_id AND n\.product_id = w\.product_id/)
    expect(ROUTES).toMatch(/p\.group_buy_deadline AS expires_at/)
    expect(ROUTES).toMatch(/p\.group_buy_status/)
  })

  it('⑤ 열·테이블이 없어도 500 이 아니라 **기능만 빠진다**', () => {
    expect(ROUTES).toMatch(/no such column/)
    expect(ROUTES).toMatch(/no such table/)
    expect(ROUTES).toMatch(/_wishlistBaseCol = false/)
  })
})

describe('찜 시점 가격 — 표시', () => {
  it('⑥ 찜 목록이 카드에 신호를 넘긴다', () => {
    // 🗓️ 2026-09-04 (대표 "마감 개념은 없어"): days 프롭 제거 — 마감이 없으니 늘 null 이었다.
    expect(PAGE).toMatch(/flags=\{<WishlistFlag drop=\{priceDrop\(item\)\} \/>\}/)
    expect(PAGE).toMatch(/expires_at: item\.expires_at/)
  })

  it('⑦ 카드는 신호를 **사진 밖 본문**에 그린다 (사진 위 배지 금지 — 2026-08-31 대표 지시)', () => {
    const body = CARD.match(/<div className="pt-2">[\s\S]{0,80}/)?.[0] || ''
    expect(body, '본문 맨 위가 신호 자리다').toContain('{flags}')
    const overlay = CARD.match(/overlay=\{[\s\S]*?\n        \}/)?.[0] || ''
    expect(overlay, '사진 위 오버레이에 넣으면 상품 사진을 가린다').not.toContain('flags')
  })
})
