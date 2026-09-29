/**
 * 🧷 교환권 상단 자리 예약이 진짜 블록을 따라가는가 (2026-09-16) — 주입 매니페스트.
 * 가드: src/tests/unit/top-chrome-reserve-2026-09-16.test.ts
 */
const TEST = 'src/tests/unit/top-chrome-reserve-2026-09-16.test.ts'
const RESERVE = 'src/pages/vouchers/TopChromeReserve.tsx'
const PAGE = 'src/pages/VouchersPage.tsx'

export default [
  {
    name: '🧷 예약을 다시 손으로 박은 숫자로 (드리프트가 되살아난다)',
    file: PAGE,
    find: '{sections.length === 0 && !sectionsReady && <ChipRowReserve />}',
    replace: '{sections.length === 0 && !sectionsReady && <div className="h-[50px]" />}',
    test: TEST,
    why: '2026-09-02 에 칩이 흰 알약+그림자로 바뀌었는데 숫자가 안 따라와 6px 모자랐다. 숫자는 디자인을 못 따라간다.',
  },
  {
    name: '🧷 칩 예약의 알약 치수가 진짜와 달라진다',
    file: RESERVE,
    find: 'h-9 pl-3 pr-3.5 rounded-full text-[13px] font-bold',
    replace: 'h-8 pl-3 pr-3.5 rounded-full text-[13px] font-bold',
    test: TEST,
    why: '예약 높이는 알약이 정한다 — 한 글자만 달라도 화면이 그만큼 내려앉는다.',
  },
  {
    name: '🧷 브랜드 예약의 바깥 패딩이 진짜와 달라진다',
    file: RESERVE,
    find: 'ur-content-wide px-4 lg:px-8 pt-1.5 pb-3 invisible',
    replace: 'ur-content-wide px-4 lg:px-8 pt-3 pb-3 invisible',
    test: TEST,
    why: '2026-06-26 대표 결정 A 가 py-4 → pt-1.5/pb-3 로 줄인 그 값이다. 예약만 옛 값으로 남으면 그만큼 밀린다.',
  },
  {
    name: '🧷 로고 타일이 BrandChip 치수를 안 따른다',
    file: RESERVE,
    find: '<span className="w-12 h-12 rounded-2xl block" />',
    replace: '<span className="w-10 h-10 rounded-2xl block" />',
    test: TEST,
    why: '로고 줄 높이는 48px 타일이 정한다 — 예약만 40px 이면 8px 밀린다.',
  },
  {
    name: '🧷 접힘 상태를 무시하고 항상 펴서 예약한다 (반대 방향 밀림)',
    file: RESERVE,
    find: '{open && (',
    replace: '{true && (',
    test: TEST,
    why: '브랜드 접기 토글은 2026-09-01 에 생겼다. 접힌 사람에게 편 높이를 예약하면 도착 순간 위로 튄다.',
  },
  {
    name: '🧷 예약이 눈에 보인다 (로더 통일 정책 위반 — 빈 회색 상자가 뜬다)',
    file: RESERVE,
    find: '<div className="ur-content-wide px-4 lg:px-8 pt-1.5 pb-3 invisible" aria-hidden="true">',
    replace: '<div className="ur-content-wide px-4 lg:px-8 pt-1.5 pb-3" aria-hidden="true">',
    test: TEST,
    why: '자리만 잡고 아무것도 안 보여야 한다 — 2026-07-01 대표 "로딩 화면 2~3개 금지".',
  },
]
