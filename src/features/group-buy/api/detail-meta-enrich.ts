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
}

export async function buildDetailMeta(
  DB: D1Database, id: number | string, metaMap: MetaMap, sellerId: unknown,
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

  return {
    menu,
    max_per_person,
    qty_cap,
    // 🎯 2026-07-01 등록 시 캡처한 place_url (있으면 상세 지도가 직접 연결).
    kakao_place_url: normalizeKakaoPlaceUrl(meta?.kakao_place_url),
    min_review_level,
    prelaunch: meta?.prelaunch === '1',  // 🏷️ 오픈 예정형(상세 배지·구매 CTA 분기)
    onnuri_merchant,
  }
}
