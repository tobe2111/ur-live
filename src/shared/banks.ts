/**
 * 🏦 입금 은행 목록 — 화면이 여럿이어도 **한 벌**(2026-10-12).
 *
 * 셀러 정산 계좌(`BankSheet`)와 손님 충전 잔액 환급(`RefundSheet`)이 같은 목록을 쓴다.
 * 한쪽에만 은행이 늘면 그쪽 사람만 자기 은행을 못 찾는다(에러는 안 난다).
 */
export const BANKS = ['KB국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행', 'IBK기업은행', 'SC제일은행', '한국씨티은행', '케이뱅크', '카카오뱅크', '토스뱅크', '새마을금고', '신협', '우체국', '부산은행', '경남은행', '대구은행', '광주은행', '전북은행', '제주은행', '수협은행', '산업은행'] as const

/**
 * 🏦 은행 표준 코드(금융결제원 3자리) — 토스 지급대행 셀러 등록에 쓴다(2026-11-03).
 * 위 `BANKS` 와 같은 이름을 키로 둔다. 목록에 은행이 늘면 여기도 한 줄 — 가드가 둘의 짝을 본다.
 */
export const BANK_CODES: Record<(typeof BANKS)[number], string> = {
  'KB국민은행': '004', '신한은행': '088', '우리은행': '020', '하나은행': '081', 'NH농협은행': '011',
  'IBK기업은행': '003', 'SC제일은행': '023', '한국씨티은행': '027', '케이뱅크': '089', '카카오뱅크': '090',
  '토스뱅크': '092', '새마을금고': '045', '신협': '048', '우체국': '071', '부산은행': '032',
  '경남은행': '039', '대구은행': '031', '광주은행': '034', '전북은행': '037', '제주은행': '035',
  '수협은행': '007', '산업은행': '002',
}

/** 저장된 은행 이름 → 3자리 코드. "국민"·"KB국민"·"농협" 같은 옛 표기도 받는다. 모르면 null. */
export function bankCodeOf(name: string | null | undefined): string | null {
  const n = String(name ?? '').replace(/\s/g, '')
  if (!n) return null
  if (n in BANK_CODES) return BANK_CODES[n as keyof typeof BANK_CODES]
  const core = (s: string) => s.replace(/은행$/, '').replace(/^(KB|NH|IBK|SC)/, '')
  const target = core(n)
  for (const [k, v] of Object.entries(BANK_CODES)) {
    if (core(k) === target || (target.length >= 2 && k.includes(target))) return v
  }
  return null
}
