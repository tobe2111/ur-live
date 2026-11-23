/**
 * 🎟️ 이용권 상세 — `product_supply_meta` 파생값 묶음 (2026-09-14 추출)
 *
 * ## 왜 뺐나
 * `group-buy-public.routes.ts` 는 **파일크기 래칫 baseline(1154)에 붙어 있었다.** 1인당 구매 상한의
 * 실효값(`qty_cap`)을 응답에 실으려는데 넣을 자리가 없었고, 규칙이 말하는 처방이 *"줄이거나 분리"* 다.
 * 이 묶음은 한 곳에서 읽은 `metaMap` 을 해석만 하는 순수 파생이라 가장 깨끗하게 떨어진다.
 *
 * ## 옮기면서 지킨 것
 * **로직 byte-불변** — 각 값의 판정식·기본값·fail-soft 범위를 그대로 옮겼다. 캐시 헤더
 * (`Cache-Control`/`CDN-Cache-Control` 분리) · `group_buy_tiers` 서버 parse · materialized 경로는
 * **한 글자도 안 건드렸다**(그 파일의 잠금 항목이고 여기로 오지 않았다).
 *
 * ⚠️ `seller_handle` 은 여기 없다 — 그건 meta 가 아니라 JOIN 쿼리 결과라 라우트에 남는다.
 */
import { normalizeKakaoPlaceUrl } from '@/shared/kakao-place-url'
import { getPlatformQtyCap, resolveQtyCap } from '../../../worker/utils/purchase-cap'

type MetaMap = Map<number, Record<string, string>> | null | undefined

export type DetailMeta = {
  menu?: Array<{ name: string; desc?: string; price?: string; image?: string; hot?: boolean }>
  /** 셀러가 등록 시 정한 표시용 한도. 없으면 null → 배지 미표시. */
  max_per_person: number | null
  /** 실효 상한(상품별 ?? 플랫폼 기본) — 수량 스테퍼가 멈출 자리. 조회 실패 시 null. */
  qty_cap: number | null
  kakao_place_url: string | null
  min_review_level: number | null
  prelaunch: boolean
  onnuri_merchant: boolean
  /** 📞 2026-11-23 전화 예약형 이용권 — 구매 전에 "구매 후 매장에 전화해 날짜를 예약" 을 알린다(`worker/utils/visit-plan.ts`). */
  call_booking: boolean
  /**
   * 📰 2026-11-13 '다녀온 사람들' 공개 글·영상 제목 최대 5개 — 검색 크롤러 본문(`buildDetailNoscript`)의 재료.
   * 실측: `/pass/2919` 크롤러 본문이 173자였다(설명 = 상품명이라 반복 제거됨). 가게마다 이미 모아 둔 실제 후기 제목이
   * 가장 큰 고유 텍스트다(가게 이름 + 동네 + 메뉴). 없으면 빈 배열.
   */
  creator_titles: Array<{ title: string; author: string | null; platform: string }>
}

export async function buildDetailMeta(
  DB: D1Database, id: number | string, metaMap: MetaMap, sellerId: unknown,
  store?: { name?: string | null; address?: string | null },
): Promise<DetailMeta> {
  const meta = metaMap?.get(Number(id))

  let menu: DetailMeta['menu']
  try {
    const raw = meta?.menu
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) menu = arr }
  } catch { /* meta 데이터 invalid — 메뉴 없음 */ }

  // 🛡️ 2026-07-01 셀러가 등록 시 정하는 표시용 한도(0/미설정 = 배지 미표시).
  const mppRaw = meta?.max_per_person
  const max_per_person = mppRaw != null && Number.isFinite(Number(mppRaw)) && Number(mppRaw) > 0 ? Math.floor(Number(mppRaw)) : null

  // 🧾 2026-09-14 실효 상한 — 표시용과 **일부러 분리**한다. 플랫폼 기본을 배지로 띄우면
  //   셀러가 정하지도 않은 수를 약속처럼 말하게 된다.
  let qty_cap: number | null = null
  try { qty_cap = resolveQtyCap(mppRaw, await getPlatformQtyCap(DB)) } catch { /* fail-soft */ }

  // 🗺️ 2026-07-02 카카오맵 리뷰 게이미피케이션 — 레벨 전용 이용권(서버 주문검증과 짝).
  const mrlRaw = meta?.min_review_level
  const min_review_level = mrlRaw != null && Number.isFinite(Number(mrlRaw)) && Number(mrlRaw) > 1 ? Math.floor(Number(mrlRaw)) : null

  // 🏪 2026-07-05 온누리 가맹 뱃지 (B2G): seller_meta.onnuri_merchant='1'.
  let onnuri_merchant = false
  try {
    const sid = Number(sellerId)
    if (Number.isFinite(sid) && sid > 0) {
      const { getSellerMeta } = await import('../../../worker/utils/seller-meta')
      onnuri_merchant = (await getSellerMeta(DB, [sid])).get(sid)?.onnuri_merchant === '1'
    }
  } catch { /* fail-soft */ }

  // 📰 다녀온 사람들 제목(공개 · 고정 먼저 · 최신순 5개). 표가 없거나 실패하면 빈 배열(상세를 막지 않는다).
  let creator_titles: DetailMeta['creator_titles'] = []
  try {
    if (store?.name) {
      const { storeKeyFor } = await import('../../creator-content/api/content-db')
      const { results } = await DB.prepare(`SELECT title, author_name, platform FROM store_creator_content
          WHERE store_key = ? AND status = 'visible' AND title IS NOT NULL AND TRIM(title) != ''
          ORDER BY pinned DESC, position ASC, id DESC LIMIT 5`).bind(storeKeyFor(store.name, store.address ?? null))
        .all<{ title: string; author_name: string | null; platform: string }>()
      creator_titles = (results ?? []).map((r) => ({ title: String(r.title).slice(0, 120), author: r.author_name ? String(r.author_name).slice(0, 40) : null, platform: r.platform }))
    }
  } catch { /* fail-soft */ }

  return {
    creator_titles,
    menu,
    max_per_person,
    qty_cap,
    // 🎯 2026-07-01 등록 시 캡처한 place_url (있으면 상세 지도가 직접 연결).
    kakao_place_url: normalizeKakaoPlaceUrl(meta?.kakao_place_url),
    min_review_level,
    prelaunch: meta?.prelaunch === '1',  // 🏷️ 오픈 예정형(상세 배지·구매 CTA 분기)
    onnuri_merchant,
    call_booking: meta?.call_booking === '1',
  }
}
