/**
 * 🎟️ 교환권 머리 — 2026-10-14 안 C(배너) → **2026-11-01 대표 확정 A안(한 줄)** 으로 재조준.
 *
 * 지키려던 불변식은 그대로다. 배너가 사라지며 *어디서* 지키는지만 옮겼다:
 *   ① 머리 높이가 응답에 따라 변하지 않는다 (종전: 배너 판 예약 / 지금: `h-14` 고정)
 *   ② 머리에서 보관함으로 가는 길 (종전: 배너 위 아이콘 / 지금: 한 줄 오른쪽 아이콘)
 *   ③ 배너 카드 높이 = 예약 판 높이 — 🪦 **걷었다.** 그 불변식은 *쌍*(카드 높이 ↔ 예약 판 높이)이고
 *      A안이 판을 없앴다. 한쪽이 사라진 쌍은 지킬 게 없다(아래 묘비 참조).
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
  // 🪦 2026-11-01 제거: '🎟️ 배너 카드 높이가 예약 판과 갈린다'
  //   그 불변식은 **쌍**이었다 — `HERO_CARD_CLS` 의 196px ↔ 교환권 첫 화면이 예약한 판 196px.
  //   A안이 그 판을 없앴고(머리가 56px 한 줄), 그러면 카드 높이는 **아무것과도 안 맞춰야 한다**:
  //   `hero` 변형은 사용처가 0 이라(`BannerHeroRail` 포함) 180 으로 바꿔도 **아무 화면도 안 변한다**
  //   ⇒ CI 가 "가드가 지키는 척만 한다"로 빨간불을 냈다(run 41289919534).
  //   ⚠️ 그 변형의 **모양**(사진을 오른쪽 아래로·제목 폭)은 `voucher-hero-art-2026-10-24` 가 보관한다
  //   — 되살릴 때 쓸 설계도다. 거기에 높이 단언을 더하지 말 것: 맞출 상대가 없으면 숫자를 지키는 게
  //   아니라 **숫자를 외우는** 일이 된다. 배너가 머리로 돌아오는 날 판과 함께 다시 세울 것.
]
