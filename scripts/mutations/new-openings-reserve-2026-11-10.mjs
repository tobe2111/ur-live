/** 🧬 주입 — /new-openings 의 자리 예약이 빠지면 가드가 잡는가. 가드: src/tests/unit/new-openings-reserve-2026-11-10.test.ts */
const T = 'src/tests/unit/new-openings-reserve-2026-11-10.test.ts'
export default [
  {
    name: '📐 새 가게: 칩 줄 자리 예약을 뺀다(목록이 80px 밀린다)',
    file: 'src/pages/NewOpeningsPage.tsx',
    find: '{loading && regions.length === 0 && <div className="mt-5 h-10" aria-hidden="true" />}',
    replace: '',
    test: T,
    why: '2026-11-10 라이브 실측 CLS 0.75 — 응답 뒤 칩 줄이 끼어들며 아래를 민다.',
  },
  {
    name: '📐 새 가게: 로더가 다시 작은 칸이 된다(출처 문단이 튄다)',
    file: 'src/pages/NewOpeningsPage.tsx',
    find: 'py-16 min-h-[100dvh] flex justify-center items-start',
    replace: 'py-16 flex justify-center',
    test: T,
    why: '로더가 작으면 맨 아래 출처 문단이 첫 화면에 보였다가 목록에 밀려 화면 밖으로 나간다.',
  },
  {
    name: '📐 새 가게: 칩 높이만 바꾼다(예약 40px 와 갈린다)',
    file: 'src/pages/NewOpeningsPage.tsx',
    find: "className=\"mt-5 flex gap-2 overflow-x-auto pb-1\"",
    replace: "className=\"mt-5 flex gap-2 overflow-x-auto pb-3\"",
    test: T,
    why: '예약과 실제 줄의 높이가 갈리면 그 차이만큼 다시 밀린다.',
  },
  {
    name: '📐 새 가게: 로더 칸과 목록 칸이 다시 같은 요소로 재사용된다(20px 밀림으로 계산)',
    file: 'src/pages/NewOpeningsPage.tsx',
    find: '<div key="list" className="mt-5 grid',
    replace: '<div className="mt-5 grid',
    test: T,
    why: '2026-11-11 라이브 실측 CLS 0.016 — React 가 같은 div 를 재사용해 위치 차이가 밀림이 된다.',
  },
]
