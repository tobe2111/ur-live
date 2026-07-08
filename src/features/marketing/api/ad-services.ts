/**
 * 🆕 2026-07-02 유어애즈 — 마케팅 서비스몰(주문 관리 레이어).
 *   설계: docs/design/urads-service-marketplace.md. 결정: 무결제(주문요청 접수) · 확장형 카탈로그 · /ads/services.
 *
 *   ⚠️ 중요(윤리/약관): 이 모듈은 **상품 카탈로그 + 주문 큐**(소프트웨어)만 담당한다. 실제 "성장" 이행은
 *   봇/가짜계정이 아니라 **정당한 마케팅 실행**(유료광고 집행·콘텐츠·인플루언서·체험단·운영)으로 사람이 채운다.
 *   주문의 `fulfillment_method` 로 어떻게 이행했는지 기록. 봇/자동 팔로우/가짜계정 로직은 구현하지 않는다.
 */
export type ServiceOrderStatus = 'requested' | 'confirmed' | 'in_progress' | 'done' | 'cancelled'
export const SERVICE_ORDER_STATUSES: ServiceOrderStatus[] = ['requested', 'confirmed', 'in_progress', 'done', 'cancelled']
export const FULFILLMENT_METHODS = ['유료광고', '콘텐츠', '인플루언서', '체험단', '운영대행', '기타'] as const

export interface ServicePricing {
  unit: string                 // 단위 라벨(주/명/건/키워드…)
  unitPrice: number            // 단위당 기본가(원)
  minQty: number
  maxQty: number
  presets?: Array<{ label: string; qty: number }>          // 빠른 선택(예: 1개월=4주)
  qtyDiscounts?: Array<{ min: number; pct: number }>        // 수량구간 할인(최소수량 임계)
  options?: Array<{ key: string; label: string; price: number }> // 부가 옵션(정액 가산)
}
export interface ServiceRow { id: number; category: string; name: string; subtitle: string | null; description: string | null; pricing: ServicePricing; active: number; sort_order: number }

export interface PriceResult { unitPrice: number; quantity: number; subtotal: number; discountPct: number; discounted: number; optionsTotal: number; total: number }

/** 가격 계산(순수 — 단위테스트 잠금). 서버가 권위(클라 값 불신). */
export function computeServicePrice(pricing: ServicePricing, quantity: number, optionKeys: string[] = []): PriceResult {
  const minQ = Math.max(1, Math.round(Number(pricing.minQty) || 1))
  const maxQ = Math.max(minQ, Math.round(Number(pricing.maxQty) || 1))
  const q = Math.min(maxQ, Math.max(minQ, Math.round(Number(quantity) || minQ)))
  const unitPrice = Math.max(0, Math.round(Number(pricing.unitPrice) || 0))
  const subtotal = unitPrice * q
  // 할인: qty 이하 최대 임계의 pct 적용.
  let discountPct = 0
  for (const d of (pricing.qtyDiscounts || []).slice().sort((a, b) => a.min - b.min)) {
    if (q >= (Number(d.min) || 0)) discountPct = Math.min(90, Math.max(0, Number(d.pct) || 0))
  }
  const discounted = Math.round(subtotal * (1 - discountPct / 100))
  const optSet = new Set(optionKeys)
  const optionsTotal = (pricing.options || []).filter(o => optSet.has(o.key)).reduce((s, o) => s + Math.max(0, Math.round(Number(o.price) || 0)), 0)
  return { unitPrice, quantity: q, subtotal, discountPct, discounted, optionsTotal, total: discounted + optionsTotal }
}

const _schemaDone = new WeakSet<object>()
export async function ensureServicesSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    pricing_json TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_service_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    service_name TEXT NOT NULL,
    preset_label TEXT,
    quantity INTEGER NOT NULL,
    options_json TEXT,
    unit_price INTEGER NOT NULL,
    discount_pct INTEGER NOT NULL DEFAULT 0,
    options_total INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL,
    contact_kakao TEXT,
    contact_phone TEXT,
    target_url TEXT,
    memo TEXT,
    status TEXT NOT NULL DEFAULT 'requested',
    fulfillment_method TEXT,
    admin_note TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_ad_svc_orders_acct ON ad_service_orders(account_id, id)').run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_ad_svc_orders_status ON ad_service_orders(status, id)').run().catch(() => null)
}

// ── 시드(테이블 비었을 때 1회) — 전부 정당한 마케팅 실행 기준 설명 ────────────────
const SERVICE_SEED: Array<Omit<ServiceRow, 'id' | 'active' | 'sort_order'> & { sort_order: number }> = [
  {
    category: '카카오톡', name: '카카오톡 오픈채팅 성장 대행', subtitle: '실제 유입 기반 오픈채팅/공구방 활성화',
    description: '## 서비스 소개\n카카오톡 오픈채팅·공구방을 **정당한 마케팅 실행으로** 성장시킵니다. 콘텐츠 제작, 타겟 유료광고(카카오/메타) 유입, 이벤트 기획을 통해 **실제 관심 있는 사용자**가 유입되도록 운영합니다.\n\n## 진행 방식\n- 주차별 콘텐츠·이벤트 기획 및 광고 집행\n- 유입 리포트(광고 성과·순증) 제공\n\n## 주의\n봇/가짜계정을 사용하지 않습니다. 실제 유입 기반이라 자연스럽고 지속가능합니다. 성과는 업종·예산·콘텐츠에 따라 다릅니다.',
    pricing: { unit: '주', unitPrice: 90000, minQty: 1, maxQty: 52, presets: [{ label: '1개월', qty: 4 }, { label: '3개월', qty: 12 }, { label: '6개월', qty: 24 }, { label: '12개월', qty: 52 }], qtyDiscounts: [{ min: 1, pct: 0 }, { min: 5, pct: 7 }, { min: 9, pct: 12 }, { min: 25, pct: 20 }], options: [{ key: 'report', label: '주간 상세 리포트', price: 30000 }, { key: 'design', label: '배너·카드뉴스 제작', price: 80000 }] },
    sort_order: 10,
  },
  {
    category: 'SNS', name: '인스타그램 성장 대행', subtitle: '콘텐츠+타겟광고+인플루언서 시딩',
    description: '## 서비스 소개\n콘텐츠 제작, 타겟 유료광고, 인플루언서 시딩으로 인스타그램 계정을 **실제 팔로워 기반**으로 성장시킵니다.\n\n## 진행 방식\n- 피드/릴스 콘텐츠 기획·제작\n- 관심사·지역 타겟 광고 집행\n- 관련 인플루언서 협업\n\n## 주의\n가짜 팔로워/봇을 쓰지 않습니다. 실제 참여도(저장·공유) 중심으로 운영합니다.',
    pricing: { unit: '주', unitPrice: 120000, minQty: 1, maxQty: 52, presets: [{ label: '1개월', qty: 4 }, { label: '3개월', qty: 12 }, { label: '6개월', qty: 24 }], qtyDiscounts: [{ min: 1, pct: 0 }, { min: 5, pct: 8 }, { min: 12, pct: 15 }], options: [{ key: 'reels', label: '릴스 4편 추가 제작', price: 200000 }] },
    sort_order: 20,
  },
  {
    category: '검색', name: '블로그·검색 상위노출 관리', subtitle: 'SEO·콘텐츠 기반 상위노출',
    description: '## 서비스 소개\n타겟 키워드에 대해 **SEO·양질의 콘텐츠**로 블로그/검색 노출을 개선합니다. 어뷰징(프로그램) 없이 검색엔진 가이드에 맞춰 진행합니다.\n\n## 진행 방식\n- 키워드 분석 + 콘텐츠 발행 계획\n- 주차별 포스팅·최적화\n\n## 주의\n순위는 검색엔진 정책·경쟁도에 따라 변동하며 보장하지 않습니다(어뷰징 미사용).',
    pricing: { unit: '주', unitPrice: 70000, minQty: 2, maxQty: 52, presets: [{ label: '1개월', qty: 4 }, { label: '3개월', qty: 12 }], qtyDiscounts: [{ min: 2, pct: 0 }, { min: 8, pct: 10 }, { min: 24, pct: 18 }], options: [{ key: 'kw', label: '키워드 3개 추가', price: 90000 }] },
    sort_order: 30,
  },
]

let _seedChecked = new WeakSet<object>()
export async function maybeSeedServices(DB: D1Database): Promise<void> {
  await ensureServicesSchema(DB)
  if (_seedChecked.has(DB)) return
  _seedChecked.add(DB)
  const cnt = await DB.prepare('SELECT COUNT(*) AS c FROM ad_services').first<{ c: number }>().catch(() => null)
  if ((Number(cnt?.c) || 0) > 0) return
  for (const s of SERVICE_SEED) {
    await DB.prepare('INSERT INTO ad_services (category, name, subtitle, description, pricing_json, active, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)')
      .bind(s.category, s.name, s.subtitle, s.description, JSON.stringify(s.pricing), s.sort_order).run().catch(() => null)
  }
}

function parsePricing(json: string | null): ServicePricing {
  try { const p = JSON.parse(json || '{}'); if (p && typeof p === 'object') return p as ServicePricing } catch { /* ignore */ }
  return { unit: '건', unitPrice: 0, minQty: 1, maxQty: 1 }
}
const rowToService = (r: { id: number; category: string; name: string; subtitle: string | null; description: string | null; pricing_json: string; active: number; sort_order: number }): ServiceRow =>
  ({ id: r.id, category: r.category, name: r.name, subtitle: r.subtitle, description: r.description, pricing: parsePricing(r.pricing_json), active: r.active, sort_order: r.sort_order })

// ── 카탈로그(광고주/공개) ────────────────────────────────────────────────────
export async function listServices(DB: D1Database, includeInactive = false): Promise<ServiceRow[]> {
  await maybeSeedServices(DB)
  const sql = `SELECT id, category, name, subtitle, description, pricing_json, active, sort_order FROM ad_services ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY sort_order ASC, id ASC`
  const r = await DB.prepare(sql).all<{ id: number; category: string; name: string; subtitle: string | null; description: string | null; pricing_json: string; active: number; sort_order: number }>().catch(() => null)
  return (r?.results || []).map(rowToService)
}
export async function getService(DB: D1Database, id: number): Promise<ServiceRow | null> {
  await ensureServicesSchema(DB)
  const r = await DB.prepare('SELECT id, category, name, subtitle, description, pricing_json, active, sort_order FROM ad_services WHERE id = ?').bind(id)
    .first<{ id: number; category: string; name: string; subtitle: string | null; description: string | null; pricing_json: string; active: number; sort_order: number }>().catch(() => null)
  return r ? rowToService(r) : null
}

// ── 주문(광고주) — 서버 권위 가격 재계산 후 저장 ──────────────────────────────
export interface OrderInput { serviceId: number; quantity: number; presetLabel?: string; optionKeys?: string[]; contactKakao?: string; contactPhone?: string; targetUrl?: string; memo?: string }
export async function createServiceOrder(DB: D1Database, accountId: number, input: OrderInput): Promise<{ ok: boolean; error?: string; orderId?: number; price?: PriceResult }> {
  await ensureServicesSchema(DB)
  const svc = await getService(DB, Number(input.serviceId))
  if (!svc || !svc.active) return { ok: false, error: '판매 중인 상품이 아닙니다' }
  if (!input.contactKakao && !input.contactPhone) return { ok: false, error: '연락처(카카오 ID 또는 전화번호)를 입력해주세요' }
  const optionKeys = (input.optionKeys || []).map(String).slice(0, 10)
  const price = computeServicePrice(svc.pricing, Number(input.quantity), optionKeys)
  // 최근 24h 동일 계정 주문 폭주 방지(간단 캡).
  const recent = await DB.prepare("SELECT COUNT(*) AS c FROM ad_service_orders WHERE account_id = ? AND created_at >= datetime('now','-1 day')").bind(accountId).first<{ c: number }>().catch(() => null)
  if ((Number(recent?.c) || 0) >= 30) return { ok: false, error: '주문 요청이 많습니다. 잠시 후 다시 시도해주세요.' }
  const r = await DB.prepare(`INSERT INTO ad_service_orders
    (account_id, service_id, service_name, preset_label, quantity, options_json, unit_price, discount_pct, options_total, total_amount, contact_kakao, contact_phone, target_url, memo, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested')`)
    .bind(accountId, svc.id, svc.name.slice(0, 120), input.presetLabel ? String(input.presetLabel).slice(0, 40) : null, price.quantity,
      optionKeys.length ? JSON.stringify(optionKeys) : null, price.unitPrice, price.discountPct, price.optionsTotal, price.total,
      input.contactKakao ? String(input.contactKakao).slice(0, 60) : null, input.contactPhone ? String(input.contactPhone).slice(0, 30) : null,
      input.targetUrl ? String(input.targetUrl).slice(0, 300) : null, input.memo ? String(input.memo).slice(0, 500) : null)
    .run().catch(() => null)
  if (!r?.meta?.last_row_id) return { ok: false, error: '주문 접수 중 오류가 발생했습니다' }
  return { ok: true, orderId: Number(r.meta.last_row_id), price }
}

export interface OrderRow { id: number; service_name: string; preset_label: string | null; quantity: number; total_amount: number; status: string; fulfillment_method: string | null; admin_note: string | null; created_at: string }
export async function listMyOrders(DB: D1Database, accountId: number): Promise<OrderRow[]> {
  await ensureServicesSchema(DB)
  const r = await DB.prepare('SELECT id, service_name, preset_label, quantity, total_amount, status, fulfillment_method, admin_note, created_at FROM ad_service_orders WHERE account_id = ? ORDER BY id DESC LIMIT 100')
    .bind(accountId).all<OrderRow>().catch(() => null)
  return r?.results || []
}

// ── 어드민 ───────────────────────────────────────────────────────────────────
export async function adminListOrders(DB: D1Database, status?: string, limit = 200): Promise<Array<OrderRow & { account_id: number; contact_kakao: string | null; contact_phone: string | null; target_url: string | null; memo: string | null; unit_price: number; discount_pct: number; options_total: number }>> {
  await ensureServicesSchema(DB)
  const valid = status && SERVICE_ORDER_STATUSES.includes(status as ServiceOrderStatus)
  const cols = 'id, account_id, service_name, preset_label, quantity, unit_price, discount_pct, options_total, total_amount, contact_kakao, contact_phone, target_url, memo, status, fulfillment_method, admin_note, created_at'
  const stmt = valid
    ? DB.prepare(`SELECT ${cols} FROM ad_service_orders WHERE status = ? ORDER BY id DESC LIMIT ?`).bind(status, Math.min(500, limit))
    : DB.prepare(`SELECT ${cols} FROM ad_service_orders ORDER BY id DESC LIMIT ?`).bind(Math.min(500, limit))
  const r = await stmt.all<OrderRow & { account_id: number; contact_kakao: string | null; contact_phone: string | null; target_url: string | null; memo: string | null; unit_price: number; discount_pct: number; options_total: number }>().catch(() => null)
  return r?.results || []
}

export async function adminUpdateOrder(DB: D1Database, id: number, patch: { status?: string; fulfillment_method?: string; admin_note?: string }): Promise<{ ok: boolean; error?: string }> {
  await ensureServicesSchema(DB)
  const sets: string[] = []
  const binds: (string | number)[] = []
  if (patch.status !== undefined) {
    if (!SERVICE_ORDER_STATUSES.includes(patch.status as ServiceOrderStatus)) return { ok: false, error: '잘못된 상태 값' }
    sets.push('status = ?'); binds.push(patch.status)
  }
  if (patch.fulfillment_method !== undefined) { sets.push('fulfillment_method = ?'); binds.push(String(patch.fulfillment_method).slice(0, 40) || '') }
  if (patch.admin_note !== undefined) { sets.push('admin_note = ?'); binds.push(String(patch.admin_note).slice(0, 1000)) }
  if (!sets.length) return { ok: false, error: '변경할 항목이 없습니다' }
  sets.push("updated_at = datetime('now')")
  await DB.prepare(`UPDATE ad_service_orders SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run().catch(() => null)
  return { ok: true }
}

export async function adminUpsertService(DB: D1Database, svc: { id?: number; category: string; name: string; subtitle?: string; description?: string; pricing: ServicePricing; active?: boolean; sort_order?: number }): Promise<{ ok: boolean; error?: string; id?: number }> {
  await ensureServicesSchema(DB)
  if (!svc.name?.trim() || !svc.category?.trim()) return { ok: false, error: '카테고리와 상품명을 입력해주세요' }
  const pricing = JSON.stringify(svc.pricing || {})
  if (svc.id) {
    await DB.prepare('UPDATE ad_services SET category=?, name=?, subtitle=?, description=?, pricing_json=?, active=?, sort_order=? WHERE id=?')
      .bind(svc.category, svc.name, svc.subtitle || null, svc.description || null, pricing, svc.active === false ? 0 : 1, Math.round(Number(svc.sort_order) || 100), svc.id).run().catch(() => null)
    return { ok: true, id: svc.id }
  }
  const r = await DB.prepare('INSERT INTO ad_services (category, name, subtitle, description, pricing_json, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(svc.category, svc.name, svc.subtitle || null, svc.description || null, pricing, svc.active === false ? 0 : 1, Math.round(Number(svc.sort_order) || 100)).run().catch(() => null)
  return { ok: true, id: Number(r?.meta?.last_row_id) || undefined }
}
