/** 🏭 distributor-admin: 도매몰 데모 상품 시드 (어드민, 멱등) (byte-identical 분해). */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { swallow } from '@/worker/utils/swallow'
import { ensureSupplyVisibilitySchema } from '../supply-visibility'
import { ensureProductsFtsDeleteTrigger, type Env } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// 🏭 2026-06-04 도매몰 데모 상품 시드 (어드민) — 멱등. 카탈로그에 바로 노출되는 공급상품 10개.
//   is_active=1 + is_supply_product=1 + supply_price>0 + visibility=ALL → /wholesale 카탈로그 즉시 표시.
//   slug 'demo-wholesale-N' 마커로 식별 → 재실행 시 중복 안 함, DELETE 로 일괄 제거.
//   ⚠️ 표시용 데모 — supplier_id=NULL (주문 시 정산은 데모이므로 무의미). 운영 데이터 아님.
const DEMO_SLUG_PREFIX = 'demo-wholesale-'
// 🖼️ 2026-06-17 (사용자 신고 — 데모 이미지가 상품과 안 맞음): picsum.photos/seed 는 시드 기반 *무작위* 사진이라
//   상품(커피/견과/마스크팩…)과 전혀 무관한 이미지가 들어갔음. → loremflickr 의 카테고리 키워드 매칭으로 교체.
//   /600/600/<keyword>?lock=<n> : keyword 로 주제 매칭(coffee→커피 등) + lock 으로 이미지 고정(매 로드 동일).
//   호스트 비-allowlist → cfImage 가 원본 URL 그대로 반환(브라우저 직접 로드, CSP img-src https: 허용). 데모 표시용.
const DEMO_PRODUCTS: { name: string; category: string; supply: number; retail: number; stock: number; moq: number; color: string; img: string }[] = [
  { name: '프리미엄 블렌드 원두 커피 1kg', category: 'food', supply: 9800, retail: 16000, stock: 480, moq: 10, color: '#6F4E37', img: 'https://loremflickr.com/600/600/coffee?lock=11' },
  { name: '유기농 데일리 견과 믹스 500g', category: 'food', supply: 7200, retail: 12900, stock: 320, moq: 10, color: '#C8A06A', img: 'https://loremflickr.com/600/600/almonds?lock=12' },
  { name: '수분 진정 마스크팩 30매', category: 'beauty', supply: 8500, retail: 19900, stock: 150, moq: 5, color: '#9FD8CB', img: 'https://loremflickr.com/600/600/skincare?lock=13' },
  { name: '비타민C 브라이트닝 앰플 30ml', category: 'beauty', supply: 11200, retail: 24000, stock: 90, moq: 3, color: '#F2B705', img: 'https://loremflickr.com/600/600/cosmetics?lock=14' },
  { name: '호텔 컬렉션 극세사 수건 10장', category: 'living', supply: 14500, retail: 26000, stock: 60, moq: 2, color: '#D9E4EC', img: 'https://loremflickr.com/600/600/towel?lock=15' },
  { name: '진공 보온 스테인리스 텀블러 500ml', category: 'living', supply: 6900, retail: 13900, stock: 240, moq: 6, color: '#4A5A6A', img: 'https://loremflickr.com/600/600/mug?lock=16' },
  { name: '베이직 무지 반팔 티셔츠 (5color)', category: 'fashion', supply: 4300, retail: 9900, stock: 600, moq: 10, color: '#2E2E2E', img: 'https://loremflickr.com/600/600/tshirt?lock=17' },
  { name: '데일리 컴포트 양말 10족 세트', category: 'fashion', supply: 3200, retail: 7900, stock: 800, moq: 10, color: '#B0A8B9', img: 'https://loremflickr.com/600/600/socks?lock=18' },
  { name: '고속 충전 USB-C 케이블 3개입', category: 'digital', supply: 5100, retail: 11900, stock: 360, moq: 5, color: '#1F6FEB', img: 'https://loremflickr.com/600/600/charger?lock=19' },
  { name: '차량용 디퓨저 방향제 세트', category: 'lifestyle', supply: 4600, retail: 9900, stock: 280, moq: 5, color: '#7FB069', img: 'https://loremflickr.com/600/600/perfume?lock=20' },
]

export function registerSeedDemoRoutes(app: Hono<{ Bindings: Env }>) {
  app.post('/seed-demo-products', rateLimit({ action: 'wholesale-seed-demo', max: 5, windowSec: 60 }), async (c) => {
    const { DB } = c.env
    try {
      await ensureSupplyVisibilitySchema(DB)
      await DB.prepare('ALTER TABLE products ADD COLUMN dominant_color TEXT').run().catch(swallow('seed-demo:dc'))
      const existing = await DB.prepare(`SELECT COUNT(*) AS c FROM products WHERE slug LIKE ?`).bind(DEMO_SLUG_PREFIX + '%').first<{ c: number }>()
      if ((existing?.c ?? 0) > 0) {
        // 🩹 2026-06-17 (사용자 신고 — 데모 이미지가 상품과 안 맞음): 이미 시드된 데모는 slug 매칭으로
        //   이미지/대표색을 현재 DEMO_PRODUCTS 정의로 일괄 갱신 → 삭제·재생성 없이 '데모 채우기' 재클릭만으로 치유.
        let refreshed = 0
        for (let i = 0; i < DEMO_PRODUCTS.length; i++) {
          const d = DEMO_PRODUCTS[i]
          const r = await DB.prepare(
            `UPDATE products SET image_url = ?, dominant_color = ?, updated_at = datetime('now') WHERE slug = ?`,
          ).bind(d.img, d.color, DEMO_SLUG_PREFIX + (i + 1)).run()
          refreshed += r.meta?.changes ?? 0
        }
        return c.json({ success: true, seeded: 0, refreshed, existing: existing?.c ?? 0, message: `데모 상품 이미지 ${refreshed}개를 상품에 맞게 갱신했습니다` })
      }
      let seeded = 0
      for (let i = 0; i < DEMO_PRODUCTS.length; i++) {
        const d = DEMO_PRODUCTS[i]
        await DB.prepare(
          `INSERT INTO products (name, description, price, supply_price, stock, image_url, category, product_type,
             is_active, is_supply_product, supplier_id, supply_approval_status, supply_visibility, is_brand_product,
             min_order_qty, dominant_color, slug, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'regular', 1, 1, NULL, 'approved', 'ALL', 0, ?, ?, ?, datetime('now'), datetime('now'))`,
        ).bind(
          d.name, `검증 제조사 공급 데모 상품 — ${d.name}`, d.retail, d.supply, d.stock, d.img, d.category, d.moq, d.color, DEMO_SLUG_PREFIX + (i + 1),
        ).run()
        seeded++
      }
      return c.json({ success: true, seeded })
    } catch (err) {
      return safeError(c, err, '데모 상품 생성 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  app.delete('/seed-demo-products', async (c) => {
    const { DB } = c.env
    try {
      // 🩹 근본수정: 하드삭제 전에 깨진 FTS 삭제 트리거를 정식 'delete' 커맨드 패턴으로 교정(isolate 당 1회, 멱등).
      //   이걸로 아래 하드삭제가 정상 성공 → 폴백 불필요. 교정 실패해도 아래 try/catch 폴백이 안전망.
      await ensureProductsFtsDeleteTrigger(DB)
      // 🩹 2026-06-17 (사용자 신고 — '데모 정리' 500): 데모 하드삭제가 products 의 AFTER DELETE FTS 트리거에서
      //   throw 함. products_fts 는 외부콘텐츠(content=products) FTS5 라, AFTER DELETE 시점엔 원본 행이 이미
      //   사라져 인덱스 동기화에 필요한 콘텐츠를 못 읽음 → 에러. 하드삭제는 이 앱에서 드물어(보통 is_active 소프트삭제)
      //   잠복해 있던 버그가 유일한 하드삭제 경로인 데모 '정리'에서 표면화. INSERT/UPDATE 트리거는 행이 존재해 정상.
      //   → 하드삭제 시도 후 실패하면 소프트 아카이브(is_active=0 + slug 재명명)로 폴백. UPDATE 경로
      //   (products_fts_update)는 상시 동작이라 안전. 결과: 카탈로그(is_active=1 요구)에서 제거 + 데모 통계
      //   (slug LIKE 'demo-wholesale-%') 0 + 재시드 정상. 자식 FK 참조 케이스도 동일 폴백으로 처리.
      try {
        const r = await DB.prepare(`DELETE FROM products WHERE slug LIKE ?`).bind(DEMO_SLUG_PREFIX + '%').run()
        return c.json({ success: true, deleted: r.meta?.changes ?? 0, method: 'delete' })
      } catch (delErr) {
        const r = await DB.prepare(
          `UPDATE products SET is_active = 0, slug = 'archived-' || id || '-' || slug, updated_at = datetime('now') WHERE slug LIKE ?`,
        ).bind(DEMO_SLUG_PREFIX + '%').run()
        const msg = String((delErr as { message?: string })?.message || '').toLowerCase()
        const reason = /foreign key/.test(msg) ? 'fk' : (/fts|trigger|malformed|no such/.test(msg) ? 'fts_trigger' : 'other')
        return c.json({ success: true, deleted: r.meta?.changes ?? 0, method: 'archived', reason })
      }
    } catch (err) {
      return safeError(c, err, '데모 상품 삭제 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })
}
