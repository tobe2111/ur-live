/**
 * 🖋️ 모두싸인(Modusign) 전자계약 게이트웨이 — 단일 helper (직접 fetch 금지, Toss 교훈).
 *
 *   가입 시 계약서 템플릿을 자동 발송. 모두싸인 공식 API:
 *     POST https://api.modusign.co.kr/documents/request-with-template
 *     인증: Authorization: Basic base64("{API_KEY}:")   (apiKey=username, 빈 password)
 *     body: { templateId, document: { title, participantMappings:[{ name, signingMethod:{type,value} }], metadatas:[...] } }
 *
 *   설정(Cloudflare → Variables & Secrets, 전부 선택 — 미설정 시 fail-soft no-op):
 *     MODUSIGN_API_KEY · MODUSIGN_TEMPLATE_ID(기본 템플릿) · MODUSIGN_WEBHOOK_SECRET
 *
 *   ⚠️ 응답/Webhook 의 일부 필드명은 모두싸인 docs 가 봇차단(403)이라 실호출 1회로 최종검증 필요(추측금지 룰).
 *      그래서 응답 파싱은 방어적(여러 후보 키) + raw 저장.
 */
import type { Env } from '@/worker/types/env'
import { withCircuitBreaker } from '@/worker/utils/circuit-breaker'

const MODUSIGN_BASE = 'https://api.modusign.co.kr'
const REQUEST_TIMEOUT_MS = 10_000

export type SigningMethodType = 'EMAIL' | 'SMS' | 'KAKAO'

export interface ContractParticipant {
  name: string
  /** EMAIL → 이메일, SMS/KAKAO → 휴대폰(E.164 또는 01012345678). */
  value: string
  method?: SigningMethodType
}

export interface SendContractInput {
  /** 미지정 시 MODUSIGN_TEMPLATE_ID env 사용. */
  templateId?: string
  title: string
  participant: ContractParticipant
  /** 멱등/역추적용 — 최소 { account_type, account_id }. 모두싸인 metadatas 로 전달. */
  metadata: Record<string, string | number>
}

export type SendContractResult =
  | { ok: true; documentId: string }
  | { ok: false; skipped: true; reason: 'not_configured' }
  | { ok: false; skipped?: false; error: string; status?: number }

function basicAuthHeader(apiKey: string): string {
  // base64("{apiKey}:") — apiKey 를 username, 빈 password 로 HTTP Basic.
  return 'Basic ' + btoa(`${apiKey}:`)
}

/** documentId 후보 키에서 안전 추출(응답 스키마 변동 대비). */
function pickDocumentId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>
  const cand = o.id ?? o.documentId ?? (o.document as Record<string, unknown> | undefined)?.id ?? (o.data as Record<string, unknown> | undefined)?.id
  return cand != null ? String(cand) : null
}

/**
 * 템플릿으로 계약서 서명요청 발송.
 * fail-soft: API key 미설정이면 {ok:false, skipped:true} (호출자는 가입을 막지 말 것).
 * 절대 throw 하지 않음 — 항상 result 객체 반환.
 */
export async function sendContractFromTemplate(env: Env, input: SendContractInput): Promise<SendContractResult> {
  const apiKey = env.MODUSIGN_API_KEY
  const templateId = input.templateId || env.MODUSIGN_TEMPLATE_ID
  if (!apiKey || !templateId) {
    return { ok: false, skipped: true, reason: 'not_configured' }
  }
  const method: SigningMethodType = input.participant.method || 'EMAIL'
  const payload = {
    templateId,
    document: {
      title: input.title.slice(0, 200),
      participantMappings: [
        {
          name: input.participant.name.slice(0, 100),
          signingMethod: { type: method, value: input.participant.value },
        },
      ],
      metadatas: Object.entries(input.metadata).map(([key, value]) => ({ key, value: String(value) })),
    },
  }
  try {
    return await withCircuitBreaker({ name: 'modusign', maxFailures: 5, resetTimeoutMs: 30_000 }, async () => {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
      try {
        const res = await fetch(`${MODUSIGN_BASE}/documents/request-with-template`, {
          method: 'POST',
          headers: {
            'Authorization': basicAuthHeader(apiKey),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        })
        const text = await res.text()
        let parsed: unknown = null
        try { parsed = text ? JSON.parse(text) : null } catch { /* non-JSON */ }
        if (!res.ok) {
          // 4xx 는 우리 입력 문제(키/템플릿/형식) → 회로 실패로 누적하되 에러 반환.
          return { ok: false as const, error: `modusign ${res.status}`, status: res.status }
        }
        const documentId = pickDocumentId(parsed)
        if (!documentId) return { ok: false as const, error: 'no document id in response', status: res.status }
        return { ok: true as const, documentId }
      } finally {
        clearTimeout(timer)
      }
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : 'modusign request failed' }
  }
}
