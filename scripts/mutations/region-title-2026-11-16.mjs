/** 🧬 주입 — 지역 제목 검색어 (2026-11-16) · 가드: src/tests/unit/region-title-search-words-2026-11-16.test.ts */
const T = 'src/tests/unit/region-title-search-words-2026-11-16.test.ts'
export default [
  { name: 'regiontitle: 제목에서 맛집이 빠진다', file: 'src/shared/seo/region-title.ts',
    find: '  return `${label} 맛집·뷰티 할인 이용권`', replace: '  return `${label} 이용권·동네딜 할인`', test: T,
    why: "'서초 맛집 할인' 검색에 지역 페이지 제목이 안 맞는다." },
  { name: 'regiontitle: 클라 제목이 서버와 갈린다', file: 'src/pages/region/RegionPage.tsx',
    find: '  const title = `${regionTitleCore(label)} | 유어딜`', replace: '  const title = `${label} 이용권·동네딜 할인 | 유어딜`', test: T,
    why: '서버가 보낸 제목과 앱이 그린 제목이 달라 마운트 때 탭 제목이 바뀐다(검색엔진에 다른 신호).' },
]
