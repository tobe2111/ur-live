import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isFullBleedPcPath } from '@/shared/pc-fullbleed'
import { stripComments } from '../helpers/source-text'

/**
 * 🖥️ PC 액자 해제 3묶음 — 되돌려-검증 가능한 계약 (2026-09-21).
 *
 * 대표 확정(액자 전수조사 후 "A·B·C 전부"). 1440px 실측에서 **25곳**이 430px 액자였고,
 * 셋으로 갈라 올려 셋 다 승인됐다(24곳 + 이미 처리한 `/region`).
 *
 * ⚠️ **액자가 폐기된 게 아니다.** 2026-06-20 확정 "PC 소비자 = 중앙 액자"는 그대로다.
 * 그래서 이 테스트의 절반은 **풀리면 안 되는 것이 안 풀렸는지**를 본다(②) — 접두사 하나를
 * 잘못 줄이면 폰 폭으로 만든 도구 화면까지 통째로 벗겨진다.
 *
 * 🩸 이 작업에서 하네스가 **두 번** 엉뚱한 것을 쟀다. 다음 세션이 같은 함정을 밟지 않도록 적어 둔다:
 *   ① 보호 라우트 8곳이 "액자"로 보였는데 실제로는 `/login?returnUrl=…` 로 튕긴 **로그인 화면**을
 *      재고 있었다 → `location.pathname` 을 함께 찍어야 구분된다.
 *   ② `/terms`·`/privacy`·`/refund` 는 `dist/client/terms.html` 같은 **정적 파일**이 있어서
 *      로컬 정적 서버가 SPA 대신 그 파일을 내줬다 → SPA 안에서 라우터로 이동시켜야 한다.
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 실제 픽셀. jsdom 엔 레이아웃이 없다. "1440px 로 펼쳐졌는가"는
 *    브라우저 실측이 판정했다(전: 액자·본문 430·레일 1 / 후: 액자 없음·fullbleed·레일 0).
 */

const visible = (p: string) => stripComments(readFileSync(p, 'utf8'))

/** A. 정책·약관 — 푸터(풀너비)가 링크하는 긴 문서. */
const GROUP_A = ['/terms', '/terms/seller', '/terms/group-buy', '/terms/influencer', '/privacy', '/refund', '/faq', '/gdpr']
/** B. 사장님·파트너 유입 — `/partners`·`/about`·`/creators` 와 같은 클래스. */
const GROUP_B = ['/partnership', '/store/new', '/store/find', '/host', '/host/new', '/my-store', '/influencer', '/influencer/rankings']
/** C. 소비자 탐색 — 대표가 설명을 듣고도 포함을 택했다. */
const GROUP_C = ['/experience', '/new-openings', '/gb-market', '/area-report', '/area-report/강남구', '/interest-list', '/following', '/community-group-buy/new', '/referral']

describe('① 승인된 3묶음이 전부 PC 풀너비', () => {
  it.each([...GROUP_A, ...GROUP_B, ...GROUP_C].map(p => [p]))('%s', (path) => {
    expect(isFullBleedPcPath(path)).toBe(true)
  })
})

describe('② 액자에 남아야 하는 이웃을 접두사가 삼키지 않는다', () => {
  it.each([
    // 폰 폭으로 만든 소개 파트너 도구 화면 넷 — 대표가 고른 것은 랜딩과 랭킹 둘뿐이다.
    ['/influencer/dashboard'],
    ['/influencer/settlement'],
    ['/influencer/analytics'],
    ['/influencer/discover'],
    // 추천인 착지 페이지는 `/referral` 과 다른 컴포넌트(ReferralPage).
    ['/referral/ABC123'],
    // 마이 계열 — 이번 범위 밖.
    ['/my-coupons'],
    ['/mypage'],
    ['/mypage/addresses'],
    // 유어샵 도구(2026-09-02 결정) — 여기 접두사가 새로 삼키면 안 된다.
    ['/u/me/add'],
    ['/u/me/earnings'],
    // 가입/약관과 글자가 겹치는 경로들.
    ['/register'],
    ['/terms-of-service'],
  ])('%s 는 액자 그대로', (path) => {
    expect(isFullBleedPcPath(path)).toBe(false)
  })
})

describe('③ 풀너비로 풀었을 때 깨지던 두 곳', () => {
  const CGB = 'src/pages/UserGroupBuyCreatePage.tsx'

  it('동네공구 제안의 하단 CTA 가 app-frame-bar 를 쓰지 않는다', () => {
    // `body.pc-fullbleed .app-frame-bar { display: none !important }` (index.css) 에 걸리면
    // **제출 버튼이 통째로 사라진다**. 에러는 0이고 버튼만 없다.
    expect(visible(CGB)).not.toContain('app-frame-bar')
  })

  it('그 CTA 가 사이드바 보정(xl:left-56)을 들고 있지 않다', () => {
    // 풀너비에는 좌측 사이드바가 없다 — 남겨 두면 바가 224px 어긋난다.
    const bar = visible(CGB).match(/className="fixed bottom-0[^"]*"/)?.[0] ?? ''
    expect(bar).not.toContain('xl:left-56')
  })

  it('그 CTA 안쪽이 폭 토큰으로 묶여 있다', () => {
    const s = visible(CGB)
    const at = s.indexOf('fixed bottom-0')
    expect(at).toBeGreaterThan(-1)
    expect(s.slice(at, at + 400)).toContain('ur-content-narrow')
  })

  it('공구 마켓의 본문 컨테이너가 폭 토큰을 갖는다', () => {
    // 🩸 첫 판은 `toContain('ur-content-wide')` 였는데, 그 토큰을 헤더에도 넣어 둔 탓에
    //    **본문에서 지워도 초록**이었다(주입 러너가 잡았다). 본문 컨테이너로 앵커를 옮긴다.
    //    없으면 1440px 로 퍼져 "넓어진 모바일" 이 된다.
    expect(visible('src/pages/GbMarketplacePage.tsx')).toContain('ur-content-wide px-4 pt-4')
  })
})

describe('④ 배선 — 판정은 SSOT 한 곳', () => {
  it('세 묶음이 pc-fullbleed 목록에 있다', () => {
    const s = visible('src/shared/pc-fullbleed.ts')
    for (const p of ['/faq', '/gdpr', '/partnership', '/my-store', '/gb-market', '/following']) {
      expect(s).toContain(`'${p}'`)
    }
    expect(s).toMatch(/FULLBLEED_PC_PREFIXES[\s\S]{0,400}?'\/terms\/'/)
    expect(s).toMatch(/FULLBLEED_PC_PREFIXES[\s\S]{0,400}?'\/area-report\/'/)
  })

  it('`/influencer` 가 접두사로 들어가 있지 않다', () => {
    // 접두사가 되면 도구 화면 넷이 함께 벗겨진다(②가 잡지만, 의도를 소스에도 고정한다).
    const s = visible('src/shared/pc-fullbleed.ts')
    expect(s).not.toMatch(/FULLBLEED_PC_PREFIXES[\s\S]{0,400}?'\/influencer\/'/)
  })
})
