/** 🧬 주입 — 운영사 영입 매장 직접 10% (2026-11-16) · 가드: src/tests/unit/operator-recruited-direct-2026-11-16.test.ts */
const T = 'src/tests/unit/operator-recruited-direct-2026-11-16.test.ts'
export default [
  { name: 'operatordirect: 운영사 매장이 다시 5%', file: 'src/worker/utils/ledger-commission-policy.ts',
    find: "    let channel = operatorBrokeredAsDirect(meta?.store_channel, meta?.broker_user_id)", replace: "    let channel: unknown = meta?.store_channel", test: T,
    why: '대표가 직접 데려온 매장이 떼어 줄 사람도 없는데 5% 만 걷힌다.' },
  { name: 'operatordirect: 대표 계정 id 오기(30)', file: 'src/worker/utils/ledger-commission-policy.ts',
    find: 'export const PLATFORM_OPERATOR_USER_IDS: readonly number[] = [3]', replace: 'export const PLATFORM_OPERATOR_USER_IDS: readonly number[] = [30]', test: T,
    why: '헷갈리는 짝(30 "유어팀 (정지원)")으로 바뀌면 규칙이 아무 매장에도 안 걸린다.' },
  { name: 'operatordirect: 운영사에게 중개사 몫 적립', file: 'src/worker/utils/broker-share.ts',
    find: '    if (PLATFORM_OPERATOR_USER_IDS.includes(terms.brokerUserId)) return { credited: 0, brokerUserId: null }', replace: '', test: T,
    why: '10% 를 걷으면서 중개사 몫까지 대표 개인에게 나가면 이중으로 셈한다.' },
  { name: 'operatordirect: 운영사 에이전시 매장이 5%', file: 'src/worker/utils/ledger-commission-policy.ts',
    find: "    if (channel === 'brokered' && await isOperatorAgencyStore(DB, id)) channel = 'direct'", replace: '    if (false) channel = channel', test: T,
    why: '유어팀(옛 리스터코퍼레이션)이 맡은 매장이 5% 만 걷힌다.' },
  { name: 'operatordirect: 운영사 에이전시에 몫 적립', file: 'src/worker/utils/agency-share-payout.ts',
    find: '    if (PLATFORM_OPERATOR_AGENCY_IDS.includes(ag.agencyId)) return { credited: 0, agencyId: ag.agencyId, matched: true }', replace: '', test: T,
    why: '10% 를 걷으면서 자기 회사 에이전시 몫까지 셈한다.' },
  { name: 'operatordirect: 운영사 에이전시 등록이 중개로 저장', file: 'src/features/agency-console/api/agency-store-register.ts',
    find: "store_channel: PLATFORM_OPERATOR_AGENCY_IDS.includes(me.agencyId) ? 'direct' : 'brokered',", replace: "store_channel: 'brokered',", test: T,
    why: '유어팀이 등록한 매장의 사장님 화면에 5% 가 뜨는데 실제로는 10% 가 떼인다.' },
]
