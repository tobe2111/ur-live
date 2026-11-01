/**
 * 🧾 마이에서 들어가는 화면이 **서버가 실제로 하는 일**과 같은 말을 하는가 (2026-10-19)
 *
 * 대표 *"이제 가장 이상적이야? 전체적으로 모두 확인하고 말해줘"* → 감사에서 나온 결함들:
 *   ① 탈퇴 안내가 *"30일 내 복원 시 모든 혜택 회복"* 이라 했는데, 탈퇴 순간 딜은 소멸하고 쿠폰·찜·단골은 **삭제**된다.
 *      우리에게 없는 것(장바구니·멤버십·1:1 상담·결제 수단)을 "삭제된다" 고 나열했고, 잃는 **돈**(딜·이용권)은 말하지 않았다.
 *   ② 복원 모달이 *"쿠폰·딜 포인트·위시리스트가 다시 살아나요"* — `restoreUser` 는 users 한 행만 되살린다.
 *   ③ 내 리뷰가 배송 완료 **쇼핑 주문**만 보여 줬고(서버 자격은 *매장에서 쓴 이용권*), 버튼은 없는 앵커(`#review`)로 갔다.
 *   ④ FAQ 에 '배송' 묶음 — 쇼핑 탭이 숨겨져 있는 동안 택배 질문은 거짓 안내다.
 *   ⑤ 지도 피커가 개발자용 원인 문장("운영자 환경변수 확인")을 손님 화면에 그렸다.
 *   ⑥ 머리줄이 네 모양 — 화면마다 다른 앱처럼 보였다.
 *
 * ⚠️ 이 시험이 **못 보는 것**: 문장이 자연스러운지 · 실제 렌더(`visual-preview` 로 본다) ·
 *   서버 탈퇴 정책 자체가 옳은지(그건 `docs/decisions/2026-10-19-account-deletion-assets.md` — 대표 결재).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readCode } from '../helpers/source-text'
import { reviewableVouchers, PASS_REVIEW_ANCHOR } from '@/pages/MyReviewsPage'
import { GONE_ON_DELETE } from '@/pages/AccountDeleteWarningPage'
import { CONCEPT_FAQ, CONCEPT_FAQ_ALL, SHOPPING_ONLY_FAQ_KEYS } from '@/shared/seo/concept-content'
import { SHOPPING_TAB_HIDDEN } from '@/shared/feature-flags'

const ko = JSON.parse(readFileSync('public/locales/ko/translation.json', 'utf8'))
const PAGE = 'src/pages/AccountDeleteWarningPage.tsx'
const SERVICE = 'src/worker/services/delete-account.service.ts'

describe('① 탈퇴 안내 = 서버가 실제로 하는 일', () => {
  it('바로 사라진다고 말하는 것을 서버가 실제로 지운다(소멸·DELETE)', () => {
    const svc = readCode(SERVICE)
    const proof: Record<(typeof GONE_ON_DELETE)[number], RegExp> = {
      deal: /zeroOutUserPoints\(/,
      coupons: /DELETE FROM user_coupons/,
      wishlist: /DELETE FROM wishlists/,
      follows: /DELETE FROM seller_follows/,
      notifications: /DELETE FROM notifications/,
    }
    for (const k of GONE_ON_DELETE) {
      expect(svc, `화면은 '${k}' 가 바로 사라진다고 하는데 서버가 안 지운다 — 거짓 안내`).toMatch(proof[k])
    }
  })

  it('없는 기능·거짓 약속을 다시 말하지 않는다', () => {
    const code = readCode(PAGE)
    const text = code + JSON.stringify(ko.accountDeleteWarning)
    for (const bad of ['모든 혜택이 회복', '장바구니', '최근 본 상품', '멤버십', '1:1 상담', '결제 수단', '적립 포인트']) {
      expect(text, `탈퇴 안내에 '${bad}' 가 돌아왔다`).not.toContain(bad)
    }
  })

  it('그 사람의 실제 숫자를 보여 준다 — 딜은 마이와 같은 훅, 이용권·충전 딜·가게는 서버 판정 한 곳', () => {
    const code = readCode(PAGE)
    expect(code).toMatch(/useBalance\(\{ fresh: true \}\)/)
    // 2026-10-19 결재 후: 안 쓴 이용권은 서버(`countAccountDeleteBlockers`)가 센다 — SQL 이 지갑과 같은 집합인지는
    // `account-delete-blockers-2026-10-19.test.ts` 가 실제 SQLite 로 확인한다.
    expect(code).toMatch(/\/api\/account\/delete-blockers/)
    // 잔액을 못 읽었을 때 0 으로 위장하지 않는다 — "소멸될 딜이 없어요" 는 거짓말이 된다.
    expect(code, '잔액 조회 실패를 0 으로 위장한다').toMatch(/balanceQ\.isError \? null/)
    // 서버 값을 받기 전(캐시 seed 0)에 "소멸될 딜이 없어요" 를 말하며 탈퇴를 열면 안 된다.
    expect(code, '받기 전 잔액을 숫자로 쓴다').toMatch(/isFetchedAfterMount/)
    expect(code, '모르는 잔액을 0 으로 쓴다').toMatch(/dealKnown \? Math\.max\(0, Number\(balanceQ\.data \?\? 0\)\) : null/)
    expect(code, '잔액 확인 전에 탈퇴 버튼이 열린다').toMatch(/const canProceed = agreed && !dealChecking/)
  })

  it('서버 원문(detail)을 손님에게 보여 주지 않는다', () => {
    expect(readCode(PAGE)).not.toMatch(/\.detail\b/)
  })

  it('복원 모달이 돌아오지 않는 것을 돌아온다고 하지 않는다', () => {
    const desc: string = ko.user.restoreWhenRestoreDesc
    expect(desc).toContain('돌아오지 않아요')
    expect(desc).not.toMatch(/쿠폰, 딜 포인트|모든 데이터가 다시/)
    const svc = readCode(SERVICE)
    const restore = svc.slice(svc.indexOf('export async function restoreUser'))
    // 복원이 쿠폰·딜을 되살리게 바뀌면 이 문구가 거짓이 된다 — 그때 함께 고칠 것.
    expect(restore, 'restoreUser 가 쿠폰/딜을 되살리기 시작했다 — 복원 문구를 갱신할 것').not.toMatch(/user_coupons|point_transactions|wishlists/)
  })
})

describe('③ 내 리뷰 = 서버 리뷰 자격과 같은 목록', () => {
  const v = (o: Record<string, unknown>) => ({ id: Math.random(), status: 'used', product_id: 1, ...o })

  it('매장에서 쓴 이용권만, 상품당 하나, 이미 쓴 리뷰는 빼고', () => {
    const out = reviewableVouchers(
      [
        v({ id: 1, product_id: 10 }),
        v({ id: 2, product_id: 10 }),                 // 같은 상품 — 하나만
        v({ id: 3, product_id: 11, status: 'unused' }), // 아직 안 씀
        v({ id: 4, product_id: 12, deal_only: 1 }),   // 교환권 — 이 자격 경로 아님
        v({ id: 5, product_id: 13 }),                 // 이미 리뷰 씀
        v({ id: 6, product_id: 14 }),
      ],
      [{ product_id: 13 }],
    )
    expect(out.map((x) => x.product_id)).toEqual([10, 14])
  })

  it('버튼은 이용권 상세의 실제 리뷰 구역으로 간다', () => {
    const detail = readCode('src/pages/GroupBuyDetailPage.tsx')
    expect(detail, `상세에 id="${PASS_REVIEW_ANCHOR}" 가 없다 — 리뷰 쓰기가 상세 맨 위를 연다`).toContain(`id="${PASS_REVIEW_ANCHOR}"`)
    const page = readCode('src/pages/MyReviewsPage.tsx')
    expect(page).not.toContain('#review`')
    expect(page).toMatch(/#\$\{PASS_REVIEW_ANCHOR\}/)
  })

  it('해시로 들어오면 그 구역까지 내려 준다(ScrollToTop)', () => {
    const s = readCode('src/components/ScrollToTop.tsx')
    expect(s).toMatch(/document\.getElementById\(id\)/)
    expect(s, '해시를 selector 로 쓰면 외부 입력이 querySelector 에 들어간다').not.toMatch(/querySelector\(hash/)
    expect(s).toMatch(/\[entryKey, navType, preserveScroll, hash\]/)
  })
})

describe('④ FAQ — 쇼핑이 숨겨진 동안 배송 질문은 빠진다', () => {
  it('화면·구조화 데이터가 쓰는 배열에 배송 질문이 없다', () => {
    const shipping = CONCEPT_FAQ.filter((f) => SHOPPING_ONLY_FAQ_KEYS.has(f.key) || f.categoryKey === 'faq.catShipping')
    if (SHOPPING_TAB_HIDDEN) expect(shipping, '쇼핑 탭이 숨겨졌는데 배송 질문이 FAQ 에 뜬다').toEqual([])
    // 원본은 지우지 않았다 — 쇼핑이 돌아오면 플래그 하나로 복귀한다.
    expect(CONCEPT_FAQ_ALL.filter((f) => SHOPPING_ONLY_FAQ_KEYS.has(f.key))).toHaveLength(4)
  })
})

describe('⑤ 지도 피커 — 개발자 원인 문장을 화면에 그리지 않는다', () => {
  it('{sdkError} 를 렌더하지 않는다', () => {
    expect(readCode('src/components/KakaoMapPicker.tsx')).not.toContain('{sdkError}')
  })
})

describe('⑥ 마이 하위 화면 머리줄 한 벌', () => {
  /**
   * 🗺️ 2026-10-19 (2차 — 대표 *"응 다 이상적으로 진행해줘 모두"*): 손으로 적은 네 화면 → **마이의 줄 목록에서 파생**.
   *   첫 판은 네 화면만 적어서, 같은 마이에서 들어가는 주문·딜 내역·단골·교환권·알림·FAQ 가 각자 다른
   *   머리줄을 그린 채 초록이었다. 이제 '내가 산 것' 목록의 모든 목적지가 아래 표나 예외에 있어야 한다 —
   *   줄을 하나 더하면서 표에 안 넣으면 빨간불이다(조용히 다른 머리줄로 새는 길을 막는다).
   */
  const ROUTE_FILE: Record<string, string> = {
    '/my-gifticons': 'src/pages/MyGifticonsPage.tsx',
    '/my-coupons': 'src/pages/MyCouponsPage.tsx',
    '/my-stays': 'src/pages/MyStaysPage.tsx',
    '/wishlist': 'src/pages/WishlistPage.tsx',
    '/my/follows': 'src/pages/MyFollowsPage.tsx',
    '/my-orders': 'src/pages/MyOrdersPage.tsx',
    '/my-reviews': 'src/pages/MyReviewsPage.tsx',
    '/life/requests': 'src/pages/life/LifeMyRequestsPage.tsx',
  }
  /** 목록 밖에서 마이가 보내는 화면(숫자 줄의 딜 · 맨 아래 FAQ · 알림 · 탈퇴). */
  const EXTRA = [
    'src/pages/MyDealHistoryPage.tsx',
    'src/pages/FAQPage.tsx',
    'src/pages/NotificationsPage.tsx',
    'src/pages/AccountDeleteWarningPage.tsx',
  ]
  /** 일부러 공용 머리줄을 안 쓰는 목적지와 그 이유. */
  const EXEMPT: Record<string, string> = {
    '/my-vouchers': '하단 탭의 뿌리 화면 — 뒤로 버튼이 없는 것이 맞다',
    '/interest-list': '쇼핑 탭이 숨겨진 동안 마이에 안 뜬다(SHOPPING_TAB_HIDDEN)',
    '/mypage/addresses': '쇼핑 탭이 숨겨진 동안 마이에 안 뜬다(SHOPPING_TAB_HIDDEN)',
  }
  const PAGES = [...Object.values(ROUTE_FILE), ...EXTRA]

  it("'내가 산 것' 목록의 모든 목적지가 표나 예외에 있다", () => {
    const shop = readCode('src/pages/user-profile/ShoppingGroup.tsx')
    const paths = [...shop.matchAll(/path: '([^']+)'/g)].map((m) => m[1])
    expect(paths.length, '목록 줄을 못 읽었다 — 이 검사가 헛돌고 있다').toBeGreaterThan(5)
    for (const p of paths) expect(ROUTE_FILE[p] ?? EXEMPT[p], `${p} 가 머리줄 표에 없다`).toBeTruthy()
  })

  it.each(PAGES)('%s 는 SubPageHeader 를 쓰고 자기 머리줄을 그리지 않는다', (p) => {
    const c = readCode(p)
    expect(c).toMatch(/<SubPageHeader\b/)
    expect(c, '자기 뒤로 버튼(‹·←)을 따로 그린다').not.toMatch(/\b(ChevronLeft|ArrowLeft)\b/)
    expect(c, '큰 제목 머리줄(LargeTitle)이 공용 머리줄과 함께 선다').not.toMatch(/<LargeTitle\b/)
    expect(c, '지갑 머리줄이 자기 뒤로 버튼을 그린다').not.toMatch(/<WalletHeader[^>]*onBack=/)
  })

  it('쿠폰함 빈 화면이 같은 말을 두 번 하지 않는다', () => {
    const { empty, emptySub } = ko.myCoupons as { empty: string; emptySub: string }
    expect(empty.includes('쿠폰이 없') && emptySub.includes('쿠폰이 없'), '제목과 설명이 둘 다 "쿠폰이 없다" 고 말한다').toBe(false)
  })

  it('마이의 줄 이름과 들어간 화면의 제목이 같다', () => {
    expect(ko.myReviews.title).toBe(ko.userProfile.myReviews)
    expect(ko.wishlist.title).toBe(ko.shopping.wishlist)
    expect(ko.myCoupons.title).toBe(ko.shopping.coupons)
  })
})
