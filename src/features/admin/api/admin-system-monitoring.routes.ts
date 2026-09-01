/**
 * 🛡️ 2026-05-07: 시스템 운영 모니터링 (admin 전용).
 *
 * - GET /api/admin/cron-heartbeats    — cron 마지막 실행 시각(오래된 순) — '안 돌았다' 탐지
 * - GET /api/admin/cron-failures      — Cron job 실패 목록 + 미해결 카운트
 * - PATCH /api/admin/cron-failures/:id/resolve  — 실패 해결 처리
 * - GET /api/admin/alimtalk-failures  — 알림톡 발송 실패 목록 + retry 상태
 * - POST /api/admin/alimtalk-failures/:id/retry — 즉시 재시도
 */
import { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import type { Env } from '@/worker/types/env'
import { isDocumentedRegistered } from '@/lib/alimtalk-templates'
import { listCronHeartbeats, getCronHealth, cpuDeathKey } from '@/worker/utils/cron-heartbeat'
import { neverFiredLanes, orphanLaneBeats, KNOWN_LANES_KEY } from '@/worker-ads/lane-cadence'

export const adminSystemMonitoringRoutes = new Hono<{ Bindings: Env }>()

// ── GET /cron-failures ──────────────────────────────────────────
adminSystemMonitoringRoutes.get('/cron-failures', async (c) => {
  const { DB } = c.env
  const resolved = c.req.query('resolved') === '1'
  try {
    const { results } = await DB.prepare(`
      SELECT id, job_name, error_message, severity, resolved, created_at
      FROM cron_failures
      WHERE resolved = ?
      ORDER BY created_at DESC LIMIT 100
    `).bind(resolved ? 1 : 0).all()

    const counts = await DB.prepare(`
      SELECT severity, COUNT(*) as cnt FROM cron_failures
      WHERE resolved = 0 GROUP BY severity
    `).all<{ severity: string; cnt: number }>().catch(() => ({ results: [] }))

    return c.json({
      success: true,
      data: {
        items: results || [],
        unresolved_counts: counts.results || [],
      },
    })
  } catch {
    // 테이블 없으면 빈 결과
    return c.json({ success: true, data: { items: [], unresolved_counts: [] } })
  }
})

// ── GET /cron-heartbeats ────────────────────────────────────────
// 💓 2026-07-28: cron_failures 는 **예외가 났을 때만** 남는다. 예외 없이 멈춘 경우
//   (미발화 / 게이트 OFF / 내부 .catch 로 삼킴)는 여기서만 보인다 — 오래된 순 정렬이라
//   맨 위가 곧 '멈췄을 가능성이 가장 높은 작업'이다. 상세 배경: worker/utils/cron-heartbeat.ts
adminSystemMonitoringRoutes.get('/cron-heartbeats', async (c) => {
  const items = await listCronHeartbeats(c.env.DB)
  // 하루 넘게 기록이 없으면 눈에 띄게(대부분 cron 이 일 1회 이상이다 — 주간/월간 작업은 오탐이므로
  // 화면에서 사람이 판단하도록 표시만 하고 서버는 단정하지 않는다).
  // 🪦 단, **유령은 뺀다** — 개명·승계된 옛 이름은 아무도 갱신하지 않아 영원히 나이를 먹는다.
  //   게이트(`getCronHealth`)와 경보(`cron-stale-watch`)는 이미 같은 판정으로 걸러서 조용한데
  //   이 목록만 안 걸러, 화면엔 12건이 뜨고 실제 알림은 2건인 상태였다. 그 격차가 오진을 만들었다:
  //   2026-08-08 에 두 세션이 이 목록을 읽고 "레인 4개 침묵"으로 보고했지만 진짜는 하나뿐이었다.
  //   ⚠️ 목록(`items`)에서 지우진 않는다 — 각 행에 `verdict` 가 실려 있어 화면이 라벨로 구분한다.
  const stale = items.filter(i => (i.age_minutes ?? 0) > 60 * 24 && (i.verdict ?? 'judge') === 'judge').map(i => i.name)

  // 🔭 2026-07-29: 하트비트는 **기록된 행**만 본다 — 게이트는 켜져 있는데 한 번도 안 돈 레인은
  //   목록에 아예 없어서 `stale` 판정 대상조차 아니다("안 도는 건지 원래 없는 건지" 구분 불가).
  //   ur-ads 스케줄러가 매 실행 남기는 '알고 있는 레인' 목록과 대조해 그 구멍을 메운다.
  //   실사례: `ads:collect-nps` — 게이트 ON 인데 기록이 없어 세션 여러 개가 같은 질문을 반복했다.
  let never_fired: string[] = []
  let orphan_lanes: string[] = []
  let known_lanes_at: string | null = null
  try {
    const row = await c.env.DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(KNOWN_LANES_KEY).first<{ value: string }>()
    if (row?.value) {
      const v = JSON.parse(row.value) as { at?: string; lanes?: string[] }
      known_lanes_at = v.at ?? null
      const lanes = Array.isArray(v.lanes) ? v.lanes : []
      never_fired = neverFiredLanes(lanes, items.map(i => i.name))
      // 🪦 반대 방향 — 기록은 있는데 지금 아무도 안 부르는 이름(이름 변경/삭제/게이트 OFF).
      //   그런 행은 아무도 갱신하지 않으니 **영원히 stale** 이다. 실측: `ads:sweep-kakao-phone`
      //   (레인이 `sweep-kakao-chain` 으로 개명됐는데 옛 행이 남아 계속 경보).
      // 🔴 **나이를 함께 넘긴다** — 안 넘기면 DO 알람·우회로 도는 멀쩡한 레인이 전부 고아로 찍혀
      //   (실측 16건 중 대부분) 진짜 하나를 묻는다. 근거: `orphanLaneBeats` 헤더.
      orphan_lanes = orphanLaneBeats(lanes, items.map(i => ({ name: i.name, age_minutes: i.age_minutes })))
    }
  } catch { /* 관측 보조 — 실패해도 본 목록은 그대로 준다 */ }

  return c.json({ success: true, data: { items, stale, count: items.length, never_fired, orphan_lanes, known_lanes_at } })
})

// ── POST /cron-heartbeats/delete ────────────────────────────────
// 🪦 고아 하트비트 행 삭제(2026-08-09) — 개명/철거된 레인의 옛 행은 아무도 갱신하지 않아 **영원히
//   '멈춤 의심'** 으로 남고, 침묵 경보(silence digest)도 은퇴 임계까지 계속 울린다(실측: nara-vendor
//   유령이 ~08-19 까지 울릴 예정이었다). 지금까지는 D1 콘솔에서 손으로 지워야 했다 — 어드민 화면의
//   '고아 기록' 카드에서 지울 수 있게 한다. ⚠️ path param 이 아니라 body 인 이유: 레인 이름에
//   `?`(`ads:maintenance?phase=quality`)와 `:` 가 들어가 URL 세그먼트로 안전하게 못 싣는다.
adminSystemMonitoringRoutes.post('/cron-heartbeats/delete', async (c) => {
  const body = await c.req.json().catch(() => null) as { name?: string } | null
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 120) return c.json({ success: false, error: 'invalid name' }, 400)
  // 하트비트 본행 + CPU 사망 기록(별도 키 — 성공이 못 덮는 카운터)을 짝으로 지운다. 레인이 살아
  //   있는데 실수로 지워도 다음 실행이 행을 다시 만드므로 파괴적이지 않다(사망 카운터만 리셋됨).
  await c.env.DB.batch([
    // 키 조립은 기록 쪽과 같은 규칙(slice 80)을 써야 한다 — cpuDeathKey 는 SSOT 헬퍼, hb 는 그 미러.
    c.env.DB.prepare('DELETE FROM platform_settings WHERE key = ?').bind(`cron_hb:${name.slice(0, 80)}`),
    c.env.DB.prepare('DELETE FROM platform_settings WHERE key = ?').bind(cpuDeathKey(name)),
  ]).catch(() => null)
  return c.json({ success: true })
})

adminSystemMonitoringRoutes.patch('/cron-failures/:id/resolve', async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
  try {
    await DB.prepare(`UPDATE cron_failures SET resolved = 1 WHERE id = ?`).bind(id).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
  }
})

// ── GET /alimtalk-failures ──────────────────────────────────────
adminSystemMonitoringRoutes.get('/alimtalk-failures', async (c) => {
  const { DB } = c.env
  const resolved = c.req.query('resolved') === '1'
  try {
    const { results } = await DB.prepare(`
      SELECT id, phone, template_code, message, error, retry_count, max_retries,
             next_retry_at, resolved, created_at, updated_at
      FROM alimtalk_failures
      WHERE resolved = ?
      ORDER BY created_at DESC LIMIT 100
    `).bind(resolved ? 1 : 0).all()

    const stats = await DB.prepare(`
      SELECT
        COUNT(*) FILTER (WHERE resolved = 0 AND retry_count >= max_retries) AS abandoned,
        COUNT(*) FILTER (WHERE resolved = 0 AND retry_count < max_retries) AS pending,
        COUNT(*) FILTER (WHERE resolved = 1) AS succeeded
      FROM alimtalk_failures
      WHERE created_at >= datetime('now', '-7 days')
    `).first<{ abandoned: number; pending: number; succeeded: number }>().catch(() => null)

    // 🔔 2026-07-01: 진단 — 미해결 실패를 template_code 별로 그룹핑 + 저장소 등록 여부 주석.
    //   registered:false 가 반복 실패하면 = Aligo 콘솔에 미등록/불일치 템플릿(운영자가 등록해야 함).
    //   (SMS 폴백이 없어 그동안 해당 알림톡은 전달 0 — 인앱/푸시로만 도달.)
    let byTemplate: Array<{ template_code: string; unresolved: number; abandoned: number; registered: boolean; last_error: string | null }> = []
    try {
      const { results: grp } = await DB.prepare(`
        SELECT template_code,
               COUNT(*) AS unresolved,
               SUM(CASE WHEN retry_count >= max_retries THEN 1 ELSE 0 END) AS abandoned,
               MAX(error) AS last_error
        FROM alimtalk_failures
        WHERE resolved = 0
        GROUP BY template_code
        ORDER BY unresolved DESC
      `).all<{ template_code: string; unresolved: number; abandoned: number; last_error: string | null }>()
      byTemplate = (grp || []).map(r => ({
        template_code: r.template_code,
        unresolved: Number(r.unresolved || 0),
        abandoned: Number(r.abandoned || 0),
        registered: isDocumentedRegistered(r.template_code),
        last_error: r.last_error ?? null,
      }))
    } catch { /* 그룹 쿼리 실패 — by_template 생략 */ }

    return c.json({
      success: true,
      data: {
        items: results || [],
        stats: stats ?? { abandoned: 0, pending: 0, succeeded: 0 },
        by_template: byTemplate,
      },
    })
  } catch {
    return c.json({ success: true, data: { items: [], stats: { abandoned: 0, pending: 0, succeeded: 0 } } })
  }
})

// ── GET /delivery-failures ──────────────────────────────────────
// 🔔 2026-07-01: push_failures / email_failures dead-letter 가시성.
//   재시도 크론(retry-notifications, 5분)은 있었지만 어드민이 볼 UI/API 가 0 이라
//   웹푸시·이메일 실패 누적이 아무 데도 안 보였음. 알림톡 진단과 동형으로 노출.
adminSystemMonitoringRoutes.get('/delivery-failures', async (c) => {
  const { DB } = c.env
  const resolved = c.req.query('resolved') === '1'
  const empty = { items: [], stats: { abandoned: 0, pending: 0, succeeded: 0 } }
  const statsSql = (table: string) => `
    SELECT
      COUNT(*) FILTER (WHERE resolved = 0 AND retry_count >= max_retries) AS abandoned,
      COUNT(*) FILTER (WHERE resolved = 0 AND retry_count < max_retries) AS pending,
      COUNT(*) FILTER (WHERE resolved = 1) AS succeeded
    FROM ${table}
    WHERE created_at >= datetime('now', '-7 days')
  `
  try {
    const push = await (async () => {
      try {
        const { results } = await DB.prepare(`
          SELECT id, user_type, user_id, title, body, url, subscription_count,
                 retry_count, max_retries, next_retry_at, resolved, created_at
          FROM push_failures WHERE resolved = ?
          ORDER BY created_at DESC LIMIT 100
        `).bind(resolved ? 1 : 0).all()
        const stats = await DB.prepare(statsSql('push_failures'))
          .first<{ abandoned: number; pending: number; succeeded: number }>().catch(() => null)
        return { items: results || [], stats: stats ?? empty.stats }
      } catch { return empty } // 테이블 미존재 — 빈 결과
    })()
    const email = await (async () => {
      try {
        const { results } = await DB.prepare(`
          SELECT id, recipient, subject, error, retry_count, max_retries,
                 next_retry_at, resolved, created_at
          FROM email_failures WHERE resolved = ?
          ORDER BY created_at DESC LIMIT 100
        `).bind(resolved ? 1 : 0).all()
        const stats = await DB.prepare(statsSql('email_failures'))
          .first<{ abandoned: number; pending: number; succeeded: number }>().catch(() => null)
        return { items: results || [], stats: stats ?? empty.stats }
      } catch { return empty }
    })()
    return c.json({ success: true, data: { push, email } })
  } catch {
    return c.json({ success: true, data: { push: empty, email: empty } })
  }
})

// 즉시 재시도 — next_retry_at 을 지금으로 당겨 다음 5분 크론이 집어가게 (알림톡 retry 와 동형)
adminSystemMonitoringRoutes.post('/delivery-failures/:kind/:id/retry', async (c) => {
  const { DB } = c.env
  const kind = c.req.param('kind')
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
  if (kind !== 'push' && kind !== 'email') return c.json({ success: false, error: 'invalid kind' }, 400)
  const table = kind === 'push' ? 'push_failures' : 'email_failures'
  try {
    await DB.prepare(`
      UPDATE ${table}
      SET next_retry_at = datetime('now'), retry_count = MIN(retry_count, max_retries - 1)
      WHERE id = ? AND resolved = 0
    `).bind(id).run()
    return c.json({ success: true, message: '5분 이내 자동 재시도됩니다' })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
  }
})

adminSystemMonitoringRoutes.post('/alimtalk-failures/:id/retry', async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
  try {
    // next_retry_at 을 즉시로 변경 → 다음 cron tick (5분 이내) 에서 자동 retry
    await DB.prepare(`
      UPDATE alimtalk_failures
      SET next_retry_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND resolved = 0
    `).bind(id).run()
    return c.json({ success: true, message: '5분 이내 자동 재시도됩니다' })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
  }
})

// ── 🚦 2026-07-05: 운영 게이트 플래그 현황판 + cron heartbeat ──────────────
//   배경(1인 운영 관측 보강): 검증 대기 게이트(커미션 예산/쇼핑 원장/fee-resolver 등)가
//   env·platform_settings 에 흩어져 있어 "뭐가 켜져 있고 뭐가 staging 미검증인지" 볼 곳이 없었음.
//   staging 검증 전 실수 활성화 방지 + cron 침묵을 어드민에서 한눈에.
//   게이트 자체의 SSOT 는 각 소비처(코드) — 여기는 *열람 전용 레지스트리* (값 변경 없음).
//   staging 시나리오 상세: docs/STAGING_CHECKLIST.md

interface OpsGate {
  key: string
  kind: 'env' | 'setting'
  label: string
  default_value: string
  /** docs/STAGING_CHECKLIST.md 의 항목 ID — null 이면 staging 실결제 검증 불필요 */
  staging_ref: string | null
  /**
   * 🔴 **무엇이 확인되면 켜는가** (2026-08-02 대표 확정 ⑤).
   *
   * 점등 조건이 없는 게이트는 **영원히 안 켜진다** — 아무도 "지금이 그때인가"를 판단할 수 없기 때문이다.
   * 실제로 이 명부의 게이트 13개가 **전부 미설정**인 채로 있었다(라이브 실측).
   * 새 게이트를 추가할 때 이 줄을 비우지 말 것.
   */
  turn_on_when: string
}

const OPS_GATES: OpsGate[] = [
  { key: 'commission_budget_enabled', kind: 'setting', label: '커미션 예산 아비터 [INV-CB]', default_value: 'false', staging_ref: 'S1', turn_on_when: '영입+트리 커미션이 겹친 주문에서 Σ적립 ≤ 예산이 확인되면(S1)' },
  { key: 'promo_funding_source', kind: 'setting', label: '프로모 owner-펀딩', default_value: 'platform', staging_ref: 'S2', turn_on_when: '이용권 구매→사용→환불에서 매장 원장 promo debit 1회가 확인되면(S2)' },
  { key: 'SHOPPING_LEDGER_ENABLED', kind: 'env', label: '쇼핑 주문 원장 크레딧', default_value: 'false', staging_ref: 'S3', turn_on_when: '쇼핑탭 재오픈이 결정되고 S3 실결제로 net 크레딧 1회가 확인되면' },
  { key: 'FEE_RESOLVER_ENABLED', kind: 'env', label: 'fee-resolver 그림자 기록', default_value: 'false', staging_ref: 'S4', turn_on_when: '그림자 기록(order_fee_breakdown) vs 현행 정산 비교가 일치하면(S4)' },
  // 💸 2026-08-25 (누락 발견): **플랫폼 take 율 자체를 정하는 게이트인데 이 명부에 없었다.**
  //   `channelPlatformRate` 가 이 값으로 직판 10% / 중개 5% 를 가른다(OFF 면 종전 `commission_rate`).
  //   CLAUDE.md 는 게이트 플래그를 여기 등록하라고 규정하는데 이것만 빠져 있어, 운영 화면에서
  //   **켜져 있는지조차 볼 수 없었다** — 머니 경로에서 가장 보여야 할 값이다.
  { key: 'fee_channel_rates_enabled', kind: 'setting', label: '채널별 플랫폼 요율(직판 10% / 중개 5%)', default_value: 'false', staging_ref: 'S7', turn_on_when: '직판·중개 주문 각 1건의 원장 fee 가 의도한 요율로 찍히는 것이 staging 실결제로 확인되면' },
  { key: 'BLOG_AI_DRAFTS_ENABLED', kind: 'env', label: '블로그 AI 초안 주간 cron', default_value: 'false', staging_ref: null, turn_on_when: '주간 AI 초안이 필요해지고 ANTHROPIC_API_KEY 가 ur-live 에 설정되면' },
  { key: 'ADS_AUTOBID_ENABLED', kind: 'env', label: '유어애즈 자동입찰', default_value: 'false', staging_ref: null, turn_on_when: '유어애즈 광고주가 실제로 입찰을 시작하면(현재 인플루언서 DB 수집 단계라 미해당)' },
  { key: 'wholesale_auto_grade_enabled', kind: 'setting', label: '도매 등급 자동평가', default_value: '0', staging_ref: null, turn_on_when: '🔴 켜지 않는다 — 도매몰은 철거 대상(2026-08-02 대표 확정 ⑦)' },
  // 🎟️ 2026-07-29 (실행 증거 감사): 공구 엔진 게이트가 **두 겹**인데 어느 명부에도 없었다.
  //   서버 `platform_settings.gb_engine_enabled`(현재 키 자체 부재 = false) +
  //   클라 `src/shared/feature-flags.ts` `GB_ENGINE_ENABLED`(현재 하드코딩 false).
  //   ⇒ 공구 특가를 결제에 배선해도(#844) **둘 다 켜지기 전에는 어디에도 적용되지 않는다.**
  //   여기 등재는 서버 겹만 값으로 보여준다 — 클라 겹은 배포가 필요하므로 라벨에 함께 적는다.
  { key: 'gb_engine_enabled', kind: 'setting', label: '공구 엔진 (⚠️ 2겹 — 클라 GB_ENGINE_ENABLED 도 함께 켜야 적용)', default_value: 'false', staging_ref: null, turn_on_when: 'P9 실결제 통과 시(⑤ 1순위). ⚠️ 클라 GB_ENGINE_ENABLED 도 함께 켜야 적용. ⚠️ 공구가 청구는 이 키가 아니라 gb_pricing_enabled 가 지배한다(2026-08-11 정정)' },
  // 🔌 2026-08-11 — **끄는 스위치**(기본 ON). 다른 게이트와 방향이 반대라 라벨에 명시한다:
  //   미설정/조회실패 = 공구가 적용(현행). `'false'` 를 저장한 순간에만 상시가로 되돌아간다.
  { key: 'gb_pricing_enabled', kind: 'setting', label: '공구가 청구 (🔴 킬스위치 — 기본 ON, false 로 저장해야 꺼짐)', default_value: 'true', staging_ref: null, turn_on_when: '항상 ON 이 정상. 잘못 설정된 공구가로 과소청구가 날 때 `false` 로 저장해 즉시 상시가로 되돌린다' },
  // 8월 promo flip 스코프 스위치 — 값이 비어 있지 않으면 그 매장만 flip 경로.
  { key: 'flip_pilot_seller_ids', kind: 'setting', label: '8월 flip 파일럿 매장 스코프', default_value: '', staging_ref: null, turn_on_when: '8월 promo flip 파일럿 매장이 정해지면 그 seller_id 를 넣는다' },
  { key: 'seller_promo_field_enabled', kind: 'setting', label: '셀러 promo% 입력 UI', default_value: 'false', staging_ref: null, turn_on_when: 'flip 파일럿 매장이 스스로 promo% 를 입력할 단계가 되면' },
  // 🧾 2026-09-01 — 후기 보너스를 **매장 부담**으로 돌리는 스위치(대표 "매장 사장님이 부담하게끔").
  //   OFF 면 판정이 항상 `platform` 이라 차감 경로에 아무것도 안 들어온다(= 오늘과 동일).
  { key: 'review_bonus_owner_funded', kind: 'setting', label: '후기 보너스 매장 부담(정산 차감)', default_value: 'false', staging_ref: 'S11', turn_on_when: '매장이 셀러 대시보드에서 금액을 직접 넣기 시작하고, S11 로 원장 debit 1회·재승인 이중차감 0 이 확인되면' },
  { key: 'DISTRICT_AUTO_ISSUE_ENABLED', kind: 'env', label: '상권 쿠폰 온라인 자동발급(경로 B)', default_value: 'false', staging_ref: null, turn_on_when: '상권 캠페인 파일럿 매장이 확정되고 재원(예산 풀)이 배정되면' },
  // 💸 2026-08-01 ④-b: 미수령(픽업 안 찾아감) 환불을 보관구분에 따라 가른다.
  //   🔴 **이미 흐르는 환불의 방향을 바꾼다** — 안 돌던 걸 켜는 게 아니다(cron `0 18` 실행 확인됨).
  //   OFF 면 현행 전액 환불. 켜도 비율값(기본 100)을 안 바꾸면 동작 불변 — 안전판이 두 겹이다.
  { key: 'pickup_unclaimed_policy_enabled', kind: 'setting', label: '미수령 환불 정책(보관구분별) ④-b', default_value: 'false', staging_ref: 'P10', turn_on_when: '**첫 픽업 공구 개설과 동시**(⑤ 3순위). 런칭값: 냉장 0% · 실온 유예 3일' },
  // 💸 2026-08-01 ④-c: 부분환불 **금액을 정할 입구**. 그간 `returns.refund_amount` 를 바꾸는 경로가
  //   아예 없어 실질적으로 전액 환불만 가능했다. OFF 면 금액 설정 API 가 403 → 현행(전액) 그대로.
  { key: 'partial_refund_enabled', kind: 'setting', label: '부분환불 금액 설정 ④-c', default_value: 'false', staging_ref: 'P11', turn_on_when: '**첫 픽업 공구 개설과 동시**(⑤ 3순위) — ④-b 와 같이 켠다' },
]

adminSystemMonitoringRoutes.get('/ops-status', async (c) => {
  const { DB } = c.env
  try {
    // platform_settings 게이트 값
    const settingKeys = OPS_GATES.filter(g => g.kind === 'setting').map(g => g.key)
    const settingRows = await DB.prepare(
      `SELECT key, value FROM platform_settings WHERE key IN (${settingKeys.map(() => '?').join(',')})`,
    ).bind(...settingKeys).all<{ key: string; value: string }>().catch(() => ({ results: [] as Array<{ key: string; value: string }> }))
    const settingMap = new Map((settingRows.results || []).map(r => [r.key, r.value]))

    const envRecord = c.env as unknown as Record<string, unknown>
    const gates = OPS_GATES.map(g => {
      const raw = g.kind === 'env' ? envRecord[g.key] : settingMap.get(g.key)
      const value = raw === undefined || raw === null ? null : String(raw)
      return {
        ...g,
        value,
        // 미설정(null)은 기본값과 동일 취급 — "기본값에서 벗어남" = 활성 배지 대상
        is_default: value === null || value === g.default_value,
      }
    })

    // cron heartbeat 전체 + 핵심 stale 판정
    const health = await getCronHealth(DB)
    // 🫀 하트비트 저장소는 `platform_settings.cron_hb:*` 다(별도 테이블 아님 —
    //   이 레포는 D1 마이그레이션이 CI 에서 안 돌아 새 테이블은 생성 보장이 없다).
    //   OpsStatusTab 이 기대하는 모양으로만 변환한다. run_count 는 저장하지 않으므로 null.
    const beats = await listCronHeartbeats(DB)
    const hb = {
      results: beats.map(b => ({
        cron_name: b.name,
        last_status: b.ok === null ? 'unknown' : b.ok ? 'ok' : 'fail',
        last_finished_at: b.at,
        last_duration_ms: b.ms,
        last_error: null as string | null,
        run_count: null as number | null,
      })),
    }

    return c.json({
      success: true,
      data: {
        gates,
        cron_health: health,
        heartbeats: hb.results || [],
        checklist_doc: 'docs/STAGING_CHECKLIST.md',
      },
    })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
  }
})
