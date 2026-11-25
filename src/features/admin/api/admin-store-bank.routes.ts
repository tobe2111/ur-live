/**
 * 🏦 매장 정산 계좌 — **어드민이 대신 입력** (2026-11-24 대표 *"1번 일단 만들어줘봐"*)
 *
 * 라이브 실측(11-24): 승인 매장 13곳 중 계좌 등록 0곳 — 정산이 생겨도 보낼 곳이 없다. 사장님이 마이 › 정산 › 계좌 등록에서
 * 직접 넣는 길만 있었고, 대표가 영업하며 받은 계좌를 넣을 방법이 없었다.
 *
 *   GET /api/admin/sellers/:id/bank-account   현재 값(계좌번호는 끝 4자리만)
 *   PUT /api/admin/sellers/:id/bank-account   { bank_name, bank_account, account_holder, confirm_overwrite? }
 *   POST /api/admin/sellers/:id/bank-account/reset-pin   잊은 매장 PIN 초기화(2026-11-25) — 주인이 새 PIN 을 만든다
 *
 * ## 🔒 돈이 가는 곳을 정하는 값이다 — 그래서 넷을 건다
 *   ① 역할: super·admin·finance 만(`shared/admin-roles.ts` SENSITIVE_MUTATIONS — ops·cs 차단)
 *   ② 덮어쓰기는 `confirm_overwrite: true` 를 따로 보내야 한다(이미 있는 계좌를 실수로 갈아끼우지 않게)
 *   ③ 감사 로그: 누가·언제·무엇을(계좌번호는 끝 4자리만 남긴다)
 *   ④ 사장님에게 즉시 알림 — 본인이 요청하지 않은 등록을 사장님이 알아챌 수 있게
 * 어드민이 사장님께 직접 받아 넣는 값이므로 `is_verified = 1`(재확인 완료)로 둔다 — 사장님이 스스로 바꾸면 종전대로 0 으로 내려간다.
 *
 * 머니 경로: 금액·정산·송금 로직 무접촉. 목적지 정보만 쓴다.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { writeAuditLog } from '@/worker/middleware/admin-security'
import { safeError } from '@/worker/utils/safe-error'
import { BANKS } from '@/shared/banks'
import { ensureSellerMetaTable, getSellerMeta, setSellerMeta } from '@/worker/utils/seller-meta'

export const adminStoreBankRoutes = new Hono<{ Bindings: Env }>()

const mask = (v: unknown): string | null => { const s = String(v ?? '').trim(); return s ? `****${s.slice(-4)}` : null }

export interface BankInput { bank_name: string; bank_account: string; account_holder: string }

/** 입력 검증 — 실패면 사람이 읽을 문장, 통과면 정리된 값. 순수 함수(시험이 직접 돌린다). */
export function parseBankInput(body: { bank_name?: unknown; bank_account?: unknown; account_holder?: unknown }): { error: string } | BankInput {
  const bank = typeof body.bank_name === 'string' ? body.bank_name.trim() : ''
  if (!(BANKS as readonly string[]).includes(bank)) return { error: '은행을 목록에서 골라 주세요' }
  const raw = typeof body.bank_account === 'string' ? body.bank_account.trim() : ''
  if (!/^[0-9-]+$/.test(raw)) return { error: '계좌번호는 숫자와 하이픈(-)만 적어 주세요' }
  const digits = raw.replace(/-/g, '')
  if (digits.length < 8 || digits.length > 16) return { error: '계좌번호는 숫자 8~16자리예요' }
  const holder = typeof body.account_holder === 'string' ? body.account_holder.trim() : ''
  if (!holder || holder.length > 40 || /[<>]/.test(holder)) return { error: '예금주를 40자 안으로 적어 주세요' }
  return { bank_name: bank, bank_account: digits, account_holder: holder }
}

adminStoreBankRoutes.get('/sellers/:id/bank-account', cors(), async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id <= 0) return c.json({ success: false, error: '매장 ID 가 올바르지 않습니다' }, 400)
    const row = await c.env.DB.prepare('SELECT bank_name, bank_account, account_holder FROM sellers WHERE id = ?')
      .bind(id).first<{ bank_name: string | null; bank_account: string | null; account_holder: string | null }>()
    if (!row) return c.json({ success: false, error: '매장을 찾을 수 없습니다' }, 404)
    const registered = !!(String(row.bank_name ?? '').trim() && String(row.bank_account ?? '').trim())
    return c.json({ success: true, data: { registered, bank_name: row.bank_name || null, bank_account_masked: mask(row.bank_account), account_holder: row.account_holder || null } })
  } catch (err) {
    return safeError(c, err, '계좌 정보를 불러오지 못했습니다', '[admin:store-bank]')
  }
})

adminStoreBankRoutes.put('/sellers/:id/bank-account', cors(), async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id <= 0) return c.json({ success: false, error: '매장 ID 가 올바르지 않습니다' }, 400)
    const body = await c.req.json<{ bank_name?: unknown; bank_account?: unknown; account_holder?: unknown; confirm_overwrite?: unknown }>().catch(() => ({}))
    const input = parseBankInput(body)
    if ('error' in input) return c.json({ success: false, error: input.error }, 400)
    const DB = c.env.DB
    const before = await DB.prepare('SELECT bank_name, bank_account, account_holder FROM sellers WHERE id = ?')
      .bind(id).first<{ bank_name: string | null; bank_account: string | null; account_holder: string | null }>()
    if (!before) return c.json({ success: false, error: '매장을 찾을 수 없습니다' }, 404)
    const had = !!(String(before.bank_name ?? '').trim() && String(before.bank_account ?? '').trim())
    if (had && (body as { confirm_overwrite?: unknown }).confirm_overwrite !== true) {
      return c.json({ success: false, code: 'OVERWRITE_CONFIRM_REQUIRED', error: `이미 등록된 계좌(${before.bank_name} ${mask(before.bank_account)})가 있어요. 바꾸려면 한 번 더 확인해 주세요.` }, 409)
    }
    await DB.prepare(
      "UPDATE sellers SET bank_name = ?, bank_account = ?, account_holder = ?, is_verified = 1, updated_at = datetime('now') WHERE id = ?",
    ).bind(input.bank_name, input.bank_account, input.account_holder, id).run()
    await writeAuditLog(c, {
      action: 'admin_set_seller_bank', targetType: 'seller', targetId: String(id),
      before: { bank_name: before.bank_name, bank_account: mask(before.bank_account), account_holder: before.account_holder },
      after: { bank_name: input.bank_name, bank_account: mask(input.bank_account), account_holder: input.account_holder },
    }).catch(() => { /* 감사 로그 실패가 저장을 되돌리지는 않는다 */ })
    await DB.prepare(
      `INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link) VALUES ('seller', ?, 'bank_account_changed', ?, ?, '/seller/settlements')`,
    ).bind(String(id), '🏦 정산 계좌가 등록됐어요',
      `유어딜이 ${input.bank_name} ${mask(input.bank_account)}(${input.account_holder}) 계좌를 정산 계좌로 등록했어요. 요청한 적이 없다면 바로 고객센터로 알려 주세요.`).run().catch(() => null)
    return c.json({
      success: true,
      data: { registered: true, bank_name: input.bank_name, bank_account_masked: mask(input.bank_account), account_holder: input.account_holder },
      message: had ? '정산 계좌를 바꿨어요. 사장님에게 알렸어요.' : '정산 계좌를 등록했어요. 사장님에게 알렸어요.',
    })
  } catch (err) {
    return safeError(c, err, '계좌를 저장하지 못했습니다', '[admin:store-bank]')
  }
})

/**
 * 🔑 잊은 매장 PIN 초기화 (2026-11-25).
 * PIN 은 계좌 변경·지급 신청을 지키는 값인데 **재설정 길이 없었다** — 카카오로 만든 매장(비밀번호 없음)의 주인이 PIN 을 잊으면
 * 계좌를 영영 못 바꿨다. 주인이 화면에서 스스로 지우게 하면 PIN 이 세션만큼만 안전해지므로(세션을 가진 사람이 지우고 새로 건다),
 * 사람이 본인 확인을 한 뒤 어드민이 지운다. 지우면 주인 자리가 새 PIN 을 만든다(`seller-pin.routes` 의 첫 PIN 길).
 * 역할은 계좌와 같다(경로가 `/bank-account/` 아래 — super·admin·finance). 감사 로그 + 사장님 알림.
 */
adminStoreBankRoutes.post('/sellers/:id/bank-account/reset-pin', cors(), async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id <= 0) return c.json({ success: false, error: '매장 ID 가 올바르지 않습니다' }, 400)
    const DB = c.env.DB
    const seller = await DB.prepare('SELECT id FROM sellers WHERE id = ?').bind(id).first<{ id: number }>()
    if (!seller) return c.json({ success: false, error: '매장을 찾을 수 없습니다' }, 404)
    await ensureSellerMetaTable(DB)
    const had = !!(await getSellerMeta(DB, [id])).get(id)?.pin_hash
    if (!had) return c.json({ success: true, data: { pin_set: false }, message: '이 매장은 PIN 이 걸려 있지 않아요.' })
    await setSellerMeta(DB, id, { pin_hash: null })
    await writeAuditLog(c, { action: 'admin_reset_seller_pin', targetType: 'seller', targetId: String(id), before: { pin_set: true }, after: { pin_set: false } })
      .catch(() => { /* 감사 로그 실패가 초기화를 되돌리지는 않는다 */ })
    await DB.prepare(
      `INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link) VALUES ('seller', ?, 'seller_pin_reset', ?, ?, '/seller/settlements')`,
    ).bind(String(id), '🔑 매장 PIN 이 초기화됐어요', '유어딜이 매장 PIN 을 초기화했어요. 정산 화면에서 새 PIN 을 만들어 주세요. 요청한 적이 없다면 바로 고객센터로 알려 주세요.').run().catch(() => null)
    return c.json({ success: true, data: { pin_set: false }, message: 'PIN 을 초기화했어요. 사장님에게 알렸어요.' })
  } catch (err) {
    return safeError(c, err, 'PIN 을 초기화하지 못했습니다', '[admin:store-bank]')
  }
})
