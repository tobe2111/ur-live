/**
 * Admin Tools API
 * - 매출 통계 차트
 * - 셀러 승인
 * - 배너 관리
 * - 공지사항
 * - 정산 일괄
 * - 신고/차단
 * - 플랫폼 설정
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { writeAuditLog } from '@/worker/middleware/admin-security'
import { validateImageUrl } from '@/worker/utils/validation'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
import { intParam } from '@/shared/pagination'
import { validatePlatformSettings } from '@/worker/utils/platform-settings-validation'

export const adminToolsRoutes = new Hono<{ Bindings: Env }>()

// 🛡️ 2026-06-12 (감사 1단계): sellers.reject_reason 메모이즈 ensure — repair-schema 에도 등록.
const _rejectReasonEnsured = new WeakSet<D1Database>()
async function ensureSellerRejectReason(db: D1Database) {
  if (_rejectReasonEnsured.has(db)) return
  _rejectReasonEnsured.add(db)
  try { await db.prepare('ALTER TABLE sellers ADD COLUMN reject_reason TEXT').run() } catch { /* exists */ }
}

// ── 매출 통계 차트 ──
adminToolsRoutes.get('/chart/revenue', async (c) => {
  const days = intParam(c.req.query('days'), 30)
  const { results } = await c.env.DB.prepare(`
    SELECT date(created_at) AS date,
      COUNT(*) AS orders,
      COALESCE(SUM(CASE WHEN status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN total_amount END), 0) AS revenue
    FROM orders WHERE created_at > datetime('now', '-' || ? || ' days')
    GROUP BY date(created_at) ORDER BY date
  `).bind(days).all()
  return c.json({ success: true, data: results || [] })
})

// ── 매출 리포트 CSV ──
adminToolsRoutes.get('/report/csv', async (c) => {
  const days = intParam(c.req.query('days'), 30)
  const { results } = await c.env.DB.prepare(`
    SELECT date(o.created_at) AS date, s.name AS seller_name,
      COUNT(*) AS order_count,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN o.total_amount END), 0) AS revenue
    FROM orders o
    LEFT JOIN sellers s ON o.seller_id = s.id
    WHERE o.created_at > datetime('now', '-' || ? || ' days')
    GROUP BY date(o.created_at), s.name
    ORDER BY date DESC, revenue DESC
  `).bind(days).all()

  const rows = results || []
  const csv = [
    '날짜,셀러,주문수,매출(원)',
    ...rows.map((r: any) => `${r.date},${r.seller_name || '미지정'},${r.order_count},${r.revenue}`)
  ].join('\n')

  return new Response('\uFEFF' + csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="admin-report-${days}d.csv"` },
  })
})

// ── 셀러 승인 대기 목록 ──
adminToolsRoutes.get('/sellers/pending', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT s.id, s.username, s.name, s.email, s.business_name, s.business_number, s.phone, s.created_at,
           s.linked_user_id, u.name AS linked_user_name
    FROM sellers s LEFT JOIN users u ON s.linked_user_id = u.id
    WHERE s.status = 'pending' ORDER BY s.created_at DESC
  `).all()
  return c.json({ success: true, data: results || [] })
})

adminToolsRoutes.put('/sellers/:id/approve', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare("UPDATE sellers SET status = 'approved', updated_at = datetime('now') WHERE id = ?").bind(id).run()
  // v30 FIX: admin-tools audit log 누락 보완
  await writeAuditLog(c, { action: 'seller.approve', targetType: 'seller', targetId: id })
  return c.json({ success: true })
})

adminToolsRoutes.put('/sellers/:id/reject', async (c) => {
  const id = c.req.param('id')
  const { reason: rawReason } = await c.req.json<{ reason?: string }>().catch(() => ({ reason: '' }))
  // 🛡️ 2026-06-12 (감사 1단계): 거절 사유 저장 + 셀러 벨 알림 — 이전엔 status 플립만 해서
  //   셀러가 거절 사실/사유를 알 길이 없었음 (/my-seller-status + SellerWaitingPage 에서 표시).
  const reason = typeof rawReason === 'string' ? rawReason.trim().slice(0, 500) : ''
  await ensureSellerRejectReason(c.env.DB)
  await c.env.DB.prepare(
    "UPDATE sellers SET status = 'rejected', reject_reason = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(reason || null, id).run()
  await writeAuditLog(c, { action: 'seller.reject', targetType: 'seller', targetId: id, after: { reason } })
  createDashboardNotification(
    c.env.DB, 'seller', String(id), 'seller_rejected',
    '셀러 가입 거절', reason ? `사유: ${reason}` : '관리자에게 문의해주세요', '/seller'
  ).catch(() => { /* fail-soft — 거절 처리 자체는 완료 */ })
  return c.json({ success: true })
})

// ── 배너 관리 ──
adminToolsRoutes.get('/banners', async (c) => {
  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, image_url TEXT NOT NULL, link_url TEXT,
      display_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
      start_date DATETIME, end_date DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run() } catch {}
  const { results } = await c.env.DB.prepare('SELECT * FROM banners ORDER BY display_order ASC, created_at DESC').all()
  return c.json({ success: true, data: results || [] })
})

adminToolsRoutes.post('/banners', async (c) => {
  const { title, image_url, link_url, display_order } = await c.req.json<any>().catch(() => ({} as any))
  if (!image_url) return c.json({ success: false, error: '이미지 URL 필수' }, 400)

  // 🛡️ 2026-04-22: URL 검증 추가 (XSS/SSRF 방어)
  // 이전: admin-banners.routes.ts 는 validateImageUrl 쓰지만 여기선 검증 없었음
  const imgCheck = validateImageUrl(image_url)
  if (!imgCheck.valid) return c.json({ success: false, error: `이미지 URL: ${imgCheck.error}` }, 400)
  if (link_url && link_url !== '/') {
    const linkCheck = validateImageUrl(link_url)
    if (!linkCheck.valid) return c.json({ success: false, error: `링크 URL: ${linkCheck.error}` }, 400)
  }

  const result = await c.env.DB.prepare('INSERT INTO banners (title, image_url, link_url, display_order) VALUES (?, ?, ?, ?)')
    .bind(title || '', image_url, link_url || '/', display_order || 0).run()
  await writeAuditLog(c, {
    action: 'banner.create',
    targetType: 'banner',
    targetId: result.meta?.last_row_id,
    after: { title, image_url, link_url, display_order },
  })
  return c.json({ success: true })
})

adminToolsRoutes.put('/banners/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<any>().catch(() => ({} as any))
  const sets: string[] = []; const vals: any[] = []
  if (body.title !== undefined) { sets.push('title = ?'); vals.push(body.title) }
  if (body.image_url) { sets.push('image_url = ?'); vals.push(body.image_url) }
  if (body.link_url !== undefined) { sets.push('link_url = ?'); vals.push(body.link_url) }
  if (body.display_order !== undefined) { sets.push('display_order = ?'); vals.push(body.display_order) }
  if (body.is_active !== undefined) { sets.push('is_active = ?'); vals.push(body.is_active ? 1 : 0) }
  if (!sets.length) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
  vals.push(id)
  await c.env.DB.prepare(`UPDATE banners SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run()
  await writeAuditLog(c, { action: 'banner.update', targetType: 'banner', targetId: id, after: body })
  return c.json({ success: true })
})

adminToolsRoutes.delete('/banners/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM banners WHERE id = ?').bind(id).run()
  await writeAuditLog(c, { action: 'banner.delete', targetType: 'banner', targetId: id })
  return c.json({ success: true })
})

// ── 공지사항 발송 ──
adminToolsRoutes.post('/notices', async (c) => {
  const body = await c.req.json<{ title: string; message: string; target: 'all' | 'sellers' | 'users' }>().catch(() => ({} as any))
  const { target } = body
  let { title, message } = body

  if (!title || !message) return c.json({ success: false, error: '제목과 내용 필수' }, 400)

  // 🛡️ 2026-04-22: 입력 검증 + XSS 방어
  if (typeof title !== 'string' || title.length > 200) {
    return c.json({ success: false, error: '제목은 200자 이하' }, 400)
  }
  if (typeof message !== 'string' || message.length > 5000) {
    return c.json({ success: false, error: '내용은 5000자 이하' }, 400)
  }
  if (!['all', 'sellers', 'users'].includes(target)) {
    return c.json({ success: false, error: 'target 은 all/sellers/users 중 하나' }, 400)
  }
  // HTML 태그 제거 (특히 <script>)
  title = title.replace(/<[^>]*>/g, '').slice(0, 200)
  message = message.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<[^>]*on\w+=/gi, '<').slice(0, 5000)

  let totalSent = 0
  if (target === 'sellers' || target === 'all') {
    // 🛡️ 2026-05-07: 'approved' / 'active' 모두 활성 (status 표준 분기)
    const { results: sellers } = await c.env.DB.prepare("SELECT id FROM sellers WHERE status IN ('approved', 'active')").all<{ id: number }>()
    if (sellers?.length) {
      const stmts = sellers.map(s =>
        c.env.DB.prepare("INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, created_at) VALUES ('seller', ?, 'admin_notice', ?, ?, datetime('now'))")
          .bind(String(s.id), title, message))
      for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50))
      totalSent += sellers.length
    }
  }
  if (target === 'users' || target === 'all') {
    const { results: users } = await c.env.DB.prepare("SELECT id FROM users ORDER BY created_at DESC LIMIT 1000").all<{ id: string }>()
    if (users?.length) {
      const stmts = users.map(u =>
        c.env.DB.prepare("INSERT INTO user_notifications (user_id, type, title, message, created_at) VALUES (?, 'admin_notice', ?, ?, datetime('now'))")
          .bind(u.id, title, message))
      for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50))
      totalSent += users.length
    }
  }

  // 🛡️ Audit log — 누가 언제 어떤 공지를 얼마나 발송했는지 추적
  await writeAuditLog(c, {
    action: 'notices.broadcast',
    targetType: 'notifications',
    after: { title, target, recipientCount: totalSent }
  })

  return c.json({ success: true, message: `공지 발송 완료 (${totalSent}명)` })
})

// ── 정산 일괄 처리 ──
adminToolsRoutes.get('/settlements/pending', async (c) => {
  // 🛡️ 2026-05-22 정책 중앙화 — COMMISSION_DEFAULTS.PLATFORM_FEE_PCT
  const { COMMISSION_DEFAULTS } = await import('../../../shared/constants/policy')
  const feeRate = COMMISSION_DEFAULTS.PLATFORM_FEE_PCT / 100
  const { results } = await c.env.DB.prepare(`
    SELECT s.id AS seller_id, s.name AS seller_name, s.business_name,
      COUNT(DISTINCT o.id) AS order_count,
      COALESCE(SUM(o.total_amount), 0) AS total_amount,
      COALESCE(SUM(o.total_amount * ?), 0) AS commission
    FROM orders o JOIN sellers s ON o.seller_id = s.id
    WHERE o.status IN ('DELIVERED', 'delivered') AND COALESCE(o.settlement_status, 'pending') = 'pending'
    GROUP BY s.id ORDER BY total_amount DESC
  `).bind(feeRate).all()
  return c.json({ success: true, data: results || [] })
})

adminToolsRoutes.post('/settlements/process', async (c) => {
  const { seller_ids } = await c.req.json<{ seller_ids: number[] }>().catch(() => ({} as { seller_ids?: number[] }))
  if (!seller_ids?.length) return c.json({ success: false, error: '셀러를 선택해주세요' }, 400)

  // 🛡️ 2026-04-22: 입력 검증 + 감사 로그 추가
  // 이전: seller_ids 배열 크기/타입 검증 없음, audit 없음
  if (seller_ids.length > 100) {
    return c.json({ success: false, error: '한 번에 최대 100명 처리 가능' }, 400)
  }
  const validIds = seller_ids.filter((id) => Number.isFinite(id) && id > 0)
  if (validIds.length !== seller_ids.length) {
    return c.json({ success: false, error: '유효하지 않은 seller_id 포함' }, 400)
  }

  let affectedOrders = 0
  for (const sid of validIds) {
    const result = await c.env.DB.prepare(`
      UPDATE orders SET settlement_status = 'settled', updated_at = datetime('now')
      WHERE seller_id = ? AND status IN ('DELIVERED', 'delivered') AND COALESCE(settlement_status, 'pending') = 'pending'
    `).bind(sid).run()
    affectedOrders += result.meta?.changes || 0
  }

  // 감사 로그 — 누가 언제 몇 명 정산 처리했는지
  await writeAuditLog(c, {
    action: 'settlements.process',
    targetType: 'settlement',
    after: { sellerCount: validIds.length, affectedOrders, sellerIds: validIds }
  })

  return c.json({ success: true, message: `${validIds.length}명 / ${affectedOrders}건 정산 처리 완료` })
})

// ── 신고/차단 관리 ──
adminToolsRoutes.get('/reports', async (c) => {
  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS user_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id TEXT, target_type TEXT, target_id TEXT,
      reason TEXT, status TEXT DEFAULT 'pending', admin_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, resolved_at DATETIME
    )`).run() } catch {}
  const { results } = await c.env.DB.prepare('SELECT * FROM user_reports ORDER BY created_at DESC LIMIT 50').all()
  return c.json({ success: true, data: results || [] })
})

adminToolsRoutes.put('/reports/:id/resolve', async (c) => {
  const id = c.req.param('id')
  const { action, note } = await c.req.json<{ action: 'dismiss' | 'warn' | 'suspend'; note?: string }>().catch(() => ({} as any))
  await c.env.DB.prepare("UPDATE user_reports SET status = ?, admin_note = ?, resolved_at = datetime('now') WHERE id = ?")
    .bind(action, note || '', id).run()

  if (action === 'suspend') {
    const report = await c.env.DB.prepare('SELECT target_type, target_id FROM user_reports WHERE id = ?').bind(id).first<any>()
    if (report?.target_type === 'seller') {
      await c.env.DB.prepare("UPDATE sellers SET status = 'suspended' WHERE id = ?").bind(report.target_id).run()
    }
  }
  return c.json({ success: true })
})

// ── 플랫폼 설정 ──
adminToolsRoutes.get('/settings', async (c) => {
  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run() } catch {}
  const { results } = await c.env.DB.prepare('SELECT * FROM platform_settings').all()
  const settings: Record<string, string> = {}
  ;(results || []).forEach((r: any) => { settings[r.key] = r.value })
  return c.json({ success: true, data: settings })
})

adminToolsRoutes.put('/settings', async (c) => {
  const body = await c.req.json<Record<string, string>>().catch(() => ({} as Record<string, string>))
  // 💸 2026-07-11: 알려진 키 값 검증 레지스트리 (2026-07-10 gb_engine 단일 가드를 흡수/일반화).
  //   8월 flip 머니 스위치들이 이 endpoint 를 경유 — 오타값(예: 'True', '1')이 저장되면 read-site 의
  //   ==='true' / ==='owner' strict 비교가 조용히 OFF/폴백으로 동작해 flip 세션이 오판.
  //   위반 시 요청 전체 거부(부분 적용 금지). 미등재 키는 기존대로 통과(hard-whitelist 아님).
  const invalid = validatePlatformSettings(body)
  if (invalid) {
    return c.json({ success: false, error: `${invalid} — 저장이 취소되었습니다 (전체 미적용)` }, 400)
  }
  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run() } catch {}
  /**
   * 🩸 2026-08-25 — **키 하나당 왕복 하나면 이 endpoint 는 큰 저장에서 반드시 죽는다.**
   *
   *   무료 플랜은 인보케이션당 서브리퀘스트가 50 이고 D1 호출도 거기에 센다. 어드민 설정 페이지가
   *   `platform_settings` 전체(하트비트 `cron_hb:*` 129개 포함, 200행대)를 되보내던 시절엔
   *   이 루프가 매번 한도에서 끊겨 **어떤 값도 저장되지 않았다**(화면엔 "저장 실패"만).
   *   호출부는 고쳤지만(바뀐 키만 전송), 서버가 페이로드 크기에 목숨을 걸면 같은 사고가 또 난다.
   *   ⇒ `batch()` 는 몇 개를 담든 **왕복 1회**다. 조각도 100개로 잘라 상한을 눈에 보이게 둔다.
   */
  const stmt = c.env.DB.prepare(
    "INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) " +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime(\'now\')',
  )
  const entries = Object.entries(body)
  for (let i = 0; i < entries.length; i += 100) {
    await c.env.DB.batch(entries.slice(i, i + 100).map(([key, value]) => stmt.bind(key, String(value))))
  }
  // 🛡️ 2026-05-25: dynamic-policy cache 무효화 — 어드민 변경 즉시 반영 (60s TTL 대기 X).
  try {
    const { invalidatePolicyCache } = await import('../../../worker/utils/dynamic-policy')
    invalidatePolicyCache()
  } catch { /* ignore — cache 만료 자연 처리 */ }
  return c.json({ success: true })
})

// ── 🩹 딜 잔액 정합 수리 ────────────────────────────────────────────────────
/**
 * 원장 정합 검사는 **감지만** 한다(잔액은 돈이라 자동 교정 금지). 그래서 알림이 매일 뜨는데도
 * 고칠 손이 없었다. 이 엔드포인트가 그 손이다 — **기본 dry-run**, `apply:true` 라야 쓴다.
 *
 *   mode=orphan    같은 사람의 쪼개진 잔액 행을 합친다(적립 → 고아 행 삭제, 원장 dedup 멱등)
 *   mode=reconcile 설명 안 되는 잔액에 *출처 불명* 보정행을 남긴다(**잔액 불변**)
 *   mode=both      둘 다 — 병합을 먼저 하고 그 결과 위에서 보정한다(순서가 중요하다)
 *
 * ⚠️ `apply` 는 사람이 dry-run 결과를 눈으로 본 뒤에만 준다. 감사 로그에 남는다.
 */
adminToolsRoutes.post('/points-reconcile', async (c) => {
  const body = await c.req.json<{ apply?: boolean; mode?: string }>().catch(() => ({} as { apply?: boolean; mode?: string }))
  const apply = body.apply === true
  const mode = body.mode === 'orphan' || body.mode === 'reconcile' ? body.mode : 'both'
  try {
    const { mergeOrphanBalances, reconcileLegacyBalances } = await import('../../../worker/utils/points-reconcile')
    // 병합이 먼저다 — 합치고 나야 남는 불일치가 진짜 '설명 안 되는' 것이다.
    const orphan = mode === 'reconcile' ? null : await mergeOrphanBalances(c.env.DB, apply)
    const reconcile = mode === 'orphan' ? null : await reconcileLegacyBalances(c.env.DB, apply)
    await writeAuditLog(c, {
      action: 'points_reconcile', targetType: 'points',
      after: { apply, mode, orphan: orphan?.results ?? null, reconcile: reconcile?.results ?? null },
    }).catch(() => {})
    return c.json({ success: true, apply, mode, orphan, reconcile })
  } catch (err) {
    // 🩸 여기서 삼키지 않는다 — 돈을 만지는 도구가 조용히 실패하면 안 된다.
    return c.json({ success: false, error: (err as Error)?.message || String(err) }, 500)
  }
})

// 📊 2026-07-05 (운영 감사 Q10 — 캡 관측성): 커미션 예산 캡 발동 이력.
//   order-commissions.ts 가 Σ요청>예산인 주문만 기록(detail = 축별 요청/배분 JSON).
//   테이블 미존재(캡 미발동/게이트 OFF)면 빈 배열 — 정상.
adminToolsRoutes.get('/commission-budget-logs', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, order_id, budget_krw, requested_krw, granted_krw, detail, created_at
     FROM commission_budget_logs ORDER BY created_at DESC LIMIT 100`
  ).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }))
  return c.json({ success: true, data: results || [] })
})

// ── 🗄️ 분할 백업 수동 실행 ────────────────────────────────────────────────
/**
 * **왜 수동 실행이 필요한가** (2026-08-22)
 *
 * 분할 백업은 5분 cron 의 **다른 작업 10여 개와 같은 인보케이션**을 쓴다. 무료 플랜은 인보케이션당
 * 서브리퀘스트가 50이라, 앞선 작업들이 예산을 다 쓰면 백업은 **한 줄도 못 읽고** 끝난다. 실제로
 * 08-22 에 하트비트 129개가 통째로 멈춘 정황이 이 클래스이고, 백업은 그 사이 한 번도 진행하지 못했다.
 *
 * 이 엔드포인트는 두 가지를 준다:
 *   1. **진짜 에러를 눈으로 본다** — cron 은 실패를 `try/catch` 로 삼키고 하트비트조차 못 남긴다.
 *   2. **자기 인보케이션 예산으로 돈다** — 요청 한 번이 곧 회차 하나라, 반복 호출하면 첫 스냅샷을
 *      cron 을 기다리지 않고 끝까지 밀 수 있다.
 *
 * ⚠️ `maxReads` 를 크게 잡으면 요청이 CPU 로 끊긴다(무료 플랜 수동 경로의 알려진 벽 —
 *    `admin-ads-pool-ops.routes.ts` 의 실측표 참조). 작게 여러 번이 정답이다.
 */
adminToolsRoutes.post('/backup-chunk', async (c) => {
  const body = await c.req.json<{ maxReads?: number; label?: string }>()
    .catch(() => ({} as { maxReads?: number; label?: string }))
  // 1~40 으로 조인다 — 위 경고대로 크게 잡으면 CPU 로 끊겨 **0건 처리**가 된다.
  const maxReads = Math.max(1, Math.min(40, Number(body.maxReads) || 12))
  // 라벨을 주면 그 DB 만 민다(기본은 회전). 화이트리스트 — 임의 문자열은 안 받는다.
  const label = body.label === 'ads' || body.label === 'main' || body.label === 'company'
    ? body.label : undefined
  const t0 = Date.now()
  try {
    const { handleChunkedBackup } = await import('../../../worker/cron/d1-backup-chunked')
    const r = await handleChunkedBackup(c.env as never, { maxReads, label })
    await writeAuditLog(c, {
      action: 'backup_chunk_run', targetType: 'backup',
      targetId: String((r as { label?: string }).label || ''), after: r,
    }).catch(() => {})
    return c.json({ success: true, ms: Date.now() - t0, ...r })
  } catch (err) {
    // 🩸 여기서 삼키지 않는다 — 이 엔드포인트의 존재 이유가 "실패를 보이게 하는 것"이다.
    return c.json({ success: false, ms: Date.now() - t0, error: (err as Error)?.message || String(err) }, 500)
  }
})

/** 진행 상황 — 커서가 어디까지 갔는지. 없으면 진행 중인 스냅샷이 없다는 뜻이다. */
adminToolsRoutes.get('/backup-chunk', async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT key, value, updated_at FROM platform_settings WHERE key LIKE 'backup_chunk:%' OR key LIKE 'backup_done:%' ORDER BY key",
  ).all<{ key: string; value: string; updated_at: string }>()
  return c.json({
    success: true,
    cursors: (results || []).map((r) => {
      let parsed: unknown = null
      try { parsed = JSON.parse(r.value) } catch { parsed = r.value }
      return { key: r.key, updated_at: r.updated_at, cursor: parsed }
    }),
  })
})
