/**
 * 🎫 주입 — 카드 표면 정렬 (2026-09-15 대표 승인 "1번 진행")
 *
 * 지키는 것: 카드 모양(`rounded-`)이 다크에서 **페이지색**(#11141C)을 쓰지 않는다.
 * 이 회귀는 **에러 없이 조용히** 일어난다 — 라이트에서는 아무 차이도 안 보이고,
 * 다크에서만 카드가 페이지에 녹아 사라진다(그때 `--lift: none` 이라 그림자도 없다).
 */
const TEST = 'src/tests/unit/card-surface-dark-2026-09-15.test.ts'

export default [
  {
    name: '[카드표면] 🔴 영수증 등록 카드가 다크 페이지색으로 되돌아간다',
    file: 'src/pages/DistrictCouponPage.tsx',
    find: 'rounded-2xl bg-surface p-4 space-y-3',
    replace: 'rounded-2xl bg-white dark:bg-[#11141C] p-4 space-y-3',
    test: TEST,
    why:
      '카드가 페이지와 같은 색이 된다. ⚠️ 2026-09-29 에 이 카드의 **테두리가 없어졌다**(규칙 ① — ' +
      '카드는 들림 한 값) ⇒ 색까지 같아지면 경계가 **통째로** 사라진다. 종전엔 테두리가 남아 ' +
      '아주 안 보이진 않았는데, 이제 그 완충이 없다.',
  },
  {
    name: '[카드표면] 🔴 선물 보내기 시트가 다크 페이지색으로 되돌아간다',
    file: 'src/components/gift/GiftSendModal.tsx',
    find: 'className="bg-surface w-full max-w-[430px] rounded-t-3xl sm:rounded-3xl',
    replace: 'className="bg-white dark:bg-[#11141C] w-full max-w-[430px] rounded-t-3xl sm:rounded-3xl',
    test: TEST,
    why:
      '바텀시트는 테두리도 그림자도 없다(규칙 ① + 다크 `--lift: none`). 페이지색이 되면 ' +
      '시트의 경계가 사라져 어디까지가 시트인지 안 보인다.',
  },
]
