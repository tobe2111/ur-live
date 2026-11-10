/** 🧬 주입 — 상세 갤러리 PC 에선 폰 슬라이드 미렌더 (2026-11-09) */
const T = 'src/tests/unit/detail-gallery-pc-no-mobile-img-2026-11-09.test.tsx'
const F = 'src/pages/group-buy/DetailGallery.tsx'
export default [
  { name: '🖥️ 갤러리 — PC 에서도 폰 슬라이드를 렌더한다(숨은 <img> 다운로드)', file: F, find: "      {!isDesktop && (\n      <div className={`relative lg:hidden overflow-hidden`}>", replace: "      {true && (\n      <div className={`relative lg:hidden overflow-hidden`}>", test: T, why: 'PC 상세마다 폰 히어로(960 폭) 수백 KB 를 숨은 채 또 받는다(라이브 실측).' },
  { name: '🖥️ 갤러리 — PC 에서도 폰 썸네일 줄을 렌더한다', file: F, find: '      {!isDesktop && showMobileThumbs(images.length) && (', replace: '      {showMobileThumbs(images.length) && (', test: T, why: '숨은 줄이 DOM 에 남아 PC 가 폰 DOM 을 두 벌 든다.' },
]
