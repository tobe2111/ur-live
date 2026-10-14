/**
 * 🎟️ 교환권 머리 = 배너 (2026-10-14 대표 확정 안 C). 지키는 것 셋:
 *   ① 응답 전에도 배너 자리를 잡는다(접으면 그 아래 전부가 196px 밀린다 · 서버 첫 화면과 갈린다)
 *   ② 머리에서 보관함으로 가는 길(산 자리에서 내 교환권으로)
 *   ③ 배너 카드 높이 = 예약 판 높이
 */
export default [
  {
    name: '🎟️ 교환권 머리가 응답 전에 접힌다 (도착 순간 목록 전체가 밀림)',
    file: 'src/pages/vouchers/VouchersHero.tsx',
    find: 'if (settled && banners.length === 0)',
    replace: 'if (banners.length === 0)',
    test: 'src/tests/unit/vouchers-first-screen-2026-10-14.test.tsx',
    why: '배너는 마운트 뒤에 온다. 그때 자리를 만들면 잔액·칩·목록이 통째로 196px 밀리고, 서버 첫 화면(판을 그린다)과도 갈린다. 에러는 0 이다.',
  },
  {
    name: '🎟️ 교환권 머리에서 보관함으로 가는 길이 사라진다',
    file: 'src/pages/vouchers/VouchersHero.tsx',
    find: "navigate('/my-gifticons')",
    replace: "navigate('/vouchers')",
    test: 'src/tests/unit/voucher-wallet-split.test.ts',
    why: '안 C 에서 모바일 보관함 진입점은 머리 배너 위 아이콘 하나다. 사라져도 화면은 멀쩡하고 "산 교환권을 못 찾는" 상태만 남는다.',
  },
  {
    name: '🎟️ 배너 카드 높이가 예약 판과 갈린다',
    file: 'src/components/home/HomeBannerStrip.tsx',
    find: "export const HERO_CARD_CLS = '!aspect-auto !h-[196px]",
    replace: "export const HERO_CARD_CLS = '!aspect-auto !h-[180px]",
    test: 'src/tests/unit/vouchers-first-screen-2026-10-14.test.tsx',
    why: '판(196)보다 낮으면 배너 아래에 빈 띠가 남고, 높으면 잔액 카드 걸침 자리를 넘어 잘린다. 둘 다 빌드는 초록이다.',
  },
]
