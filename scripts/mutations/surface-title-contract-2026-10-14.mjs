/**
 * 🧬 2026-10-14 — 소비자 표면 제목의 계약(접미사는 `withSiteName` 한 곳 · 페이지는 표를 읽는다).
 *
 * 근거는 `src/tests/unit/surface-title-contract-2026-10-14.test.ts` 머리말(라이브 실측:
 * `/gdpr` 브랜드 2회 · 홈이 크롤러에 따라 다른 제목을 냈다).
 *
 * 🔀 절반은 **반대 방향**이다 — 계약을 "제목에 브랜드 금지" 로 조이면 일부러 브랜드로 시작하는
 *   제목 여덟이 깨지고, 스캐너가 0건을 돌려주면 ④가 무조건 통과한다.
 */
const TABLE = 'src/shared/seo/consumer-surface-table.ts' // 🗂️ 2026-11-01 표 분리(불변식 불변 — 대상 파일만 옮겨갔다)
const HOME_M = 'src/pages/mobile-home/MobileHomePage.tsx'
const ABOUT = 'src/pages/AboutServicePage.tsx'
const TEST = 'src/tests/unit/surface-title-contract-2026-10-14.test.ts'

export default [
  {
    name: '🏷️ 제목계약 — /gdpr 이 다시 접미사를 박는다 (브랜드 2회)',
    file: TABLE,
    find: "    title: 'Privacy Policy (GDPR)',",
    replace: "    title: 'Privacy Policy (GDPR) - YourDeal',",
    test: TEST,
    why:
      '`withSiteName` 은 `유어딜` 만 보므로 영문 표기를 중복으로 못 센다 — 라이브 `<title>` 이 ' +
      '`Privacy Policy (GDPR) - YourDeal - 유어딜`(38자, 브랜드 2회)이던 실측 그 자리다.',
  },
  {
    name: '🏷️ 제목계약 — /partnership 이 다시 접미사를 박는다 (증상 없는 같은 모양)',
    file: TABLE,
    find: "    title: '광고/제휴 문의',",
    replace: "    title: '광고/제휴 문의 - 유어딜',",
    test: TEST,
    why:
      '렌더 결과는 같아서 **증상이 없다** — 그래서 더 위험하다. `/gdpr` 이 정확히 이 모양에서 ' +
      '터졌고, 접미사를 박아 두면 토큰을 못 알아보는 순간 조용히 두 번 붙는다.',
  },
  {
    name: '🏷️ 제목계약 — 모바일 홈이 제목을 다시 손으로 적는다 (한 URL 두 제목)',
    file: HOME_M,
    find: "        title={CONSUMER_SURFACE_SEO['/'].title}",
    replace: '        title="유어딜 — 동네 이용권·공동구매·교환권을 할인가로"',
    test: TEST,
    why:
      '`<SEO>` 는 react-helmet(JS 렌더 후)이라 **Googlebot 은 이 값을, 네이버 Yeti 는 서버가 주입한 ' +
      '표의 값을** 본다 — 실측에서 두 값이 달랐다(em-dash 까지). 한 URL 에 두 제목이고 에러는 0이다.',
  },
  {
    name: '🏷️ 제목계약 — /about 이 표와 다른 제목을 손으로 적는다',
    file: ABOUT,
    find: "      <SEO title={CONSUMER_SURFACE_SEO['/about'].title}",
    replace: '      <SEO title="서비스 소개 - 유어딜"',
    test: TEST,
    why:
      '표는 `서비스 소개 - 유어딜은 이렇게 작동합니다` 인데 화면은 `서비스 소개 - 유어딜` 이었다 — ' +
      '같은 URL 이 크롤러에 따라 다른 제목을 내던 두 번째 자리.',
  },
  {
    name: '🔁 제목계약 반대 방향 — 판정식이 아무것도 안 잡는다',
    file: TEST,
    find: "const BRAND_SUFFIX = /[-|·–—]\\s*(유어딜|YourDeal|UrDeal|urdeal)\\s*$/",
    replace: "const BRAND_SUFFIX = /__절대_안_맞는_패턴__/",
    test: TEST,
    why:
      '발화하지 않는 정규식으로 "0건" 을 선언하는 것이 이 레포의 단골 사고다 — ①의 자기검사가 ' +
      '그 정규식이 실제로 맞는지·안 맞아야 할 것은 안 맞는지를 양방향으로 잰다.',
  },
  {
    name: '🔁 제목계약 반대 방향 — 계약을 "제목에 브랜드 금지" 로 과조임',
    file: TEST,
    find: "const BRAND_SUFFIX = /[-|·–—]\\s*(유어딜|YourDeal|UrDeal|urdeal)\\s*$/",
    replace: "const BRAND_SUFFIX = /(유어딜|YourDeal|UrDeal|urdeal)/",
    test: TEST,
    why:
      '브랜드가 **앞**에 오는 제목 여덟(`유어딜 이용약관`·`유어딜 시작하기` …)은 **의도**다. ' +
      '접미사만 금지해야 하고, ⑤가 그 과조임 방향을 막는다.',
  },
  {
    name: '🔁 제목계약 반대 방향 — 리터럴 스캐너가 0건을 돌려준다 (④가 무조건 통과)',
    file: TEST,
    find: '  const hits: Array<[string, string, string]> = []',
    replace: '  const hits: Array<[string, string, string]> = []\n  return hits',
    test: TEST,
    why:
      '④는 "리터럴이 없다" 를 단언하므로 **스캐너가 비면 그 단언이 사라진다**(실패가 아니라 부재). ' +
      '표 밖 경로의 리터럴 53건을 하한으로 세어 스캐너 생존을 함께 잰다.',
  },
  {
    // 🩸 첫 판은 `reads += 999` 였는데 **하한은 자기 입력을 부풀려서 깨뜨릴 수 없다**(통과한다).
    //   주입은 *재는 대상*을 없애야 한다 — 페이지에서 `<SEO>` 를 통째로 지운다.
    name: '🔁 제목계약 반대 방향 — 페이지가 <SEO> 를 잃는다 (제목이 사라져도 ④는 0건이라 통과)',
    file: 'src/pages/GDPRPage.tsx',
    find: "      <SEO title={CONSUMER_SURFACE_SEO['/gdpr'].title} description={CONSUMER_SURFACE_SEO['/gdpr'].description} url=\"/gdpr\" />",
    replace: '',
    test: TEST,
    why:
      '④는 "리터럴 제목이 없다" 를 단언하므로 **페이지가 `<SEO>` 를 통째로 잃어도 0건이라 통과**한다 ' +
      '(실패가 아니라 부재). ⑥이 표를 읽는 호출 수를 실측값으로 조여 그 경우를 잡는다.',
  },
]
