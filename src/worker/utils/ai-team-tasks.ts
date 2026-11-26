/**
 * 🏢 AI 팀 일감 자동 발견 (2026-11-26 대표 "실제로 자동으로 할 일들을 찾아서 일한다던지" → "응 해봐").
 *   AI 를 쓰지 않는 규칙(SQL 집계)으로 회사 전체를 훑어 팀별 "일감" 을 만든다.
 *   - 저장하지 않는다: 읽을 때마다 계산 → 해결되면 저절로 사라진다(닫는 일이 따로 없다).
 *   - 규칙 하나가 실패해도 나머지는 나온다(`errors` 에 규칙 id 만 남김 — 0 으로 위장하지 않는다).
 *   - 인스턴스당 60초 메모 — 어드민 화면이 30초마다 읽어도 D1 은 분당 1회.
 *   읽기 전용. 머니 경로 없음(지급 대기는 "세기" 만 한다).
 */
import { AI_TEAM_ACTIVITY_TABLE_SQL } from './ai-team-activity'

export type AiTaskSeverity = 'high' | 'mid' | 'low'

export interface AiTeamTask {
  id: string
  team: string
  title: string
  count: number
  severity: AiTaskSeverity
  detail: string | null
  link: string | null
}

/** 대표가 "실제 영업 대상 아님" 이라 한 셀러(2026-11-18: 20 청룡갈비 · 23 박달집흑염소) + 시험 셀러 24.
 *  이름에 '테스트·아파트·해수욕장' 이 든 시험 매장도 뺀다(영업 아침 보고와 같은 기준). */
export const AI_TEAM_EXCLUDED_SELLER_IDS = [20, 23, 24] as const
const EXCL = AI_TEAM_EXCLUDED_SELLER_IDS.join(',')

type Row = Record<string, unknown>
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const str = (v: unknown) => (v == null ? '' : String(v))

interface Rule {
  id: string
  team: string
  run: (DB: D1Database) => Promise<Omit<AiTeamTask, 'id' | 'team'> | null>
}

async function first(DB: D1Database, sql: string): Promise<Row> {
  return (await DB.prepare(sql).first<Row>()) ?? {}
}
async function all(DB: D1Database, sql: string): Promise<Row[]> {
  return (await DB.prepare(sql).all<Row>()).results ?? []
}
/** D1 의 'YYYY-MM-DD HH:MM:SS'(UTC) 가 지금부터 몇 시간 전인가. */
function hoursAgo(utc: unknown): number {
  const s = str(utc)
  if (!s) return 0
  const t = Date.parse(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')
  return Number.isFinite(t) ? (Date.now() - t) / 3_600_000 : 0
}

export const AI_TEAM_RULES: Rule[] = [
  {
    id: 'seller-approval', team: 'ops',
    run: async (DB) => {
      const r = await first(DB, "SELECT COUNT(*) n, MIN(created_at) oldest FROM sellers WHERE status = 'pending'")
      const n = num(r.n)
      if (!n) return null
      const h = hoursAgo(r.oldest)
      return { title: `사장님 판매 승인 대기 ${n}건`, count: n, severity: h > 48 ? 'high' : 'mid',
        detail: `가장 오래된 건 ${Math.floor(h)}시간째`, link: '/admin/seller-approval' }
    },
  },
  {
    id: 'biz-verification', team: 'ops',
    run: async (DB) => {
      const r = await first(DB, "SELECT COUNT(*) n FROM sellers WHERE business_registration_status = 'pending'")
      const n = num(r.n)
      return n ? { title: `사업자등록 검증 대기 ${n}건`, count: n, severity: 'mid', detail: null, link: '/admin/business-verification' } : null
    },
  },
  {
    id: 'stalled-stores', team: 'sales',
    run: async (DB) => {
      const rows = await all(DB, `SELECT s.id, COALESCE(NULLIF(s.business_name,''), s.name) nm,
          CASE WHEN COALESCE(s.bank_account,'') = '' THEN 1 ELSE 0 END no_bank,
          (SELECT COUNT(*) FROM products p WHERE p.seller_id = s.id AND p.is_active = 1 AND COALESCE(p.is_supply_product,0) = 0) live
        FROM sellers s
        WHERE s.status = 'approved' AND COALESCE(s.is_distributor,0) = 0 AND s.id NOT IN (${EXCL})
          AND COALESCE(s.name,'') NOT LIKE '%테스트%' AND COALESCE(s.business_name,'') NOT LIKE '%테스트%'
          AND COALESCE(s.business_name, s.name, '') NOT LIKE '%아파트%' AND COALESCE(s.business_name, s.name, '') NOT LIKE '%해수욕장%'
        ORDER BY s.id DESC LIMIT 50`)
      const stalled = rows.filter(r => num(r.no_bank) === 1 || num(r.live) === 0)
      if (!stalled.length) return null
      const names = stalled.slice(0, 4).map(r => `${str(r.nm)}(${num(r.no_bank) ? '계좌 없음' : ''}${num(r.no_bank) && !num(r.live) ? '·' : ''}${num(r.live) ? '' : '이용권 없음'})`)
      return { title: `팔 준비가 안 된 매장 ${stalled.length}곳`, count: stalled.length, severity: 'high',
        detail: names.join(', '), link: '/admin/store-owner' }
    },
  },
  {
    // 🧾 2026-11-26 가상 손님 100명 패널(대표 "응 모두 하자"): 근처 손님도 "몇 인분인지·구성이 뭔지 없다"로 18명이 떠났다.
    //   팔고 있는 실제 이용권 중 구성 설명(description)이 비었거나 제목만 되풀이하는 것 → 매장영업이 사장님께 받아 채운다.
    id: 'products-missing-info', team: 'sales',
    run: async (DB) => {
      const rows = await all(DB, `SELECT p.id, p.name, COALESCE(NULLIF(p.restaurant_name,''), s.name) store
        FROM products p JOIN sellers s ON s.id = p.seller_id
        WHERE p.is_active = 1 AND COALESCE(p.is_supply_product,0) = 0 AND s.status = 'approved' AND s.id NOT IN (${EXCL})
          AND COALESCE(p.group_buy_status,'') = 'active'
          AND (TRIM(COALESCE(p.description,'')) = '' OR TRIM(p.description) = TRIM(p.name))
        ORDER BY p.id DESC LIMIT 50`)
      if (!rows.length) return null
      return { title: `구성 설명이 없는 이용권 ${rows.length}개`, count: rows.length, severity: 'mid',
        detail: rows.slice(0, 4).map(r => `${str(r.store)} ${str(r.name)}`).join(', ') + ' — 몇 인분·구성·사진을 사장님께 받기',
        link: '/admin/products' }
    },
  },
  {
    id: 'store-inquiries', team: 'sales',
    run: async (DB) => {
      const r = await first(DB, "SELECT COUNT(*) n FROM partnership_inquiries WHERE status = 'new'")
      const n = num(r.n)
      return n ? { title: `답하지 않은 입점·제휴 문의 ${n}건`, count: n, severity: 'high', detail: null, link: '/admin/partnership' } : null
    },
  },
  {
    id: 'cron-failures', team: 'dev',
    run: async (DB) => {
      const rows = await all(DB, `SELECT job_name, COUNT(*) n FROM cron_failures
        WHERE COALESCE(resolved,0) = 0 AND severity IN ('critical','error') AND created_at >= datetime('now','-1 day')
        GROUP BY job_name ORDER BY n DESC LIMIT 5`)
      const n = rows.reduce((a, r) => a + num(r.n), 0)
      if (!n) return null
      return { title: `예약 작업(cron) 실패 ${n}건 (24시간)`, count: n, severity: 'high',
        detail: rows.map(r => `${str(r.job_name)} ${num(r.n)}`).join(', '), link: '/admin/system-monitoring' }
    },
  },
  {
    id: 'delivery-failures', team: 'dev',
    run: async (DB) => {
      const a = await first(DB, "SELECT COUNT(*) n FROM email_failures WHERE COALESCE(resolved,0) = 0 AND created_at >= datetime('now','-1 day')")
      const b = await first(DB, "SELECT COUNT(*) n FROM alimtalk_failures WHERE COALESCE(resolved,0) = 0 AND created_at >= datetime('now','-1 day')")
      const n = num(a.n) + num(b.n)
      return n ? { title: `메일·알림톡 발송 실패 ${n}건 (24시간)`, count: n, severity: 'mid',
        detail: `메일 ${num(a.n)} · 알림톡 ${num(b.n)}`, link: '/admin/system-monitoring' } : null
    },
  },
  {
    id: 'frontend-errors', team: 'qa',
    run: async (DB) => {
      const rows = await all(DB, `SELECT substr(message,1,80) m, COUNT(*) n FROM frontend_errors
        WHERE created_at >= datetime('now','-1 day') AND message NOT LIKE '%ResizeObserver%'
        GROUP BY m ORDER BY n DESC LIMIT 3`)
      const top = rows.reduce((a, r) => a + num(r.n), 0)
      if (top < 10) return null
      return { title: `손님 화면 오류 상위 ${top}건 (24시간)`, count: top, severity: top >= 50 ? 'high' : 'mid',
        detail: rows.map(r => `${str(r.m)} ×${num(r.n)}`).join(' / '), link: '/admin/errors' }
    },
  },
  {
    id: 'refund-required', team: 'ops',
    run: async (DB) => {
      const r = await first(DB, "SELECT COUNT(*) n FROM orders WHERE status = 'REFUND_REQUIRED'")
      const n = num(r.n)
      return n ? { title: `환불 처리 필요 주문 ${n}건`, count: n, severity: 'high', detail: null, link: '/admin/orders' } : null
    },
  },
  {
    id: 'disputes', team: 'ops',
    run: async (DB) => {
      const a = await first(DB, "SELECT COUNT(*) n FROM voucher_disputes WHERE status IN ('open','contested')")
      const b = await first(DB, 'SELECT COUNT(*) n FROM disputes WHERE resolved_at IS NULL')
      const c = await first(DB, "SELECT COUNT(*) n FROM store_reports WHERE status = 'open'")
      const n = num(a.n) + num(b.n) + num(c.n)
      return n ? { title: `분쟁·신고 미해결 ${n}건`, count: n, severity: 'high',
        detail: `이용권 분쟁 ${num(a.n)} · 사용 분쟁 ${num(b.n)} · 매장 신고 ${num(c.n)}`, link: '/admin/disputes' } : null
    },
  },
  {
    id: 'payouts-waiting', team: 'finance',
    run: async (DB) => {
      const r = await first(DB, "SELECT COUNT(*) n, COALESCE(SUM(amount),0) won, MIN(created_at) oldest FROM payouts WHERE status IN ('pending','approved')")
      const n = num(r.n)
      if (!n) return null
      const h = hoursAgo(r.oldest)
      return { title: `송금 대기 ${n}건`, count: n, severity: h > 24 * 8 ? 'high' : 'low',
        detail: `합계 ${num(r.won).toLocaleString('ko-KR')}원 · 가장 오래된 건 ${Math.floor(h / 24)}일째`, link: '/admin/payouts' }
    },
  },
  {
    id: 'cs-unanswered', team: 'support',
    run: async (DB) => {
      const rows = await all(DB, `SELECT sample, hits FROM cs_unanswered_questions
        WHERE last_seen >= datetime('now','-7 days') ORDER BY hits DESC LIMIT 3`)
      if (!rows.length) return null
      return { title: `카톡 봇이 답 못 한 질문 ${rows.length}종 (7일)`, count: rows.length, severity: 'low',
        detail: rows.map(r => `${str(r.sample).slice(0, 30)} ×${num(r.hits)}`).join(' / '), link: null }
    },
  },
  {
    id: 'team-stuck', team: 'ceo-office',
    run: async (DB) => {
      await DB.prepare(AI_TEAM_ACTIVITY_TABLE_SQL).run()
      const rows = await all(DB, `SELECT a.team, a.routine FROM ai_team_activity a
        WHERE a.created_at >= datetime('now','-1 day')
          AND ((a.state = 'started' AND a.created_at < datetime('now','-90 minutes')
                AND NOT EXISTS (SELECT 1 FROM ai_team_activity b WHERE b.team = a.team AND b.id > a.id))
               OR a.state = 'failed')
        ORDER BY a.id DESC LIMIT 5`)
      if (!rows.length) return null
      return { title: `실패·응답 없는 팀 근무 ${rows.length}건`, count: rows.length, severity: 'high',
        detail: rows.map(r => `${str(r.team)} ${str(r.routine)}`).join(', '), link: '/admin/ai-team' }
    },
  },
]

export interface AiTeamTasksResult {
  tasks: AiTeamTask[]
  errors: string[]
  checked_at: string
}

const SEV: Record<AiTaskSeverity, number> = { high: 0, mid: 1, low: 2 }
let memo: { at: number; value: AiTeamTasksResult } | null = null

export async function findAiTeamTasks(DB: D1Database, opts: { fresh?: boolean } = {}): Promise<AiTeamTasksResult> {
  if (!opts.fresh && memo && Date.now() - memo.at < 60_000) return memo.value
  const tasks: AiTeamTask[] = []
  const errors: string[] = []
  const results = await Promise.allSettled(AI_TEAM_RULES.map(r => r.run(DB)))
  results.forEach((res, i) => {
    const rule = AI_TEAM_RULES[i]
    if (res.status === 'rejected') errors.push(rule.id)
    else if (res.value) tasks.push({ id: rule.id, team: rule.team, ...res.value })
  })
  tasks.sort((a, b) => SEV[a.severity] - SEV[b.severity] || b.count - a.count)
  const value = { tasks, errors, checked_at: new Date().toISOString() }
  memo = { at: Date.now(), value }
  return value
}
