/** 🧬 주입 — 운영사 영입 매장 직접 10% (2026-11-16) · 가드: src/tests/unit/operator-recruited-direct-2026-11-16.test.ts */
const T = 'src/tests/unit/operator-recruited-direct-2026-11-16.test.ts'
export default [
  { name: 'operatordirect: 운영사 매장이 다시 5%', file: 'src/worker/utils/ledger-commission-policy.ts',
    find: "    const channel = operatorBrokeredAsDirect(meta?.store_channel, meta?.broker_user_id)", replace: '    const channel = meta?.store_channel', test: T,
    why: '대표가 직접 데려온 매장이 떼어 줄 사람도 없는데 5% 만 걷힌다.' },
  { name: 'operatordirect: 대표 계정 id 오기(30)', file: 'src/worker/utils/ledger-commission-policy.ts',
    find: 'export const PLATFORM_OPERATOR_USER_IDS: readonly number[] = [3]', replace: 'export const PLATFORM_OPERATOR_USER_IDS: readonly number[] = [30]', test: T,
    why: '헷갈리는 짝(30 "유어팀 (정지원)")으로 바뀌면 규칙이 아무 매장에도 안 걸린다.' },
  { name: 'operatordirect: 운영사에게 중개사 몫 적립', file: 'src/worker/utils/broker-share.ts',
    find: '    if (PLATFORM_OPERATOR_USER_IDS.includes(terms.brokerUserId)) return { credited: 0, brokerUserId: null }', replace: '', test: T,
    why: '10% 를 걷으면서 중개사 몫까지 대표 개인에게 나가면 이중으로 셈한다.' },
]
