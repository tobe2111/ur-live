/**
 * 🧪 주입 — 마이 숫자 잘림 · 제목 무게 · 주차된 레벨 카드 (2026-09-30)
 * 짝: `src/tests/unit/my-stats-titles-2026-09-30.test.ts`
 */
export default [
  {
    name: '마이 숫자 — 값에 단위가 돌아온다(390px 에서 다시 잘림)',
    file: 'src/pages/user-profile/MyStats.tsx',
    find: `          <span className={value > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
            {formatNumber(value)}
          </span>`,
    replace: `          <>
          <span className={value > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
            {formatNumber(value)}
          </span>
          <span className="text-[15px] font-bold text-gray-500 dark:text-gray-400 ml-0.5">{unit}</span>
          </>`,
    test: 'src/tests/unit/my-stats-titles-2026-09-30.test.ts',
    why: '실측으로 잡은 그 17px 다. 단위가 붙으면 아이폰 13(390px)에서 값이 105px 를 요구하는데 칸이 103px 밖에 안 줘 `10,300` 이 `10,30` 으로 잘린다 — 에러 0, 대표가 눈으로 신고하기 전까지 아무도 모른다.',
  },
  {
    name: '마이 숫자 — 칸 여백이 px-4 로 되돌아간다',
    file: 'src/pages/user-profile/MyStats.tsx',
    find: 'flex-1 min-w-0 px-3 first:pl-4 last:pr-4 active:opacity-70',
    replace: 'flex-1 min-w-0 px-4 first:pl-4 active:opacity-70',
    test: 'src/tests/unit/my-stats-titles-2026-09-30.test.ts',
    why: '여백을 되돌리면 칸 안쪽이 103 → 97px 로 줄어 단위를 뺐어도 6자리(`99,999`)부터 다시 잘린다. "보기 좋게 넓히자" 는 다음 세션의 자연스러운 충동이라 명시적으로 막는다.',
  },
  {
    name: '마이 숫자 — 잘림을 크기로 해결한다(24px → 17px)',
    file: 'src/pages/user-profile/MyStats.tsx',
    find: 'text-[24px] font-extrabold tabular-nums',
    replace: 'text-[17px] font-extrabold tabular-nums',
    test: 'src/tests/unit/my-stats-titles-2026-09-30.test.ts',
    why: '가장 쉬운 오답. 숫자를 줄이면 잘림은 사라지지만 이 줄의 존재 이유(표면 규칙 ③ — 숫자가 주인공)가 함께 사라지고, 라벨 13px 과 값 17px 이 붙어 위계가 무너진다.',
  },
  {
    // 🔁 2026-09-30 **같은 날 재조준** — 아침 처방(무게·자간)으로 안 끝났다. 대표가 *"촌스러워.
    //   무조건 해결"* 을 다시 보냈고, 실측 결과 크기(24)와 색(순잉크)이 남은 변수였다.
    //   ⇒ 17px 흐린 잉크 + 값은 `SECTION_TITLE_CLS` 한 곳. 되돌리려는 사고는 그대로다.
    name: '구역 제목 — 24px extrabold 로 되돌아간다(대표가 두 번 지적한 그 인상)',
    file: 'src/pages/user-profile/list-grammar.tsx',
    find: "SECTION_TITLE_CLS = 'text-[17px] font-semibold tracking-[-0.01em]",
    replace: "SECTION_TITLE_CLS = 'text-[24px] font-extrabold tracking-[-0.03em]",
    test: 'src/tests/unit/my-zones-and-pc-2026-09-28.test.ts',
    why: '대표가 **두 번** 지적한 그 인상이다. 아침엔 무게·자간만 고쳤는데 판매 구역이 제목을 손으로 적고 있어 화면에 안 닿았다 — 그래서 이제 *값*이 아니라 *출처*를 지키는 시험(my-zones)으로 옮겼다. 되돌아가도 빌드는 초록이라 조용히 재발한다.',
  },
  {
    name: '레벨 카드 — 마이(폰)에 다시 렌더된다',
    file: 'src/pages/UserProfilePage.tsx',
    find: '      <OrderStatusBar />\n',
    replace: "      <OrderStatusBar />\n      <ReviewLevelCard />\n",
    test: 'src/tests/unit/my-stats-titles-2026-09-30.test.ts',
    why: '대표가 빼라고 한 카드다. 레벨 전용 혜택이 0개인 지금 이 카드는 없는 혜택을 향해 진행바를 채운다.',
  },
  {
    name: '레벨 카드 — 마이(PC)에 다시 렌더된다',
    file: 'src/pages/user-profile/AccountPcPane.tsx',
    find: '      <OrderStatusBar />',
    replace: '      <OrderStatusBar />\n      <ReviewLevelCard />',
    test: 'src/tests/unit/my-stats-titles-2026-09-30.test.ts',
    why: '폰만 빼고 PC 를 놓치는 것이 이 레포의 반복 클래스다(같은 화면이 두 파일로 갈려 있다).',
  },
  {
    name: '후기를 쓰는 문이 사라진다(레벨 카드를 뺀 근거)',
    file: 'src/pages/my-vouchers/VoucherTicket.tsx',
    find: "{v.status === 'used' && <ReviewBonusButton",
    replace: "{false && <ReviewBonusButton",
    test: 'src/tests/unit/my-stats-titles-2026-09-30.test.ts',
    why: '레벨 카드를 뺀 근거가 "후기를 쓰는 진짜 문이 따로 있다"(사용한 이용권의 `ReviewBonusButton`)였다. 그 문이 사라지면 근거가 무너지는데, 두 파일이 멀어서 아무도 연결해 보지 않는다.',
  },
]
