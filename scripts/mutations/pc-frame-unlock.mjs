/**
 * 🧬 PC 액자 해제 3묶음 — 되돌려-검증 주입 (2026-09-21).
 *
 * 지키는 계약은 `src/tests/unit/pc-frame-unlock-2026-09-21.test.ts` 머리말에 있다.
 * 여기서 확인하는 것은 **그 테스트가 실제로 실패할 수 있는가** 다.
 */
const T = 'src/tests/unit/pc-frame-unlock-2026-09-21.test.ts'

export default [
  {
    name: '🖥️ 정책·약관이 다시 430px 액자로 (A 묶음 소실)',
    file: 'src/shared/pc-fullbleed.ts',
    find: `  '/terms', '/privacy', '/refund', '/faq', '/gdpr',`,
    replace: ``,
    test: T,
    why:
      '푸터(풀너비)가 링크하는 긴 법률 문서를 PC 에서 430px 한 칸으로 읽게 된다. 에러가 안 나고 ' +
      '"모바일 최적화" 처럼 보여서 아무도 신고하지 않는다.',
  },
  {
    name: '🖥️ 사장님·파트너 유입이 다시 소비자 앱 액자로 (B 묶음 소실)',
    file: 'src/shared/pc-fullbleed.ts',
    find: `  '/partnership', '/store/new', '/store/find', '/host', '/host/new', '/my-store',`,
    replace: ``,
    test: T,
    why:
      '입점을 검토하러 온 사장님 화면의 좌우가 다시 ConsumerFrameRails(소비자 앱 바로가기 + 설치 QR)가 ' +
      '된다. /partners·/about·/creators 에서 2026-09-16 에 고친 바로 그 사고다.',
  },
  {
    name: '🖥️ `/influencer` 를 접두사로 바꿔 도구 화면까지 벗긴다',
    file: 'src/shared/pc-fullbleed.ts',
    find: `  '/area-report/',`,
    replace: `  '/area-report/',\n  '/influencer/',`,
    test: T,
    why:
      '대표가 고른 것은 랜딩과 랭킹 둘뿐인데 접두사로 만들면 `/influencer/dashboard`·`/settlement`· ' +
      '`/analytics`·`/discover` 넷이 함께 벗겨진다 — 전부 폰 폭으로 만든 도구 화면이다.',
  },
  {
    name: '🖥️ `/referral/` 를 접두사로 넣어 추천인 착지 CTA 를 지운다',
    file: 'src/shared/pc-fullbleed.ts',
    find: `  '/area-report/',`,
    replace: `  '/area-report/',\n  '/referral/',`,
    test: 'src/tests/unit/groupon-detail-map.test.ts',
    why:
      '대표가 푼 것은 목록 페이지 `/referral`(ReferralIndexPage) 하나인데 접두사로 만들면 ' +
      '`/referral/:code`(ReferralPage)까지 벗겨진다 — 그 페이지 하단 CTA 는 `app-frame-bar` 라 ' +
      '`body.pc-fullbleed` 에서 **버튼이 통째로 사라진다**(에러 0).',
  },
  {
    name: '🖥️ 약관 하위 3종이 접두사 소실로 액자에 남는다',
    file: 'src/shared/pc-fullbleed.ts',
    find: `  '/terms/',`,
    replace: ``,
    test: T,
    why:
      '`/terms` 만 풀리고 정작 푸터가 직접 링크하는 `/terms/seller` 는 액자에 남는다. ' +
      '목록 한 줄 차이라 리뷰에서 가장 놓치기 쉽다.',
  },
  {
    name: '🖥️ 동네공구 제안의 제출 버튼이 PC 에서 사라진다 (app-frame-bar 복귀)',
    file: 'src/pages/UserGroupBuyCreatePage.tsx',
    find: `<div className="fixed bottom-0 left-0 right-0 bg-white`,
    replace: `<div className="fixed bottom-0 left-0 right-0 xl:left-56 app-frame-bar bg-white`,
    test: T,
    why:
      '`body.pc-fullbleed .app-frame-bar { display: none !important }` 에 걸려 **버튼이 통째로 ' +
      '사라진다**. 콘솔 에러 0, 레이아웃 경고 0 — 폼을 다 채우고 제출할 수가 없다.',
  },
  {
    name: '🖥️ 동네공구 CTA 가 폭 토큰을 잃는다 (1440px 짜리 버튼)',
    file: 'src/pages/UserGroupBuyCreatePage.tsx',
    find: `          <div className="ur-content-narrow">`,
    replace: `          <div>`,
    test: T,
    why: '풀너비에서 제출 버튼이 화면 끝에서 끝까지 늘어난다.',
  },
  {
    name: '🖥️ 공구 마켓 본문이 폭 제약을 잃는다 (넓어진 모바일)',
    file: 'src/pages/GbMarketplacePage.tsx',
    find: `<div className="ur-content-wide px-4 pt-4">`,
    replace: `<div className="px-4 pt-4">`,
    test: T,
    why: '액자를 벗겨 놓고 본문만 제약이 없으면 1440px 로 퍼진다 — 고친 것이 오히려 이상해 보인다.',
  },
]
