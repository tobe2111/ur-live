/**
 * 🧬 주입 — 모바일 홈 위치 제목이 두 줄로 무너지는 것 (2026-10-19 대표 신고)
 */
const T = 'src/tests/unit/home-title-location-row-2026-10-19.test.ts'
export default [
  {
    name: '홈위치제목 — 세로 쌓기를 panel 조건 없이 건다(#1878 회귀)',
    file: 'src/pages/pc-home/PcHomeLocationBar.tsx',
    find: ": tone === 'panel' ? 'flex flex-col gap-2' : 'flex items-center gap-2'}>",
    replace: ": 'flex flex-col gap-2'}>",
    test: T,
    why: '모바일 홈 제목이 "공..." 으로 잘리고 현 위치 버튼이 아래 줄로 떨어진다.',
  },
]
