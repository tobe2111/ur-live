/**
 * 🙋 소개자 공개 프로필 API (2026-08-27)
 *
 *   GET  /api/influencer-profile/me      — 내 프로필 (없으면 빈 기본값)
 *   PUT  /api/influencer-profile/me      — 저장 (공개 토글 · 채널 · 카테고리 · 지역 · 한 줄 소개)
 *
 * 셀러 쪽 검색은 `marketing.routes` 의 `sellerApp.get('/influencers')` — 그쪽은 `requireSeller()`
 * 스코프 안이라 여기 두지 않는다(인증 경계가 다르면 파일도 나눈다).
 *
 * 왜 이게 필요한지는 `worker/utils/influencer-profile.ts` 헤더 참조 — 요약하면 매장이 검색할
 * **모수 자체가 없었다.**
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAuth } from '@/worker/middleware/auth'
import type { AuthUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { safeError } from '@/worker/utils/safe-error'
import { VOUCHER_CATEGORIES } from '@/shared/constants/voucher-categories'
import {
  ensureInfluencerProfileTable, rowToProfile, sanitizeChannels, sanitizeList,
} from '@/worker/utils/influencer-profile'

/** 활동 지역 — 광역 단위만. 동 단위까지 받으면 본인 위치가 드러난다. */
export const PROFILE_REGIONS = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '전국',
] as const

type Vars = { user?: AuthUser }
const app = new Hono<{ Bindings: Env; Variables: Vars }>()

app.get('/me', requireAuth(), async (c) => {
  try {
    const me = c.get('user')
    if (!me?.id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    await ensureInfluencerProfileTable(c.env.DB)
    const row = await c.env.DB.prepare('SELECT * FROM influencer_profiles WHERE user_id = ?')
      .bind(String(me.id)).first<Record<string, unknown>>().catch(() => null)
    return c.json({
      success: true,
      data: rowToProfile(row) ?? {
        user_id: String(me.id), is_open: 0, intro: null, channels: [], categories: [], regions: [],
      },
      options: { categories: VOUCHER_CATEGORIES, regions: PROFILE_REGIONS },
    })
  } catch (err) {
    return safeError(c, err, '프로필을 불러오지 못했습니다', '[influencer-profile:get]')
  }
})

app.put('/me', requireAuth(), rateLimit({ action: 'influencer_profile_save', max: 30, windowSec: 3600 }), async (c) => {
  try {
    const me = c.get('user')
    if (!me?.id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

    const channels = sanitizeChannels(body.channels)
    const categories = sanitizeList(body.categories, VOUCHER_CATEGORIES)
    const regions = sanitizeList(body.regions, PROFILE_REGIONS, 4)
    const intro = String(body.intro ?? '').trim().slice(0, 200) || null
    const wantOpen = body.is_open === true || body.is_open === 1

    // 🚧 공개하려면 최소한의 정보가 있어야 한다 — 빈 프로필이 검색에 뜨면 매장은
    //    연락할 방법도 판단할 근거도 없는 카드를 보게 된다. 그건 검색을 망가뜨린다.
    if (wantOpen && channels.length === 0) {
      return c.json({
        success: false,
        error: '공개하려면 채널을 1개 이상 등록해주세요. 매장이 어디서 소개하실지 보고 판단합니다.',
        code: 'PROFILE_NEEDS_CHANNEL',
      }, 400)
    }

    await ensureInfluencerProfileTable(c.env.DB)
    await c.env.DB.prepare(
      `INSERT INTO influencer_profiles (user_id, is_open, intro, channels, categories, regions, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         is_open = excluded.is_open, intro = excluded.intro, channels = excluded.channels,
         categories = excluded.categories, regions = excluded.regions, updated_at = datetime('now')`
    ).bind(
      String(me.id), wantOpen ? 1 : 0, intro,
      JSON.stringify(channels), JSON.stringify(categories), JSON.stringify(regions),
    ).run()

    return c.json({ success: true, data: { is_open: wantOpen ? 1 : 0, intro, channels, categories, regions } })
  } catch (err) {
    return safeError(c, err, '프로필을 저장하지 못했습니다', '[influencer-profile:put]')
  }
})

export { app as influencerProfileRoutes }
