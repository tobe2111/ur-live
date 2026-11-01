/** 🧬 주입 — 뒤로가기 때 고른 지역이 풀린다(2026-10-31). 가드: src/tests/unit/home-region-sticky-2026-10-31.test.ts */
const T = 'src/tests/unit/home-region-sticky-2026-10-31.test.ts'
export default [
  {
    name: 'home-region-sticky — 옛 측위가 다시 고른 지역을 이긴다',
    file: 'src/pages/pc-home/PcHomeLocationBar.tsx',
    find: "  if (readHomePick() === 'region' && readHomeRegion().regionKey) return null\n",
    replace: '',
    test: T,
    why: '지역을 골라 상세에 다녀오면 지역 선택 전 홈으로 돌아간다(대표 신고).',
  },
  {
    name: 'home-region-sticky — 측위를 새로 잡아도 기록하지 않는다',
    file: 'src/shared/utils/cached-loc.ts',
    find: "  markHomePick('loc')\n",
    replace: '',
    test: T,
    why: '지역을 고른 뒤 내 위치를 다시 눌러도 다음 방문에 지역으로 돌아간다.',
  },
]
