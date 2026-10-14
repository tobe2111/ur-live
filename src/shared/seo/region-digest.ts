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

import {
  parseRegionFromAddress,
  parseRegionPath,
  addressInRegion,
  regionPath,
  REGION_INDEX_MIN_DEALS,
  type RegionRef,
} from '../constants/region-slugs'
import { REGION_PATH_RE } from './region-seed'

/** 요약이 사는 KV 키. cron(쓰기)과 워커(읽기)가 **같은 상수**를 본다. */
export const REGION_DIGEST_KV_KEY = 'ssr:region-digest'

/**
 * 한 (시/도, 시군구) 묶음에서 담는 행 수.
 *
 * 🕳️ **2026-10-14 — 이 값이 고아 상세 130건을 만들고 있었다.** 라이브 실측(sitemap 제출 상세
 * 360건에 대해 허브 95개의 크롤러 문서에서 `<a href>` 를 전수로 모아 대조): **내부 링크로
 * 도달 가능한 것이 226건**이고 나머지 **134건(`/pass` 130 · `/stays` 4)은 sitemap 으로만**
 * 제출되는 고아였다. 고아 페이지는 내부 링크 가치를 한 푼도 못 받고 크롤도 덜 받는다.
 *
 * 🔢 원인이 숫자로 잡힌다 — (시/도, 시군구) 묶음 **46개 중 8개가 10건을 넘고**(서울/중구 43 ·
 * 경기/파주시 31 · 서울/종로구 27 …) 그 상한이 **101건을 잘라냈다**. 종전 주석은 *"소비자 상한과
 * 맞췄다(ItemList 10 · noscript 8) — 더 담아도 출력이 안 늘고 KV 값만 커진다"* 였는데, 그 말이
 * 맞기 때문에 **두 캡은 함께 올려야 한다**(요약만 올리면 정말로 출력이 안 늘고, noscript 만
 * 올리면 요약에 없는 행을 못 낸다).
 *
 * 📐 **실측(라이브 활성 359행을 진짜 `buildRegionDigest` + `buildStaticSurfaceNoscript` 에 먹여
 * 지역 트리 전수에서 `<a href>` 를 세었다)** — 분포 시뮬레이션은 30/30 에서 334 를 예측했는데
 * 진짜 빌더는 **345** 였다. 요약 행이 **원본 순서를 보존**하므로 시/도 페이지가 한 구에 몰리지
 * 않고 버킷을 자연히 섞어서다(`[...keep.values()]` 의 삽입 순서 = API 순서):
 *
 *     캡      요약 행   요약 바이트   지역 트리 도달   `/region/서울` 링크 · noscript HTML
 *     10/8      258     83,716B       239 / 359       8줄 ·  2,553B   ← 종전
 *     30/30     345    111,740B       345 / 359      30줄 ·  4,305B   ← 채택
 *
 * 남는 14건은 대부분 **색인 임계값(`REGION_INDEX_MIN_DEALS` 3) 미달 시군구**에 있어 그 페이지가
 * `noindex` 다 — 거기서 링크해도 얻는 게 없다. 그래서 **30 이 무릎**이다(50 까지 올려도 시뮬레이션
 * 기준 9 가 남는다). 대가는 지역 페이지 문서당 **약 +1.8KB**(크롤 발견이 일인 허브다).
 *
 * 🔴 **`SURFACE_LIST_MAX`(ItemList 10)는 올리지 않는다.** 두 출력의 일이 다르다 —
 * `ItemList` 는 **리치결과 표시**(구글 캐러셀도 3~10개를 쓴다)이고 그 JSON 은 **사람이 받는
 * 응답에도 그대로 실린다**(2026-10-11 에 20항목 10.3KB 를 10항목 5.4KB 로 내린 그 이유).
 * `<noscript>` 행은 **크롤 발견**이고 사람 브라우저가 렌더조차 하지 않는다.
 */
export const REGION_DIGEST_PER_BUCKET = 30

/**
 * 지역 페이지 `<noscript>` 가 내는 행 수 — 위 묶음 상한과 **짝이다.**
 *
 * ⚠️ 이 값이 `REGION_DIGEST_PER_BUCKET` 보다 크면 **그 초과분은 아무 일도 하지 않는다**(요약에
 * 그만큼이 없다). 반대로 작으면 요약만 커지고 출력이 안 는다. 가드가 둘의 관계를 고정한다.
 * 사진은 행 수와 무관하게 `ROW_IMG_MAX` 로 따로 캡되므로 30행이 사진 30장이 되지 않는다.
 */
export const REGION_NOSCRIPT_ROWS = 30

/**
 * TTL 2시간 — **재빌드 주기(1시간)보다 길어야 한다.** 짧으면 매 시간 사이에 빈 구간이 생기고
 * 그때 지역 페이지가 종전 상태(본문 0자)로 되돌아간다. 길면 cron 이 멎었을 때 2시간 뒤 사라져
 * **종전 동작으로 조용히 내려앉는다**(fail-soft — 틀린 내용을 오래 들고 있지 않는다).
 */
export const REGION_DIGEST_TTL_S = 7200

/**
 * KV 값 상한 — 넘으면 **쓰지 않는다**(값 폭주 방어). 이 값은 플랫폼 한도가 아니라 우리가 세운
 * 방어선이다(Workers KV 값 한도는 25MB).
 *
 * 🔢 2026-10-14 실측(라이브 활성 359행을 진짜 `buildRegionDigest` 에 먹여 바이트를 셌다):
 * 묶음 상한 10 → 30 으로 **행 258 → 345 · 83,716B → 111,740B**(상한의 14% → 19%).
 * 🩸 **이 자리에 한때 "실측 104KB" 라고 적혀 있었고 틀렸다**(실측 83.7KB). 그 틀린 수로 새 크기를
 * 139KB 로 추정해 상한을 600KB 로 올리려 했는데, 재 보니 111.7KB 라 **상향이 불필요했다** ⇒ 되돌렸다.
 * **추정으로 상한을 움직이지 말 것** — 이 파일의 빌더는 그냥 돌려서 잴 수 있다.
 *
 * 🔴 **이 선을 넘으면 조용히 나빠지지 않고 절벽이다** — 아무것도 안 써서 지역 페이지가 본문
 * 0자로 되돌아간다(2026-10-12 에 메운 그 상태). 상품이 두 배(약 720건)가 되면 약 220KB 로
 * 73% 라 아직 걸리지 않지만, **그때는 재서 올릴 것**(추정으로 말고).
 */
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
  // 🔗 2026-10-12: **허브(`/region`)도 받는다** — `regionChildLinks` 가 색인 대상 시/도 링크를
  //   만드는 데 쓴다(종전엔 허브가 요약을 못 받아 크롤러에게 **링크 0개**를 줬다).
  //   `regionThinByDigest` 는 따로 `REGION_PATH_RE` 를 보므로 허브가 noindex 가 되지는 않는다.
  return pathname === '/stays' || pathname === '/region' || REGION_PATH_RE.test(pathname)
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

/**
 * 🪧 2026-10-12 — 요약으로 판정하는 **thin 지역**(`noindex` 를 붙여야 하는가).
 *
 * ## 왜 필요한가 (라이브 실측)
 * `resolveRegionSeo` 는 **DB 를 안 본다**(그 함수 주석이 스스로 적어 둔 한계) → `REGION_INDEX_MIN_DEALS`
 * 게이트가 **클라이언트 렌더에만** 붙는다. 그래서 `/region/인천`·`세종`·`울산` 과 `/region/서울/없는구`
 * 같은 URL 이 **HTTP 200 + `index, follow` + 본문 26자**로 나갔다. `SIGUNGU_RE` 가 *한글+시|군|구* 면
 * 통과시키니 **지어낸 구 이름도 색인 가능**하고, 사실상 무한 thin URL 이다.
 * 종전 방어("thin 지역으로 가는 링크를 아예 만들지 않는다")는 **발견**은 막지만 외부 링크·주소 추측은 못 막는다.
 *
 * ## 왜 조회 없이 되는가
 * cron 이 올려 둔 요약(`REGION_DIGEST_KV_KEY`)을 워커가 지역 경로에서 **이미 읽는다** ⇒ DB 조회 0.
 * 세는 방법은 화면·`ItemList` 와 **같은 SSOT**(`addressInRegion`)다 — 손으로 주소를 파싱하면 갈린다.
 *
 * ## 🔴 요약이 없으면 **절대** noindex 하지 않는다
 * 데이터 부재는 thin 이 아니다. KV miss·cron 전·파싱 실패·빈 요약은 전부 `false` 로 떨어진다.
 * 이 방향이 뒤집히면 **배포 직후 지역 44개가 통째로 색인에서 빠지고**, 색인은 돌아오는 데 수주 걸린다.
 *
 * ⚠️ 호출부는 `crawlerPayload`(= 요약 **또는** MAIN 시드)가 아니라 **요약 원본**을 넘겨야 한다 —
 *    둘은 봉투 모양이 같아서(`{success,data:[]}`) 여기서 구분할 수 없고, MAIN 시드(1페이지 50건)를
 *    넘기면 그 분포대로 **멀쩡한 지역이 thin 으로 판정된다**(경기 49건인데 시드엔 0건이었다).
 * ⚠️ 묶음 상한(`REGION_DIGEST_PER_BUCKET`)은 거짓 thin 을 만들 수 없다 — 상한에 걸릴 만큼 많으면
 *    이미 10 ≥ 3 이다.
 */
export function regionThinByDigest(pathname: string, digestJson: string | null | undefined): boolean {
  if (!digestJson) return false
  if (!REGION_PATH_RE.test(pathname)) return false
  const seg = pathname.replace(/\/+$/, '').split('/')
  let ref: RegionRef | null = null
  try {
    ref = parseRegionPath(decodeURIComponent(seg[2] || ''), seg[3] ? decodeURIComponent(seg[3]) : undefined)
  } catch {
    return false
  }
  // 허브(`/region`)와 모르는 시/도는 각자 다른 규칙이 본다(리졸버가 이미 noindex 를 준다).
  if (!ref) return false
  const rows = digestRowsOf(digestJson)
  // 요약이 비었다 = cron 이 아직 못 돌았다(= 부재). 역시 noindex 하지 않는다.
  if (!rows.length) return false
  let n = 0
  for (const r of rows) {
    if (Number(r?.deal_only) === 1) continue
    if (addressInRegion(r?.restaurant_address || r?.business_address, ref)) n++
  }
  return n < REGION_INDEX_MIN_DEALS
}

/**
 * 🔗 2026-10-12 — 지역 트리의 **자식 링크**(허브 → 시/도 → 시군구).
 *
 * **왜 있나(라이브 실측 — Googlebot UA 로 서버 HTML 의 `<a href>` 를 셌다)**: 색인 대상 지역이
 * **43~44개**인데 그 트리로 들어가는 **내부 링크가 0개**였다. 허브 `/region` 은 본문 120자에
 * a태그 **0**, 시/도 페이지도 자기 상품만 링크하고 **자식 시군구로 가는 길이 없었다.**
 * ⇒ 그 44개가 **sitemap 으로만** 발견되고 내부 링크 가치는 0 이다. JS 를 렌더하는 Googlebot 은
 * 화면의 링크를 보지만 **Yeti(네이버)·AI 검색봇은 이 문서가 전부**다.
 *
 * 🔑 **링크는 색인 대상만 낸다.** 판정은 `regionThinByDigest` 와 **같은 데이터·같은 술어**
 * (`addressInRegion` + `REGION_INDEX_MIN_DEALS`)라, *"링크한다"* ⟺ *"thin 이 아니다"* 가
 * 구조적으로 보장된다 — thin 지역을 링크하면 **색인 말라고 한 URL 로 크롤 예산이 빠진다**
 * (오늘 교환권 상세·facet 에서 반복해 피한 그 모순이다).
 *
 * 🔴 **요약이 없으면 링크를 만들지 않는다** — 부재는 "없다" 가 아니다. 지어낸 링크는 404 를
 * 가리키게 되고, 그건 아무 링크도 없는 것보다 나쁘다.
 */
export function regionChildLinks(
  pathname: string,
  digestJson: string | null | undefined,
): Array<{ label: string; href: string }> {
  if (!digestJson) return []
  const clean = pathname.replace(/\/+$/, '') || '/'
  const seg = clean.split('/')
  // 허브(`/region`) 또는 시/도 한 단계(`/region/서울`)만. 시군구는 잎이라 자식이 없다.
  if (seg[1] !== 'region' || seg.length > 3) return []
  let parent: RegionRef | null = null
  if (seg.length === 3) {
    try {
      parent = parseRegionPath(decodeURIComponent(seg[2] || ''))
    } catch {
      return []
    }
    if (!parent || parent.sigungu) return []
  }

  // 🔑 **요약이 없으면 링크가 구조적으로 0 이다** — 아래 루프가 행에서만 후보를 만든다.
  //   그래서 `if (!rows.length) return []` 같은 방어를 따로 두지 않았다: 중복 잠금은 각 잠금을
  //   시험 불가능하게 만든다(주입이 *"요약이 없어도 링크를 만든다"* 를 심었는데 통과했다 —
  //   루프가 이미 0 을 내기 때문이다). 지금 위험한 방향은 **없는 데이터로 전국 목록을 지어내는
  //   폴백을 넣는 것**이고, 그쪽을 주입이 지킨다.
  const rows = digestRowsOf(digestJson)

  // 후보를 모은다 — 주소 파싱은 `buildRegionDigest` 와 **같은 함수**다(두 벌이면 갈린다).
  //   ⚠️ 여기서 교환권을 거르지 **않는다**: 거르는 자리는 아래 세는 루프 하나다(같은 규칙을 두 군데
  //   두면 한쪽을 지워도 결과가 같아 **어느 쪽도 출력으로 판정할 수 없다**). 후보로 올라와도
  //   세는 값이 0 이면 자연히 빠진다.
  const cands = new Map<string, RegionRef>()
  for (const r of rows) {
    const ref = parseRegionFromAddress(r?.restaurant_address || r?.business_address)
    if (!ref) continue
    if (parent) {
      if (ref.sido !== parent.sido || !ref.sigungu) continue
      cands.set(`${ref.sido}\u0000${ref.sigungu}`, { sido: ref.sido, sigungu: ref.sigungu })
    } else {
      cands.set(ref.sido, { sido: ref.sido })
    }
  }

  const out: Array<{ label: string; href: string }> = []
  for (const ref of cands.values()) {
    // 세는 방법을 `regionThinByDigest` 와 똑같이 — 그래야 링크 집합이 색인 집합과 같다.
    let n = 0
    for (const r of rows) {
      if (Number(r?.deal_only) === 1) continue
      if (addressInRegion(r?.restaurant_address || r?.business_address, ref)) n++
    }
    if (n < REGION_INDEX_MIN_DEALS) continue
    // 🔗 2026-10-13: 조립은 `regionPath` **한 곳** — canonical·sitemap·빵부스러기와 같은 함수다.
    const href = regionPath(ref)
    out.push({ label: ref.sigungu || ref.sido, href })
    // ⚠️ 상한 — `<noscript>` 는 **사람이 받는 응답에도 그대로 실린다**(크롤러 전용은 가이드 위반).
    if (out.length >= 17) break
  }
  return out
}
