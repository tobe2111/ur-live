/**
 * 📥 결재함 어드민 API (2026-09-08 대표 "어드민으로 해")
 *   - GET  /decisions/answers           — 대표가 어드민에서 남긴 답 전부(동기화 여부 포함)
 *   - POST /decisions/:slug/answer      — 답 저장/덮어쓰기 {answer}
 *   - POST /decisions/:slug/synced      — 커넥터 대리인이 파일 반영·머지 뒤 표시 {ref}
 *   adminApp 아래 마운트라 requireAdmin·IP 화이트리스트·감사 미들웨어를 상속한다.
 *   머니 경로 없음. 결재 내용 자체는 docs/decisions/*.md(빌드 인라인)이고 여기는 답만 다룬다.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import type { AuthUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { safeError } from '@/worker/utils/safe-error'
import {
  listDecisionAnswers, upsertDecisionAnswer, markDecisionAnswerSynced,
  isValidDecisionSlug, normalizeDecisionAnswer, DECISION_ANSWER_MAX,
} from '@/worker/utils/decision-answers'

export const adminDecisionsRoutes = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

adminDecisionsRoutes.get('/decisions/answers', async (c) => {
  try {
    const answers = await listDecisionAnswers(c.env.DB)
    return c.json({ success: true, answers })
  } catch (err) {
    return safeError(c, err, '결재 답을 불러오지 못했습니다', '[admin-decisions]')
  }
})

adminDecisionsRoutes.post(
  '/decisions/:slug/answer',
  rateLimit({ action: 'decision_answer', max: 30, windowSec: 600 }),
  async (c) => {
    const slug = c.req.param('slug')
    if (!isValidDecisionSlug(slug)) return c.json({ success: false, error: 'INVALID_SLUG' }, 400)
    const body = await c.req.json().catch(() => ({})) as { answer?: unknown }
    const answer = normalizeDecisionAnswer(body.answer)
    if (!answer) return c.json({ success: false, error: 'INVALID_ANSWER', max: DECISION_ANSWER_MAX }, 400)
    try {
      const u = c.get('user')
      const by = u?.email ? String(u.email) : (u?.id != null ? `admin:${u.id}` : null)
      await upsertDecisionAnswer(c.env.DB, slug, answer, by)
      return c.json({ success: true, slug, answer, answered_by: by })
    } catch (err) {
      return safeError(c, err, '결재 답을 저장하지 못했습니다', '[admin-decisions]')
    }
  },
)

adminDecisionsRoutes.post('/decisions/:slug/synced', async (c) => {
  const slug = c.req.param('slug')
  if (!isValidDecisionSlug(slug)) return c.json({ success: false, error: 'INVALID_SLUG' }, 400)
  const body = await c.req.json().catch(() => ({})) as { ref?: unknown }
  const ref = typeof body.ref === 'string' ? body.ref.trim().slice(0, 120) : ''
  if (!ref) return c.json({ success: false, error: 'INVALID_REF' }, 400)
  try {
    const changed = await markDecisionAnswerSynced(c.env.DB, slug, ref)
    return c.json({ success: true, changed })
  } catch (err) {
    return safeError(c, err, '동기화 표시를 저장하지 못했습니다', '[admin-decisions]')
  }
})
