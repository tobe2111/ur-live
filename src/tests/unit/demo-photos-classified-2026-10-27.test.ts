/**
 * 🏷️ 2026-10-27 (대표 확정 "업체사진→분류사진") — 데모 사진이 업종과 무관하던 것(미용실에 강아지 등).
 *   업체 사진(MYSTORE·VENDOR)이 있는 매장은 데모 40곳 중 6곳뿐이라(라이브 실측) 업체 사진만으로는
 *   재수집이 0장이었다(photoShort 309). 카카오가 그 장소 사진을 장면으로 분류해 둔 태그만 보충한다:
 *   식사 = 음식 → 내부 → 외부, 그 밖 = 내부 → 외부. 분류 없는 사진·메뉴판(MENU)은 받지 않는다.
 *
 * 이 시험이 못 보는 것: 카카오 분류가 실제로 맞는지(카카오의 판정) · 비공식 API 가 응답하는지
 *   (라이브 하트비트 photoShort 로만 판정).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchKakaoPlacePhotos, classifiedTagsFor, fetchKakaoUsablePhotoCount } from '@/worker/utils/kakao-place-photos'
import { readCode } from '../helpers/source-text'

function mockKakao(byTag: Record<string, unknown>) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url)
    const tag = new URL(url).searchParams.get('tag') || ''
    return new Response(JSON.stringify(byTag[tag] ?? { photos: [] }), { status: 200 })
  }))
  return calls
}
const tagsOf = (calls: string[]) => calls.map((u) => new URL(u).searchParams.get('tag'))
afterEach(() => vi.unstubAllGlobals())

describe('① 종류별 분류 태그', () => {
  it('식사는 음식이 먼저(커버), 그 밖은 가게 안·밖만', () => {
    expect(classifiedTagsFor('meal_voucher')).toEqual(['FOOD', 'INDOOR', 'OUTDOOR'])
    for (const c of ['beauty_voucher', 'etc_voucher', 'stay_voucher', 'home_voucher', null, undefined]) {
      expect(classifiedTagsFor(c)).toEqual(['INDOOR', 'OUTDOOR'])
    }
  })
})

describe('② 업체 사진 먼저, 모자라면 분류 사진', () => {
  it('업체 사진이 없으면 분류 사진으로 채우고, 분류 응답의 손님·블로그 type 도 받는다', async () => {
    const calls = mockKakao({
      MYSTORE: { counts: { mystore: 0, vendor: 0, food: 2, indoor: 1, outdoor: 0 }, photos: [] },
      FOOD: { photos: [
        { type: 'KMAPREVIEW', media_type: 'PHOTO', url: 'http://t1.kakaocdn.net/review/f1' },
        { type: 'KMAPREVIEW', media_type: 'VOD', url: 'http://t1.kakaocdn.net/review/v' },
        { type: 'BLOG', media_type: 'PHOTO', url: 'https://postfiles.pstatic.net/f2.jpg' },
      ] },
      INDOOR: { photos: [{ type: 'BLOG', media_type: 'PHOTO', url: 'https://postfiles.pstatic.net/i1.jpg' }] },
    })
    const out = await fetchKakaoPlacePhotos('1276757068', 5, classifiedTagsFor('meal_voucher'))
    expect(out).toEqual(['https://t1.kakaocdn.net/review/f1', 'https://postfiles.pstatic.net/f2.jpg', 'https://postfiles.pstatic.net/i1.jpg'])
    // 개수가 0 인 태그(OUTDOOR)는 부르지 않는다 — 서브리퀘스트 예산.
    expect(tagsOf(calls)).toEqual(['MYSTORE', 'FOOD', 'INDOOR'])
  })

  it('업체 사진으로 다 차면 분류 사진을 부르지 않는다', async () => {
    const calls = mockKakao({
      MYSTORE: { counts: { mystore: 3, food: 9, indoor: 9 }, photos: [1, 2, 3].map((i) => ({ type: 'MYSTORE', url: `https://t1.kakaocdn.net/m/${i}` })) },
    })
    expect(await fetchKakaoPlacePhotos('1276757068', 3, ['FOOD', 'INDOOR'])).toHaveLength(3)
    expect(tagsOf(calls)).toEqual(['MYSTORE'])
  })

  it('미용·기타는 음식(FOOD)을 요청하지 않는다', async () => {
    const calls = mockKakao({ MYSTORE: { counts: { food: 50, indoor: 5, outdoor: 5 }, photos: [] } })
    await fetchKakaoPlacePhotos('1276757068', 5, classifiedTagsFor('beauty_voucher'))
    expect(tagsOf(calls)).not.toContain('FOOD')
    expect(tagsOf(calls)).toContain('INDOOR')
  })

  it('첫 응답 실패(counts 모름)면 분류 태그를 부르지 않는다', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { calls.push(url); return new Response('', { status: 403 }) }))
    expect(await fetchKakaoPlacePhotos('1276757068', 5, ['FOOD', 'INDOOR', 'OUTDOOR'])).toEqual([])
    expect(calls).toHaveLength(1)
  })

  it('메뉴판(MENU)·분류 없는 태그는 어떤 경우에도 요청하지 않는다', async () => {
    const calls = mockKakao({ MYSTORE: { counts: { vendor: 1, food: 1, indoor: 1, outdoor: 1 }, photos: [] } })
    await fetchKakaoPlacePhotos('1276757068', 8, classifiedTagsFor('meal_voucher'))
    for (const t of tagsOf(calls)) expect(t).toMatch(/^(MYSTORE|VENDOR|FOOD|INDOOR|OUTDOOR)$/)
  })
})

describe('③ 배선 — 호출부가 상품 종류를 넘긴다', () => {
  it('fetchDemoPhotos 가 종류로 분류 태그를 골라 카카오에 넘긴다', () => {
    const set = readCode('src/worker/utils/demo-photo-set.ts')
    expect(set).toMatch(/fetchKakaoPlacePhotos\(opts\.placeId, want, classifiedTagsFor\(opts\.category\)\)/)
  })
  it('어드민 발행·재조정이 category 를 넘긴다', () => {
    const admin = readCode('src/features/admin/api/admin-products.routes.ts')
    expect(admin).toMatch(/category: w\.t\.cat/)
    const cron = readCode('src/worker/cron/demo-image-rehost.ts')
    expect(cron).toMatch(/SELECT p\.id, p\.slug,[^`]*p\.category,/)
    expect(cron).toMatch(/category: row\.category/)
  })
  it('재조정 버전을 올려 기존 데모 전체에 다시 적용한다', () => {
    const cron = readCode('src/worker/cron/demo-image-rehost.ts')
    const v = Number((cron.match(/DEMO_COND_V = '(\d+)'/) || [])[1])
    expect(v).toBeGreaterThanOrEqual(8)
  })
})

describe('④ 발행 때 사진 3장 보장 (대표 2026-10-27 "3번")', () => {
  it('동네딜 데모 발행은 사진이 DEMO_MIN_PHOTOS 장 미만인 매장을 건너뛴다', () => {
    const admin = readCode('src/features/admin/api/admin-products.routes.ts')
    expect(admin).toMatch(/if \(resolvedImgSets\[i\]\.length < DEMO_MIN_PHOTOS\) \{ skippedNoPhoto\+\+; continue; \}/)
    // 건너뛸 매장은 커버 재호스팅(R2 쓰기·서브리퀘스트)도 안 한다.
    expect(admin).toMatch(/arr\.length >= DEMO_MIN_PHOTOS\s*\? rehostImageToR2/)
  })
  it('숙소 데모 발행도 같은 기준', () => {
    const stays = readCode('src/features/admin/api/admin-stays.routes.ts')
    expect(stays).toMatch(/if \(imgs\.length < DEMO_MIN_PHOTOS\) \{ skippedNoPhoto\+\+; continue \}/)
  })
})

describe('⑤ 3장이 안 되는 매장은 다른 실제 매장으로 교체 (대표 2026-10-27 "그 방식으로 진행")', () => {
  it('쓸 수 있는 사진 수 = 업체 + 그 종류의 분류 태그(식사만 음식 포함)', async () => {
    mockKakao({ MYSTORE: { counts: { mystore: 1, vendor: 0, food: 5, indoor: 1, outdoor: 0 }, photos: [] } })
    expect(await fetchKakaoUsablePhotoCount('1276757068', 'meal_voucher')).toBe(7)
    expect(await fetchKakaoUsablePhotoCount('1276757068', 'beauty_voucher')).toBe(2)
  })
  it('응답을 못 받으면 0 이 아니라 null(모른다) — 카카오가 막힌 날 멀쩡한 데모를 바꾸지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })))
    expect(await fetchKakaoUsablePhotoCount('1276757068', 'meal_voucher')).toBeNull()
  })

  const cron = readCode('src/worker/cron/demo-image-rehost.ts')
  const swap = readCode('src/worker/cron/demo-store-swap.ts')
  it('재조정: 확인된 개수가 3 미만일 때만 교체한다(null 이면 종전 경로)', () => {
    expect(cron).toMatch(/if \(usable != null && usable < DEMO_MIN_PHOTOS\)/)
    expect(cron).toMatch(/out\.swapped < SWAP_PER_RUN/)
    expect(cron).toMatch(/const SWAP_PER_RUN = 1\b/)
  })
  it('재조정: 교체 못 하면 3장 미만 데모를 매대에서 내린다(가역 is_active=0)', () => {
    const blk = cron.slice(cron.indexOf('if (usable != null'), cron.indexOf('if (imgs.length === 0)'))
    expect(blk).toMatch(/UPDATE products SET is_active = 0/)
    expect(blk).toMatch(/demo_hidden_no_photo: '1'/)
  })
  it('교체 후보: 사진 3장 이상 · 다른 데모가 안 쓰는 매장 · 지금 매장 아님', () => {
    expect(swap).toMatch(/if \(imgs\.length < DEMO_MIN_PHOTOS\) continue/)
    expect(swap).toMatch(/slug LIKE 'demo-deal-%' AND restaurant_name = \? AND restaurant_address = \?/)
    expect(swap).toMatch(/place\.placeId === curId\) continue/)
  })
  it('교체 후 옛 가게 이름의 리뷰를 걷고 새 매장으로 다시 만든다', () => {
    expect(swap).toMatch(/DELETE FROM product_reviews WHERE product_id = \?/)
    expect(swap).toMatch(/storeName: place\.name/)
  })
})
