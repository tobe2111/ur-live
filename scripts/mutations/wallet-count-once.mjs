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

// 🔀 2026-10-14 대표 확정 안 B: 장수를 말하는 **한 곳**이 탭 배지 → 요약 카드로 옮겨갔다. 두 방향은 그대로다.
export default [
  {
    name: '🎟️ 지갑 탭에 개수 배지가 돌아온다 (요약 카드와 같은 숫자를 두 번)',
    file: VPAGE,
    find: '                  {tab === key && <span aria-hidden="true" className="absolute left-0 right-0 -bottom-px h-[2.5px] bg-brand" />}',
    replace:
      "                  {key === 'unused' && unusedItems.length > 0 && <span className=\"ml-1 text-[13px] font-bold text-brand-text tabular-nums\">{unusedItems.length}</span>}\n" +
      '                  {tab === key && <span aria-hidden="true" className="absolute left-0 right-0 -bottom-px h-[2.5px] bg-brand" />}',
    test: T,
    why:
      '정확히 종전 코드다. 탭에 개수를 붙이는 건 늘 그럴듯해 보여서 다시 붙기 쉽고, ' +
      '그때 바로 위 요약 카드가 같은 숫자를 크게 말하고 있다는 것은 눈에 안 띈다.',
  },
  {
    name: '🎟️ 지갑 요약 카드가 장수를 안 받는다 — 장수를 말하는 곳이 0이 된다',
    file: VPAGE,
    find: '<WalletSummaryCard count={unusedItems.length}',
    replace: '<WalletSummaryCard count={0}',
    test: T,
    why:
      '중복을 걷는 방향으로만 가드를 걸면 **둘 다 없어지는 것**은 못 막는다. 요약 카드가 장수를 말하는 ' +
      '**유일한** 자리다 — 0 으로 박히면 "몇 장 남았나" 를 알 길이 없고 에러도 없다.',
  },
]
