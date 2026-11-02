/**
 * 🔗 에이전시 매장 초대 링크 — 직원 복사 · 카톡 카드 · 여러 매장 한 번에 (2026-10-31 대표 *"모두 진행해줘"*)
 *
 * 고정하는 것:
 *  ① 직원도 링크를 **읽는다**(GET 은 adminOnly 아님) · 만들기·끊기는 관리자만(POST 둘은 adminOnly)
 *  ② 카톡 카드 문구는 한 곳(`shared/agency-store-invite` `agencyInviteCardCopy`) — 에이전시가 보내는 카드와 서버 메타가 같은 문장
 *  ③ 서버 메타는 **언제나 noindex**, 없는 토큰은 ENTITY 슬롯이라 404
 *  ④ 사장님은 여러 매장을 한 번에 고르고(`seller_ids`), 이미 맡긴 매장은 다시 못 고른다
 *
 * ⚠️ 못 보는 것: 카카오가 실제로 그리는 카드(대표만 판정) · 브라우저 렌더 · 라이브 D1.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { togglePick, entrustableIds } from '@/pages/store-agency-invite/pick'
import { agencyInviteCardCopy } from '@/shared/agency-store-invite'
import { buildStoreInviteMeta } from '@/worker/utils/store-invite-ssr'
import { shouldNoindexMissingEntity } from '@/worker/utils/surface-ssr-meta'
import { entrustSellerIds, ENTRUST_STORES_PER_REQUEST_MAX } from '@/features/seller/api/store-agency-invite.routes'

const ROUTES = readCode('src/features/agency-console/api/agency-stores.routes.ts')
const CARD = readCode('src/pages/agency-console/AgencyInviteLinkCard.tsx')
const PANEL = readCode('src/pages/agency-console/AgencyStoresPanel.tsx')
const PAGE = readCode('src/pages/StoreAgencyInvitePage.tsx')
const ACCEPT = readCode('src/features/seller/api/store-agency-invite.routes.ts')
const WORKER = readCode('src/worker/index.ts')

describe('① 직원은 읽고, 관리자만 만들고 끊는다', () => {
  it('GET /store-invite 는 adminOnly 가 아니다', () => {
    expect(ROUTES).toMatch(/get\('\/store-invite', requireAgencyStaff\(\),/)
  })
  it('POST /store-invite · /store-invite/revoke 는 adminOnly 그대로', () => {
    expect(ROUTES).toMatch(/post\('\/store-invite', cors\(\), requireAgencyStaff\(\{ adminOnly: true \}\)/)
    expect(ROUTES).toMatch(/post\('\/store-invite\/revoke', cors\(\), requireAgencyStaff\(\{ adminOnly: true \}\)/)
  })
  // 🔁 2026-11-02 재조준 — 영입 입구가 마이 머리의 버튼 ①(`AgencyInviteButton`) 하나로 옮겨 갔다.
  it('영입 링크 버튼·시트가 직원에게도 열리고, 대신 등록만 관리자 전용', () => {
    const BTN = readCode('src/pages/user-profile/AgencyInviteButton.tsx')
    expect(BTN).toContain('data-testid="agency-invite-entry"')
    expect(BTN, '직원에게 버튼이 숨는다').toMatch(/if \(!on\) return null/)
    expect(BTN, '직원 판정이 버튼을 숨긴다').not.toMatch(/if \(!on \|\| !isAdmin\)/)
    expect(readCode('src/pages/agency-console/AgencyInviteSheet.tsx')).toContain('<AgencyInviteLinkCard canManage={canManage} />')
    expect(PANEL).toMatch(/sheet === 'register' && canManage/)
  })
  it('카드의 새로 만들기·끊기는 canManage 안에만 있다', () => {
    const i = CARD.indexOf('{canManage && (')
    expect(i).toBeGreaterThan(0)
    const seg = CARD.slice(i, i + 900)
    expect(seg).toContain('void renew()')
    expect(seg).toContain('void revoke()')
  })
  it('직원 화면은 링크가 없어도 스스로 만들지 않는다(서버가 거절한다)', () => {
    const i = CARD.indexOf('if (!canManage) { setInvite(null); return }')
    const j = CARD.indexOf('if (!(await create())) setInvite(null)')
    expect(i).toBeGreaterThan(0)
    expect(j).toBeGreaterThan(i)
  })
})

describe('② 카톡 카드 문구는 한 곳', () => {
  it('제목에 에이전시 이름이 들어가고, 이름이 없으면 지어내지 않는다', () => {
    expect(agencyInviteCardCopy('강남마케팅').title).toBe('강남마케팅 에이전시가 매장 운영을 맡겠다고 해요')
    expect(agencyInviteCardCopy('  ').title).toBe('에이전시가 매장 운영을 맡겠다고 해요')
    expect(agencyInviteCardCopy(null).title).not.toContain('null')
  })
  it('카톡 보내기 버튼과 서버 메타가 같은 함수를 쓴다(서버는 조회한 에이전시 이름을 넣는다)', () => {
    expect(CARD).toMatch(/agencyInviteCardCopy\(agencyName\)/)
    expect(readCode('src/worker/utils/store-invite-ssr.ts')).toMatch(/agencyInviteCardCopy\(name\)/)
  })
})

describe('③ 서버 메타 — 늘 noindex · 없는 토큰은 404', () => {
  it('살아 있는 링크: 이름이 든 카드 + noindex', () => {
    const m = buildStoreInviteMeta({ success: true, agencyName: '강남마케팅' }, 'https://urdeal.kr', '/store/agency/abc')!
    expect(m.title).toContain('강남마케팅')
    expect(m.description).toBe(agencyInviteCardCopy('강남마케팅').description)
    expect(m.noindex).toBe(true)
    expect(m.canonical).toBe('https://urdeal.kr/store/agency/abc')
  })
  it('모양이 다른 응답이면 그리지 않는다', () => {
    expect(buildStoreInviteMeta({ success: false }, 'https://urdeal.kr', '/x')).toBeNull()
    expect(buildStoreInviteMeta(null, 'https://urdeal.kr', '/x')).toBeNull()
  })
  it('STOREINVITE 는 엔티티 슬롯 — self-fetch 404 면 404 + noindex', () => {
    expect(shouldNoindexMissingEntity('STOREINVITE', 'self-fetch-404')).toBe(true)
    expect(shouldNoindexMissingEntity('STOREINVITE', 'self-fetch-timeout')).toBe(false)
  })
  it('워커 배선: 슬롯 + 메타 rewrite', () => {
    expect(WORKER).toMatch(/slot: 'STOREINVITE', path: `\/api\/store-agency-invite\//)
    expect(WORKER).toMatch(/ssrSlot === 'STOREINVITE' && ssrPayload\) \{ const sm = buildStoreInviteMeta\(/)
    expect(WORKER).toMatch(/applySurfaceMeta\(rb, sm\)/)
    // 이름 없는 공통 메타(동적 표면)가 나중에 돌아 덮으므로, 초대 메타가 있으면 그쪽을 건너뛴다.
    expect(WORKER).toMatch(/if \(!needsRootBlank && !\(ssrSlot === 'STOREINVITE' && buildStoreInviteMeta\(ssrPayload, origin2, url\.pathname\)\)\)/)
  })
})

describe('④ 여러 매장 한 번에', () => {
  it('seller_ids 우선, 옛 seller_id 도 받고, 중복·잘못된 값은 버린다', () => {
    expect(entrustSellerIds({ seller_ids: [3, 3, 5, 'x', -1, 0] })).toEqual([3, 5])
    expect(entrustSellerIds({ seller_id: 7 })).toEqual([7])
    expect(entrustSellerIds({})).toEqual([])
  })
  it('한 요청의 상한이 있다', () => {
    expect(ENTRUST_STORES_PER_REQUEST_MAX).toBeGreaterThan(1)
    expect(ACCEPT).toMatch(/sellerIds\.length > ENTRUST_STORES_PER_REQUEST_MAX/)
  })
  it('매장마다 주인 확인을 한다(한 곳만 확인하고 나머지를 통과시키지 않는다)', () => {
    const fn = ACCEPT.slice(ACCEPT.indexOf('async function entrustOne'), ACCEPT.indexOf('export function entrustSellerIds'))
    expect(fn).toMatch(/isStoreOwner\(DB, userId, sellerId\)/)
    expect(ACCEPT).toMatch(/for \(const id of sellerIds\) results\.push\(await entrustOne\(DB, inv, userId, id\)\)/)
  })
  it('메일은 한 번에 한 통(매장 수만큼 보내지 않는다)', () => {
    const i = ACCEPT.indexOf('const fresh = ok.filter')
    const seg = ACCEPT.slice(i, i + 1600)
    expect(seg).not.toMatch(/for \(const r of fresh\)/)
    expect(seg).toMatch(/for \(const a of admins/)
  })
  it('이미 맡긴 매장은 다시 고를 수 없다', () => {
    expect(entrustableIds([1, 2, 3], [2])).toEqual([1, 3])
    expect(togglePick([1], 2)).toEqual([1, 2])
    expect(togglePick([1, 2], 1)).toEqual([2])
    expect(PAGE).toMatch(/type="checkbox" disabled=\{isOn\}/)
    expect(PAGE).toMatch(/seller_ids: picked/)
  })
  it('GET 은 로그인 사장님에게만 운영 중 매장을 알려 주고, 그때는 캐시하지 않는다', () => {
    const i = ACCEPT.indexOf("storeAgencyInviteRoutes.get('/:token'")
    const seg = ACCEPT.slice(i, i + 2200)
    expect(seg).toMatch(/private, no-store/)
    expect(seg).toMatch(/linked_user_id = \?/)
    expect(seg).toMatch(/role = 'owner' AND revoked_at IS NULL/)
  })
})
