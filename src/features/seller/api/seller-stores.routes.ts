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
import { ensureSellerMetaTable, getSellerMeta, setSellerMeta } from '@/worker/utils/seller-meta'
import { ntsValidateBusiness, ntsCheckStatus } from '@/worker/utils/nts-business-verify'
import { canOperateStore, grantOperator, revokeOperator, isStoreOwner, listOperableStores } from '../../../worker/utils/seller-operators'
import { mergeStoreProfile, loadLatestProductCopy, saveStoreProfileAndPropagate } from '@/worker/utils/store-profile'
import { parseSessionCookie } from '@/worker/utils/session'
import { DEFAULT_FEE_RATES } from '@/worker/utils/fee-resolver'
import { getEffectivePlatformFee } from '@/worker/utils/effective-platform-fee'
import { registerVoucherDraftRoutes } from './seller-voucher-draft.routes'

const app = new Hono<{ Bindings: Env }>()
type Ctx = Context<{ Bindings: Env }>

export type StoreChannel = 'direct' | 'brokered'
const isChannel = (v: unknown): v is StoreChannel => v === 'direct' || v === 'brokered'

/**
 * ☎️ 담당자 전화번호 (2026-08-26 대표 "매장 등록 과정에서 담당자 전화번호도 등록되게끔")
 *
 * 매장 대표번호(`store_phone`, 카카오맵에서 자동입력 · 소비자에게 노출)와 **다른 값**이다:
 * 이건 그 매장을 실제로 운영·관리하는 **사람**의 연락처 — 사용 문의·정산 확인·승인 검토처럼
 * 매장 계정 뒤의 사람에게 닿아야 할 때 쓴다.
 *
 * ⚠️ **상품(products)에 전파하지 않는다.** store-profile 전파는 소비자에게 보이는 매장 복사본을
 * 맞추는 장치인데, 담당자 번호는 개인 연락처라 소비자 화면에 실려선 안 된다 → `seller_meta` 에만 둔다.
 * 그래서 saveStoreProfileAndPropagate 가 아니라 setSellerMeta 로 따로 저장한다.
 */
function normalizeManagerPhone(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 11)
}
/** 휴대폰(01x, 10~11자리) — 담당자는 실제로 연락이 닿아야 하므로 대표번호(지역번호)는 받지 않는다. */
const isManagerPhone = (digits: string) => /^01\d{8,9}$/.test(digits)

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

// ── 후기 보너스 — 매장이 직접 정한다 (2026-08-31 대표 "매장 사장님이 부담하게끔") ──────
//   카카오 지도의 별점·리뷰는 **그 매장 자산**이다. 유어딜이 매장 마케팅비를 대신 낼 이유가 없다.
//   ⚠️ 값을 넣기 전까지는 플랫폼 기본값 그대로다 — 안 만지면 오늘과 동일.
//   ⚠️ **정산 차감은 아직 안 붙었다**(게이트 review_bonus_owner_funded 기본 OFF, 머니 경로라 별도 세션).
app.get('/review-bonus', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
    const { resolveReviewBonus } = await import('../../group-buy/api/review-bonus-funding')
    const p = await resolveReviewBonus(c.env.DB, sellerId)
    return c.json({ success: true, data: { amount: p.amount, store_set: p.storeSet, funded_by: p.fundedBy } })
  } catch (err) {
    return safeError(c, err, '후기 보너스 설정을 불러오지 못했습니다', '[seller-stores]')
  }
})

app.patch('/review-bonus', rateLimit({ action: 'review_bonus_set', max: 30, windowSec: 3600 }), async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
    const body = await c.req.json<{ amount?: unknown }>().catch(() => ({} as { amount?: unknown }))
    // null = 매장 설정 해제(플랫폼 기본값으로 되돌림). 없는 필드는 400 — 오타로 해제되지 않게.
    if (!('amount' in body)) return c.json({ success: false, error: 'amount 를 보내세요 (해제하려면 null).' }, 400)
    const raw = body.amount
    let value: string | null = null
    if (raw !== null) {
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 0 || n > 100_000) {
        return c.json({ success: false, error: '0 이상 100,000 이하의 정수를 입력하세요' }, 400)
      }
      value = String(n)
    }
    const { REVIEW_BONUS_META_KEY, resolveReviewBonus } = await import('../../group-buy/api/review-bonus-funding')
    await ensureSellerMetaTable(c.env.DB)
    await setSellerMeta(c.env.DB, sellerId, { [REVIEW_BONUS_META_KEY]: value })
    const p = await resolveReviewBonus(c.env.DB, sellerId)
    return c.json({ success: true, data: { amount: p.amount, store_set: p.storeSet, funded_by: p.fundedBy } })
  } catch (err) {
    return safeError(c, err, '후기 보너스 설정을 저장하지 못했습니다', '[seller-stores]')
  }
})

// ── GET /fee-context — 현재 매장의 채널·수수료율 (이용권 등록 실수령가 계산용) ──────
app.get('/fee-context', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
    const meta = await getSellerMeta(c.env.DB, [sellerId])
    const channel: StoreChannel = meta.get(sellerId)?.store_channel === 'direct' ? 'direct' : 'brokered'
    // 🩸 2026-08-27 정정: 여기 있던 주석은 *"loadFeeRates SSOT 라 표시·정산이 갈릴 수 없다"* 였는데
    //   **틀렸다.** 같은 값을 읽는 건 맞지만 **그 값이 결제 분배에 안 쓰인다** —
    //   결제는 `getSellerCommissionRate`(채널 무시)를 쓰고, 채널 요율은 게이트 뒤에 있으며 꺼져 있다.
    //   그래서 직접(10%)을 고른 매장이 실수령 카드에서 10% 를 빼고 봤지만 실제로는 5% 만 떼였다.
    //   ⇒ 이제 **결제가 부르는 그 함수**를 불러 사실대로 돌려준다.
    const fee = await getEffectivePlatformFee(c.env.DB, sellerId, channel)
    return c.json({
      success: true,
      data: {
        channel,
        platform_fee_pct: fee.pct,                       // 지금 실제로 떼이는 %
        channel_rates_active: fee.channelRatesActive,    // false 면 아래 설계값은 아직 미적용
        channel_pct: fee.channelPct,                     // 채널 요율이 켜졌을 때의 설계값
        direct_pct: DEFAULT_FEE_RATES.platformPctDirect,
        brokered_pct: DEFAULT_FEE_RATES.platformPct,
      },
    })
  } catch (err) {
    return safeError(c, err, '수수료 정보를 불러오지 못했습니다', '[seller-stores]')
  }
})

// 💾 이용권 임시저장(/voucher-draft) 은 별도 모듈로 — 매장 프로필·등록과 무관한 위저드 자동저장이라
//   god-파일 래칫(600줄)에 걸렸을 때 가장 자연스러운 이음매였다. **경로·동작 불변**(같은 앱에 등록).
registerVoucherDraftRoutes(app)

// ── 매장 프로필 병합(공유) — SSOT: worker/utils/store-profile.ts (2026-08-23 단일화) ────────
async function loadMergedProfile(DB: D1Database, sellerId: number) {
  const [seller, metaMap, lastProduct, liveStore] = await Promise.all([
    DB.prepare('SELECT name, business_name, phone, address FROM sellers WHERE id = ? LIMIT 1')
      .bind(sellerId).first<{ name: string | null; business_name: string | null; phone: string | null; address: string | null }>()
      .catch(() => null),
    getSellerMeta(DB, [sellerId]).catch(() => new Map<number, Record<string, string>>()),
    loadLatestProductCopy(DB, sellerId),
    // 🔎 게이트 전용 신호 — **판매 중인** 매장 상품이 있는가. 프리필용 lastProduct 와 분리한 이유는
    //   아래 주석 참조(판매중지한 상품의 매장 정보는 프리필에는 여전히 쓸모가 있다).
    DB.prepare(
      `SELECT COUNT(*) AS n FROM products
        WHERE seller_id = ? AND is_active = 1 AND restaurant_name IS NOT NULL AND restaurant_name != ''`
    ).bind(sellerId).first<{ n: number }>().catch(() => null),
  ])
  const meta = metaMap.get(sellerId) || {}
  // 🚪 2026-08-24 대표 "대시보드 첫 단계는 매장 등록 — 선행 없이는 다음 단계 이용 불가":
  //   이 좌석이 '등록된 매장'인가의 서버 판정. 주소/등록 채널/좌표 중 하나라도 있으면 매장이고,
  //   **실제로 매장을 운영 중인 좌석은 무조건 통과** — 게이트 신설이 기존 실운영 셀러를 잠그는
  //   사고(lock-out 클래스)를 구조적으로 차단한다.
  //
  //   ⚠️ 2026-08-26 정정: 이 grandfather 를 '매장명 붙은 상품이 하나라도 있었나'(lastProduct)로 봤는데,
  //   그러면 **상품을 전부 판매중지해도 영원히 매장으로 남아** 온보딩으로 돌아갈 길이 없다.
  //   판정은 '지금 판매 중인가'(is_active=1)로 본다 — 판매중지는 되돌릴 수 있으므로 이 판정도 되돌아온다.
  //   주소·등록 채널·좌표(= 정식 매장 등록의 산물)를 가진 매장은 상품 0 이어도 통과라 영향 없다.
  const store_ready = !!(seller?.address || meta.store_channel || meta.store_lat || Number(liveStore?.n) > 0)
  return {
    store: mergeStoreProfile({ product: lastProduct, meta, seller }),
    // 담당자 연락처는 store(전파 대상) 밖에 둔다 — 소비자 복사본에 실리면 안 되는 개인 연락처다.
    manager_phone: meta.manager_phone || '',
    has_product_history: !!lastProduct,
    store_ready,
  }
}

// ── GET /stores/context — 이용권 등록 프리필 (2026-08-23 대표 "매장 등록돼 있으면 자동으로") ──
app.get('/stores/context', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
    const data = await loadMergedProfile(c.env.DB, sellerId)

    /**
     * 🚪 2026-09-02 (대표 신고 "이렇게 왜 뜨지? 매장 정보 입력도 다 했는데?" — 위저드가 계속
     *   *"첫 단계는 매장 등록이에요"* 를 띄웠다).
     *
     * `loadMergedProfile` 의 `store_ready` 는 **지금 앉아 있는 좌석**만 본다. 그런데 매장은 별도
     * `sellers` 행이고, 사람은 `seller_operators`(또는 `linked_user_id`)로 그 좌석에 접근한다.
     * ⇒ **매장을 이미 운영 중인데 개인 좌석에 앉아 있으면** 게이트가 "매장을 등록하라"고 요구했다.
     *   라이브 실측(2026-09-02): user 3 은 매장 14(홍대돈까스)의 운영자인데 좌석은 5(개인)라 게이트가 닫혔다.
     *   그 상태에서 등록을 다시 시도해도 **중복 매장**이 생길 뿐 — 시킨 대로 해도 해결되지 않는 막다른 길이었다.
     *
     * ⇒ 판정을 **사람 기준**으로 넓힌다: 운영 가능한 매장이 하나라도 있으면 게이트를 연다.
     *   `operable_store_count` 를 함께 실어, 화면이 "등록하세요" 대신 **"어느 매장인가요"(좌석 전환)** 로
     *   말을 바꿀 수 있게 한다 — 게이트를 여는 것과 *무엇을 하라고 말할지*는 다른 문제다.
     * ⚠️ 게이트만 넓히고 권한은 넓히지 않는다 — 실제 귀속은 좌석 토큰(`/stores/:id/token`)이 정하고
     *   그 토큰은 `canOperateStore` 를 통과해야만 나온다(이 응답은 판정에 관여하지 않는다).
     */
    let operableCount = 0
    try {
      const userId = await resolveActorUserId(c)
      if (userId) {
        const mine = await listOperableStores(c.env.DB, userId)
        /**
         * ⚠️ **앉을 수 있는 매장만 센다.** 신규 등록은 `status='pending'`(사람이 등록증을 보고 승인)
         *   이고, 좌석 토큰(`/stores/:id/token`)은 `active|approved` 만 내준다. 승인 대기 매장까지 세면
         *   게이트가 열리는데 좌석 전환은 거부되어 — **이용권이 개인 좌석으로 등록된다.** 막히는 것보다
         *   나쁘다(잘못된 매장으로 팔린다). 그 상태의 올바른 안내는 "승인 후 가능" 이고, 그건 지금도
         *   등록 직후 토스트가 말한다.
         */
        operableCount = mine.filter(x => x.status === 'active' || x.status === 'approved').length
      }
    } catch { /* 판정 실패는 조용히 — 아래에서 좌석 판정만 쓴다(fail-open 아님, 종전 동작) */ }

    return c.json({
      success: true,
      data: { ...data, store_ready: data.store_ready || operableCount > 0, operable_store_count: operableCount },
    })
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
      verify_pin?: string; kakao_place_url?: string; manager_phone?: string
    }>().catch(() => ({} as Record<string, never>))
    if (b.kakao_place_url && !/^https:\/\/place\.map\.kakao\.com\//.test(String(b.kakao_place_url))) {
      return c.json({ success: false, error: '카카오 플레이스 링크 형식이 아닙니다' }, 400)
    }
    // 담당자 전화번호 — seller_meta 전용(전파 금지, 위 normalizeManagerPhone 주석 참조).
    if (b.manager_phone != null) {
      const mp = normalizeManagerPhone(b.manager_phone)
      if (mp && !isManagerPhone(mp)) {
        return c.json({ success: false, error: '담당자 전화번호는 휴대폰 번호(01x)로 입력해주세요' }, 400)
      }
      if (mp) await setSellerMeta(c.env.DB, sellerId, { manager_phone: mp })
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
      channel?: string; manager_phone?: string
      business_number?: string; representative?: string; business_start_date?: string
      business_cert_url?: string
      /** 🤝 2026-08-27: 소개자 초대 링크(`/store/new?ref=`)로 들어온 경우의 소개자 user id. */
      referrer_user_id?: string
    }>().catch(() => ({} as any))

    const name = String(b.name || '').trim()
    if (!name || name.length > 100) return c.json({ success: false, error: '매장명을 입력해주세요 (100자 이내)' }, 400)
    if (!isChannel(b.channel)) {
      return c.json({ success: false, error: '등록 유형을 선택해주세요 — 직접(내 가게) 또는 중개(관리 대행)' }, 400)
    }
    // 담당자 전화번호는 **필수** — 매장 뒤의 사람에게 닿는 유일한 경로다(승인 검토·사용 문의·정산 확인).
    // 선택으로 두면 아무도 안 넣고, 정작 필요한 순간엔 카카오맵에서 긁어 온 대표번호밖에 안 남는다.
    const managerPhone = normalizeManagerPhone(b.manager_phone)
    if (!isManagerPhone(managerPhone)) {
      return c.json({ success: false, error: '담당자 전화번호를 휴대폰 번호(01x)로 입력해주세요' }, 400)
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

    /**
     * 📄 사업자등록증 사본 — **필수** (2026-08-26 대표 "당근마켓 플로우 정도로 하자").
     *
     * 🩸 종전엔 **사업자번호만으로 자동 승인**됐다(번호가 '계속사업자'이기만 하면 approved).
     *   인터넷에 공개된 아무 사업자번호나 통과했고, 실제로 그렇게 승인된 매장이 라이브에 있었다
     *   (id=14, nts_checked=1). 번호와 그 매장 사이의 연결은 아무도 확인하지 않았다.
     *
     * 당근도 개업일·대표자명을 타이핑시키지 않고 **등록증 사진을 받아 사람이 심사**한다(시안 05).
     * 그래서 여기도 같은 모양으로: 사진을 받고 **항상 pending** → 어드민 승인(AdminPage.approveSeller).
     * 국세청 번호 조회는 그대로 돌리되 **승인 근거가 아니라 심사 재료**로만 쓴다(meta 스탬프).
     */
    const certUrl = String(b.business_cert_url || '').trim()
    if (!/^\/api\/media\/uploads\/biz-cert\//.test(certUrl)) {
      return c.json({ success: false, error: '사업자등록증 사본을 첨부해주세요' }, 400)
    }

    // 국세청 조회 — 심사 재료(어드민이 볼 신호). 이 결과로 자동 승인하지 않는다.
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
    // ⚠️ 자동 승인 없음 — 등록증을 사람이 보고 승인한다.
    const status = 'pending'

    // sellers 행 생성 — linked_user_id 는 비움(UNIQUE 1인1행): 접근은 seller_operators 관계로.
    const username = `store_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
    /**
     * 🩸 2026-09-02 (대표 신고 "매장 등록 중 오류가 발생했습니다" — **두 번째 매장부터 100% 실패**했다).
     *
     * `sellers` 에는 `CREATE UNIQUE INDEX idx_sellers_email_unique ON sellers(email) WHERE email IS NOT NULL`
     * 이 걸려 있는데, 여기서 email 을 **빈 문자열** 로 넣고 있었다. `''` 은 NULL 이 **아니라서** 부분 인덱스에
     * 포함된다 → 첫 매장은 통과하고(그 슬롯을 차지) **그 다음 등록은 전부 UNIQUE 위반 → catch → 알럿**.
     * 라이브 실측: `email=''` 인 셀러가 정확히 1행(id=14) 있었고, 그 뒤 등록이 아무도 성공하지 못했다.
     *
     * NULL 로 두면 인덱스를 피하지만 컬럼이 **NOT NULL** 이라 불가. ⇒ 매장마다 **고유한 합성 주소**를 넣는다.
     * `.invalid` 는 RFC 6761 이 "절대 해석되지 않는다"고 예약한 TLD 라, 실수로 발송되는 일이 구조적으로 없다.
     * ⚠️ 카카오 same-email 셀러 자동연결(`LOWER(email)=LOWER(?)`)은 실제 유저 이메일과 대조하므로
     *   이 합성 주소와는 영원히 안 맞는다 — 매장이 남의 계정에 붙는 사고가 생기지 않는다.
     */
    const storeEmail = `${username}@store.invalid`
    const ins = await c.env.DB.prepare(`
      INSERT INTO sellers (
        username, email, password_hash, name, business_name, business_number,
        phone, address, seller_type, status, created_at, updated_at
      ) VALUES (?, ?, '', ?, ?, ?, ?, ?, 'store_owner', ?, datetime('now'), datetime('now'))
    `).bind(username, storeEmail, name, name, bno || null, phone || null, address || null, status).run()
    const newSellerId = Number(ins.meta?.last_row_id)

    // 🤝 2026-08-27 (대표 "매장 영입을 어떻게 확인하나") — **초대 링크 귀속**.
    //   그 전엔 `introduced_by_influencer_id` 를 세팅하는 길이 **어드민 수동 지정 하나뿐**이라,
    //   2% 영입 보상을 약속해 놓고 대표가 매번 손으로 넣어야 했고 분쟁 시 근거도 없었다.
    //   소개자가 뿌린 링크로 들어온 매장은 여기서 자동 귀속된다 — 근거가 등록 순간에 남는다.
    //
    //   ⚠️ 검증 셋을 다 통과해야 적는다:
    //     (1) 실재하는 유저여야 한다 — 임의 문자열이 들어오면 지급 대상이 유령이 된다
    //     (2) 본인이 자기 매장을 영입할 수는 없다(자가 커미션 루프)
    //     (3) 실패는 조용히 넘긴다 — 귀속이 안 됐다고 매장 등록을 막을 이유는 없다
    //   기산점(`introduced_at`)이 곧 **1년 유효기간의 시작**이라 등록 시각으로 함께 박는다.
    const refRaw = String(b.referrer_user_id || '').trim().slice(0, 64)
    if (newSellerId && refRaw && refRaw !== String(userId)) {
      const refUser = await c.env.DB.prepare('SELECT id FROM users WHERE id = ? LIMIT 1')
        .bind(refRaw).first<{ id: string }>().catch(() => null)
      if (refUser?.id) {
        await c.env.DB.prepare(
          `UPDATE sellers SET introduced_by_influencer_id = ?, introduced_at = datetime('now')
            WHERE id = ? AND introduced_by_influencer_id IS NULL`,
        ).bind(String(refUser.id), newSellerId).run().catch(() => { /* 귀속 실패가 등록을 막지 않는다 */ })
      }
    }
    if (!Number.isFinite(newSellerId) || newSellerId <= 0) {
      return c.json({ success: false, error: '매장 생성에 실패했습니다' }, 500)
    }

    /**
     * 🩸 2026-09-02 (전수조사) — **행이 만들어진 뒤의 실패는 앞의 실패와 성격이 다르다.**
     *
     * 여기 아래 두 단계(`setSellerMeta` · `grantOperator`)는 아무 가드가 없어서, 하나라도 던지면
     * 바깥 catch 가 잡아 **"매장 등록 중 오류가 발생했습니다"** 를 낸다. 그런데 `sellers` 행은
     * **이미 만들어져 있다.** 사용자는 실패로 알고 다시 누르고 → **같은 가게가 두 번 등록**된다.
     * (①의 UNIQUE 버그를 고치고 나면 재시도가 실제로 성공해 버리므로, 이 갭이 그때부터 진짜 문제다.)
     *
     * 둘의 무게가 다르므로 다르게 다룬다:
     *   • 메타(채널·좌표·플레이스) — **없어도 매장은 매장이다.** 나중에 프로필 수정으로 채워진다.
     *     ⇒ fail-soft. 이것 때문에 등록을 통째로 되돌릴 이유가 없다.
     *   • 권한(`grantOperator`) — **이게 실패하면 방금 만든 매장에 아무도 못 들어간다.**
     *     `linked_user_id` 는 설계상 비워 두므로 접근 경로가 `seller_operators` 하나뿐이다.
     *     ⇒ 1회 재시도. 그래도 실패하면 **"실패" 라고 말하지 않는다** — 매장은 존재하니까.
     *       재시도를 부추기지 않는 별개 문구 + 매장 번호를 돌려줘 운영이 손으로 붙일 수 있게 한다.
     */
    // 채널·플레이스·검증 스탬프 (sellers 100컬럼 한도 — 전부 seller_meta)
    await setSellerMeta(c.env.DB, newSellerId, {
      store_channel: b.channel,
      manager_phone: managerPhone,
      ...(b.kakao_place_id ? { kakao_place_id: String(b.kakao_place_id) } : {}),
      ...(b.kakao_place_url ? { kakao_place_url: String(b.kakao_place_url) } : {}),
      ...(b.category ? { kakao_category: String(b.category).slice(0, 100) } : {}),
      ...(Number.isFinite(b.lat) && Number.isFinite(b.lng) ? { store_lat: String(b.lat), store_lng: String(b.lng) } : {}),
      nts_checked: ntsResult.valid === true ? '1' : ntsResult.valid === false ? '0' : '',
      business_cert_url: certUrl,
      registered_by_user_id: String(userId),
    }).catch(() => { /* 메타 실패 — 매장은 유지(프로필 수정으로 채울 수 있다) */ })

    // 등록자 권한 — 직접=owner / 중개=operator(사장님 자리는 비워 둔다: owner 승계 3단계)
    const role = b.channel === 'direct' ? 'owner' : 'operator'
    let granted = await grantOperator(c.env.DB, newSellerId, userId, userId, role).then(() => true).catch(() => false)
    if (!granted) {
      granted = await grantOperator(c.env.DB, newSellerId, userId, userId, role).then(() => true).catch(() => false)
    }
    if (!granted) {
      return c.json({
        success: false,
        // ⚠️ "등록 실패" 가 아니다 — 매장은 만들어졌다. 다시 누르면 중복만 생긴다.
        error: `매장(#${newSellerId})은 등록됐지만 권한 연결에 실패했어요. 다시 등록하지 마시고 고객센터로 매장 번호를 알려주세요.`,
        data: { seller_id: newSellerId, status, channel: b.channel, operator_granted: false },
      }, 500)
    }

    return c.json({
      success: true,
      data: {
        seller_id: newSellerId, status, channel: b.channel,
        nts: { checked: ntsResult.ok, valid: ntsResult.valid },
        message: '매장이 등록 접수되었습니다. 사업자등록증 확인 후 활성화됩니다.',
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
