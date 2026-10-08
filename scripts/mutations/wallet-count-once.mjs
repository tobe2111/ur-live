/**
 * 🧬 주입 — **지갑에서 장수는 한 곳에서만 말한다** (2026-10-08 대표 "굳이 없어도 될 것 같아")
 *
 * 2026-10-07 A안이 "금액·장수를 머리글에서 한 번만" 으로 정리했는데, 그 머리글 바로 아래
 * 탭 배지가 같은 `unusedItems.length` 를 **40px 안에서 또** 말하고 있었다(`88,900원 · 3장`
 * ↔ `사용 가능 3`). 에러가 안 나고 숫자도 맞아서 재 본 사람만 안다.
 *
 * ⇒ 불변식이 "머리글 한 번" 에서 **"탭 배지 한 번"** 으로 옮겨갔다. 두 방향을 다 막는다 —
 * 머리글에 장수가 되살아나도(중복), 탭 배지가 사라져도(0곳) 빨간불이다.
 */
const VPAGE = 'src/pages/MyVouchersPage.tsx'
const T = 'src/tests/unit/wallet-and-slop.test.ts'

export default [
  {
    name: '🎟️ 지갑 머리글에 장수가 다시 붙는다 (탭 배지와 같은 숫자를 두 번)',
    file: VPAGE,
    find: "        eyebrow={t('voucher.walletEyebrow', { defaultValue: '쓸 수 있는 이용권' })}\n        amount=",
    replace:
      "        eyebrow={t('voucher.walletEyebrow', { defaultValue: '쓸 수 있는 이용권' })}\n" +
      "        countText={`${unusedItems.length}${t('voucher.heroCountUnit', { defaultValue: '장' })}`}\n" +
      '        amount=',
    test: T,
    why:
      '정확히 종전 코드다. 금액 옆에 장수를 붙이는 건 늘 그럴듯해 보여서 다시 붙기 쉽고, ' +
      '그때 바로 아래 탭 배지가 같은 숫자를 또 말하는 것은 눈에 안 띈다.',
  },
  {
    name: '🎟️ 지갑 탭 배지(개수)가 사라진다 — 장수를 말하는 곳이 0이 된다',
    file: VPAGE,
    find: "{key === 'unused' && unusedItems.length > 0 &&",
    replace: '{false &&',
    test: T,
    why:
      '중복을 걷는 방향으로만 가드를 걸면 **둘 다 없어지는 것**은 못 막는다. 머리글에서 뺀 ' +
      '다음이라 탭 배지가 장수를 말하는 **유일한** 자리다 — 사라지면 "몇 장 남았나" 를 알 길이 없다.',
  },
]
