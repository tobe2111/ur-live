/** 🧬 주입 — PC 홈 서버 첫 화면의 두 벌이 갈리거나 배선이 빠지면 가드가 잡는가. 가드: src/tests/unit/pc-home-first-screen-2026-11-09.test.tsx */
const T = 'src/tests/unit/pc-home-first-screen-2026-11-09.test.tsx'
export default [
  {
    name: '🖥️ PC 홈 첫 화면 배선을 뺀다(첫 글자 2.25초로 회귀)',
    file: 'src/worker/index.ts',
    find: "else if (ssrSlot === 'MAIN' && isMainPage && !url.search && homeBannersPayload && !shouldRenderMobileFirstScreen(c.req.header('user-agent'))) {",
    replace: "else if (false && homeBannersPayload) {",
    test: T,
    why: 'PC 홈은 다시 로더뿐이 된다 — 2026-11-09 실측 first-paint 1.5초·첫 글자 2.25초.',
  },
  {
    name: '🖥️ 큰 배너 사진 폭이 카드와 갈린다(preload 가 버려지고 마운트 때 다시 받는다)',
    file: 'src/worker/utils/pc-home-first-screen.ts',
    find: 'const src = b.image_url ? cfImage(b.image_url, big ? PC_HERO_IMG.big : PC_HERO_IMG.small) : \'\'',
    replace: 'const src = b.image_url ? cfImage(b.image_url, big ? { width: 640, quality: 76 } : PC_HERO_IMG.small) : \'\'',
    test: T,
    why: '(cfImage 는 폭을 버킷으로 올리므로 1280 은 1100 과 같은 주소다 — 다른 버킷 640 으로 주입) 2026-09-02 히어로에서 실측한 클래스 — 주소가 한 글자라도 다르면 브라우저가 preload 를 버리고 같은 사진을 두 번 받는다.',
  },
  {
    name: '🖥️ 화면이 공용 상수 대신 자기 클래스를 적는다(두 벌이 갈리기 시작한다)',
    file: 'src/pages/pc-home/PcHeroBanners.tsx',
    find: 'className={`${F.sectionBase} ${side.length ? F.sectionCols2 : F.sectionCols1}`}',
    replace: 'className={`grid gap-4 h-[clamp(240px,24vw,340px)] ${side.length ? F.sectionCols2 : F.sectionCols1}`}',
    test: T,
    why: '워커는 React 를 못 돌려 마크업이 두 벌이다 — 한 토큰이 갈리면 마운트 때 배너 자리가 튄다(에러 0).',
  },
  {
    name: '🖥️ 네비 높이 예약을 뺀다(마운트 때 배너가 114px 내려간다)',
    file: 'src/worker/utils/pc-home-first-screen.ts',
    find: '`<div class="${F.topnav}"><div class="${F.topnavRow1}">${navRow1}</div><div class="${F.topnavRow2}">${navRow2}</div></div>` +',
    replace: '',
    test: T,
    why: 'DesktopTopNav 는 첫 렌더에 68+1+44 를 차지한다 — 서버가 그 자리를 비워 두지 않으면 배너가 그만큼 민다.',
  },
]
