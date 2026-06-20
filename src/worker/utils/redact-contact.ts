/**
 * 🛡️ 2026-06-18 채팅 disintermediation 방지 — 제조사↔유통사 채팅에서 연락처/외부결제 정보 자동 마스킹.
 *
 * 목적: 플랫폼 밖 직거래(연락처 교환 → 외부 거래로 수수료 우회) 차단. 메시지 저장 전 redact →
 *   DB 에 연락처가 남지 않음 + 상대에게도 가려진 채로 전달. 텍스트 전용(이미지 첨부 없음)이라
 *   명함/QR 사진 우회도 불가.
 *
 * ⚠️ best-effort: 자릿수 풀어쓰기(공일공)·외국어·암호화된 표현 등 작정한 우회는 100% 못 막음.
 *   주기적 어드민 검수(redacted 플래그) + 약관 고지로 보완. 가격/수량/날짜 오탐은 최소화(아래 임계값).
 */

export const REDACT_PLACEHOLDER = '🚫[연락처·외부결제 정보는 안전거래를 위해 자동 차단됩니다]'

/** 연락처/계좌/메신저/URL 패턴을 마스킹. { text, redacted } 반환. */
export function redactContactInfo(input: string): { text: string; redacted: boolean } {
  if (!input) return { text: input, redacted: false }
  let text = input
  let hit = false
  const mark = (): string => { hit = true; return REDACT_PLACEHOLDER }

  // 1) 이메일
  text = text.replace(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/gi, mark)

  // 2) URL (http/https/www) — 외부 거래/연락 유도 링크
  text = text.replace(/(?:https?:\/\/|www\.)[^\s]+/gi, mark)

  // 3) 한국 전화번호 (010-1234-5678, 010 1234 5678, 02-123-4567, +82 …) — 그룹 사이 구분자 허용
  text = text.replace(/\+?82[\s.\-]?1[016789][\s.\-]?\d{3,4}[\s.\-]?\d{4}/g, mark)
  text = text.replace(/\b01[016789][\s.\-]?\d{3,4}[\s.\-]?\d{4}\b/g, mark)
  text = text.replace(/\b0\d{1,2}[\s.\-]\d{3,4}[\s.\-]\d{4}\b/g, mark) // 지역번호(구분자 필수 — 오탐 방지)

  // 4) 계좌/긴 숫자열 — 가격(원·콤마) 오탐 방지: 순수 11자리+ 또는 하이픈 2그룹+ & 9자리+ 일 때만
  text = text.replace(/\d[\d\s.\-]{7,}\d/g, (m: string): string => {
    const digits = m.replace(/\D/g, '')
    const hyphens = (m.match(/-/g) || []).length
    if (digits.length >= 11 || (hyphens >= 2 && digits.length >= 9)) return mark()
    return m
  })
  // 4b) 계좌 키워드 + 근처 숫자(짧아도) — '계좌 123456'
  text = text.replace(/(계좌|입금|송금|account|이체)\s*[:은는이가]?\s*[\d\s.\-]{6,}/gi, mark)

  // 5) 메신저 ID — 카톡/라인/텔레/위챗/인스타 + 아이디
  text = text.replace(/(카톡|카카오톡|카카오|오픈채팅|텔레그램|텔레|라인|위챗|wechat|telegram|kakao|line|insta|인스타|디엠|dm)\s*(아이디|id|:)?\s*[@]?[A-Za-z0-9._\-]{2,}/gi, mark)
  // 5b) @핸들 (3자+)
  text = text.replace(/@[A-Za-z0-9._]{3,}/g, mark)

  return { text, redacted: hit }
}
