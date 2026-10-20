/**
 * 💾 서버 드래프트 동기화 — localStorage 드래프트의 서버 짝 (2026-08-23 대표 "모두 해줘")
 *   PC 에서 쓰다 폰에서 이어 쓴다. 전부 fail-soft: 서버가 죽어도 로컬 임시저장은 계속 돈다.
 *   엔드포인트: GET/PUT/DELETE /api/seller/voucher-draft (셀러 좌석당 1개).
 */
import api from '@/lib/api'
import type { VoucherDraft, VoucherForm } from './voucher-form'
import { emptyVoucherForm } from './voucher-form'

export async function fetchServerDraft(): Promise<VoucherDraft | null> {
  try {
    const r = await api.get('/api/seller/voucher-draft')
    const d = r.data?.data
    if (!r.data?.success || !d?.form || typeof d.form !== 'object') return null
    return {
      form: { ...emptyVoucherForm(), ...(d.form as Partial<VoucherForm>) },
      savedAt: Number(d.updated_ms) || 0,
      sellerId: Number(localStorage.getItem('seller_id') || 0),
    }
  } catch { return null }
}

/** fire-and-forget 저장 — 실패해도 조용히(로컬이 1차 방어선). */
export function pushServerDraft(form: VoucherForm): void {
  api.put('/api/seller/voucher-draft', { form }).catch(() => { /* fail-soft */ })
}

export function deleteServerDraft(): void {
  api.delete('/api/seller/voucher-draft').catch(() => { /* fail-soft */ })
}
