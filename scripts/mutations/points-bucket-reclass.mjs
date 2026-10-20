// 🪣 2026-10-15 — 충전 기록 없는 유상 잔액을 무상으로 옮기는 도구(32·24번 실사례). 돈을 만진다.
const FILE = 'src/worker/utils/points-reconcile.ts'
const TEST = 'src/tests/unit/points-reconcile.test.ts'
export default [
  {
    name: '🪣 재분류 도구의 dry-run 이 사라진다 (검사만 하려다 버킷이 옮겨진다)',
    file: FILE,
    find: '  if (apply !== true) return { found, results, applied: false } // 기본 dry-run — 버킷을 안 건드린다',
    replace: '',
    test: TEST,
    why: '돈을 만지는 도구는 보기만 해도 안전해야 한다 — 검사 버튼이 실행이 되면 사람이 판단할 기회가 사라진다.',
  },
  {
    name: '🪣 재분류가 실제로 충전한 계정까지 무상으로 옮긴다',
    file: FILE,
    find: "                   WHERE pt.user_id = up.user_id AND pt.type = 'charge' AND COALESCE(pt.amount, 0) > 0)`",
    replace: "                   WHERE 0)`",
    test: TEST,
    why: '돈을 낸 계정의 유상 잔액은 환급받을 권리가 있는 돈이다. 무상으로 옮기면 그 돈을 못 돌려받는다.',
  },
  {
    name: '🪣 재분류 UPDATE 가 조건을 다시 확인하지 않는다 (사이에 들어온 충전까지 옮긴다)',
    file: FILE,
    find: '       WHERE user_id = ? AND user_id IN (SELECT up.user_id FROM user_points up WHERE ${UNPAID_WITH_PAID_BALANCE})`,',
    replace: '       WHERE user_id = ?`,',
    test: TEST,
    why: '조회와 UPDATE 사이에 충전이 끼면 그 유상분까지 무상이 된다 — CAS 가 머니 룰 #1 이다.',
  },
  {
    name: '📅 보정행 날짜가 다시 2026-08-31 고정값으로',
    file: FILE,
    find: "  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10)",
    replace: "  return '2026-08-31'",
    test: TEST,
    why: '10월에 쓴 보정행이 8월에 쓴 것처럼 읽혀 감사 때 시점을 오판한다.',
  },
]
