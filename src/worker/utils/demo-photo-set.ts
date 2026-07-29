/**
 * 🖼️ 2026-07-20 (대표 "카카오 플레이스 사진도 함께 — 가장 이상적으로"): 데모 시드용 실사진 세트 확보.
 *   동네딜·숙소 시드 공용 — 관련도 순으로 3~5장을 모은다.
 *
 * 이상적 우선순위(대표사진 = 커버 out[0] 이 되도록):
 *   ① 카카오 플레이스 대표사진(fetchKakaoPlacePhotos = og:image) — 그 매장이 카카오맵에 건 대표사진.
 *   ② (카카오에 사진 없을 때만) 네이버 지도(플레이스) 대표사진(fetchNaverPlaceMainPhoto) — 그 매장이
 *      네이버 지도에 건 대표사진(대표 "메인" 사진). 2026-07-21 대표 지시 반영.
 *   ③ 부족분(갤러리) — 네이버 이미지검색 스코어링(매장명 토큰/플레이스 CDN 우대/스톡 배제).
 *   ④ 그래도 없으면 업종/지역 일반 검색.
 *   → 카카오·네이버 플레이스는 비공식이라 막혀도 ③④ 로 자동 폴백(회귀 0). 전부 fail-soft.
 */
import type { Env } from '../types/env'
import { fetchNaverImageUrls, fetchNaverImageUrl } from './naver-image-search'
import { fetchKakaoPlacePhotos } from './kakao-place-photos'
import { fetchNaverPlaceMainPhoto } from './naver-place-photo'

export interface DemoPhotoOpts {
  /** 카카오 place id 또는 place URL — 있으면 등록 사진을 1순위로. */
  placeId?: string | null
  /** 매장/숙소명 — 네이버 지도 대표사진 검색 + 이미지 스코어링 기준(제목 토큰 매칭). */
  nameQuery: string
  /** 매장 주소 — 네이버 지도 대표사진 검색 정확도(동명 매장 구분). */
  address?: string | null
  /** 네이버 보충 검색어(매장명 + 업종). 미지정 시 nameQuery 사용. */
  naverQuery?: string
  /** 업종/지역 일반 폴백 검색어(예: "가평 펜션"). */
  fallbackQuery?: string
  /** 목표 장수(3~5 권장). */
  count?: number
}

/**
 * 관련도 순 실사진 URL 배열(0~count 장). 첫 장 = 대표(카드 커버 — 매장 대표사진). fail-soft — 실패 시 [].
 */
export async function fetchDemoPhotos(env: Env, opts: DemoPhotoOpts): Promise<string[]> {
  const want = Math.max(1, Math.min(6, opts.count ?? 4))
  const out: string[] = []
  const seen = new Set<string>()
  const add = (arr: string[]) => {
    for (const u of arr) {
      if (out.length >= want) break
      if (u && !seen.has(u)) { seen.add(u); out.push(u) }
    }
  }
  // ① 카카오 플레이스 대표사진(그 매장이 카카오맵에 건 대표사진 = og:image).
  if (opts.placeId) {
    try { add(await fetchKakaoPlacePhotos(opts.placeId, want)) } catch { /* fail-soft → 네이버 */ }
  }
  // ② 카카오에 사진이 없으면 → 네이버 지도(플레이스) 대표사진을 커버로. (있으면 이 호출 skip — 비용 절약)
  if (out.length === 0 && opts.nameQuery) {
    try {
      const naverMain = await fetchNaverPlaceMainPhoto(opts.nameQuery, opts.address)
      if (naverMain) add([naverMain])
    } catch { /* fail-soft → 이미지검색 */ }
  }
  // ③ 부족분(갤러리) — 네이버 매장명 스코어링.
  if (out.length < want) {
    try {
      add(await fetchNaverImageUrls(env, opts.naverQuery || opts.nameQuery, {
        count: want - out.length, nameQuery: opts.nameQuery,
      }))
    } catch { /* fail-soft */ }
  }
  // ④ 그래도 부족 — 업종/지역 일반 검색(1~2장 보충, 대표 사진 이미 있으면 갤러리 채움용).
  if (out.length < want && opts.fallbackQuery) {
    try {
      const fb = await fetchNaverImageUrl(env, opts.fallbackQuery, Math.floor(Math.random() * 8))
      if (fb) add([fb])
    } catch { /* fail-soft */ }
  }
  return out
}
