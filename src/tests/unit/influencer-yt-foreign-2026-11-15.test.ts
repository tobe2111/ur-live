/**
 * 🌏 외국 유튜버 수집 (2026-11-15 대표 결정 — "나라별 일반 인플루언서" · "10번" · "영어, 중국어, 기타 동남아 언어, 일본어").
 *
 * 지키는 것: ① 외국 몫이 한국 상한에서 **미리** 빠진다(안 빼면 한국이 90을 다 써 외국은 0) ② 하루 몫을 넘지 않는다
 * ③ 모든 나라가 고르게 돈다 ④ 검색이 실제로 그 지역·언어로 나간다 ⑤ 회차 배선(읽기 키·쓰기 키가 같다).
 * ⚠️ 못 보는 것: 구글이 그 키워드에 얼마나 돌려주는지 · 외국 채널의 연락처 수율(배포 후 국가 필터로 센다).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  FOREIGN_LOCALES, YT_FOREIGN_SEARCH_DEFAULT, YT_FOREIGN_KEY, foreignBudget, foreignYtReserve, parseForeignState,
  pickForeignSearch, runForeignYtSearch,
} from '@/features/marketing/api/influencer-yt-foreign'

const POOL_CATEGORIES = ['공동구매', '체험단', '마케팅대행사', '맛집', '카페', '외식창업', '숙소', '네일', '뷰티', '골프', '푸드', '패션', '여행', '육아', '운동', '반려동물', '리빙', 'IT/재테크', '취미', '자동']

describe('대표 결정 그대로', () => {
  it('하루 기본 10번, env 로 0~30', () => {
    expect(YT_FOREIGN_SEARCH_DEFAULT).toBe(10)
    expect(foreignBudget({})).toBe(10)
    expect(foreignBudget({ ADS_YT_FOREIGN_SEARCH_BUDGET: '0' })).toBe(0)
    expect(foreignBudget({ ADS_YT_FOREIGN_SEARCH_BUDGET: '99' })).toBe(30)
  })
  it('영어·중국어·일본어·동남아(베트남·태국·인도네시아)', () => {
    expect(FOREIGN_LOCALES.map(l => l.lang)).toEqual(['en', 'zh-Hant', 'ja', 'vi', 'th', 'id'])
    expect(FOREIGN_LOCALES.every(l => l.region !== 'KR')).toBe(true)
  })
  it('카테고리는 풀의 칸 값만', () => {
    for (const l of FOREIGN_LOCALES) for (const k of l.keywords) expect(POOL_CATEGORIES, `${l.region} ${k.kw}`).toContain(k.category)
  })
})

describe('쿼터 — 한국 몫에서 미리 뺀다', () => {
  it('오늘 안 쓴 외국 몫만큼 예약', () => {
    expect(foreignYtReserve(null, '2026-11-15', {})).toBe(10)
    expect(foreignYtReserve('2026-11-15:4:40', '2026-11-15', {})).toBe(6)
    expect(foreignYtReserve('2026-11-15:10:46', '2026-11-15', {})).toBe(0)
    expect(foreignYtReserve('2026-11-14:10:46', '2026-11-15', {})).toBe(10) // 날짜가 바뀌면 다시 10
  })
  it('누적 순번은 날이 바뀌어도 이어진다(키워드 회전이 처음으로 안 돌아간다)', () => {
    expect(parseForeignState('2026-11-14:7:123', '2026-11-15')).toEqual({ usedToday: 0, total: 123 })
  })
  it('수집 회차가 한국 상한을 총량 − 예약으로 잡는다', () => {
    const src = readFileSync('src/features/marketing/api/influencer-auto-collect.ts', 'utf8')
    expect(src).toMatch(/const ytBudgetTotal = Math\.max\(0, ytTotalCap - foreignYtReserve\(settings\[YT_FOREIGN_KEY\], ytDay, env\)\)/)
    expect(src).toMatch(/SETTING_KEYS = \[[^\]]*YT_FOREIGN_KEY\]/)          // 읽는 키
    expect(src).toMatch(/\[YT_FOREIGN_KEY, foreign\.state\]/)               // 쓰는 키 — 둘이 갈리면 영구 0
    expect(src).toMatch(/runForeignYtSearch\(env, \{[^\n]*ytTotalCap/)
  })
})

describe('회전 — 나라를 먼저 돈다', () => {
  it('처음 6번이 6개 나라 전부', () => {
    expect(new Set([0, 1, 2, 3, 4, 5].map(n => pickForeignSearch(n).region)).size).toBe(6)
  })
  it('한 바퀴 뒤엔 다음 키워드', () => {
    expect(pickForeignSearch(0).kw).not.toBe(pickForeignSearch(6).kw)
    expect(pickForeignSearch(0).region).toBe(pickForeignSearch(6).region)
  })
})

describe('실행 — 검색이 그 지역·언어로 나가고, 몫을 넘지 않는다', () => {
  afterEach(() => vi.restoreAllMocks())
  const base = { day: '2026-11-15', hasYouTube: true, quotaHit: false, ytUsedTotal: 0, ytTotalCap: 90, save: async () => 0 }

  it('URL 에 regionCode·relevanceLanguage 가 그 나라 값으로 실린다', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (u: string) => { urls.push(String(u)); return new Response(JSON.stringify({ items: [] }), { status: 200 }) }))
    const r = await runForeignYtSearch({ YOUTUBE_API_KEY: 'k' }, { ...base, raw: '2026-11-15:0:2', budget: { left: 50 } })
    expect(r.searched).toBe(true)
    expect(urls[0]).toContain('regionCode=JP'); expect(urls[0]).toContain('relevanceLanguage=ja')
    expect(r.state).toBe('2026-11-15:1:3')
  })
  it('오늘 몫을 다 썼으면 안 부른다', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    const r = await runForeignYtSearch({ YOUTUBE_API_KEY: 'k' }, { ...base, raw: '2026-11-15:10:60', budget: { left: 50 } })
    expect(r.searched).toBe(false); expect(f).not.toHaveBeenCalled(); expect(r.state).toBe('2026-11-15:10:60')
  })
  it('총량이 찼거나 쿼터가 터졌으면 안 부른다', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect((await runForeignYtSearch({ YOUTUBE_API_KEY: 'k' }, { ...base, raw: null, ytUsedTotal: 90, budget: { left: 50 } })).searched).toBe(false)
    expect((await runForeignYtSearch({ YOUTUBE_API_KEY: 'k' }, { ...base, raw: null, quotaHit: true, budget: { left: 50 } })).searched).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })
  it('한국 수집 기본값은 그대로 KR·ko', () => {
    const d = readFileSync('src/features/marketing/api/influencer-discovery.ts', 'utf8')
    expect(d).toContain("opts.regionCode : 'KR'}&relevanceLanguage=")
    expect(d).toContain("opts.relevanceLanguage : 'ko'}&q=")
  })
  it('키 이름', () => expect(YT_FOREIGN_KEY).toBe('ads_yt_foreign_used'))
})
