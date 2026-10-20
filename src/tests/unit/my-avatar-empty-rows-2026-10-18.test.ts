/**
 * 👤 2026-10-18 마이 점검(대표 *"마이페이지들 모두 가장 이상적이야? 막힌 기능도 없고?"*) — 하네스로 그려서 찾은 넷.
 *
 *   ① 사진이 없는 사람의 프로필 = 외부 `ui-avatars.com` → 요청 실패 시 **이름 왼쪽이 빈 칸**(폰·PC) + 이름이 외부로 나감
 *      ⇒ 우리 오리진의 유달이(유어샵과 같은 그림), 실패해도 숨기지 않고 유달이로
 *   ② PC 오른쪽 위 **빈 흰 카드** — 이용권을 한 장도 안 산 사람에게 껍데기만 남았다
 *   ③④ '관심 맛집'·'배송지 관리' — 쇼핑 탭이 숨겨진 동안은 들어가도 빈 화면이라 감춘다(쇼핑을 열면 저절로 돌아온다)
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - 유달이가 그 자리에서 보기 좋은지(렌더는 눈으로 — `node scripts/visual-preview.mjs --route=/user/profile --auth=user`)
 * - 라이브에서 실제 사진이 리사이즈되는지(cf-image 경로는 기존 가드 몫)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from '../helpers/source-text'
import { profileAvatarSrc, profileAvatarOnError, PROFILE_FALLBACK_SRC } from '@/pages/user-profile/profile-avatar'
import { SHARE_MASCOT_SRC } from '@/shared/ushop-share-card'

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== 'tests') walk(p, out) }
    else if (/\.(tsx?|mjs)$/.test(n)) out.push(p)
  }
  return out
}

describe('① 프로필 사진 폴백 = 유달이(외부 서비스 0)', () => {
  it('소스 어디에도 ui-avatars.com 이 없다(이름이 외부로 나가지 않는다)', () => {
    const files = walk('src')
    expect(files.length).toBeGreaterThan(500)
    const hits = files.filter((f) => stripComments(readFileSync(f, 'utf8')).includes('ui-avatars.com'))
    expect(hits).toEqual([])
  })
  it('사진이 없으면 우리 오리진의 유달이, 있으면 리사이즈 주소', () => {
    expect(PROFILE_FALLBACK_SRC).toBe(SHARE_MASCOT_SRC) // 유어샵과 같은 얼굴(두 벌이면 갈린다)
    expect(profileAvatarSrc(null, 128)).toBe(PROFILE_FALLBACK_SRC)
    expect(profileAvatarSrc('https://media.ur-team.com/u/1.webp', 128)).not.toBe(PROFILE_FALLBACK_SRC)
  })
  it('실패하면 원본 1회 → 그래도 실패하면 숨기지 않고 유달이(빈 칸 금지)', () => {
    const img = document.createElement('img')
    img.setAttribute('src', '/cdn-cgi/image/width=128/https://x.test/a.jpg')
    profileAvatarOnError(img, 'https://x.test/a.jpg')
    expect(img.getAttribute('src')).toBe('https://x.test/a.jpg')
    profileAvatarOnError(img, 'https://x.test/a.jpg')
    expect(img.getAttribute('src')).toBe(PROFILE_FALLBACK_SRC)
    expect(img.style.visibility).not.toBe('hidden')
    profileAvatarOnError(img, 'https://x.test/a.jpg') // 유달이까지 실패해도 무한 루프 없음
    expect(img.getAttribute('src')).toBe(PROFILE_FALLBACK_SRC)
  })
  it('세 자리(폰 머리 · PC 머리 · 프로필 편집)가 같은 함수를 쓴다', () => {
    for (const f of ['src/pages/UserProfilePage.tsx', 'src/pages/user-profile/AccountPcBand.tsx', 'src/pages/user-profile/profile-edit/ProfileEditSheet.tsx']) {
      const s = stripComments(readFileSync(f, 'utf8'))
      expect(s, f).toMatch(/profileAvatarSrc\(/)
      expect(s, f).toMatch(/onError=\{\(e\) => profileAvatarOnError\(/)
    }
  })
})

it('마이가 유어샵 공유 모듈을 끌어오지 않는다(첫 화면 무게 — surface-budgets dash:my)', () => {
  expect(stripComments(readFileSync('src/pages/user-profile/profile-avatar.ts', 'utf8'))).not.toMatch(/ushop-share-card/)
})

describe('② PC 오른쪽 위 빈 카드', () => {
  // 🔁 2026-10-19 재조준: 카드 안 '이용권 현황' 이 걷혀 내용이 '곧 쓸 이용권' 하나뿐이다 → 그 줄이 0 이면 접는다.
  it('곧 쓸 이용권이 0줄이면 카드째 접는다', () => {
    const s = stripComments(readFileSync('src/pages/user-profile/AccountPcPane.tsx', 'utf8'))
    expect(s).toMatch(/if \(soon\.length === 0\) return null/)
    // 접는 판정이 카드 렌더보다 앞에 있다
    expect(s.indexOf('if (soon.length === 0) return null')).toBeLessThan(s.indexOf('className="ur-pc-card"'))
  })
})

describe('③④ 쇼핑이 숨겨진 동안 빈 화면 두 줄을 감춘다', () => {
  const s = stripComments(readFileSync('src/pages/user-profile/ShoppingGroup.tsx', 'utf8'))
  it('관심 맛집 · 배송지 관리 줄은 SHOPPING_TAB_HIDDEN 뒤에만 있다', () => {
    expect(s).toMatch(/\.\.\.\(SHOPPING_TAB_HIDDEN \? \[\] : \[\{[^\]]*'\/interest-list' \}\]\)/)
    expect(s).toMatch(/\.\.\.\(SHOPPING_TAB_HIDDEN \? \[\] : \[\{[^\]]*'\/mypage\/addresses' \}\]\)/)
  })
  it('반대 방향 — 쓰이는 줄(이용권·교환권·쿠폰·숙소·찜·단골·리뷰)과 결제 내역 길은 조건 없이 그대로 있다', () => {
    for (const p of ['/my-vouchers', '/my-gifticons', '/my-coupons', '/my-stays', '/wishlist', '/my/follows', '/my-reviews']) {
      expect(s, p).toMatch(new RegExp(`^\\s*\\{ Icon: \\w+, label: [^\\n]*path: '${p.replace(/\//g, '\\/')}' \\},`, 'm'))
    }
    // 🧾 2026-10-20: '주문 내역' 은 줄이 아니라 구역 제목 오른쪽 '결제 내역 ›' 로 옮겼다 — 갈 길은 조건 없이 남는다.
    expect(s).toMatch(/<SectionTitle action=\{\{ label: [^\n]*onClick: \(\) => navigate\('\/my-orders'\) \}\}>/)
  })
})

describe('⑤⑥ 남은 작은 것 둘(2026-10-18 대표 "남은 작은 것 둘도 정리해줘")', () => {
  it('PC 마이 B — "가게 열기" 구역도 카드다(카드 클래스가 그 section 자신에 있다)', () => {
    const grid = stripComments(readFileSync('src/pages/user-profile/RoleCtaGrid.tsx', 'utf8'))
    expect(grid).toMatch(/<section className="[^"]*\bur-pc-card\b[^"]*">/)
    // 감싸는 div 를 되살려 카드가 한 겹 안쪽으로 들어가지 않게(폭이 다른 카드와 갈린다)
    const page = stripComments(readFileSync('src/pages/UserProfilePage.tsx', 'utf8'))
    expect(page).not.toMatch(/<div className="ur-content-medium lg:px-4">\s*<RoleCtaGrid \/>/)
  })
  it("주문 내역 '상품' 칸은 쇼핑 숨김 동안 감추되, 상품 주문이 있는 사람에겐 남긴다", () => {
    const s = stripComments(readFileSync('src/components/mypage/OrdersTab.tsx', 'utf8'))
    expect(s).toMatch(/\.\.\.\(SHOPPING_TAB_HIDDEN && counts\.product === 0 \? \[\] : \[\{ key: 'product'/)
  })
})
