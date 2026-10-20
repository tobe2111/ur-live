// ============================================================
// 🚀 2026-07-11 (로딩 전수조사 후속 — 대표 "남은 개선 여지 진행, 가장 이상적으로"):
//   셀러 공개 프로필 페이로드 조립 SSOT — seller.routes `GET /:id/public` 의 본문을 그대로 추출.
//
//   목적: 사업자 유어샵(`/u/:handle`)의 [curator fetch → seller /public fetch] 2-RTT 직렬을
//   1-RTT 로 — curator.routes 가 linked seller 의 public 페이로드를 응답에 동봉(additive)할 수
//   있게 라우트 핸들러와 **같은 함수**를 공유한다(쿼리/캐시키/enrich 로직 중복 0, 드리프트 0).
//
//   동작은 기존 핸들러와 동일: KV 캐시(seller:{param}, 300s+SWR) → 컬럼 자가치유 SELECT →
//   curator_handle / seller_business_info additive enrich(실패 시 조용히 생략).
// ============================================================
import type { Env } from '../types/env';
import { QueryBuilder } from '../repositories/query-builder';
import { cacheGet } from './cache';

// 🛡️ 2026-06-16 (대표 신고 — 배너 저장했는데 안 보임): 컬럼 단위 자가치유.
//   과거엔 전체 SELECT 가 한 컬럼(brand_color 등) 부재로 실패하면 전체가 FALLBACK 으로 떨어지고,
//   그 FALLBACK 이 'NULL AS banner_url' 이라 저장된 배너가 안 읽혔음. 이제 실제로 없는 컬럼만
//   NULL 로 빼고 존재 컬럼은 보존 (productDetailColsHealed 패턴). (seller.routes 에서 이동)
const SELLER_PUBLIC_COLS: Array<{ expr: string; out?: string; probe?: string }> = [
  { expr: 's.id' }, { expr: 's.username' }, { expr: 's.name' },
  { expr: 's.business_name', out: 'business_name', probe: 'business_name' },
  { expr: 's.business_number', out: 'business_number', probe: 'business_number' },
  { expr: 's.business_address', out: 'business_address', probe: 'business_address' },
  { expr: 's.profile_image', out: 'profile_image', probe: 'profile_image' },
  { expr: 's.bio', out: 'bio', probe: 'bio' },
  // 🔒 2026-10-14 — `commission_rate` 를 **일부러 뺐다**. 되살리지 말 것.
  //   라이브 실측(인증 0, id 순회): 홍대돈까스 5 · 청룡갈비 5 · 달빛한스푼 10 이 그대로 나갔고,
  //   이 응답은 `__SSR_INITIAL_SELLER__` 로 서빙 HTML 에 박혀 **크롤러까지** 받았다.
  //   소비자 화면은 그 값을 한 번도 읽지 않는다(전수 확인 — 걸리는 것은 상품의
  //   `referral_commission_rate` 이거나 셀러 **본인** 정산 화면이다).
  //   🔴 매장별 요율은 내부 상거래 조건이다 — `/about` 이 "셀러별 개별 조정(협상 여지)" 라고
  //   알려 주는데 남의 요율까지 조회되면 그게 바로 협상 근거가 된다. CLAUDE.md 가 AI 초안에
  //   요구하는 "운영 정보 차단(수수료율·정산·커미션)" 과 같은 기준을 공개 API 에도 적용한다.
  //   ✅ `business_number`·`ceo_name` 은 **남긴다** — 통신판매업자 표기 의무 정보이고
  //      유어샵 사업자정보 섹션이 실제로 쓴다(같이 지우면 표기 의무를 깨뜨린다).
  { expr: 's.created_at' },
  { expr: 's.sns_instagram', out: 'sns_instagram', probe: 'sns_instagram' },
  { expr: 's.sns_youtube', out: 'sns_youtube', probe: 'sns_youtube' },
  { expr: 's.sns_facebook', out: 'sns_facebook', probe: 'sns_facebook' },
  { expr: 's.sns_twitter', out: 'sns_twitter', probe: 'sns_twitter' },
  { expr: 's.website_url', out: 'website_url', probe: 'website_url' },
  { expr: 's.kakao_chat_url AS kakao_chat_link', out: 'kakao_chat_link', probe: 'kakao_chat_url' },
  { expr: 's.representative_name AS ceo_name', out: 'ceo_name', probe: 'representative_name' },
  { expr: 's.banner_url', out: 'banner_url', probe: 'banner_url' },
  { expr: 's.brand_color', out: 'brand_color', probe: 'brand_color' },
  { expr: 's.external_live_tiktok', out: 'external_live_tiktok', probe: 'external_live_tiktok' },
  { expr: 's.external_live_instagram', out: 'external_live_instagram', probe: 'external_live_instagram' },
  { expr: 's.external_live_facebook', out: 'external_live_facebook', probe: 'external_live_facebook' },
  { expr: '(SELECT COUNT(*) FROM seller_follows WHERE seller_id = s.id) AS follower_count' },
];
const _missingSellerCols = new Set<string>();
function buildSellerPublicSelect(): string {
  return SELLER_PUBLIC_COLS
    .map((col) => (col.probe && col.out && _missingSellerCols.has(col.probe)) ? `NULL AS ${col.out}` : col.expr)
    .join(', ');
}
function pruneSellerPublicCol(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err);
  const m = msg.match(/no such column:?\s*(?:[A-Za-z_]+\.)?([A-Za-z_0-9]+)/i);
  if (!m) return false;
  const col = m[1];
  if (!SELLER_PUBLIC_COLS.some((c) => c.probe === col) || _missingSellerCols.has(col)) return false;
  _missingSellerCols.add(col);
  console.error('[SELLERS] public SELECT 컬럼 자동 제외:', col, '— repair-schema 등록 필요');
  return true;
}

/**
 * 셀러 공개 프로필 페이로드 (비인증, ID/username/slug 지원).
 * 기존 `GET /api/sellers/:id/public` 본문과 동일 — KV 캐시 + 자가치유 SELECT + additive enrich.
 * @returns 페이로드 객체, 없으면 null. (throw 는 호출측 처리 — 라우트는 500, 동봉측은 생략)
 */
export async function buildSellerPublicPayload(
  env: Pick<Env, 'DB' | 'SESSION_KV'>,
  param: string,
  opts: { withProducts?: boolean } = {},
): Promise<Record<string, unknown> | null> {
  // Seller profile changes infrequently — 5 min TTL with 2 min SWR.
  // Key uses the lookup param directly (id/username/slug) so independent
  // callers that hit different keys stay cache-correct.
  const seller = await cacheGet(
    env.SESSION_KV,
    `seller:${param}`,
    async () => {
      const qb = new QueryBuilder(env.DB);
      const isNumeric = /^\d+$/.test(param);
      const where = isNumeric ? 's.id = ?' : 's.username = ?';
      // 컬럼 단위 self-heal: 실제 없는 컬럼만 NULL 로 빼고 재시도 → banner_url 등 존재 컬럼은 보존.
      for (let i = 0; i <= SELLER_PUBLIC_COLS.length; i++) {
        try {
          return await qb.queryOne(`SELECT ${buildSellerPublicSelect()} FROM sellers s WHERE ${where}`, [param]);
        } catch (e) {
          if (!pruneSellerPublicCol(e)) throw e;
        }
      }
      return null;
    },
    { ttl: 300, staleWhileRevalidate: 120 }
  );

  if (!seller) return null;

  // 🏁 2026-06-12 (P5): 셀러에 연결된 유저가 큐레이터(핸들 보유)면 handle additive 동봉.
  try {
    const sid = (seller as { id?: number }).id
    if (sid) {
      const linked = await env.DB.prepare(
        `SELECT u.handle FROM sellers s JOIN users u ON (
               u.id = s.linked_user_id
            OR (s.linked_user_id IS NULL AND s.email IS NOT NULL AND s.email != '' AND u.email = s.email)
         )
          WHERE s.id = ? AND u.handle IS NOT NULL AND u.handle != '' LIMIT 1`
      ).bind(sid).first<{ handle: string }>()
      if (linked?.handle) (seller as Record<string, unknown>).curator_handle = linked.handle
    }
  } catch { /* additive — 생략 가능 */ }

  // 🖼️ 2026-07-01 (대표 — 유어샵 판매자 정보 "항상 미등록" 수정): side table 에서 additive enrich.
  try {
    const sid2 = (seller as { id?: number }).id
    if (sid2) {
      let sbi: { mail_order_number?: string | null; address?: string | null; ceo_name?: string | null } | null = null
      try {
        sbi = await env.DB.prepare(
          'SELECT mail_order_number, address, ceo_name FROM seller_business_info WHERE seller_id = ? ORDER BY id DESC LIMIT 1'
        ).bind(sid2).first()
      } catch {
        // mail_order_number 컬럼 미존재 환경 — 주소/대표자 폴백만이라도
        sbi = await env.DB.prepare(
          'SELECT address, ceo_name FROM seller_business_info WHERE seller_id = ? ORDER BY id DESC LIMIT 1'
        ).bind(sid2).first()
      }
      if (sbi) {
        const s = seller as Record<string, unknown>
        if (sbi.mail_order_number) s.mail_order_number = sbi.mail_order_number
        if (sbi.address && !s.business_address) s.business_address = sbi.address
        if (sbi.ceo_name && !s.ceo_name) s.ceo_name = sbi.ceo_name
      }
    }
  } catch { /* additive — 생략 가능 */ }

  // 🛍️ 2026-10-14 (대표 "다 해주고 머지 후 또 개선점 찾아" — 라이브 SEO 전수): **`/s/:username` 의
  //   크롤러 본문이 6자였다**(Googlebot UA 실측 — `urdeal` 워드마크뿐). 그 표면엔 서버 첫 화면
  //   빌더가 아예 없고, 이 페이로드에도 재료가 없었다 — 두 가게 모두 `bio`·`business_address`
  //   ·`profile_image`·SNS·`website_url` 이 **전부 null** 이고 이름뿐이다(실측).
  //   그런데 **상품은 있다**(홍대돈까스·달빛한스푼 각 1개, 소비자-가시·사진 보유).
  //
  //   🔴 **왜 지금 중요한가**: D1 실측으로 승인 셀러 10곳 중 `linked_user_id` 가 있는 곳은 **1곳**이고
  //   `/store_new`(유일한 가입 문)는 그 컬럼을 비운다 ⇒ **앞으로 등록되는 모든 매장의 유어샵 URL 이
  //   `/s/store_xxx`** 다. 지금 2건이지만 처방을 안 하면 매장 수만큼 비례해 늘어난다.
  //
  //   🔑 **쿼리를 새로 만들지 않는다** — `/u/` 사업자 동봉이 쓰는 `loadLinkedSellerProducts`
  //   (= `/api/products` 와 같은 `ProductService`)를 그대로 쓴다. 필터·컬럼이 갈릴 자리가 없다.
  //   ⚠️ **옵션이 기본 false 다**: `curator.routes` 는 `linked_seller_products` 를 **따로** 동봉하므로
  //      여기서도 담으면 `/u/` 사업자 HTML 에 같은 상품이 두 벌 실린다. 그래서 호출부
  //      (`seller.routes GET /:id/public`)만 켠다.
  //   💰 비용 0 에 가깝다 — 그 라우트 응답은 `CDN-Cache-Control: max-age=180` 이라 SSR 이
  //      `caches.default` 에서 받고(실측 `SELLER:edge-hit`), cron 이 상위 셀러를 예열한다.
  if (opts.withProducts) {
    try {
      const sid3 = (seller as { id?: number }).id
      if (sid3) {
        const { loadLinkedSellerProducts } = await import('./linkshop-seller-products')
        const rows = await loadLinkedSellerProducts(env.DB, Number(sid3), 8)
        if (Array.isArray(rows) && rows.length) (seller as Record<string, unknown>).products = rows
      }
    } catch { /* additive — 생략 가능(그러면 본문이 비고 sitemap 게이트가 그 짝을 맞춘다) */ }
  }

  return seller as Record<string, unknown>;
}
