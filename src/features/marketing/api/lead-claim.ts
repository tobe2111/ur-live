/**
 * 🔗 2026-07-27 모집 퍼널 뒷단 연결 — **신청 → 유어딜 가입 → 첫 판매**.
 *
 *   그동안 퍼널은 앞 1/3(수집 → 모집안내 → 신청)만 측정됐다. 신청자가 실제로 가입했는지,
 *   가입 후 한 건이라도 팔았는지는 **아무 데도 기록되지 않아** "모집이 되고 있는가"를 판단할 수 없었다
 *   (온보딩 메일의 가입 링크가 추적 파라미터 없는 맨 `https://urdeal.kr/login` 이었던 게 원인).
 *
 *   방식: 리드마다 1회용 **claim_code** 를 발급해 온보딩/신청완료 링크에 실어 보내고
 *   (`/creators/start?ic={code}`), 로그인 후 그 페이지가 `POST /api/creator-claim` 으로 리드 ↔ 유저를 묶는다.
 *   묶인 뒤의 '첫 판매'는 별도 저장 없이 `affiliate_earnings.referrer_id`(= users.id 문자열)로 조회한다
 *   — 적립 원장이 SSOT 이므로 사본을 만들면 어긋난다.
 *
 *   ⚠️ 머니 무관: 이 연결은 **측정 전용**이다. 적립/정산/보상 로직은 일절 건드리지 않는다
 *      (코드가 유출돼도 남의 적립을 가져갈 수 없고, 잘못된 귀속만 발생 → 링크 덮어쓰기 금지로 방어).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { parseSessionCookie } from '@/worker/utils/session'
import { resolveUserId } from '@/worker/utils/resolve-user-id'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

const POOL = 0 // 공용 풀 센티넬(ad_influencer_leads.account_id)

const _schemaDone = new WeakSet<object>()
export async function ensureClaimSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN claim_code TEXT').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN linked_user_id INTEGER').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN joined_at TEXT').run().catch(() => null)
  // 코드 = 조회키(UNIQUE 라야 발급 경합이 안전), 유저 = 1인 1리드(중복 귀속 차단).
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_leads_claim_code ON ad_influencer_leads(claim_code) WHERE claim_code IS NOT NULL').run().catch(() => null)
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_leads_linked_user ON ad_influencer_leads(linked_user_id) WHERE linked_user_id IS NOT NULL').run().catch(() => null)
}

// 혼동 문자(I/O/0/1) 제외 — 메일에서 눈으로 옮겨 적는 경우 대비.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function randCode(len = 12): string {
  const b = new Uint8Array(len)
  crypto.getRandomValues(b)
  let s = ''
  for (let i = 0; i < len; i++) s += ALPHABET[b[i] % ALPHABET.length]
  return s
}

/**
 * 리드의 claim 코드 — 없으면 발급, 있으면 그대로(멱등: 이미 보낸 메일의 링크가 죽으면 안 됨).
 * UNIQUE 충돌/동시발급은 재조회로 수렴. 실패 시 null(호출부는 코드 없이 진행).
 */
export async function getOrCreateClaimCode(DB: D1Database, leadId: number): Promise<string | null> {
  await ensureClaimSchema(DB)
  const read = () => DB.prepare('SELECT claim_code FROM ad_influencer_leads WHERE id = ? AND account_id = ?')
    .bind(leadId, POOL).first<{ claim_code: string | null }>().catch(() => null)
  const row = await read()
  if (!row) return null
  if (row.claim_code) return row.claim_code
  for (let i = 0; i < 3; i++) {
    const code = randCode()
    const r = await DB.prepare('UPDATE ad_influencer_leads SET claim_code = ? WHERE id = ? AND account_id = ? AND claim_code IS NULL')
      .bind(code, leadId, POOL).run().catch(() => null)
    if (r?.meta?.changes === 1) return code
    const cur = await read()
    if (cur?.claim_code) return cur.claim_code // 동시 발급이 이김 — 그 값을 쓴다
  }
  return null
}

export type ClaimResult =
  | { ok: true; status: 'linked' | 'already'; lead_id: number; name?: string }
  | { ok: false; error: string; conflict?: boolean }

/** 코드 ↔ 유저 연결. **덮어쓰기 없음** — 이미 묶인 리드/유저는 그대로 두고 결과만 알린다. */
export async function claimLead(DB: D1Database, code: string, userId: number): Promise<ClaimResult> {
  await ensureClaimSchema(DB)
  const lead = await DB.prepare('SELECT id, name, linked_user_id FROM ad_influencer_leads WHERE claim_code = ? AND account_id = ?')
    .bind(code, POOL).first<{ id: number; name: string; linked_user_id: number | null }>().catch(() => null)
  if (!lead) return { ok: false, error: '유효하지 않은 초대 코드입니다' }
  if (lead.linked_user_id != null) {
    return Number(lead.linked_user_id) === userId
      ? { ok: true, status: 'already', lead_id: lead.id, name: lead.name }
      : { ok: false, error: '이미 다른 계정에 연결된 코드입니다', conflict: true }
  }
  // 1인 1리드 — 이미 다른 리드에 묶인 계정이면 성공으로 흘려보낸다(에러 화면 대신 그냥 시작 안내).
  const mine = await DB.prepare('SELECT id, name FROM ad_influencer_leads WHERE linked_user_id = ? AND account_id = ?')
    .bind(userId, POOL).first<{ id: number; name: string }>().catch(() => null)
  if (mine) return { ok: true, status: 'already', lead_id: mine.id, name: mine.name }
  const r = await DB.prepare(`UPDATE ad_influencer_leads SET linked_user_id = ?, joined_at = COALESCE(joined_at, datetime('now'))
      WHERE id = ? AND account_id = ? AND linked_user_id IS NULL`)
    .bind(userId, lead.id, POOL).run().catch(() => null)
  if (r?.meta?.changes !== 1) return { ok: false, error: '연결에 실패했습니다. 잠시 후 다시 시도해주세요' }
  return { ok: true, status: 'linked', lead_id: lead.id, name: lead.name }
}

/**
 * 퍼널 뒷단 집계 — 가입(joined) / 첫 판매(first_sale).
 * 첫 판매는 적립 원장(affiliate_earnings) 을 직접 본다(사본 미보관 = 환불 역전까지 자동 반영).
 * 테이블/컬럼이 아직 없는 환경에서도 0 으로 안전하게 떨어진다.
 *
 * 🔀 **2026-08-19 — 쿼리를 둘로 쪼갰다(리드 DB 분리).** 원래는 한 문장 안에서
 *   `ad_influencer_leads`(→ 유어애즈 DB로 이사)와 `affiliate_earnings`(→ 결제 DB에 잔류)를
 *   `EXISTS` 로 상관시켰다. 두 테이블이 다른 D1 에 있으면 **그 문장은 실행 자체가 불가능**하다.
 *
 *   ⚠️ 이건 리뷰가 아니라 **가드가 잡았다.** 처음 만든 스캐너가 따옴표를 정규식으로 짝지어
 *   이 쿼리를 못 봤고, 그 상태로 "교차 조인 0건"이라고 판단했다(`ads-leads-db.test.ts` 의
 *   `stringLiterals` 주석 참조). 문자 단위 스캐너로 바꾸자 **레포 전체에서 딱 이 하나**가 나왔다.
 *
 *   `adsLeadsDb` 핸들은 SQL 을 보고 목적지를 고르므로 **호출부는 그대로 한 핸들만 넘기면 된다** —
 *   ①은 유어애즈 DB, ②는 결제 DB로 자동으로 갈린다.
 */
export async function getFunnelTailStats(DB: D1Database): Promise<{ joined: number; first_sale: number }> {
  await ensureClaimSchema(DB)
  // ① 연결된 유저 id — 유어애즈 DB
  const linked = await DB.prepare(
    'SELECT linked_user_id AS uid FROM ad_influencer_leads WHERE account_id = ? AND linked_user_id IS NOT NULL',
  ).bind(POOL).all<{ uid: number | string | null }>().catch(() => null)
  const ids = (linked?.results || []).map((r) => String(r.uid)).filter((v) => v && v !== 'null')
  if (!ids.length) return { joined: 0, first_sale: 0 }

  // ② 그중 실제로 판 사람 — 적립 원장(결제 DB). IN 목록이 길어지지 않게 나눠 조회한다.
  //    가입자 수만큼만 도므로 규모는 '연결된 리드 수'에 비례한다(수백~수천 수준).
  const CHUNK = 200
  let sold = 0
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK)
    const ph = part.map(() => '?').join(',')
    const row = await DB.prepare(
      `SELECT COUNT(DISTINCT referrer_id) AS n FROM affiliate_earnings WHERE referrer_id IN (${ph})`,
    ).bind(...part).first<{ n: number }>().catch(() => null)
    sold += Number(row?.n) || 0
  }
  return { joined: ids.length, first_sale: sold }
}

// ── POST /api/creator-claim — 로그인한 유저가 초대 코드를 자기 계정에 연결 ──────────
const app = new Hono<{ Bindings: Env }>()

app.post('/', rateLimit({ action: 'creator-claim', max: 30, windowSec: 3600 }), async (c) => {
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const code = String(b.code ?? '').trim().toUpperCase().slice(0, 32)
  if (!/^[A-Z0-9]{8,32}$/.test(code)) return c.json({ success: false, error: '초대 코드 형식이 올바르지 않습니다' }, 400)
  // 소비자 세션 쿠키만 인정(역할 토큰 무관 — 유어샵/적립의 주체는 소비자 계정).
  const su = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user']).catch(() => null)
  if (!su) return c.json({ success: false, need_login: true, error: '로그인이 필요합니다' }, 401)
  const uid = await resolveUserId(adsLeadsDb(c.env), su.userId, su.isDbId)
  if (!uid) return c.json({ success: false, error: '계정을 확인할 수 없습니다' }, 401)
  const r = await claimLead(adsLeadsDb(c.env), code, uid)
  if (!r.ok) return c.json({ success: false, error: r.error, conflict: r.conflict === true }, r.conflict ? 409 : 400)
  return c.json({ success: true, status: r.status, name: r.name || null })
})

export { app as creatorClaimRoutes }
