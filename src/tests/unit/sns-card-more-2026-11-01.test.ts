/**
 * 🪪 SNS 연동 카드에 정보를 더 — 대표 확정 **안 C** (2026-11-01)
 *
 * 시안 `docs/design/sns-link-card-more-2026-11-01.md`. 더한 것: 계정 링크 · 계정 종류 ·
 * 팔로워를 못 읽은 **이유** · 프로필 사진 · 게시물 수 · 팔로워 추이.
 *
 * ## 이 시험이 지키는 것
 * ① **못 읽은 값을 0 으로 위장하지 않는다** — 스냅샷에 null 을 0 으로 적으면 다음 주 추이가
 *    "+9,283" 같은 거짓 성장이 된다(사장님의 최소 팔로워 조건이 이 숫자로 판정된다).
 * ② **추이는 다른 계정과 비교하지 않는다** — `external_id` 로 거른다. 안 그러면 계정을 갈아탄
 *    사람에게 거짓 성장이 찍히고 **에러는 안 난다**.
 * ③ **기준이 없으면 그 자리를 비운다** — 대표 *"추이는 다음 주부터는 굳이 안넣어도 돼"*.
 * ④ **프로필 사진은 R2 로 옮긴다** — 플랫폼이 준 주소는 며칠 만에 만료된다(실측: 인스타 `oe=` 4일).
 *    그대로 저장하면 연동 직후엔 보이다가 조용히 사라진다.
 * ⑤ **사진이 없으면 로고 원으로 떨어진다** — 빈 동그라미를 남기지 않는다.
 * ⑥ **유튜브는 공짜다** — 영상 수·썸네일이 이미 그 응답 안에 있다(`part=snippet,statistics`).
 * ⑦ **해제하면 지난 기록도 지운다** — 다른 계정으로 다시 연동했을 때 엉뚱한 기준이 되지 않게.
 *
 * ## 이 시험이 **못** 하는 것
 * 플랫폼이 실제로 그 필드를 주는지(인스타는 연동 계정에 직접 물어 확인했지만 그 토큰은 우리 앱의
 * 것이 아니다 — 첫 연동에서 재확인) · R2 이관이 실제로 되는지 · 화면이 예쁜지(렌더로 본다).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readCode } from '../helpers/source-text'
import {
  POST_WORD, snsAccountLabel, snsTrendText, snsUnknownFollowerHint, snsUnknownFollowerText,
} from '@/shared/sns-account'
import { fetchProfile, followerTrend, recordFollowerSnapshot, TREND_MIN_DAYS } from '@/features/seeding/api/sns-link'
import type { SnsEnv } from '@/features/seeding/api/sns-link'

const LINK = readCode('src/features/seeding/api/sns-link.ts')
const LIST = readCode('src/components/seeding/SnsLinkList.tsx')
const ROUTES = readCode('src/features/seeding/api/seeding.routes.ts')
const DB_SQL = readCode('src/features/seeding/api/seeding-db.ts')

/** 발행된 SQL·bind 를 모으는 가짜 D1. `first()` 는 넘겨준 행을 돌려준다. */
function fakeDb(first: Record<string, unknown> | null = null) {
  const sqls: { sql: string; binds: unknown[] }[] = []
  const DB = {
    prepare(sql: string) {
      const rec = { sql, binds: [] as unknown[] }
      sqls.push(rec)
      const stmt = {
        bind(...b: unknown[]) { rec.binds = b; return stmt },
        async first() { return first },
        async run() { return { meta: { changes: 1 } } },
        async all() { return { results: [] } },
      }
      return stmt
    },
  } as unknown as SnsEnv['DB']
  return { DB, sqls }
}

function fakeFetch(handler: (url: string) => unknown) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
    calls.push(String(input))
    return { ok: true, json: async () => handler(String(input)) } as unknown as Response
  }))
  return calls
}
afterEach(() => vi.unstubAllGlobals())

const DAY = 86400_000
const NOW = Date.parse('2026-11-20T04:00:00Z')  // KST 13:00 — 날짜 경계에서 멀다

// ── ① 못 읽은 값은 기록하지 않는다 ──────────────────────────────────

describe('① 스냅샷 — 모르는 것과 0 은 다르다', () => {
  it('follower_count 가 null 이면 한 줄도 쓰지 않는다', async () => {
    const { DB, sqls } = fakeDb()
    await recordFollowerSnapshot(DB, 7, 'youtube', 'yt-1', null, NOW)
    expect(sqls, 'null 을 0 으로 적으면 다음 주 추이가 거짓 성장이 된다').toHaveLength(0)
  })

  it('숫자가 있으면 INSERT OR IGNORE 로 하루 한 줄', async () => {
    const { DB, sqls } = fakeDb()
    await recordFollowerSnapshot(DB, 7, 'instagram', 'ig-1', 9283, NOW)
    expect(sqls).toHaveLength(1)
    expect(sqls[0].sql, '같은 날 두 번 눌러도 기준선이 움직이면 안 된다').toMatch(/INSERT OR IGNORE/i)
    expect(sqls[0].binds).toEqual([7, 'instagram', 'ig-1', 9283, '2026-11-20'])
  })

  it('KST 로 끊는다 — 한국 저녁에 누른 것이 다음 날로 가지 않는다', async () => {
    // UTC 2026-11-20 16:00 = KST 2026-11-21 01:00 → 한국 날짜는 21일이다.
    const { DB, sqls } = fakeDb()
    await recordFollowerSnapshot(DB, 7, 'instagram', 'ig-1', 10, Date.parse('2026-11-20T16:00:00Z'))
    expect(sqls[0].binds[4]).toBe('2026-11-21')
    // 그리고 UTC 로 끊었다면 20일이 나왔을 것이다(이 시험이 실제로 무엇을 가르는지).
    expect(new Date(Date.parse('2026-11-20T16:00:00Z')).toISOString().slice(0, 10)).toBe('2026-11-20')
  })
})

// ── ② ③ 추이 ───────────────────────────────────────────────────────

describe('② 추이는 같은 계정끼리만 비교한다', () => {
  it('조회가 external_id 로 거른다', async () => {
    const { DB, sqls } = fakeDb({ follower_count: 9000, taken_on: '2026-11-10' })
    await followerTrend(DB, 7, 'instagram', 'ig-1', 9283, NOW)
    expect(sqls).toHaveLength(1)
    expect(sqls[0].sql, '계정을 갈아탄 사람에게 거짓 성장이 찍힌다').toMatch(/external_id\s*=\s*\?/)
    expect(sqls[0].binds.slice(0, 3)).toEqual([7, 'instagram', 'ig-1'])
  })

  it('기준이 7일보다 오래된 것 중 가장 최근이다', async () => {
    const { DB, sqls } = fakeDb({ follower_count: 9000, taken_on: '2026-11-10' })
    await followerTrend(DB, 7, 'instagram', 'ig-1', 9283, NOW)
    expect(sqls[0].sql).toMatch(/taken_on\s*<=\s*\?/)
    expect(sqls[0].sql).toMatch(/ORDER BY taken_on DESC/i)
    // 하한 = 오늘 − 7일. 넘겨준 값이 실제로 그 날짜인지 본다(상수만 보면 계산이 틀려도 통과한다).
    expect(sqls[0].binds[3]).toBe('2026-11-13')
  })

  it('증감과 날수를 실제로 센다', async () => {
    const { DB } = fakeDb({ follower_count: 9000, taken_on: '2026-11-10' })
    expect(await followerTrend(DB, 7, 'instagram', 'ig-1', 9283, NOW)).toEqual({ delta: 283, days: 10 })
  })

  it('줄어든 것도 그대로 말한다', async () => {
    const { DB } = fakeDb({ follower_count: 9500, taken_on: '2026-11-10' })
    expect(await followerTrend(DB, 7, 'instagram', 'ig-1', 9283, NOW)).toEqual({ delta: -217, days: 10 })
  })

  it('③ 기준이 없으면 null — 기다리라는 자리표시자를 만들지 않는다', async () => {
    const { DB } = fakeDb(null)
    expect(await followerTrend(DB, 7, 'instagram', 'ig-1', 9283, NOW)).toBeNull()
  })

  it('지금 팔로워를 모르면 비교하지 않는다(조회도 안 한다)', async () => {
    const { DB, sqls } = fakeDb({ follower_count: 9000, taken_on: '2026-11-10' })
    expect(await followerTrend(DB, 7, 'youtube', 'yt-1', null, NOW)).toBeNull()
    expect(sqls, '모르는 값과 비교할 기준은 없다').toHaveLength(0)
  })

  it('기준이 7일 창 안쪽이면 쓰지 않는다 (DB 가 느슨해도 함수가 막는다)', async () => {
    const { DB } = fakeDb({ follower_count: 9000, taken_on: '2026-11-18' })  // 2일 전
    expect(await followerTrend(DB, 7, 'instagram', 'ig-1', 9283, NOW)).toBeNull()
    expect(TREND_MIN_DAYS).toBe(7)
  })
})

describe('③ 추이 문구', () => {
  it('없으면 null · 0 이면 null(변화 없음을 굳이 말하지 않는다)', () => {
    expect(snsTrendText(null)).toBeNull()
    expect(snsTrendText({ delta: 0, days: 9 })).toBeNull()
  })
  it('날짜를 지어내지 않는다 — 기준이 12일 전이면 12일이라고 적는다', () => {
    expect(snsTrendText({ delta: 120, days: 12 })).toBe('12일 전보다 ↑ 120')
    expect(snsTrendText({ delta: -30, days: 7 })).toBe('7일 전보다 ↓ 30')
  })
  it('큰 수는 천 단위로 끊는다', () => {
    expect(snsTrendText({ delta: 12345, days: 8 })).toBe('8일 전보다 ↑ 12,345')
  })
})

// ── ④ ⑥ 프로필 조회 ────────────────────────────────────────────────

describe('④⑥ 새 필드 — 사진 · 게시물 수', () => {
  it('인스타: media_count · profile_picture_url 을 요청하고 읽는다', async () => {
    const calls = fakeFetch(() => ({
      user_id: 'ig-1', username: 'urdeal_official', name: '유어딜', account_type: 'BUSINESS',
      followers_count: 9283, media_count: 13, profile_picture_url: 'https://cdn.example/a.jpg',
    }))
    const got = await fetchProfile('instagram', 't')
    expect(got.ok).toBe(true)
    expect(calls[0]).toContain('media_count')
    expect(calls[0]).toContain('profile_picture_url')
    if (got.ok) {
      expect(got.profile.post_count).toBe(13)
      expect(got.profile.profile_image_url).toBe('https://cdn.example/a.jpg')
    }
  })

  it('유튜브: 이미 받던 응답에서 꺼낸다 — 요청 필드를 늘리지 않는다', async () => {
    const calls = fakeFetch(() => ({ items: [{
      id: 'yt-1',
      snippet: { title: '유어딜', customUrl: '@urdeal', thumbnails: { default: { url: 'd.jpg' }, medium: { url: 'm.jpg' }, high: { url: 'h.jpg' } } },
      statistics: { subscriberCount: '1204', videoCount: '37' },
    }] }))
    const got = await fetchProfile('youtube', 't')
    // 🩸 `toContain` 은 `part=snippet,statistics,contentDetails` 도 통과시킨다 — 쿼터만 더 쓰고
    //    얻는 게 없는데 "비용 0" 이라는 이 변화의 전제가 조용히 깨진다(주입이 잡았다).
    expect(calls[0], '종전과 같은 part 여야 비용이 0 이다').toMatch(/[?&]part=snippet,statistics&/)
    if (got.ok) {
      expect(got.profile.post_count).toBe(37)
      expect(got.profile.profile_image_url, '40px 를 2배로 그리므로 큰 것부터').toBe('h.jpg')
    }
  })

  it('유튜브: 큰 썸네일이 없으면 있는 것으로, 하나도 없으면 null(지어내지 않는다)', async () => {
    fakeFetch(() => ({ items: [{ id: 'yt-1', snippet: { thumbnails: { default: { url: 'd.jpg' } } }, statistics: {} }] }))
    const a = await fetchProfile('youtube', 't')
    if (a.ok) expect(a.profile.profile_image_url).toBe('d.jpg')
    vi.unstubAllGlobals()
    fakeFetch(() => ({ items: [{ id: 'yt-1', snippet: {}, statistics: {} }] }))
    const b = await fetchProfile('youtube', 't')
    if (b.ok) {
      expect(b.profile.profile_image_url).toBeNull()
      expect(b.profile.post_count, '없는 영상 수를 0 으로 적지 않는다').toBeNull()
    }
  })

  it('틱톡: avatar_url · video_count 를 요청하고 읽는다', async () => {
    const calls = fakeFetch(() => ({ data: { user: { open_id: 'tt-1', username: 'u', follower_count: 5, avatar_url: 'av.jpg', video_count: 9 } } }))
    const got = await fetchProfile('tiktok', 't')
    expect(calls[0]).toContain('avatar_url')
    expect(calls[0]).toContain('video_count')
    if (got.ok) {
      expect(got.profile.profile_image_url).toBe('av.jpg')
      expect(got.profile.post_count).toBe(9)
    }
  })

  it('숨긴 구독자는 여전히 null 이다 (종전 규칙을 안 깬다)', async () => {
    fakeFetch(() => ({ items: [{ id: 'yt-1', snippet: {}, statistics: { subscriberCount: '10', hiddenSubscriberCount: true, videoCount: '3' } }] }))
    const got = await fetchProfile('youtube', 't')
    if (got.ok) {
      expect(got.profile.follower_count).toBeNull()
      expect(got.profile.account_type).toBe('hidden_subscribers')
      expect(got.profile.post_count, '구독자를 숨겨도 영상 수는 공개다').toBe(3)
    }
  })
})

describe('④ 사진은 R2 로 옮겨 저장한다', () => {
  it('저장·갱신이 이관 함수를 지난다 (플랫폼 주소를 그대로 적지 않는다)', () => {
    for (const fn of ['saveSnsLink', 'refreshSnsLink']) {
      const i = LINK.indexOf(`export async function ${fn}`)
      expect(i, `${fn} 를 찾았는가`).toBeGreaterThan(0)
      const after = LINK.slice(i + 1).search(/\nexport /)
      const body = LINK.slice(i, after === -1 ? undefined : i + 1 + after)
      expect(body.length, '본문을 실제로 잘랐는가').toBeGreaterThan(400)
      expect(body, `${fn} 가 사진을 이관하지 않는다 — 플랫폼 주소는 며칠 만에 만료된다`).toMatch(/await rehostAvatar\(env, a\.profile_image_url\)/)
      expect(body, `${fn} 가 스냅샷을 안 남긴다 — 추이를 영영 못 만든다`).toMatch(/recordFollowerSnapshot\(/)
    }
  })

  it('이관이 실패해도 예전 사진을 지우지 않는다 (COALESCE) — 저장·갱신 **둘 다**', () => {
    // 🩸 첫 판은 파일 전체에서 한 번만 찾았다. 저장 쪽에 하나가 남아 있으면 **갱신 쪽을 깨도 통과**한다
    //    (주입이 그걸 잡았다). 자리가 둘이면 둘 다 세야 한다.
    const n = (LINK.match(/profile_image_url\s*=\s*COALESCE\(/g) || []).length
    expect(n, '일시 장애로 멀쩡한 사진을 지우면 누를 때마다 깜빡인다 — 저장·갱신 두 자리 모두').toBe(2)
  })

  it('버킷이 없으면 사진만 건너뛴다 — 연동은 멀쩡하다', () => {
    const i = LINK.indexOf('async function rehostAvatar')
    const body = LINK.slice(i, i + 400)
    expect(body).toMatch(/if \(!raw \|\| !env\.MEDIA_BUCKET\) return null/)
  })
})

// ── ⑤ 화면 ─────────────────────────────────────────────────────────

describe('⑤ 카드', () => {
  it('사진이 죽으면 로고 원으로 떨어진다 — 빈 동그라미를 남기지 않는다', () => {
    // 🩸 `setDeadPhoto` 를 그냥 찾으면 **선언·⟳ 초기화**에도 있어서 onError 분기를 통째로 지워도 통과한다
    //    (주입이 잡았다). 물어야 할 것은 "사진이 죽었을 때 **그 사실을 기록하는가**" 다.
    const i = LIST.indexOf('const onPhotoError')
    expect(i, 'onPhotoError 를 찾았는가').toBeGreaterThan(0)
    const body = LIST.slice(i, LIST.indexOf('}, [])', i))
    expect(body.length, '본문을 실제로 잘랐는가').toBeGreaterThan(60)
    expect(body, '숨기고 끝내면 아무것도 없는 동그라미가 남는다').toMatch(/cfFallback === '2'[\s\S]{0,80}setDeadPhoto/)
    expect(LIST, '사진 자리와 로고 원이 한 삼항이어야 둘 중 하나는 반드시 그려진다').toMatch(/photo \? \(/)
  })

  it('cfImage 로 감싼 사진에는 onError 가 있다 (깨진 아이콘 금지)', () => {
    const img = LIST.slice(LIST.indexOf('<img'), LIST.indexOf('/>', LIST.indexOf('<img')))
    expect(img).toMatch(/cfImage\(/)
    expect(img).toMatch(/onError=/)
  })

  it('계정 링크는 저장된 profile_url 로만 — 주소를 손으로 짓지 않는다', () => {
    expect(LIST).toMatch(/l\?\.profile_url \? \(/)
    expect(LIST).toMatch(/rel="noopener noreferrer"/)
    expect(LIST, '플랫폼 주소를 화면에서 조립하면 서버가 저장한 것과 갈린다')
      .not.toMatch(/https:\/\/(www\.)?(instagram|youtube|tiktok)\.com/)
  })

  it('못 읽은 이유·추이·게시물 수를 공용 SSOT 에서 받는다', () => {
    for (const f of ['snsUnknownFollowerText', 'snsUnknownFollowerHint', 'snsTrendText', 'snsAccountLabel', 'POST_WORD']) {
      expect(LIST, `${f} 를 안 쓰면 같은 말이 두 벌이 된다`).toContain(f)
    }
  })

  it('0 으로 위장하지 않는다 — 못 읽으면 —', () => {
    expect(LIST).toMatch(/l\.follower_count === null \? '—'/)
  })

  it('보조 숫자를 굵게 만들지 않는다 (12·13px 의 700+ 금지)', () => {
    // 🩸 첫 판은 `text-[13px]` 과 `font-bold` 가 **같은 class 속성 안**에 있을 때만 봤다.
    //    보조 숫자는 13px 줄 **안쪽 span** 이라 거기에 font-bold 를 박아도 통과했다(주입이 잡았다).
    //    ⇒ 굵은 글자가 몇 개인지를 센다 — 덩어리의 주인공은 팔로워 하나다.
    const n = (LIST.match(/font-bold/g) || []).length
    expect(n, `굵은 글자는 팔로워(24px) 하나뿐이어야 한다 (실측 ${n}개)`).toBe(1)
    expect(LIST.slice(LIST.indexOf('font-bold') - 60, LIST.indexOf('font-bold')), '그 하나가 24px 인가')
      .toContain('text-[24px]')
    expect(LIST).not.toMatch(/font-semibold/)
  })

  it('버튼은 제 줄에 둔다 — 숫자 길이에 따라 줄 높이가 갈리지 않게', () => {
    expect(LIST).toMatch(/flex items-center justify-end gap-1/)
  })
})

// ── 말(SSOT) ───────────────────────────────────────────────────────

describe('계정 종류 · 못 읽은 이유', () => {
  it('모든 줄에 붙는 라벨은 정보가 아니다 — 평범한 채널엔 안 붙인다', () => {
    expect(snsAccountLabel('youtube', 'channel')).toBeNull()
    expect(snsAccountLabel('youtube', 'hidden_subscribers')).toBe('구독자 비공개')
  })
  it('모르는 값은 지어내지 않는다', () => {
    expect(snsAccountLabel('instagram', 'SOMETHING_NEW')).toBeNull()
    expect(snsAccountLabel('instagram', null)).toBeNull()
    expect(snsAccountLabel('instagram', 'BUSINESS')).toBe('비즈니스 계정')
  })
  it('이유를 알면 이유를, 모르면 사실만 말한다', () => {
    expect(snsUnknownFollowerText('youtube', 'hidden_subscribers')).toBe('구독자 수를 숨긴 채널이에요')
    expect(snsUnknownFollowerText('tiktok', null)).toBe('틱톡 심사가 끝나면 보여요')
    expect(snsUnknownFollowerText('instagram', null)).toBe('팔로워 수를 읽지 못했어요')
  })
  it('사람이 고칠 수 있을 때만 한 줄 더 — 아니면 빈말을 안 한다', () => {
    expect(snsUnknownFollowerHint('youtube', 'hidden_subscribers')).toContain('유튜브 스튜디오')
    expect(snsUnknownFollowerHint('tiktok', null), '사람이 할 수 있는 게 없다').toBeNull()
    expect(snsUnknownFollowerHint('youtube', 'channel')).toBeNull()
  })
  it('플랫폼마다 게시물을 부르는 말이 다르다', () => {
    expect(POST_WORD).toEqual({ instagram: '게시물', youtube: '영상', tiktok: '영상' })
  })
})

// ── ⑦ 스키마 · 해제 ────────────────────────────────────────────────

describe('⑦ 표와 해제', () => {
  it('이미 있는 표에도 컬럼이 생긴다 (CREATE 는 안 닿는다)', () => {
    expect(DB_SQL).toMatch(/ALTER TABLE user_sns_links ADD COLUMN profile_image_url TEXT/)
    expect(DB_SQL).toMatch(/ALTER TABLE user_sns_links ADD COLUMN post_count INTEGER/)
  })

  it('스냅샷은 하루 한 줄로 잠긴다', () => {
    expect(DB_SQL).toMatch(/CREATE TABLE IF NOT EXISTS user_sns_follower_snapshots/)
    expect(DB_SQL).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS idx_sns_snapshot_day ON user_sns_follower_snapshots\(user_id, platform, taken_on\)/)
    expect(DB_SQL, 'external_id 를 안 적으면 계정을 갈아탄 사람과 비교하게 된다')
      .toMatch(/user_sns_follower_snapshots \([\s\S]{0,400}external_id TEXT NOT NULL/)
  })

  it('해제하면 지난 기록도 지운다', () => {
    expect(ROUTES).toMatch(/DELETE FROM user_sns_follower_snapshots WHERE user_id = \? AND platform = \?/)
  })

  it('external_id 는 추이용이고 화면으로 안 나간다', () => {
    const i = LINK.indexOf('export async function listSnsLinks')
    const body = LINK.slice(i, i + 1200)
    // 🔎 "안 내보낸다" 를 **빼내는 모양**으로 고정한다 — 결과 객체에 `external_id` 를 다시 넣으면 깨진다.
    expect(body, '플랫폼 내부 식별자를 굳이 내보낼 이유가 없다').toMatch(/\(\{ external_id, \.\.\.x \}\)/)
    // 🩸 처음엔 본문에서 `external_id` 가 다시 나오는지로 봤는데, `followerTrend(..., external_id, ...)`
    //    라는 **정당한 사용**에 걸려 거짓 빨간불이 났다. 물어야 할 것은 "공개 타입에 들어 있는가" 다.
    const t = LINK.slice(LINK.indexOf('export interface SnsLinkRow'))
    expect(t.slice(0, t.indexOf('}')), '공개 타입에 넣으면 그대로 화면까지 나간다').not.toContain('external_id')
    expect(body).toMatch(/trend: await followerTrend\(/)
  })
})
