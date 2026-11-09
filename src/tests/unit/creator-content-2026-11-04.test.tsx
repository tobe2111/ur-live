/**
 * 🎬 이용권 상세 "다녀온 사람들" 〔2026-11-04 대표 확정 — 손님 2 + 사장님 2 + 블로그 창 · 유튜브는 유어애즈와 자동 분담〕
 *
 * 지키는 것
 *   ① 주소 판정 — 다섯 플랫폼만, 모르는 주소는 거절(아무 사이트나 손님 화면에 걸지 않는다)
 *   ② 가게 이름 매칭 — 핵심 이름이 그대로 들어간 글만 후보, 2자 이하 이름은 매칭 안 함
 *   ③ 정렬 — 고정 → 유어딜 사람 → 영상 → 블로그
 *   ④ 유튜브 몫 — 아직 안 쓴 만큼만 비워 두고, 태평양시 18시 뒤엔 0(유어애즈로 돌려준다)
 *   ⑤ 자동 수집은 **후보로만** 저장 / 사장님 API 는 소유권(seller_id)을 본다 / 유어딜 사람은 숨기기만
 *   ⑥ 유어애즈 성과 측정이 그 몫을 실제로 비워 둔다(배선)
 *   ⑦ 손님 줄 — 0개면 아무것도 안 그린다 · 있으면 유어딜 사람 배지 · 블로그 3개 뒤 모두 보기
 * 못 보는 것: 검색 결과의 질 · 네이버가 실제로 창 안 표시를 허락하는지(라이브에서 헤더로 판정) · 재생기 실제 재생.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import {
  parseContentUrl, mentionsStore, coreStoreName, sortForCustomer, contentYtReservedUnits, readDayCount,
  searchQueryFor, stripHtml, confidentMatch, isStoreOwnPost, videoMatch, branchOf, CONTENT_YT_DAILY_SEARCHES, type ContentItem,
} from '@/shared/creator-content'
import { storeKeyFor } from '@/features/creator-content/api/content-db'
import { pickBlogCandidates, pickVideoCandidates } from '@/features/creator-content/api/content-collect'
import { frameAllowed } from '@/features/creator-content/api/content-meta'
import CreatorContentRow from '@/pages/group-buy/creator-content/CreatorContentRow'

const read = (p: string) => readFileSync(p, 'utf8')

describe('① 주소 판정', () => {
  it.each([
    ['https://www.youtube.com/shorts/abcdefghijk', 'youtube', 'abcdefghijk'],
    ['https://youtu.be/abcdefghijk?si=x', 'youtube', 'abcdefghijk'],
    ['https://www.instagram.com/reel/C1abcDEF2/', 'instagram', 'C1abcDEF2'],
    ['https://www.instagram.com/someone/reel/C1abcDEF2/', 'instagram', 'C1abcDEF2'],
    ['https://www.tiktok.com/@ppang/video/7312345678901234567', 'tiktok', '7312345678901234567'],
    ['https://blog.naver.com/bread_diary/223456789012', 'naver_blog', 'bread_diary/223456789012'],
    ['https://m.blog.naver.com/PostView.naver?blogId=bread_diary&logNo=223456789012', 'naver_blog', 'bread_diary/223456789012'],
  ])('%s', (url, platform, ext) => {
    const r = parseContentUrl(url)
    expect(r?.platform).toBe(platform)
    expect(r?.extId).toBe(ext)
  })
  it('모르는 사이트 · 짧은 틱톡 주소 · 깨진 값은 거절', () => {
    for (const u of ['https://evil.example.com/x', 'https://vt.tiktok.com/ZS123/', 'javascript:alert(1)', '', 'https://blog.naver.com/x'])
      expect(parseContentUrl(u)).toBeNull()
  })
})

describe('② 가게 이름 매칭', () => {
  it('지점 꼬리를 떼고 공백 무시로 찾는다', () => {
    expect(coreStoreName('꾸꾸데쎄르 (연산점)')).toBe('꾸꾸데쎄르')
    expect(mentionsStore('연산동 <b>꾸꾸 데쎄르</b> 소금빵 후기', '꾸꾸데쎄르 연산점')).toBe(true)
    expect(mentionsStore('부산 빵집 투어', '꾸꾸데쎄르')).toBe(false)
  })
  it('2자 이하 핵심 이름은 매칭하지 않는다(아무 글에나 걸린다)', () => {
    expect(mentionsStore('카페 투어', '카페')).toBe(false)
  })
  it('검색어 = 이름 + 동네', () => {
    expect(searchQueryFor('꾸꾸데쎄르', '부산 연제구 연산동 12')).toBe('꾸꾸데쎄르 연산동')
    expect(searchQueryFor('꾸꾸데쎄르', '부산 연제구 중앙대로 12')).toBe('꾸꾸데쎄르 연제구')
    expect(stripHtml('<b>소금빵</b> &amp; 커피')).toBe('소금빵 & 커피')
  })
  it('네이버 검색 결과 → 이 가게 글만, 협찬 표시', () => {
    const r = pickBlogCandidates([
      { title: '<b>꾸꾸데쎄르</b> 솔직 후기', link: 'https://blog.naver.com/a_b/223456789012', description: '소정의 원고료를 받아', bloggername: '빵순이', postdate: '20261021' },
      { title: '다른 빵집', link: 'https://blog.naver.com/c_d/223456789013', description: '맛있다', bloggername: 'x', postdate: '20261021' },
    ], '꾸꾸데쎄르')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ extId: 'a_b/223456789012', sponsored: true, published: '2026-10-21' })
  })
  it('유튜브 결과도 같은 규칙', () => {
    const r = pickVideoCandidates([
      { id: { videoId: 'abcdefghijk' }, snippet: { title: '꾸꾸데쎄르 소금빵', channelTitle: '빵', thumbnails: { high: { url: 'https://i.ytimg.com/x.jpg' } } } },
      { id: { videoId: 'zzzzzzzzzzz' }, snippet: { title: '아무 영상' } },
    ], '꾸꾸데쎄르')
    expect(r.map((x) => x.extId)).toEqual(['abcdefghijk'])
  })
  it('창 허락 — X-Frame-Options · frame-ancestors 가 있으면 미리보기로', () => {
    expect(frameAllowed(new Headers({}))).toBe(true)
    expect(frameAllowed(new Headers({ 'x-frame-options': 'SAMEORIGIN' }))).toBe(false)
    expect(frameAllowed(new Headers({ 'content-security-policy': "frame-ancestors 'self' https://blog.naver.com" }))).toBe(false)
  })
})

const item = (over: Partial<ContentItem>): ContentItem => ({
  id: 'c:1', platform: 'youtube', kind: 'video', ext_id: 'abcdefghijk', url: 'https://x', title: 't', thumb_url: null,
  author_name: 'a', author_meta: null, summary: null, published_at: null, sponsored: false, embeddable: true, urdeal: null,
  pinned: false, position: 0, ...over,
})

describe('②-b 확실한 매칭 — 이름 + 동네', () => {
  it('둘 다 있으면 확실, 이름만이면 아니다', () => {
    expect(confidentMatch('연산동 꾸꾸데쎄르 소금빵', '꾸꾸데쎄르', '부산 연제구 연산동 12')).toBe(true)
    expect(confidentMatch('연산 꾸꾸데쎄르 후기', '꾸꾸데쎄르', '부산 연제구 연산동 12')).toBe(true)
    expect(confidentMatch('꾸꾸데쎄르 소금빵 맛있다', '꾸꾸데쎄르', '부산 연제구 연산동 12')).toBe(false)
    expect(confidentMatch('연산동 빵집 투어', '꾸꾸데쎄르', '부산 연제구 연산동 12')).toBe(false)
  })
  it('가게 키 — 이름 + 구(특별시 표기 차이 무시)', () => {
    expect(storeKeyFor('꾸꾸데쎄르', '서울특별시 강남구 1')).toBe(storeKeyFor('꾸꾸 데쎄르', '서울 강남구 2'))
    expect(storeKeyFor('꾸꾸데쎄르', '서울 강남구')).not.toBe(storeKeyFor('꾸꾸데쎄르', '부산 연제구'))
  })
})

describe('②-c 가게 자기 글 — 다녀온 사람들이 아니다', () => {
  it('블로그 이름에 가게 이름이 있으면 가게 글', () => {
    expect(isStoreOwnPost('APM휘트니스 수원점', 'APM휘트니스 수원점')).toBe(true)
    expect(isStoreOwnPost('APM휘트니스', 'APM휘트니스 수원점')).toBe(true)
    expect(isStoreOwnPost('빵순이 일기', '꾸꾸데쎄르')).toBe(false)
  })
  it('가게 글은 이름·동네가 맞아도 자동 공개되지 않는다', () => {
    const r = pickBlogCandidates([
      { title: '인계동 APM휘트니스 수원점 PT 프로그램 소개', link: 'https://blog.naver.com/apm_fit/223456789012', description: '인계동', bloggername: 'APM휘트니스 수원점', postdate: '20261104' }, // 공지 낱말 없이 — 가게 글 판정 하나로만 갈리게(2026-11-10)
      { title: '인계동 APM휘트니스 수원점 PT 후기', link: 'https://blog.naver.com/someone/223456789013', description: '인계동', bloggername: '운동하는 직장인', postdate: '20261104' },
    ], 'APM휘트니스 수원점', '경기 수원시 팔달구 인계동 1')
    expect(r.map((x) => x.confident)).toEqual([false, true])
  })
  it('손님 응답 — 자동 글은 가게 글 제외 · 한 사람 2개까지', () => {
    const routes = read('src/features/creator-content/api/content.routes.ts')
    expect(routes).toMatch(/if \(r\.source !== 'auto'\) return true/)
    expect(routes).toMatch(/if \(isStoreOwnPost\(r\.author_name, s\.store_name \?\? ''\)\) return false/)
    expect(routes).toMatch(/return n <= MAX_POSTS_PER_AUTHOR/)
  })
  it('블로그는 바로 그 글로 · 사진 없으면 빈 칸 없음 · 상세에서 유의사항과 리뷰 사이', () => {
    const row = read('src/pages/group-buy/creator-content/CreatorContentRow.tsx')
    expect(row).toMatch(/const w = window\.open\(url, '_blank'\)\n\s*if \(w\) w\.opener = null/)
    expect(row).not.toMatch(/window\.open\([^)]*'noopener'/)
    expect(read('src/pages/group-buy/creator-content/ContentViewer.tsx')).toMatch(/<a href=\{full\} target="_blank"/)
    expect(row).toMatch(/\{b\.thumb_url && \(\n\s*<span className="block h-16 w-16/)
    const page = read('src/pages/GroupBuyDetailPage.tsx')
    // 대표 "유의사항과 리뷰 사이에" — 이용권 정보(유의사항) 카드 다음, 리뷰 카드 앞.
    expect(page.indexOf('<CreatorContentLazy')).toBeGreaterThan(page.indexOf('id="gb-sec-info"'))
    expect(page.indexOf('<CreatorContentLazy')).toBeLessThan(page.indexOf('id="gb-sec-reviews"'))
  })
})

describe('②-d 겹침·숙소·스크롤 (2026-11-09 대표)', () => {
  it('재생기가 뜬 편엔 우리 글자를 안 얹고, 닫기·번호는 영상 밖 띠에', () => {
    const v = read('src/pages/group-buy/creator-content/ContentViewer.tsx')
    expect(v).toMatch(/\{!\(active && src\) && <div className="pointer-events-none absolute inset-x-0 bottom-0/)
    expect(v).not.toMatch(/absolute inset-x-0 top-0 z-10 flex items-center justify-between/)
  })
  it('숙소 상세에도 다녀온 사람들 칸 — 리뷰 앞', () => {
    const p = read('src/pages/StayDetailPage.tsx')
    expect(p.indexOf('<CreatorContentLazy')).toBeGreaterThan(0)
    expect(p.indexOf('<CreatorContentLazy')).toBeLessThan(p.indexOf('id="stay-sec-reviews"'))
  })
  it('가로 줄이 세로 스크롤을 가두지 않는다', () => {
    expect(read('src/shared/stays-list.ts')).toMatch(/row: '[^']*overflow-x-auto overflow-y-hidden touch-pan-x touch-pan-y/)
  })
})

describe('②-e 유튜브 — 이름만 · 체인점은 지점명까지 (2026-11-09 대표)', () => {
  it('지점명 뽑기', () => {
    expect(branchOf('샤브올데이 부산명륜점')).toBe('명륜')
    expect(branchOf('보광정 이태원점')).toBe('이태원')
    expect(branchOf('다인리조트')).toBeNull()
  })
  // 🎭 2026-11-10 대표 *"유튜브도 동일한 이름이지만 이용권과 관계없이 올라오네"* — "이름만" 은 동네나 다녀온 이야기 낱말까지로 좁혔다.
  it('지점 없는 가게는 이름 + (동네 또는 다녀온 이야기 낱말)', () => {
    expect(videoMatch('잠실NEW헬스케어센터 블랙타고 그룹PT', '블랙타고', '서울 송파구 석촌호수로 74')).toBe(true)
    expect(videoMatch('블랙타고 완공과정을 공개합니다!', '블랙타고', '서울 송파구 석촌호수로 74')).toBe(false)
    expect(videoMatch('제주 애월 리조트', '다인리조트')).toBe(false)
  })
  it('체인점은 지점명까지 — 다른 지점 영상은 후보로', () => {
    expect(videoMatch('미나리 소고기 #샤브올데이명륜점 #동래맛집', '샤브올데이 부산명륜점')).toBe(true)
    expect(videoMatch('호텔뷔페 안가도 되겠네.. 수영점 진짜 대박 #샤브올데이', '샤브올데이 부산명륜점')).toBe(false)
    expect(videoMatch('이태원 숙성 삼겹살 맛집 보광정이태원점', '보광정 이태원점')).toBe(true)
    expect(videoMatch('📍보광정이태원점', '보광정 이태원점')).toBe(false) // 핀 하나뿐 — 다녀온 이야기 증거가 없다
  })
  it('수집기 · 후보 재판정이 이 규칙을 쓴다', () => {
    const c = read('src/features/creator-content/api/content-collect.ts')
    expect(c).toMatch(/confident: !isStoreOwnPost\(sn\.channelTitle, storeName\) && videoMatch\(text, storeName, address\)/)
    expect(c).toMatch(/WHERE s\.platform = 'youtube' AND s\.status = 'candidate' AND s\.source = 'auto'/)
  })
})

describe('②-f 개선 7가지 (2026-11-09 대표 "전부 해줘")', () => {
  it('같은 무리 안에서 사진 있는 글 → 협찬 아닌 글 → 최근 1년 안 순서', () => {
    const now = Date.parse('2026-11-09T00:00:00Z')
    const out = sortForCustomer([
      item({ id: 'old', kind: 'blog', platform: 'naver_blog', thumb_url: 'x', published_at: '2023-01-01' }),
      item({ id: 'sp', kind: 'blog', platform: 'naver_blog', thumb_url: 'x', sponsored: true, published_at: '2026-10-01' }),
      item({ id: 'nothumb', kind: 'blog', platform: 'naver_blog', thumb_url: null, published_at: '2026-10-02' }),
      item({ id: 'best', kind: 'blog', platform: 'naver_blog', thumb_url: 'x', published_at: '2026-09-01' }),
    ], now)
    expect(out.map((x) => x.id)).toEqual(['best', 'old', 'sp', 'nothumb'])
  })
  it('사장님이 정한 순서는 그 위에 선다', () => {
    const out = sortForCustomer([item({ id: 'a', thumb_url: 'x' }), item({ id: 'b', thumb_url: null, position: 1 })])
    expect(out[0].id).toBe('b')
  })
  it('블로그도 체인점은 지점명까지', () => {
    expect(confidentMatch('명륜동 샤브올데이 명륜점 후기', '샤브올데이 부산명륜점', '부산 동래구 명륜동 1')).toBe(true)
    expect(confidentMatch('명륜동 근처 샤브올데이 수영점 후기', '샤브올데이 부산명륜점', '부산 동래구 명륜동 1')).toBe(false)
  })
  it('측정 · 어드민 · 죽은 링크 배선', () => {
    expect(read('src/features/analytics/api/funnel.routes.ts')).toMatch(/'creator_content_shown',\n\s*'creator_content_opened',\n\s*'creator_content_buy',/)
    expect(read('src/pages/group-buy/creator-content/CreatorContentRow.tsx')).toMatch(/trackFunnel\('creator_content_buy'/)
    expect(read('src/worker/index.ts')).toMatch(/adminApp\.route\('\/creator-content-stores', creatorContentAdminStoresRoutes\)/)
    expect(read('src/routes/admin.routes.tsx')).toMatch(/path="\/admin\/creator-content"/)
    const c = read('src/features/creator-content/api/content-collect.ts')
    expect(c).toMatch(/const dead = await hideDeadLinks\(DB\)/)
    expect(c).toMatch(/status = CASE WHEN \? = 1 THEN 'hidden' ELSE status END/)
  })
})

describe('③ 정렬', () => {
  it('고정 → 유어딜 사람 → 영상 → 블로그', () => {
    const out = sortForCustomer([
      item({ id: 'blog', kind: 'blog', platform: 'naver_blog' }),
      item({ id: 'vid' }),
      item({ id: 'seed', urdeal: 'seeding' }),
      item({ id: 'pin', kind: 'blog', platform: 'naver_blog', pinned: true }),
    ])
    expect(out.map((x) => x.id)).toEqual(['pin', 'seed', 'vid', 'blog'])
  })
})

describe('④ 유튜브 몫', () => {
  const pt = (h: number) => Date.UTC(2026, 10, 4, h + 8) // PST = UTC-8 (h+8 가 24 를 넘어도 다음 날로 넘어간다)
  it('안 쓴 만큼만 비워 둔다', () => {
    expect(contentYtReservedUnits(0, pt(3))).toBe(CONTENT_YT_DAILY_SEARCHES * 100)
    expect(contentYtReservedUnits(10, pt(3))).toBe(500)
    expect(contentYtReservedUnits(99, pt(3))).toBe(0)
  })
  it('태평양시 18시 뒤엔 0 — 못 쓴 몫은 유어애즈로', () => {
    expect(contentYtReservedUnits(0, pt(17))).toBe(1500)
    expect(contentYtReservedUnits(0, pt(18))).toBe(0)
  })
  it('카운터는 오늘 분만', () => {
    expect(readDayCount('2026-11-04:7', '2026-11-04')).toBe(7)
    expect(readDayCount('2026-11-03:7', '2026-11-04')).toBe(0)
  })
})

describe('⑤ 서버 규칙', () => {
  const collect = read('src/features/creator-content/api/content-collect.ts')
  const routes = read('src/features/creator-content/api/content.routes.ts')
  it('자동 수집은 확실한 글만 바로 보이고 나머지는 후보, 이미 아는 글은 다시 안 올린다', () => {
    expect(collect.match(/p\.confident \? 'visible' : 'candidate'/g)?.length).toBe(2)
    expect(collect).toMatch(/INSERT OR IGNORE INTO store_creator_content/)
    expect(collect).not.toMatch(/'visible', 'auto'/)
  })
  it('이용권만(교환권 제외) · 사장님 계정이 없는 가게도 수집한다', () => {
    expect(collect).toMatch(/COALESCE\(deal_only, 0\) = 0/)
    expect(collect).not.toMatch(/AND seller_id IS NOT NULL/)
  })
  it('수집은 ur-ads 레인에서 돈다(메인 cron 워커엔 검색 키가 없다)', () => {
    const ads = read('src/worker-ads/index.ts')
    expect(ads).toMatch(/kick\('\/__ads\/creator-content'/)
    expect(ads).toMatch(/app\.post\('\/__ads\/creator-content'/)
    expect(read('src/worker/scheduled.ts')).not.toMatch(/runCreatorContentCollect/)
  })
  it('유튜브는 부르기 전에 센다', () => {
    const claim = collect.indexOf('`${day}:${used + 1}`')
    expect(claim).toBeGreaterThan(0)
    expect(claim).toBeLessThan(collect.indexOf('googleapis.com/youtube/v3/search'))
  })
  it('사장님 API 는 소유권을 본다 · 수정은 store_key 로 좁힌다', () => {
    expect(routes).toMatch(/s\.seller_id != null && me === s\.seller_id \? s : null/)
    expect(routes.match(/AND store_key = \?/g)?.length).toBeGreaterThanOrEqual(3)
  })
  it('유어딜 사람은 숨기기만 — 삭제·수정 쿼리가 urdeal_ 행을 건드리지 않는다', () => {
    expect(routes.match(/platform NOT LIKE 'urdeal_%'/g)?.length).toBeGreaterThanOrEqual(4)
  })
  it('라우트가 붙어 있다', () => {
    const idx = read('src/worker/index.ts')
    expect(idx).toMatch(/app\.route\('\/api\/creator-content', creatorContentPublicRoutes\)/)
    expect(idx).toMatch(/app\.route\('\/api\/seller\/creator-content', creatorContentSellerRoutes\)/)
    expect(idx).toMatch(/https:\/\/www\.instagram\.com https:\/\/www\.tiktok\.com https:\/\/m\.blog\.naver\.com/)
  })
})

describe('⑥ 유어애즈가 몫을 비워 둔다', () => {
  it('성과 상한 계산에 유어딜 몫이 들어간다', () => {
    const lane = read('src/features/marketing/api/influencer-enrich-lane.ts')
    expect(lane).toMatch(/resolveYtPerfCap\(ytCalls\.ads \* YT_SEARCH_UNIT_COST \+ contentUnits/)
    expect(lane).toMatch(/readSettings\(DB, \['ads_yt_search_used', CONTENT_YT_USED_KEY\]\)/)
  })
})

describe('⑦ 손님 줄', () => {
  afterEach(() => vi.unstubAllGlobals())
  const buy = { store: '꾸꾸데쎄르', price: 9400, discountPct: 28, image: null }
  const stub = (data: unknown) => vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ success: true, data }) })))

  it('0개면 아무것도 안 그린다', async () => {
    stub({ items: [], pinners: [] })
    const { container } = render(<CreatorContentRow productId={1} buy={buy} onBuy={() => {}} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(container.innerHTML).toBe('')
  })
  it('유어딜 사람 배지 · 추천 띠 · 블로그 3개 뒤 모두 보기', async () => {
    const blogs = Array.from({ length: 5 }, (_, i) => item({ id: `c:${10 + i}`, kind: 'blog', platform: 'naver_blog', title: `글 ${i}` }))
    stub({ items: [item({ id: 's:1', urdeal: 'seeding', author_name: '@yeonje' }), item({ id: 'c:2' }), ...blogs],
      pinners: [{ user_id: 3, handle: 'jiwon', name: '연제 맛집러', avatar: null }] })
    const { findByTestId, getByText, queryByText } = render(<CreatorContentRow productId={1} buy={buy} onBuy={() => {}} />)
    await findByTestId('creator-content')
    expect(getByText('유어딜 체험단')).toBeTruthy()
    expect(getByText('유어딜 1명이 추천해요')).toBeTruthy()
    expect(queryByText('글 4')).toBeNull()
    fireEvent.click(getByText('블로그 후기 5개 모두 보기'))
    await waitFor(() => expect(getByText('글 4')).toBeTruthy())
  })
})
