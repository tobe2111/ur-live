/**
 * 🏪 매장 프로필 단일화 SSOT (2026-08-23 대표 "그냥 지금 하자 끝까지 신중하게")
 *
 * ## 문제 — "매장"이 두 곳에 산다
 *   ① sellers 행(+seller_meta) = 매장 계정(좌석·정산·매장 관리)
 *   ② products.restaurant_* = 이용권마다 **복사**된 매장 정보 (소비자 상세·지도·알림톡이 읽음)
 *   → 매장 전화번호가 바뀌면 상품 N개가 제각각. 이 모듈이 그 드리프트를 구조적으로 끝낸다.
 *
 * ## 방식 — 참조 재작성(빅뱅)이 아니라 **canonical + 쓰기 시 전파**
 *   - canonical = seller_meta 의 `store_*` 키 (sellers 본체는 100컬럼 한도 — ALTER 금지)
 *   - 매장 프로필을 수정하면 그 매장 상품들의 복사본을 **한 UPDATE 로 동기화** → 읽는 쪽
 *     (소비자 상세·지도·SSR·캐시)은 한 줄도 안 바꾼다. 복사본이 곧 canonical 의 물질화가 된다.
 *   - 상품 등록 시엔 역방향 채택(fill-if-empty) — 첫 등록이 곧 매장 프로필이 된다.
 *
 * ## 신중 노트 (지키지 않으면 사고)
 *   - 전파는 반드시 `WHERE seller_id = ?` 로 스코프 — 빠지면 남의 매장 상품까지 덮는다.
 *   - 전파는 `restaurant_name` 이 이미 있는 상품만 — 쇼핑 상품에 매장 필드를 새로 만들지 않는다.
 *   - PIN(store_verify_pin)은 **비어 있지 않을 때만** 전파 — 빈 값 전파는 매장 검증
 *     (2026-07-03 부정사용 방어)을 조용히 무장해제한다. 채택(adopt)은 fill-if-empty 만 —
 *     상품 단위 수정이 매장 프로필을 덮으면 안 된다.
 */
import { getSellerMeta, setSellerMeta } from './seller-meta'
// ⚠️ worker 는 `@/` alias 를 못 쓴다(상대경로 필수). 역할 판정은 SSOT 헬퍼만 — 직접 비교는 `both`(매장 겸업)를 놓친다.
import { isStoreOwner } from '../../shared/seller-roles'

export interface StoreProfile {
  name: string
  address: string
  phone: string
  lat: string
  lng: string
  kakao_place_url: string
  verify_pin: string
  category: string
}

export interface StoreProfileSources {
  /** 가장 최근 상품의 복사본 — 전파가 돌기 시작하면 항상 canonical 과 같거나 더 새롭다. */
  product?: {
    restaurant_name?: unknown; restaurant_address?: unknown; restaurant_phone?: unknown
    restaurant_lat?: unknown; restaurant_lng?: unknown; store_verify_pin?: unknown; category?: unknown
  } | null
  /** seller_meta store_* — 매장 관리에서 편집하는 canonical. */
  meta?: Record<string, string> | null
  /** sellers 행 — 마지막 폴백(사업자 등록 정보). */
  seller?: { name?: unknown; business_name?: unknown; phone?: unknown; address?: unknown } | null
}

const s = (v: unknown) => (v == null ? '' : String(v))

/**
 * 세 소스를 한 프로필로 병합 — 우선순위: 최근 상품 > seller_meta > sellers 행.
 * 상품이 먼저인 이유: 전파가 상품 복사본을 항상 canonical 로 갱신하고, 위저드에서의
 * 상품 단위 수정은 복사본을 더 신선하게 만들기 때문에 "최근 상품 ≥ meta" 가 불변이다.
 */
export function mergeStoreProfile(src: StoreProfileSources): StoreProfile {
  const p = src.product || {}
  const m = src.meta || {}
  const sel = src.seller || {}
  return {
    name: s(p.restaurant_name) || s(m.store_name) || s(sel.business_name) || s(sel.name),
    address: s(p.restaurant_address) || s(m.store_address) || s(sel.address),
    phone: s(p.restaurant_phone) || s(m.store_phone) || s(sel.phone),
    lat: s(p.restaurant_lat) || s(m.store_lat),
    lng: s(p.restaurant_lng) || s(m.store_lng),
    kakao_place_url: s(m.kakao_place_url),
    verify_pin: s(p.store_verify_pin) || s(m.store_verify_pin),
    category: s(p.category),
  }
}

export interface StoreProfilePatch {
  name?: string
  address?: string
  phone?: string
  lat?: string
  lng?: string
  /** ⚠️ 비어 있지 않을 때만 저장·전파 — 빈 문자열로 PIN 을 지우는 동작은 지원하지 않는다(위 신중 노트). */
  verify_pin?: string
  kakao_place_url?: string
}

/** 그 매장의 최근 상품 1건 — 프로필 병합용 (stores/context 와 profile GET 이 공유). */
export async function loadLatestProductCopy(DB: D1Database, sellerId: number) {
  return DB.prepare(
    `SELECT restaurant_name, restaurant_address, restaurant_phone, restaurant_lat, restaurant_lng, store_verify_pin, category
       FROM products
      WHERE seller_id = ? AND restaurant_name IS NOT NULL AND restaurant_name != ''
      ORDER BY id DESC LIMIT 1`
  ).bind(sellerId).first<{
    restaurant_name: string | null; restaurant_address: string | null; restaurant_phone: string | null
    restaurant_lat: number | string | null; restaurant_lng: number | string | null
    store_verify_pin: string | null; category: string | null
  }>().catch(() => null)
}

/**
 * 매장 프로필 저장 + 그 매장 상품 복사본 **일괄 전파**.
 * 반환 propagated = 동기화된 상품 수. 머니 경로 무접촉(표시/검증 데이터만).
 */
export async function saveStoreProfileAndPropagate(
  DB: D1Database,
  sellerId: number,
  patch: StoreProfilePatch,
): Promise<{ propagated: number }> {
  const clean = (v: string | undefined, max: number) => {
    const t = typeof v === 'string' ? v.trim().slice(0, max) : undefined
    return t === undefined ? undefined : t
  }
  const name = clean(patch.name, 100)
  const address = clean(patch.address, 200)
  const phone = clean(patch.phone, 20)
  const lat = clean(patch.lat, 20)
  const lng = clean(patch.lng, 20)
  const pin = clean(patch.verify_pin, 20)
  const placeUrl = clean(patch.kakao_place_url, 300)

  // 1) canonical(seller_meta store_*) — 제공된 비어있지 않은 값만 upsert(삭제 없음).
  const metaPatch: Record<string, string> = {}
  if (name) metaPatch.store_name = name
  if (address) metaPatch.store_address = address
  if (phone) metaPatch.store_phone = phone
  if (lat) metaPatch.store_lat = lat
  if (lng) metaPatch.store_lng = lng
  if (pin) metaPatch.store_verify_pin = pin
  if (placeUrl) metaPatch.kakao_place_url = placeUrl
  if (Object.keys(metaPatch).length > 0) await setSellerMeta(DB, sellerId, metaPatch)

  // 2) sellers 행 미러(표시 라벨용) — 제공된 값만. 매장 관리 목록·전환 칩이 business_name 을 읽는다.
  const selSet: string[] = []
  const selBinds: unknown[] = []
  if (name) { selSet.push('business_name = ?'); selBinds.push(name) }
  if (phone) { selSet.push('phone = ?'); selBinds.push(phone) }
  if (address) { selSet.push('address = ?'); selBinds.push(address) }
  if (selSet.length > 0) {
    await DB.prepare(
      `UPDATE sellers SET ${selSet.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).bind(...selBinds, sellerId).run().catch(() => { /* 미러 실패가 프로필 저장을 막지 않는다 */ })
  }

  // 3) 전파 — 이 매장(seller_id) 소유이면서 이미 매장 복사본을 가진 상품만 동기화.
  const set: string[] = []
  const binds: unknown[] = []
  if (name) { set.push('restaurant_name = ?'); binds.push(name) }
  if (address) { set.push('restaurant_address = ?'); binds.push(address) }
  if (phone) { set.push('restaurant_phone = ?'); binds.push(phone) }
  if (lat) { set.push('restaurant_lat = ?'); binds.push(parseFloat(lat) || null) }
  if (lng) { set.push('restaurant_lng = ?'); binds.push(parseFloat(lng) || null) }
  if (pin) { set.push('store_verify_pin = ?'); binds.push(pin) }
  if (set.length === 0) return { propagated: 0 }
  const r = await DB.prepare(
    `UPDATE products SET ${set.join(', ')}, updated_at = datetime('now')
      WHERE seller_id = ? AND restaurant_name IS NOT NULL AND restaurant_name != ''`
  ).bind(...binds, sellerId).run()
  return { propagated: Number(r.meta?.changes) || 0 }
}

/**
 * 역방향 채택 — 상품 등록이 준 매장 정보로 **비어 있는** 프로필 키만 채운다.
 * 첫 이용권 등록 = 매장 프로필 생성. 이미 값이 있으면 절대 덮지 않는다(상품 단위 자유 보존).
 * 호출측은 fail-soft 로 감쌀 것 — 채택 실패가 상품 등록을 막으면 안 된다.
 */
export async function adoptStoreProfileFromProduct(
  DB: D1Database,
  sellerId: number,
  f: { restaurant_name?: unknown; restaurant_address?: unknown; restaurant_phone?: unknown
       restaurant_lat?: unknown; restaurant_lng?: unknown; store_verify_pin?: unknown },
): Promise<void> {
  if (!s(f.restaurant_name)) return
  const meta = (await getSellerMeta(DB, [sellerId])).get(sellerId) || {}
  const patch: Record<string, string> = {}
  const fill = (key: string, v: unknown) => { if (!meta[key] && s(v)) patch[key] = s(v).slice(0, 200) }
  fill('store_name', f.restaurant_name)
  fill('store_address', f.restaurant_address)
  fill('store_phone', f.restaurant_phone)
  fill('store_lat', f.restaurant_lat)
  fill('store_lng', f.restaurant_lng)
  fill('store_verify_pin', f.store_verify_pin)
  if (Object.keys(patch).length > 0) await setSellerMeta(DB, sellerId, patch)
}

/**
 * 🔒 등록 시 매장 필드를 **좌석의 canonical** 로 확정 (2026-09-15 대표 "매장을 등록해야 그 매장에 맞는 이용권만 만들지").
 *
 * ## 무엇을 막는가 — 상호와 귀속이 갈리는 사고
 *   이용권↔매장 결합의 유일한 키는 `products.seller_id`(= 제출 순간 앉아 있던 좌석)인데, 폼의
 *   상호·주소·좌표는 **검증 없는 텍스트 복사본**으로 따로 저장된다. 그래서 좌석 A 에 앉아 매장 B 의
 *   상호를 타이핑하면 **소비자에겐 B 로 보이고 정산·주문·통계는 A 로 가는** 상품이 만들어진다.
 *   서버는 그 둘을 한 번도 대조하지 않았다(등록 핸들러 전체에 대조 로직 0).
 *
 * ## 방식 — 막지 않고 **정정**한다 (fail-open)
 *   canonical 이 있으면 폼 값을 무시하고 canonical 로 덮는다. 400 으로 막지 않는 이유: 매장명 표기가
 *   조금만 달라도(지점명·띄어쓰기) 정상 등록이 통째로 막힌다 — 이 레포가 반복해 당한 lock-out 클래스다.
 *   정정은 조용히 하지 않는다: 바뀐 필드 이름을 `corrected` 로 돌려줘 호출부가 로그를 남긴다.
 *
 * ## canonical 판정 — 명시적 신호만 신뢰
 *   `seller_meta.store_name`(첫 이용권 등록이 채운 값) → **`seller_type='store_owner'` 인 좌석의**
 *   `business_name`/`name`(매장 등록이 채운 값). 개인 셀러 계정의 `name` 은 사람 이름일 수 있어
 *   매장명으로 쓰지 않는다 ⇒ 매장 프로필이 없는 좌석은 **영향 0**(폼 값 그대로, adopt 가 프로필을 만든다).
 *
 * ⚠️ 좌표·주소·전화는 canonical 에 **값이 있을 때만** 덮는다. 없으면 폼 값을 살린다 —
 *    지도에서 처음 고른 좌표가 프로필에 없다는 이유로 버려지면 소비자 지도에서 사라진다.
 * ⚠️ PIN 은 건드리지 않는다(위 신중 노트 — 매장 검증 무장해제 방지).
 */
export async function resolveStoreFieldsForProduct(
  DB: D1Database,
  sellerId: number,
  body: { restaurant_name?: unknown; restaurant_address?: unknown; restaurant_phone?: unknown
          restaurant_lat?: unknown; restaurant_lng?: unknown },
): Promise<{ fields: Record<string, string>; corrected: string[] }> {
  const empty = { fields: {}, corrected: [] as string[] }
  const meta = await getSellerMeta(DB, [sellerId]).then((m) => m.get(sellerId) || {}).catch(() => null)
  if (meta === null) return empty // 조회 실패 — 폼 값 그대로(등록을 막지 않는다)
  const seller = await DB.prepare(
    `SELECT name, business_name, phone, address, seller_type FROM sellers WHERE id = ?`
  ).bind(sellerId).first<{
    name: string | null; business_name: string | null; phone: string | null
    address: string | null; seller_type: string | null
  }>().catch(() => null)

  const isStore = isStoreOwner(seller?.seller_type)
  const name = s(meta.store_name) || (isStore ? s(seller?.business_name) || s(seller?.name) : '')
  if (!name) return empty // 매장 프로필 없음 = 첫 등록 — adopt(fill-if-empty)가 이 값을 프로필로 승격시킨다

  const canonical: Record<string, string> = { restaurant_name: name }
  const put = (key: string, v: string) => { if (v) canonical[key] = v }
  put('restaurant_address', s(meta.store_address) || (isStore ? s(seller?.address) : ''))
  put('restaurant_phone', s(meta.store_phone) || (isStore ? s(seller?.phone) : ''))
  put('restaurant_lat', s(meta.store_lat))
  put('restaurant_lng', s(meta.store_lng))

  const corrected: string[] = []
  for (const [k, v] of Object.entries(canonical)) {
    const given = s((body as Record<string, unknown>)[k])
    if (given && given !== v) corrected.push(k)
  }
  return { fields: canonical, corrected }
}
