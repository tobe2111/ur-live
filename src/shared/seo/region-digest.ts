/**
 * 🗺️ 2026-10-12 — **지역 착지 페이지가 색인 대상인데 본문이 비어 있던 것**을 메우는 요약 캐시.
 *
 * 대표 *"내 판단이 필요한 3가지 모두 가장 이상적으로 해줄 수 없어?"* 의 ①.
 *
 * ## 무엇이 문제였나 (라이브 전수 실측 — 활성 359건을 `limit=100` 4페이지로 받아 파싱해 셌다)
 *
 * `/region/*` 은 **시/도 11곳 + 시군구 32곳 = 43개가 색인 대상**이다(`REGION_INDEX_MIN_DEALS` 3 이상).
 * 그런데 그 표면의 시드는 **홈과 같은 캐시 키**(`MAIN_SEED_PATH`)를 쓰고 그 응답은 **1페이지 50건**
 * 이다. 50건의 지역 분포가 `서울 44 · 강원 3 · 전북 1 · 부산 1 · 경북 1` 이라 —
 *
 *   색인 대상 11곳 중 **6곳**(경기 49건 · 전남 24 · 충남 16 · 제주 8 · 대구 8 · 충북 8)이
 *   **본문 0자 · `ItemList` 0건**으로 나간다. 딜이 49건 있는 경기도 그렇다.
 *
 * 즉 "상품이 없어서 빈" 것이 아니라 **있는데 시드에 안 담겨서 빈** 것이다. 그래서 색인은 되고
 * (게이트를 통과하니까) 내용은 없다 — 구글이 thin content 로 보는 모양 그대로다. **에러가 안 나고
 * 화면도 안 깨져서** 재 본 사람만 안다(처음엔 이것을 "설계의 대가" 로 보고했다 — 틀렸다).
 *
 * ## 왜 요약 캐시인가 (버린 길들, 각각의 이유)
 *
 * - **지역별 캐시 키 44개** — `HOT_PATHS` 가 44칸 늘어 예열 예산(서브리퀘스트 무료 50/인보케이션,
 *   실측 ~49)을 깨고 KV 쓰기도 하루 4,224건(한도 1,000)이 된다.
 * - **`MAIN_SEED_PATH` 의 limit 을 올린다** — 그 키는 **홈이 받는 응답**이다. 홈 HTML 이 46→101KB 가
 *   되는데 그 비용은 지역 페이지를 안 보는 사람 전부가 낸다.
 * - **서버의 휴면 `region` 파라미터**(2026-06-18) — 그쪽은 `product_regions` + 행정동 코드로 재는
 *   **다른 지역 체계**다(여기는 주소 텍스트 파싱). 게다가 키가 지역마다 갈려 위와 같은 폭발이 난다.
 * - **요청마다 4페이지 self-fetch** — 크롤러 요청 하나가 콜드 D1 네 번이 된다.
 *
 * ⇒ cron 이 **하루 24번, 한 키에** 미리 접어 두고 워커는 그걸 읽는다. KV 호출은 서브리퀘스트로
 *   세지 않고(바인딩), 워커는 **SSR 시드 획득과 병렬**로 읽으므로 응답이 늦어지지 않는다.
 *
 * ## 🔴 두 가지 규율
 *
 * 1. **사람이 받는 응답에는 안 들어간다.** 이 요약은 `<noscript>` 본문(최대 8줄)과 `ItemList`
 *    (최대 10항목)를 **만드는 입력**일 뿐이고 그 출력은 종전과 같은 상한을 지킨다. 주입
 *    (`__SSR_INITIAL_MAIN__`)은 **원래 MAIN 시드 그대로** — 여기 행은 필드를 깎았으므로 React 가
 *    그걸 `initialData` 로 먹으면 카드가 깨진다(워커의 변수를 따로 두는 이유가 이것이다).
 * 2. **지어내지 않는다.** 행은 API 응답에서 **필드만 골라** 담고, 지역 판정은 화면과 **같은 SSOT**
 *    (`parseRegionFromAddress`)로 한다. 손으로 주소를 파싱하면 화면과 갈려 다른 동네 가게가 섞인다.
 */

import { parseRegionFromAddress } from '../constants/region-slugs'
import { REGION_PATH_RE } from './region-seed'

/** 요약이 사는 KV 키. cron(쓰기)과 워커(읽기)가 **같은 상수**를 본다. */
export const REGION_DIGEST_KV_KEY = 'ssr:region-digest'

/**
 * 한 (시/도, 시군구) 묶음에서 담는 행 수.
 *
 * 소비자 상한과 맞췄다 — `ItemList` 10항목(`SURFACE_LIST_MAX`) · `<noscript>` 8줄. 더 담아도
 * 출력이 안 늘고 KV 값만 커진다. 시군구 페이지가 이 상한으로 꽉 차고, 시/도 페이지는 그 시/도의
 * 모든 묶음을 합쳐 보므로 자연히 더 많이 고를 수 있다.
 */
export const REGION_DIGEST_PER_BUCKET = 10

/**
 * TTL 2시간 — **재빌드 주기(1시간)보다 길어야 한다.** 짧으면 매 시간 사이에 빈 구간이 생기고
 * 그때 지역 페이지가 종전 상태(본문 0자)로 되돌아간다. 길면 cron 이 멎었을 때 2시간 뒤 사라져
 * **종전 동작으로 조용히 내려앉는다**(fail-soft — 틀린 내용을 오래 들고 있지 않는다).
 */
export const REGION_DIGEST_TTL_S = 7200

/** KV 값 상한 — 실측 104KB(행 258). 넘으면 쓰지 않는다(값 폭주 방어). */
export const REGION_DIGEST_MAX_BYTES = 300_000

/**
 * 담는 필드 — **두 소비자가 실제로 읽는 것의 합집합**이고 그 이상은 담지 않는다.
 *
 *   `crawler-noscript` → name · restaurant_name · brand_name · category · restaurant_address
 *                        · business_address · price · original_price · discount_rate · deal_only
 *   `surface-list-jsonld` → id · image_url · current_price · avg_rating · review_count (+위 일부)
 *
 * ⚠️ `slug` 는 **일부러 뺀다** — 2026-10-12 #1712 가 "데모인 것을 티내지 않는다" 로 공개 응답에서
 *    지운 필드다. 여기로 되살리면 그 작업이 조용히 무효가 된다.
 */
export const REGION_DIGEST_FIELDS = [
  'id', 'name', 'restaurant_name', 'brand_name', 'category',
  'restaurant_address', 'business_address',
  'price', 'current_price', 'original_price', 'discount_rate', 'deal_only',
  'image_url', 'avg_rating', 'review_count',
] as const

export interface DigestRow {
  id?: number | string
  name?: string | null
  category?: string | null
  restaurant_address?: string | null
  business_address?: string | null
  deal_only?: number | string | null
  [k: string]: unknown
}

/** 이 경로가 요약을 쓰는가 — 지역 착지 페이지와 `/stays`(자기 슬롯이 없어 홈 시드를 쓴다). */
export function regionDigestApplies(pathname: string): boolean {
  return pathname === '/stays' || REGION_PATH_RE.test(pathname)
}

/** 응답 봉투(배열 / `{products}`) 둘 다 받는다 — 표면마다 모양이 다르다. */
export function digestRowsOf(payload: string | null | undefined): DigestRow[] {
  if (!payload) return []
  try {
    const d = JSON.parse(payload) as { data?: DigestRow[] | { products?: DigestRow[] } }
    const arr = Array.isArray(d?.data) ? d.data : d?.data?.products
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function prune(row: DigestRow): DigestRow {
  const out: Record<string, unknown> = {}
  for (const f of REGION_DIGEST_FIELDS) {
    const v = (row as Record<string, unknown>)[f]
    if (v !== undefined && v !== null) out[f] = v
  }
  return out as DigestRow
}

/**
 * 행들 → 요약 JSON 문자열(소비자가 받는 봉투와 같은 모양).
 *
 * (시/도, 시군구) 묶음마다 앞에서 `REGION_DIGEST_PER_BUCKET` 개까지, 그리고 **숙소 묶음**을 따로
 * 담는다(`/stays` 가 `category === 'stay_voucher'` 로 걸러 쓰는데, 지역 묶음 상한에 걸려 숙소가
 * 적게 남을 수 있다). 교환권(`deal_only=1`)은 매장이 없어 지역 묶음에서 제외한다 —
 * 그 상세는 noindex 라 `ItemList` 에서도 어차피 걸러진다.
 *
 * 순서는 **입력 순서를 보존**한다(서버가 정한 노출 순서 = 데모 후순위 정책이 살아 있는 순서다).
 * 여기서 다시 정렬하면 그 정책과 갈린다.
 */
export function buildRegionDigest(rows: readonly DigestRow[]): string {
  const buckets = new Map<string, number>()
  const keep = new Map<string, DigestRow>()
  let stays = 0
  for (const row of rows) {
    const id = row?.id
    if (id == null) continue
    const key = String(id)
    const isStay = row?.category === 'stay_voucher'
    if (isStay && stays < REGION_DIGEST_PER_BUCKET) {
      stays++
      if (!keep.has(key)) keep.set(key, prune(row))
    }
    if (Number(row?.deal_only) === 1) continue
    const ref = parseRegionFromAddress(row?.restaurant_address || row?.business_address)
    if (!ref) continue
    const bucket = `${ref.sido}\u0000${ref.sigungu || ''}`
    const n = buckets.get(bucket) || 0
    if (n >= REGION_DIGEST_PER_BUCKET) continue
    buckets.set(bucket, n + 1)
    if (!keep.has(key)) keep.set(key, prune(row))
  }
  return JSON.stringify({ success: true, data: [...keep.values()] })
}
