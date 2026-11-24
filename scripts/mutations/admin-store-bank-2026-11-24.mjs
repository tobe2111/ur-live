/** 🧬 주입 — 어드민 매장 정산 계좌 대신 입력 (2026-11-24) · 가드: src/tests/unit/admin-store-bank-2026-11-24.test.ts */
const T = 'src/tests/unit/admin-store-bank-2026-11-24.test.ts'
const F = 'src/features/admin/api/admin-store-bank.routes.ts'
export default [
  { name: 'storebank: 확인 없이 기존 계좌를 덮어쓴다', file: F,
    find: "    if (had && (body as { confirm_overwrite?: unknown }).confirm_overwrite !== true) {", replace: '    if (false) {', test: T,
    why: '이미 등록된 계좌가 실수 한 번으로 갈아끼워진다 — 그 매장 돈이 다른 곳으로 간다.' },
  { name: 'storebank: 운영(ops) 역할도 계좌를 바꾼다', file: 'src/shared/admin-roles.ts',
    find: "  { pattern: /\\/sellers\\/[^/]+\\/bank-account(?:$|[/?])/, allow: ['finance'] },", replace: "  { pattern: /\\/sellers\\/[^/]+\\/bank-account-x(?:$|[/?])/, allow: ['finance'] },", test: T,
    why: '넓은 sellers 권한(ops)에 정산 목적지 변경이 실려 샌다.' },
  { name: 'storebank: 응답에 계좌번호 전체가 나간다', file: F,
    find: "      data: { registered: true, bank_name: input.bank_name, bank_account_masked: mask(input.bank_account), account_holder: input.account_holder },", replace: "      data: { registered: true, bank_name: input.bank_name, bank_account_masked: input.bank_account, account_holder: input.account_holder },", test: T,
    why: '어드민 화면·네트워크 기록에 계좌번호 전체가 남는다.' },
  { name: 'storebank: 사장님에게 알리지 않는다', file: F,
    find: "    ).bind(String(id), '🏦 정산 계좌가 등록됐어요',", replace: "    ).bind('0', '🏦 정산 계좌가 등록됐어요',", test: T,
    why: '사장님이 모르는 사이 정산 계좌가 바뀌어도 알아챌 길이 없다.' },
  { name: 'storebank: 목록 밖 은행 이름을 받는다', file: F,
    find: "  if (!(BANKS as readonly string[]).includes(bank)) return { error: '은행을 목록에서 골라 주세요' }", replace: '', test: T,
    why: '이체 파일·지급대행이 은행 코드를 못 찾는 이름이 저장된다.' },
  { name: 'storebank: 알림에 계좌번호 전체를 싣는다', file: F,
    find: "`유어딜이 ${input.bank_name} ${mask(input.bank_account)}(${input.account_holder})", replace: "`유어딜이 ${input.bank_name} ${input.bank_account}(${input.account_holder})", test: T,
    why: '알림 목록에 계좌번호 전체가 남는다.' },
]
