/**
 * ⏱️ 외부 호출 시간 제한 · 알림 waitUntil · 돈 값 0 위장 (2026-11-17) — 주입 매니페스트.
 * 가드: src/tests/unit/reliability-timeouts-2026-11-17.test.ts
 */
const TEST = 'src/tests/unit/reliability-timeouts-2026-11-17.test.ts'

export default [
  {
    name: '⏱️ 턴스타일 확인이 다시 시간 제한 없이 기다린다(확인 서버가 멈추면 후원 요청도 멈춘다)',
    file: 'src/worker/utils/turnstile.ts',
    find: "      { method: 'POST', body: formData, signal: AbortSignal.timeout(5000) },",
    replace: "      { method: 'POST', body: formData },",
    test: TEST,
    why: '외부 서비스 하나가 멈추면 그 서비스를 부르는 손님 요청이 플랫폼 한도까지 매달린다.',
  },
  {
    name: '💸 사장님 정산 잔액 조회 실패를 다시 0원으로 보여 준다',
    file: 'src/features/seller/api/seller-settlements.routes.ts',
    find: "    ).bind(sellerId).first<{ available_amount: number }>().catch(() => null);",
    replace: "    ).bind(sellerId).first<{ available_amount: number }>().catch(() => ({ available_amount: 0 }));",
    test: TEST,
    why: '받을 돈이 없다고 읽고 사장님이 문의하거나 잘못 판단한다.',
  },
]
