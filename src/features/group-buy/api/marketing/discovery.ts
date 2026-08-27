/**
 * 🔎 매장 ↔ 소개자 **탐색** 레인 — `marketing.routes.ts` 에서 떼어낸 조각 (2026-08-27)
 *
 * 옮긴 이유는 크기다. 원 파일이 911줄로 자라 파일크기 래칫(`check-file-size.mjs`)에 걸렸고,
 * CLAUDE.md 가 정한 처방은 **리베이스라인이 아니라 분리**다 — 키운 사람이 자기가 키운 만큼
 * 떼어낸다. 로직은 **한 줄도 바꾸지 않았다**(이동만).
 *
 * ⚠️ 라우터 인스턴스를 여기서 새로 만들지 않는다. 새로 만들면 `sellerApp` 에 걸린
 *   `requireSeller()` 미들웨어가 안 붙어 **인증 없이 열린다** — 이동 리팩토링에서 가장 나기 쉬운 사고다.
 *   대신 원 파일이 만든 인스턴스를 받아 라우트만 얹는다.
 */
import type { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import type { AuthUser } from '@/worker/middleware/auth'
import { ensureInfluencerProfileTable, parseChannels, maxFollowers, parseJsonList } from '@/worker/utils/influencer-profile'
import { intParam } from '@/shared/pagination'

type MarketingVars = {
  user?: { id: string | number; email?: string }
  seller?: { id: number; email?: string }
}
type MarketingApp = Hono<{ Bindings: Env; Variables: MarketingVars }>

function getSellerId(c: { get: (k: string) => unknown }): number {
  return Number((c.get('user') as AuthUser).id)
}

export function registerDiscoveryRoutes(sellerApp: MarketingApp, discoverApp: MarketingApp): void {
  // ───────── 소개자 찾기 (매장이 제안할 상대를 검색) ─────────

  /**
   * 🙋 2026-08-27 — 매장이 **손으로 유저 ID 를 타이핑**하던 것을 대체한다.
   *
   * 제안 화면의 인플루언서 입력은 `placeholder: 'user_12345'` 였다. 사장님이 남의 계정 ID 를
   * 알 방법이 없으니 그 화면은 현실에서 쓸 수 없었고, 그게 딜이 0건인 이유 중 하나다.
   *
   * ⚠️ 검색 모수는 **공개(opt-in)한 사람만**이다(`influencer_profiles.is_open = 1`).
   *   `users` 전체를 열면 가입자 전원을 사업자에게 노출하는 것이 된다. 실적 랭킹도 답이 아니다 —
   *   실적이 있어야 뜨는데 딜이 0건이라 모수가 0 이다.
   *
   * ⚠️ **연락처는 응답에 넣지 않는다**(이메일·전화·실명). 연락은 딜 제안으로만 — 노출하는 순간
   *   플랫폼 밖 거래와 콜드 연락의 통로가 된다.
   */
  sellerApp.get('/influencers', async (c) => {
    const DB = c.env.DB
    await ensureInfluencerProfileTable(DB)
    const q = (c.req.query('q') || '').trim().slice(0, 40)
    const category = (c.req.query('category') || '').trim()
    const region = (c.req.query('region') || '').trim()
    const limit = Math.min(50, Math.max(1, intParam(c.req.query('limit'), 20)))

    // 카테고리·지역은 JSON 배열 컬럼이라 LIKE 로 본다. 값이 화이트리스트(고정 문자열)라
    // 부분일치 오탐이 없다 — 임의 문자열이면 이 방식을 쓰면 안 된다.
    const where: string[] = ['p.is_open = 1']
    const binds: unknown[] = []
    if (category) { where.push('p.categories LIKE ?'); binds.push(`%"${category}"%`) }
    if (region) { where.push('(p.regions LIKE ? OR p.regions LIKE ?)'); binds.push(`%"${region}"%`, '%"전국"%') }
    if (q) { where.push('(u.handle LIKE ? OR u.name LIKE ? OR p.intro LIKE ?)'); binds.push(`%${q}%`, `%${q}%`, `%${q}%`) }

    const { results } = await DB.prepare(
      `SELECT p.user_id, p.intro, p.channels, p.categories, p.regions,
              u.handle, u.name, u.profile_image
         FROM influencer_profiles p
         LEFT JOIN users u ON u.id = p.user_id
        WHERE ${where.join(' AND ')}
        ORDER BY p.updated_at DESC
        LIMIT ?`
    ).bind(...binds, limit).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }))

    // 이 매장과 이미 딜이 있는 사람은 표시해 준다 — 중복 제안을 막고, 매장이 현황을 본다.
    const sellerId = getSellerId(c)
    const existing = new Set<string>()
    if (sellerId) {
      const { results: ds } = await DB.prepare(
        `SELECT influencer_id FROM seller_influencer_deals WHERE seller_id = ? AND status IN ('proposed','active')`
      ).bind(sellerId).all<{ influencer_id: string }>().catch(() => ({ results: [] as { influencer_id: string }[] }))
      for (const d of ds || []) existing.add(String(d.influencer_id))
    }

    const data = (results || []).map((r) => {
      const channels = parseChannels(r.channels)
      return {
        user_id: String(r.user_id),
        handle: (r.handle as string) ?? null,
        name: (r.name as string) ?? null,
        profile_image: (r.profile_image as string) ?? null,
        intro: (r.intro as string) ?? null,
        channels,                                  // 연락처 아님 — 공개 채널 링크
        followers: maxFollowers(channels),         // 본인 신고값(미검증) — 규모 감으로만
        categories: parseJsonList(r.categories),
        regions: parseJsonList(r.regions),
        has_deal: existing.has(String(r.user_id)),
      }
    })
    return c.json({ success: true, data })
  })

  // ───────── 카탈로그 (인플이 ?ref= 링크 생성) ─────────

  /**
   * 🚨 2026-08-27 — **딜 없는 상품에 링크를 주지 않는다.**
   *
   * 이 카탈로그는 어필리에이트(누구나 공유 2%) 시절에 만들어졌다. 그때는 아무 상품이나
   * 링크를 뽑아도 팔리면 적립이 됐다. 그런데 어필리에이트는 **2026-08-22 종료**됐고
   * (대표 "심플하게"), 지금 보상이 붙는 건 **매장이 그 사람에게 제안한 딜**뿐이다
   * (`findActiveDealPct` — 결제 적립과 같은 SSOT).
   *
   * 그대로 두면 인플루언서가 링크를 뿌리고 **첫 정산에서 0원을 본다.** 그건 버그가 아니라
   * 약속 위반이고, 그 사람과의 관계는 거기서 끝난다. 그래서 응답에 **내 딜 %를 실어** 보내
   * 화면이 "링크를 줄 수 있는 상품"과 "먼저 딜을 맺어야 하는 상품"을 구분하게 한다.
   *
   * ⚠️ 인증은 **라우터 레벨**(`marketing.routes.ts` 의 `discoverApp.use('*', optionalAuth())`)에 있다.
   *   여기서 다시 달면 두 번 돈다. 🩸 2026-08-27 정정: 어제 이 자리에 `optionalAuth()` 를 달고
   *   "비로그인도 열었다"고 적었는데 상위가 `requireAuth()` 라 **실제로는 안 열려 있었다** —
   *   미들웨어를 라우트에 덧붙이는 것으로는 상위 게이트를 못 푼다.
   *   로그인했을 때만 `my_deal_pct` 가 채워지고, 아니면 `null` — 화면이 로그인을 유도한다.
   */
  discoverApp.get('/products', async (c) => {
    const DB = c.env.DB
    const cat = c.req.query('category') || 'all'
    const validCats = ['meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher']
    const placeholders = cat === 'all' ? validCats.map(() => '?').join(',') : '?'
    const params = cat === 'all' ? validCats : [cat]
    const { results } = await DB.prepare(
      `SELECT p.id, p.name, p.price, p.original_price, p.image_url, p.category,
              p.group_buy_target, p.group_buy_current, p.group_buy_deadline, p.group_buy_status,
              p.restaurant_name, p.seller_id, COALESCE(p.referral_disabled, 0) AS referral_disabled,
              s.name AS seller_name, COALESCE(s.marketing_enabled, 1) AS marketing_enabled
       FROM products p
       LEFT JOIN sellers s ON s.id = p.seller_id
       WHERE p.category IN (${placeholders}) AND p.is_active = 1
         AND p.group_buy_status = 'active'
       ORDER BY p.created_at DESC LIMIT 100`
    ).bind(...params).all().catch(() => ({ results: [] as any[] }))
    // 인플 referral 가능한 것만 (marketing_enabled = 1, referral_disabled = 0)
    const eligible = (results || []).filter((r: { marketing_enabled?: number; referral_disabled?: number }) =>
      Number(r.marketing_enabled ?? 1) === 1 && Number(r.referral_disabled ?? 0) === 0
    )

    // 🤝 내 활성 딜을 매장별로 한 번에 조회 — 상품마다 findActiveDealPct 를 부르면 100 왕복이다.
    //   조건은 findActiveDealPct 와 **같아야 한다**(활성 · 기간 내 · 인증 요구 시 승인됨).
    //   갈리면 여기선 "N% 받는다"인데 결제에선 0 이 된다 — 이 파일이 막으려는 바로 그 사고다.
    const me = c.get('user') as AuthUser | undefined
    const dealBySeller = new Map<number, number>()
    if (me?.id) {
      const { results: deals } = await DB.prepare(
        `SELECT seller_id, commission_pct FROM seller_influencer_deals
          WHERE influencer_id = ? AND status = 'active'
            AND (ends_at IS NULL OR ends_at > datetime('now'))
            AND (COALESCE(requires_content_proof, 0) = 0 OR proof_status = 'approved')`
      ).bind(String(me.id)).all<{ seller_id: number; commission_pct: number }>()
        .catch(() => ({ results: [] as { seller_id: number; commission_pct: number }[] }))
      for (const d of deals || []) {
        const pct = Number(d.commission_pct)
        if (Number.isFinite(pct) && pct > 0) dealBySeller.set(Number(d.seller_id), pct)
      }
    }

    const withDeal = eligible.map((r: Record<string, unknown>) => ({
      ...r,
      // null = 보상 없음(딜 미체결). 비로그인도 null — 화면이 로그인을 유도한다.
      my_deal_pct: me?.id ? (dealBySeller.get(Number(r.seller_id)) ?? null) : null,
    }))
    return c.json({ success: true, data: withDeal, authed: !!me?.id })
  })
}
