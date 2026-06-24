/**
 * 🖋️ 유캔싸인(전자계약) 설정 진단 — 어드민 전용 (2026-06-24)
 *
 *   대표가 Cloudflare 에 UCANSIGN_* 시크릿/템플릿/웹훅을 등록한 뒤, **사람이 일일이 테스트하지 않고**
 *   버튼 한 번으로 "발송 준비 완료 여부"를 확인하기 위한 read-only 진단.
 *
 *   GET /api/admin/ucansign/health
 *     - 각 env 의 *존재 여부*(boolean — 값은 절대 노출 안 함)
 *     - API 키 *실제 유효성*(유캔싸인 토큰 발급 1회 — 계약 발송/포인트 차감 없음)
 *     - 가입 유형(제조사/판매사)별 발송 가능 여부 + 부족 항목 힌트
 *
 *   ⚠️ debug-* 가 아님: requireAdmin 게이트 + 시크릿 값 미노출(boolean·유효성만). 데이터 변경 0(GET).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { verifyUcansignAuth } from '@/worker/utils/ucansign-gateway'

export const adminUcansignRoutes = new Hono<{ Bindings: Env }>()
adminUcansignRoutes.use('*', requireAdmin())

adminUcansignRoutes.get('/health', async (c) => {
  const env = c.env
  const present = (v?: string) => typeof v === 'string' && v.trim().length > 0

  const config = {
    api_key: present(env.UCANSIGN_API_KEY),
    template_supplier: present(env.UCANSIGN_TEMPLATE_ID_SUPPLIER),
    template_distributor: present(env.UCANSIGN_TEMPLATE_ID_DISTRIBUTOR),
    template_fallback: present(env.UCANSIGN_TEMPLATE_ID),
    webhook_secret: present(env.UCANSIGN_WEBHOOK_SECRET),
    test_mode: env.UCANSIGN_TEST_MODE === 'true',
  }

  // API 키 실제 유효성 — 토큰 발급만(발송·포인트 차감 없음). 값은 반환 안 함.
  let apiKeyValid: boolean | null = null
  let apiKeyReason: string | undefined
  if (config.api_key) {
    const r = await verifyUcansignAuth(env).catch(() => ({ ok: false, reason: 'auth_failed' as const }))
    apiKeyValid = r.ok
    if (!r.ok) apiKeyReason = r.reason
  }

  // 유형별 발송 가능: 키 유효 + (유형 템플릿 || 공용 폴백 템플릿)
  const canSend = (typeTemplate: boolean) => apiKeyValid === true && (typeTemplate || config.template_fallback)
  const ready = {
    supplier: canSend(config.template_supplier),
    distributor: canSend(config.template_distributor),
  }

  // 사람이 바로 알 수 있는 부족 항목 힌트.
  const hints: string[] = []
  if (!config.api_key) hints.push('UCANSIGN_API_KEY 미설정 — Cloudflare Secret 에 등록 필요')
  else if (apiKeyValid === false) hints.push(`API 키 인증 실패(${apiKeyReason ?? 'auth_failed'}) — 키 오타/만료/포인트 확인`)
  if (!config.template_supplier && !config.template_fallback) hints.push('제조사 템플릿 없음 — UCANSIGN_TEMPLATE_ID_SUPPLIER(또는 공용 UCANSIGN_TEMPLATE_ID) 설정')
  if (!config.template_distributor && !config.template_fallback) hints.push('판매사 템플릿 없음 — UCANSIGN_TEMPLATE_ID_DISTRIBUTOR(또는 공용 UCANSIGN_TEMPLATE_ID) 설정')
  if (!config.webhook_secret) hints.push('UCANSIGN_WEBHOOK_SECRET 미설정 — 권장(웹훅 위조 방지). 미설정 시 documentId 매칭만으로 동작')
  hints.push('유캔싸인 개발자>Webhook 에 URL 등록 필요(이 진단으로는 확인 불가): https://live.ur-team.com/api/webhooks/ucansign · signing_completed_all')
  if (config.test_mode) hints.push('UCANSIGN_TEST_MODE=true — 테스트 발송(효력 미보장 워터마크·포인트 0). 운영 전 해제')

  return c.json({
    success: true,
    config,
    api_key_valid: apiKeyValid,
    ready,
    webhook_url: 'https://live.ur-team.com/api/webhooks/ucansign',
    overall_ready: ready.supplier && ready.distributor,
    hints,
  })
})
