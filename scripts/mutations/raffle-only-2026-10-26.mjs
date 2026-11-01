/** 🧬 주입 — 추첨(데모) 이용권은 응모만(2026-10-26). 가드: src/tests/unit/fcfs-raffle-cta-2026-10-27.test.tsx */
const T = 'src/tests/unit/fcfs-raffle-cta-2026-10-27.test.tsx'
export default [
  {
    name: 'raffle-only — PC 상자가 추첨인데도 수량을 그린다',
    file: 'src/pages/group-buy/DealPurchaseBox.tsx',
    find: "      {!raffle && <div style={{ margin: '16px 0 12px' }}>",
    replace: "      {true && <div style={{ margin: '16px 0 12px' }}>",
    test: T,
    why: '응모만 되는 데모에 수량·결제 흔적이 남는다.',
  },
  {
    name: 'raffle-only — 추첨 여부를 모르는 틈에 결제 창이 열린다',
    file: 'src/pages/group-buy/DealBottomBar.tsx',
    find: ': () => { if (!fcfs.pending) setOpen(true) }}',
    replace: ': () => { setOpen(true) }}',
    test: T,
    why: '데모 상세를 열자마자 누르면 결제 창이 뜬다.',
  },
]
