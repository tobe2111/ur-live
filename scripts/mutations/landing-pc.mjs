/**
 * 🧬 형제 랜딩 PC 판(`/about` · `/creators`) — 되돌려-검증 주입 (2026-09-16).
 *
 * 지키는 규칙 다섯은 `src/tests/unit/landing-pc-2026-09-16.test.ts` 머리말에 있다.
 * 여기서 확인하는 것은 **그 테스트가 실제로 실패할 수 있는가** 다.
 */
const T = 'src/tests/unit/landing-pc-2026-09-16.test.ts'

export default [
  {
    name: '🧭 /about 이 다시 430px 소비자 액자에 갇힌다',
    file: 'src/components/MobileAppLayout.tsx',
    find: `  '/about', '/creators',\n`,
    replace: `  '/creators',\n`,
    test: T,
    why:
      '에러가 나지 않고 "모바일 최적화" 처럼 보인다. 빈 거터를 ConsumerFrameRails(소비자 앱 ' +
      '바로가기 + 설치 QR)가 채우므로, 서비스를 알아보러 온 제휴처 화면의 좌우가 앱 광고가 된다.',
  },
  {
    name: '🧭 /creators 가 다시 430px 소비자 액자에 갇힌다',
    file: 'src/components/MobileAppLayout.tsx',
    find: `  '/about', '/creators',\n`,
    replace: `  '/about',\n`,
    test: T,
    why: '위와 같은 사고가 모집 랜딩에서 난다. 소개로 돈을 벌러 온 사람에게 앱 설치 QR 을 보여 준다.',
  },
  {
    name: '🧭 /about 본문이 다시 576px 로 조여진다 (넓어진 모바일)',
    file: 'src/pages/AboutServicePage.tsx',
    find: `      <main className="pb-24 lg:pb-0">`,
    replace: `      <main className="pb-24 lg:pb-0 max-w-xl mx-auto">`,
    test: T,
    why:
      '액자를 풀어도 본문이 폰 폭이면 PC 판이 아니다. 대표가 `/partners` 1차를 보고 한 말이 ' +
      '정확히 그것이다 — *"PC 버전은 전혀 PC 버전 같지 않은데?"*',
  },
  {
    name: '🧭 /about 제목이 PC 에서 폰 크기 그대로 남는다',
    file: 'src/pages/AboutServicePage.tsx',
    find: `text-[30px] sm:text-[38px] lg:text-[46px] xl:text-[52px]`,
    replace: `text-[30px] sm:text-[38px]`,
    test: T,
    why:
      '대표가 `/partners` 1차를 보고 지적한 것이 정확히 이것이다 — 1440 에서도 제목이 폰 크기라 ' +
      '"넓어진 모바일" 로 보였다. 단계가 통째로 빠져도 에러가 안 나고 레이아웃도 안 깨진다.',
  },
  {
    name: '🧭 /creators 모바일 고정 바가 PC 본문 위에 남는다',
    file: 'src/pages/CreatorsPage.tsx',
    find: `      <div className="lg:hidden fixed bottom-0`,
    replace: `      <div className="fixed bottom-0`,
    test: T,
    why: 'PC 에서 화면 하단을 가로지르는 폰 바가 본문을 덮는다. 상단 헤더 CTA 와 중복이기도 하다.',
  },
  {
    name: '🧭 /creators 가 아직 없는 기능을 그림으로 약속한다',
    file: 'src/pages/CreatorsPage.tsx',
    find: `                caption="매장이 보낸 제안 (예시 데이터로 렌더한 실제 화면)"`,
    replace: `                caption="실시간 적립 알림 (화면 준비 중)"`,
    test: T,
    why:
      '이전 판이 정확히 그 칸을 갖고 있었다. 모집 랜딩 한복판의 공사중 팻말은 신청을 막고, ' +
      '없는 장치를 약속하면 1기 파트너가 들어와서 그것부터 찾는다.',
  },
  {
    name: '🧭 다크 대비 가드가 두 랜딩을 그만 돈다',
    file: 'scripts/check-dark-contrast.mjs',
    find: `  { route: '/creators', name: '소개 파트너 모집(PC)', pc: true, fill: true },\n`,
    replace: ``,
    test: T,
    why:
      '경로 목록이 곧 이 가드의 범위다. 2026-09-16 에 `/partners` 가 목록에 없어서 다크에서 ' +
      '제목이 통째로 안 보이는 채 배포됐다 — 같은 토큰을 쓰는 형제 둘이 같은 길에 있다.',
  },
  {
    name: '🗑️ 지운 /business 랜딩이 sitemap 에 되살아난다',
    file: 'src/worker/routes/sitemap.routes.ts',
    find: `    { loc: '/partners', priority: 0.7, changefreq: 'weekly' },`,
    replace: `    { loc: '/partners', priority: 0.7, changefreq: 'weekly' },\n    { loc: '/business', priority: 0.75, changefreq: 'weekly' },`,
    test: T,
    why:
      '페이지는 지웠고 URL 만 301 로 살렸다. sitemap 이 그 URL 을 다시 제출하면 크롤러가 ' +
      '리다이렉트를 색인 대상으로 받아 크롤 예산을 태운다(죽은 URL 제출 = 사이트맵 신뢰도 하락).',
  },
]
