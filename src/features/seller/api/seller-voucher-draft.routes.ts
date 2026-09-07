/**
 * 💾 이용권 등록 위저드 — 서버 임시저장 (seller-stores.routes.ts 에서 추출, 2026-09-02)
 *
 * **왜 나눴나**: `seller-stores.routes.ts` 가 617줄이 되어 god-파일 래칫(600)에 걸렸다.
 * 이 세 엔드포인트는 매장 프로필·등록과 아무 관계가 없다 — 위저드 작성 중 이탈을 견디는
 * 자동저장이고, 세션 하나(셀러 좌석)에 드래프트 하나가 전부다. 잘라 내기 가장 자연스러운 이음매다.
 *
 * ⚠️ **경로·동작은 그대로다** — 같은 Hono 앱에 같은 문자열로 등록한다(`/voucher-draft`).
 *   클라이언트(`draft-sync.ts`)는 한 줄도 안 바뀐다. 순수 이동이다.
 */
import type { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '@/worker/types/env'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'

export function registerVoucherDraftRoutes(draftApp: Hono<{ Bindings: Env }>) {
  // ── 이용권 임시저장(서버 드래프트) — 2026-08-23 대표 "임시저장도 돼야 해" 후속 승인 ─────────
  //   localStorage 드래프트의 서버 짝 — PC 에서 쓰다 폰에서 이어 쓴다. 셀러(좌석)당 1개.
  //   ⚠️ seller_meta 를 쓰지 않는 이유: getSellerMeta 는 그 셀러의 **모든** 키를 읽는다 —
  //   base64 이미지가 든 수백 KB 드래프트를 넣으면 fee-context 등 모든 meta 조회가 그걸 끌고 다닌다.
  let _draftEnsured = false
  async function ensureVoucherDraftTable(DB: D1Database) {
    if (_draftEnsured) return
    _draftEnsured = true
    try {
      await DB.prepare(`CREATE TABLE IF NOT EXISTS seller_voucher_drafts (
        seller_id INTEGER PRIMARY KEY,
        draft_json TEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
      )`).run()
    } catch { /* 이미 있으면 그만 — repair-schema 가 정식 등록 */ }
  }
  /** 드래프트 크기 상한 — 압축 업로드(≤300KB)의 base64(~400KB)까지 수용, 그 이상은 거절. */
  const DRAFT_MAX_BYTES = 900_000

  draftApp.get('/voucher-draft', async (c) => {
    try {
      const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
      if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
      await ensureVoucherDraftTable(c.env.DB)
      // updated_ms: epoch(ms) 로 내려 클라가 Date 파싱 없이 숫자 비교만 하게 한다(UTC 오해석 클래스 차단).
      const row = await c.env.DB.prepare(
        `SELECT draft_json, CAST(strftime('%s', updated_at) AS INTEGER) * 1000 AS updated_ms
           FROM seller_voucher_drafts WHERE seller_id = ? LIMIT 1`
      ).bind(sellerId).first<{ draft_json: string; updated_ms: number }>().catch(() => null)
      if (!row) return c.json({ success: true, data: null })
      let form: unknown = null
      try { form = JSON.parse(row.draft_json) } catch { /* 깨진 드래프트는 없는 것 */ }
      if (!form || typeof form !== 'object') return c.json({ success: true, data: null })
      return c.json({ success: true, data: { form, updated_ms: Number(row.updated_ms) || 0 } })
    } catch (err) {
      return safeError(c, err, '임시저장을 불러오지 못했습니다', '[voucher-draft]')
    }
  })

  draftApp.put('/voucher-draft', rateLimit({ action: 'voucher_draft_save', max: 120, windowSec: 3600 }), async (c) => {
    try {
      const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
      if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
      const body = await c.req.json<{ form?: unknown }>().catch(() => ({} as { form?: unknown }))
      if (!body.form || typeof body.form !== 'object') {
        return c.json({ success: false, error: '저장할 내용이 없습니다' }, 400)
      }
      const json = JSON.stringify(body.form)
      if (json.length > DRAFT_MAX_BYTES) {
        return c.json({ success: false, error: '임시저장 용량을 초과했습니다 (이미지를 줄여주세요)' }, 413)
      }
      await ensureVoucherDraftTable(c.env.DB)
      await c.env.DB.prepare(
        `INSERT INTO seller_voucher_drafts (seller_id, draft_json, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(seller_id) DO UPDATE SET draft_json = excluded.draft_json, updated_at = datetime('now')`
      ).bind(sellerId, json).run()
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '임시저장에 실패했습니다', '[voucher-draft]')
    }
  })

  draftApp.delete('/voucher-draft', async (c) => {
    try {
      const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
      if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
      await ensureVoucherDraftTable(c.env.DB)
      await c.env.DB.prepare('DELETE FROM seller_voucher_drafts WHERE seller_id = ?').bind(sellerId).run()
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '임시저장 삭제에 실패했습니다', '[voucher-draft]')
    }
  })
}
