/**
 * 💵 유어애즈 월 예산 — 초과 $0 (2026-10-06 대표 *"그 $5 이상을 넘으면 절대 안돼.
 * 유어딜 사용자 많아지는 것도 감안해야하고"*) — 주입 매니페스트.
 *
 * Workers Paid 는 기본료 $5/월이라 D1 포함분(5,000만 행)을 1행 넘기면 그게 곧 $5 초과다.
 * 이 조가 막는 것은 **"계획이 포함분에 딱 붙는 것"** 과 **"예약분이 오늘 크기에 맞춰지는 것"** 둘이다.
 * 둘 다 깨져도 에러가 안 나고 **청구서로만** 드러난다 — 그래서 가드가 유일한 방어다.
 *
 * 가드: src/tests/unit/ads-monthly-write-budget.test.ts
 */
const TEST = 'src/tests/unit/ads-monthly-write-budget.test.ts'
const SRC = 'src/worker-ads/read-budget.ts'

export default [
  {
    name: '💵 안전버퍼가 0 으로 꺼져 계획이 포함분에 딱 붙는다',
    file: SRC,
    find: 'export const MONTHLY_SAFETY_BUFFER = 4_000_000',
    replace: 'export const MONTHLY_SAFETY_BUFFER = 0',
    test: TEST,
    why: '버퍼는 "유어딜이 예약분마저 넘겨 자람 · 원장 과소계수 · 월말 튐" 셋을 덮는 유일한 여백이다. 0 이면 계획이 포함분과 같아져 어느 하나만 틀려도 과금으로 넘어간다.',
  },
  {
    name: '💵 유어딜 예약분이 2026-09 값(오늘 크기)으로 되돌아간다',
    file: SRC,
    find: 'export const URDEAL_MONTHLY_RESERVE = 6_000_000',
    replace: 'export const URDEAL_MONTHLY_RESERVE = 1_500_000',
    test: TEST,
    why: '1,500,000 은 실측 1,373,461 의 **1.09배**뿐이었다 — 유어딜 사용자가 10% 늘면 유어애즈가 본진 몫을 먹고 계정 전체가 포함분을 넘는다. 예약분은 오늘 크기가 아니라 성장 여유로 잡아야 한다.',
  },
  {
    name: '💵 역산식이 안전버퍼를 안 빼고 월 몫을 계산한다',
    file: SRC,
    find: 'const left = allowance - reserve - buffer - spent',
    replace: 'const left = allowance - reserve - spent',
    test: TEST,
    why: '상수만 선언하고 식에서 빼지 않으면 버퍼가 **이름만 존재**한다 — 가장 조용한 실패 모양이고, 상수를 grep 하면 있는 것처럼 보인다.',
  },
  {
    name: '💵 하트비트의 `mleft` 가 버퍼를 안 빼 남은 몫을 과대보고한다',
    file: SRC,
    find: 'monthLeft: Math.max(0, MONTHLY_WRITE_ALLOWANCE - URDEAL_MONTHLY_RESERVE - MONTHLY_SAFETY_BUFFER - writtenMonth),',
    replace: 'monthLeft: Math.max(0, MONTHLY_WRITE_ALLOWANCE - URDEAL_MONTHLY_RESERVE - writtenMonth),',
    test: TEST,
    why: '`mleft` 는 사람이 월 상태를 판정할 때 읽는 유일한 숫자다(예약된 월 판정이 그 값을 본다). 식과 어긋나면 "아직 400만 남았다"고 보고하면서 실제로는 버퍼를 태우고 있게 된다.',
  },
]
