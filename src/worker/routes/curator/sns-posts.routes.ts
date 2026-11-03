/**
 * 🖼️ 유어샵 SNS 최근 게시물 — 2026-11-03 대표 *"인스타그램, 틱톡 등 연동도 해서 나타날텐데"* → *"응 그 순서대로 하자"*
 *   (유어샵 B 의 세 번째: 판 모양 → 팔로워 수 → **최근 게시물**).
 *
 * `GET /api/curator/:handle/sns-posts` — 유어샵 진열 아래에 뜨는 최근 게시물 몇 장.
 *
 * 규칙:
 *  - **연동된 계정이고, 유어샵 이름표 주소와 같은 계정일 때만**(팔로워 수와 같은 판정 `sameSnsAccount`).
 *  - 인스타그램: 연동 토큰으로 `/me/media`(instagram_business_basic 범위). 유튜브: 공개 API 키로 업로드 목록(1 unit).
 *    틱톡: 영상 목록 권한(`video.list`)을 연동 때 요청하지 않으므로 **지금은 안 받는다**(빈 값).
 *  - 플랫폼 호출은 사람마다 **6시간에 한 번**(D1 캐시) — 공개 엔드포인트라 방문마다 외부를 두드리지 않게.
 *  - 실패는 조용히 빈 목록 — 유어샵 본문은 이것과 무관하게 뜬다.
 * 본체(`curator.routes.ts`)는 파일 크기 래칫이 걸려 있어 따로 둔다(admin-diagnostic 과 같은 이유).
 */
import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '../../types/env'
import { decryptAtRest } from '../../utils/data-crypto'
import { sameSnsAccount } from '../../../shared/ushop-sns-followers'
import { USHOP_SNS_POSTS_MAX, type UShopSnsPost } from '../../../shared/ushop-sns-posts'

const FRESH_MS = 6 * 60 * 60 * 1000
const _ensured = new WeakSet<object>()
async function ensureSnsPostsTable(DB: D1Database) {
  if (_ensured.has(DB)) return
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS user_sns_recent_posts (
       user_id INTEGER NOT NULL, platform TEXT NOT NULL, payload TEXT NOT NULL,
       fetched_at INTEGER NOT NULL, PRIMARY KEY (user_id, platform))`,
  ).run().catch(() => {})
  _ensured.add(DB)
}

const okHttps = (u: unknown): string | null => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null)

async function fetchInstagram(token: string): Promise<UShopSnsPost[]> {
  const r = await fetch(`https://graph.instagram.com/v23.0/me/media?${new URLSearchParams({ fields: 'id,media_type,media_url,thumbnail_url,permalink,timestamp', limit: String(USHOP_SNS_POSTS_MAX), access_token: token })}`)
  if (!r.ok) return []
  const j = (await r.json().catch(() => null)) as { data?: Array<Record<string, unknown>> } | null
  return (j?.data ?? []).flatMap((m) => {
    const thumb = okHttps(m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url)
    const url = okHttps(m.permalink)
    return thumb && url ? [{ platform: 'instagram' as const, url, thumb, at: String(m.timestamp ?? ''), video: m.media_type === 'VIDEO' }] : []
  })
}

async function fetchYouTube(channelId: string, key: string): Promise<UShopSnsPost[]> {
  if (!/^UC[\w-]{22}$/.test(channelId)) return []
  const r = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${new URLSearchParams({ part: 'snippet', playlistId: `UU${channelId.slice(2)}`, maxResults: String(USHOP_SNS_POSTS_MAX), key })}`)
  if (!r.ok) return []
  const j = (await r.json().catch(() => null)) as { items?: Array<{ snippet?: { publishedAt?: string; resourceId?: { videoId?: string }; thumbnails?: Record<string, { url?: string }> } }> } | null
  return (j?.items ?? []).flatMap((it) => {
    const id = it.snippet?.resourceId?.videoId
    const th = it.snippet?.thumbnails
    const thumb = okHttps(th?.medium?.url ?? th?.high?.url ?? th?.default?.url)
    return id && /^[\w-]{6,20}$/.test(id) && thumb ? [{ platform: 'youtube' as const, url: `https://www.youtube.com/watch?v=${id}`, thumb, at: String(it.snippet?.publishedAt ?? ''), video: true }] : []
  })
}

const curatorSnsPosts = new Hono<{ Bindings: Env }>()

curatorSnsPosts.get('/:handle/sns-posts', async (c) => {
  const empty = () => c.json({ success: true, posts: [] as UShopSnsPost[] })
  try {
    const handle = String(c.req.param('handle') || '').slice(0, 64)
    if (!handle) return empty()
    const DB = c.env.DB
    const user = await DB.prepare('SELECT id, youtube_url, instagram_url FROM users WHERE handle = ? LIMIT 1')
      .bind(handle).first<{ id: number; youtube_url: string | null; instagram_url: string | null }>().catch(() => null)
    if (!user) return empty()
    const { results: links } = await DB.prepare(
      `SELECT platform, external_id, username, access_token_enc FROM user_sns_links WHERE user_id = ? AND platform IN ('instagram','youtube')`,
    ).bind(user.id).all<{ platform: 'instagram' | 'youtube'; external_id: string; username: string | null; access_token_enc: string | null }>()
      .catch(() => ({ results: [] as never[] }))
    const usable = (links ?? []).filter((l) => sameSnsAccount(l.platform === 'instagram' ? user.instagram_url : user.youtube_url, l.username))
    c.header('Cache-Control', 'public, max-age=300')
    c.header('CDN-Cache-Control', 'public, max-age=1800, stale-while-revalidate=600')
    if (!usable.length) return empty()

    await ensureSnsPostsTable(DB)
    const now = Date.now()
    const all: UShopSnsPost[] = []
    for (const l of usable) {
      const cached = await DB.prepare('SELECT payload, fetched_at FROM user_sns_recent_posts WHERE user_id = ? AND platform = ?')
        .bind(user.id, l.platform).first<{ payload: string; fetched_at: number }>().catch(() => null)
      if (cached && now - Number(cached.fetched_at) < FRESH_MS) {
        try { all.push(...(JSON.parse(cached.payload) as UShopSnsPost[])) } catch { /* 깨진 캐시 — 아래에서 다시 받지 않고 건너뛴다 */ }
        continue
      }
      let got: UShopSnsPost[] = []
      try {
        if (l.platform === 'instagram') {
          const token = await decryptAtRest(l.access_token_enc, c.env.DATA_ENCRYPTION_KEY).catch(() => '')
          if (token) got = await fetchInstagram(token)
        } else if (c.env.YOUTUBE_API_KEY) {
          got = await fetchYouTube(l.external_id, c.env.YOUTUBE_API_KEY)
        }
      } catch { got = [] }
      // 실패해도 캐시를 남긴다(빈 목록) — 6시간 안에 같은 사람으로 외부를 또 두드리지 않는다.
      await DB.prepare(
        `INSERT INTO user_sns_recent_posts (user_id, platform, payload, fetched_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, platform) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
      ).bind(user.id, l.platform, JSON.stringify(got), now).run().catch(() => {})
      all.push(...got)
    }
    all.sort((a, b) => (b.at > a.at ? 1 : b.at < a.at ? -1 : 0))
    return c.json({ success: true, posts: all.slice(0, USHOP_SNS_POSTS_MAX) })
  } catch {
    return empty()
  }
})

export { curatorSnsPosts }
