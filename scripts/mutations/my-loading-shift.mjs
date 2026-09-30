/**
 * 🧬 주입 — **마이 로딩 밀림**과 **구역 제목 출처** (2026-09-30 대표 지시 둘)
 *
 * ① *"지금 2번째 이미지가 로딩에 나오다가 첫번째 이미지로 바뀌더라?"* — 손님 줄이 +336px 밀렸다.
 * ② *"… 글자들이 너무 촌스러워. 이 문제 무조건 해결해야 하고"* — 같은 것을 **두 번째** 지적했다.
 *    오전 처방이 화면에 안 닿은 이유는 판매 구역이 제목을 **손으로 적고 있었기 때문**이다.
 *
 * 여기 담은 결함은 전부 **에러 없이 조용히** 되돌아간다 — 빌드도 초록이고 화면도 안 깨진다.
 * 그래서 사람이 아니라 가드가 잡아야 한다.
 */
const LAZY = 'src/pages/user-profile/SellerSectionLazy.tsx'
const SECTION = 'src/pages/user-profile/SellerSection.tsx'
const PAGE = 'src/pages/UserProfilePage.tsx'
const GRAMMAR = 'src/pages/user-profile/list-grammar.tsx'
const SETTINGS = 'src/pages/user-profile/SettingsGroup.tsx'

const T_SHIFT = 'src/tests/unit/my-loading-shift-2026-09-30.test.tsx'
const T_ZONES = 'src/tests/unit/my-zones-and-pc-2026-09-28.test.ts'
const T_CLEAN = 'src/tests/unit/mypage-cleanup-2026-09-02.test.ts'

export default [
  {
    name: '밀림 — 로딩 중 자리를 안 비운다(종전 동작으로 환원)',
    file: LAZY,
    find: '    return isSeller ? <Reserve /> : null',
    replace: '    return null',
    test: T_SHIFT,
    why:
      '2026-09-30 이전이 정확히 이 줄이었고, 그 파일의 주석은 그게 *밀림을 막는 처방*이라고 ' +
      '적어 두기까지 했다. 실측은 반대였다 — 비워 두면 구역 **전체 높이**(+336px)만큼 밀린다.',
  },
  {
    name: '밀림 — 청크가 오는 동안 자리를 놓는다(Suspense 폴백 null)',
    file: LAZY,
    find: '    <Suspense fallback={<Reserve />}>',
    replace: '    <Suspense fallback={null}>',
    test: T_SHIFT,
    why:
      '데이터가 와도 셀러 청크는 아직 네트워크에 있다. 여기서 놓으면 예약이 한 프레임 접혔다 ' +
      '다시 펴져 **두 번** 밀린다 — 첫 처방만 보면 안 보이는 두 번째 구멍이다.',
  },
  {
    name: '밀림 — 예약 높이를 손으로 적는다(마법의 숫자)',
    file: LAZY,
    find: '  const h = readReservedHeight()',
    replace: '  const h = 420',
    test: T_SHIFT,
    why:
      '숫자를 박으면 **오늘은 맞는다**. 그래서 통과하는 것처럼 보이고, 구역 내용이 바뀌는 날 ' +
      '조용히 어긋난다(2026-09-16 `TopChromeReserve` 가 정확히 그 값을 치르고 배운 규칙).',
  },
  {
    name: '밀림 — 구역이 자기 높이를 안 적는다(예약값이 영원히 없다)',
    file: SECTION,
    find: '    const id = requestAnimationFrame(() => writeReservedHeight(el.offsetHeight))',
    replace: '    const id = requestAnimationFrame(() => {})',
    test: T_SHIFT,
    why:
      '읽는 쪽만 남으면 값이 영영 0 이라 **예약이 한 번도 안 일어난다**. 화면은 수리 전과 똑같은데 ' +
      '코드에는 처방이 남아 있어, 다음 세션이 "이미 고쳤다" 고 읽는다.',
  },
  {
    name: '밀림 — 계산대 폴백이 로딩 중에도 뜬다(떴다 사라진다)',
    file: PAGE,
    find: "{!!localStorage.getItem('seller_token') && !sellerSeats.loading && sellerSeats.stores.length === 0 && (",
    replace: "{!!localStorage.getItem('seller_token') && sellerSeats.stores.length === 0 && (",
    test: T_SHIFT,
    why:
      '실측에서 `사라짐: ["매장 계산대", …]` 로 잡힌 그 줄이다. "아직 모른다" 를 "없다" 로 읽으면 ' +
      '폴백이 잠깐 떴다가 접히고, 그만큼 아래가 또 움직인다.',
  },
  {
    name: '제목 — 판매 구역이 제목을 손으로 적는다(두 자리가 갈린다)',
    file: SECTION,
    find: '<h2 className={`leading-tight ${SECTION_TITLE_CLS}`}>내 가게</h2>',
    replace: '<h2 className="text-[24px] leading-tight font-extrabold tracking-[-0.03em] text-gray-900 dark:text-white">내 가게</h2>',
    test: T_ZONES,
    why:
      '**2026-09-30 오전에 실제로 이랬다.** 공용 부품만 고치고 이 줄을 놓쳐서, 대표가 같은 것을 ' +
      '두 번 지적했다("투박해" → "촌스러워"). 값이 아니라 *출처*를 고정해야 막힌다.',
  },
  {
    name: '제목 — 공용 토큰을 24px 로 되돌린다',
    file: GRAMMAR,
    find: "export const SECTION_TITLE_CLS = 'text-[17px] font-semibold",
    replace: "export const SECTION_TITLE_CLS = 'text-[24px] font-bold",
    test: T_ZONES,
    why:
      '대표가 두 번 지적한 그 무게다. 화면은 안 깨지고 글자만 커지므로 에러가 0 이다 — ' +
      '되돌아가도 아무 신호가 없는 클래스라 못을 박는다.',
  },
  {
    name: '설정 — 다시 접는다(한 번 더 눌러야 보인다)',
    file: SETTINGS,
    find: '      <div>{children}</div>',
    replace: '      {false && <div>{children}</div>}',
    test: T_SHIFT,
    why:
      '대표 *"왜 굳이 열고 닫게 해두는거지? … 가시적이지 않아 보는데에 불편해"*. 접힘은 *길이*에 ' +
      '대한 처방인데, 09-30 에 구역이 다섯에서 셋으로 줄어 그 이유가 사라졌다.',
  },
]
