/**
 * 📨 네이버 클라우드 SENS 알림톡 (2026-10-12 대표 "이걸로 가자")
 *
 * 왜 알리고에서 옮기나: 알리고·비즈고는 **보내는 서버의 고정 IP 등록이 필수**인데(라이브 실측: 알리고 `-99/-101`),
 * 유어딜 서버(Cloudflare)는 나가는 IP 가 고정이 아니다(40회 실측 — 앞 두 자리만 6종, 앞 세 자리 17종).
 * 알리고는 끝자리 대역(0~255)까지만, 비즈고는 10칸까지만 받아서 어느 쪽도 덮을 수 없다.
 * SENS 는 API 키 서명으로 인증하고 **허용 IP 를 등록하지 않으면 모든 접속을 허용**한다(공식 가이드).
 *
 * 인증: `x-ncp-apigw-signature-v2` = base64(HMAC-SHA256(secret, "POST {uri}\n{timestamp}\n{accessKey}")).
 * 템플릿 코드는 등록할 때 **우리가 정한다** — 우리 이름(`voucher_issued`)을 그대로 코드로 쓴다.
 *
 * ⚠️ 응답 202 + `requestStatusCode: A000` 은 "접수"다(카카오가 실제로 전달했는지는 별도 조회). 접수 거절만 실패로 본다.
 */

export interface SensEnv {
  NCP_ACCESS_KEY?: string
  NCP_SECRET_KEY?: string
  NCP_SENS_ALIMTALK_SERVICE_ID?: string
  NCP_KAKAO_CHANNEL_ID?: string
}

export const SENS_HOST = 'https://sens.apigw.ntruss.com'

export function sensConfigured(e: Record<string, unknown>): boolean {
  return !!(e.NCP_ACCESS_KEY && e.NCP_SECRET_KEY && e.NCP_SENS_ALIMTALK_SERVICE_ID && e.NCP_KAKAO_CHANNEL_ID)
}

export function sensAlimtalkUri(serviceId: string): string {
  return `/alimtalk/v2/services/${encodeURIComponent(serviceId)}/messages`
}

/** 서명 원문 — 줄바꿈·공백 하나가 틀리면 401 이라 함수로 고정한다(시험이 이 형태를 잰다). */
export function sensSignatureMessage(method: string, uri: string, timestamp: string, accessKey: string): string {
  return `${method} ${uri}\n${timestamp}\n${accessKey}`
}

export async function sensSignature(secretKey: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  let bin = ''
  for (const b of sig) bin += String.fromCharCode(b)
  return btoa(bin)
}

/** 채널 ID 는 `@` 로 시작해야 한다 — 콘솔 표기(`@유어딜`)를 그대로 넣어도, `@` 를 빼고 넣어도 되게. */
export function normalizeChannelId(raw: string): string {
  const t = raw.trim()
  return t.startsWith('@') ? t : `@${t}`
}

interface SensResponse {
  statusCode?: string
  statusName?: string
  errorMessage?: string
  error?: { errorCode?: string; message?: string; details?: string }
  messages?: Array<{ requestStatusCode?: string; requestStatusName?: string; requestStatusDesc?: string }>
}

/** 응답 해석 — 순수 함수(시험이 직접 잰다). 접수(A000)만 성공. 실패면 SENS 원문을 그대로 싣는다(무엇에서 막혔는지 보이게). */
export function interpretSensResponse(status: number, body: SensResponse | null): { success: boolean; error?: string } {
  const m = body?.messages?.[0]
  if (status === 202 && m?.requestStatusCode === 'A000') return { success: true }
  const detail = m
    ? `${m.requestStatusCode ?? ''} ${m.requestStatusDesc ?? m.requestStatusName ?? ''}`.trim()
    : body?.error
      ? `${body.error.errorCode ?? ''} ${body.error.message ?? ''} ${body.error.details ?? ''}`.trim()
      : body?.errorMessage || body?.statusName || ''
  return { success: false, error: `[SENS ${status}] ${detail || 'unknown'}`.slice(0, 500) }
}

export async function sendSensAlimtalk(
  env: SensEnv,
  p: { templateCode: string; to: string; content: string },
): Promise<{ success: boolean; error?: string }> {
  const accessKey = String(env.NCP_ACCESS_KEY ?? '')
  const secretKey = String(env.NCP_SECRET_KEY ?? '')
  const serviceId = String(env.NCP_SENS_ALIMTALK_SERVICE_ID ?? '')
  const channel = String(env.NCP_KAKAO_CHANNEL_ID ?? '')
  if (!accessKey || !secretKey || !serviceId || !channel) return { success: false, error: 'sens_not_configured' }
  const uri = sensAlimtalkUri(serviceId)
  const timestamp = String(Date.now())
  try {
    const signature = await sensSignature(secretKey, sensSignatureMessage('POST', uri, timestamp, accessKey))
    const res = await fetch(`${SENS_HOST}${uri}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': accessKey,
        'x-ncp-apigw-signature-v2': signature,
      },
      body: JSON.stringify({
        plusFriendId: normalizeChannelId(channel),
        templateCode: p.templateCode,
        messages: [{ to: p.to, content: p.content }],
      }),
      signal: AbortSignal.timeout(8000),
    })
    const body = (await res.json().catch(() => null)) as SensResponse | null
    return interpretSensResponse(res.status, body)
  } catch (err) {
    return { success: false, error: `[SENS] ${String((err as Error)?.message ?? err).slice(0, 300)}` }
  }
}
