/**
 * 🧾 모바일 홈 = 이용권 한 줄에 하나(Y2) — 2026-10-31 대표 확정 *"y2대로 해줘 모두"* (시안 FeedY2Full·States·Spec·Dark).
 *
 * 지키는 것:
 *   ① 모바일 편성 섹션·아래 피드·빈 결과 대체 목록이 **전부** 한 줄 카드다(한 곳만 격자로 남으면 같은 화면에서 모양이 갈린다).
 *   ② PC 는 종전 격자 그대로(`pc`·`rail` 이면 grid).
 *   ③ 줄 높이가 고정 — 사진 120 · 본문 120. 메뉴는 별점이 있으면 한 줄, 없으면 두 줄(그래야 120 에 들어간다).
 *   ④ 맨 윗줄 규칙(`homeRowMeta`) · 구매 수(`homeRowSold`) — 0명을 적지 않는다, 거리 모르면 지역.
 *
 * ⚠️ 못 보는 것: 실제 사진이 120 칸에서 보기 좋은지 · 긴 가게 이름이 잘리는 모양(그려서 본다 — visual-preview).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { HOME_ROW_CLS, homeRowMeta, homeRowSold, homeRowCategoryLabel, homeRowRegion } from '@/shared/home-row'

const sections = readCode('src/components/home/HomeSections.tsx')
const feed = readCode('src/pages/main-home/GroupBuyFeed.tsx')
const card = readCode('src/pages/main-home/GroupBuyFeedCard.tsx')

describe('① 모바일은 전부 한 줄 카드', () => {
  it('편성 섹션: rail(PC) 이 아니면 row', () => {
    expect(sections).toMatch(/layout=\{rail \? 'grid' : 'row'\}/)
  })
  it('피드 본문·빈 결과 대체 목록: pc 가 아니면 row (두 자리)', () => {
    expect(feed.match(/layout=\{pc \? 'grid' : 'row'\}/g)?.length).toBe(2)
  })
  it('피드 로딩 자리도 한 줄 자리', () => {
    expect(feed).toMatch(/: <DealRowPlaceholder key=\{i\} \/>/)
  })
})

describe('③ 줄 높이 고정', () => {
  it('사진 120 · 본문 120 고정 · 넘치면 자른다', () => {
    expect(HOME_ROW_CLS.thumb).toMatch(/\bw-\[120px\]/)
    expect(HOME_ROW_CLS.body).toMatch(/\bh-\[120px\]/)
    expect(HOME_ROW_CLS.body).toMatch(/\boverflow-hidden\b/)
  })
  it('메뉴 줄 수는 별점 유무로 정한다(화면과 워커가 같은 식)', () => {
    expect(card).toMatch(/rating > 0 \? HOME_ROW_CLS\.menu1 : HOME_ROW_CLS\.menu2/)
    expect(readCode('src/worker/utils/home-first-screen.ts')).toMatch(/rating > 0 \? C\.menu1 : C\.menu2/)
  })
})

describe('④ 윗줄·구매 수', () => {
  it('거리를 알면 km, 모르면 지역', () => {
    expect(homeRowMeta('meal_voucher', '0.8', '서울 마포구 연남로 1')).toBe('식사 · 0.8km')
    expect(homeRowMeta('meal_voucher', null, '서울특별시 마포구 연남로 1')).toBe('식사 · 서울 마포구')
    expect(homeRowMeta('stay_voucher', null, '')).toBe('숙소')
  })
  it('종류 이름은 홈 탭과 같은 낱말(미용)', () => {
    expect(homeRowCategoryLabel('beauty_voucher')).toBe('미용')
    expect(homeRowCategoryLabel('nope')).toBe('이용권')
  })
  it('지역은 앞 두 마디, 행정 접미사는 뗀다', () => {
    expect(homeRowRegion('제주특별자치도 제주시 애월읍')).toBe('제주 제주시')
  })
  it('구매 수 — 0명은 빈 값', () => {
    expect(homeRowSold(0)).toBe('')
    expect(homeRowSold(null)).toBe('')
    expect(homeRowSold(251)).toBe('251명 구매')
    expect(homeRowSold(1500)).toBe('1.5천명 구매')
    expect(homeRowSold(12340)).toBe('1.2만명 구매')
  })
})
