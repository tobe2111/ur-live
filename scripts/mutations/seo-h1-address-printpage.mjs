/**
 * 🔎 크롤러 문서의 제목 요소·매장 주소·인쇄판 색인 (2026-10-13).
 *
 * 가드: src/tests/unit/seo-h1-address-printpage-2026-10-13.test.ts
 */
const TEST = 'src/tests/unit/seo-h1-address-printpage-2026-10-13.test.ts'
const META = 'src/worker/utils/detail-ssr-meta.ts'

export default [
  {
    name: '🏠 홈 첫 화면에서 h1 을 뺀다 (크롤러가 다시 제목 요소 0개를 받는다)',
    file: 'src/worker/utils/home-first-screen.ts',
    find: '    `<h1 class="sr-only">${escText(HOME_H1)}</h1>` +',
    replace: '',
    test: TEST,
    why:
      '색인 대상 중 가장 권위 높은 페이지가 자기가 무엇인지 제목 요소로 말하지 않게 된다. ' +
      'PC 에는 h1 이 있지만 검색 크롤러는 모바일 첫 화면을 받으므로 그 h1 은 크롤러에 안 간다.',
  },
  {
    name: '🏠 React 쪽 h1 만 빼서 워커와 갈라놓는다',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: '      <h1 className="sr-only">{HOME_H1}</h1>',
    replace: '',
    test: TEST,
    why:
      '서버가 그린 h1 이 마운트와 함께 사라진다 — 크롤러에는 보이는데 실제 사용자(스크린리더)에겐 ' +
      '없는 상태가 된다. 두 쪽이 **같은 값을 같은 자리에** 그려야 한다.',
  },
  {
    name: '🏠 h1 을 보이게 만든다 (대표가 일부러 뺀 머리글이 되살아난다)',
    file: 'src/worker/utils/home-first-screen.ts',
    find: '<h1 class="sr-only">',
    replace: '<h1 class="text-[24px] font-black">',
    test: TEST,
    why:
      '2026-08-31 대표 지시로 **보이는** 머리글은 일부러 뺐다. 보이게 만들면 그 결정을 되돌리는 ' +
      '것이고, 박스가 생겨 2026-10-08 홈 첫 화면 잠금(박스 실측 일치)도 깨진다.',
  },
  {
    name: '🏠 h1 문구를 손으로 적는다 (SSOT 가 두 벌이 된다)',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: '<h1 className="sr-only">{HOME_H1}</h1>',
    replace: '<h1 className="sr-only">유어딜</h1>',
    test: TEST,
    why: '워커와 React 가 다른 제목을 그리면 마운트 때 제목이 바뀐다 — 에러는 안 난다.',
  },
  {
    name: '🏠 주소에서 시군구를 안 읽는다 (addressLocality 가 다시 0건)',
    file: META,
    find: '    ...(ref?.sigungu ? { addressLocality: ref.sigungu } : {}),',
    replace: '',
    test: TEST,
    why:
      '구글 LocalBusiness 가 권하는 필드이고 로컬 질의가 이 서비스의 본류다. ' +
      '재료(주소)와 도구(region-slugs 파서)가 둘 다 있는데 안 만나던 상태로 돌아간다.',
  },
  {
    name: '🏠 streetAddress 에서 앞머리를 떼어 낸다',
    file: META,
    find: '    streetAddress: addr,',
    replace: "    streetAddress: addr.split(/\\s+/).slice(2).join(' '),",
    test: TEST,
    why:
      '파싱이 어긋난 주소에서 길 이름이 잘려 나간다 — *덜 정확한 쪽*이 아니라 **틀린 주소**가 된다. ' +
      '시/도가 두 번 나오는 것은 구글이 허용한다.',
  },
  {
    name: '🏠 파싱 실패 시 시/도를 지어낸다',
    file: META,
    find: "  const region = ref?.sido || (sidoHint ? String(sidoHint) : '')",
    replace: "  const region = ref?.sido || (sidoHint ? String(sidoHint) : '서울')",
    test: TEST,
    why: '모르는 주소에 엉뚱한 지역을 붙인다 — 이 레포가 aggregateRating·Offer 에서 지키는 규율과 같다.',
  },
  {
    name: '📄 /about/print 를 다시 색인 대상으로 (같은 내용의 두 URL 이 경쟁)',
    file: 'src/shared/seo/consumer-surface-table.ts',
    find: "    title: '유어딜 서비스 소개서 (인쇄용)',\n    description: '유어딜 서비스 소개서의 인쇄·PDF 판입니다. 웹 소개는 /about 에 있습니다.',\n    noindex: true,",
    replace: "    title: '유어딜 서비스 소개서 (인쇄용)',\n    description: '유어딜 서비스 소개서의 인쇄·PDF 판입니다. 웹 소개는 /about 에 있습니다.',",
    test: TEST,
    why: '`/about`(295자)의 인쇄판이라 내용이 겹친다. 둘 다 색인되면 서로의 순위를 깎는다.',
  },
  {
    name: '📄 /about 본체까지 noindex 로 (반대 방향 — 조용히 색인에서 빠진다)',
    file: 'src/shared/seo/consumer-surface-table.ts',
    find: "  '/about': {",
    replace: "  '/about': {\n    noindex: true,",
    test: TEST,
    why:
      '인쇄판을 닫다가 본체까지 닫는 쪽이 훨씬 나쁘다 — 색인은 돌아오는 데 수주 걸리고 ' +
      '에러도 안 난다. 가드가 양방향을 봐야 한다.',
  },
]
