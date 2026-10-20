const FILE = 'src/worker/utils/css-first-boot.ts'
const TEST = 'src/tests/unit/css-first-boot-2026-10-12.test.ts'
export default [
  {
    name: '🚦 교환권 목록이 CSS 먼저 목록에서 다시 빠진다',
    file: FILE,
    find: "return pathname === '/' || pathname === '/vouchers'",
    replace: "return pathname === '/'",
    test: TEST,
    why: '서버가 그린 교환권 첫 화면이 JS 와 회선을 나눈 앱 CSS 를 기다려 첫 그림이 ~2.4초 늦어진다',
  },
  {
    name: '🚦 숙소 상세가 CSS 먼저 목록에서 다시 빠진다',
    file: FILE,
    find: '(?:pass|group-buy|vouchers|stays)',
    replace: '(?:pass|group-buy|vouchers)',
    test: TEST,
    why: '숙소 상세 첫 그림이 ~2.3초 늦어진다',
  },
]
