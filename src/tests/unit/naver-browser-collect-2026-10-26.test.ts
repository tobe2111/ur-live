import { describe, it, expect, vi } from 'vitest'
import { readCode } from '../helpers/source-text'
import { pickNaverPlace, candidatesFromApollo, businessPhotoUrls, districtTokens } from '../../../scripts/naver-place-match.mjs'

/**
 * 🏪 2026-10-26 네이버 지도 업체사진 — 실제 브라우저(GitHub 러너)가 모은 주소를 워커가 1순위로 쓴다.
 *
 * 라이브 워커는 네이버 검색이 캡차로 막힌다(`ncaptcha-all-search-no-result` — 진단 2차 실측).
 * 러너의 실제 브라우저로는 가게 번호와 업체사진이 나왔다(진단 3차 — 스타벅스 강남역점 15장).
 *
 * ⚠️ 이 시험이 못 보는 것: 네이버가 러너도 막는지 · 실제 적중률(워크플로 COLLECT_RESULT 줄) ·
 *   __APOLLO_STATE__ 의 실제 키 이름(모양으로 줍는다 — 바뀌면 후보 0 → 아무 가게도 안 고른다).
 */

describe('① 그 가게만 고른다 — 이름 + 시·군·구', () => {
  const list = [
    { id: '11111111', name: '55와인포차 동탄점', address: '경기 화성시 동탄대로 1' },
    { id: '22222222', name: '55와인포차 산남점', address: '충북 청주시 서원구 산남로 5' },
  ]
  it('이름과 지역이 둘 다 맞는 지점을 고른다', () => {
    expect(pickNaverPlace(list, '55와인포차 산남점', '충북 청주시 서원구 구룡산로 218')?.id).toBe('22222222')
  })
  it('이름은 맞아도 지역이 다르면 고르지 않는다(체인점)', () => {
    expect(pickNaverPlace([list[0]], '55와인포차', '충북 청주시 서원구 구룡산로 218')).toBeNull()
  })
  it('주소를 아는데 후보에 주소가 없으면 고르지 않는다', () => {
    expect(pickNaverPlace([{ id: '33333333', name: '55와인포차' }], '55와인포차', '충북 청주시 서원구')).toBeNull()
  })
  it('이름이 안 맞으면 첫 결과로 떨어지지 않는다', () => {
    expect(pickNaverPlace(list, '달빛한스푼', '충북 청주시 서원구')).toBeNull()
  })
  it('시·군·구 낱말만 뽑는다', () => {
    expect(districtTokens('충북 청주시 서원구 구룡산로 218')).toEqual(['청주시', '서원구'])
  })
})

describe('② 검색 상태에서 후보를 모양으로 줍는다', () => {
  it('id·이름이 있는 항목만, 주소 필드 이름이 달라도', () => {
    const out = candidatesFromApollo({
      'PlaceSummary:22222222': { id: '22222222', name: '가게', roadAddress: '청주시 서원구' },
      'RestaurantListSummary:44444444': { id: 44444444, name: '식당', address: '청주시' },
      'ROOT_QUERY': { foo: 1 },
      'Image:1': { id: 'x', url: 'https://a' },
    })
    expect(out.map((c) => c.id).sort()).toEqual(['22222222', '44444444'])
    expect(out.find((c) => c.id === '22222222')?.address).toBe('청주시 서원구')
  })
  it('상태가 없으면 빈 목록', () => {
    expect(candidatesFromApollo(null)).toEqual([])
  })
})

describe('③ 업체 사진 주소만 — 리뷰·블로그 제외', () => {
  it('ldb-phinf 만, 중복 없이, 이스케이프 풀어서', () => {
    const html = [
      '"https:\\u002F\\u002Fldb-phinf.pstatic.net\\u002F2024_1\\u002Fa.jpg"',
      '"https://ldb-phinf.pstatic.net/2024_1/a.jpg"',
      '"https://ldb-phinf.pstatic.net/2024_2/b.jpg?type=w750"',
      '"https://pup-review-phinf.pstatic.net/r.jpg"',
      '"https://search.pstatic.net/common/?src=x"',
    ].join(' ')
    const out = businessPhotoUrls(html)
    expect(out).toEqual(['https://ldb-phinf.pstatic.net/2024_1/a.jpg', 'https://ldb-phinf.pstatic.net/2024_2/b.jpg'])
  })
})

describe('④ 워커가 브라우저 수집분을 1순위로 쓴다', () => {
  it('naverBizPhotos 가 먼저 들어가고, 업체 사진 판정을 다시 지난다', async () => {
    vi.resetModules()
    vi.doMock('@/worker/utils/naver-place-photo', async (orig) => ({
      ...(await orig<typeof import('@/worker/utils/naver-place-photo')>()),
      fetchNaverPlaceBusinessPhotos: vi.fn(async () => []),
    }))
    vi.doMock('@/worker/utils/kakao-place-photos', async (orig) => ({
      ...(await orig<typeof import('@/worker/utils/kakao-place-photos')>()),
      fetchKakaoPlacePhotos: vi.fn(async () => ['https://t1.daumcdn.net/k.jpg']),
    }))
    const { fetchDemoPhotos } = await import('@/worker/utils/demo-photo-set')
    const out = await fetchDemoPhotos({} as never, {
      nameQuery: '가게', placeId: '123', count: 3,
      naverBizPhotos: ['https://ldb-phinf.pstatic.net/a.jpg', 'https://blogfiles.pstatic.net/b.jpg', 'https://ldb-phinf.pstatic.net/c.jpg'],
    })
    expect(out).toEqual(['https://ldb-phinf.pstatic.net/a.jpg', 'https://ldb-phinf.pstatic.net/c.jpg', 'https://t1.daumcdn.net/k.jpg'])
    vi.doUnmock('@/worker/utils/naver-place-photo')
    vi.doUnmock('@/worker/utils/kakao-place-photos')
  })
  it('정비·복구 두 호출 모두 메타의 수집분을 넘긴다', () => {
    const cron = readCode('src/worker/cron/demo-image-rehost.ts')
    expect(cron.match(/naverBizPhotos: parseJsonArr\(meta\.naver_biz_photos \|\| null\)/g)?.length).toBe(2)
  })
  it('수집기는 상품 행을 직접 고치지 않는다(메타만 쓴다)', () => {
    const src = readCode('scripts/naver-photo-collect.mjs')
    expect(src).not.toMatch(/UPDATE\s+products/i)
    expect(src).not.toMatch(/INSERT\s+INTO\s+products/i)
  })
})
