/**
 * 🏪 **가게 개설 신청 — 목록/승인/반려** (2026-08-12 운영자 셀프 온보딩 최소안)
 *
 * `wholesale-malls-admin.routes.ts` 에서 분리했다(2026-09-16 — 그 파일이 625줄로 자라
 * 파일크기 래칫에 걸렸다. CLAUDE.md "새 페이지 체크리스트" ⑨: 600줄 넘어가면 **그 시점에** 추출).
 *
 * 마운트: `app.route('/applications', mallApplicationRoutes)` — 부모의 `/:id` 라우트들보다
 * **앞에서** 마운트한다. Hono 는 등록 순서로 매칭하므로 뒤에 두면 `/applications` 가
 * `/:id` 로 삼켜진다(같은 날 seller-gb 에서 `/support-contact` 가 그렇게 죽어 있었다).
 *
 * ⚠️ 인증은 **부모가 `app.use('*')` 로 이미 건다**(IP whitelist + requireAdmin + audit).
 *   마운트된 서브앱이 그 체인을 물려받으므로 여기서 다시 걸지 않는다. 다만 슈퍼 전용 판정은
 *   라우트마다 명시한다 — 빠뜨리면 조용히 일반 어드민에게 열린다.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { ensureMallSchema, invalidateMallCache, DEFAULT_MALL_ID } from './wholesale-malls'
import { ensureMallApplications } from '../../../worker/utils/mall-applications'
import { requireSuperAdmin, rejectReservedSlug } from './wholesale-malls-admin-shared'

const app = new Hono<{ Bindings: Env }>()

app.get('/', requireSuperAdmin(), async (c) => {
  const { DB } = c.env
  try {
    await ensureMallApplications(DB)
    const { results } = await DB.prepare(
      `SELECT a.id, a.seller_id, a.slug, a.name, a.status, a.created_at,
              s.business_name AS seller_name, s.email AS seller_email
         FROM mall_applications a LEFT JOIN sellers s ON s.id = a.seller_id
        WHERE a.status = 'pending' ORDER BY a.id ASC LIMIT 200`,
    ).all().catch(() => ({ results: [] }))
    return c.json({ success: true, items: results ?? [] })
  } catch (err) {
    return safeError(c, err, '신청 목록을 불러오지 못했습니다', '[admin-wholesale-malls]')
  }
})

/**
 * 승인 = **몰 생성 + 셀러 연결 + 기존 상품 이관**을 한 번에.
 *
 * 🔴 **선점 먼저**(claim-before-create): `pending → approved` CAS 로 이 요청만 진행시킨다.
 *   먼저 만들고 나중에 표시하면, 동시 승인 두 건이 **몰을 둘 만든다**(슬러그 UNIQUE 가 두 번째를
 *   막아도 첫 번째는 이미 생겼다). 실패하면 `pending` 으로 되돌린다 — 어드민이 다시 누를 수 있게.
 */
app.post('/:id/approve', requireSuperAdmin(), rateLimit({ action: 'admin-mall-app-approve', max: 30, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const appId = Number(c.req.param('id'))
  if (!Number.isFinite(appId) || appId <= 0) return c.json({ success: false, error: '잘못된 신청 ID' }, 400)
  try {
    await ensureMallSchema(DB)
    await ensureMallApplications(DB)
    const row = await DB.prepare(
      "SELECT id, seller_id, slug, name FROM mall_applications WHERE id = ? AND status = 'pending'",
    ).bind(appId).first<{ id: number; seller_id: number; slug: string; name: string }>().catch(() => null)
    if (!row) return c.json({ success: false, error: '대기 중인 신청이 아닙니다' }, 404)

    // 🔴 승인 직전 재검증 — 신청 후 승인 사이에 그 슬러그가 팔렸을 수 있다.
    // 이 파일의 몰 생성(POST /)과 **같은 판정 함수**를 쓴다 — 경로마다 기준이 갈리면
    // 신청 경유로만 통과하는 슬러그가 생긴다(그게 예약어면 소비자 라우트가 죽는다).
    const slugBad = rejectReservedSlug(row.slug)
    if (slugBad) return c.json({ success: false, error: slugBad }, 400)
    const dupe = await DB.prepare('SELECT id FROM wholesale_malls WHERE slug = ?').bind(row.slug).first<{ id: number }>().catch(() => null)
    if (dupe) return c.json({ success: false, error: '이미 사용 중인 slug 입니다' }, 409)

    const claim = await DB.prepare(
      "UPDATE mall_applications SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'",
    ).bind(appId).run()
    if (!claim.meta?.changes) return c.json({ success: false, error: '이미 처리된 신청입니다' }, 409)

    // 🔴 되돌리기는 **만든 것 전부**를 되돌려야 한다. 처음 구현은 신청만 `pending` 으로 돌리고
    //   이미 만들어진 몰을 남겼는데, 그러면 재승인이 위의 slug 중복 검사에 걸려 **영원히 409** 다
    //   — 신청은 대기열에 보이는데 아무리 눌러도 안 열리는, 화면상 원인이 없는 상태가 된다.
    let createdMallId = 0
    let movedProducts = false
    try {
      const ins = await DB.prepare(
        'INSERT INTO wholesale_malls (slug, name, brand_name, consumer_path, active) VALUES (?, ?, ?, 1, 1)',
      ).bind(row.slug, row.name, row.name).run()
      createdMallId = Number(ins.meta?.last_row_id)
      if (!createdMallId) throw new Error('mall insert returned no id')
      // 🔴 연결은 **본진에 있는 셀러에게만** 건다 — 신청 후 승인 사이에 어드민이 그 셀러를 다른
      //   몰에 수동 연결했을 수 있고, 그때 덮어쓰면 남의 가게 상품이 이쪽으로 딸려 온다.
      const link = await DB.prepare(
        'UPDATE sellers SET mall_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND COALESCE(mall_id, ?) = ?',
      ).bind(createdMallId, row.seller_id, DEFAULT_MALL_ID, DEFAULT_MALL_ID).run()
      if (!link.meta?.changes) throw new Error('seller already linked to another mall')
      // 그 셀러가 **이미 올려 둔** 상품은 본진에 있다(미연결 기본값) — 함께 옮긴다.
      // ⚠️ 여기서 삼키면(`.catch(() => null)`) 아무 말 없이 **빈 가게**가 열린다 — 운영자가
      //   "왜 내 가게엔 안 보이지"를 다시 겪는다. 실패는 드러내고 전체를 되돌린다.
      await DB.prepare(
        'UPDATE products SET mall_id = ?, updated_at = CURRENT_TIMESTAMP WHERE seller_id = ? AND COALESCE(mall_id, ?) = ?',
      ).bind(createdMallId, row.seller_id, DEFAULT_MALL_ID, DEFAULT_MALL_ID).run()
      movedProducts = true
      await DB.prepare('UPDATE mall_applications SET mall_id = ? WHERE id = ?').bind(createdMallId, appId).run().catch(() => null)
      invalidateMallCache(DB)
      return c.json({ success: true, mall_id: createdMallId, slug: row.slug })
    } catch (e) {
      // 만든 순서의 역순으로 되돌린다. 각 단계는 성공했을 때만 되돌릴 것이 있고, 안 했으면 no-op 다.
      if (movedProducts) {
        await DB.prepare('UPDATE products SET mall_id = ? WHERE seller_id = ? AND mall_id = ?')
          .bind(DEFAULT_MALL_ID, row.seller_id, createdMallId).run().catch(() => null)
      }
      if (createdMallId) {
        await DB.prepare('UPDATE sellers SET mall_id = ? WHERE id = ? AND mall_id = ?')
          .bind(DEFAULT_MALL_ID, row.seller_id, createdMallId).run().catch(() => null)
        // 방금 만든 몰이고 아무것도 안 붙어 있다 — 지워야 그 슬러그로 다시 승인할 수 있다.
        await DB.prepare('DELETE FROM wholesale_malls WHERE id = ? AND slug = ?')
          .bind(createdMallId, row.slug).run().catch(() => null)
        invalidateMallCache(DB)
      }
      await DB.prepare("UPDATE mall_applications SET status = 'pending', reviewed_at = NULL WHERE id = ?").bind(appId).run().catch(() => null)
      throw e
    }
  } catch (err) {
    return safeError(c, err, '승인 처리 중 오류가 발생했습니다', '[admin-wholesale-malls]')
  }
})

app.post('/:id/reject', requireSuperAdmin(), rateLimit({ action: 'admin-mall-app-reject', max: 60, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const appId = Number(c.req.param('id'))
  if (!Number.isFinite(appId) || appId <= 0) return c.json({ success: false, error: '잘못된 신청 ID' }, 400)
  try {
    await ensureMallApplications(DB)
    const note = String(((await c.req.json().catch(() => ({}))) as Record<string, unknown>).note ?? '').trim().slice(0, 300)
    const up = await DB.prepare(
      "UPDATE mall_applications SET status = 'rejected', note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'",
    ).bind(note || null, appId).run()
    if (!up.meta?.changes) return c.json({ success: false, error: '대기 중인 신청이 아닙니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '반려 처리 중 오류가 발생했습니다', '[admin-wholesale-malls]')
  }
})

export { app as mallApplicationRoutes }
