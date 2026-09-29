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
    // 🔁 2026-09-29 재조준(안 C): 브랜드 띠를 걷었다 — 모든 구역이 24px 제목을 달게 되면서
    //   '제목이 붙은 구역이 파는 쪽' 규칙이 성립하지 않고, 표시자가 **판**으로 옮겨갔다.
    name: '🧭 파는 쪽 표시자(판)가 사라진다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: '      <div className={LIST_PLATE_CLS}>',
    replace: '      <div>',
    test: TEST,
    why: '제목을 구역 전체로 늘린 장치다 — 없으면 어디까지가 파는 쪽인지 첫 줄에서만 알 수 있다.',
  },
  {
    name: '🧭 손님 구역이 제목 없이 시작한다 (판매 목록과 한 덩어리로 읽힌다)',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    // 🔁 2026-09-29 재조준(안 C): 경계선을 걷었다 — 아래 구역이 **자기 24px 제목**으로 시작하므로
    //   선이 할 일이 없다. 그래서 이제 지킬 것은 **그 제목이 있다** 는 것이다.
    find: '      <SectionTitle>{t(\'shopping.sectionTitle\', { defaultValue: \'내가 산 것\' })}</SectionTitle>',
    replace: '',
    test: TEST,
    why: '손님 구역이 제목 없이 시작하면 판매 도구 목록과 손님 목록이 한 덩어리로 읽힌다(경계가 통째로 사라진다).',
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
    // 🔁 2026-09-29 재조준(안 C): [오늘 | 사용처리] 가로 배치를 걷고 같은 판 안에 세로로 쌓았다.
    //   지금 지킬 것은 **숫자 한 줄이 페이지 맨 위에 있다** 는 것이다(폰·PC 공통).
    name: '🖥️ 상단 숫자 한 줄이 사라진다 (PC 가 다시 카드 넷으로 갈 길이 열린다)',
    file: 'src/pages/UserProfilePage.tsx',
    find: '      <MyStats voucher={counts.voucher} gifticon={counts.gifticon} coupon={counts.coupon} />\n',
    replace: '',
    test: TEST,
    why: '폰 배치를 그대로 늘리면 오늘 숫자 옆이 통째로 비고 사용처리가 한참 아래로 밀린다 — 09-28 "PC가 심플하다" 의 원인.',
  },
  {
    // 🔁 2026-09-29 재조준(안 C): 띠가 없어져 오프셋 결함이 성립하지 않는다. 그 자리에
    //   **PC 숫자 카드 넷의 부활**을 막는다(우측 칸의 절반을 먹던 그것 — 실측상 셋이 0 이었다).
    name: '🔵 PC 숫자 카드 넷이 되살아난다 (셋이 0 인데 카드 넷)',
    file: 'src/pages/user-profile/AccountPcPane.tsx',
    find: '  return (\n    <div className="space-y-5 pb-2">',
    replace: '  return (\n    <div className="space-y-5 pb-2">\n      <div className="grid grid-cols-4 gap-4" />',
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
