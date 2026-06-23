/**
 * 🖋️ 유캔싸인 Webhook 수신 — POST /api/webhooks/ucansign
 *
 *   이벤트(eventType): sign_creating(생성) / signing_canceled(취소) /
 *     signing_completed(참여자 서명, 마지막 제외) / signing_completed_all(모든 서명 완료).
 *   페이로드: { documentId, documentIdStr, documentName, eventType, participantContactInfo,
 *              customValue, customValue1..5 (생성 시 설정값 그대로 에코) }
 *
 *   시그니처 검증: 유캔싸인 webhook 은 HMAC 헤더가 없음 → 발송 시 customValue5 에 심은 공유시크릿
 *     (UCANSIGN_WEBHOOK_SECRET)을 에코값으로 검증 + documentId 가 우리 DB 행과 매칭될 때만 상태변경
 *     (위조 이벤트는 실제 documentId 를 모르면 무효). 시크릿 미설정이면 documentId 매칭만으로 동작.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { updateContractStatusByDocumentId, type ContractStatus } from '@/worker/utils/contract-signatures'

export const ucansignWebhookRoutes = new Hono<{ Bindings: Env }>()

function mapStatus(eventType: string): ContractStatus | null {
  switch (eventType) {
    case 'signing_completed_all': return 'signed'   // 모든 서명 완료(우리 단일서명 계약의 완료 신호)
    case 'signing_completed': return 'viewed'        // 참여자 일부 서명(다중서명 진행중)
    case 'signing_canceled': return 'rejected'
    case 'sign_creating': return 'requested'
    default: return null
  }
}

ucansignWebhookRoutes.post('/', async (c) => {
  let body: Record<string, unknown> = {}
  try { body = (await c.req.json()) as Record<string, unknown> } catch { /* non-JSON */ }

  // 공유시크릿 검증(customValue5 에코) — 설정 시 필수.
  const secret = c.env.UCANSIGN_WEBHOOK_SECRET
  if (secret && String(body.customValue5 ?? '') !== secret) {
    return c.json({ success: false, error: 'invalid signature' }, 401)
  }

  const documentId = body.documentIdStr != null ? String(body.documentIdStr)
    : body.documentId != null ? String(body.documentId) : null
  const eventType = String(body.eventType ?? '')
  if (!documentId) return c.json({ success: true, ignored: 'no document id' })

  const status = mapStatus(eventType)
  if (!status) return c.json({ success: true, ignored: `unmapped: ${eventType}`.slice(0, 80) })

  try {
    const changed = await updateContractStatusByDocumentId(c.env.DB, documentId, status, JSON.stringify(body))
    return c.json({ success: true, status, matched: changed }) // 항상 200 ack(재시도 폭주 방지)
  } catch {
    return c.json({ success: true, deferred: true })
  }
})
