/**
 * 🛡️ 2026-05-23 결제/인증 사전 점검 endpoint.
 *
 * GET /api/_healthcheck/payments
 *   - TOSS_CLIENT_KEY 존재 + prefix (gck/widget/missing)
 *   - TOSS_SECRET_KEY 존재 + prefix
 *   - 두 키 환경 일치 (live/test)
 *   - decideTossFlow 판정
 *
 * 인증 없음 — 민감 데이터 마스킹.
 * cron / 외부 모니터링이 매 시간 호출 → 비정상 감지.
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'

export const healthcheckRoutes = new Hono<{ Bindings: Env }>()

function mask(key: string | undefined): string {
  if (!key) return '(empty)'
  if (key.length <= 12) return key
  return `${key.slice(0, 12)}...${key.slice(-4)}`
}

function detectKeyEnv(key: string | undefined): 'live' | 'test' | 'unknown' {
  if (!key) return 'unknown'
  if (/^live_/i.test(key)) return 'live'
  if (/^test_/i.test(key)) return 'test'
  return 'unknown'
}

healthcheckRoutes.get('/api/_healthcheck/payments', async (c) => {
  const env = c.env as { TOSS_CLIENT_KEY?: string; TOSS_SECRET_KEY?: string }
  const clientKey = env.TOSS_CLIENT_KEY || ''
  const secretKey = env.TOSS_SECRET_KEY || ''

  const { detectTossKeyType, decideTossFlow } = await import('../utils/toss-gateway')
  const clientKeyType = detectTossKeyType(clientKey)
  const clientKeyEnv = detectKeyEnv(clientKey)
  const secretKeyEnv = detectKeyEnv(secretKey)
  const { flow, flowReason } = decideTossFlow(clientKey)

  // Live/test mismatch 감지
  const envMatch = clientKeyEnv === secretKeyEnv
  const issues: string[] = []
  if (!clientKey) issues.push('TOSS_CLIENT_KEY missing')
  if (!secretKey) issues.push('TOSS_SECRET_KEY missing')
  if (!envMatch && clientKey && secretKey) {
    issues.push(`env mismatch: client=${clientKeyEnv}, secret=${secretKeyEnv}`)
  }
  if (clientKeyType === 'unknown') issues.push('client key prefix unknown')

  const healthy = issues.length === 0

  return c.json({
    success: true,
    healthy,
    data: {
      client_key: {
        masked: mask(clientKey),
        type: clientKeyType,
        env: clientKeyEnv,
      },
      secret_key: {
        masked: mask(secretKey),
        env: secretKeyEnv,
      },
      env_match: envMatch,
      flow,
      flow_reason: flowReason,
      issues,
      checked_at: new Date().toISOString(),
    },
  }, healthy ? 200 : 503)
})

healthcheckRoutes.get('/api/_healthcheck/version', async (c) => {
  // 배포된 코드 식별용 — deploy smoke test 에서 사용.
  return c.json({
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      worker: 'ur-live',
    },
  })
})
