/**
 * 🎯 2026-10-15 공급 모으기 마케터 — 대표 *"한동안은 매장을 꾸준히 모으는 형태로 가야지. 인플루언서도 모아야하고"*.
 *
 * 이 시험이 지키는 것:
 *   ① 작성기가 만든 **모든** 조합이 거짓말을 안 한다 — 꺼진 혜택(담기 보상·영입·초대)·규모 과장·
 *      **설정에 없는 퍼센트**를 거른다. 수수료 숫자는 라이브 설정값만 나온다.
 *   ② 게시물 링크가 기존 유입 추적 규칙을 통과한다(통과 못 하면 성과가 조용히 0 이 된다).
 *   ③ 성과 퍼널 SQL 을 **진짜 SQLite** 에 돌려 매장 전환을 맞게 센다.
 *   ④ 배선 — 대상 혼합비 · 매일 잡 · 키 게이트 제거 · 신청서의 유입 귀속.
 *
 * ⚠️ 못 막는 것: 글이 "좋은지"(사람 판단) · 플랫폼이 실제로 게시하는지 · 혜택이 *새로* 꺼지는 것
 *    (그때는 `SUPPLY_FORBIDDEN` 에 한 줄을 더해야 한다 — 그 판단은 사람이 한다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'module'
import { composeSupplyDraft } from '@/features/social-media/api/social-supply-compose'
import {
  STORE_TOPICS, CREATOR_TOPICS, findSupplyViolation, supplyFactsFromSettings, allowedPercents, type SupplyFacts,
} from '@/features/social-media/api/social-supply-brief'
import {
  postSrcTag, linkLine, landingUrl, parseAudienceMix, pickAudience, AUDIENCE_LANDING, DEFAULT_AUDIENCE_MIX,
  INSTAGRAM_BIO_SRC, type SocialAudience,
} from '@/features/social-media/api/social-audience'
import { SOCIAL_PLATFORMS } from '@/features/social-media/api/social-brief'
import { FUNNEL_SQL, mergeFunnel, pickTopicByPerformance } from '@/features/social-media/api/social-funnel'
import { normalizeAcqSource } from '@/worker/utils/acquisition'
import { readCode } from '../helpers/source-text'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

const LIVE: SupplyFacts = supplyFactsFromSettings({ fee_channel_rates_enabled: 'true', platform_fee_pct_direct: '10', platform_fee_pct_brokered: '5' })
const SINGLE: SupplyFacts = supplyFactsFromSettings({ fee_channel_rates_enabled: 'false', commission_rate_default: '7' })
const NONCES = [0, 1, 2, 5, 9]

function every() {
  const out: Array<{ key: string; audience: 'store' | 'creator'; platform: string; text: string; body: string; title: string; tags: string[]; facts: SupplyFacts }> = []
  for (const facts of [LIVE, SINGLE]) {
    for (const audience of ['store', 'creator'] as const) {
      const topics = audience === 'store' ? STORE_TOPICS : CREATOR_TOPICS
      for (const platform of SOCIAL_PLATFORMS) {
        for (const topic of topics) {
          for (const nonce of NONCES) {
            const src = postSrcTag(platform, 1234 + nonce)
            const r = composeSupplyDraft(platform, audience, topic, facts, linkLine(platform, audience, src), nonce)
            const key = `${audience}/${platform}/${topic.slug}/${nonce}/fee${facts.feeDirect}`
            if (!r.ok) throw new Error(`생성 실패 ${key}: ${r.error}`)
            out.push({ key, audience, platform, facts, title: r.draft.title, body: r.draft.body, tags: r.draft.hashtags, text: `${r.draft.title}\n${r.draft.body}\n${r.draft.hashtags.join(' ')}` })
          }
        }
      }
    }
  }
  return out
}
const ALL = every()

describe('① 공급 초안 전수 — 거짓말을 안 한다', () => {
  it('조합이 실제로 만들어진다 (0건이면 통과가 아니라 실패)', () => {
    expect(ALL.length).toBe(2 * SOCIAL_PLATFORMS.length * (STORE_TOPICS.length + CREATOR_TOPICS.length) * NONCES.length)
    expect(ALL.length).toBeGreaterThan(300)
  })

  it('금지 표현·설정에 없는 퍼센트가 하나도 없다', () => {
    for (const d of ALL) expect(findSupplyViolation(d.text, d.audience, d.facts), d.key).toBeNull()
  })

  it('매장 글의 퍼센트는 라이브 설정값과 정확히 같다 (채널 요율을 끄면 한 가지 요율만)', () => {
    const live = ALL.filter((d) => d.audience === 'store' && d.facts === LIVE && /수수료/.test(d.body) && /%/.test(d.body))
    expect(live.length, '수수료를 말하는 매장 글이 0건이면 이 단언이 헛돈다').toBeGreaterThan(10)
    for (const d of live) expect(d.body, d.key).toMatch(/10%/)
    const single = ALL.filter((d) => d.audience === 'store' && d.facts === SINGLE && /%/.test(d.body))
    expect(single.length).toBeGreaterThan(5)
    for (const d of single) {
      expect(d.body, d.key).toMatch(/7%/)
      expect(d.body, `${d.key} — 채널 요율이 꺼졌는데 대행사 요율을 말한다`).not.toMatch(/대행사/)
    }
  })

  it('소개 파트너 글에는 숫자 퍼센트가 없다 (몫은 가게가 정한다)', () => {
    for (const d of ALL.filter((x) => x.audience === 'creator')) expect(/\d\s*%/.test(d.body), d.key).toBe(false)
  })

  it('사람 티: 이모지·느낌표·상투어 없음, 문단 길이가 섞인다', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u
    const banned = ['여러분', '지금 바로', '놓치지 마세요', '바쁜 일상 속에서', '요즘 같은 시대에', '완벽', '최적의']
    for (const d of ALL) {
      expect(emoji.test(d.body), d.key).toBe(false)
      expect(d.body.includes('!'), d.key).toBe(false)
      for (const w of banned) expect(d.body.includes(w), `${d.key} "${w}"`).toBe(false)
      const lens = d.body.split(/\n+/).map((s) => s.trim()).filter(Boolean).map((s) => s.length)
      expect(lens.length, d.key).toBeGreaterThanOrEqual(3)
      expect(Math.max(...lens) - Math.min(...lens), d.key).toBeGreaterThan(8)
    }
  })

  it('플랫폼 형식 — 길이 상한(링크 포함) · 링크 처리 · 해시태그', () => {
    for (const d of ALL) {
      if (d.platform === 'threads') expect(d.body.length, d.key).toBeLessThanOrEqual(500)
      if (d.platform === 'instagram') {
        expect(d.body.length, d.key).toBeLessThanOrEqual(300)
        expect(d.body, `${d.key} — 인스타 캡션 링크는 안 눌린다`).not.toMatch(/https?:\/\//)
        expect(d.body).toMatch(/프로필 링크/)
        expect(d.tags.length).toBeGreaterThanOrEqual(12)
      } else {
        expect(d.body, d.key).toMatch(/https:\/\/urdeal\.kr\/[^\s]*\?src=sns-(th|yt)-\d+/)
      }
      expect(new Set(d.tags).size, d.key).toBe(d.tags.length)
      for (const t of d.tags) expect(t.startsWith('#')).toBe(false)
    }
  })

  it('주제가 바뀌면 글이 바뀐다 · 같은 입력이면 같은 글(결정론)', () => {
    const bodies = STORE_TOPICS.map((t) => {
      const r = composeSupplyDraft('threads', 'store', t, LIVE, 'L', 0)
      return r.ok ? r.draft.body : ''
    })
    expect(new Set(bodies).size).toBe(STORE_TOPICS.length)
    const a = composeSupplyDraft('threads', 'creator', CREATOR_TOPICS[2], LIVE, 'L', 3)
    const b = composeSupplyDraft('threads', 'creator', CREATOR_TOPICS[2], LIVE, 'L', 3)
    expect(a.ok && b.ok && a.draft.body === b.draft.body).toBe(true)
  })
})

describe('① 검증기 자체가 잡는가 (헛도는 검증 방지)', () => {
  const bad: Array<[string, 'store' | 'creator']> = [
    ['유어샵에 담기만 하면 팔릴 때마다 몫이 쌓여요', 'creator'],
    ['영입하면 2% 를 드립니다', 'store'],
    ['친구 초대 보상도 있어요', 'creator'],
    ['벌써 120곳이 함께합니다', 'store'],
    ['업계 최저 수수료', 'store'],
    ['수수료는 3% 입니다', 'store'],
    ['몫은 5% 예요', 'creator'],
    ['인플루언서 모집', 'creator'],
    ['매출이 확실히 늘어요', 'store'],
    ['월 이용료 없이', 'store'],
  ]
  for (const [text, aud] of bad) {
    it(`거른다: "${text}"`, () => expect(findSupplyViolation(text, aud, LIVE)).not.toBeNull())
  }
  it('정상 문장은 통과한다 (설정값 퍼센트)', () => {
    expect(findSupplyViolation('직접 올리면 10%, 대행사를 통하면 5% 수수료. 사장님 몫은 90%.', 'store', LIVE)).toBeNull()
    expect(allowedPercents(LIVE).sort((x, y) => x - y)).toEqual([5, 10, 90, 95])
  })
  it('주제 백로그 자체도 금지 표현이 없다', () => {
    for (const t of STORE_TOPICS) expect(findSupplyViolation(`${t.title} ${t.angle}`, 'store', LIVE), t.slug).toBeNull()
    for (const t of CREATOR_TOPICS) expect(findSupplyViolation(`${t.title} ${t.angle}`, 'creator', LIVE), t.slug).toBeNull()
  })
})

describe('① 사실은 라이브 설정에서 온다', () => {
  it('채널 요율 ON → 직접·중개 두 요율', () => {
    expect(supplyFactsFromSettings({ platform_fee_pct_direct: '12', platform_fee_pct_brokered: '6' })).toMatchObject({ feeDirect: 12, feeBrokered: 6 })
  })
  it('채널 요율 OFF → 기본 요율 하나', () => {
    expect(SINGLE).toMatchObject({ feeDirect: 7, feeBrokered: null })
  })
  it('설정을 못 읽거나 값이 망가지면 사장님 덱·랜딩과 같은 값으로 내려간다', () => {
    expect(supplyFactsFromSettings({})).toMatchObject({ feeDirect: 10, feeBrokered: 5 })
    expect(supplyFactsFromSettings({ platform_fee_pct_direct: 'abc', platform_fee_pct_brokered: '999' })).toMatchObject({ feeDirect: 10, feeBrokered: 5 })
  })
})

describe('② 유입 태그 · 착지 · 혼합비', () => {
  it('게시물 태그가 유입 추적 규칙을 통과한다 (통과 못 하면 성과가 조용히 0)', () => {
    for (const p of SOCIAL_PLATFORMS) for (const id of [1, 99, 123456789]) {
      const tag = postSrcTag(p, id)
      expect(normalizeAcqSource(tag), tag).toBe(tag)
    }
    expect(postSrcTag('instagram', 77)).toBe(INSTAGRAM_BIO_SRC)
    expect(landingUrl('store', 'sns-th-5')).toBe('https://urdeal.kr/partners?src=sns-th-5')
  })

  it('소개 파트너 착지는 꺼진 보상을 약속하는 페이지가 아니다', () => {
    expect(AUDIENCE_LANDING.creator).toBe('/creators/apply')
    expect(['/influencer', '/creators']).not.toContain(AUDIENCE_LANDING.creator)
  })

  it('혼합비 파싱 — 잘못된 값은 기본값, 손님 기본 0', () => {
    expect(parseAudienceMix('')).toEqual(DEFAULT_AUDIENCE_MIX)
    expect(DEFAULT_AUDIENCE_MIX.consumer).toBe(0)
    expect(parseAudienceMix('store:1,creator:1,consumer:2')).toEqual({ store: 1, creator: 1, consumer: 2 })
    expect(parseAudienceMix('garbage')).toEqual(DEFAULT_AUDIENCE_MIX)
    expect(parseAudienceMix('store:0,creator:0')).toEqual(DEFAULT_AUDIENCE_MIX)
  })

  it('고르기를 반복하면 혼합비에 수렴하고, 비중 0 은 한 번도 안 고른다', () => {
    const counts: Record<SocialAudience, number> = { store: 0, creator: 0, consumer: 0 }
    for (let i = 0; i < 50; i++) counts[pickAudience(DEFAULT_AUDIENCE_MIX, counts)]++
    expect(counts).toEqual({ store: 30, creator: 20, consumer: 0 })
  })
})

describe('③ 성과 퍼널 — 진짜 SQLite', () => {
  function seed() {
    const db = new DatabaseSync(':memory:')
    db.exec(`
      CREATE TABLE acquisition_landings (id INTEGER PRIMARY KEY, src TEXT, region_code TEXT, created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE user_acquisition (user_id TEXT PRIMARY KEY, src TEXT, region_code TEXT, landed_at TEXT, claimed_at TEXT, first_order_at TEXT, first_order_ref TEXT);
      CREATE TABLE seller_operators (id INTEGER PRIMARY KEY, seller_id INTEGER, user_id INTEGER, role TEXT, granted_by_user_id INTEGER, granted_at TEXT, revoked_at TEXT, created_at TEXT);
      CREATE TABLE acquisition_conversions (id INTEGER PRIMARY KEY, src TEXT, kind TEXT, created_at TEXT DEFAULT (datetime('now')));
      INSERT INTO acquisition_landings (src) VALUES ('sns-th-1'),('sns-th-1'),('sns-th-1'),('sns-yt-2'),('qr-banner');
      INSERT INTO user_acquisition VALUES
        ('10','sns-th-1',NULL,'2026-10-01T03:00:00.000Z','2026-10-01 03:05:00',NULL,NULL),
        ('11','sns-th-1',NULL,'2026-10-01T03:00:00.000Z','2026-10-01 03:05:00',NULL,NULL),
        ('12','sns-th-1',NULL,'2026-10-01T03:00:00.000Z','2026-10-01 03:05:00',NULL,NULL),
        ('13','sns-th-1',NULL,'2026-10-01T03:00:00.000Z','2026-10-01 03:05:00',NULL,NULL),
        ('20','qr-banner',NULL,'2026-10-01T03:00:00.000Z','2026-10-01 03:05:00',NULL,NULL);
      INSERT INTO seller_operators (seller_id,user_id,role,revoked_at,created_at) VALUES
        (100,10,'owner',NULL,'2026-10-02 00:00:00'),
        (101,11,'owner',NULL,'2026-09-01 00:00:00'),
        (102,12,'operator',NULL,'2026-10-02 00:00:00'),
        (103,13,'owner','2026-10-03 00:00:00','2026-10-02 00:00:00'),
        (104,20,'owner',NULL,'2026-10-02 00:00:00');
      INSERT INTO acquisition_conversions (src,kind) VALUES ('sns-yt-2','creator_apply'),('sns-yt-2','creator_apply'),('sns-th-1','other');
    `)
    return db
  }
  const run = (db: InstanceType<typeof DatabaseSync>, sql: string) => db.prepare(sql).all() as Array<{ src: string; n: number }>

  it('매장은 "랜딩 이후 · 주인 · 회수 안 됨" 만 센다, sns 밖 소스는 안 센다', () => {
    const db = seed()
    const rows = mergeFunnel({
      landings: run(db, FUNNEL_SQL.landings), signups: run(db, FUNNEL_SQL.signups),
      stores: run(db, FUNNEL_SQL.stores), applies: run(db, FUNNEL_SQL.applies),
    })
    const th = rows.find((r) => r.src === 'sns-th-1')!
    expect(th).toMatchObject({ landings: 3, signups: 4, stores: 1, creatorApplies: 0 })
    expect(rows.find((r) => r.src === 'sns-yt-2')).toMatchObject({ landings: 1, creatorApplies: 2, stores: 0 })
    expect(rows.some((r) => r.src === 'qr-banner'), 'sns 밖 소스가 섞였다').toBe(false)
  })

  it('정렬: 공급 전환이 많은 글이 위', () => {
    const rows = mergeFunnel({ landings: [{ src: 'a', n: 9 }], signups: [], stores: [{ src: 'b', n: 1 }], applies: [{ src: 'c', n: 2 }] })
    expect(rows.map((r) => r.src)).toEqual(['c', 'b', 'a'])
  })

  it('주제 고르기: 안 쓴 주제 먼저, 다 썼으면 게시물당 전환이 높은 주제', () => {
    const ts = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }]
    expect(pickTopicByPerformance(ts, { a: { posts: 2, score: 0 } }).slug).toBe('b')
    expect(pickTopicByPerformance(ts, { a: { posts: 4, score: 1 }, b: { posts: 2, score: 2 }, c: { posts: 1, score: 0 } }).slug).toBe('b')
    expect(pickTopicByPerformance(ts, { a: { posts: 3, score: 0 }, b: { posts: 1, score: 0 }, c: { posts: 2, score: 0 } }).slug, '성과 0 이면 덜 쓴 주제로 순환').toBe('b')
  })
})

describe('④ 배선', () => {
  it('초안 생성이 대상 혼합비를 거쳐 공급 경로로 간다', () => {
    const src = readCode('src/features/social-media/api/social-draft.ts')
    expect(src).toMatch(/pickAudience\(parseAudienceMix\(settings\.social_audience_mix\)/)
    expect(src).toMatch(/if \(audience !== 'consumer'\) \{\s*return createSupplyDraft\(/)
    expect(src).toMatch(/postSrcTag\(platform, id\)/)
  })
  it('크론: 매일 돌고, 키가 없어도 초안을 만든다', () => {
    const cron = readCode('src/worker/cron/social-draft.ts')
    expect(cron).not.toMatch(/ANTHROPIC_API_KEY/)
    const side = readCode('src/worker-ads/side-jobs.ts')
    expect(side).toMatch(/export function runDailySocialDraftJob[\s\S]{0,120}if \(hourUTC !== 0\) return/)
    expect(side.slice(side.indexOf('export function runWeeklyJob'))).not.toMatch(/handleSocialDraft/)
    expect(readCode('src/worker-ads/index.ts')).toMatch(/runDailySocialDraftJob\(env, hourUTC/)
  })
  it('라우트가 대상을 받고 퍼널을 연다', () => {
    const r = readCode('src/features/social-media/api/social-media.routes.ts')
    expect(r).toMatch(/createSocialDraft\(c\.env, platform, topicSlug, audience\)/)
    expect(r).toMatch(/socialMediaRoutes\.get\('\/funnel'/)
  })
  it('소개 파트너 신청이 유입 소스를 남긴다 (화면 → 서버)', () => {
    expect(readCode('src/pages/CreatorApplyPage.tsx')).toMatch(/acq_src: readAcquisitionSource\(\)/)
    expect(readCode('src/features/marketing/api/influencer-apply.routes.ts')).toMatch(/recordAcquisitionConversion\(c\.env\.DB, b\.acq_src, 'creator_apply'\)/)
  })
  it('발행은 여전히 사람이 승인한 것만 (자동 발행 경로를 만들지 않았다)', () => {
    const d = readCode('src/features/social-media/api/social-draft.ts')
    expect(d).not.toMatch(/publishPost|approvePost/)
    expect(readFileSync('src/features/social-media/api/social-store.ts', 'utf8')).toMatch(/VALUES \(\?, \?, '\(작성 중\)', 'draft', \?\)/)
  })
})
