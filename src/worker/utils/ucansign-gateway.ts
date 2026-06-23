/**
 * 🖋️ 유캔싸인(UCanSign) 전자계약 게이트웨이 — 단일 helper (직접 fetch 금지).
 *
 *   인증 2단계: POST /openapi/user/token { apiKey } → accessToken(30분) → Authorization: Bearer.
 *   발송: POST /openapi/templates/{templateId}  body { documentName, participants[], customValueN }.
 *     참여자: { name, signingMethodType: 'kakao'|'email'|'none', signingContactInfo, signingOrder }
 *       - kakao → signingContactInfo = 휴대폰(하이픈 제외) / email → 이메일
 *   응답: { msg, result:{ documentId }, code:0 }  (성공 code===0)
 *   테스트모드: 헤더 x-ucansign-test:true (포인트 차감 X — 효력 미보장 워터마크).
 *
 *   설정(Cloudflare → Variables & Secrets, 전부 선택 — 미설정 시 fail-soft no-op):
 *     UCANSIGN_API_KEY · UCANSIGN_TEMPLATE_ID(기본 템플릿) · UCANSIGN_TEST_MODE('true'면 테스트발송)
 */
import { withCircuitBreaker } from '@/worker/utils/circuit-breaker'

/** 게이트웨이가 읽는 최소 env(좁은 로컬 Bindings 도 수용). */
export interface UcansignEnv {
  UCANSIGN_API_KEY?: string
  UCANSIGN_TEMPLATE_ID?: string
  UCANSIGN_TEST_MODE?: string
}

const UCANSIGN_BASE = 'https://app.ucansign.com/openapi'
const REQUEST_TIMEOUT_MS = 10_000

export type SigningMethodType = 'kakao' | 'email' | 'none'

export interface ContractParticipant {
  name: string
  /** kakao → 휴대폰(하이픈 자동제거) / email → 이메일. */
  value: string
  method?: SigningMethodType // default kakao
  order?: number // default 1
}

export interface SendContractInput {
  templateId?: string // 미지정 시 UCANSIGN_TEMPLATE_ID
  documentName: string
  participant: ContractParticipant
  /** customValue1..5 — webhook 수신 시 그대로 에코됨(상관관계·서명검증용). 키는 'customValue1' 등. */
  customValues?: Record<string, string>
}

export type SendContractResult =
  | { ok: true; documentId: string }
  | { ok: false; skipped: true; reason: 'not_configured' }
  | { ok: false; skipped?: false; error: string; code?: number }

// accessToken 캐시(isolate 내 — 30분 유효). 60초 여유로 만료 전 재발급.
let _tokenCache: { token: string; expiresAt: number } | null = null
/** 테스트용 — 토큰 캐시 초기화. */
export function _resetTokenCache(): void { _tokenCache = null }

async function fetchAccessToken(apiKey: string): Promise<string | null> {
  const now = Date.now()
  if (_tokenCache && _tokenCache.expiresAt > now + 60_000) return _tokenCache.token
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${UCANSIGN_BASE}/user/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
      signal: ctrl.signal,
    })
    const data = (await res.json().catch(() => null)) as { code?: number; result?: { accessToken?: string } } | null
    const token = data?.result?.accessToken
    if (!res.ok || data?.code !== 0 || !token) return null
    _tokenCache = { token, expiresAt: now + 30 * 60_000 }
    return token
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const CUSTOM_VALUE_KEYS = new Set(['customValue', 'customValue1', 'customValue2', 'customValue3', 'customValue4', 'customValue5'])

/**
 * 템플릿으로 계약서 서명요청 발송.
 * fail-soft: API key/templateId 미설정이면 {ok:false, skipped:true}. 절대 throw 안 함.
 */
export async function sendContractFromTemplate(env: UcansignEnv, input: SendContractInput): Promise<SendContractResult> {
  const apiKey = env.UCANSIGN_API_KEY
  const templateId = input.templateId || env.UCANSIGN_TEMPLATE_ID
  if (!apiKey || !templateId) return { ok: false, skipped: true, reason: 'not_configured' }

  const method: SigningMethodType = input.participant.method || 'kakao'
  const contact = method === 'kakao' ? input.participant.value.replace(/[^0-9]/g, '') : input.participant.value.trim()
  const body: Record<string, unknown> = {
    documentName: input.documentName.slice(0, 100),
    participants: [
      {
        name: input.participant.name.slice(0, 100),
        signingMethodType: method,
        signingContactInfo: contact,
        signingOrder: input.participant.order || 1,
      },
    ],
  }
  if (input.customValues) {
    for (const [k, v] of Object.entries(input.customValues)) {
      if (CUSTOM_VALUE_KEYS.has(k)) body[k] = String(v)
    }
  }
  const testMode = env.UCANSIGN_TEST_MODE === 'true'

  try {
    return await withCircuitBreaker({ name: 'ucansign', maxFailures: 5, resetTimeoutMs: 30_000 }, async () => {
      const token = await fetchAccessToken(apiKey)
      if (!token) return { ok: false as const, error: 'token issue failed' }
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
      try {
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
        if (testMode) headers['x-ucansign-test'] = 'true'
        const res = await fetch(`${UCANSIGN_BASE}/templates/${encodeURIComponent(templateId)}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: ctrl.signal,
        })
        const data = (await res.json().catch(() => null)) as { code?: number; msg?: string; result?: { documentId?: string | number } } | null
        if (!res.ok || data?.code !== 0) {
          return { ok: false as const, error: `ucansign ${data?.code ?? res.status}: ${data?.msg ?? ''}`.slice(0, 150), code: data?.code }
        }
        const documentId = data?.result?.documentId != null ? String(data.result.documentId) : null
        if (!documentId) return { ok: false as const, error: 'no documentId in response' }
        return { ok: true as const, documentId }
      } finally {
        clearTimeout(timer)
      }
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : 'ucansign request failed' }
  }
}
