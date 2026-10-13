/**
 * 🏢 에이전시가 **매장을 대신 등록** — 2026-10-11 대표 *"모두 다 하자"*
 *   (결재 `docs/decisions/2026-10-11-agency-ideal-open-questions.md` 안 1 — 대신 등록·운영은 에이전시 계정 하나로).
 *   `agency-stores.routes.ts` 가 `registerAgencyStoreRegisterRoute(agencyStoresRoutes)` 로 얹는다(마운트 추가 없음).
 *
 * ## 무엇을 하나 — 개인 중개 등록(`POST /api/seller/stores` channel=brokered)과 같은 결과, 주인만 바뀐다
 *   ① 매장 행(`status='pending'` — 등록증을 사람이 보고 승인한다. 자동 승인 없음)
 *   ② `agency_store_links` 를 **바로 active** 로 — 등록한 에이전시가 곧 맡은 에이전시다
 *   ③ 손님 셀프 사용 확인코드 + **사장님 승계 코드**(`/store/find?code=`) — 사장님이 오면 소유권 신청 → 어드민 승인
 *   ④ 판매자 이용약관 동의 기록 — 대신 등록한 에이전시 직원 이름으로(`user_id = agency_staff:<id>`)
 *
 * ## 일부러 안 하는 것 (💰 머니 경로 — 3단계, staging 실결제 뒤)
 *   - 에이전시 몫·인플루언서 상한(`saveBrokerTerms`) · 영입자 귀속(`matchProspectOnSignup`) · 소개 링크 귀속.
 *   - 매장 채널은 `brokered`(중개 관리) 로 적는다 — 채널 미지정의 수수료 폴백과 **같은 값**이라 요율이 바뀌지 않는다.
 *
 * 🔐 이 매장엔 `seller_operators` 행이 없다. 들어가는 길은 에이전시 좌석(`/stores/:sellerId/seat`) 하나이고,
 *   `store-seat-guard` 가 매 요청 맡김·직원·에이전시 상태를 다시 본다.
 */
import type { Context, Hono } from 'hono'
import { cors } from 'hono/cors'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { safeError } from '@/worker/utils/safe-error'
import { setSellerMeta } from '@/worker/utils/seller-meta'
import { ntsCheckStatus } from '@/worker/utils/nts-business-verify'
import { BUSINESS_NUMBER_META_KEY, bnoColumnFree, normalizeBno } from '@/worker/utils/seller-business-number'
import { ensureStoreCode } from '@/worker/utils/redemption-settings'
import { getOrIssueOwnerClaimCode, formatStoreCode } from '@/worker/utils/store-codes'
import { isValidTermsVersion, recordTermsConsent } from '@/worker/utils/terms-consent'
import { invalidateStoreSeatCache } from '@/worker/utils/store-seat-guard'
import { ensureAgencyConsoleTables } from './agency-schema'
import { requireAgencyStaff, type AgencyStaffContext } from './agency-session'
import { frontendBase } from './agency-auth.routes'
import { normalizeKakaoPlaceUrl, kakaoPlaceUrlFromId } from '@/shared/kakao-place-url'

type Bindings = { DB: D1Database; JWT_SECRET: string; FRONTEND_URL?: string }
type Vars = { agencyStaff: AgencyStaffContext }
type Ctx = Context<{ Bindings: Bindings; Variables: Vars }>

interface RegisterBody {
  name?: string; address?: string; phone?: string; category?: string
  kakao_place_id?: string; kakao_place_url?: string; lat?: number; lng?: number
  manager_phone?: string; business_number?: string; business_cert_url?: string
  terms_agreed_version?: string
}

/** 사장님 연락처 — 휴대폰만(승인 검토·사용 문의·승계 안내가 닿는 유일한 경로). 셀러 등록 문과 같은 규칙. */
export function normalizeOwnerPhone(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 11)
}
export const isOwnerPhone = (digits: string) => /^01\d{8,9}$/.test(digits)

/** 행이 생기기 **전에** 거르는 것들 — 실패면 사람이 읽을 문장. */
export function validateAgencyStoreBody(b: RegisterBody): string | null {
  const name = String(b.name || '').trim()
  if (!name || name.length > 100) return '매장명을 입력해주세요 (100자 이내)'
  if (!isOwnerPhone(normalizeOwnerPhone(b.manager_phone))) return '사장님 휴대폰 번호(01x)를 입력해주세요'
  const bno = String(b.business_number || '').replace(/-/g, '')
  if (bno && !/^\d{10}$/.test(bno)) return '사업자번호는 숫자 10자리입니다'
  const cert = String(b.business_cert_url || '').trim()
  if (cert && !/^\/api\/media\/uploads\/biz-cert\//.test(cert)) return '사업자등록증 사본이 올바르지 않습니다'
  if (!isValidTermsVersion(b.terms_agreed_version)) return '판매자 이용약관에 동의해주세요. 화면을 새로고침한 뒤 다시 시도해주세요.'
  return null
}

export function registerAgencyStoreRegisterRoute(app: Hono<{ Bindings: Bindings; Variables: Vars }>) {
  app.post('/stores/register', cors(), requireAgencyStaff({ adminOnly: true }),
    rateLimit({ action: 'agency_store_register', max: 20, windowSec: 3600 }), async (c: Ctx) => {
      try {
        const me = c.get('agencyStaff')
        const DB = c.env.DB
        const b = await c.req.json<RegisterBody>().catch(() => ({} as RegisterBody))
        const invalid = validateAgencyStoreBody(b)
        if (invalid) return c.json({ success: false, error: invalid }, 400)
        await ensureAgencyConsoleTables(DB)

        const name = String(b.name).trim()
        const managerPhone = normalizeOwnerPhone(b.manager_phone)
        const bno = String(b.business_number || '').replace(/-/g, '')
        const certUrl = String(b.business_cert_url || '').trim()

        // 이미 유어딜에 있는 가게면 새로 만들지 않는다 — 그 사장님께 초대 링크로 [맡기기]를 받는다.
        if (b.kakao_place_id) {
          const dup = await DB.prepare(
            `SELECT m.seller_id FROM seller_meta m JOIN sellers s ON s.id = m.seller_id
              WHERE m.key = 'kakao_place_id' AND m.value = ? AND s.status != 'suspended' LIMIT 1`,
          ).bind(String(b.kakao_place_id)).first<{ seller_id: number }>().catch(() => null)
          if (dup) {
            return c.json({ success: false, code: 'STORE_EXISTS',
              error: '이미 유어딜에 있는 매장이에요. 초대 링크를 사장님께 보내 [맡기기]를 받아 주세요.' }, 409)
          }
        }

        // 국세청 상태조회 — 심사 재료일 뿐 자동 승인 근거가 아니다(셀러 등록 문과 같다).
        const env = c.env as unknown as Record<string, string | undefined>
        const ntsKey = env.PUBLIC_DATA_SERVICE_KEY || env.NTS_API_KEY
        let ntsChecked = ''
        if (bno && ntsKey) {
          const row = (await ntsCheckStatus(ntsKey, [bno]).catch(() => []))[0]
          ntsChecked = row?.b_stt === '계속사업자' ? '1' : '0'
        }

        const username = `store_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
        const insert = (withBno: string | null) => DB.prepare(`
          INSERT INTO sellers (username, email, password_hash, name, business_name, business_number,
                               phone, address, seller_type, status, created_at, updated_at)
          VALUES (?, ?, '', ?, ?, ?, ?, ?, 'store_owner', 'pending', datetime('now'), datetime('now'))
        `).bind(username, `${username}@store.invalid`, name, name, withBno,
          String(b.phone || '').trim().slice(0, 20) || null, String(b.address || '').trim().slice(0, 200) || null).run()
        const bnoFree = bno ? await bnoColumnFree(DB, bno) : false
        let ins = await insert(bnoFree ? bno : null).catch((e: unknown) => e as Error)
        if (ins instanceof Error && bnoFree) ins = await insert(null).catch((e: unknown) => e as Error)
        if (ins instanceof Error) return safeError(c, ins, '매장 등록 중 오류가 발생했어요', '[agency-console:register]')
        const sellerId = Number(ins.meta?.last_row_id)
        if (!Number.isInteger(sellerId) || sellerId <= 0) return c.json({ success: false, error: '매장 생성에 실패했어요' }, 500)

        // 맡김 — 이게 없으면 방금 만든 매장에 아무도 못 들어간다(seller_operators 행이 없다). 한 번 더 시도.
        const link = () => DB.prepare(
          `INSERT INTO agency_store_links (agency_id, seller_id, status, decided_by_staff_id, accepted_at)
           VALUES (?, ?, 'active', ?, datetime('now'))`,
        ).bind(me.agencyId, sellerId, me.staffId).run().then(() => true).catch(() => false)
        if (!(await link()) && !(await link())) {
          return c.json({ success: false,
            error: `매장(#${sellerId})은 등록됐지만 연결에 실패했어요. 다시 등록하지 마시고 고객센터로 매장 번호를 알려주세요.`,
            data: { seller_id: sellerId } }, 500)
        }

        // 🔑 저장할 장소 주소: URL 에서 id 를 뽑을 수 있으면 정본으로, 못 뽑으면(`kko.to`) 받아 둔 id 로.
        const agencyPlaceUrl = normalizeKakaoPlaceUrl(b.kakao_place_url)
          ?? kakaoPlaceUrlFromId(b.kakao_place_id)
        await setSellerMeta(DB, sellerId, {
          store_channel: 'brokered', // = 채널 미지정 수수료 폴백과 같은 값(요율 불변)
          manager_phone: managerPhone,
          ...(b.kakao_place_id ? { kakao_place_id: String(b.kakao_place_id) } : {}),
          // 🔒 2026-10-13 — 생 `String` 이라 아무 도메인이나 저장됐다. SSOT 경유.
          // 🔑 URL 로 id 를 못 뽑으면(`kko.to`) 받아 둔 id 로 정본을 만든다(네트워크 왕복 0).
          ...(agencyPlaceUrl ? { kakao_place_url: agencyPlaceUrl } : {}),
          ...(b.category ? { kakao_category: String(b.category).slice(0, 100) } : {}),
          ...(Number.isFinite(b.lat) && Number.isFinite(b.lng) ? { store_lat: String(b.lat), store_lng: String(b.lng) } : {}),
          nts_checked: ntsChecked,
          ...(bno ? { [BUSINESS_NUMBER_META_KEY]: normalizeBno(bno) } : {}),
          ...(certUrl ? { business_cert_url: certUrl } : {}),
          registered_by_agency_id: String(me.agencyId),
          registered_by_agency_staff_id: String(me.staffId),
        }).catch(() => { /* 메타는 나중에 매장 정보에서 채운다 — 매장은 이미 있다 */ })
        if (certUrl) {
          await DB.prepare("UPDATE sellers SET business_registration_image_url = ? WHERE id = ? AND COALESCE(business_registration_image_url, '') = ''")
            .bind(certUrl, sellerId).run().catch(() => null)
        }

        await ensureStoreCode(DB, sellerId)
        // created_by 는 사람 id 칸이다 — 에이전시 발급이라 0(이 칸을 읽는 코드는 없다).
        const claim = await getOrIssueOwnerClaimCode(DB, sellerId, 0).catch(() => null)
        const claimCode = claim ? formatStoreCode(claim.code) : null
        await recordTermsConsent(DB, {
          subjectType: 'seller', subjectId: sellerId, userId: `agency_staff:${me.staffId}`,
          slug: 'seller', version: String(b.terms_agreed_version), ip: c.req.header('CF-Connecting-IP') || null,
        })
        invalidateStoreSeatCache(DB, sellerId)

        return c.json({ success: true, data: {
          seller_id: sellerId, status: 'pending', owner_claim_code: claimCode,
          owner_claim_url: claimCode ? `${frontendBase(c.env)}/store/find?code=${encodeURIComponent(claimCode)}` : null,
          message: certUrl ? '매장이 접수됐어요. 사업자등록증을 확인한 뒤 승인됩니다.' : '매장이 접수됐어요. 사업자등록증을 올리면 심사가 시작됩니다.',
        } })
      } catch (err) {
        return safeError(c, err, '매장 등록 중 오류가 발생했어요', '[agency-console:register]')
      }
    })
}
