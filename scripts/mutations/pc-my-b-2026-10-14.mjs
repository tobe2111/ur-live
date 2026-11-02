/** 🗂️ PC 마이 B(2026-10-14 대표 확정 *"PC 마이는 B"*) — 모든 블록이 카드, 곧 쓸 이용권은 지갑과 같은 줄. */
export default [
  {
    name: '🗂️ PC 곧 쓸 이용권이 티켓 카드로 되돌아간다 (지갑과 모양이 갈린다)',
    file: 'src/pages/user-profile/AccountPcPane.tsx',
    find: "import WalletRow from '@/pages/my-vouchers/WalletRow'",
    replace: "import WalletRow from '@/pages/my-vouchers/WalletRow'\nimport { TicketCard } from '@/components/ticket/TicketCard'\nvoid TicketCard",
    test: 'src/tests/unit/account-pc-pane.test.ts',
    why: '같은 날 지갑이 안 B(줄)로 바뀌었다 — 같은 이용권이 지갑에선 줄, PC 마이에선 파란 밴드 티켓이면 한 서비스 안의 두 모양이다.',
  },
  {
    name: '🗂️ PC 카드 규칙이 lg 미디어쿼리 밖으로 샌다 (폰 마이까지 카드가 된다)',
    file: 'src/index.css',
    // 2026-11-02 앵커 재조준 — A안 평면으로 그 규칙의 바탕이 transparent 가 됐다(결함은 그대로: lg 밖으로 샌다).
    find: '  .ur-account-pc .ur-pc-card {\n    background: transparent;',
    replace: '}\n@supports (display: block) {\n  .ur-account-pc .ur-pc-card {\n    background: transparent;',
    test: 'src/tests/unit/my-zones-and-pc-2026-09-28.test.ts',
    why: '폰 마이는 안 C 평면(판은 파는 쪽에만)이다. 규칙이 lg 밖으로 새면 폰 손님 구역에 판이 서는데 빌드도 화면도 안 깨진다.',
  },
  {
    name: '🗂️ PC 칸 카드가 사라진다 (B 가 되돌아간다)',
    file: 'src/pages/user-profile/AccountPcPane.tsx',
    find: '    <div className="ur-pc-card">',
    replace: '    <div className="space-y-5 pb-2">',
    test: 'src/tests/unit/my-pc-plan5-2026-10-11.test.ts',
    why: '곧 쓸 이용권·현황이 다시 떠서 제목과 카드의 왼쪽 선이 어긋난다(대표 스크린샷 실측 1070↔1088).',
  },
]
