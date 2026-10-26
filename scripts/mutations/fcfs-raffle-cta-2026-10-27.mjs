/** 🧬 주입 — 추첨 상품 하단 [응모하기](2026-10-27). 가드: src/tests/unit/fcfs-raffle-cta-2026-10-27.test.tsx */
const T = 'src/tests/unit/fcfs-raffle-cta-2026-10-27.test.tsx'
export default [
  {
    name: 'fcfs-raffle-cta — 모바일 바가 추첨 상품에도 결제 창을 연다',
    file: 'src/pages/group-buy/DealBottomBar.tsx',
    find: '  const raffle = fcfs.gate && !isPrelaunch && !isOwner\n',
    replace: '  const raffle = false && fcfs.gate && !isPrelaunch && !isOwner\n',
    test: T,
    why: '결제하기를 눌렀더니 "당첨자만 구매" 오류(대표 신고).',
  },
  {
    name: 'fcfs-raffle-cta — 당첨자도 응모 버튼에 갇힌다',
    file: 'src/features/group-buy/useFcfsDetail.ts',
    find: '  const gate = enabled && !isWinner && !isPaid\n',
    replace: '  const gate = enabled\n',
    test: T,
    why: '당첨자가 결제를 못 한다.',
  },
  {
    name: 'fcfs-raffle-cta — PC 상자는 계속 결제 버튼',
    file: 'src/pages/group-buy/DealPurchaseBox.tsx',
    find: '  const raffle = fcfs.gate && !isPrelaunch && !isOwner\n',
    replace: '  const raffle = false\n',
    test: T,
    why: 'PC 에서 같은 오류가 남는다(모바일만 고쳐지는 클래스).',
  },
]
