import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { pickMatchingPlace, extractBusinessPhotoUrls, isBusinessPhotoUrl } from '@/worker/utils/naver-place-photo'
import { isSearchDerivedPhoto, DEMO_MIN_PHOTOS } from '@/worker/utils/demo-photo-set'
import { retryAt } from '@/worker/cron/demo-image-rehost'

/**
 * 🖼️ 데모 이용권 사진 = **지도에 업체가 등록한 사진뿐** + 최소 3장을 영구적으로 다시 채운다 (2026-10-25).
 *
 * 대표: *"데모들의 사진들을 보면 그냥 매장과 연관된 블로그에서 사진 발췌해서 의미없는 것도 올려와져있고"*
 *       *"데모 이용권들 사진 최소 3장 이상씩 올려라고 했는데 그게 전혀 영구적으로 지켜지지 않아"*
 *       → *"업체 사진을 데모에 쓰는것 승인할게. 3장 미만인 데모를 숨기진 않겠어."*
 *
 * 원인 셋: ① 지도에서 1~2장만 받고 나머지를 네이버 이미지검색으로 채웠다(블로그 호스트에 가산점,
 *   이름이 하나도 안 맞는 0점도 통과) ② 네이버 플레이스가 이름이 안 맞으면 검색 첫 결과(다른 가게)를 썼다
 *   ③ "3장" 이 어디에도 강제되지 않았다 — 1장만 구해져도 버전 마킹으로 끝났다.
 *
 * ⚠️ 이 시험이 못 보는 것: 네이버가 업체 사진을 실제로 `ldb-phinf` 에 두는지(가정 — 라이브에서 판정,
 *   이 환경은 네이버 지도가 막혀 있다) · 비공식 경로가 막혔는지 · 라이브의 3장 미만 개수(하트비트 photoShort).
 */

const photoSet = readCode('src/worker/utils/demo-photo-set.ts')
const cron = readCode('src/worker/cron/demo-image-rehost.ts')

describe('① 사진 출처는 지도 등록 사진뿐', () => {
  it('데모 사진 조립이 이미지검색을 부르지 않는다', () => {
    expect(photoSet).not.toMatch(/fetchNaverImageUrls/)
    expect(photoSet).not.toMatch(/naver-image-search/)
  })
  it('업체 사진 여러 장 경로가 배선돼 있다', () => {
    expect(photoSet).toMatch(/fetchNaverPlaceBusinessPhotos\(opts\.nameQuery/)
  })
  it('최소 장수는 3', () => {
    expect(DEMO_MIN_PHOTOS).toBe(3)
  })
})

describe('② 가게는 이름이 맞을 때만 그 가게다', () => {
  const list = [
    { id: '1', name: '옆집 국밥' },
    { id: '2', name: '' },
    { id: '3', name: '<b>달빛한스푼</b> 강남점' },
  ]
  it('이름이 맞는 항목을 고른다(태그·공백 무시)', () => {
    expect(pickMatchingPlace(list, '달빛한스푼')?.id).toBe('3')
  })
  it('맞는 가게가 없으면 첫 결과로 떨어지지 않는다', () => {
    expect(pickMatchingPlace(list, '홍대돈까스')).toBeNull()
  })
  it('빈 이름 항목이 아무 가게나 통과시키지 않는다', () => {
    expect(pickMatchingPlace([{ id: '9', name: '' }], '아무가게')).toBeNull()
  })
})

describe('③ 업체 사진만 뽑는다', () => {
  const html = [
    '{"origin":"https:\\u002F\\u002Fldb-phinf.pstatic.net\\u002F20240101_1\\u002Fa.jpg"}',
    '"https://ldb-phinf.pstatic.net/20240101_1/a.jpg?type=w750"',
    '"https://ldb-phinf.pstatic.net/20240202_2/b.jpg"',
    '"https://pup-review-phinf.pstatic.net/x/review.jpg"',
    '"https://blogfiles.pstatic.net/y/blog.jpg"',
  ].join(' ')
  it('리뷰·블로그 사진은 빼고, 크기 변형은 한 장으로 센다', () => {
    const out = extractBusinessPhotoUrls(html)
    expect(out).toHaveLength(2)
    expect(out.every((u) => u.startsWith('https://ldb-phinf.pstatic.net/'))).toBe(true)
  })
  it('대표 썸네일도 업체 사진 판정을 지난다(리뷰·블로그 썸네일 거름)', () => {
    expect(isBusinessPhotoUrl('https://ldb-phinf.pstatic.net/a.jpg')).toBe(true)
    expect(isBusinessPhotoUrl('https://pup-review-phinf.pstatic.net/a.jpg')).toBe(false)
    expect(isBusinessPhotoUrl('https://blogfiles.pstatic.net/a.jpg')).toBe(false)
    expect(isBusinessPhotoUrl(null)).toBe(false)
  })
  it('검색·블로그 출처 판정', () => {
    expect(isSearchDerivedPhoto('https://search.pstatic.net/common/?src=https%3A%2F%2Fblogfiles.pstatic.net%2Fa.jpg')).toBe(true)
    expect(isSearchDerivedPhoto('https://postfiles.pstatic.net/a.jpg')).toBe(true)
    expect(isSearchDerivedPhoto('https://ldb-phinf.pstatic.net/a.jpg')).toBe(false)
    expect(isSearchDerivedPhoto('https://t1.daumcdn.net/place/a.jpg')).toBe(false)
  })
})

describe('④ 3장은 숨기지 않고 영구적으로 다시 채운다', () => {
  it('3장 미만이면 재시도를 예약하고, 채워지면 예약을 지운다', () => {
    expect(cron).toMatch(/demo_photo_retry_after: gallery\.length < DEMO_MIN_PHOTOS \? retryAt\(\) : ''/)
  })
  it('재시도가 도래한 행은 큐로 돌아온다', () => {
    expect(cron).toMatch(/key = 'demo_photo_retry_after'[\s\S]{0,120}value <= datetime\('now'\)/)
  })
  it('시도 소진도 영구 포기가 아니라 재시도 예약이다', () => {
    const giveUp = cron.match(/tries >= MAX_TRIES\) \{[\s\S]{0,1400}?continue\s*\}/)?.[0] ?? ''
    expect(giveUp).toMatch(/demo_photo_retry_after: retryAt\(\)/)
  })
  it('3장 미만을 이유로 숨기지 않는다(대표 확정) — 숨김은 사진이 0장일 때뿐', () => {
    expect(cron).not.toMatch(/DEMO_MIN_PHOTOS[\s\S]{0,200}is_active = 0/)
  })
  it('재시도 시각은 D1 datetime 과 같은 모양이라 문자열 비교가 된다', () => {
    expect(retryAt(Date.UTC(2026, 9, 25, 0, 0, 0), 3)).toBe('2026-10-28 00:00:00')
  })
  it('3장 미만 개수를 매 회차 하트비트에 남긴다', () => {
    expect(cron).toMatch(/result\.photoShort = await countDemoPhotoShort\(env\)/)
  })
})
