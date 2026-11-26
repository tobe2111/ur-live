/**
 * 🏢 AI 팀 근무 기록 어드민 API (2026-11-26 대표 "어드민 대시보드에 한 페이지에서")
 *   - GET  /ai-team/activity?limit=  — 최근 근무 기록(어드민 `/admin/ai-team` 이 30초마다 읽는다)
 *   - POST /ai-team/activity         — 팀 루틴이 시작·끝에 한 줄 {team, state, routine?, summary?, grade?, session_url?}
 *   - GET  /ai-team/tasks?fresh=1      — 규칙으로 찾은 팀별 일감(저장 안 함 · 해결되면 사라짐 · 60초 메모)
 *   adminApp 아래 마운트라 requireAdmin·IP 화이트리스트·감사 미들웨어를 상속한다. 머니 경로 없음.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import type { AuthUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { safeError } from '@/worker/utils/safe-error'
import { intParam } from '@/shared/pagination'
import { listAiTeamActivity, parseAiTeamActivity, recordAiTeamActivity } from '@/worker/utils/ai-team-activity'
import { findAiTeamTasks } from '@/worker/utils/ai-team-tasks'

export const adminAiTeamRoutes = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

adminAiTeamRoutes.get('/ai-team/activity', async (c) => {
  try {
    const limit = intParam(c.req.query('limit'), 100)
    const items = await listAiTeamActivity(c.env.DB, limit)
    return c.json({ success: true, items })
  } catch (err) {
    return safeError(c, err, 'AI 팀 근무 기록을 불러오지 못했습니다', '[admin-ai-team]')
  }
})

adminAiTeamRoutes.post(
  '/ai-team/activity',
  rateLimit({ action: 'ai_team_activity', max: 120, windowSec: 600 }),
  async (c) => {
    const body = await c.req.json().catch(() => null)
    const input = parseAiTeamActivity(body)
    if (!input) return c.json({ success: false, error: 'INVALID_ACTIVITY' }, 400)
    try {
      await recordAiTeamActivity(c.env.DB, input)
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, 'AI 팀 근무 기록을 저장하지 못했습니다', '[admin-ai-team]')
    }
  },
)

adminAiTeamRoutes.get('/ai-team/tasks', async (c) => {
  try {
    const result = await findAiTeamTasks(c.env.DB, { fresh: c.req.query('fresh') === '1' })
    return c.json({ success: true, ...result })
  } catch (err) {
    return safeError(c, err, 'AI 팀 일감을 불러오지 못했습니다', '[admin-ai-team]')
  }
})
