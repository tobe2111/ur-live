/**
 * 🏪 2026-10-26 (대표 "업체가 올린 사진이 가장 좋잖아" · "이용권마다 최소 3장") — 데모 사진 출처.
 *   라이브 수집이 0장이던 원인: 카카오 og:image 403 · 네이버 allSearch 빈 응답(진단 2484).
 *   카카오 사진 탭 JSON 은 200 이고 분류 태그가 있다 — 업체 사진(MYSTORE·VENDOR)만 받는다.
 *
 * 이 시험이 못 보는 것: 비공식 API 가 실제로 응답하는지(라이브 하트비트 photoShort 로만 판정) ·
 *   네이버 업체사진 탭이 Cloudflare 에서 열리는지.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchKakaoPlacePhotos } from '@/worker/utils/kakao-place-photos'
import { readCode } from '../helpers/source-text'

const photoSet = readCode('src/worker/utils/demo-photo-set.ts')

function mockKakao(byTag: Record<string, unknown>) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(url)
    const h = (init?.headers || {}) as Record<string, string>
    if (h.pf !== 'web' || !h.Origin || !h.Referer) return new Response('', { status: 406 })
    const tag = new URL(url).searchParams.get('tag') || ''
    return new Response(JSON.stringify(byTag[tag] ?? { photos: [] }), { status: 200 })
  }))
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('① 카카오는 업체 사진만', () => {
  it('MYSTORE 사진만 받고, 섞여 온 손님·블로그 사진은 버린다', async () => {
    mockKakao({
      MYSTORE: {
        counts: { mystore: 2, vendor: 0 },
        photos: [
          { type: 'MYSTORE', media_type: 'PHOTO', url: 'http://t1.kakaocdn.net/mystore/A' },
          { type: 'KMAPREVIEW', media_type: 'PHOTO', url: 'https://t1.kakaocdn.net/review/X' },
          { type: 'BLOG', media_type: 'PHOTO', url: 'https://postfiles.pstatic.net/blog.jpg' },
          { type: 'MYSTORE', media_type: 'VOD', url: 'https://t1.kakaocdn.net/mystore/vod' },
          { type: 'MYSTORE', media_type: 'PHOTO', url: 'http://t1.kakaocdn.net/mystore/B' },
        ],
      },
    })
    const out = await fetchKakaoPlacePhotos('1511061745', 5)
    expect(out).toEqual(['https://t1.kakaocdn.net/mystore/A', 'https://t1.kakaocdn.net/mystore/B'])
  })

  it('제휴사 사진은 응답이 있다고 말할 때만 한 번 더 부른다', async () => {
    const calls = mockKakao({
      MYSTORE: { counts: { mystore: 1, vendor: 2 }, photos: [{ type: 'MYSTORE', url: 'https://t1.kakaocdn.net/m/1' }] },
      VENDOR: { photos: [{ type: 'VENDOR', url: 'https://t1.kakaocdn.net/v/1' }, { type: 'VENDOR', url: 'https://t1.kakaocdn.net/v/2' }] },
    })
    expect(await fetchKakaoPlacePhotos('1511061745', 3)).toHaveLength(3)
    expect(calls).toHaveLength(2)
  })

  it('제휴사 사진이 없으면 서브리퀘스트를 더 쓰지 않는다', async () => {
    const calls = mockKakao({ MYSTORE: { counts: { mystore: 0, vendor: 0 }, photos: [] } })
    expect(await fetchKakaoPlacePhotos('1511061745', 3)).toEqual([])
    expect(calls).toHaveLength(1)
  })

  it('손님 사진 태그(FOOD·MENU·INDOOR·OUTDOOR)를 요청하지 않는다', async () => {
    const calls = mockKakao({ MYSTORE: { counts: { vendor: 1 }, photos: [] }, VENDOR: { photos: [] } })
    await fetchKakaoPlacePhotos('1511061745', 3)
    for (const u of calls) expect(new URL(u).searchParams.get('tag')).toMatch(/^(MYSTORE|VENDOR)$/)
  })
})

describe('② 순서 — 네이버 업체사진 먼저, 카카오가 보충', () => {
  it('네이버 업체사진 호출이 카카오보다 앞에 있다', () => {
    const n = photoSet.indexOf('fetchNaverPlaceBusinessPhotos(opts.nameQuery')
    const k = photoSet.indexOf('fetchKakaoPlacePhotos(opts.placeId')
    expect(n).toBeGreaterThan(0)
    expect(k).toBeGreaterThan(n)
  })
  it('대표사진(손님 사진일 수 있다) 폴백을 부르지 않는다', () => {
    expect(photoSet).not.toMatch(/fetchNaverPlaceMainPhoto\(/)
  })
})

describe('③ 사진이 없어 내려간 데모도 다시 시도한다', () => {
  const cron = readCode('src/worker/cron/demo-image-rehost.ts')
  const start = cron.indexOf("WHERE p.slug LIKE 'demo-%'")
  const sel = cron.slice(start, cron.indexOf('LIMIT ?', start))
  it('선택 쿼리가 숨김 표식 행을 포함한다(안 그러면 자동 복귀가 영영 안 돈다)', () => {
    expect(sel.length).toBeGreaterThan(100)
    expect(sel).toMatch(/is_active, 1\) = 1 OR EXISTS[\s\S]*demo_hidden_no_photo/)
  })
  it('표식 없는 비노출 행(사람이 내린 것)까지 넓히지 않는다', () => {
    expect(sel).not.toMatch(/is_active, 1\) IN \(0, ?1\)/)
    expect(sel).toMatch(/is_active, 1\) = 1/)
  })
})

describe('④ 네이버는 업체사진 탭만 — 홈 화면을 통째로 긁지 않는다', () => {
  const naver = readCode('src/worker/utils/naver-place-photo.ts')
  const fn = naver.slice(naver.indexOf('export async function fetchNaverPlaceBusinessPhotos'), naver.indexOf('async function fetchNaverPlacePageOg'))
  it('업체사진 탭 경로가 있고 홈 경로가 없다', () => {
    expect(fn).toMatch(/photo\?filterType=/)
    expect(fn).not.toMatch(/\/home`/)
  })
})
