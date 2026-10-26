/**
 * 💬 고르기 전 질문 — 견적 하나에 손님 ↔ 사장님 짧은 대화 (2026-10-26 대표 "1,2,3 모두 진행해줘").
 *
 * 숨고처럼 고르기 전에 "주말도 되나요?" 를 물을 수 있게 한다. 다만 **연락처는 여전히 고른 뒤에만** —
 * 대화에 전화번호·카톡 아이디를 적으면 저장을 거절한다(손님 번호를 지키는 약속이 견적 화면 첫 줄이다).
 * 고른 뒤에는 서로 번호가 열리므로 이 거절을 풀지 않는다(전화로 하면 된다 — 규칙을 하나로 둔다).
 */
export const CHAT_BODY_MAX = 500
/** 견적 하나의 대화 최대 줄 수 — 스팸·도배 방지. */
export const CHAT_MAX_PER_QUOTE = 60

/** 전화번호(010…·지역번호·0505)·카톡 아이디 안내를 잡는다. 숫자 사이 공백·점·하이픈도 본다. */
export function containsContact(text: string): boolean {
  const digits = text.replace(/[\s.\-–—()]/g, '')
  if (/0(?:1[016789]|2|[3-6][1-5]|505|70)\d{6,8}/.test(digits)) return true
  if (/(?:카톡|카카오톡|오픈채팅|kakao)\s*(?:아이디|id|ID|:)/i.test(text)) return true
  if (/open\.kakao\.com/i.test(text)) return true
  return false
}

export function parseChatBody(raw: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = String(raw ?? '').replace(/\r\n/g, '\n').trim()
  if (!text) return { ok: false, error: '내용을 적어 주세요' }
  if (text.length > CHAT_BODY_MAX) return { ok: false, error: `${CHAT_BODY_MAX}자까지 적을 수 있어요` }
  if (containsContact(text)) return { ok: false, error: '연락처는 업체를 고른 뒤에 서로 공개돼요. 번호 없이 적어 주세요' }
  return { ok: true, text }
}
