/**
 * 💾 매장 등록 이어하기 (2026-11-03 대표 확정 4화면 시안 — "중간에 나갔다 돌아오면 입력하던 곳부터")
 *
 * 고른 가게와 적은 번호만 남긴다(돈·권한과 무관한 화면 상태). 하루 지나면 버린다 —
 * 어제 고르다 만 가게가 오늘 열자마자 뜨면 오히려 헷갈린다.
 * ⚠️ 저장소가 막힌 브라우저(사생활 보호 모드)에서도 화면은 그대로 돈다 — 모든 접근을 try 로 감싼다.
 */
import type { RegisterPlace } from '@/components/seller/StoreRegisterModal'

const KEY = 'ur_store_new_draft_v1'
const TTL_MS = 24 * 60 * 60 * 1000

export interface StoreNewDraft { place: RegisterPlace | null; phone: string }

export function readStoreNewDraft(now = Date.now()): StoreNewDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as StoreNewDraft & { at?: number }
    if (!d || typeof d.at !== 'number' || now - d.at > TTL_MS) { localStorage.removeItem(KEY); return null }
    return { place: d.place && typeof d.place.name === 'string' ? d.place : null, phone: typeof d.phone === 'string' ? d.phone : '' }
  } catch { return null }
}

export function writeStoreNewDraft(d: StoreNewDraft, now = Date.now()): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...d, at: now })) } catch { /* 저장 못 해도 화면은 그대로 */ }
}

export function clearStoreNewDraft(): void {
  try { localStorage.removeItem(KEY) } catch { /* noop */ }
}
