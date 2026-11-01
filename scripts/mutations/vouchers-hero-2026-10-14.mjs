/**
 * 🎟️ 교환권 머리 — 2026-10-14 안 C(배너) → **2026-11-01 대표 확정 A안(한 줄)** 으로 재조준.
 *
 * 지키려던 불변식은 그대로다. 배너가 사라지며 *어디서* 지키는지만 옮겼다:
 *   ① 머리 높이가 응답에 따라 변하지 않는다 (종전: 배너 판 예약 / 지금: `h-14` 고정)
 *   ② 머리에서 보관함으로 가는 길 (종전: 배너 위 아이콘 / 지금: 한 줄 오른쪽 아이콘)
 *   ③ 배너 카드 높이 = 예약 판 높이 — **홈이 계속 쓴다**(교환권만 빠졌다). 그대로 둔다.
 */
export default [
  {
    name: '🎟️ 교환권 머리 높이가 내용에 따라 변한다 (잔액이 오는 순간 목록이 밀림)',
    file: 'src/shared/vouchers-top-row.ts',
    find: "row: 'flex items-center justify-between h-14 pl-5 pr-3'",
    replace: "row: 'flex items-center justify-between py-3 pl-5 pr-3'",
    test: 'src/tests/unit/vouchers-first-screen-2026-10-14.test.tsx',
    why: '높이를 글자가 정하게 두면 잔액 숫자가 도착할 때 줄 높이가 바뀌어 아래 목록이 통째로 밀린다. 고정 h-14 하나가 그걸 막는다(에러는 0 이다).',
  },
  {
    name: '🎟️ 교환권 머리에서 보관함으로 가는 길이 사라진다',
    file: 'src/shared/vouchers-top-row.ts',
    find: "export const VOUCHERS_TOP_BOX_PATH = '/my-gifticons'",
    replace: "export const VOUCHERS_TOP_BOX_PATH = '/vouchers'",
    test: 'src/tests/unit/voucher-wallet-split.test.ts',
    why: 'A안에서 모바일 보관함 진입점은 머리 한 줄 오른쪽 아이콘 하나다. 사라져도 화면은 멀쩡하고 "산 교환권을 못 찾는" 상태만 남는다.',
  },
  {
    name: '🎟️ 배너 카드 높이가 예약 판과 갈린다',
    file: 'src/shared/home-strip-banners.ts',
    find: "export const HERO_CARD_CLS = '!aspect-auto !h-[196px]",
    replace: "export const HERO_CARD_CLS = '!aspect-auto !h-[180px]",
    test: 'src/tests/unit/vouchers-first-screen-2026-10-14.test.tsx',
    why: '판(196)보다 낮으면 배너 아래에 빈 띠가 남고, 높으면 잔액 카드 걸침 자리를 넘어 잘린다. 둘 다 빌드는 초록이다.',
  },
]
