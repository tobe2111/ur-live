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
import { findActiveDealPctsBySeller } from '@/worker/utils/influencer-deal'

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
   * 🔎 **모수 = 유어샵을 실제로 쓴 사람**(2026-08-27 대표 — "어차피 공개가 되어있잖아").
   *   그 전엔 별도의 '공개' 토글을 켜야 검색에 떴다. 그런데 유어샵(`/u/{handle}`)은 **이미 공개
   *   페이지**다 — 자기 가게를 차려 놓고 "찾아도 됩니다" 버튼을 한 번 더 누르라는 건 군더더기다.
   *
   *   ⚠️ 그래도 **가입자 전원은 아니다.** 핸들은 가입 시 자동 발급되므로(실측 17명 중 9명 보유)
   *     "핸들 있음"을 기준으로 삼으면 결국 전원 노출이 된다. 기준은 **행동**이다 — 이용권을
   *     하나라도 담은 사람(`product_pins`, 실측 3명). 담았다 = 소개할 의사를 보인 것이다.
   *
   *   ⚠️ **옵트아웃은 남긴다**: 프로필을 저장하며 공개를 끈 사람(`is_open = 0` 행 존재)은 뺀다.
   *     행은 저장할 때만 생기므로, 행이 없다 = 한 번도 의사를 밝힌 적 없다 = 활동으로 판단한다.
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
    // 포함: 핀을 담았거나(활동) 스스로 공개를 켠 사람. 제외: 공개를 끈 사람(명시 옵트아웃).
    const where: string[] = [
      '(pin.n > 0 OR COALESCE(p.is_open, 0) = 1)',
      "COALESCE(p.is_open, 1) = 1",   // 행이 있고 0 이면 옵트아웃 → 제외 (행 없으면 1 로 봄)
      "u.handle IS NOT NULL AND u.handle != ''",  // 유어샵 주소가 없으면 매장이 찾아갈 곳이 없다
    ]
    const binds: unknown[] = []
    if (category) { where.push('p.categories LIKE ?'); binds.push(`%"${category}"%`) }
    if (region) { where.push('(p.regions LIKE ? OR p.regions LIKE ?)'); binds.push(`%"${region}"%`, '%"전국"%') }
    if (q) { where.push('(u.handle LIKE ? OR u.name LIKE ? OR p.intro LIKE ?)'); binds.push(`%${q}%`, `%${q}%`, `%${q}%`) }

    // 기준이 `users` 로 바뀌었다 — 프로필은 이제 **꾸밈**(소개·채널·분야)이지 입장권이 아니다.
    // 정렬: 담은 게 많은 사람 먼저(활동 신호), 같으면 최근 프로필 갱신 순.
    const { results } = await DB.prepare(
      `SELECT u.id AS user_id, p.intro, p.channels, p.categories, p.regions,
              u.handle, u.name, u.profile_image, pin.n AS pin_count
         FROM users u
         LEFT JOIN influencer_profiles p ON p.user_id = u.id
         LEFT JOIN (SELECT user_id, COUNT(*) AS n FROM product_pins GROUP BY user_id) pin
                ON pin.user_id = u.id
        WHERE ${where.join(' AND ')}
        ORDER BY pin.n DESC, p.updated_at DESC
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
        // 유어샵에 몇 개 담았나 — 매장이 "이 사람이 실제로 활동하나"를 보는 유일한 검증된 신호다
        // (팔로워는 본인 신고값이라 검증이 없다).
        pin_count: Number(r.pin_count) || 0,
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

    // 🤝 내 활성 딜 — 조건은 SSOT(`findActiveDealPctsBySeller`)가 갖는다.
    //   🩸 2026-08-27: 여기 WHERE 절을 **복사**해 두고 "SSOT 와 같아야 한다"는 주석을 달아 뒀었다.
    //     복사본은 결국 갈린다 — 그게 그 SSOT 가 존재하는 이유다. 이제 베끼지 않고 부른다.
    const me = c.get('user') as AuthUser | undefined
    const dealBySeller = me?.id
      ? await findActiveDealPctsBySeller(DB, String(me.id))
      : new Map<number, number>()

    const withDeal = eligible.map((r: Record<string, unknown>) => ({
      ...r,
      // null = 보상 없음(딜 미체결). 비로그인도 null — 화면이 로그인을 유도한다.
      my_deal_pct: me?.id ? (dealBySeller.get(Number(r.seller_id)) ?? null) : null,
    }))
    return c.json({ success: true, data: withDeal, authed: !!me?.id })
  })
}
