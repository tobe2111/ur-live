/**
 * 🆔 2026-07-13 (데이터 감사 2단계): 익명 방문자 ID — 클릭 이벤트를 로그인 후 user_id 에 귀속하기 위한
 *   클라 생성 UUID(개인정보 아님, 브라우저 스코프). localStorage 1회 생성 후 재사용.
 *   완결고리 '유입'(inflow_clicks) 의 anon_id, 향후 익명 행동로그의 공통 키로 확장 가능.
 */
const ANON_KEY = 'ur_anon_id_v1'

function genId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch { /* fall through */ }
  // 폴백: 시간 + 난수 (충돌 무시 수준의 익명 키면 충분)
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** 익명 방문자 ID 반환(없으면 생성·저장). storage 불가 환경은 휘발성 임시 ID. */
export function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY)
    if (!id || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
      id = genId()
      localStorage.setItem(ANON_KEY, id)
    }
    return id
  } catch {
    return genId()
  }
}
