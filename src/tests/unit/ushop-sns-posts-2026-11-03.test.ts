/**
 * 🖼️ 유어샵 SNS 최근 게시물 — 2026-11-03 유어샵 B + SNS 의 세 번째.
 *
 * 지키는 것:
 *  ① 이름표 주소와 **다른 계정**이면 외부를 부르지도 않고 빈 목록(남의 게시물을 내 유어샵에 띄우지 않는다)
 *  ② 6시간 안의 캐시가 있으면 외부를 안 부른다(공개 엔드포인트 — 방문마다 플랫폼을 두드리지 않는다)
 *  ③ 캐시가 낡았으면 받아서 저장하고, 실패해도 빈 캐시를 남긴다
 *  ④ https 가 아닌 썸네일·주소는 버린다
 *  ⑤ 화면은 진열 **아래**에 lazy 로 선다(위에 두면 늦게 와서 진열을 민다)
 * ⚠️ 못 보는 것: 실제 플랫폼 응답 모양(인스타 Graph · 유튜브 Data API 의 실응답) · 썸네일 만료 주기.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { curatorSnsPosts } from '@/worker/routes/curator/sns-posts.routes'

vi.mock('@/worker/utils/data-crypto', () => ({ decryptAtRest: async (v: string) => `tok:${v}` }))
vi.mock('../../worker/utils/data-crypto', () => ({ decryptAtRest: async (v: string) => `tok:${v}` }))

type Link = { platform: 'instagram' | 'youtube'; external_id: string; username: string | null; access_token_enc: string | null }
function fakeDb(o: { links: Link[]; cache?: Record<string, { payload: string; fetched_at: number }> }) {
  const writes: unknown[][] = []
  const cache = o.cache ?? {}
  const DB = {
    prepare(sql: string) {
      let args: unknown[] = []
      const st = {
        bind(...a: unknown[]) { args = a; return st },
        async first() {
          if (sql.startsWith('SELECT id, youtube_url')) return { id: 3, youtube_url: 'https://youtube.com/@jiwon', instagram_url: 'https://instagram.com/jiwon_eats' }
          if (sql.startsWith('SELECT payload')) return cache[String(args[1])] ?? null
          return null
        },
        async all() { return { results: o.links } },
        async run() { if (sql.startsWith('INSERT INTO user_sns_recent_posts')) writes.push(args); return { meta: { changes: 1 } } },
      }
      return st
    },
  }
  return { DB, writes }
}
const app = new Hono().route('/api/curator', curatorSnsPosts as never)
const call = (DB: unknown) => app.request('/api/curator/jiwon1228/sns-posts', {}, { DB, DATA_ENCRYPTION_KEY: 'k', YOUTUBE_API_KEY: 'yk' } as never)

afterEach(() => vi.unstubAllGlobals())

describe('최근 게시물', () => {
  it('① 다른 계정이면 외부를 안 부르고 빈 목록', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const { DB } = fakeDb({ links: [{ platform: 'instagram', external_id: '1', username: 'someone_else', access_token_enc: 'x' }] })
    const j = await (await call(DB)).json() as { posts: unknown[] }
    expect(j.posts).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })

  it('② 6시간 안 캐시면 외부를 안 부른다', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const post = { platform: 'instagram', url: 'https://www.instagram.com/p/a/', thumb: 'https://scontent.cdninstagram.com/a.jpg', at: '2026-11-01T00:00:00Z', video: false }
    const { DB } = fakeDb({ links: [{ platform: 'instagram', external_id: '1', username: 'jiwon_eats', access_token_enc: 'x' }], cache: { instagram: { payload: JSON.stringify([post]), fetched_at: Date.now() - 60_000 } } })
    const j = await (await call(DB)).json() as { posts: unknown[] }
    expect(j.posts).toEqual([post])
    expect(f).not.toHaveBeenCalled()
  })

  it('③④ 낡았으면 받아서 저장 — https 아닌 것은 버린다', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ data: [
      { id: '1', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/1.jpg', permalink: 'https://www.instagram.com/p/1/', timestamp: '2026-11-02T00:00:00+0000' },
      { id: '2', media_type: 'IMAGE', media_url: 'http://evil.example/2.jpg', permalink: 'https://www.instagram.com/p/2/', timestamp: '2026-11-01T00:00:00+0000' },
      { id: '3', media_type: 'VIDEO', thumbnail_url: 'https://scontent.cdninstagram.com/3.jpg', permalink: 'javascript:alert(1)', timestamp: '2026-10-30T00:00:00+0000' },
    ] }), { status: 200 }))
    vi.stubGlobal('fetch', f)
    const { DB, writes } = fakeDb({ links: [{ platform: 'instagram', external_id: '1', username: 'jiwon_eats', access_token_enc: 'x' }], cache: { instagram: { payload: '[]', fetched_at: Date.now() - 7 * 3600_000 } } })
    const j = await (await call(DB)).json() as { posts: Array<{ url: string }> }
    expect(f).toHaveBeenCalledTimes(1)
    expect(j.posts.map((p) => p.url)).toEqual(['https://www.instagram.com/p/1/'])
    expect(writes.length).toBe(1)
  })

  it('③ 외부가 실패해도 빈 캐시를 남긴다(6시간 동안 다시 안 두드림)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 500 })))
    const { DB, writes } = fakeDb({ links: [{ platform: 'instagram', external_id: '1', username: 'jiwon_eats', access_token_enc: 'x' }] })
    const j = await (await call(DB)).json() as { posts: unknown[] }
    expect(j.posts).toEqual([])
    expect(writes.length).toBe(1)
    expect(writes[0][2]).toBe('[]')
  })

  it('⑤ 화면은 진열 아래 lazy', () => {
    const page = readFileSync('src/pages/CuratorPage.tsx', 'utf8')
    expect(page).toContain("const UShopSnsPosts = lazy(() => import('./curator-page/UShopSnsPosts'))")
    const rowsAt = page.indexOf('ur-ushop-rows">')
    const postsAt = page.indexOf('<UShopSnsPosts handle=')
    expect(rowsAt).toBeGreaterThan(0)
    expect(postsAt).toBeGreaterThan(rowsAt)
  })
})
