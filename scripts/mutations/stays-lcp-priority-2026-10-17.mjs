const TEST = 'src/tests/unit/stays-lcp-priority-2026-10-17.test.tsx'
export default [
  {
    name: '⚡ 숙소 목록 첫 줄 첫 장이 다시 lazy',
    file: 'src/pages/stays/StayCurations.tsx',
    find: 'aboveFold={firstAboveFold && i === 0}',
    replace: 'aboveFold={false}',
    test: TEST,
    why: '사진 15장이 같은 순간에 출발해 맨 위 사진(LCP)이 ~5초로 돌아간다',
  },
  {
    name: '⚡ 숙소 목록 모든 장을 eager 로',
    file: 'src/pages/stays/StayCurations.tsx',
    find: 'aboveFold={firstAboveFold && i === 0}',
    replace: 'aboveFold={firstAboveFold}',
    test: TEST,
    why: '전부 high 면 우선순위가 무의미하고 화면 밖 사진까지 즉시 받는다',
  },
]
