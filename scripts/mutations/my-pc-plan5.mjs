/**
 * 🖥️ PC 마이 **안 5** 주입 — 2026-10-11 (대표 확정 *"안 5로 진행하자"*).
 *
 * 지키는 것: ① 폭 수리(`width: 100%`)가 되돌아가지 않는다 ② 두 열이 균등으로 안 간다
 * ③ 머리 띠가 숫자를 두 벌로 만들지 않는다 ④ 손님 칸에 판이 안 생긴다
 * ⑤ 설정 블록이 복붙되지 않는다 ⑥ 폰 칸 여백(390px 실측값)이 안 바뀐다.
 */
const TEST = 'src/tests/unit/my-pc-plan5-2026-10-11.test.ts'

export default [
  {
    name: '🖥️ PC 본문 폭 수리를 되돌린다 (`width: 100%` 제거 → 실측 644px)',
    file: 'src/index.css',
    find: `    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;`,
    replace: `    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;`,
    test: TEST,
    why: '세로 flex 안에서 auto 마진이 stretch 를 무력화해 박스가 내용 폭으로 줄어든다 — 1200px 가 영영 안 걸린다',
  },
  {
    name: '🖥️ `width` 대신 `align-self: stretch` 로 고친 척한다 (auto 마진이 이긴다)',
    file: 'src/index.css',
    find: `    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;`,
    replace: `    align-self: stretch;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;`,
    test: TEST,
    why: '교차축 auto 마진은 stretch 를 끄므로 이 줄은 아무 일도 안 한다 — "고쳤다" 는 착각만 남는다',
  },
  {
    name: '📐 두 열을 균등으로 쪼갠다 (왼쪽 판매 목록의 설명이 잘린다)',
    file: 'src/index.css',
    find: 'grid-template-columns: 7fr 5fr;',
    replace: 'grid-template-columns: 1fr 1fr;',
    test: TEST,
    why: '안 5 는 비대칭이다 — 균등이면 왼쪽 [이름 + 설명 + ›] 이 한 줄에 안 들어간다',
  },
  {
    name: '🔢 PC 띠가 숫자를 폰과 다른 값으로 넘긴다',
    file: 'src/pages/user-profile/AccountPcBand.tsx',
    find: '<MyStats inline voucher={counts.voucher} gifticon={counts.gifticon} coupon={counts.coupon} />',
    replace: '<MyStats inline voucher={counts.voucher} gifticon={counts.wish} coupon={counts.coupon} />',
    test: TEST,
    why: '같은 화면이 두 숫자를 말한다 — 에러가 안 나서 아무도 신고하지 않는 클래스',
  },
  {
    name: '🔔 PC 띠의 벨이 다시 알림 페이지로 떠난다',
    file: 'src/pages/user-profile/AccountPcBand.tsx',
    find: 'onClick={onBell}',
    replace: "onClick={() => { void onBell; window.location.assign('/notifications') }}",
    test: TEST,
    why: '같은 날 대표가 "페이지가 아니라 올라오는 시트" 로 바꾸라고 한 그 동작이 PC 에서만 되살아난다',
  },
  {
    // 🔁 2026-10-14 재조준(대표 확정 PC 마이 B): 방향이 뒤집혔다 — 이제 결함은 '카드가 된 것' 이 아니라
    //   **카드 모양을 공용 클래스 대신 손으로 적는 것**(한 칸만 다른 그림자가 된다)이다.
    name: '🎗️ 머리 카드 모양을 공용 클래스 대신 손으로 적는다',
    file: 'src/pages/user-profile/AccountPcBand.tsx',
    find: 'className="ur-pc-card flex items-center gap-5 px-4 py-5"',
    replace: 'className="flex items-center gap-5 px-4 py-5 rounded-2xl bg-surface shadow-lift"',
    test: TEST,
    why: 'B 의 카드 다섯이 한 규칙(`ur-pc-card`)에서 모양을 받아야 같은 그림자·모서리로 선다 — 하나만 손으로 적으면 갈린다',
  },
  {
    name: '🧾 PC 칸에 손으로 적은 타일 목록을 되살린다',
    file: 'src/pages/user-profile/AccountPcPane.tsx',
    find: '  const { data: vouchers } = useMyVouchers()',
    replace: `  const tiles = [{ label: '내 숙소 예약', path: '/my-stays' }]
  void tiles
  const { data: vouchers } = useMyVouchers()`,
    test: TEST,
    why: '두 번째 목록이 생기는 순간 폰 목록과 갈리고, 그 부분집합 밖 목적지는 PC 에서 고아가 된다',
  },
  {
    name: '⚙️ 설정 블록을 복붙한다 (한 벌이어야 한다)',
    file: 'src/pages/UserProfilePage.tsx',
    find: '      {pcSplit ? settingsBlock : null}',
    replace: `      {pcSplit ? (
        <SettingsGroup>
          <NotificationToggleSection />
        </SettingsGroup>
      ) : null}`,
    test: TEST,
    why: '복붙한 두 벌은 반드시 갈린다 — 이 레포가 같은 클래스로 두 번 당했다(09-28 헤더 · 09-30 제목)',
  },
  {
    name: '⚙️ 설정 자리를 `isPc` 만으로 가른다 (좌석 0곳에서 본문보다 먼저 그려진다)',
    file: 'src/pages/UserProfilePage.tsx',
    find: 'const pcSplit = isPc && sellerSeats.stores.length > 0',
    replace: 'const pcSplit = isPc',
    test: TEST,
    why: '좌석이 없으면 두 열 래퍼가 평범한 블록이라 왼쪽·오른쪽이 세로로 이어진다 — 설정이 맨 위로 올라온다',
  },
  {
    name: '📱 폰 칸 여백을 px-4 로 되돌린다 (390px 에서 숫자가 잘린다)',
    file: 'src/pages/user-profile/MyStats.tsx',
    find: "    : 'flex-1 min-w-0 px-3 first:pl-4 last:pr-4'",
    replace: "    : 'flex-1 min-w-0 px-4 first:pl-4 last:pr-4'",
    test: TEST,
    why: '2026-09-30 실측으로 확정된 값이다 — 아이폰 13(390px)에서 `10,300` 이 다시 잘린다',
  },
  {
    name: '📱 띠 모드 칸에 flex-1 을 섞는다 (어느 쪽이 이길지 클래스 순서로는 못 정한다)',
    file: 'src/pages/user-profile/MyStats.tsx',
    find: "    ? 'shrink-0 px-5 first:pl-0 last:pr-0 text-right'",
    replace: "    ? 'flex-1 shrink-0 px-5 first:pl-0 last:pr-0 text-right'",
    test: TEST,
    why: '생성된 CSS 순서가 승자를 정하므로 조용히 뒤집힌다 — 띠가 폭을 나눠 가져 이름 칸을 민다',
  },
  {
    name: '📱 띠에서도 줄 밖 안내문을 그린다 (띠가 두 줄이 된다)',
    file: 'src/pages/user-profile/MyStats.tsx',
    // 🔁 2026-10-12 재조준: 띠 모드가 칸 + 환급 버튼을 함께 돌려준다(결함은 그대로 — 일찍 안 돌아간다).
    find: '  if (inline) return (',
    replace: '  if (inline && false) return (',
    test: TEST,
    why: '한 줄 띠 안에 `<p>` 가 들어가면 띠가 아니게 되고, 오른쪽 끝 정렬이 통째로 무너진다',
  },
  {
    name: '🧾 PC 가 공용 손님 목록을 다시 분기 안으로 넣는다',
    file: 'src/pages/UserProfilePage.tsx',
    find: '      <ShoppingGroup counts={counts} />',
    replace: '      {!isPc && <ShoppingGroup counts={counts} />}',
    test: TEST,
    why: 'PC 가 다시 쿠폰함·주문 내역·배송지·내 리뷰로 갈 길을 잃는다(종전 타일 셋이 그 상태였다)',
  },
]
