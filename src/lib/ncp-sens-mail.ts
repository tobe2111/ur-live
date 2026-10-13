/**
 * ✉️ 네이버 클라우드 SENS 메일 (구 Cloud Outbound Mailer · 2026-10-12 대표 "메일, 알림톡 … 최대한 설정하고")
 *
 * 왜: 월 1,000건까지 무료, 초과분 건당 0.45원(대표 확인). 알림톡과 **같은 API 키·같은 서명**을 쓴다
 *   (`ncp-sens.ts` 의 `sensSignature`) — 키를 한 벌만 관리한다.
 *
 * 범위(의도): **거래성 메일만** 이 길로 간다 — `services/email.ts` 가 커스텀 헤더(List-Unsubscribe)나
 *   회신 주소가 붙은 메일(대량·홍보·아웃리치)은 종전 Resend 로 보낸다. 네이버 클라우드 약관상 홍보 메일은
 *   `advertising: true` + 수신거부 문구가 필요하고, 대량 콜드메일은 계정 정지 위험이 있다.
 *
 * API(2026-10-12 정정 — v2): POST https://sens.apigw.ntruss.com/mail/v2/services/{serviceId}/requests · 인증 헤더 3종(알림톡과 동일).
 *   🩸 처음엔 옛 Cloud Outbound Mailer API(mail.apigw.ntruss.com/api/v1/mails)로 짰는데, 그 서비스는 2026-09-17 에
 *   SENS 로 흡수됐고 옛 API 는 **이관된 프로젝트(mail-UUID)에 묶여** 있다. 새로 가입한 우리 계정엔 그 프로젝트가 없어
 *   라이브 시험 발송이 `Member[…]'s default project is not exist`(500)로 막혔다. ⇒ 알림톡처럼 SENS 프로젝트의
 *   **메일 서비스 ID**(NRN, 예 `ncp:mail:kr:…:main` — 콜론이 있어 경로에서 인코딩)로 보낸다.
 *   v2 본문 차이: 수신자 type 은 'R' 이 아니라 'TO'. 응답은 202 + requestId.
 *   ⚠️ 형식 출처: 네이버 클라우드 공식 문서가 이 환경에서 안 열려(CONNECT 403) 공개된 서드파티 연동 코드로 확인했다 —
 *   첫 라이브 시험 발송(`POST /api/admin/mail-test-send`)이 최종 판정이다.
 * ⚠️ 발신 주소의 도메인(urdeal.kr)을 SENS 콘솔에 등록하고 SPF/DKIM DNS 를 넣어야 스팸함으로 안 간다.
 */
import { sensSignature, sensSignatureMessage } from './ncp-sens'

export interface SensMailEnv {
  NCP_ACCESS_KEY?: string
  NCP_SECRET_KEY?: string
  /** 발신 주소 — 예: no-reply@urdeal.kr (SENS 콘솔에 도메인 등록 필수). 이게 있어야 메일이 SENS 로 간다. */
  NCP_MAIL_SENDER?: string
  /** 발신자 이름 — 기본 '유어딜' */
  NCP_MAIL_SENDER_NAME?: string
  /** SENS 프로젝트의 메일 서비스 ID(NRN) — 콘솔 SENS › 프로젝트에서 확인. 없으면 메일이 SENS 로 가지 않는다. */
  NCP_SENS_MAIL_SERVICE_ID?: string
}

export const SENS_MAIL_HOST = 'https://sens.apigw.ntruss.com'
/** 요청 경로이자 서명 대상 URI — 서명은 **인코딩된 경로 그대로**를 쓴다(알림톡 `alimtalkUri` 와 같은 규칙). */
export function sensMailUri(serviceId: string): string {
  return `/mail/v2/services/${encodeURIComponent(serviceId)}/requests`
}

export function sensMailConfigured(e: Record<string, unknown> | null | undefined): boolean {
  return !!(e && e.NCP_ACCESS_KEY && e.NCP_SECRET_KEY && e.NCP_MAIL_SENDER && e.NCP_SENS_MAIL_SERVICE_ID)
}

/**
 * 📮 거래성 메일을 보낼 수단이 있는가 — Resend 키 **또는** SENS 메일(2026-10-12).
 *   🩸 배포 후 실측: 유어딜(ur-live)엔 `RESEND_API_KEY` 가 **없다**. 그런데 호출부 여럿이 발송 전에 그 키만 보고
 *   건너뛰어서, SENS 메일을 설정해도 그 메일들이 한 통도 안 나갔다(에러 없이). 거래성 메일의 '보낼 수 있나' 판정은 이 함수 하나로.
 */
export function transactionalMailReady(e: unknown): boolean {
  const env = (e ?? {}) as Record<string, unknown>
  return !!env.RESEND_API_KEY || sensMailConfigured(env)
}

/**
 * 📮 발신 주소 정리 (2026-10-12 — 라이브 시험 발송이 `Sender address is invalid format`(400)).
 *   `NCP_MAIL_SENDER` 는 시크릿이라 저장 뒤엔 아무도 값을 다시 볼 수 없다. 콘솔에 붙여 넣을 때 흔히 섞이는
 *   앞뒤 공백·줄바꿈 · 감싼 따옴표 · `유어딜 <no-reply@urdeal.kr>` 꼴을 여기서 걷어 **주소만** 보낸다.
 *   이름은 `NCP_MAIL_SENDER_NAME` 이 따로 맡는다.
 */
export function normalizeSenderAddress(raw: unknown): string {
  let v = String(raw ?? '').trim()
  const angle = v.match(/<([^<>]+)>/)
  if (angle) v = angle[1]
  v = v.replace(/^["'`\s]+|["'`\s]+$/g, '')
  return v.trim()
}

const EMAIL_SHAPE = /^[^\s@<>"'`,;]+@[^\s@<>"'`,;]+\.[A-Za-z]{2,}$/

/**
 * 🔎 발신 주소 **모양**만 — 값은 안 드러낸다(시험 발송 응답에 싣는다). 시크릿이라 다시 볼 수 없으니
 *   "무엇이 잘못 들어갔는가" 를 이것으로 판정한다. 로컬부는 첫 글자만.
 */
export function describeSenderAddress(raw: unknown): Record<string, unknown> {
  const s = String(raw ?? '')
  const n = normalizeSenderAddress(s)
  const [local = '', domain = ''] = n.split('@')
  return {
    configured: s.length > 0,
    raw_length: s.length,
    had_outer_whitespace: s !== s.trim(),
    had_angle_brackets: /[<>]/.test(s),
    had_quotes: /["'`]/.test(s),
    at_count: (s.match(/@/g) || []).length,
    normalized: n ? `${local.slice(0, 1)}***@${domain}` : '',
    normalized_valid: EMAIL_SHAPE.test(n),
  }
}

/** 요청 본문 — 순수 함수(시험이 직접 잰다). 한 통에 한 명(individual), 홍보 아님(advertising false). */
export function buildSensMailBody(
  env: SensMailEnv,
  p: { to: string; subject: string; html: string },
): Record<string, unknown> {
  return {
    senderAddress: normalizeSenderAddress(env.NCP_MAIL_SENDER),
    senderName: String(env.NCP_MAIL_SENDER_NAME || '유어딜'),
    title: p.subject,
    body: p.html,
    recipients: [{ address: p.to, type: 'TO' }],
    individual: true,
    advertising: false,
  }
}

/** 응답 해석 — 2xx 이고 requestId 가 있으면 접수 성공. 실패면 SENS 원문을 싣는다. */
export function interpretSensMailResponse(
  status: number,
  body: { requestId?: string; error?: { errorCode?: string; message?: string; details?: string }; message?: string } | null,
): { success: boolean; error?: string } {
  if (status >= 200 && status < 300 && body?.requestId) return { success: true }
  const detail = body?.error
    ? `${body.error.errorCode ?? ''} ${body.error.message ?? ''} ${body.error.details ?? ''}`.trim()
    : body?.message || ''
  return { success: false, error: `[SENS mail ${status}] ${detail || 'unknown'}`.slice(0, 500) }
}

export async function sendSensMail(
  env: SensMailEnv,
  p: { to: string; subject: string; html: string },
): Promise<{ success: boolean; error?: string }> {
  const accessKey = String(env.NCP_ACCESS_KEY ?? '')
  const secretKey = String(env.NCP_SECRET_KEY ?? '')
  const serviceId = String(env.NCP_SENS_MAIL_SERVICE_ID ?? '').trim()
  if (!accessKey || !secretKey || !env.NCP_MAIL_SENDER || !serviceId) return { success: false, error: 'sens_mail_not_configured' }
  const uri = sensMailUri(serviceId)
  const timestamp = String(Date.now())
  try {
    const signature = await sensSignature(secretKey, sensSignatureMessage('POST', uri, timestamp, accessKey))
    const res = await fetch(`${SENS_MAIL_HOST}${uri}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': accessKey,
        'x-ncp-apigw-signature-v2': signature,
      },
      body: JSON.stringify(buildSensMailBody(env, p)),
      signal: AbortSignal.timeout(15000),
    })
    const body = (await res.json().catch(() => null)) as Parameters<typeof interpretSensMailResponse>[1]
    return interpretSensMailResponse(res.status, body)
  } catch (err) {
    return { success: false, error: `[SENS mail] ${String((err as Error)?.message ?? err).slice(0, 300)}` }
  }
}
