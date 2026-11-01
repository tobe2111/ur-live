/**
 * 🚪 생활 업체 한 번에 가입 — `POST /api/home-service/pro/signup` (2026-10-25 대표 *"생활 관련 업체는 가입 쉽게"*).
 *
 * 종전엔 생활 업체도 이용권 매장과 같은 문(`/store/new` — 카카오맵 가게 찾기·등록 유형·담당자·약관)을
 * 먼저 지나야 견적을 받을 수 있었다. 청소·이사·방역 업체는 대개 카카오맵에 가게가 없어 거기서 막힌다.
 * ⇒ **카카오 로그인 한 번 + 한 화면**(상호 · 하는 일 · 지역 · 알림 번호 · 약관 동의)으로 끝낸다.
 *
 * - 이미 내 가게(주인 좌석·연결 계정)가 있으면 **새로 만들지 않고** 그 가게에 생활 업체 정보만 붙인다.
 * - 새로 만드는 매장은 `pending`(심사 전) — 그래도 견적은 낸다(`proStatusOpen`). 손님은 견적 카드의
 *   `사업자 인증` 표시로 심사를 마친 업체를 구분한다. 이용권 판매·메인 노출은 여전히 승인 뒤다.
 * - 표식 `life_pro_signup=1`(seller_meta) — 어드민이 "생활 업체로 들어온 매장" 을 구분한다.
 *
 * ⚠️ 매장 행이 만들어진 **뒤** 실패는 "실패" 라고 말하지 않는다 — 다시 누르면 중복만 생긴다
 *   (`seller-stores.routes.ts` POST /stores 와 같은 규칙).
 */
import type { Context } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { parseSessionCookie } from '@/worker/utils/session'
import { setSellerMeta } from '@/worker/utils/seller-meta'
import { findOwnerSeatSellerId, grantOperator } from '../../../worker/utils/seller-operators'
import { isValidTermsVersion, recordTermsConsent } from '@/worker/utils/terms-consent'
import { proStatusOpen } from '@/shared/home-service'
import { ensureHomeServiceTables } from './home-service-db'
import { parseProBody, saveProProfile } from './home-service-pro-profile'

type Ctx = Context<{ Bindings: Env }>

/** 상호 — 2~40자. 손님 견적 카드에 그대로 뜬다. */
export function normalizeProName(raw: unknown): string | null {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim()
  return s.length >= 2 && s.length <= 40 ? s : null
}

async function sessionUserId(c: Ctx): Promise<number | null> {
  const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user']).catch(() => null)
  const id = Number(sess?.userId)
  return Number.isFinite(id) && id > 0 ? id : null
}

/** 이미 내 가게가 있으면 그 번호 — 연결 계정(`linked_user_id`)이 먼저, 그다음 주인 좌석. */
async function existingStore(DB: D1Database, userId: number): Promise<number | null> {
  const linked = await DB.prepare(`SELECT id FROM sellers WHERE linked_user_id = ? ORDER BY id LIMIT 1`)
    .bind(userId).first<{ id: number }>().catch(() => null)
  if (linked?.id) return Number(linked.id)
  return findOwnerSeatSellerId(DB, userId)
}

export async function proSignupHandler(c: Ctx) {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const userId = await sessionUserId(c)
    if (!userId) return c.json({ success: false, error: '카카오로 먼저 로그인해 주세요' }, 401)
    const body = await c.req.json<{
      business_name?: unknown; categories?: unknown; areas?: unknown; phone?: unknown; terms_agreed_version?: unknown
    }>().catch(() => ({} as Record<string, unknown>))

    // 하는 일·지역은 매장 행을 만들기 **전에** 거른다 — 거기서 막히면 빈 매장만 남는다.
    const parsed = parseProBody(body)
    if (!parsed.ok) return c.json({ success: false, error: parsed.error }, 400)

    let sid = await existingStore(DB, userId)
    let created = false
    if (sid) {
      const st = await DB.prepare(`SELECT status FROM sellers WHERE id = ?`).bind(sid).first<{ status: string }>()
      if (!proStatusOpen(st?.status)) return c.json({ success: false, error: '지금은 이 계정으로 견적을 받을 수 없어요. 고객센터로 문의해 주세요' }, 403)
    } else {
      const name = normalizeProName(body.business_name)
      if (!name) return c.json({ success: false, error: '상호를 2~40자로 적어 주세요' }, 400)
      if (!isValidTermsVersion(body.terms_agreed_version)) return c.json({ success: false, code: 'TERMS_REQUIRED', error: '이용약관에 동의해 주세요' }, 400)
      const phone = parsed.phone
      if (!phone) return c.json({ success: false, error: '알림톡 받을 휴대폰 번호를 적어 주세요' }, 400)
      // 이용권 매장 등록과 같은 모양(합성 이메일 · 빈 비밀번호 · 늘 pending) — 그 파일에 이유가 적혀 있다.
      const username = `life_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
      const ins = await DB.prepare(
        `INSERT INTO sellers (username, email, password_hash, name, business_name, phone, seller_type, status, created_at, updated_at)
         VALUES (?, ?, '', ?, ?, ?, 'store_owner', 'pending', datetime('now'), datetime('now'))`,
      ).bind(username, `${username}@store.invalid`, name, name, phone).run()
      sid = Number(ins.meta?.last_row_id)
      if (!Number.isFinite(sid) || sid <= 0) return c.json({ success: false, error: '가입하지 못했어요. 잠시 뒤 다시 시도해 주세요' }, 500)
      created = true
      await setSellerMeta(DB, sid, {
        store_channel: 'direct', manager_phone: phone, life_pro_signup: '1', registered_by_user_id: String(userId),
      }).catch(() => { /* 메타 실패 — 매장은 유지 */ })
      const grant = () => grantOperator(DB, sid!, userId, userId, 'owner').then((r) => !!r?.ok).catch(() => false)
      if (!(await grant()) && !(await grant())) {
        return c.json({
          success: false,
          error: `업체(#${sid})는 만들어졌지만 연결에 실패했어요. 다시 가입하지 마시고 고객센터로 이 번호를 알려 주세요.`,
          data: { seller_id: sid },
        }, 500)
      }
      await recordTermsConsent(DB, {
        subjectType: 'seller', subjectId: sid, userId, slug: 'seller', version: String(body.terms_agreed_version),
        ip: c.req.header('CF-Connecting-IP') || null,
      }).catch(() => null)
    }

    const r = await saveProProfile(c, DB, sid, body)
    if (!r.ok) return c.json({ success: false, error: r.error, data: { seller_id: sid, created } }, 400) // 위에서 이미 걸렀다 — 여기 올 일은 없다
    return c.json({ success: true, data: { seller_id: sid, created, granted: r.granted } })
  } catch (err) {
    return safeError(c, err, '가입하지 못했어요', '[home-service:pro-signup]')
  }
}
