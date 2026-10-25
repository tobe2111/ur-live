/**
 * 🏠 생활 요청서 임시 저장 (2026-10-25 대표 — 오늘의집 흐름 "로그인 없이 먼저 묻는다").
 *
 * 질문을 다 답한 뒤에야 카카오 로그인을 하므로, 로그인 왕복 동안 답이 사라지면 안 된다.
 * sessionStorage 는 카톡 간편로그인이 앱을 오가며 새 탭으로 돌아오면 비어 있을 수 있어 localStorage 에 둔다.
 * 하루가 지나면 버린다(남의 기기에 상세 주소가 오래 남지 않게). 접수에 성공하면 바로 지운다.
 */
const KEY = (cat: string) => `ur_life_draft_v1:${cat}`
const TTL_MS = 24 * 60 * 60 * 1000

export type Draft = Record<string, string>

export function loadDraft(cat: string): Draft {
  try {
    const raw = localStorage.getItem(KEY(cat))
    if (!raw) return {}
    const d = JSON.parse(raw) as { at?: number; values?: Draft }
    if (!d?.at || Date.now() - d.at > TTL_MS || !d.values || typeof d.values !== 'object') {
      localStorage.removeItem(KEY(cat))
      return {}
    }
    const out: Draft = {}
    for (const [k, v] of Object.entries(d.values)) if (typeof v === 'string') out[k] = v
    return out
  } catch { return {} }
}

export function saveDraft(cat: string, values: Draft): void {
  try {
    if (!Object.keys(values).length) { localStorage.removeItem(KEY(cat)); return }
    localStorage.setItem(KEY(cat), JSON.stringify({ at: Date.now(), values }))
  } catch { /* 저장 못 해도 화면은 그대로 */ }
}

export function clearDraft(cat: string): void {
  try { localStorage.removeItem(KEY(cat)) } catch { /* */ }
}
