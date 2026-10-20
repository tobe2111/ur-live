// 🏨 2026-10-15 — 숙소 목록 첫 검색 조기 출발(index.html 인라인 · useStaysSearch · 한국 시간 날짜)
const T = 'src/tests/unit/stays-early-2026-10-15.test.ts'
export default [
  { name: '🏨 조기 출발 주소의 정렬이 화면과 어긋난다', file: 'index.html', find: "'&guests=2&sort=recent'", replace: "'&guests=2&sort=price'", test: T, why: '주소가 달라 이어받지 못하고 요청이 두 번 나간다' },
  { name: '🏨 훅이 조기 요청을 이어받지 않는다', file: 'src/hooks/queries/useStaysSearch.ts', find: 'const early = takeStaysEarly(qs)', replace: 'const early = null as Promise<unknown> | null; void takeStaysEarly', test: T, why: '첫 검색이 다시 React 가 그린 뒤에야 나간다' },
  { name: '🏨 숙소 날짜가 다시 UTC', file: 'src/shared/stays-early.ts', find: 'return new Date(now + KST + offsetDays * DAY)', replace: 'return new Date(now + offsetDays * DAY)', test: T, why: '한국 0~9시에 체크인이 어제로 잡힌다' },
]
