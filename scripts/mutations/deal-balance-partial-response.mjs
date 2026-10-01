/**
 * 🧨 2026-10-01 — "응답 필드가 비어도 정산 화면이 죽지 않는다" 의 되돌려-검증.
 *
 * 되돌리려는 사고: `balance.total.toLocaleString()` 처럼 **응답 필드에 직접** 포매팅을 부르면
 * 필드 하나가 비는 순간 카드가 아니라 **정산 화면 전체**가 ErrorBoundary 로 날아간다.
 * 프로덕션은 `drop_console: true` 라 원인도 안 남는다(콘솔을 살린 빌드로 재서야 찾았다).
 */
const TEST = 'src/tests/unit/deal-balance-partial-response-2026-10-01.test.tsx'
const FILE = 'src/pages/seller-settlements/DealBalanceCard.tsx'

export default [
  {
    name: '🛡️ 딜 잔액이 응답 필드에 직접 포매팅을 부른다 (정산 화면 전체가 죽는다)',
    why: '`if (!balance) return null` 은 null 만 막는다 — 빈 객체·배열·필드 누락은 통과하고 그 순간 화면이 통째로 날아간다.',
    file: FILE,
    find: '{formatNumber(balance.total)}<span',
    replace: '{balance.total.toLocaleString()}<span',
    test: TEST,
  },
  {
    name: '🛡️ 뺄셈이 NaN 방어 없이 돌아간다 (화면에 "NaN" 이 뜬다)',
    why: '한쪽 필드만 비어도 `total − withdrawable` 이 NaN 이 된다 — 2026-05-17 ₩NaN 사고와 같은 클래스다.',
    file: FILE,
    find: '{formatNumber(safeMinus(balance.total, balance.withdrawable))}',
    replace: '{(balance.total - balance.withdrawable).toLocaleString()}',
    test: TEST,
  },
  {
    name: '🛡️ 원천징수 숫자가 응답 필드에 직접 붙는다',
    why: 'tax 는 별도 API 라 한쪽만 깨질 수 있다 — 그때도 화면 전체를 잃으면 안 된다.',
    file: FILE,
    find: '₩{formatNumber(tax.total_gross)}',
    replace: '₩{tax.total_gross.toLocaleString()}',
    test: TEST,
  },
]
