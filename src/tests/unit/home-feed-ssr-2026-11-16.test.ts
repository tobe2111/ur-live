/**
 * 🏠 2026-11-16 대표 *"해줘. 계속 개선해줘"* — 폰 홈 서버 첫 화면이 유어쇼츠 줄 + 전체 목록 첫 6장까지 그린다.
 *   라이브 끼워 재기(폰 4G·CPU 4배 3+3회): 목록 생김 1.9~3.8s → 0.9~1.5s · 목록 사진 3장 3.0~5.7s → 2.5~2.9s · CLS 그대로.
 *   라이브 대조: 서버 첫 6장 id · "딜 42개" · "12편" 이 앱 렌더와 **전부 같았다**.
 *   고정하는 것: ① 순서 규칙(판매 수 내림차순 · 섹션 상품 뒤로 · 메인 노출만 · 중복 제거) ② 그리지 않는 조건 넷
 *   ③ 클래스가 화면 소스와 글자 그대로 ④ 장수가 화면 첫 렌더 수와 같다 ⑤ 워커 배선.
 *   못 보는 것: 픽셀(배포 뒤 라이브) · 위치가 폰 저장소에만 남은 손님(쿠키 만료 — 글자만 바뀐다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildHomeFirstScreen, cardHtml } from '@/worker/utils/home-first-screen'
import { homeFeedOrder, homeFeedFirstScreen, homeShortsPanelHtml, HOME_FEED_FS_CARDS, HOME_FEED_FS_CLASS } from '@/worker/utils/home-feed-first-screen'

const prod = (id: number, sold = 0, o: Record<string, unknown> = {}) => ({ id, name: `딜${id}`, price: 9000, image_url: `https://media.ur-team.com/uploads/demo/${id}.jpg`, category: 'meal_voucher', restaurant_address: '서울 강남구 1', sold_count: sold, ...o })
const SECTIONS = JSON.stringify({ success: true, data: [
  { id: 1, title: '첫 섹션', products: [prod(1), prod(2), prod(3), prod(4)] },
  { id: 2, title: '지금 인기 이용권', subtitle: '많이 팔린 순', more_href: '/?sort=popular', products: [prod(5), prod(6)] },
] })
const MAIN = JSON.stringify({ success: true, data: [prod(10, 3), prod(5, 50), prod(11, 9), prod(12, 9), prod(13, 1), prod(14, 0), prod(15, 7), prod(11, 9), prod(16, 2, { category: 'home_voucher' })] })
const SHORTS = JSON.stringify({ success: true, data: [{ id: 1, video_id: 'a', title: 't', duration_sec: 31, store_name: '가게', product_name: '상품', price: 9000 }] })
const BANNERS = JSON.stringify({ success: true, data: [{ id: 1, title: 'b', image_url: 'https://media.ur-team.com/b.jpg', banner_slot: 'strip' }] })
const base = { visibleSectionCount: 2, sectionIds: new Set([1, 2, 3, 4, 5, 6]), mainSeedJson: MAIN, shortsSeedJson: SHORTS, bannersPayload: BANNERS, cookieHeader: null, cardHtml: cardHtml as never }

describe('① 순서 — GroupBuyFeed 홈 기본(인기순 · 위치 없음)과 같은 규칙', () => {
  it('판매 수 내림차순(같은 수는 시드 순서) → 섹션 상품은 뒤로 → 생활 이용권 제외 → id 중복 제거', () => {
    const ids = homeFeedOrder<{ id: number }>(MAIN, base.sectionIds)!.map((p) => p.id)
    expect(ids).toEqual([11, 12, 15, 10, 13, 14, 5])
  })
  it('목록 첫 6장 · "딜 N개" 는 전체 수 · 정렬 알약은 인기순', () => {
    const out = homeFeedFirstScreen(base)!
    expect((out.feed.match(/href="\/pass\//g) || []).length).toBe(HOME_FEED_FS_CARDS)
    expect(out.feed).toContain('<span>딜 7개</span>')
    expect(out.feed).toContain('인기순')
    expect(out.feed).not.toContain('loading="eager"')
  })
})

describe('② 그리지 않는다 — 화면과 같은 결과를 못 낼 때', () => {
  it('위치 쿠키가 있으면(목록이 거리순)', () => {
    expect(homeFeedFirstScreen({ ...base, cookieHeader: 'ur_loc=37.50,127.04' })).toBeNull()
  })
  it('섹션이 둘이 아니면(셋째는 유어쇼츠 뒤에 온다) · 유어쇼츠 시드가 없으면 · wide 배너가 있으면 · 배너 시드가 없으면', () => {
    expect(homeFeedFirstScreen({ ...base, visibleSectionCount: 3 })).toBeNull()
    expect(homeFeedFirstScreen({ ...base, shortsSeedJson: null })).toBeNull()
    expect(homeFeedFirstScreen({ ...base, bannersPayload: JSON.stringify({ success: true, data: [{ id: 2, title: 'w', banner_slot: 'wide' }] }) })).toBeNull()
    expect(homeFeedFirstScreen({ ...base, bannersPayload: null })).toBeNull()
  })
  it('유어쇼츠 0편이면 줄은 빈 문자열(화면도 높이 0)이고 목록은 그린다', () => {
    expect(homeShortsPanelHtml(JSON.stringify({ success: true, data: [] }))).toBe('')
    expect(homeFeedFirstScreen({ ...base, shortsSeedJson: JSON.stringify({ success: true, data: [] }) })!.feed).toContain('딜 7개')
  })
  it('buildHomeFirstScreen: 다섯·여섯·일곱째 인자가 있을 때만 · 위치 쿠키면 둘째 섹션까지만', () => {
    const full = buildHomeFirstScreen(SECTIONS, '', '', null, BANNERS, SHORTS, MAIN)
    expect(full).toContain('ur-cv-feedrow')
    expect(full).toContain('>유어쇼츠<')
    expect(buildHomeFirstScreen(SECTIONS, '', '', 'ur_loc=37.50,127.04', BANNERS, SHORTS, MAIN)).not.toContain('ur-cv-feedrow')
    expect(buildHomeFirstScreen(SECTIONS, '', '', null, BANNERS)).not.toContain('ur-cv-feedrow')
  })
})

describe('③④⑤ 화면 소스와 대조 · 배선', () => {
  const rail = readFileSync('src/components/home/UrShortsRail.tsx', 'utf8')
  const feed = readFileSync('src/pages/main-home/GroupBuyFeed.tsx', 'utf8')
  const sortMenu = readFileSync('src/components/ui/sort-menu.tsx', 'utf8')
  const page = readFileSync('src/pages/mobile-home/MobileHomePage.tsx', 'utf8')
  it('유어쇼츠 줄 클래스', () => {
    for (const k of ['shortsPanel', 'shortsHead', 'shortsTitle', 'shortsTitleSub', 'shortsRail', 'shortsCard', 'shortsMedia', 'shortsPlay', 'shortsDur', 'shortsScrim', 'shortsStore', 'shortsProduct', 'shortsOriginal', 'shortsPrice', 'shortsMore', 'shortsMoreLabel', 'shortsMoreCount'] as const) expect(rail, k).toContain(HOME_FEED_FS_CLASS[k])
    expect(rail).toContain(`shrink-0 whitespace-nowrap text-[12px] font-medium text-white/75 underline-offset-4 hover:underline\${waiting ? ' invisible' : ''}`)
  })
  it('목록 머리·정렬 알약·칸 클래스 · 첫 렌더 장수 · 순서 함수', () => {
    expect(feed).toContain(HOME_FEED_FS_CLASS.feedHead)
    expect(sortMenu).toContain(HOME_FEED_FS_CLASS.sortBtn)
    expect(sortMenu).toContain(`className="${HOME_FEED_FS_CLASS.sortWrap}"`)
    expect(feed).toContain('`${DEAL_ROW.grid} px-4 pb-8`')
    expect(feed).toContain("`${gridCls} ur-cv-grid${pc ? '' : ' ur-cv-feedrow'}`")
    expect(feed).toContain(`useProgressiveCap(firstScreen ? 12 : ${HOME_FEED_FS_CARDS}, sorted.length)`)
    expect(feed).toContain('deferSeeded(sortBand(src), nearKey ? NO_DEFER : sectionIds)')
    expect(feed).toContain("{ key: 'popular',  label: '인기순',   Icon: Flame }")
    expect(page).toContain(`<section ref={feedRef} className="${HOME_FEED_FS_CLASS.feedSection}">`)
    expect(page).toContain(`className="${HOME_FEED_FS_CLASS.feedAnchor}"`)
  })
  it('워커가 유어쇼츠 시드·MAIN 시드를 넘긴다', () => {
    const w = readFileSync('src/worker/index.ts', 'utf8')
    expect(w).toContain('homeBannersPayload, homeShortsPayload, ssrPayload); if (homeFirst)')
    expect(w).toContain('homeShortsPayload = shortsSeed.payload')
  })
})
