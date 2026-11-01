/**
 * 🔄 SNS 제자리 갱신 — 저장된 토큰으로 팔로워만 다시 읽는다 (2026-11-01)
 *
 * 대표 *"새로고침도 있고 해야하지 않을까"*. 종전 "다시 확인" 은 **플랫폼 로그인으로 리다이렉트**였다
 * (앱을 벗어났다가 동의 화면을 거쳐 돌아온다). 토큰은 처음부터 암호화 저장돼 있었으므로 그 왕복이
 * 필요 없었다.
 *
 * ## 이 시험이 지키는 것 — 전부 **진짜 함수를 돌려서** 판정한다
 * ① 연동과 갱신이 **같은 조회 함수**(`fetchProfile`)를 쓴다 — 두 벌이면 "연동했을 때와 다시 확인했을
 *    때 숫자가 다른" 어긋남이 생기고 에러는 안 난다.
 * ② 유튜브·틱톡은 `refresh_token` 으로 **먼저 갱신**한다 — 구글 access token 은 ~1시간이라
 *    안 하면 가장 흔한 경우에 늘 "다시 연동" 이 뜬다(이 처방의 존재 이유).
 * ③ `external_id` 가 바뀌면 **갱신하지 않는다** — 플랫폼에서 다른 계정으로 로그인한 경우이고,
 *    덮어쓰면 "한 SNS 계정은 한 유어딜 계정" UNIQUE 가 지키던 것이 조용히 무너진다.
 * ④ **실패해도 연동을 지우지 않는다** — 일시적 장애로 사람의 연동을 끊으면 안 된다.
 * ⑤ 숨긴 구독자·심사 전 틱톡은 **0 이 아니라 null**(모르는 것과 0 은 다르다).
 *
 * ## 이 시험이 **못** 하는 것
 * 플랫폼이 실제로 그 필드를 주는지(키가 없어 호출할 수 없다 — 첫 연동에서 확인) ·
 * 토큰 수명의 실제 값 · 화면에서 ⟳ 가 도는지(jsdom 밖).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readCode } from '../helpers/source-text'
import { fetchProfile, refreshSnsLink, type SnsEnv } from '@/features/seeding/api/sns-link'

const LINK = readCode('src/features/seeding/api/sns-link.ts')
const LIST = readCode('src/components/seeding/SnsLinkList.tsx')
const ROUTES = readCode('src/features/seeding/api/seeding.routes.ts')

/** 발행된 SQL 과 bind 를 그대로 모으는 가짜 D1. */
function fakeDb(row: Record<string, unknown> | null) {
  const sqls: { sql: string; binds: unknown[] }[] = []
  const DB = {
    prepare(sql: string) {
      const rec = { sql, binds: [] as unknown[] }
      sqls.push(rec)
      const stmt = {
        bind(...b: unknown[]) { rec.binds = b; return stmt },
        async first() { return /SELECT/i.test(sql) ? row : null },
        async run() { return { meta: { changes: 1 } } },
      }
      return stmt
    },
  } as unknown as SnsEnv['DB']
  return { DB, sqls, updates: () => sqls.filter((x) => /^\s*UPDATE/i.test(x.sql)) }
}

/** 요청 URL 을 기록하고 미리 정한 본문을 돌려주는 가짜 fetch. */
function fakeFetch(handler: (url: string) => unknown) {
  const calls: string[] = []
  const fn = vi.fn(async (input: unknown) => {
    const url = String(input)
    calls.push(url)
    return { ok: true, json: async () => handler(url) } as unknown as Response
  })
  vi.stubGlobal('fetch', fn)
  return calls
}
afterEach(() => vi.unstubAllGlobals())

const IG_ROW = {
  external_id: 'ig-1', access_token_enc: 'tok-live', refresh_token_enc: null,
  // 넉넉히 남은 만료 — 재발급을 안 타는 경로.
  token_expires_at: new Date(Date.now() + 40 * 86400_000).toISOString().replace('T', ' ').slice(0, 19),
}
const ENV = (db: SnsEnv['DB']): SnsEnv => ({ DB: db, YOUTUBE_CLIENT_ID: 'yc', YOUTUBE_CLIENT_SECRET: 'ys', TIKTOK_CLIENT_KEY: 'tk', TIKTOK_CLIENT_SECRET: 'ts' })

describe('① 연동과 갱신이 같은 조회 함수를 쓴다', () => {
  it('교환 함수(exchangeAndFetch)가 프로필 필드를 직접 읽지 않는다', () => {
    // 🔎 개수로 세지 않는다 — 같은 함수 안에서 두 번 나와도(필드 목록 + 꺼내 쓰기) 늘어난다.
    //    물어야 할 것은 "**어디서** 읽는가" 다. 종전엔 교환 함수 안에 인라인이었고, 되돌아가면 두 벌이 된다.
    const i = LINK.indexOf('export async function exchangeAndFetch')
    expect(i, 'exchangeAndFetch 를 찾았는가').toBeGreaterThan(0)
    const after = LINK.slice(i + 1).search(/\nexport /)
    const body = LINK.slice(i, after === -1 ? undefined : i + 1 + after)
    expect(body.length, '본문을 실제로 잘랐는가').toBeGreaterThan(500)
    for (const f of ['followers_count', 'subscriberCount', 'follower_count', 'user/info', 'external_id:']) {
      expect(body, `교환 함수가 '${f}' 를 직접 다룬다`).not.toContain(f)
    }
    expect(body, '조회를 위임한다').toMatch(/const got = await fetchProfile\(p, token\)/)
  })
})

describe('② 만료된 토큰은 먼저 재발급한다', () => {
  it('유튜브 — refresh_token 교환이 조회보다 먼저 나간다', async () => {
    const { DB, updates } = fakeDb({ external_id: 'yt-1', access_token_enc: 'dead', refresh_token_enc: 'rt-1', token_expires_at: '2020-01-01 00:00:00' })
    const calls = fakeFetch((url) =>
      url.includes('oauth2.googleapis.com')
        ? { access_token: 'fresh', expires_in: 3600 }
        : { items: [{ id: 'yt-1', snippet: { title: '채널', customUrl: '@ch' }, statistics: { subscriberCount: '1212' } }] })
    const r = await refreshSnsLink(ENV(DB), 7, 'youtube')
    expect(r.ok, r.error).toBe(true)
    expect(calls[0], '재발급이 먼저').toContain('oauth2.googleapis.com')
    expect(calls[1], '그 다음 조회').toContain('youtube/v3/channels')
    expect(updates()).toHaveLength(1)
    expect(updates()[0].binds[3], '팔로워가 반영된다').toBe(1212)
  })

  it('refresh_token 이 없으면 다시 연동 — 갱신도 삭제도 하지 않는다', async () => {
    const { DB, sqls, updates } = fakeDb({ external_id: 'yt-1', access_token_enc: 'dead', refresh_token_enc: null, token_expires_at: '2020-01-01 00:00:00' })
    fakeFetch(() => ({}))
    const r = await refreshSnsLink(ENV(DB), 7, 'youtube')
    expect(r.ok).toBe(false)
    expect(r.reconnect).toBe(true)
    expect(updates()).toHaveLength(0)
    expect(sqls.some((x) => /DELETE/i.test(x.sql)), '④ 실패가 연동을 끊지 않는다').toBe(false)
  })
})

describe('③ 다른 계정으로 바뀌면 갱신하지 않는다', () => {
  it('external_id 불일치 — UPDATE 0건', async () => {
    const { DB, updates } = fakeDb(IG_ROW)
    fakeFetch(() => ({ user_id: 'ig-OTHER', username: 'someone', followers_count: 99999 }))
    const r = await refreshSnsLink(ENV(DB), 7, 'instagram')
    expect(r.ok).toBe(false)
    expect(r.reconnect).toBe(true)
    expect(updates(), '남의 숫자가 내 행에 들어가지 않는다').toHaveLength(0)
  })

  it('일치하면 갱신한다', async () => {
    const { DB, updates } = fakeDb(IG_ROW)
    const calls = fakeFetch(() => ({ user_id: 'ig-1', username: 'me', name: '나', account_type: 'BUSINESS', followers_count: 12300 }))
    const r = await refreshSnsLink(ENV(DB), 7, 'instagram')
    expect(r.ok, r.error).toBe(true)
    expect(calls.some((u) => u.includes('refresh_access_token')), '만료가 머니 재발급을 안 탄다').toBe(false)
    const u = updates()[0]
    expect(u.binds[0]).toBe('me')
    expect(u.binds[3], '팔로워').toBe(12300)
    expect(u.sql, 'verified_at 갱신').toMatch(/verified_at = datetime\('now'\)/)
    expect(u.sql, '토큰은 새로 받았을 때만 덮는다').toMatch(/access_token_enc = COALESCE\(\?, access_token_enc\)/)
  })
})

describe('⑤ 모르는 값을 0 으로 위장하지 않는다', () => {
  it('구독자 비공개 → null', async () => {
    fakeFetch(() => ({ items: [{ id: 'c', snippet: { title: 'T' }, statistics: { hiddenSubscriberCount: true, subscriberCount: '0' } }] }))
    const r = await fetchProfile('youtube', 't')
    expect(r.ok && r.profile.follower_count).toBe(null)
    expect(r.ok && r.profile.account_type).toBe('hidden_subscribers')
  })

  it('틱톡이 팔로워를 안 주면 null', async () => {
    fakeFetch(() => ({ data: { user: { open_id: 'o', username: 'u', display_name: 'D' } } }))
    const r = await fetchProfile('tiktok', 't')
    expect(r.ok && r.profile.follower_count).toBe(null)
  })
})

describe('⑥ 배선 — 화면이 리다이렉트 대신 갱신을 부른다', () => {
  it('⟳ 가 refresh() 를 부른다', () => {
    expect(LIST, '갱신 호출').toMatch(/api\.post\(`\/api\/seeding\/sns\/\$\{p\}\/refresh`\)/)
    expect(LIST, '버튼 배선').toMatch(/<RefreshCw[\s\S]{0,300}?relativeFromNow\(l\.verified_at\)/)
    expect(LIST, '버튼이 connect 로 되돌아가지 않았다').toMatch(/onClick=\{\(\) => refresh\(p\)\}/)
    // 토큰이 죽었을 때만 플랫폼으로 — 조용히 실패하면 숫자가 왜 그대로인지 알 수 없다.
    expect(LIST, 'reconnect 폴백').toMatch(/d\?\.reconnect[\s\S]{0,120}connect\(p\)/)
  })

  it('라우트가 인증을 요구한다', () => {
    expect(ROUTES).toMatch(/seedingRoutes\.post\('\/sns\/:platform\/refresh', requireAuth\(\)/)
  })
})
