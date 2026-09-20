/**
 * 🪙 결제 화면 딜 조절(C안) — 주입 매니페스트 (2026-09-19).
 * 가드: src/tests/unit/pay-deal-use-card-2026-09-19.test.tsx
 *
 * 이 변경은 **잠금 파일**(Toss V2 감사)을 건드렸고 승인 범위는 "최소" 였다.
 * 아래 회귀는 전부 조용하다 — 화면은 멀쩡히 뜨고 타입도 통과하는데, 결제 직전이나
 * 승인 직후에야 틀어진다. 그래서 기계가 대신 깨뜨려 본다.
 */
const TEST = 'src/tests/unit/pay-deal-use-card-2026-09-19.test.tsx'

export default [
  {
    name: '🪙 딜 상한이 최소 카드액을 안 남긴다 (0원 결제 → PG 거절)',
    file: 'src/pages/pay/DealUseCard.tsx',
    find: '  const byCard = Math.max(0, Math.round(goodsAmount) - MIN_CARD_AMOUNT)',
    replace: '  const byCard = Math.max(0, Math.round(goodsAmount))',
    test: TEST,
    why: '딜이 총액을 다 덮으면 카드 청구액이 0 이 된다 — 토스가 거절하고, 그건 부분결제가 아니라 전부-딜(다른 흐름)이다.',
  },
  {
    name: '🪙 setAmount 재호출이 ready 가드를 잃는다 (초기화 경로 침범)',
    file: 'src/pages/TossWidgetPayPage.tsx',
    find: "    if (state !== 'ready' || !widgetsRef.current) return",
    replace: '    if (!widgetsRef.current) return',
    test: TEST,
    why: '초기화 effect 의 setAmount 와 경쟁하면 위젯이 아는 금액이 비결정적으로 갈린다 — 화면과 청구액이 달라지는 유일한 실패 모드.',
  },
  {
    name: '🪙 초기 딜이 0 으로 바뀐다 (손 안 대도 종전과 달라짐)',
    file: 'src/pages/TossWidgetPayPage.tsx',
    find: '  const [dealUsed, setDealUsed] = useState(summary.dealUsed ?? 0)',
    replace: '  const [dealUsed, setDealUsed] = useState(0)',
    test: TEST,
    why: '상세에서 고른 딜이 결제 화면에서 조용히 0 이 된다 — 청구액이 갑자기 총액이 되고 아무 에러도 안 난다.',
  },
  {
    name: '🪙 딜 카드 렌더 블록이 통째로 사라진다 (import 만 남음)',
    file: 'src/pages/TossWidgetPayPage.tsx',
    find: `        <DealUseCard
          goodsAmount={goodsAmount}
          dealMax={summary.dealMax ?? summary.dealUsed ?? 0}
          value={dealUsed}
          onChange={setDealUsed}
          disabled={state !== 'ready'}
        />
`,
    replace: '',
    test: TEST,
    why: 'import 가 남아 있으면 "배선돼 있다"는 검사가 헛돌 수 있다 — 리팩토링이 실제로 지우는 모양(블록 삭제)으로 앵커한다.',
  },
  {
    name: '🪙 최소 카드액이 서버에 두 번째로 선언된다 (SSOT 분열)',
    file: 'src/features/group-buy/api/partial-deal.ts',
    find: "export { MIN_CARD_AMOUNT } from '../../../shared/pay-summary'",
    replace: 'export const MIN_CARD_AMOUNT = 100',
    test: TEST,
    why: '두 벌이 되면 한쪽만 바뀌는 날 화면이 허용한 금액을 서버가 거절한다 — 사용자는 결제 직전에야 안다.',
  },
]
