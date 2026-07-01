/**
 * 🆕 2026-06-29 (대표 — "먼저 분석하고 결정"): 경량 퍼널 계측.
 *
 *   목적: 유어딜 소비자 플로우의 **실제 이탈률**을 측정 → 정체성/플로우 결정을 근거 기반으로.
 *   지도(코드추론)에서 나온 6개 지점을 이벤트로 심어, 어드민에서 퍼널 전환율을 본다.
 *
 *   설계 (D1 부담 최소 + 개인정보 없음):
 *     - 화이트리스트 이벤트만 기록(임의 이벤트 무시). 개인정보 0 — 익명 device id(fid, 클라 랜덤).
 *     - app_open 은 클라에서 **세션당 1회**(sessionStorage 가드)라 페이지뷰마다 안 씀 → 쓰기 상한 = 세션수.
 *       나머지는 전환 이벤트라 자연 저볼륨.
 *     - best-effort(항상 204, 실패해도 UX 무영향) + 0.5% 확률 90일 정리(clickguard 패턴).
 *
 * Endpoints:
 *   POST /api/funnel/track   (공개, rateLimit, 화이트리스트) — 이벤트 1건 기록
 *   GET  /api/admin/funnel   (requireAdmin) — 일자별 퍼널 집계 + 전환율 + DAU
 */
import { Hono } from 'hono'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { requireAdmin } from '../../../worker/middleware/auth'
import { safeError } from '@/worker/utils/safe-error'
import { swallow } from '@/worker/utils/swallow'
import type { Env } from '../../../worker/types/env'

export const funnelRoutes = new Hono<{ Bindings: Env }>()

// 화이트리스트 — 이탈 지도 6지점. 이 밖의 이벤트는 무시(오염/남용 방지).
const FUNNEL_EVENTS = new Set([
  'app_open',            // 세션 시작(세션당 1회) — DAU/리텐션
  'login_wall_shown',    // 로그인 벽 노출(결제/링크샵) — 이탈 1위 후보
  'login_succeeded',     // 로그인 성공
  'checkout_started',    // 결제 시작
  'payment_succeeded',   // 결제 완료
  'empty_region_shown',  // 동네딜 빈 지역 노출 — "우리 동네 없네" 이탈
])

function kstDay(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

const _schemaDone = new WeakSet<object>()
async function ensureFunnelSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS funnel_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    fid TEXT,
    day TEXT NOT NULL,
    meta TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('funnel:schema'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_funnel_day_event ON funnel_events(day, event)').run().catch(swallow('funnel:idx1'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_funnel_fid_day ON funnel_events(fid, day)').run().catch(swallow('funnel:idx2'))
}

// ── POST /api/funnel/track — 이벤트 1건(공개, best-effort, 항상 204) ──
funnelRoutes.post('/funnel/track', rateLimit({ action: 'funnel_track', max: 60, windowSec: 60 }), async (c) => {
  try {
    const { DB } = c.env
    const body = await c.req.json<{ event?: string; fid?: string; meta?: unknown }>().catch(() => ({} as { event?: string; fid?: string; meta?: unknown }))
    const event = String(body.event || '')
    if (!FUNNEL_EVENTS.has(event)) return c.body(null, 204) // 화이트리스트 밖 무시
    // 익명 device id — 영숫자/-/_ 40자 제한(개인정보 아님, 클라 랜덤).
    const fid = typeof body.fid === 'string' ? body.fid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) : null
    const meta = body.meta != null ? JSON.stringify(body.meta).slice(0, 300) : null
    await ensureFunnelSchema(DB)
    await DB.prepare('INSERT INTO funnel_events (event, fid, day, meta) VALUES (?, ?, ?, ?)')
      .bind(event, fid, kstDay(), meta).run().catch(() => { /* fail-soft */ })
    // 0.5% 확률로 90일 이전 정리(누적 무한증가 방지). worker 는 Math.random 사용 가능.
    if (Math.random() < 0.005) {
      await DB.prepare("DELETE FROM funnel_events WHERE created_at < datetime('now','-90 days')").run().catch(() => {})
    }
    return c.body(null, 204)
  } catch {
    return c.body(null, 204)
  }
})

// ── GET /api/admin/funnel?days=N — 일자별 집계 + 전환율(어드민) ──
funnelRoutes.get('/admin/funnel', requireAdmin(), async (c) => {
  try {
    const { DB } = c.env
    const dRaw = Number(c.req.query('days'))
    const days = Number.isFinite(dRaw) && dRaw > 0 && dRaw <= 90 ? Math.floor(dRaw) : 14
    await ensureFunnelSchema(DB)

    // 일자×이벤트 카운트 + 고유 device 수.
    const rows = await DB.prepare(`
      SELECT day, event, COUNT(*) AS cnt, COUNT(DISTINCT fid) AS users
        FROM funnel_events
       WHERE day >= date('now','+9 hours', ?)
       GROUP BY day, event
       ORDER BY day DESC
    `).bind(`-${days} days`).all<{ day: string; event: string; cnt: number; users: number }>()
      .catch(() => ({ results: [] as { day: string; event: string; cnt: number; users: number }[] }))

    // 이벤트별 총합(기간 전체) — 퍼널 전환율 계산용.
    const totalsRows = await DB.prepare(`
      SELECT event, COUNT(*) AS cnt, COUNT(DISTINCT fid) AS users
        FROM funnel_events
       WHERE day >= date('now','+9 hours', ?)
       GROUP BY event
    `).bind(`-${days} days`).all<{ event: string; cnt: number; users: number }>()
      .catch(() => ({ results: [] as { event: string; cnt: number; users: number }[] }))

    const totals: Record<string, { cnt: number; users: number }> = {}
    for (const r of totalsRows.results || []) totals[r.event] = { cnt: Number(r.cnt) || 0, users: Number(r.users) || 0 }
    const cnt = (e: string) => totals[e]?.cnt || 0

    // 핵심 전환율(이탈 지도) — cnt 기준(발생 횟수).
    const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0)
    const funnel = {
      // 로그인 벽 → 로그인 성공 (벽에서 얼마나 넘어오나)
      login_wall_to_success: pct(cnt('login_succeeded'), cnt('login_wall_shown')),
      // 결제 시작 → 결제 완료 (결제 이탈)
      checkout_to_payment: pct(cnt('payment_succeeded'), cnt('checkout_started')),
      // 빈 지역 노출이 앱오픈 대비 얼마나 잦은가(동네딜 coverage 문제 신호)
      empty_region_rate: pct(cnt('empty_region_shown'), cnt('app_open')),
    }

    // 일자별 DAU(app_open 고유 device).
    const dau: Record<string, number> = {}
    for (const r of rows.results || []) {
      if (r.event === 'app_open') dau[r.day] = Number(r.users) || 0
    }

    return c.json({
      success: true,
      days,
      totals,
      funnel,
      dau,
      byDay: rows.results || [],
      note: '전환율은 발생 횟수(cnt) 기준. app_open 은 세션당 1회라 DAU 근사. 개인정보 0(익명 fid).',
    })
  } catch (err) {
    return safeError(c, err, '퍼널 데이터 조회 중 오류가 발생했습니다', '[funnel]')
  }
})

export default funnelRoutes
