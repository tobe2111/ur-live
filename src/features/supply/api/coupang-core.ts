/**
 * 🛒 2026-06-12 쿠팡 오픈API(Wing) 연동 코어 (사용자 요청 — "쿠팡 API도 이상적으로").
 *
 *   모델: 판매사/제조사가 Wing(판매자센터 → 판매자정보 → 추가판매정보 → OPEN API 키)에서
 *   발급한 access key / secret key / 업체코드(vendorId, A로 시작)를 연결 — 네이버와 동일한
 *   "각자 키" 구조. 플랫폼 차원 키 불필요.
 *
 *   인증: HMAC-SHA256 전자서명 (Web Crypto — 의존성 0)
 *     signed-date = yyMMdd'T'HHmmss'Z' (UTC)
 *     message     = signedDate + method + path + query(? 제외)
 *     Authorization: CEA algorithm=HmacSHA256, access-key=.., signed-date=.., signature=hex(..)
 *
 *   ⚠️ 엔드포인트 경로는 공식 문서 기준으로 상수화(COUPANG_PATHS) — 실계정 E2E 1회로 검증 필요.
 *   에러는 쿠팡 응답 메시지를 그대로 표면화(필드 단위 거절 사유가 친절한 편).
 *   보안: secret key 는 encryptAtRest(AES-GCM) 저장. 외부 fetch 는 api-gateway.coupang.com 고정.
 */
import { encryptAtRest, decryptAtRest } from '@/worker/utils/data-crypto'
import { swallow } from '@/worker/utils/swallow'
import type { ChannelOwner } from './naver-commerce-core'

export const COUPANG_HOST = 'api-gateway.coupang.com'

// 경로 상수 — 문서 변경/검증 시 여기만 수정.
export const COUPANG_PATHS = {
  outboundPlaces: '/v2/providers/marketplace_openapi/apis/api/v1/vendor/shipping-place/outbound',
  returnCenters: (vendorId: string) => `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/returnShippingCenters`,
  categoryPredict: '/v2/providers/openapi/apis/api/v1/categorization/predict',
  categoryMeta: (code: string) => `/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/${code}`,
  products: '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products',
  productDetail: (id: string) => `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${id}`,
} as const

// ── 스키마 ────────────────────────────────────────────────────────────────
const _schemaDone = new WeakSet<object>()
export async function ensureCoupangConnectionSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS coupang_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_type TEXT NOT NULL DEFAULT 'distributor',
    owner_id INTEGER NOT NULL,
    access_key TEXT NOT NULL,
    secret_key_enc TEXT NOT NULL,
    vendor_id TEXT NOT NULL,
    vendor_user_id TEXT,
    connected_at DATETIME DEFAULT (datetime('now')),
    last_verified_at DATETIME,
    last_export_at DATETIME,
    UNIQUE(owner_type, owner_id)
  )`).run().catch(swallow('coupang:schema'))
  await DB.prepare(`CREATE TABLE IF NOT EXISTS coupang_product_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    coupang_product_id TEXT,
    sale_price INTEGER,
    status TEXT DEFAULT 'created',
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(owner_id, product_id)
  )`).run().catch(swallow('coupang:schema-exports'))
}

// ── HMAC 서명 (순수 — 테스트 가능) ───────────────────────────────────────
/** UTC yyMMdd'T'HHmmss'Z' — 쿠팡 signed-date 형식. */
export function coupangSignedDate(d = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

export async function coupangSign(secretKey: string, signedDate: string, method: string, path: string, query = ''): Promise<string> {
  const message = `${signedDate}${method}${path}${query}`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function coupangAuthHeader(accessKey: string, secretKey: string, method: string, path: string, query = '', date = new Date()): Promise<string> {
  const signedDate = coupangSignedDate(date)
  const signature = await coupangSign(secretKey, signedDate, method, path, query)
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`
}

// ── 연결 CRUD ────────────────────────────────────────────────────────────
export interface CoupangConnection { access_key: string; secret_key: string; vendor_id: string; vendor_user_id: string | null }

export async function loadCoupangConnection(DB: D1Database, ownerId: number, kek: string | undefined, ownerType: ChannelOwner = 'distributor'): Promise<CoupangConnection | null> {
  await ensureCoupangConnectionSchema(DB)
  const row = await DB.prepare('SELECT access_key, secret_key_enc, vendor_id, vendor_user_id FROM coupang_connections WHERE owner_type = ? AND owner_id = ?')
    .bind(ownerType, ownerId).first<{ access_key: string; secret_key_enc: string; vendor_id: string; vendor_user_id: string | null }>().catch(() => null)
  if (!row) return null
  try {
    const secret = await decryptAtRest(row.secret_key_enc, kek)
    return { access_key: row.access_key, secret_key: secret, vendor_id: row.vendor_id, vendor_user_id: row.vendor_user_id }
  } catch { return null }
}

export async function saveCoupangConnection(
  DB: D1Database, ownerId: number, accessKey: string, secretKey: string, vendorId: string, vendorUserId: string | null,
  kek: string | undefined, ownerType: ChannelOwner = 'distributor',
): Promise<void> {
  await ensureCoupangConnectionSchema(DB)
  const enc = await encryptAtRest(secretKey, kek)
  await DB.prepare(`
    INSERT INTO coupang_connections (owner_type, owner_id, access_key, secret_key_enc, vendor_id, vendor_user_id, last_verified_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(owner_type, owner_id) DO UPDATE SET access_key = excluded.access_key,
      secret_key_enc = excluded.secret_key_enc, vendor_id = excluded.vendor_id,
      vendor_user_id = excluded.vendor_user_id, last_verified_at = datetime('now')
  `).bind(ownerType, ownerId, accessKey, enc, vendorId, vendorUserId).run()
}

// ── 인증 fetch ───────────────────────────────────────────────────────────
export async function coupangFetch(
  conn: CoupangConnection, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string,
  opts?: { query?: string; body?: unknown },
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const query = opts?.query || ''
  const auth = await coupangAuthHeader(conn.access_key, conn.secret_key, method, path, query)
  const url = `https://${COUPANG_HOST}${path}${query ? `?${query}` : ''}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: auth,
      'content-type': 'application/json;charset=UTF-8',
      'X-EXTENDED-TIMEOUT': '90000',
    },
    body: opts?.body != null ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null)
  if (!res) return { ok: false, status: 0, data: null, error: '쿠팡 API 호출 실패 (네트워크)' }
  const data = await res.json().catch(() => null)
  const d = data as { code?: string | number; message?: string; errorMessage?: string } | null
  // 쿠팡은 HTTP 200 + body.code 로 실패를 주는 경우가 있음 — 둘 다 검사.
  const bodyFail = d?.code != null && String(d.code) !== '200' && String(d.code).toUpperCase() !== 'SUCCESS'
  if (!res.ok || bodyFail) {
    return { ok: false, status: res.status, data, error: d?.message || d?.errorMessage || `쿠팡 API 오류 (HTTP ${res.status})` }
  }
  return { ok: true, status: res.status, data }
}

// ── 출고지/반품지 (내보내기 필수 선행) ────────────────────────────────────
export interface ShippingPlace { code: string; name: string }

export async function listOutboundPlaces(conn: CoupangConnection): Promise<{ ok: boolean; items?: ShippingPlace[]; error?: string }> {
  const r = await coupangFetch(conn, 'GET', COUPANG_PATHS.outboundPlaces, { query: 'pageNum=1&pageSize=50' })
  if (!r.ok) return { ok: false, error: r.error }
  const d = r.data as { content?: Array<{ outboundShippingPlaceCode?: number | string; shippingPlaceName?: string; usable?: boolean }> } | null
  const items = (d?.content || [])
    .filter(p => p.usable !== false)
    .map(p => ({ code: String(p.outboundShippingPlaceCode ?? ''), name: String(p.shippingPlaceName || '출고지') }))
    .filter(p => p.code)
  return { ok: true, items }
}

export interface ReturnCenter extends ShippingPlace {
  zip_code: string; address: string; address_detail: string; phone: string
}

export async function listReturnCenters(conn: CoupangConnection): Promise<{ ok: boolean; items?: ReturnCenter[]; error?: string }> {
  const r = await coupangFetch(conn, 'GET', COUPANG_PATHS.returnCenters(conn.vendor_id), { query: 'pageNum=1&pageSize=50' })
  if (!r.ok) return { ok: false, error: r.error }
  type Row = {
    returnCenterCode?: string; shippingPlaceName?: string; usable?: boolean
    placeAddresses?: Array<{ returnZipCode?: string; returnAddress?: string; returnAddressDetail?: string; companyContactNumber?: string }>
  }
  const d = r.data as { data?: { content?: Row[] }; content?: Row[] } | null
  const list = d?.data?.content || d?.content || []
  const items: ReturnCenter[] = list.filter(p => p.usable !== false)
    .map(p => {
      const addr = p.placeAddresses?.[0]
      return {
        code: String(p.returnCenterCode ?? ''),
        name: String(p.shippingPlaceName || '반품지'),
        zip_code: String(addr?.returnZipCode || ''),
        address: String(addr?.returnAddress || ''),
        address_detail: String(addr?.returnAddressDetail || ''),
        phone: String(addr?.companyContactNumber || ''),
      }
    })
    .filter(p => p.code)
  return { ok: true, items }
}

// ── 카테고리 추천 + 메타(고시정보) ───────────────────────────────────────
export async function predictCategory(conn: CoupangConnection, productName: string, brand?: string): Promise<{ ok: boolean; code?: string; error?: string }> {
  const r = await coupangFetch(conn, 'POST', COUPANG_PATHS.categoryPredict, {
    body: { productName: productName.slice(0, 200), ...(brand ? { brand: brand.slice(0, 100) } : {}) },
  })
  if (!r.ok) return { ok: false, error: r.error }
  const d = r.data as { data?: { predictedCategoryId?: string | number } } | null
  const code = d?.data?.predictedCategoryId != null ? String(d.data.predictedCategoryId) : ''
  return code ? { ok: true, code } : { ok: false, error: '카테고리를 추천받지 못했습니다 — 상품명을 더 구체적으로 입력해주세요' }
}

export interface CategoryNotice { noticeCategoryName: string; noticeCategoryDetailName: string; required: boolean }

export async function fetchCategoryNotices(conn: CoupangConnection, categoryCode: string): Promise<{ ok: boolean; notices?: CategoryNotice[]; error?: string }> {
  const r = await coupangFetch(conn, 'GET', COUPANG_PATHS.categoryMeta(categoryCode))
  if (!r.ok) return { ok: false, error: r.error }
  const d = r.data as { data?: { noticeCategories?: Array<{ noticeCategoryName?: string; noticeCategoryDetailNames?: Array<{ noticeCategoryDetailName?: string; required?: string | boolean }> }> } } | null
  const notices: CategoryNotice[] = []
  for (const cat of d?.data?.noticeCategories || []) {
    for (const det of cat.noticeCategoryDetailNames || []) {
      notices.push({
        noticeCategoryName: String(cat.noticeCategoryName || ''),
        noticeCategoryDetailName: String(det.noticeCategoryDetailName || ''),
        required: det.required === true || String(det.required).toUpperCase() === 'MANDATORY',
      })
    }
  }
  return { ok: true, notices }
}

// ── 상품 등록 payload 빌더 (순수 — 테스트 가능) ──────────────────────────
export interface CoupangExportInput {
  vendorId: string
  vendorUserId: string
  displayCategoryCode: string
  name: string
  brand: string
  salePrice: number
  originalPrice: number
  stock: number
  imageUrl: string
  detailHtml: string
  outboundShippingPlaceCode: string
  returnCenterCode: string
  returnChargeName: string
  returnAddress: { zipCode: string; address: string; addressDetail: string; phone: string }
  deliveryChargeType: 'FREE' | 'NOT_FREE'
  deliveryCharge: number
  notices: CategoryNotice[]
}

export function buildCoupangProductPayload(i: CoupangExportInput): Record<string, unknown> {
  const now = new Date()
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`
  // 필수 고시정보 — '상세페이지 참조' 기본값 (업계 표준 관행, 거절 시 쿠팡 에러가 필드 단위로 안내).
  const firstNoticeCat = i.notices.find(n => n.required)?.noticeCategoryName || i.notices[0]?.noticeCategoryName || '기타 재화'
  const notices = i.notices.filter(n => n.required && n.noticeCategoryName === firstNoticeCat)
    .map(n => ({ noticeCategoryName: n.noticeCategoryName, noticeCategoryDetailName: n.noticeCategoryDetailName, content: '상세페이지 참조' }))
  return {
    displayCategoryCode: Number(i.displayCategoryCode) || i.displayCategoryCode,
    sellerProductName: i.name.slice(0, 100),
    vendorId: i.vendorId,
    saleStartedAt: fmt(now),
    saleEndedAt: '2099-01-01T23:59:59',
    displayProductName: i.name.slice(0, 100),
    brand: i.brand.slice(0, 50) || '기타',
    deliveryMethod: 'SEQUENCIAL',
    deliveryCompanyCode: 'CJGLS',
    deliveryChargeType: i.deliveryChargeType,
    deliveryCharge: i.deliveryChargeType === 'FREE' ? 0 : i.deliveryCharge,
    freeShipOverAmount: 0,
    deliveryChargeOnReturn: i.deliveryChargeType === 'FREE' ? 2500 : i.deliveryCharge,
    remoteAreaDeliverable: 'N',
    unionDeliveryType: 'NOT_UNION_DELIVERY',
    returnCenterCode: i.returnCenterCode,
    returnChargeName: i.returnChargeName.slice(0, 50),
    companyContactNumber: i.returnAddress.phone,
    returnZipCode: i.returnAddress.zipCode,
    returnAddress: i.returnAddress.address,
    returnAddressDetail: i.returnAddress.addressDetail,
    returnCharge: 2500,
    outboundShippingPlaceCode: Number(i.outboundShippingPlaceCode) || i.outboundShippingPlaceCode,
    vendorUserId: i.vendorUserId,
    requested: true, // 등록 즉시 승인요청 (쿠팡 검수)
    items: [{
      itemName: '단일상품',
      originalPrice: i.originalPrice,
      salePrice: i.salePrice,
      maximumBuyCount: i.stock,
      maximumBuyForPerson: 0,
      maximumBuyForPersonPeriod: 1,
      outboundShippingTimeDay: 2,
      unitCount: 1,
      adultOnly: 'EVERYONE',
      taxType: 'TAX',
      parallelImported: 'NOT_PARALLEL_IMPORTED',
      overseasPurchased: 'NOT_OVERSEAS_PURCHASED',
      pccNeeded: false,
      externalVendorSku: '',
      emptyBarcode: true,
      emptyBarcodeReason: '바코드 없음',
      certifications: [],
      searchTags: [],
      images: [{ imageOrder: 0, imageType: 'REPRESENTATION', vendorPath: i.imageUrl }],
      notices,
      attributes: [],
      contents: [{ contentsType: 'TEXT', contentDetails: [{ content: i.detailHtml, detailType: 'TEXT' }] }],
    }],
  }
}

// ── 📥 내 쿠팡 상품 목록/상세 (역방향 임포트) ────────────────────────────
export interface CoupangStoreProduct { product_id: string; name: string; status: string; sale_price: number; stock: number; image_url: string | null }

export async function listCoupangStoreProducts(conn: CoupangConnection, nextToken = ''): Promise<{ ok: boolean; items?: Array<{ product_id: string; name: string; status: string }>; next_token?: string; error?: string }> {
  const q = `vendorId=${encodeURIComponent(conn.vendor_id)}&maxPerPage=50${nextToken ? `&nextToken=${encodeURIComponent(nextToken)}` : ''}`
  const r = await coupangFetch(conn, 'GET', COUPANG_PATHS.products, { query: q })
  if (!r.ok) return { ok: false, error: r.error }
  const d = r.data as { nextToken?: string; data?: Array<{ sellerProductId?: number | string; sellerProductName?: string; statusName?: string }> } | null
  const items = (d?.data || []).map(p => ({
    product_id: String(p.sellerProductId ?? ''),
    name: String(p.sellerProductName || '').slice(0, 200),
    status: String(p.statusName || ''),
  })).filter(p => p.product_id && p.name)
  return { ok: true, items, next_token: d?.nextToken ? String(d.nextToken) : '' }
}

export async function getCoupangProductDetail(conn: CoupangConnection, sellerProductId: string): Promise<{ ok: boolean; item?: CoupangStoreProduct; error?: string }> {
  const r = await coupangFetch(conn, 'GET', COUPANG_PATHS.productDetail(sellerProductId))
  if (!r.ok) return { ok: false, error: r.error }
  const d = r.data as { data?: { sellerProductName?: string; statusName?: string; items?: Array<{ salePrice?: number; maximumBuyCount?: number; images?: Array<{ imageType?: string; vendorPath?: string; cdnPath?: string }> }> } } | null
  const it = d?.data?.items?.[0]
  const img = it?.images?.find(im => im.imageType === 'REPRESENTATION') || it?.images?.[0]
  const imgUrl = img?.cdnPath ? (String(img.cdnPath).startsWith('http') ? String(img.cdnPath) : `https://thumbnail.coupangcdn.com/thumbnails/remote/${img.cdnPath}`) : (img?.vendorPath ? String(img.vendorPath) : null)
  return {
    ok: true,
    item: {
      product_id: sellerProductId,
      name: String(d?.data?.sellerProductName || '').slice(0, 200),
      status: String(d?.data?.statusName || ''),
      sale_price: Math.max(0, Math.floor(Number(it?.salePrice) || 0)),
      stock: Math.max(0, Math.floor(Number(it?.maximumBuyCount) || 0)),
      image_url: imgUrl,
    },
  }
}
