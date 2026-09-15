/**
 * 🏬 2026-08-10 **몰 운영자 콘솔 API** (마운트: /api/mall-admin) — 공구 서비스(운영자 SaaS).
 *
 * ⚠️ **어느 축인가**: `urdeal.kr/{슬러그}` 로 열리는 몰(`wholesale_malls`, `consumer_path=1`)은
 *   도매몰 코드를 용도 변경한 **공구 서비스**의 표면이다 — 매장 업주가 자기 몰을 열고 픽업 공구를
 *   판다(`docs/design/pickup-groupbuy-wholesale-link.md` §3 모드 A·B, `admin/wholesale-malls/mall-form.ts`).
 *   이 콘솔의 사용자는 **그 몰의 운영자**다.
 *
 * ## 왜 필요했나 — 운영자가 자기 몰을 만질 방법이 **없었다**
 * 몰은 어드민이 만드는 데이터 행이고 **운영자 로그인이 존재하지 않았다.** 그래서 공지 하나 바꾸는
 * 것도 어드민이 대신 해야 했다 — SaaS 로 팔 수 없는 상태다. (라이브 실측: 공개 몰 1개가 `test`,
 * 몰 소속 매장 0, 몰 귀속 상품 0 — 운영자 레인이 아직 시작도 안 된 상태였다.)
 *
 * ## 🔑 새 인증 체계를 만들지 않았다
 * 카카오 소비자 세션을 **그대로** 쓴다. 어드민이 `wholesale_malls.operator_user_id` 에 담당자
 * `users.id` 를 지정하면, 그 사람이 로그인했을 때 **자기 몰 하나만** 보인다.
 * ⇒ 새 로그인 화면·비밀번호·세션·토큰이 0개다. 셀러/어드민 토큰과도 무관(서로 안 섞인다).
 *
 * ## 🔴 이 파일이 지키는 것
 * ① **몰 스코프** — 모든 핸들러가 `resolveOperatorMall` 로 "이 로그인 사용자의 몰"을 먼저 확정한다.
 *    URL 로 몰 id 를 받지 않는다 ⇒ 남의 몰을 만질 파라미터 자체가 없다(IDOR 구조적 차단).
 * ② **읽기·공지만** — 브랜딩·슬러그·수수료·매장연결 같은 플랫폼 설정은 여기서 못 바꾼다(어드민 전용).
 *    운영자에게 필요한 건 "내 몰이 어떻게 보이나 + 손님에게 뭘 알릴까" 다.
 * ③ **머니 무접촉** — 결제·정산·크레딧·원장 전부 안 건드린다.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { resolveUserIdString } from '@/worker/utils/resolve-user-id'
import { recordTermsConsent } from '@/worker/utils/terms-consent'
import { MALL_OPERATOR_TERMS_VERSION } from '@/shared/mall/operator-terms'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAuth())

interface OperatorMall {
  id: number; slug: string; name: string; brand_name: string | null
  consumer_path: number; active: number; privacy_md: string | null; ga_id: string | null
}

/**
 * 로그인 사용자의 몰 — 없으면 null(호출부가 403).
 * 🔴 URL 파라미터를 안 받는다: "내 몰"은 서버가 정한다.
 */
async function resolveOperatorMall(env: Env, rawUserId: string | number, isDbId?: boolean): Promise<OperatorMall | null> {
  const uid = await resolveUserIdString(env.DB, rawUserId, isDbId)
  const n = Number(uid)
  if (!Number.isFinite(n) || n <= 0) return null
  return env.DB.prepare(
    `SELECT id, slug, name, brand_name, COALESCE(consumer_path,0) AS consumer_path,
            COALESCE(active,1) AS active, privacy_md, ga_id
       FROM wholesale_malls WHERE operator_user_id = ? LIMIT 1`,
  ).bind(n).first<OperatorMall>().catch(() => null)
}

/** 공통 진입 — 내 몰 확정. 운영자가 아니면 403(존재 여부도 알려주지 않는다). */
async function mine(c: { env: Env; req: unknown }, user: { id: string | number; isDbId?: boolean }) {
  return resolveOperatorMall(c.env, user.id, user.isDbId)
}

// GET /me — 내 몰 + 현황(상품·매장 수). 콘솔 첫 화면.
app.get('/me', async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const mall = await mine(c, user)
  if (!mall) return c.json({ success: false, error: '운영 중인 몰이 없습니다', code: 'NOT_OPERATOR' }, 403)

  const { DB } = c.env
  const [stores, products, notices, consent] = await Promise.all([
    DB.prepare("SELECT COUNT(*) n FROM sellers WHERE COALESCE(mall_id,1) = ? AND status = 'approved'")
      .bind(mall.id).first<{ n: number }>().catch(() => ({ n: 0 })),
    DB.prepare('SELECT COUNT(*) n FROM products WHERE COALESCE(mall_id,1) = ? AND is_active = 1')
      .bind(mall.id).first<{ n: number }>().catch(() => ({ n: 0 })),
    DB.prepare('SELECT COUNT(*) n FROM mall_notices WHERE mall_id = ? AND COALESCE(active,1) = 1')
      .bind(mall.id).first<{ n: number }>().catch(() => ({ n: 0 })),
    // 운영자 약관 동의 여부 — 미동의면 콘솔이 동의 화면을 먼저 띄운다(승낙형 전자계약).
    DB.prepare("SELECT 1 x FROM terms_consents WHERE subject_type = 'mall' AND subject_id = ? AND terms_slug = 'mall-operator' LIMIT 1")
      .bind(String(mall.id)).first<{ x: number }>().catch(() => null),
  ])
  return c.json({
    success: true,
    data: {
      mall: { id: mall.id, slug: mall.slug, name: mall.brand_name || mall.name, live: mall.consumer_path === 1 && mall.active === 1 },
      stats: { stores: stores?.n ?? 0, products: products?.n ?? 0, notices: notices?.n ?? 0 },
      terms: { agreed: !!consent, version: MALL_OPERATOR_TERMS_VERSION },
      privacy_md: mall.privacy_md ?? '',
    },
  })
})

/**
 * POST /agree — 운영자 약관 동의(= **승낙형 전자계약 체결**).
 * 유캔사인 같은 외부 서명형을 쓰지 않는다(2026-08-10 대표 "유캔사인은 안 써").
 * 증적은 셀러·에이전시 가입과 **같은 레일**(terms_consents: 버전·IP·주체). 멱등 — 이미 있으면 그대로.
 */
app.post('/agree', rateLimit({ action: 'mall-operator-agree', max: 10, windowSec: 600 }), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const mall = await mine(c, user)
  if (!mall) return c.json({ success: false, error: '운영 중인 몰이 없습니다', code: 'NOT_OPERATOR' }, 403)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  if (body.agree !== true) return c.json({ success: false, error: '약관에 동의해주세요' }, 400)

  const seek = () => c.env.DB.prepare(
    "SELECT 1 x FROM terms_consents WHERE subject_type = 'mall' AND subject_id = ? AND terms_slug = 'mall-operator' AND terms_version = ? LIMIT 1",
  ).bind(String(mall.id), MALL_OPERATOR_TERMS_VERSION).first<{ x: number }>().catch(() => null)

  if (!(await seek())) {
    const uid = await resolveUserIdString(c.env.DB, user.id, user.isDbId)
    // ⚠️ 서버가 버전을 찍는다 — 클라가 보낸 버전을 믿지 않는다(기존 약관 레일과 동일 규칙).
    await recordTermsConsent(c.env.DB, {
      subjectType: 'mall', subjectId: mall.id, userId: uid,
      slug: 'mall-operator', version: MALL_OPERATOR_TERMS_VERSION,
      coreAgreed: true, ip: c.req.header('CF-Connecting-IP') || null,
    })
    /**
     * 🔴 **기록됐는지 다시 읽어 확인한다.** `recordTermsConsent` 는 fail-soft(terms-consent.ts:47)라
     * write 가 실패해도 throw 하지 않는다. 그대로 success 를 주면 화면은 "동의 완료"인데
     * `GET /me` 는 다시 미동의로 읽어 **동의 화면이 무한 반복**된다.
     * 계약은 증적이 남아야 체결이다 — 안 남았으면 체결됐다고 말하지 않는다.
     */
    if (!(await seek())) {
      return c.json({ success: false, error: '동의 기록에 실패했습니다. 잠시 후 다시 시도해주세요', code: 'CONSENT_NOT_RECORDED' }, 500)
    }
  }
  return c.json({ success: true, data: { agreed: true, version: MALL_OPERATOR_TERMS_VERSION } })
})

// ── 공지(팝업/배너) — 손님에게 알리는 유일한 창구라 운영자에게 연다 ─────────────
const NOTICE_TYPES = ['popup', 'banner']
const clean = (v: unknown, max: number) => { const s = String(v ?? '').trim().slice(0, max); return s || null }
const cleanIso = (v: unknown) => { const s = String(v ?? '').trim().slice(0, 25); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s : null }

app.get('/notices', async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const mall = await mine(c, user)
  if (!mall) return c.json({ success: false, error: '운영 중인 몰이 없습니다', code: 'NOT_OPERATOR' }, 403)
  const { results } = await c.env.DB.prepare(
    'SELECT id, type, title, body, link_url, active, starts_at, ends_at, created_at FROM mall_notices WHERE mall_id = ? ORDER BY id DESC LIMIT 50',
  ).bind(mall.id).all().catch(() => ({ results: [] }))
  return c.json({ success: true, notices: results ?? [] })
})

app.post('/notices', rateLimit({ action: 'mall-operator-notice', max: 30, windowSec: 300 }), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const mall = await mine(c, user)
  if (!mall) return c.json({ success: false, error: '운영 중인 몰이 없습니다', code: 'NOT_OPERATOR' }, 403)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const title = clean(body.title, 120)
  if (!title) return c.json({ success: false, error: '제목을 입력해주세요' }, 400)
  const link = clean(body.link_url, 500)
  if (link && !/^(https?:\/\/|\/)/i.test(link)) return c.json({ success: false, error: '링크는 http(s):// 또는 / 로 시작해야 합니다' }, 400)
  const r = await c.env.DB.prepare(
    `INSERT INTO mall_notices (mall_id, type, title, body, link_url, active, starts_at, ends_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
  ).bind(mall.id, NOTICE_TYPES.includes(String(body.type)) ? String(body.type) : 'banner',
    title, clean(body.body, 2000), link, cleanIso(body.starts_at), cleanIso(body.ends_at)).run()
  return c.json({ success: true, id: r.meta?.last_row_id ?? null })
})

app.patch('/notices/:nid', rateLimit({ action: 'mall-operator-notice-edit', max: 60, windowSec: 300 }), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const mall = await mine(c, user)
  if (!mall) return c.json({ success: false, error: '운영 중인 몰이 없습니다', code: 'NOT_OPERATOR' }, 403)
  const nid = Number(c.req.param('nid'))
  if (!Number.isFinite(nid) || nid <= 0) return c.json({ success: false, error: '잘못된 요청' }, 400)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const sets: string[] = []; const binds: (string | number | null)[] = []
  if ('title' in body) { const v = clean(body.title, 120); if (!v) return c.json({ success: false, error: '제목을 입력해주세요' }, 400); sets.push('title = ?'); binds.push(v) }
  if ('body' in body) { sets.push('body = ?'); binds.push(clean(body.body, 2000)) }
  if ('active' in body) { sets.push('active = ?'); binds.push(Number(body.active) === 0 ? 0 : 1) }
  if (!sets.length) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
  binds.push(nid, mall.id)
  // 🔴 mall_id 를 WHERE 에 함께 — 남의 공지 id 를 넣어도 0 rows.
  const up = await c.env.DB.prepare(`UPDATE mall_notices SET ${sets.join(', ')} WHERE id = ? AND mall_id = ?`).bind(...binds).run()
  if ((up.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '공지를 찾을 수 없습니다' }, 404)
  return c.json({ success: true })
})

app.delete('/notices/:nid', rateLimit({ action: 'mall-operator-notice-del', max: 30, windowSec: 300 }), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const mall = await mine(c, user)
  if (!mall) return c.json({ success: false, error: '운영 중인 몰이 없습니다', code: 'NOT_OPERATOR' }, 403)
  const nid = Number(c.req.param('nid'))
  if (!Number.isFinite(nid) || nid <= 0) return c.json({ success: false, error: '잘못된 요청' }, 400)
  const r = await c.env.DB.prepare('DELETE FROM mall_notices WHERE id = ? AND mall_id = ?').bind(nid, mall.id).run()
  if ((r.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '공지를 찾을 수 없습니다' }, 404)
  return c.json({ success: true })
})

export { app as mallAdminRoutes }
