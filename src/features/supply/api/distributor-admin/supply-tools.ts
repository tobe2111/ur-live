/** 🏭 distributor-admin: 카탈로그 일괄 임포트/내보내기/통계/진단/정정/삭제 (byte-identical 분해). */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { writeAuditLog } from '@/worker/middleware/admin-security'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { ensureSupplyVisibilitySchema, normalizeVisibility } from '../supply-visibility'
import { ensureMallSchema } from '../wholesale-malls'
import { parseCsv, buildCsv, csvResponse } from '../supply-csv'
import { ensureProductsFtsDeleteTrigger, type Env } from './helpers'

export function registerSupplyToolsRoutes(app: Hono<{ Bindings: Env }>) {
  // 🏭 2026-06-16 (대표 요청 — 도매몰 채우기): 어드민 공급상품 CSV 일괄 임포트.
  //   제조사 self-serve bulk(POST /api/supplier/products/bulk)과 동일 한글 CSV 포맷이되, 어드민이 제조사 지정 +
  //   즉시 노출(is_active=1, supply_approval_status='approved'). supplier_id 없으면 직매입 제조사 find-or-create.
  app.post('/supply-bulk-import', rateLimit({ action: 'wholesale-bulk-import', max: 20, windowSec: 300 }), async (c) => {
    const { DB } = c.env
    try {
      const body = await c.req.json<{ csv?: string; supplier_id?: number; supplier_name?: string }>().catch(() => ({} as { csv?: string; supplier_id?: number; supplier_name?: string }))
      if (!body.csv || typeof body.csv !== 'string') return c.json({ success: false, error: 'CSV 데이터가 없습니다' }, 400)
      await ensureSupplyVisibilitySchema(DB)

      // 제조사 결정: supplier_id 우선. 없으면 supplier_name 으로 find-or-create(직매입 제조사, status=approved).
      let sid = Number(body.supplier_id) || 0
      if (sid) {
        const ex = await DB.prepare('SELECT id FROM suppliers WHERE id = ?').bind(sid).first<{ id: number }>().catch(() => null)
        if (!ex) return c.json({ success: false, error: '존재하지 않는 제조사입니다' }, 400)
      } else {
        const sname = ((body.supplier_name || '').trim().slice(0, 120)) || '유통스타트 직매입'
        const ex = await DB.prepare('SELECT id FROM suppliers WHERE business_name = ? LIMIT 1').bind(sname).first<{ id: number }>().catch(() => null)
        if (ex) sid = ex.id
        else {
          const r = await DB.prepare(
            "INSERT INTO suppliers (business_name, business_number, status, created_at, updated_at) VALUES (?, ?, 'approved', datetime('now'), datetime('now'))"
          ).bind(sname, `UTONG-${Date.now()}`).run().catch(() => null)
          sid = Number(r?.meta?.last_row_id) || 0
          if (sid) await DB.prepare('UPDATE suppliers SET mall_id = 1 WHERE id = ?').bind(sid).run().catch(() => { /* mall_id 컬럼 없으면 무시 */ })
        }
      }
      if (!sid) return c.json({ success: false, error: '제조사 생성에 실패했습니다 (먼저 제조사를 선택해주세요)' }, 500)

      const rows = parseCsv(body.csv, 5000)
      if (!rows.length) return c.json({ success: false, error: '처리할 행이 없습니다 (헤더 + 데이터 필요)' }, 400)

      const results: { row: number; name?: string; status: 'ok' | 'error'; reason?: string }[] = []
      const stmts: D1PreparedStatement[] = []
      // 어드민 임포트 = 즉시 노출(is_active=1, approved). supply_source_id NULL(원본), seller_id NULL(기본).
      const INSERT_SQL = `INSERT INTO products (name, description, price, supply_price, stock, image_url, category, product_type,
         is_active, is_supply_product, supplier_id, supply_approval_status, supply_visibility, barcode, min_order_qty, mall_id, slug, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'regular', 1, 1, ?, 'approved', ?, ?, ?, (SELECT COALESCE(mall_id,1) FROM suppliers WHERE id=?), ?, datetime('now'), datetime('now'))`
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        if (Object.values(r).every(v => !String(v ?? '').trim())) continue
        const name = String(r['상품명'] || r.name || '').trim()
        const supplyPrice = Number(String(r['공급가'] || r.supply_price || '').replace(/[,\s]/g, ''))
        const retail = Number(String(r['권장소비자가'] || r['판매가'] || r.suggested_retail_price || '').replace(/[,\s]/g, ''))
        const stock = Math.max(0, Math.floor(Number(String(r['재고'] || r.stock || '0').replace(/[,\s]/g, '')) || 0))
        if (!name) { results.push({ row: i + 2, status: 'error', reason: '상품명 누락' }); continue }
        if (!Number.isFinite(supplyPrice) || supplyPrice <= 0) { results.push({ row: i + 2, name, status: 'error', reason: '공급가 오류' }); continue }
        // 신모델: 판매가 > 공급가 필요. 미입력/이하이면 공급가의 1.6배 자동(전 등급 마진 확보 — 운영자 정정 권장).
        const retailFinal = Number.isFinite(retail) && retail > supplyPrice ? retail : Math.round(supplyPrice * 1.6)
        const visibility = normalizeVisibility(r['공급범위'] || r.supply_visibility, true)
        const barcode = String(r['바코드'] || r.barcode || '').trim().slice(0, 64) || null
        const moq = Math.min(100000, Math.max(1, Math.floor(Number(String(r['최소주문수량'] || r.min_order_qty || '1').replace(/[,\s]/g, '')) || 1)))
        const imageUrlRaw = String(r['썸네일 이미지URL'] || r['이미지URL'] || r.image_url || '').trim().slice(0, 500)
        const imageUrl = /^https?:\/\//i.test(imageUrlRaw) ? imageUrlRaw : ''
        const slug = `adm-${sid}-${Date.now()}-${i}`
        stmts.push(DB.prepare(INSERT_SQL).bind(
          name.slice(0, 200), String(r['설명'] || r.description || '').slice(0, 5000),
          Math.floor(retailFinal), Math.floor(supplyPrice), stock, imageUrl,
          String(r['카테고리'] || r.category || 'lifestyle').slice(0, 60), sid, visibility, barcode, moq, sid, slug,
        ))
        results.push({ row: i + 2, name, status: 'ok' })
      }
      let created = 0
      const CHUNK = 100
      for (let i = 0; i < stmts.length; i += CHUNK) {
        try { const res = await DB.batch(stmts.slice(i, i + CHUNK)); created += res.length }
        catch (e) { if (import.meta.env.DEV) console.error('[bulk-import chunk]', e) }
      }
      await writeAuditLog(c, { action: 'wholesale_supply_bulk_import', targetType: 'supplier', targetId: sid, after: { created, total: rows.length } })
      return c.json({ success: true, supplier_id: sid, summary: { total: rows.length, created, failed: results.filter(r => r.status === 'error').length }, results: results.slice(0, 500) })
    } catch (err) {
      return safeError(c, err, '일괄 임포트 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // 📊 2026-06-16: 도매몰 카탈로그 현황 — 일괄 등록 페이지 표시 + 데모/실상품 분리 판단용.
  app.get('/supply-stats', async (c) => {
    const { DB } = c.env
    try {
      const row = await DB.prepare(
        `SELECT COUNT(*) AS total,
           SUM(CASE WHEN slug LIKE 'demo-wholesale-%' THEN 1 ELSE 0 END) AS demo,
           SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active
         FROM products WHERE is_supply_product = 1 AND (supply_source_id IS NULL OR supply_source_id = 0)`
      ).first<{ total: number; demo: number; active: number }>().catch(() => null)
      const sup = await DB.prepare("SELECT COUNT(*) AS c FROM suppliers WHERE status = 'approved'").first<{ c: number }>().catch(() => null)
      const total = Number(row?.total ?? 0)
      const demo = Number(row?.demo ?? 0)
      return c.json({ success: true, total, demo, real: Math.max(0, total - demo), active: Number(row?.active ?? 0), suppliers: Number(sup?.c ?? 0) })
    } catch (err) {
      return safeError(c, err, '현황 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // 🕵️ 2026-06-17 (대표 요청 "누가 처리했는지"): 도매 처리 이력 — admin_audit_logs(자동기록) 를 도매 액션만
  //   필터 + admins JOIN 으로 처리자 '이름' 해석. 도매 파트너(wholesale 역할)도 distributor 세그먼트라 조회 가능.
  app.get('/activity-log', async (c) => {
    const { DB } = c.env
    try {
      const page = Math.max(1, Number(c.req.query('page') || 1))
      const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || 50)))
      const offset = (page - 1) * limit
      // auto-audit action = 'METHOD /api/admin/...path' — 도매 관련 경로만.
      const like = `(a.action LIKE '%/wholesale%' OR a.action LIKE '%/distributor%' OR a.action LIKE '%/suppliers%' OR a.action LIKE '%/supplier%' OR a.action LIKE '%/partnership%')`
      const totalRow = await DB.prepare(`SELECT COUNT(*) AS c FROM admin_audit_logs a WHERE ${like}`).first<{ c: number }>().catch(() => null)
      const rows = await DB.prepare(
        `SELECT a.id, a.admin_id, a.admin_email, a.action, a.ip, a.created_at,
                COALESCE(NULLIF(ad.name, ''), NULLIF(ad.username, ''), NULLIF(a.admin_email, ''), 'ID ' || a.admin_id) AS admin_name,
                ad.role AS admin_role
         FROM admin_audit_logs a
         LEFT JOIN admins ad ON CAST(ad.id AS TEXT) = a.admin_id
         WHERE ${like}
         ORDER BY a.created_at DESC
         LIMIT ? OFFSET ?`
      ).bind(limit, offset).all().catch(() => ({ results: [] as unknown[] }))
      return c.json({ success: true, data: rows.results ?? [], pagination: { page, limit, total: Number(totalRow?.c ?? 0) } })
    } catch (err) {
      return safeError(c, err, '처리 이력 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // 📤 2026-06-17 (#2 카탈로그 도구 보강): 현재 도매 공급상품 CSV 내보내기 — 일괄 등록 템플릿과 동일 헤더라
  //   내보내기→편집→재업로드(신규 추가) 라운드트립 + 백업/검수용. 최신 10,000건.
  app.get('/supply-export', async (c) => {
    const { DB } = c.env
    try {
      const rows = await DB.prepare(
        `SELECT p.name, COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail,
                COALESCE(p.stock,0) AS stock, COALESCE(p.category,'') AS category, COALESCE(p.barcode,'') AS barcode,
                COALESCE(p.min_order_qty,1) AS moq, COALESCE(p.image_url,'') AS image_url,
                COALESCE(s.business_name,'') AS supplier, p.is_active,
                CASE WHEN p.slug LIKE 'demo-wholesale-%' THEN 'Y' ELSE '' END AS is_demo
         FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id
         WHERE p.is_supply_product = 1 AND (p.supply_source_id IS NULL OR p.supply_source_id = 0)
         ORDER BY p.created_at DESC LIMIT 10000`
      ).all<{ name: string; supply_price: number; retail: number; stock: number; category: string; barcode: string; moq: number; image_url: string; supplier: string; is_active: number; is_demo: string }>()
        .catch(() => ({ results: [] as Record<string, unknown>[] }))
      const header = ['상품명', '공급가', '권장소비자가', '재고', '카테고리', '바코드', '최소주문수량', '썸네일 이미지URL', '제조사', '노출', '데모']
      const data = (rows.results || []).map((r) => [
        r.name, r.supply_price, r.retail, r.stock, r.category, r.barcode, r.moq, r.image_url, r.supplier,
        Number(r.is_active) === 1 ? '노출' : '숨김', r.is_demo,
      ])
      return csvResponse(buildCsv(header, data), `wholesale-catalog-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (err) {
      return safeError(c, err, '카탈로그 내보내기 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // 📋 2026-06-17 (대표 요청 — 일괄등록 페이지에서 개별 상품 삭제): 도매 공급상품 목록(JSON, 페이지네이션·검색).
  //   supply-export(CSV)의 화면용 JSON 버전 — 어드민이 카탈로그를 보고 개별 삭제할 수 있게.
  app.get('/supply-list', async (c) => {
    const { DB } = c.env
    try {
      const page = Math.max(1, Number(c.req.query('page') || 1))
      const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || 30)))
      const offset = (page - 1) * limit
      const search = String(c.req.query('search') || '').slice(0, 100).trim()
      const params: unknown[] = []
      let searchClause = ''
      if (search) { searchClause = ' AND p.name LIKE ?'; params.push(`%${search}%`) }
      const baseWhere = `p.is_supply_product = 1 AND (p.supply_source_id IS NULL OR p.supply_source_id = 0)`
      const totalRow = await DB.prepare(`SELECT COUNT(*) AS c FROM products p WHERE ${baseWhere}${searchClause}`)
        .bind(...params).first<{ c: number }>().catch(() => null)
      const rows = await DB.prepare(
        `SELECT p.id, p.name, COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price,
                COALESCE(p.stock,0) AS stock, COALESCE(p.category,'') AS category, COALESCE(p.image_url,'') AS image_url,
                COALESCE(s.business_name,'') AS supplier, COALESCE(p.is_active,1) AS is_active,
                CASE WHEN p.slug LIKE 'demo-wholesale-%' THEN 1 ELSE 0 END AS is_demo
         FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id
         WHERE ${baseWhere}${searchClause}
         ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all().catch(() => ({ results: [] as Record<string, unknown>[] }))
      return c.json({ success: true, items: rows.results ?? [], pagination: { page, limit, total: Number(totalRow?.c ?? 0) } })
    } catch (err) {
      return safeError(c, err, '상품 목록 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // 🩺 2026-06-17 (대표 신고 — "상품이 admin엔 있는데 도매몰엔 안 떠, 영구해결"): 카탈로그 노출 자가진단.
  //   근본문제: admin 목록 WHERE(`is_supply_product=1 AND source NULL/0`) 보다 카탈로그 WHERE 가 엄격
  //   (`+is_active=1 +supply_source_id IS NULL +supply_price>0 +mall_id=요청몰 +visibility`). 한 조건이라도
  //   어긋나면 admin엔 보이고 카탈로그엔 안 뜸. 추측 대신 사유별 카운트 + 숨은 샘플 + 몰/가시성 분포를 실측.
  app.get('/catalog-diagnostic', async (c) => {
    const { DB } = c.env
    try {
      await ensureMallSchema(DB).catch(() => {})
      // admin-목록 유니버스 = 공급원본(source NULL/0). 그 안에서 카탈로그 노출 조건별 분해.
      //   ⚠️ 카탈로그 노출조건과 동일 predicate(mall=1·공개 가시성 기준). 허용목록(per-seller)은 제외 — 공개 노출만 셈.
      const uni = `is_supply_product = 1 AND (supply_source_id IS NULL OR supply_source_id = 0)`
      const visiblePred = `is_active = 1 AND supply_source_id IS NULL AND COALESCE(supply_price,0) > 0 AND COALESCE(mall_id,1) = 1 AND (supply_visibility = 'ALL' OR supply_visibility IS NULL)`
      const agg = await DB.prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN COALESCE(is_active,1) != 1 THEN 1 ELSE 0 END) AS inactive,
           SUM(CASE WHEN supply_source_id = 0 THEN 1 ELSE 0 END) AS source_zero,
           SUM(CASE WHEN supply_source_id IS NOT NULL AND supply_source_id != 0 THEN 1 ELSE 0 END) AS source_real,
           SUM(CASE WHEN COALESCE(supply_price,0) <= 0 THEN 1 ELSE 0 END) AS zero_price,
           SUM(CASE WHEN COALESCE(mall_id,1) != 1 THEN 1 ELSE 0 END) AS not_mall1,
           SUM(CASE WHEN supply_visibility IS NOT NULL AND supply_visibility != 'ALL' THEN 1 ELSE 0 END) AS restricted_vis,
           SUM(CASE WHEN ${visiblePred} THEN 1 ELSE 0 END) AS catalog_visible
         FROM products WHERE ${uni}`
      ).first<Record<string, number>>().catch(() => null)
      const byMall = await DB.prepare(
        `SELECT COALESCE(mall_id,1) AS mall_id, COUNT(*) AS c FROM products WHERE ${uni} GROUP BY COALESCE(mall_id,1) ORDER BY mall_id`
      ).all<{ mall_id: number; c: number }>().catch(() => ({ results: [] as { mall_id: number; c: number }[] }))
      const byVis = await DB.prepare(
        `SELECT COALESCE(supply_visibility,'(NULL)') AS v, COUNT(*) AS c FROM products WHERE ${uni} GROUP BY COALESCE(supply_visibility,'(NULL)') ORDER BY c DESC`
      ).all<{ v: string; c: number }>().catch(() => ({ results: [] as { v: string; c: number }[] }))
      // admin엔 보이나 카탈로그(mall1·공개)엔 안 뜨는 실제 상품 샘플 — 필드값으로 원인 즉시 판별.
      const hidden = await DB.prepare(
        `SELECT id, name, COALESCE(is_active,1) AS is_active, supply_source_id,
                COALESCE(supply_price,0) AS supply_price, COALESCE(mall_id,1) AS mall_id,
                COALESCE(supply_visibility,'(NULL)') AS supply_visibility,
                CASE WHEN slug LIKE 'demo-wholesale-%' THEN 1 ELSE 0 END AS is_demo
         FROM products WHERE ${uni} AND NOT (${visiblePred})
         ORDER BY created_at DESC LIMIT 20`
      ).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }))
      const malls = await DB.prepare(
        `SELECT id, name, host, COALESCE(active,1) AS active FROM wholesale_malls ORDER BY id`
      ).all<{ id: number; name: string; host: string | null; active: number }>().catch(() => ({ results: [] as { id: number; name: string; host: string | null; active: number }[] }))
      return c.json({
        success: true,
        summary: agg || {},
        by_mall: byMall.results || [],
        by_visibility: byVis.results || [],
        hidden_sample: hidden.results || [],
        malls: malls.results || [],
      })
    } catch (err) {
      return safeError(c, err, '카탈로그 진단 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // 🛠️ 2026-06-17 (대표 요청 "영구해결"): 카탈로그 노출 정정. 기본 = 데이터정합 정규화만(항상 안전 —
  //   상품을 잘못 노출시키지 않음): supply_source_id 0→NULL, mall_id NULL/0→1. 옵션(명시 선택 시): 비활성
  //   공급원본 노출(activate), 제한 가시성→ALL(open_visibility). 공급원본(source NULL/0)만 대상.
  app.post('/catalog-repair', async (c) => {
    const { DB } = c.env
    try {
      const body = await c.req.json<{ activate?: boolean; open_visibility?: boolean }>().catch(() => ({} as { activate?: boolean; open_visibility?: boolean }))
      const uni = `is_supply_product = 1 AND (supply_source_id IS NULL OR supply_source_id = 0)`
      const changed: Record<string, number> = {}
      // 1) source 0 → NULL (0 = '원본'(소스없음) 의미 — 카탈로그 IS NULL 과 일치시킴). 항상 안전.
      const r1 = await DB.prepare(`UPDATE products SET supply_source_id = NULL, updated_at = datetime('now') WHERE is_supply_product = 1 AND supply_source_id = 0`).run().catch(() => null)
      changed.source_normalized = Number(r1?.meta?.changes || 0)
      // 2) mall_id NULL/0 → 1 (기본 몰). 항상 안전.
      const r2 = await DB.prepare(`UPDATE products SET mall_id = 1, updated_at = datetime('now') WHERE ${uni} AND (mall_id IS NULL OR mall_id = 0)`).run().catch(() => null)
      changed.mall_normalized = Number(r2?.meta?.changes || 0)
      // 3) (옵션) 비활성 공급원본 노출.
      if (body.activate === true) {
        const r3 = await DB.prepare(`UPDATE products SET is_active = 1, updated_at = datetime('now') WHERE ${uni} AND COALESCE(is_active,1) != 1`).run().catch(() => null)
        changed.activated = Number(r3?.meta?.changes || 0)
      }
      // 4) (옵션) 제한 가시성 → ALL(전체 공개).
      if (body.open_visibility === true) {
        const r4 = await DB.prepare(`UPDATE products SET supply_visibility = 'ALL', updated_at = datetime('now') WHERE ${uni} AND supply_visibility IS NOT NULL AND supply_visibility != 'ALL'`).run().catch(() => null)
        changed.visibility_opened = Number(r4?.meta?.changes || 0)
      }
      await writeAuditLog(c, { action: 'wholesale_catalog_repair', targetType: 'products', targetId: 0, after: changed })
      return c.json({ success: true, changed })
    } catch (err) {
      return safeError(c, err, '카탈로그 정정 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // 🗑️ 2026-06-17 (대표 요청): 도매 공급상품 개별 삭제. 공급원본(supply_source_id NULL)만 — 복사본/소비자상품 보호.
  //   FTS 삭제 트리거 교정(자가치유) 후 하드삭제 시도 → 실패(주문이력 FK·트리거 등) 시 소프트 아카이브
  //   (is_active=0 + is_supply_product=0 + slug 재명명)로 폴백 → 카탈로그·목록·통계에서 제거 + 주문이력 보존.
  app.delete('/products/:id', async (c) => {
    const { DB } = c.env
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
    try {
      const prod = await DB.prepare(
        `SELECT id, name, slug FROM products WHERE id = ? AND is_supply_product = 1 AND (supply_source_id IS NULL OR supply_source_id = 0)`
      ).bind(id).first<{ id: number; name: string; slug: string | null }>().catch(() => null)
      if (!prod) return c.json({ success: false, error: '해당 공급상품을 찾을 수 없습니다' }, 404)
      await ensureProductsFtsDeleteTrigger(DB)
      let method = 'delete'
      try {
        await DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run()
      } catch {
        await DB.prepare(
          `UPDATE products SET is_active = 0, is_supply_product = 0,
                  slug = 'archived-' || id || '-' || COALESCE(slug, 'p'), updated_at = datetime('now')
            WHERE id = ?`,
        ).bind(id).run()
        method = 'archived'
      }
      await writeAuditLog(c, {
        action: 'wholesale_product_delete',
        targetType: 'product',
        targetId: String(id),
        before: { name: prod.name },
        after: { method },
      }).catch(() => { /* audit 실패해도 성공 처리 */ })
      return c.json({ success: true, method })
    } catch (err) {
      return safeError(c, err, '상품 삭제 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // 🗑️ 2026-06-17 (대표 요청 — 체크박스 일괄/모두 삭제): 도매 공급상품 다건 삭제. 개별 삭제와 동일 안전 패턴.
  //   단일 `DELETE ... IN (...)` 시도(주문이력 없는 흔한 경우 1쿼리) → 실패(일부 FK/트리거) 시 건별
  //   하드삭제→소프트 아카이브 폴백. 공급원본(supply_source_id NULL)만 — 복사본/소비자상품 보호. 최대 200건.
  app.post('/supply-bulk-delete', async (c) => {
    const { DB } = c.env
    try {
      const body = await c.req.json<{ ids?: unknown }>().catch(() => ({} as { ids?: unknown }))
      const ids = Array.isArray(body.ids)
        ? [...new Set(body.ids.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0))].slice(0, 200)
        : []
      if (ids.length === 0) return c.json({ success: false, error: '삭제할 상품을 선택해주세요' }, 400)
      await ensureProductsFtsDeleteTrigger(DB)
      const ph = ids.map(() => '?').join(',')
      const rows = await DB.prepare(
        `SELECT id FROM products WHERE id IN (${ph}) AND is_supply_product = 1 AND (supply_source_id IS NULL OR supply_source_id = 0)`,
      ).bind(...ids).all<{ id: number }>().catch(() => ({ results: [] as { id: number }[] }))
      const valid = (rows.results || []).map((r) => Number(r.id))
      let deleted = 0
      let archived = 0
      if (valid.length > 0) {
        const vph = valid.map(() => '?').join(',')
        try {
          const r = await DB.prepare(`DELETE FROM products WHERE id IN (${vph})`).bind(...valid).run()
          deleted = r.meta?.changes ?? valid.length
        } catch {
          // 일부가 주문이력 FK·트리거 등으로 실패 → 건별 처리(하드삭제 시도 → 소프트 아카이브).
          for (const id of valid) {
            try { await DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run(); deleted++ } catch {
              await DB.prepare(
                `UPDATE products SET is_active = 0, is_supply_product = 0,
                        slug = 'archived-' || id || '-' || COALESCE(slug, 'p'), updated_at = datetime('now')
                  WHERE id = ?`,
              ).bind(id).run().catch(() => { /* noop */ })
              archived++
            }
          }
        }
      }
      await writeAuditLog(c, {
        action: 'wholesale_product_bulk_delete',
        targetType: 'product',
        targetId: valid.join(','),
        before: { requested: ids.length },
        after: { deleted, archived },
      }).catch(() => { /* audit 실패해도 성공 처리 */ })
      return c.json({ success: true, deleted, archived, total: deleted + archived })
    } catch (err) {
      return safeError(c, err, '일괄 삭제 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })
}
