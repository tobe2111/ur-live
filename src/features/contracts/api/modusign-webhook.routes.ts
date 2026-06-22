/**
 * 🖋️ 모두싸인 Webhook 수신 — POST /api/webhooks/modusign
 *
 *   문서 상태변경(서명 시작/완료/거절/만료) 이벤트를 받아 contract_signatures.status 갱신.
 *
 *   시그니처 검증(graceful): MODUSIGN_WEBHOOK_SECRET 설정 시, 모두싸인 webhook 관리에서 지정한
 *     공유 시크릿을 헤더(X-Modusign-Secret) 또는 ?secret= 로 받아 일치 검사. 미설정이면 경고 후 통과(dev).
 *   ⚠️ 모두싸인 실제 시그니처 헤더/스킴은 docs 봇차단(403)으로 미확정 — 운영 연동 시 webhook 등록 화면의
 *      실제 헤더로 1회 검증 후 이 함수만 보강(추측금지 룰). 그 전까지는 공유시크릿 가드로 동작.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { updateContractStatusByDocumentId, type ContractStatus } from '@/worker/utils/contract-signatures'

export const modusignWebhookRoutes = new Hono<{ Bindings: Env }>()

/** 이벤트/상태 문자열 → 우리 상태 enum (방어적 키워드 매칭 + 알려진 이벤트명). */
function mapStatus(raw: string): ContractStatus | null {
  const s = raw.toLowerCase()
  if (/(complet|finish|done|signed)/.test(s)) return 'signed'
  if (/(reject|declin|cancel)/.test(s)) return 'rejected'
  if (/expir/.test(s)) return 'expired'
  if (/(view|open|signing|started)/.test(s)) return 'viewed'
  return null
}

function pick(body: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = body[k]
    if (v != null && typeof v !== 'object') return String(v)
  }
  return null
}

modusignWebhookRoutes.post('/', async (c) => {
  const secret = c.env.MODUSIGN_WEBHOOK_SECRET
  if (secret) {
    const got = c.req.header('X-Modusign-Secret') || new URL(c.req.url).searchParams.get('secret') || ''
    if (got !== secret) return c.json({ success: false, error: 'invalid signature' }, 401)
  } else if (import.meta.env.DEV) {
    console.warn('[modusign-webhook] MODUSIGN_WEBHOOK_SECRET 미설정 — 검증 없이 통과(dev)')
  }

  let body: Record<string, unknown> = {}
  try { body = (await c.req.json()) as Record<string, unknown> } catch { /* non-JSON */ }

  // documentId + event/status 방어적 추출.
  const doc = (body.document as Record<string, unknown> | undefined) || (body.data as Record<string, unknown> | undefined) || {}
  const documentId = pick(body, 'documentId', 'id') || pick(doc, 'id', 'documentId')
  const eventRaw = pick(body, 'event', 'type', 'status') || pick(doc, 'status', 'state') || ''

  if (!documentId) {
    // 200 으로 ack(모두싸인 재시도 폭주 방지) — 우리가 못 다루는 이벤트는 무시.
    return c.json({ success: true, ignored: 'no document id' })
  }
  const status = mapStatus(eventRaw)
  if (!status) {
    return c.json({ success: true, ignored: `unmapped event: ${eventRaw}`.slice(0, 80) })
  }

  try {
    const changed = await updateContractStatusByDocumentId(c.env.DB, documentId, status, JSON.stringify(body))
    return c.json({ success: true, status, matched: changed })
  } catch {
    // 실패해도 200(모두싸인 무한 재시도 방지) — 내부 로깅만.
    return c.json({ success: true, deferred: true })
  }
})
