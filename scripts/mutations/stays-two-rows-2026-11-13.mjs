/** 🧬 주입 — 숙소 목록 서버 첫 화면 두 줄. 가드: src/tests/unit/stays-first-screen-2026-10-19.test.ts */
export default [
  { name: '숙소두줄 — 서버가 다시 첫 줄만 그린다', file: 'src/worker/utils/stays-first-screen.ts', find: 'export const STAYS_FS_ROWS = 2', replace: 'export const STAYS_FS_ROWS = 1', test: 'src/tests/unit/stays-first-screen-2026-10-19.test.ts', why: '2026-11-13 PC 둘째 줄 사진(LCP)을 앱이 켜진 뒤에야 받았다(LCP 2.3~2.7s).' },
  { name: '숙소두줄 — 둘째 줄 첫 장까지 eager', file: 'src/worker/utils/stays-first-screen.ts', find: '}, ri === 0 && i === 0, stayCardHref(', replace: '}, i === 0, stayCardHref(', test: 'src/tests/unit/stays-first-screen-2026-10-19.test.ts', why: '폰에선 둘째 줄이 화면 밖 — eager 면 맨 위 사진과 회선을 나눈다(10-17 실측 ~5초).' },
]
