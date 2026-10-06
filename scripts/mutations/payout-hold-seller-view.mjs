/**
 * 🕙 유보를 사장님 화면도 알게 한다 (2026-09-24 — #1521 의 짝) — 주입 매니페스트.
 *
 * #1521 은 약관·가이드를 고치고 **대시보드를 빼먹었다**. 그 자리가 조용한 이유는 단순하다 —
 * 숫자는 맞고 **설명만 틀리기** 때문에 어떤 테스트도 어떤 에러도 안 난다.
 *
 * 가드: src/tests/unit/payout-hold-seller-view-2026-09-24.test.ts
 */
const TEST = 'src/tests/unit/payout-hold-seller-view-2026-09-24.test.ts'
const API = 'src/features/seller/api/seller-settlements/payouts.ts'
const VIEW = 'src/pages/seller-settlements/AutoPayoutSection.tsx'

export default [
  {
    name: '🕙 heldSql 이 NULL 행을 안 줍는다 — 어느 쪽에도 안 잡히는 원장 행이 생긴다',
    file: 'src/worker/utils/payout-hold.ts',
    find: "heldSql: `AND (created_at > ${cutoff} OR created_at IS NULL)`",
    replace: "heldSql: `AND created_at > ${cutoff}`",
    test: TEST,
    why: 'SQL 3값 논리에서 NULL 은 <= 도 > 도 거짓이다. 순진하게 부등호만 뒤집으면 그 행은 cron 집계에서도 빠지고 화면의 "유보 중"에서도 빠져, 사장님에게 존재를 통째로 숨긴다.',
  },
  {
    name: '🕙 셀러 API 가 SSOT 대신 cutoff 를 손으로 짓는다',
    file: API,
    find: '              ${hold.heldSql}',
    replace: "              AND created_at > datetime('now', '-14 days')",
    test: TEST,
    why: '부등호를 손으로 쓰면 payout_hold_days 를 바꾼 날 cron 만 따라가고 화면은 14 에 멈춘다. 사장님이 보는 "유보 중"과 실제 집계가 갈리는데 에러가 안 난다.',
  },
  {
    name: '🕙 응답에서 hold_days 가 빠져 화면이 유보를 모른 채 "다음 집계 대상" 으로 돌아간다',
    file: API,
    find: '        hold_days: hold.days,',
    replace: '',
    test: TEST,
    why: '#1521 직후의 바로 그 상태 — 적립 당일 돈에 대고 "다음 집계 대상" 이라고 말한다.',
  },
  {
    name: '🕙 held 클램프가 빠져 "그중 N" 이 미지급보다 커진다',
    file: API,
    find: 'Math.min(payable, Math.max(0, Math.round(Number(heldRow?.held) || 0)))',
    replace: 'Math.max(0, Math.round(Number(heldRow?.held) || 0))',
    test: TEST,
    why: '유보 이전에 지급된 건이 있으면 원장 기준 held 가 미지급을 넘는다. 화면이 "미지급 1만원 · 그중 3만원 유보 중" 이라고 말하게 된다.',
  },
  {
    name: '🕙 화면이 유보일을 지어낸다 — 서버 값 대신 상수',
    file: VIEW,
    find: 'const holdDays = data?.hold_days ?? 0',
    replace: 'const holdDays = 14',
    test: TEST,
    why: 'platform_settings.payout_hold_days 를 조정한 날(그게 이 기능의 롤백 수단이다) 안내가 즉시 거짓말이 된다. 유보를 껐는데도 "14일 뒤 집계" 라고 말한다.',
  },
  {
    name: '🕙 유보 중인 몫이 있어도 힌트가 안 바뀐다',
    file: VIEW,
    find: 'hint={held > 0',
    replace: 'hint={false',
    test: TEST,
    why: '카드에 "다음 집계 대상" 만 남아, 2주 동안 안 움직일 돈을 다음 주에 들어온다고 말한다.',
  },
  {
    name: '🕙 어드민 설정 화면이 아무도 안 읽는 죽은 키로 되돌아간다',
    file: 'src/pages/AdminPlatformSettingsPage.tsx',
    find: "{ key: 'payout_hold_days', label: '정산 유보 기간",
    replace: "{ key: 'settlement_hold_days', label: '정산 유보 기간",
    test: TEST,
    why: 'settlement_hold_days 는 읽는 코드가 0이다(2026-09-24 전수 실측). 유보를 줄이거나 끄려고 그 값을 고치면 아무 일도 안 일어나는데 화면은 저장됐다고 말한다 — 이 기능의 롤백 수단이 통째로 죽는다.',
  },
  {
    name: '🕙 유보일 저장에 범위 검증이 빠져 오타가 조용히 기본값이 된다',
    file: 'src/worker/utils/platform-settings-validation.ts',
    find: '  payout_hold_days: intRange(0, 365),',
    replace: '',
    test: TEST,
    why: '미등록 키는 pass-through 라 "abc" 가 저장된다. resolvePayoutHold 는 fail-closed 로 14 를 쓰므로, 대표는 0 을 넣었다고 믿는데 돈은 계속 2주 묶인다.',
  },
]
