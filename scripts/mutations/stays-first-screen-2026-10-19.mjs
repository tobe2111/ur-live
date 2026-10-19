/**
 * 🧬 주입 — 숙소 목록(`/stays`) 서버 첫 화면 (2026-10-19 대표 "모두 개선해줘")
 */
const T = 'src/tests/unit/stays-first-screen-2026-10-19.test.ts'
export default [
  {
    name: '숙소첫화면 — 카드 링크가 날짜·인원을 잃는다',
    file: 'src/worker/utils/stays-first-screen.ts',
    find: '}, i === 0, stayCardHref(s.id, checkIn, checkOut, guests)) +',
    replace: '}, i === 0) +',
    test: T,
    why: '서버 카드는 /pass/:id 로, 화면 카드는 /stays/:id?… 로 간다 — 마운트 전에 누르면 다른 곳에 착지한다.',
  },
  {
    name: '숙소첫화면 — 화면이 시드를 다른 질의에도 쓴다',
    file: 'src/shared/stays-early.ts',
    find: "if (typeof document === 'undefined' || qs !== defaultStaysQs(now)) return undefined",
    replace: "if (typeof document === 'undefined') return undefined",
    test: T,
    why: '지역·필터를 바꿔도 기본 목록이 잠깐 뜬다(틀린 결과).',
  },
  {
    name: '숙소첫화면 — 시드를 두 번 쓴다',
    file: 'src/shared/stays-early.ts',
    find: '  if (!el) return undefined\n  el.remove()',
    replace: '  if (!el) return undefined',
    test: T,
    why: '뒤로가기로 다시 들어오면 오래된 시드가 첫 렌더를 덮는다.',
  },
  {
    name: '숙소첫화면 — 첫 장이 eager 가 아니다',
    file: 'src/worker/utils/stays-first-screen.ts',
    find: '}, i === 0, stayCardHref(',
    replace: '}, false, stayCardHref(',
    test: T,
    why: 'LCP 사진이 lazy 로 늦게 출발한다 — 이 첫 화면의 존재 이유가 사라진다.',
  },
  {
    name: '숙소첫화면 — 숙소 칩 대신 전체가 켜진다',
    file: 'src/worker/utils/stays-first-screen.ts',
    find: "key === 'stay_voucher' ? STAYS_LIST.chipOn",
    replace: "key === 'all' ? STAYS_LIST.chipOn",
    test: T,
    why: '마운트 때 켜진 칩이 바뀌어 보인다.',
  },
]
