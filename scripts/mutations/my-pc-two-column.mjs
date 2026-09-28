/**
 * 🖥️ PC 마이 2열 되돌려-검증 주입 (2026-09-28).
 * 가드: src/tests/unit/my-pc-two-column-2026-09-28.test.ts
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일.
 */
const TEST = 'src/tests/unit/my-pc-two-column-2026-09-28.test.ts'
const PAGE = 'src/pages/UserProfilePage.tsx'
const CSS = 'src/index.css'

export default [
  {
    name: '🖥️PC2열 좌석과 무관하게 늘 쪼갠다 (손님 화면이 깨진다)',
    file: PAGE,
    find: "      <div className={sellerSeats.stores.length > 0 ? 'ur-account-cols ur-account-cols--split' : 'ur-account-cols'}>",
    replace: '      <div className="ur-account-cols ur-account-cols--split">',
    test: TEST,
    why: '가게가 없으면 왼쪽 열이 통째로 비고 손님 블록이 전부 좁은 오른쪽으로 몰린다(첫 판에서 실제로 그랬다).',
  },
  {
    name: '🖥️PC2열 균등으로 쪼갠다',
    file: CSS,
    // ⚠️ 앵커는 #3 과 **겹치면 안 된다** — 같은 문자열을 두 주입이 쓰면 러너가 복원을 오인한다(실제로 겪었다).
    find: 'grid-template-columns: 1.25fr 1fr;',
    replace: 'grid-template-columns: 1fr 1fr;',
    test: TEST,
    why: '균등이면 한 칸이 폰(430)보다 좁아진다 — 09-28 에 "2열 안 함" 으로 결론 냈던 그 계산이 균등 전제였다.',
  },
  {
    name: '🖥️PC2열 짧은 열을 긴 열 높이로 늘린다',
    file: CSS,
    find: '    gap: 24px;\n    align-items: start;\n  }',
    replace: '    gap: 24px;\n  }',
    test: TEST,
    why: '`align-items: start` 가 없으면 짧은 쪽 카드가 늘어나 붕 뜬다.',
  },
  {
    name: '🖥️PC2열 좁은 칸에서 격자를 안 접는다',
    file: CSS,
    find: '  .ur-account-cols--split .ur-account-col--narrow .grid-cols-4',
    replace: '  .ur-account-cols--split .ur-account-col--narrow .grid-cols-XX',
    test: TEST,
    why: '접지 않으면 알약이 `내...` `찜.` 으로 잘린다(첫 판의 실제 결함).',
  },
  {
    name: '🖥️PC2열 금액을 다시 두 줄로 갈라지게 둔다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: 'tabular-nums leading-none whitespace-nowrap text-gray-900',
    replace: 'tabular-nums leading-none text-gray-900',
    test: TEST,
    why: '카드가 ≈340px 로 좁아져 `412,000` 과 `원` 이 갈라졌다 — 금액은 한 덩어리로 읽혀야 한다.',
  },
]
