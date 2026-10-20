/**
 * 🚨 2026-07-01 (대표 "이상적으로 구현 안 된 부분" 마감): 카드(Toss) 환불 실패의 어드민 가시화.
 *
 * 배경: 환불 경로 3곳(유저 셀프취소 / 셀러 수동환불 / 어드민 강제환불)이 tossCancelPayment 실패를
 * DEV 콘솔에만 남겨 **조용한 미환불** 가능. retryable(5xx/PROVIDER) 실패는 toss-gateway 가
 * `toss_refund_failures` 에 기록하고 toss-refund-retry cron 이 5회 backoff 재시도 + dead-letter
 * Discord 알림까지 커버하지만, **non-retryable(4xx)·예외**는 어디에도 안 남았음.
 *
 * 이 헬퍼: non-retryable/unknown 실패만(중복 방지 — retryable 은 cron 파이프라인 소관) 어드민
 * 대시보드 벨 + Discord(설정 시)로 즉시 알림 → 운영자가 Toss 콘솔에서 수동 환불.
 * 전부 fail-soft(알림 실패가 환불 플로우를 못 막음).
 */
import { createDashboardNotification } from '../../features/notifications/api/dashboard-notifications.routes'

const RETRYABLE_CODES = new Set(['PROVIDER_ERROR', 'FAILED_INTERNAL_SYSTEM_PROCESSING'])

export interface TossRefundFailureInfo {
  /** 출처 라벨(예: '셀프취소', '셀러 환불', '어드민 강제환불'). */
  source: string
  paymentKey?: string | null
  voucherId?: number | string | null
  amount?: number | null
  errorCode?: string | null
  errorMessage?: string | null
  httpStatus?: number | null
}

/** toss-gateway 와 동일 기준의 retryable 판정 — retryable 은 cron 이 처리하므로 여기선 skip. */
export function isRetryableTossFailure(info: Pick<TossRefundFailureInfo, 'errorCode' | 'httpStatus'>): boolean {
  if ((info.httpStatus ?? 0) >= 500) return true
  return !!info.errorCode && RETRYABLE_CODES.has(info.errorCode)
}

export async function alertTossRefundFailure(
  env: { DISCORD_WEBHOOK_URL?: string },
  DB: D1Database,
  info: TossRefundFailureInfo,
): Promise<void> {
  if (isRetryableTossFailure(info)) return // cron 파이프라인(재시도+dead-letter) 소관 — 이중 알림 방지
  const amountTxt = info.amount ? `${Number(info.amount).toLocaleString('ko-KR')}원` : '금액 미상'
  const detail = `[${info.source}] ${amountTxt} · voucher ${info.voucherId ?? '-'} · ${info.errorCode || 'UNKNOWN'}: ${(info.errorMessage || '').slice(0, 120)}`
  try {
    await createDashboardNotification(
      DB, 'admin', null, 'refund_failed',
      '💳 카드 환불 실패 — 수동 처리 필요',
      `${detail}\nToss 콘솔에서 paymentKey ${info.paymentKey || '-'} 직접 환불하세요.`,
      '/admin/payouts',
    )
  } catch { /* fail-soft */ }
  const webhook = env.DISCORD_WEBHOOK_URL
  if (webhook) {
    try {
      const { sendDiscordAlert } = await import('./discord-alert')
      await sendDiscordAlert(webhook, '🚨 카드 환불 실패 (non-retryable) — 수동 처리 필요', `${detail}\npaymentKey: ${info.paymentKey || '-'}`, 'error')
    } catch { /* fail-soft */ }
  }
}
