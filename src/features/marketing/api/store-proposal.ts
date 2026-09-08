/**
 * ✉️ 매장 입점 제안 문구 초안 — 결재 store-acquisition-pipeline 선택지 1 "매장별 제안 문구 초안(이용권 예시·수수료 채널 안내 포함)".
 *   순수 함수: 매장 1곳 + 요율 → 제목/본문/문자(SMS) 초안. **발송 코드 없음** — 대표가 복사해 직접 보낸다.
 *   허위 0: 매장이 준 사실(이름·업종·지역·개업일)과 코드 SSOT 요율(fee-resolver, 어드민 조정 기본값)만 넣는다.
 *   개업 브리핑(opening-briefing)이 "축하 + 상권 수치" 문구라면 이것은 "입점 제안 + 조건 + 등록 링크" 문구다 — 둘 다 어드민 열람용.
 */

export interface ProposalStore {
  id: number; biz_name: string; category: string | null; region: string | null; apv_perm_ymd?: string | null; is_new_open?: number
}
export interface ProposalRates { platformPctDirect: number; platformPct: number }
export interface ProposalDraft { subject: string; body: string; sms: string; register_url: string }

export const REGISTER_URL = 'https://urdeal.kr/business'

/** 업종별 이용권 예시 — 숫자는 예시임을 문구에 명시(가격은 사장님이 정한다). */
export function voucherExampleFor(category: string | null): string {
  const c = category || ''
  if (/음식점|카페|휴게/.test(c)) return '예) 12,000원 런치 세트 → 이용권 9,900원 · 첫 방문 손님이 미리 사 두고 매장에서 QR 로 사용'
  if (/미용|이용업|목욕/.test(c)) return '예) 커트 20,000원 → 첫 방문 이용권 15,000원 · 재방문은 정가'
  if (/숙박/.test(c)) return '예) 평일 1박 → 조기예약 이용권 · 빈 객실을 동네 손님에게 먼저'
  if (/체력|체육|골프|당구|노래/.test(c)) return '예) 1일 체험권 · 10회권 → 이용권으로 미리 판매, 노쇼 0'
  if (/약국|병원|동물/.test(c)) return '예) 첫 방문 건강상담·케어 패키지 이용권'
  if (/학원/.test(c)) return '예) 체험 수업 1회권 → 이용권으로 미리 등록'
  return '예) 대표 메뉴·서비스 1개를 첫 방문 이용권으로'
}

const fmtYmd = (y?: string | null) => y && y.length === 8 ? `${y.slice(0, 4)}.${y.slice(4, 6)}.${y.slice(6, 8)}` : ''

export function proposalDraft(store: ProposalStore, rates: ProposalRates): ProposalDraft {
  const name = (store.biz_name || '').slice(0, 40)
  const region = store.region || ''
  const cat = store.category || ''
  const direct = Math.round(rates.platformPctDirect)
  const brokered = Math.round(rates.platformPct)
  const isNew = !!store.is_new_open && !!store.apv_perm_ymd
  const url = `${REGISTER_URL}?ref=store-${store.id}`

  const subject = `[유어딜] ${name} 사장님께 — ${region ? `${region} ` : ''}동네 손님에게 이용권으로 먼저 닿는 방법`

  const b: string[] = []
  b.push(`${name} 사장님, 안녕하세요. 동네 할인 플랫폼 유어딜입니다.`)
  if (isNew) b.push(`${fmtYmd(store.apv_perm_ymd)} 개업 진심으로 축하드립니다.`)
  b.push('')
  b.push(`유어딜은 ${region ? `${region} ` : '동네 '}주민이 근처 매장의 이용권을 미리 사고 매장에서 QR 로 쓰는 서비스입니다.${cat ? ` ${cat} 매장은 이렇게 쓰실 수 있습니다.` : ''}`)
  b.push(`· ${voucherExampleFor(store.category)}`)
  b.push('')
  b.push('조건은 단순합니다.')
  b.push('· 입점비·월 고정비 0원 — 이용권이 실제로 팔릴 때만 수수료가 나갑니다.')
  b.push(`· 사장님이 직접 등록해 운영하면 판매액의 ${direct}%, 저희가 등록·관리까지 대신하면 ${brokered}% 입니다(기본값, 상담 시 안내).`)
  b.push('· 가격·수량·기간은 사장님이 정하고, 언제든 내릴 수 있습니다.')
  b.push('')
  b.push(`등록은 5분이면 됩니다: ${url}`)
  b.push('편하신 시간 알려주시면 전화로 5분 안에 설명드리겠습니다.')
  b.push('')
  b.push('유어딜 드림 · urdeal.kr')

  const sms = `[유어딜] ${name} 사장님, 동네 주민에게 이용권으로 먼저 닿는 서비스입니다. 입점비 0원, 팔릴 때만 ${brokered}~${direct}%. 등록 5분: ${url}`
  return { subject, body: b.join('\n'), sms, register_url: url }
}
