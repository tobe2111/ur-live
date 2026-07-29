/**
 * 📜 2026-07-05 약관 동의 API — 유저(소비자) 동의 스텝/재동의 골격의 서버측.
 *   기록/조회 로직은 worker/utils/terms-agreements.ts SSOT. 셀러/에이전시 가입 동의는
 *   각 가입 API(seller-registration / agency.routes)가 서버측에서 직접 기록 — 여긴 소비자 전용.
 *
 *  - GET  /api/terms/status : 필수/선택 문서의 현행 버전 동의 여부 + 버전 맵.
 *    클라 TermsConsentGate 가 부족분을 감지해 동의 모달 표시 (신규 유저 첫 로그인 + 개정 재동의 공용).
 *  - POST /api/terms/agree  : [{doc_type, agreed}] 기록 — 버전은 서버 SSOT 스탬프(클라 값 신뢰 X).
 *    필수 문서는 agreed=true 만 허용(거부는 기록 안 함 — 사용 차단 정책은 별도 결정).
 */
import { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import type { Env } from '../types/env'
import {
  TERMS_DOC_VERSIONS, USER_REQUIRED_DOCS, USER_OPTIONAL_DOCS, isTermsDocType,
} from '../../shared/constants/terms-versions'
import { recordTermsAgreements, getCurrentTermsStatus } from '../utils/terms-agreements'

export const termsRoutes = new Hono<{ Bindings: Env }>()

termsRoutes.get('/status', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const status = await getCurrentTermsStatus(
    c.env.DB, 'user', String(user.id), [...USER_REQUIRED_DOCS, ...USER_OPTIONAL_DOCS],
  )
  const missingRequired = USER_REQUIRED_DOCS.filter((d) => !status[d])
  return c.json({
    success: true,
    data: {
      versions: TERMS_DOC_VERSIONS,
      status,
      missing_required: missingRequired,
      needs_consent: missingRequired.length > 0,
    },
  })
})

termsRoutes.post('/agree', rateLimit({ action: 'terms_agree', max: 10, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const body = await c.req.json<{ agreements?: Array<{ doc_type?: string; agreed?: boolean }> }>().catch(() => ({} as Record<string, never>))
  const list = (Array.isArray(body.agreements) ? body.agreements : [])
    .filter((a) => isTermsDocType(a?.doc_type))
    .map((a) => ({ doc_type: String(a.doc_type), agreed: !!a.agreed }))
  if (list.length === 0) return c.json({ success: false, error: '기록할 동의 항목이 없습니다' }, 400)
  // 필수 문서의 '거부'는 기록하지 않음 (미동의 상태 유지 → 게이트가 계속 요구)
  const filtered = list.filter((a) => a.agreed || !(USER_REQUIRED_DOCS as readonly string[]).includes(a.doc_type))
  const recorded = await recordTermsAgreements(c.env.DB, 'user', String(user.id), filtered)
  const status = await getCurrentTermsStatus(
    c.env.DB, 'user', String(user.id), [...USER_REQUIRED_DOCS, ...USER_OPTIONAL_DOCS],
  )
  return c.json({ success: true, data: { recorded, status } })
})
