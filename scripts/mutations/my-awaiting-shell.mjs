/**
 * 🧬 주입 — **기다리는 동안 빈 칸이 아니라 껍데기** (2026-10-01 대표 지시)
 *
 * 대표: *"저런 로딩이 발생되는 근본적인 원인을 모두 없애줘. 다른 페이지들도 분명히 있을거고.
 *        의미없는 심각한 문제들이잖아."*
 *
 * 09-30 의 처방(빈 칸 예약)은 **재방문만** 고쳤다. 전수 측정에서 첫 방문은 여전히
 * `보이는 곳 15줄 · +404px` 였다 — 대표가 찍은 그 그림이다.
 *
 * 여기 담은 결함은 전부 **에러 없이 조용히** 되돌아간다. 빌드도 테스트도 초록이고 화면도
 * 안 깨진다 — 그 순간을 보고 있던 사람만 안다. 그래서 기계가 잡아야 한다.
 */
const SECTION = 'src/pages/user-profile/SellerSection.tsx'
const LAZY = 'src/pages/user-profile/SellerSectionLazy.tsx'
const ORDERS = 'src/pages/MyOrdersPage.tsx'
const HARNESS = 'scripts/visual-preview.mjs'
const GUARD = 'scripts/check-layout-shift.mjs'

const T = 'src/tests/unit/my-awaiting-shell-2026-10-01.test.tsx'

export default [
  {
    name: '껍데기 — 로딩 중 구역을 안 그린다(빈 칸으로 환원)',
    file: LAZY,
    find: '      <Suspense fallback={<Reserve />}>\n        <SellerSection state={state} />\n      </Suspense>\n    )\n  }',
    replace: '      <Reserve />\n    )\n  }',
    test: T,
    why:
      '09-30 의 처방 그대로다. 그때는 이게 최선으로 보였지만 전수 측정이 **첫 방문 +404px** 을 ' +
      '잡았다 — 잰 값이 없는 첫 방문엔 예약이 0 이라 아무 일도 안 한다.',
  },
  {
    name: '껍데기 — 모르는 값을 0으로 그린다',
    file: SECTION,
    find: "  const blank = (v: string) => (awaiting ? <span className=\"invisible\">{v}</span> : v)",
    replace: '  const blank = (v: string) => v',
    test: T,
    why:
      '머니 표면 룰: 모르는 것과 0 은 다르다. 잠깐이라도 `오늘 0원` 을 띄우면 매출이 있는 ' +
      '사장님에게 장사가 안 됐다고 말하는 셈이다. 높이는 같으므로 **밀림 측정으로는 안 잡힌다** — ' +
      '이 결함은 측정기가 아니라 시험만 잡을 수 있다.',
  },
  {
    name: '껍데기 — 눌리게 둔다(말없이 삼키는 탭)',
    file: SECTION,
    find: "      className={`ur-content-medium lg:px-4 pt-4${awaiting ? ' pointer-events-none' : ''}`}",
    replace: '      className="ur-content-medium lg:px-4 pt-4"',
    test: T,
    why:
      '핸들러는 전부 `!store` 로 일찍 돌아간다 — 누르면 **아무 일도 안 일어나고 안내도 없다**. ' +
      '빈 칸 시절엔 누를 것 자체가 없었으니, 껍데기를 그리면서 새로 생긴 위험이다.',
  },
  {
    name: '껍데기 — 맨 아래 줄을 좌석으로 안 가른다',
    file: SECTION,
    find: '      {(awaiting ? seatId != null : seated) ? (',
    replace: '      {seated ? (',
    test: T,
    why:
      '실측이 잡은 것: 껍데기가 늘 "주문 확인" 버튼(60px)을 그리면 좌석에 앉은 사람은 도착 순간 ' +
      '그 60px 이 사라지며 손님 줄이 위로 당겨진다 — **빈 칸 예약으로 이미 0 이던 재방문까지** ' +
      '나빠졌다(−60px). 좌석은 토큰에서 동기로 읽히므로 첫 프레임에 가를 수 있다.',
  },
  {
    name: '껍데기 높이를 예약값으로 굳힌다',
    file: SECTION,
    find: '    if (!el || !store) return',
    replace: '    if (!el) return',
    test: T,
    why:
      '껍데기엔 상태 안내문(`note`)이 없어 진짜보다 짧다. 그 값을 적어 두면 다음 방문의 예약이 ' +
      '모자라 **그만큼 또 밀린다** — 고치려던 것을 되살리는 셈이고, 아무 에러도 안 난다.',
  },
  {
    name: '주문 스켈레톤이 개수를 흉내 낸다(카드 셋)',
    file: ORDERS,
    find: '        {[0].map(i => (',
    replace: '        {[0, 1, 2].map(i => (',
    test: T,
    why:
      '주문 0건인 사람에게 셋을 그렸다가 빈 상태로 바뀌면서 아래가 **−212px** 당겨졌다. ' +
      '스켈레톤의 일은 "목록이 온다" 고 말하는 것이지 몇 개가 올지 맞히는 것이 아니다.',
  },
  {
    name: '목록 본문이 한 화면을 안 채운다(푸터가 첫 화면 안으로)',
    file: ORDERS,
    find: ' pb-6 sm:pt-5 sm:pb-10 min-h-[60dvh]">',
    replace: ' pb-6 sm:pt-5 sm:pb-10">',
    test: T,
    why:
      '스켈레톤 높이와 결과 높이는 원리상 같을 수 없다 — 그 차이만큼 바로 아래 푸터가 화면을 ' +
      '가로질러 움직인다. 실측: 카드 셋이면 −212px, 하나면 +154px. **개수를 맞히는 길은 없다.**',
  },
  {
    name: '측정기 — 기계 줄을 안 찍는다(가드가 0건을 읽는다)',
    file: HARNESS,
    find: '    console.log(`SHIFT_RESULT ${JSON.stringify({ route: ROUTE',
    replace: '    void 0 && console.log(`SHIFT_RESULT ${JSON.stringify({ route: ROUTE',
    test: T,
    why:
      '이 줄이 없으면 `check-layout-shift` 가 읽을 것이 없다. 그때 빈 배열을 "밀림 0" 으로 ' +
      '읽으면 그 가드는 **영원히 통과만 한다** — 이 레포가 반복해 당한 헛도는 가드다.',
  },
  {
    name: '가드 — 줄을 못 읽어도 통과한다',
    file: GUARD,
    find: '  if (rows.length === 0) {',
    replace: '  if (false) {',
    test: T,
    why:
      '하네스가 크래시하거나 형식이 바뀌면 `rows` 가 빈다. 그걸 결함으로 세지 않으면 ' +
      '**아무것도 측정하지 않으면서 초록불**이 된다. 0건은 통과가 아니다.',
  },
  {
    name: '가드 — 보이는 곳과 화면 밖을 안 가른다',
    file: HARNESS,
    find: '        const vis = y < fold',
    replace: '        const vis = true',
    test: T,
    why:
      '푸터가 흔들린 것과 읽고 있던 줄이 손가락 밑에서 움직인 것을 같은 숫자로 보고하면, ' +
      '목록 길이를 알 수 없는 화면들이 전부 빨간불이 되어 결국 가드를 꺼 버리게 된다.',
  },
]
