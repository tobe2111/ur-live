/**
 * 🔐 2026-11-17 보안 점검 8차 — 개인정보·계정 탈취 경로(대표 *"해킹이나 개인정보 탈취 등의 허점 없을까?"*).
 *
 * ① 셀러 비밀번호 재설정 토큰은 **해시로만** 저장한다.
 *    종전엔 `password_reset_tokens.token` 에 원문이 들어갔다 — DB 를 읽을 수 있는 쪽(백업·읽기 권한·SQL 주입)이
 *    1시간 안에 그 값으로 아무 사장님 계정의 비밀번호를 바꿀 수 있었다. 에이전시는 이미 해시였고 셀러만 남아 있었다.
 *
 * ## ⚠️ 못 보는 것
 * - 이행기(배포 직후 1시간)에 남아 있는 옛 원문 행 — 만료되면 사라진다.
 * - 메일함이 털린 경우(링크 자체가 새는 것)는 이 수리와 무관하다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '@/tests/helpers/source-text'

describe('① 셀러 비밀번호 재설정 토큰 — 해시 저장', () => {
  const code = readCode('src/features/auth/api/seller.routes.ts')
  it('저장은 hashToken(token)', () => {
    expect(code).toMatch(/\.bind\(seller\.id, await hashToken\(token\), expiresAt\)/)
    expect(code).not.toMatch(/\.bind\(seller\.id, token, expiresAt\)/)
  })
  it('조회는 해시로, 원문 대조는 옛 형식(32자 hex)만', () => {
    expect(code).toMatch(/\.bind\(await hashToken\(token\), \/\^\[0-9a-f\]\{32\}\$\/\.test\(token\) \? token : ''\)/)
  })
  it('저장된 해시를 토큰인 척 내밀면 원문 대조에 안 걸린다', async () => {
    const { hashToken } = await import('@/lib/password')
    const stored = await hashToken('0123456789abcdef0123456789abcdef')
    expect(stored.startsWith('s256$')).toBe(true)
    expect(/^[0-9a-f]{32}$/.test(stored)).toBe(false) // ⇒ 원문 자리엔 '' 이 묶인다
    expect(await hashToken(stored)).not.toBe(stored)
  })
})

describe('② 공개 응답에 사장님 연락처·미승인 매장 신원이 없다', () => {
  it('/api/seller/public/:id 가 email·phone 을 고르지 않는다', () => {
    const code = readCode('src/features/seller/api/seller-management.routes.ts')
    const seg = code.slice(code.indexOf("sellerManagementRoutes.get('/public/:sellerId'"), code.indexOf("sellerManagementRoutes.get('/:sellerId/products-public'"))
    expect(seg.length).toBeGreaterThan(500)
    expect(seg).not.toMatch(/\bemail\b|\bphone\b/)
  })
  it('승인·활성 매장만 사업자 신원을 공개한다', async () => {
    const { isSellerIdentityPublic } = await import('@/worker/utils/seller-public-payload')
    for (const ok of ['approved', 'active']) expect(isSellerIdentityPublic(ok), ok).toBe(true)
    for (const no of ['pending', 'rejected', 'suspended', '', null, undefined]) expect(isSellerIdentityPublic(no), String(no)).toBe(false)
    const code = readCode('src/worker/utils/seller-public-payload.ts')
    expect(code).toMatch(/if \(!identityPublic\) \{[^}]*business_number = null[^}]*business_address = null[^}]*ceo_name = null/)
    expect(code).toMatch(/if \(sbi && identityPublic\)/)
  })
  it('경매·후원 랭킹은 이름 첫 글자만, 유저 id 없이', () => {
    const a = readCode('src/features/auction/api/auction.routes.ts')
    expect(a).not.toMatch(/data: \{ \.\.\.auction,/)
    expect(a.match(/\.\.\.publicAuction\(auction\)/g)?.length).toBe(2)
    expect(readCode('src/features/social/api/social.routes.ts')).toMatch(/\(\{ donor_user_id: _id, \.\.\.r \}: any, i: number\) => \(\{[^\n]*\n\s*\.\.\.r, donor_name: maskName\(r\.donor_name\)/)
  })
})

describe('③ 손님 데이터는 손님 토큰으로만 — 셀러 #N 이 유저 #N 으로 읽히지 않는다', () => {
  it('주문 라우터는 손님·관리자만', () => {
    expect(readCode('src/worker/routes/order.routes.ts')).toMatch(/ordersRouter\.use\('\*', requireUserType\('user', 'admin'\)\)/)
  })
  it('알림: user_notifications 는 손님 토큰일 때만 묶인다', () => {
    const code = readCode('src/features/notifications/api/notifications.routes.ts')
    const un = code.split('\n').filter((l) => /user_notifications/.test(l) && /\.bind\(/.test(l))
    expect(un.length).toBeGreaterThanOrEqual(2)
    for (const l of un) expect(l, l.trim().slice(0, 80)).toMatch(/userType === 'user' \? userId : ''/)
    expect(code).toMatch(/const unId = userType === 'user' \? userId : ''/)
    expect(code).toMatch(/\.bind\(unId\)\.first<\{ c: number \}>\(\)/)
    expect(code).toMatch(/bind\(userType === 'user' \? userId : '', opts\.limit\)/)
    expect(code).toMatch(/bind\(numericId, userType === 'user' \? userId : ''\)\.run\(\);\n\s*updated/)
  })
  it('찜 조회·이의 대상·타임딜 생성', () => {
    const w = readCode('src/features/wishlists/api/wishlists.routes.ts')
    expect(w.match(/\(authUser\.type !== 'user' \|\| userId !== String\(authUser\.id\)\) && authUser\.type !== 'admin'/g)?.length).toBe(2)
    expect(readCode('src/features/group-buy/api/voucher-dispute.routes.ts')).toMatch(/if \(user\.type !== 'user'\) return c\.json\(\{ success: true, data: \[\] \}\)/)
    expect(readCode('src/features/timedeal/api/timedeal.routes.ts')).toMatch(/timedealRoutes\.post\('\/create', requireSeller\(\)/)
  })
})

describe('④ 경매 공개 응답 가림(실행)', () => {
  it('실명은 첫 글자만 · 유저 id 는 빠진다', async () => {
    const { publicAuction, publicBid } = await import('@/features/auction/api/auction-public')
    const a = publicAuction({ id: 1, winner_user_id: '3', winner_name: '정지원', current_price: 1000 }) as Record<string, unknown>
    expect(a.winner_user_id).toBeUndefined()
    expect(a.winner_name).toBe('정**')
    expect(a.has_winner).toBe(true)
    expect(publicBid({ user_name: '김철수', amount: 5 })).toEqual({ user_name: '김**', amount: 5 })
  })
})

describe('⑤ 유어샵 공개 응답에 매장↔주인 계약 %가 없다 (2026-11-17 대표 "응 가려줘")', () => {
  it('dealFlag — 있음 1 / 없음 null, 숫자는 안 남는다', async () => {
    const { dealFlag, hasDealPin } = await import('@/shared/curator-pin-order')
    expect(dealFlag(7.5)).toBe(1)
    expect(dealFlag(0)).toBeNull()
    expect(dealFlag(null)).toBeNull()
    expect(dealFlag(undefined)).toBeNull()
    // 화면의 정렬 판정은 그대로 — 계약 있는 핀이 위로 간다
    expect(hasDealPin({ deal_pct: dealFlag(12) } as never)).toBe(true)
    expect(hasDealPin({ deal_pct: dealFlag(null) } as never)).toBe(false)
  })
  it('공개 라우트가 dealFlag 를 거친다', () => {
    const code = readCode('src/worker/routes/curator.routes.ts')
    expect(code).toMatch(/deal_pct: dealFlag\(dealBySeller\.get\(Number\(r\.seller_id\)\)\)/)
    expect(code).not.toMatch(/deal_pct: dealBySeller\.get\(/)
  })
})

describe('⑥ 주문 라우터 — 관리자는 개별 조회·취소만', () => {
  it('경로 판정', async () => {
    const { ADMIN_ORDER_PATH } = await import('@/worker/routes/order.routes')
    for (const ok of ['/api/orders/123', '/api/orders/ORD-1-AB', '/api/orders/123/cancel']) expect(ADMIN_ORDER_PATH.test(ok), ok).toBe(true)
    for (const no of ['/api/orders', '/api/orders/', '/api/orders/123/hide', '/api/orders/refund/x', '/api/orders/1/2/cancel']) expect(ADMIN_ORDER_PATH.test(no), no).toBe(false)
  })
  it('미들웨어가 걸려 있다', () => {
    expect(readCode('src/worker/routes/order.routes.ts')).toMatch(/c\.get\('user'\)\?\.type === 'admin' && !ADMIN_ORDER_PATH\.test\(c\.req\.path\) \? c\.json\(\{ success: false, error: 'Forbidden' \}, 403\) : next\(\)/)
  })
})

describe('⑦ 위임받은 운영자가 주인 자리를 못 차지한다 · 그 밖의 남은 틈', () => {
  it('카카오 연결은 주인만 — 판정이 DB 조회보다 먼저', () => {
    const code = readCode('src/features/seller/api/seller-kakao-link.routes.ts')
    const seg = code.slice(code.indexOf("sellerKakaoLinkRoutes.post('/link-kakao'"), code.indexOf("sellerKakaoLinkRoutes.post('/relink-kakao'"))
    const gate = seg.indexOf('if (!actor.isOwner) return c.json(')
    expect(gate).toBeGreaterThan(0)
    expect(gate).toBeLessThan(seg.indexOf('UPDATE sellers SET linked_user_id'))
    expect(seg).toMatch(/resolveStoreActor\(c\.req\.header\('Authorization'\), c\.env\.JWT_SECRET, DB\)/)
  })
  it('계정 이름·전화·이메일 수정은 주인만 · 이메일은 형식 검사', () => {
    const code = readCode('src/features/seller/api/seller-account.routes.ts')
    const seg = code.slice(code.indexOf("sellerAccountRoutes.on(['PUT', 'PATCH'], '/personal-info'"), code.indexOf("sellerAccountRoutes.post('/change-password'"))
    const gate = seg.indexOf('if (!actor.isOwner) return c.json(')
    expect(gate).toBeGreaterThan(0)
    expect(gate).toBeLessThan(seg.indexOf('UPDATE sellers SET'))
    expect(seg).toMatch(/typeof body\[k\] !== 'string' \|\| body\[k\]\.length > 200/)
  })
  it('Resend 웹훅은 비밀값이 없으면 받지 않는다', () => {
    const code = readCode('src/features/notifications/api/resend-webhook.routes.ts')
    // 2026-11-18: 503 → 202(무시). 핵심은 '처리하지 않고 돌아간다' — 상태 코드가 아니다.
    expect(code).toMatch(/\} else \{[\s\S]{0,400}?return c\.json\(\{ success: false, error: 'webhook_not_configured', ignored: true \}, 202\)/)
    expect(code).not.toMatch(/signature verification skipped/)
  })
  it('남의 매장 이용권 번호는 없는 번호와 같은 답', () => {
    const code = readCode('src/worker/utils/voucher-seller-redeem.ts')
    expect(code).not.toMatch(/status: 403/)
    expect(code.match(/status: 404, error: '바우처를 찾을 수 없습니다'/g)?.length).toBe(2)
  })
  it('번들 수정도 소유·할인 검사를 한다', () => {
    const code = readCode('src/features/bundles/api/bundle.routes.ts')
    const seg = code.slice(code.indexOf("bundleSellerRoutes.patch('/:id'"))
    expect(seg.indexOf('본인 소유 상품만 번들에 추가할 수 있습니다')).toBeGreaterThan(0)
    expect(seg.indexOf('본인 소유 상품만 번들에 추가할 수 있습니다')).toBeLessThan(seg.indexOf('DELETE FROM product_bundle_items'))
    expect(seg).toMatch(/=== 'percent' && Number\(body\.discount_value \?\? cur\?\.discount_value\) > 90/)
  })
  it('재고 조회 — 남의 상품은 못 본다', async () => {
    const { ownsProduct } = await import('@/features/inventory/api/inventory.routes')
    expect(ownsProduct({ id: 5, type: 'seller' }, 5)).toBe(true)
    expect(ownsProduct({ id: 5, type: 'seller' }, 6)).toBe(false)
    expect(ownsProduct({ id: 5, type: 'user' }, 5)).toBe(false)
    expect(ownsProduct({ id: 1, type: 'admin' }, 6)).toBe(true)
    expect(ownsProduct(null, 5)).toBe(false)
    expect(readCode('src/features/inventory/api/inventory.routes.ts').match(/ownsProduct\(getCurrentUser\(c\)/g)?.length).toBe(2)
  })
})
