/** 🧬 주입 — 폰 피드 줄의 화면 밖 높이 추정. 가드: src/tests/unit/progressive-cap-2026-10-13.test.tsx */
const T = 'src/tests/unit/progressive-cap-2026-10-13.test.tsx'
export default [
  { name: '📋 피드줄 — 폰 줄 목록이 다시 카드 높이(260)로 추정된다', file: 'src/pages/main-home/GroupBuyFeed.tsx', find: "ur-cv-grid${pc ? '' : ' ur-cv-feedrow'}`}>\n          {/* 🛡️ 2026-05-24", replace: "ur-cv-grid`}>\n          {/* 🛡️ 2026-05-24", test: T, why: '새로 그려진 줄이 한 프레임 260 → 141 로 줄며 아래가 올라온다(라이브 CLS 0.17).' },
  { name: '📋 피드줄 — 줄 추정 높이 규칙이 사라진다', file: 'src/index.css', find: ".ur-cv-grid.ur-cv-feedrow > * {\n  contain-intrinsic-size: auto 141px;", replace: ".ur-cv-grid.ur-cv-feedrow > * {\n  contain-intrinsic-size: auto 260px;", test: T, why: '클래스는 붙어도 값이 카드 높이면 같은 밀림이다.' },
]
