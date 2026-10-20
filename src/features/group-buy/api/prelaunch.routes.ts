/**
 * 🌱 **오픈 예정(사전 응모) 모아보기** — 2026-09-24 대표 문서 ⑤ *"단독공개 / 공개예정 페이지가
 * 있었으면 좋겠음"*.
 *
 * ## 엔진은 이미 있었다
 * 오픈 예정은 2026-07-05 에 대표 지시("옵션으로 선택할 수 있게 개발")로 들어온 모델이다 —
 * 어드민이 `mode='prelaunch'` 로 등록하면 `product_supply_meta(key='prelaunch', value='1')` 가
 * 찍히고, 상세 SSR 이 **"오픈 예정 · 사전 응모 받는 중"** 배지를 그리며, 가짜 후기 시더가 그 상품을
 * 제외한다(안 연 매장에 후기가 붙는 모순 차단). **2026-09-24 실측 D1: 활성 8건.**
 * 없던 것은 **그것만 모아 보는 화면**뿐이었다.
 *
 * ## 🔒 왜 새 엔드포인트인가 — 잠긴 파일을 안 건드리려고
 * 소비자 피드(`group-buy-public.routes.ts`)는 **로딩 최적화 잠금** 대상이다. 그 응답은 `prelaunch`
 * 플래그를 **이미 내려준다**(fcfs 상품 한정 — 실측 8건 전부 해당). 없는 것은 플래그가 아니라
 * **"오픈 예정만 달라"고 물을 방법**이다: 그 라우트가 받는 필터는 `status`·`category`·`sort`
 * 화이트리스트뿐이고, 값을 하나 더하면 **캐시키가 갈려** SSR 0-RTT·엣지캐시 계약을 건드린다
 * (CLAUDE.md 가 대표 승인을 요구한다). ⇒ **별도 경로**로 뺐다. 잠긴 파일은 한 글자도 안 바뀐다.
 * 롤백은 `worker/index.ts` 의 마운트 한 줄 제거.
 *
 * ## 응답이 카드에 필요한 것까지 싣는다
 * `/soon` 은 홈과 **같은 카드**(`GroupBuyFeedCard`)를 쓰고, 그 카드의 '오픈 예정 · 사전응모' 배지는
 * `p.fcfs` 를 본다. 그래서 피드와 **같은 모양**으로 fcfs 를 붙여 준다 — 안 붙이면 오픈 예정
 * 목록인데 카드가 평범한 딜처럼 보인다(에러가 안 나서 아무도 신고 안 하는 종류).
 *
 * ## 계약
 *   GET /api/group-buy/prelaunch?limit=N   → { success, data: [...], total }
 *   · 활성(`is_active=1`) · 소비자 노출 가능(`approvedSellerProductSql`) 인 prelaunch 상품
 *   · 데모는 뒤로(2026-07-04 대표 "데모 이용권 노출은 항상 후순위")
 *   · `publicCache(300)` — 오픈 예정 목록은 초 단위로 안 바뀐다
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { publicCache } from '@/worker/middleware/edge-cache'
import { approvedSellerProductSql } from '@/shared/db/consumer-visible-product'
import { intParam } from '@/shared/pagination'
import { safeError } from '@/worker/utils/safe-error'

const app = new Hono<{ Bindings: Env }>()

/** 한 화면에 그릴 수 있는 만큼. 오픈 예정은 본래 소수다(실측 8건). */
const DEFAULT_LIMIT = 40
const MAX_LIMIT = 100

app.get('/prelaunch', publicCache(300), async (c) => {
  try {
    const DB = c.env.DB
    const limit = Math.min(MAX_LIMIT, Math.max(1, intParam(c.req.query('limit'), DEFAULT_LIMIT)))
    const { results } = await DB.prepare(
      `SELECT p.id, p.name, p.price, p.original_price, p.image_url, p.images,
              p.restaurant_name, p.restaurant_address, p.category, p.avg_rating, p.review_count,
              p.dominant_color, p.discount_rate,
              (CASE WHEN COALESCE(p.slug,'') LIKE 'demo-%' THEN 1 ELSE 0 END) AS is_demo
         FROM products p
         JOIN product_supply_meta m ON m.product_id = p.id AND m.key = 'prelaunch' AND m.value = '1'
        WHERE p.is_active = 1
          AND ${approvedSellerProductSql('p')}
        ORDER BY is_demo, p.created_at DESC
        LIMIT ?`
    ).bind(limit).all<Record<string, unknown>>()
      // 목록이 없는 것과 못 읽는 것은 다르지만, 이 화면은 '오픈 예정' 안내라 빈 목록이 안전한 실패다.
      .catch(() => ({ results: [] as Record<string, unknown>[] }))

    // 카드 배지용 fcfs enrich — 피드(group-buy-public)의 블록과 **같은 모양**으로 맞춘다.
    //   fail-soft: 못 읽으면 배지만 없고 목록은 뜬다(오픈 예정이라는 사실은 prelaunch 로 이미 전달).
    const rows = results || []
    const cfgById = new Map<number, Record<string, string>>()
    const cntById = new Map<number, number>()
    try {
      const ids = rows.map(r => Number(r.id)).filter(n => Number.isFinite(n) && n > 0)
      if (ids.length > 0) {
        const ph = ids.map(() => '?').join(',')
        const { results: meta } = await DB.prepare(
          `SELECT product_id, key, value FROM product_supply_meta WHERE key LIKE 'fcfs_%' AND product_id IN (${ph})`
        ).bind(...ids).all<{ product_id: number; key: string; value: string | null }>()
        for (const m of meta || []) {
          const rec = cfgById.get(m.product_id) || {}
          rec[m.key] = m.value ?? ''
          cfgById.set(m.product_id, rec)
        }
        const enabled = [...cfgById.entries()].filter(([, r]) => r.fcfs_enabled === '1').map(([id]) => id)
        if (enabled.length > 0) {
          const ph2 = enabled.map(() => '?').join(',')
          const { results: cnts } = await DB.prepare(
            `SELECT product_id, COUNT(*) as n FROM fcfs_applications
              WHERE product_id IN (${ph2}) AND status IN ('applied','selected') GROUP BY product_id`
          ).bind(...enabled).all<{ product_id: number; n: number }>()
          for (const r of cnts || []) cntById.set(r.product_id, r.n)
        }
      }
    } catch { /* fail-soft — 배지 없이 목록만 */ }

    const data = rows.map(r => {
      const pid = Number(r.id)
      const rec = cfgById.get(pid) || {}
      if (rec.fcfs_enabled !== '1') return { ...r, prelaunch: true }
      const seed = Math.max(0, parseInt(rec.fcfs_applied_seed || '0', 10) || 0)
      return {
        ...r,
        prelaunch: true,
        fcfs: {
          enabled: true,
          prelaunch: true,
          spots: Math.max(0, parseInt(rec.fcfs_spots || '0', 10) || 0),
          appliedDisplay: seed + (cntById.get(pid) || 0),
          deadline: rec.fcfs_deadline || null,
          demo: r.is_demo === 1,
        },
      }
    })
    return c.json({ success: true, data, total: data.length })
  } catch (err) {
    return safeError(c, err, '오픈 예정 목록을 불러오지 못했습니다', '[prelaunch]')
  }
})

export default app
