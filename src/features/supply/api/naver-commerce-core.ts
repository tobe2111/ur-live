/**
 * 🛒 2026-06-12 네이버 커머스API 연동 — Phase A 코어 (사용자 요청).
 *
 *   모델: 판매사가 커머스API센터(apicenter.commerce.naver.com)에서 **자기 스토어 애플리케이션**
 *   (스토어당 1개)을 발급해 client_id/secret 을 우리 플랫폼에 연결 → 플랫폼이 대신 호출.
 *   (솔루션/개발업체 계정 모델은 네이버 심사가 필요해 Phase B 검토 — 현재 모델이 즉시 가동.)
 *
 *   인증: OAuth2 client_credentials + 전자서명 — client_secret(bcrypt salt)으로
 *   `${client_id}_${timestamp}` 를 bcrypt 해시 → base64 = client_secret_sign. 토큰 3시간.
 *
 *   보안: client_secret 은 DB 에 평문 저장 금지 — encryptAtRest(AES-GCM, DATA_ENCRYPTION_KEY).
 *   ⚠️ 실계정 E2E 는 스토어 앱 발급 후 운영에서 1회 필요 (이 환경은 외부 egress 차단).
 */
import { encryptAtRest, decryptAtRest } from '@/worker/utils/data-crypto'
import { swallow } from '@/worker/utils/swallow'
import { isPrivateHost } from '@/worker/utils/validation'

export const NAVER_API_BASE = 'https://api.commerce.naver.com/external'

// ── 스키마 ────────────────────────────────────────────────────────────────
const _schemaDone = new WeakSet<object>()
export async function ensureNaverConnectionSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS naver_commerce_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_type TEXT NOT NULL DEFAULT 'distributor',
    seller_id INTEGER NOT NULL,
    client_id TEXT NOT NULL,
    client_secret_enc TEXT NOT NULL,
    store_name TEXT,
    connected_at DATETIME DEFAULT (datetime('now')),
    last_verified_at DATETIME,
    last_export_at DATETIME,
    UNIQUE(owner_type, seller_id)
  )`).run().catch(swallow('naver:schema'))
  // 🔁 2026-06-12 (제조사 임포트 지원): 초기 버전(UNIQUE(seller_id), owner_type 없음) 테이블 재구축.
  //   제조사 id 와 판매사 id 는 별개 시퀀스라 UNIQUE(seller_id) 만으로는 충돌 — (owner_type, id) 복합으로.
  //   생성 직후의 신생 테이블(행 ~0)이라 self-heal 재구축 안전. 멱등 — owner_type 있으면 no-op.
  try {
    const meta = await DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='naver_commerce_connections'"
    ).first<{ sql: string }>()
    if (meta?.sql && !/owner_type/i.test(meta.sql)) {
      await DB.prepare('ALTER TABLE naver_commerce_connections RENAME TO naver_commerce_connections_old').run()
      await DB.prepare(`CREATE TABLE naver_commerce_connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_type TEXT NOT NULL DEFAULT 'distributor',
        seller_id INTEGER NOT NULL,
        client_id TEXT NOT NULL,
        client_secret_enc TEXT NOT NULL,
        store_name TEXT,
        connected_at DATETIME DEFAULT (datetime('now')),
        last_verified_at DATETIME,
        last_export_at DATETIME,
        UNIQUE(owner_type, seller_id)
      )`).run()
      await DB.prepare(`INSERT INTO naver_commerce_connections
        (id, owner_type, seller_id, client_id, client_secret_enc, store_name, connected_at, last_verified_at, last_export_at)
        SELECT id, 'distributor', seller_id, client_id, client_secret_enc, store_name, connected_at, last_verified_at, last_export_at
        FROM naver_commerce_connections_old`).run()
      await DB.prepare('DROP TABLE naver_commerce_connections_old').run()
    }
  } catch { /* 재구축 실패 — 기존 테이블 유지(판매사 기능은 동작) */ }
  // 내보내기 이력 — 중복 등록 방지 + 추적 (product_id = 우리 도매 상품).
  await DB.prepare(`CREATE TABLE IF NOT EXISTS naver_product_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    naver_product_no TEXT,
    sale_price INTEGER,
    status TEXT DEFAULT 'created',
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(seller_id, product_id)
  )`).run().catch(swallow('naver:schema-exports'))
}

// ── 전자서명 + 토큰 ──────────────────────────────────────────────────────
/** client_secret(bcrypt salt)으로 `${clientId}_${timestamp}` 서명 → base64. 순수(테스트 가능). */
export async function signClientSecret(clientId: string, clientSecret: string, timestamp: number): Promise<string> {
  const bcrypt = await import('bcryptjs')
  const hashed = bcrypt.hashSync(`${clientId}_${timestamp}`, clientSecret)
  return btoa(hashed)
}

export interface NaverToken { access_token: string; expires_at: number }
// isolate 수명 토큰 캐시 (3시간 토큰 — 만료 5분 전 갱신).
const _tokenCache = new Map<string, NaverToken>()

export async function issueNaverToken(clientId: string, clientSecret: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const hit = _tokenCache.get(clientId)
  if (hit && hit.expires_at - Date.now() > 5 * 60_000) return { ok: true, token: hit.access_token }
  const timestamp = Date.now()
  let sign: string
  try {
    sign = await signClientSecret(clientId, clientSecret, timestamp)
  } catch {
    return { ok: false, error: '시크릿 형식이 올바르지 않습니다 (커머스API센터의 애플리케이션 시크릿을 그대로 입력해주세요)' }
  }
  const body = new URLSearchParams({
    client_id: clientId,
    timestamp: String(timestamp),
    grant_type: 'client_credentials',
    client_secret_sign: sign,
    type: 'SELF',
  })
  const res = await fetch(`${NAVER_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }).catch(() => null)
  if (!res) return { ok: false, error: '네이버 API 에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.' }
  const data = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; message?: string; invalidInputs?: Array<{ message?: string }> } | null
  if (!res.ok || !data?.access_token) {
    const detail = data?.invalidInputs?.map(i => i.message).filter(Boolean).join(', ') || data?.message
    return { ok: false, error: detail ? `네이버 인증 실패: ${detail}` : `네이버 인증 실패 (HTTP ${res.status}) — 애플리케이션 ID/시크릿을 확인해주세요` }
  }
  const tok: NaverToken = { access_token: data.access_token, expires_at: Date.now() + (Number(data.expires_in) || 10800) * 1000 }
  _tokenCache.set(clientId, tok)
  return { ok: true, token: tok.access_token }
}

// ── 연결 CRUD ────────────────────────────────────────────────────────────
export interface NaverConnection { client_id: string; client_secret: string; store_name: string | null }
/** 연결 소유자 — distributor(판매사, 내보내기) / supplier(제조사, 내 상품 가져오기). */
export type ChannelOwner = 'distributor' | 'supplier'

export async function loadNaverConnection(DB: D1Database, ownerId: number, kek: string | undefined, ownerType: ChannelOwner = 'distributor'): Promise<NaverConnection | null> {
  await ensureNaverConnectionSchema(DB)
  const row = await DB.prepare('SELECT client_id, client_secret_enc, store_name FROM naver_commerce_connections WHERE owner_type = ? AND seller_id = ?')
    .bind(ownerType, ownerId).first<{ client_id: string; client_secret_enc: string; store_name: string | null }>().catch(() => null)
  if (!row) return null
  try {
    const secret = await decryptAtRest(row.client_secret_enc, kek)
    return { client_id: row.client_id, client_secret: secret, store_name: row.store_name }
  } catch {
    return null // KEK 변경/손상 — 재연결 필요
  }
}

export async function saveNaverConnection(DB: D1Database, ownerId: number, clientId: string, clientSecret: string, kek: string | undefined, ownerType: ChannelOwner = 'distributor'): Promise<void> {
  await ensureNaverConnectionSchema(DB)
  const enc = await encryptAtRest(clientSecret, kek)
  await DB.prepare(`
    INSERT INTO naver_commerce_connections (owner_type, seller_id, client_id, client_secret_enc, last_verified_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(owner_type, seller_id) DO UPDATE SET client_id = excluded.client_id,
      client_secret_enc = excluded.client_secret_enc, last_verified_at = datetime('now')
  `).bind(ownerType, ownerId, clientId, enc).run()
}

// ── 인증 fetch 헬퍼 ──────────────────────────────────────────────────────
export async function naverFetch(conn: NaverConnection, path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const tok = await issueNaverToken(conn.client_id, conn.client_secret)
  if (!tok.ok) return { ok: false, status: 401, data: null, error: tok.error }
  const res = await fetch(`${NAVER_API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${tok.token}`, ...(init?.headers || {}) },
  }).catch(() => null)
  if (!res) return { ok: false, status: 0, data: null, error: '네이버 API 호출 실패 (네트워크)' }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const d = data as { message?: string; invalidInputs?: Array<{ name?: string; message?: string }> } | null
    const detail = d?.invalidInputs?.map(i => [i.name, i.message].filter(Boolean).join(': ')).join(' / ') || d?.message
    return { ok: false, status: res.status, data, error: detail || `네이버 API 오류 (HTTP ${res.status})` }
  }
  return { ok: true, status: res.status, data }
}

// ── 카테고리 (리프 검색) ─────────────────────────────────────────────────
interface NaverCategory { id: string; name: string; wholeCategoryName?: string; last?: boolean }
// 전체 카테고리(수천 건)는 무겁다 — isolate 모듈 캐시 1시간 (어떤 연결로 받아도 동일 데이터).
let _categoriesCache: { at: number; items: NaverCategory[] } | null = null

export async function searchNaverLeafCategories(conn: NaverConnection, q: string, limit = 20): Promise<{ ok: boolean; items?: Array<{ id: string; label: string }>; error?: string }> {
  if (!_categoriesCache || Date.now() - _categoriesCache.at > 60 * 60_000) {
    const r = await naverFetch(conn, '/v1/categories')
    if (!r.ok) return { ok: false, error: r.error }
    const arr = Array.isArray(r.data) ? (r.data as NaverCategory[]) : []
    _categoriesCache = { at: Date.now(), items: arr }
  }
  const needle = q.trim().toLowerCase()
  const items = _categoriesCache.items
    .filter(cat => cat.last !== false && (cat.wholeCategoryName || cat.name || '').toLowerCase().includes(needle))
    .slice(0, Math.min(50, limit))
    .map(cat => ({ id: String(cat.id), label: cat.wholeCategoryName || cat.name }))
  return { ok: true, items }
}

// ── 이미지 업로드 (네이버는 자체 업로드 URL 만 허용) ─────────────────────
export async function uploadImageToNaver(conn: NaverConnection, imageUrl: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  // 🛡️ 2026-06-26 [보안] SSRF 가드 — imageUrl 은 셀러-제어 products.image_url 에서 옴.
  //   http(s) 가 아니거나 내부/사설 호스트면 fetch 거부(내부 메타데이터/사설망 접근 차단).
  try {
    const u = new URL(imageUrl)
    if (!['http:', 'https:'].includes(u.protocol) || isPrivateHost(u.hostname)) {
      return { ok: false, error: '허용되지 않는 이미지 URL 입니다' }
    }
  } catch {
    return { ok: false, error: '올바른 이미지 URL 이 아닙니다' }
  }
  const src = await fetch(imageUrl).catch(() => null)
  if (!src?.ok) return { ok: false, error: '상품 이미지 원본을 가져오지 못했습니다' }
  const blob = await src.blob()
  if (blob.size > 10 * 1024 * 1024) return { ok: false, error: '이미지가 10MB 를 초과합니다' }
  const fd = new FormData()
  const ext = /png/i.test(blob.type) ? 'png' : /gif/i.test(blob.type) ? 'gif' : 'jpg'
  fd.append('imageFiles', blob, `product.${ext}`)
  const r = await naverFetch(conn, '/v1/product-images/upload', { method: 'POST', body: fd })
  if (!r.ok) return { ok: false, error: r.error }
  const d = r.data as { images?: Array<{ url?: string }> } | null
  const url = d?.images?.[0]?.url
  return url ? { ok: true, url } : { ok: false, error: '네이버 이미지 업로드 응답에 URL 이 없습니다' }
}

// ── 📥 내 스토어 상품 목록 (역방향 임포트 — 제조사 "내 상품 가져오기") ──────
export interface NaverStoreProduct {
  origin_no: string
  name: string
  sale_price: number
  stock: number
  image_url: string | null
  status: string
}

/** 본인 스토어 상품 목록 (POST /v1/products/search — 페이징). 본인 계정 데이터만 — 공식 범위. */
export async function listNaverStoreProducts(conn: NaverConnection, page = 1, size = 50): Promise<{ ok: boolean; items?: NaverStoreProduct[]; total?: number; error?: string }> {
  const r = await naverFetch(conn, '/v1/products/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ page: Math.max(1, page), size: Math.min(100, Math.max(1, size)) }),
  })
  if (!r.ok) return { ok: false, error: r.error }
  const d = r.data as {
    totalElements?: number
    contents?: Array<{
      originProductNo?: number | string
      channelProducts?: Array<{ name?: string; salePrice?: number; stockQuantity?: number; statusType?: string; representativeImage?: { url?: string } }>
    }>
  } | null
  const items: NaverStoreProduct[] = (d?.contents || []).map(p => {
    const ch = p.channelProducts?.[0]
    return {
      origin_no: String(p.originProductNo ?? ''),
      name: String(ch?.name || '').slice(0, 200),
      sale_price: Math.max(0, Math.floor(Number(ch?.salePrice) || 0)),
      stock: Math.max(0, Math.floor(Number(ch?.stockQuantity) || 0)),
      image_url: ch?.representativeImage?.url ? String(ch.representativeImage.url) : null,
      status: String(ch?.statusType || ''),
    }
  }).filter(p => p.name)
  return { ok: true, items, total: Number(d?.totalElements) || items.length }
}

// ── 🖼️ 외부 이미지 → R2 미러 (임포트용 — 핫링크 깨짐 방지) ──────────────────
//   ⚠️ SSRF 가드: 신뢰 CDN 호스트만 fetch 허용. 실패 시 원본 URL 폴백(기능은 유지).
const MIRROR_ALLOWED_HOSTS = /(^|\.)pstatic\.net$|(^|\.)coupangcdn\.com$|(^|\.)naver\.com$/i

export async function mirrorImageToR2(
  env: { MEDIA_BUCKET?: R2Bucket; PUBLIC_R2_URL?: string },
  imageUrl: string,
): Promise<string> {
  try {
    if (!env.MEDIA_BUCKET) return imageUrl
    const u = new URL(imageUrl)
    if (u.protocol !== 'https:' || !MIRROR_ALLOWED_HOSTS.test(u.hostname)) return imageUrl
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return imageUrl
    const buf = await res.arrayBuffer()
    if (buf.byteLength > 10 * 1024 * 1024 || buf.byteLength < 100) return imageUrl
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg'
    const rand = (crypto as { randomUUID?: () => string }).randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const key = `uploads/import/${new Date().toISOString().slice(0, 7)}/${rand}.${ext}`
    await env.MEDIA_BUCKET.put(key, buf, {
      httpMetadata: { contentType: ct.startsWith('image/') ? ct : 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { source: 'store-import', original: imageUrl.slice(0, 500) },
    })
    const base = env.PUBLIC_R2_URL || ''
    return base ? `${base.replace(/\/$/, '')}/${key}` : `/api/media/${key}`
  } catch {
    return imageUrl // 미러 실패 — 원본 URL 로 동작 유지
  }
}

// ── 상품 등록 payload 빌더 (순수 — 테스트 가능) ──────────────────────────
export interface ExportInput {
  name: string
  leafCategoryId: string
  salePrice: number
  stockQuantity: number
  naverImageUrl: string
  detailHtml: string
  shippingFee: number // 0 = 무료
  asTelephone: string
  asGuide: string
}

export function buildNaverProductPayload(input: ExportInput): Record<string, unknown> {
  return {
    originProduct: {
      statusType: 'SALE',
      leafCategoryId: input.leafCategoryId,
      name: input.name.slice(0, 100),
      images: { representativeImage: { url: input.naverImageUrl } },
      salePrice: input.salePrice,
      stockQuantity: input.stockQuantity,
      detailContent: input.detailHtml,
      deliveryInfo: {
        deliveryType: 'DELIVERY',
        deliveryAttributeType: 'NORMAL',
        deliveryFee: input.shippingFee > 0
          ? { deliveryFeeType: 'PAID', baseFee: input.shippingFee }
          : { deliveryFeeType: 'FREE' },
        claimDeliveryInfo: { returnDeliveryFee: input.shippingFee, exchangeDeliveryFee: input.shippingFee * 2 || 0 },
      },
      detailAttribute: {
        afterServiceInfo: {
          afterServiceTelephoneNumber: input.asTelephone,
          afterServiceGuideContent: input.asGuide,
        },
        // 원산지 '상세설명에 표시' — 도매 위탁 상품의 안전 기본값(상세에 명기 책임 안내).
        originAreaInfo: { originAreaCode: '04', content: '상세설명 참조' },
        minorPurchasable: true,
      },
    },
    smartstoreChannelProduct: {
      naverShoppingRegistration: true,
      channelProductDisplayStatusType: 'ON',
    },
  }
}
