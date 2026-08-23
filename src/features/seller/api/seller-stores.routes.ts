/**
 * 🏪 매장 관리 — 매장 추가(카카오맵 검색 기반)·삭제·채널·수수료 컨텍스트
 *   설계 SSOT: docs/design/seller-dashboard-v2.md (2026-08-20 대표 확정 사항 반영)
 *
 * 대표 확정 사항이 이 파일의 존재 이유다:
 *   ① "매장 사전 등록이 아니라 **그냥 매장 등록**. 카카오맵으로 검색해서 나오게" — POST /stores
 *   ② "실제 사업주가 맞는지 **국세청 사업자번호 조회**" — 기존 nts-business-verify SSOT 재사용
 *   ③ "매장 등록 시 **직접(업주) / 중개(중개 업체)** 선택" — seller_meta.store_channel
 *   ④ 수수료 최종: **직접 10% / 중개 5%** ("이게 최종이야") — fee-resolver 채널 규칙과 한 몸
 *
 * ## 소유 모델 (store-operator-model.md 2단계 위에 얹음)
 * `sellers.linked_user_id` 는 UNIQUE(1인 1행)라 **추가 매장은 linked_user_id 없이 만들고**
 * 등록자에게 `seller_operators` 행을 준다 — 직접(direct)=owner, 중개(brokered)=operator
 * (중개 등록 매장은 owner 부재 = 대리 등록 상태. 실제 사장님이 오면 사업자번호로 owner 승계 — 3단계).
 *
 * ## 💰 돈 안 움직임
 * 여기서는 매장 행·관계·채널 플래그만 만든다. 채널별 수수료의 **정산 적용**은 fee-resolver
 * 그림자 게이트(FEE_RESOLVER_ENABLED) 뒤 — 이 파일은 표시/기록용 컨텍스트만 제공한다.
 */
import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Env } from '@/worker/types/env'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { getSellerMeta, setSellerMeta } from '@/worker/utils/seller-meta'
import { ntsValidateBusiness, ntsCheckStatus } from '@/worker/utils/nts-business-verify'
import { canOperateStore, grantOperator, revokeOperator, isStoreOwner } from '../../../worker/utils/seller-operators'
import { mergeStoreProfile, loadLatestProductCopy, saveStoreProfileAndPropagate } from '@/worker/utils/store-profile'
import { parseSessionCookie } from '@/worker/utils/session'
import { loadFeeRates } from '@/worker/utils/fee-resolver'

const app = new Hono<{ Bindings: Env }>()
type Ctx = Context<{ Bindings: Env }>

export type StoreChannel = 'direct' | 'brokered'
const isChannel = (v: unknown): v is StoreChannel => v === 'direct' || v === 'brokered'

/** 주체(users.id) — seller-operators.routes 와 동일 규칙: 세션 쿠키 또는 seller_token 만. */
async function resolveActorUserId(c: Ctx): Promise<number | null> {
  const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user']).catch(() => null)
  if (sess?.userId != null) {
    const id = Number(sess.userId)
    if (Number.isFinite(id) && id > 0) return id
  }
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (sellerId) {
    const row = await c.env.DB.prepare('SELECT linked_user_id FROM sellers WHERE id = ? LIMIT 1')
      .bind(sellerId).first<{ linked_user_id: number | null }>().catch(() => null)
    const id = Number(row?.linked_user_id)
    if (Number.isFinite(id) && id > 0) return id
  }
  return null
}

// ── GET /fee-context — 현재 매장의 채널·수수료율 (이용권 등록 실수령가 계산용) ──────
app.get('/fee-context', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
    const [meta, rates] = await Promise.all([
      getSellerMeta(c.env.DB, [sellerId]),
      loadFeeRates(c.env.DB),
    ])
    const channel: StoreChannel = meta.get(sellerId)?.store_channel === 'direct' ? 'direct' : 'brokered'
    return c.json({
      success: true,
      data: {
        channel,
        // 채널별 플랫폼 수수료 — fee-resolver 와 같은 값(loadFeeRates SSOT)이라 표시·정산이 갈릴 수 없다.
        platform_fee_pct: channel === 'direct' ? rates.platformPctDirect : rates.platformPct,
        direct_pct: rates.platformPctDirect,
        brokered_pct: rates.platformPct,
      },
    })
  } catch (err) {
    return safeError(c, err, '수수료 정보를 불러오지 못했습니다', '[seller-stores]')
  }
})

// ── 이용권 임시저장(서버 드래프트) — 2026-08-23 대표 "임시저장도 돼야 해" 후속 승인 ─────────
//   localStorage 드래프트의 서버 짝 — PC 에서 쓰다 폰에서 이어 쓴다. 셀러(좌석)당 1개.
//   ⚠️ seller_meta 를 쓰지 않는 이유: getSellerMeta 는 그 셀러의 **모든** 키를 읽는다 —
//   base64 이미지가 든 수백 KB 드래프트를 넣으면 fee-context 등 모든 meta 조회가 그걸 끌고 다닌다.
let _draftEnsured = false
async function ensureVoucherDraftTable(DB: D1Database) {
  if (_draftEnsured) return
  _draftEnsured = true
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS seller_voucher_drafts (
      seller_id INTEGER PRIMARY KEY,
      draft_json TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
    )`).run()
  } catch { /* 이미 있으면 그만 — repair-schema 가 정식 등록 */ }
}
/** 드래프트 크기 상한 — 압축 업로드(≤300KB)의 base64(~400KB)까지 수용, 그 이상은 거절. */
const DRAFT_MAX_BYTES = 900_000

app.get('/voucher-draft', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
    await ensureVoucherDraftTable(c.env.DB)
    // updated_ms: epoch(ms) 로 내려 클라가 Date 파싱 없이 숫자 비교만 하게 한다(UTC 오해석 클래스 차단).
    const row = await c.env.DB.prepare(
      `SELECT draft_json, CAST(strftime('%s', updated_at) AS INTEGER) * 1000 AS updated_ms
         FROM seller_voucher_drafts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first<{ draft_json: string; updated_ms: number }>().catch(() => null)
    if (!row) return c.json({ success: true, data: null })
    let form: unknown = null
    try { form = JSON.parse(row.draft_json) } catch { /* 깨진 드래프트는 없는 것 */ }
    if (!form || typeof form !== 'object') return c.json({ success: true, data: null })
    return c.json({ success: true, data: { form, updated_ms: Number(row.updated_ms) || 0 } })
  } catch (err) {
    return safeError(c, err, '임시저장을 불러오지 못했습니다', '[seller-stores]')
  }
})

app.put('/voucher-draft', rateLimit({ action: 'voucher_draft_save', max: 120, windowSec: 3600 }), async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
    const body = await c.req.json<{ form?: unknown }>().catch(() => ({} as { form?: unknown }))
    if (!body.form || typeof body.form !== 'object') {
      return c.json({ success: false, error: '저장할 내용이 없습니다' }, 400)
    }
    const json = JSON.stringify(body.form)
    if (json.length > DRAFT_MAX_BYTES) {
      return c.json({ success: false, error: '임시저장 용량을 초과했습니다 (이미지를 줄여주세요)' }, 413)
    }
    await ensureVoucherDraftTable(c.env.DB)
    await c.env.DB.prepare(
      `INSERT INTO seller_voucher_drafts (seller_id, draft_json, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(seller_id) DO UPDATE SET draft_json = excluded.draft_json, updated_at = datetime('now')`
    ).bind(sellerId, json).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '임시저장에 실패했습니다', '[seller-stores]')
  }
})

app.delete('/voucher-draft', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
    await ensureVoucherDraftTable(c.env.DB)
    await c.env.DB.prepare('DELETE FROM seller_voucher_drafts WHERE seller_id = ?').bind(sellerId).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '임시저장 삭제에 실패했습니다', '[seller-stores]')
  }
})

// ── 매장 프로필 병합(공유) — SSOT: worker/utils/store-profile.ts (2026-08-23 단일화) ────────
async function loadMergedProfile(DB: D1Database, sellerId: number) {
  const [seller, metaMap, lastProduct] = await Promise.all([
    DB.prepare('SELECT name, business_name, phone, address FROM sellers WHERE id = ? LIMIT 1')
      .bind(sellerId).first<{ name: string | null; business_name: string | null; phone: string | null; address: string | null }>()
      .catch(() => null),
    getSellerMeta(DB, [sellerId]).catch(() => new Map<number, Record<string, string>>()),
    loadLatestProductCopy(DB, sellerId),
  ])
  return {
    store: mergeStoreProfile({ product: lastProduct, meta: metaMap.get(sellerId), seller }),
    has_product_history: !!lastProduct,
  }
}

// ── GET /stores/context — 이용권 등록 프리필 (2026-08-23 대표 "매장 등록돼 있으면 자동으로") ──
app.get('/stores/context', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
    return c.json({ success: true, data: await loadMergedProfile(c.env.DB, sellerId) })
  } catch (err) {
    return safeError(c, err, '매장 정보를 불러오지 못했습니다', '[seller-stores]')
  }
})

// ── GET/PATCH /stores/:id/profile — 매장 정보 보기·수정 + 전 이용권 전파 (2026-08-23 단일화) ──
//   권한: canOperateStore — 소유자뿐 아니라 위임 운영자도 허용한다. 주소/전화/PIN 은 운영 정보이고,
//   중개(brokered) 등록 매장은 owner 가 아직 없어(owner 승계 3단계 전) owner-only 면 아무도 못 고친다.
app.get('/stores/:id/profile', async (c) => {
  try {
    const userId = await resolveActorUserId(c)
    if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const sellerId = Number(c.req.param('id'))
    if (!Number.isFinite(sellerId) || sellerId <= 0) return c.json({ success: false, error: '잘못된 매장입니다' }, 400)
    const access = await canOperateStore(c.env.DB, userId, sellerId)
    if (!access.ok) return c.json({ success: false, error: '이 매장에 대한 권한이 없습니다' }, 403)
    const merged = await loadMergedProfile(c.env.DB, sellerId)
    // 전파 대상 수 미리 안내 — "저장하면 이용권 N개에 반영" 을 모달이 보여줄 수 있게.
    const cnt = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM products WHERE seller_id = ? AND restaurant_name IS NOT NULL AND restaurant_name != ''`
    ).bind(sellerId).first<{ n: number }>().catch(() => null)
    return c.json({ success: true, data: { ...merged, product_count: Number(cnt?.n) || 0 } })
  } catch (err) {
    return safeError(c, err, '매장 정보를 불러오지 못했습니다', '[seller-stores]')
  }
})

app.patch('/stores/:id/profile', rateLimit({ action: 'store_profile_save', max: 30, windowSec: 3600 }), async (c) => {
  try {
    const userId = await resolveActorUserId(c)
    if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const sellerId = Number(c.req.param('id'))
    if (!Number.isFinite(sellerId) || sellerId <= 0) return c.json({ success: false, error: '잘못된 매장입니다' }, 400)
    const access = await canOperateStore(c.env.DB, userId, sellerId)
    if (!access.ok) return c.json({ success: false, error: '이 매장에 대한 권한이 없습니다' }, 403)
    const b = await c.req.json<{
      name?: string; address?: string; phone?: string; lat?: string | number; lng?: string | number
      verify_pin?: string; kakao_place_url?: string
    }>().catch(() => ({} as Record<string, never>))
    if (b.kakao_place_url && !/^https:\/\/place\.map\.kakao\.com\//.test(String(b.kakao_place_url))) {
      return c.json({ success: false, error: '카카오 플레이스 링크 형식이 아닙니다' }, 400)
    }
    const { propagated } = await saveStoreProfileAndPropagate(c.env.DB, sellerId, {
      name: b.name != null ? String(b.name) : undefined,
      address: b.address != null ? String(b.address) : undefined,
      phone: b.phone != null ? String(b.phone) : undefined,
      lat: b.lat != null ? String(b.lat) : undefined,
      lng: b.lng != null ? String(b.lng) : undefined,
      verify_pin: b.verify_pin != null ? String(b.verify_pin) : undefined,
      kakao_place_url: b.kakao_place_url != null ? String(b.kakao_place_url) : undefined,
    })
    return c.json({ success: true, data: { propagated } })
  } catch (err) {
    return safeError(c, err, '매장 정보 저장에 실패했습니다', '[seller-stores]')
  }
})

// ── POST /stores/verify-business — 국세청 진위확인 (등록 전 사전 검증) ────────────
app.post('/stores/verify-business', rateLimit({ action: 'store_nts_verify', max: 10, windowSec: 300 }), async (c) => {
  try {
    const userId = await resolveActorUserId(c)
    if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const body = await c.req.json<{ business_number?: string; representative?: string; start_date?: string }>().catch(() => ({} as any))
    const bno = String(body.business_number || '').replace(/-/g, '')
    if (!/^\d{10}$/.test(bno)) return c.json({ success: false, error: '사업자번호는 숫자 10자리입니다' }, 400)
    const key = c.env.PUBLIC_DATA_SERVICE_KEY || (c.env as unknown as Record<string, string | undefined>).NTS_API_KEY
    // 대표자+개업일이 있으면 진위확인(validate), 번호만 있으면 휴·폐업 상태조회(status)
    if (body.representative && body.start_date) {
      const r = await ntsValidateBusiness(key, {
        businessNumber: bno, representative: String(body.representative), startDate: String(body.start_date).replace(/-/g, ''),
      })
      return c.json({ success: true, data: { ok: r.ok, valid: r.valid === '01' ? true : r.valid === '02' ? false : null, status: r.status ?? null, message: r.message } })
    }
    const rows = await ntsCheckStatus(key, [bno])
    const row = rows[0]
    // 국세청에 등록 안 된 번호는 b_stt 가 비어 온다 — '미등록' 으로 명시.
    const registered = !!row && !!row.b_stt
    return c.json({ success: true, data: { ok: rows.length >= 0 && !!key, valid: row ? registered : null, status: row?.b_stt ?? null, message: !key ? '검증 키 미설정 — 확인 생략' : registered ? row!.b_stt! : '조회 결과 없음(미등록 가능성)' } })
  } catch (err) {
    return safeError(c, err, '사업자번호 확인 중 오류가 발생했습니다', '[seller-stores]')
  }
})

// ── POST /stores — 매장 등록 (카카오맵 검색 결과 기반) ─────────────────────────────
app.post('/stores', rateLimit({ action: 'store_register', max: 10, windowSec: 3600 }), async (c) => {
  try {
    const userId = await resolveActorUserId(c)
    if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

    const b = await c.req.json<{
      name?: string; address?: string; phone?: string; category?: string
      kakao_place_id?: string; kakao_place_url?: string; lat?: number; lng?: number
      channel?: string
      business_number?: string; representative?: string; business_start_date?: string
    }>().catch(() => ({} as any))

    const name = String(b.name || '').trim()
    if (!name || name.length > 100) return c.json({ success: false, error: '매장명을 입력해주세요 (100자 이내)' }, 400)
    if (!isChannel(b.channel)) {
      return c.json({ success: false, error: '등록 유형을 선택해주세요 — 직접(내 가게) 또는 중개(관리 대행)' }, 400)
    }
    const address = String(b.address || '').trim().slice(0, 200)
    const phone = String(b.phone || '').trim().slice(0, 20)
    const bno = String(b.business_number || '').replace(/-/g, '')
    if (bno && !/^\d{10}$/.test(bno)) return c.json({ success: false, error: '사업자번호는 숫자 10자리입니다' }, 400)

    // 같은 카카오 플레이스 중복 등록 방지 (seller_meta 역조회)
    if (b.kakao_place_id) {
      const dup = await c.env.DB.prepare(
        `SELECT m.seller_id FROM seller_meta m JOIN sellers s ON s.id = m.seller_id
          WHERE m.key = 'kakao_place_id' AND m.value = ? AND s.status != 'suspended' LIMIT 1`
      ).bind(String(b.kakao_place_id)).first<{ seller_id: number }>().catch(() => null)
      if (dup) return c.json({ success: false, error: '이미 유어딜에 등록된 매장입니다', code: 'STORE_EXISTS', seller_id: dup.seller_id }, 409)
    }

    // 국세청 검증 — 통과하면 즉시 승인("그냥 매장 등록하면 돼"), 아니면 pending(어드민 검토)
    let ntsResult: { ok: boolean; valid: boolean | null } = { ok: false, valid: null }
    const key = c.env.PUBLIC_DATA_SERVICE_KEY || (c.env as unknown as Record<string, string | undefined>).NTS_API_KEY
    if (bno && b.representative && b.business_start_date) {
      const r = await ntsValidateBusiness(key, {
        businessNumber: bno, representative: String(b.representative), startDate: String(b.business_start_date).replace(/-/g, ''),
      }).catch(() => null)
      if (r) ntsResult = { ok: r.ok, valid: r.valid === '01' ? true : r.valid === '02' ? false : null }
    } else if (bno) {
      const rows = await ntsCheckStatus(key, [bno]).catch(() => [])
      const row = rows[0]
      // 상태조회는 '등록된 번호인가 + 계속사업자인가' 까지만 본다(대표자 대조는 validate 전용).
      if (key) ntsResult = { ok: true, valid: row?.b_stt ? row.b_stt === '계속사업자' : false }
    }
    const autoApprove = ntsResult.ok && ntsResult.valid === true
    const status = autoApprove ? 'approved' : 'pending'

    // sellers 행 생성 — linked_user_id 는 비움(UNIQUE 1인1행): 접근은 seller_operators 관계로.
    const username = `store_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
    const ins = await c.env.DB.prepare(`
      INSERT INTO sellers (
        username, email, password_hash, name, business_name, business_number,
        phone, address, seller_type, status, created_at, updated_at
      ) VALUES (?, '', '', ?, ?, ?, ?, ?, 'store_owner', ?, datetime('now'), datetime('now'))
    `).bind(username, name, name, bno || null, phone || null, address || null, status).run()
    const newSellerId = Number(ins.meta?.last_row_id)
    if (!Number.isFinite(newSellerId) || newSellerId <= 0) {
      return c.json({ success: false, error: '매장 생성에 실패했습니다' }, 500)
    }

    // 채널·플레이스·검증 스탬프 (sellers 100컬럼 한도 — 전부 seller_meta)
    await setSellerMeta(c.env.DB, newSellerId, {
      store_channel: b.channel,
      ...(b.kakao_place_id ? { kakao_place_id: String(b.kakao_place_id) } : {}),
      ...(b.kakao_place_url ? { kakao_place_url: String(b.kakao_place_url) } : {}),
      ...(b.category ? { kakao_category: String(b.category).slice(0, 100) } : {}),
      ...(Number.isFinite(b.lat) && Number.isFinite(b.lng) ? { store_lat: String(b.lat), store_lng: String(b.lng) } : {}),
      nts_checked: ntsResult.valid === true ? '1' : ntsResult.valid === false ? '0' : '',
      registered_by_user_id: String(userId),
    })

    // 등록자 권한 — 직접=owner / 중개=operator(사장님 자리는 비워 둔다: owner 승계 3단계)
    await grantOperator(c.env.DB, newSellerId, userId, userId, b.channel === 'direct' ? 'owner' : 'operator')

    return c.json({
      success: true,
      data: {
        seller_id: newSellerId, status, channel: b.channel,
        nts: { checked: ntsResult.ok, valid: ntsResult.valid },
        // 승인 전이면 이용권 등록은 가능하되 노출은 승인 후 — 기존 셀러 승인 플로우와 동일 문구
        message: autoApprove
          ? '매장이 등록되었습니다. 바로 이용권을 등록할 수 있어요.'
          : '매장이 등록 접수되었습니다. 사업자 확인 후 활성화됩니다.',
      },
    })
  } catch (err) {
    return safeError(c, err, '매장 등록 중 오류가 발생했습니다', '[seller-stores]')
  }
})

// ── POST /stores/:id/close — 매장 삭제(소프트) — 소유자만 ──────────────────────────
app.post('/stores/:id/close', async (c) => {
  try {
    const userId = await resolveActorUserId(c)
    if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const sellerId = Number(c.req.param('id'))
    if (!Number.isFinite(sellerId) || sellerId <= 0) return c.json({ success: false, error: '잘못된 매장입니다' }, 400)

    const access = await canOperateStore(c.env.DB, userId, sellerId)
    if (!access.ok) return c.json({ success: false, error: '이 매장에 대한 권한이 없습니다' }, 403)

    if (access.role === 'owner') {
      // 소유자: 매장을 닫는다(소프트 — 행 보존: 주문·정산 이력은 남아야 한다).
      // ⚠️ sellers.status CHECK 는 pending/approved/rejected/suspended 만 허용('closed' 는 SqlError 500,
      //    check-status-constraints 가 잡았다) → 허용값 'suspended' 로 노출 차단(소비자 카탈로그가 정지
      //    셀러를 이미 제외)하고, "폐점 vs 어드민 정지" 구분은 seller_meta.closed_at 마커가 담당한다.
      await c.env.DB.prepare(
        `UPDATE sellers SET status = 'suspended', updated_at = datetime('now') WHERE id = ? AND status != 'suspended'`
      ).bind(sellerId).run()
      await setSellerMeta(c.env.DB, sellerId, { closed_at: new Date().toISOString(), closed_by_user_id: String(userId) })
      return c.json({ success: true, data: { closed: true } })
    }
    // 운영자: 매장 자체는 못 닫는다 — 내 목록에서만 뗀다(자기 권한 반납).
    const r = await revokeOperator(c.env.DB, sellerId, userId)
    return c.json({ success: true, data: { closed: false, left: r.changed > 0 } })
  } catch (err) {
    return safeError(c, err, '매장 정리 중 오류가 발생했습니다', '[seller-stores]')
  }
})

// ── POST /stores/:id/channel — 채널 변경 (소유자만 · 수수료가 바뀌는 결정) ───────────
app.post('/stores/:id/channel', async (c) => {
  try {
    const userId = await resolveActorUserId(c)
    if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const sellerId = Number(c.req.param('id'))
    const b = await c.req.json<{ channel?: string }>().catch(() => ({} as any))
    if (!isChannel(b.channel)) return c.json({ success: false, error: '채널은 direct 또는 brokered 입니다' }, 400)
    if (!(await isStoreOwner(c.env.DB, userId, sellerId))) {
      return c.json({ success: false, error: '매장 소유자만 채널을 변경할 수 있습니다' }, 403)
    }
    await setSellerMeta(c.env.DB, sellerId, { store_channel: b.channel })
    return c.json({ success: true, data: { channel: b.channel } })
  } catch (err) {
    return safeError(c, err, '채널 변경 중 오류가 발생했습니다', '[seller-stores]')
  }
})

export { app as sellerStoresRoutes }
