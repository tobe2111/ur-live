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
 * API: POST https://mail.apigw.ntruss.com/api/v1/mails (KR 리전) · 인증 헤더 3종(알림톡과 동일).
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
}

export const SENS_MAIL_HOST = 'https://mail.apigw.ntruss.com'
export const SENS_MAIL_URI = '/api/v1/mails'

export function sensMailConfigured(e: Record<string, unknown> | null | undefined): boolean {
  return !!(e && e.NCP_ACCESS_KEY && e.NCP_SECRET_KEY && e.NCP_MAIL_SENDER)
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

/** 요청 본문 — 순수 함수(시험이 직접 잰다). 한 통에 한 명(individual), 홍보 아님(advertising false). */
export function buildSensMailBody(
  env: SensMailEnv,
  p: { to: string; subject: string; html: string },
): Record<string, unknown> {
  return {
    senderAddress: String(env.NCP_MAIL_SENDER ?? ''),
    senderName: String(env.NCP_MAIL_SENDER_NAME || '유어딜'),
    title: p.subject,
    body: p.html,
    recipients: [{ address: p.to, type: 'R' }],
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
  if (!accessKey || !secretKey || !env.NCP_MAIL_SENDER) return { success: false, error: 'sens_mail_not_configured' }
  const timestamp = String(Date.now())
  try {
    const signature = await sensSignature(secretKey, sensSignatureMessage('POST', SENS_MAIL_URI, timestamp, accessKey))
    const res = await fetch(`${SENS_MAIL_HOST}${SENS_MAIL_URI}`, {
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
