/**
 * 🧭 구역 이름 E + PC 1안 (2026-09-28, 대표 "이름 e" · "끝까지 해줘") — 주입 매니페스트.
 * 가드: src/tests/unit/my-zones-and-pc-2026-09-28.test.ts
 *
 * 되돌리려는 사고: ① 구역 신호(제목·띠·경계선)가 조용히 빠져 **파는 쪽과 손님 쪽이 한 덩어리**가 되는 것
 * ② 로케일만 옛 값으로 남아 **코드는 맞는데 화면은 옛 글자**인 것(이 레포가 실제로 밟은 함정)
 * ③ PC 에서 프로필 카드가 다시 판매 위로 올라가는 것.
 */
const TEST = 'src/tests/unit/my-zones-and-pc-2026-09-28.test.ts'

export default [
  {
    name: '🧭 구역 제목이 본문 라벨 크기로 되돌아간다 (제목이 파는 쪽 신호를 못 한다)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: 'className="text-[24px] leading-tight font-extrabold tracking-[-0.03em] text-gray-900 dark:text-white">내 가게</h2>',
    replace: 'className="text-[13px] font-extrabold text-gray-900 dark:text-white">내 가게</h2>',
    test: TEST,
    why: '이름 E 의 읽는 규칙은 "제목이 붙은 구역이 파는 쪽" 하나다 — 제목이 본문과 같은 크기면 규칙 자체가 안 보인다.',
  },
  {
    name: '🧭 구역 띠가 사라진다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: 'top-4 bottom-0 w-[3px] rounded-full bg-brand" />',
    replace: '',
    test: TEST,
    why: '제목을 구역 전체로 늘린 장치다 — 없으면 어디까지가 파는 쪽인지 첫 줄에서만 알 수 있다.',
  },
  {
    name: '🧭 구역 경계선이 페이지 쪽으로 옮겨진다 (좌석 0 이면 허공에 선이 뜬다)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    // 🔁 2026-09-28 재조준: PC 가 두 열이 되면서 이 선에 `lg:hidden` 이 붙었다(옆에 손님 쪽이 있는
    //   화면에서는 아무것도 가르지 않는 유리선이었다). 지키려던 것은 **선이 이 컴포넌트 안에 있다**
    //   이지 클래스 문자열이 아니므로, 앵커만 새 줄로 옮긴다.
    find: '      <div className="mt-5 h-px bg-black/[0.08] dark:bg-white/[0.08] lg:hidden" />',
    replace: '',
    test: TEST,
    why: '이 섹션은 좌석이 없으면 `null` 이다 — 선을 페이지가 따로 판정해 그리면 판정이 두 곳이 되고 반드시 갈린다.',
  },
  {
    name: '🧭 ko 로케일만 옛 라벨로 남는다 (코드는 맞는데 화면은 "나의 이용 내역")',
    file: 'public/locales/ko/translation.json',
    find: '"sectionTitle": "내가 산 것"',
    replace: '"sectionTitle": "나의 이용 내역"',
    test: TEST,
    why: '`t(key,{defaultValue})` 는 로케일이 이긴다 — 코드만 고치면 화면은 한 글자도 안 바뀐다(실제로 밟은 함정).',
  },
  {
    name: '🖥️ PC 에서 프로필 카드가 다시 판매 위로 간다',
    file: 'src/pages/UserProfilePage.tsx',
    // 🔁 2026-09-28 재조준: PC 가 2열이 되면서 둘이 **다른 열**로 갈라졌다(판매=넓은 왼쪽,
    //   프로필=좁은 오른쪽). 지키려는 것은 그대로 — **PC 첫 줄은 판매다.** 그 줄을 지우면 빨간불.
    //   ⚠️ 줄을 통째로 걷어내야 빨간불이 된다 — `{false ? …}` 로 바꾸면 그 **문자열이 남아**
    //     순서 검사(`indexOf`)가 그대로 통과한다(첫 판에서 실제로 헛돌았다).
    find: '      {isPc ? <SellerSection state={sellerSeats} /> : null}',
    replace: '      {/* PC 판매 없음 */}',
    test: TEST,
    why: 'PC 를 여는 사장님이 보려는 건 오늘 숫자 하나다 — 그게 첫 줄이 아니면 PC 를 여는 이유가 사라진다.',
  },
  {
    name: '🖥️ PC 히어로가 세로로 되돌아간다 (1200px 에 숫자 하나만 남는다)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: '      <div className="lg:flex lg:items-stretch lg:gap-3">',
    replace: '      <div>',
    test: TEST,
    why: '폰 배치를 그대로 늘리면 오늘 숫자 옆이 통째로 비고 사용처리가 한참 아래로 밀린다 — 09-28 "PC가 심플하다" 의 원인.',
  },
  {
    name: '🔵 구역 띠가 PC 에서 다시 카드를 관통한다 (lg:-left-3 → lg:left-3)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: 'left-1.5 lg:-left-3',
    replace: 'left-1.5 lg:left-3',
    test: TEST,
    why: 'PC 우측 칸은 좌우 패딩이 0 이라 양수 오프셋은 거터가 아니라 카드 안쪽이다 — 띠가 일감 카드를 세로로 갈랐다(하네스 실측).',
  },
  {
    name: '🔵 띠 오프셋의 근거인 CSS 패딩 무력화가 사라진다',
    file: 'src/index.css',
    // 🔁 2026-09-28 재조준: 같은 미디어쿼리 안에 2열 규칙이 뒤에 붙으면서 `}\n}` 로 끝나지 않는다.
    find: '    padding-left: 0;\n    padding-right: 0;\n  }',
    replace: '  }',
    test: TEST,
    why: '음수 오프셋의 근거가 이 규칙이다 — 한쪽만 바뀌면 조용히 어긋나는 짝이라 함께 잠갔다.',
  },
  {
    name: '🏪 가게 개수를 이름과 한 span 에 도로 붙인다 (긴 이름에서 개수가 먼저 잘린다)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: '<span className="truncate">{store.name}</span>\n            <span className="shrink-0">· {stores.length}곳</span>',
    replace: '<span className="truncate">{store.name} · {stores.length}곳</span>',
    test: TEST,
    why: '이 줄이 눌리는 이유가 개수다(2곳 이상일 때만 전환 버튼) — 잘려야 하는 건 이름이지 개수가 아니다.',
  },
]
