/**
 * 🖼️ 2026-07-20 (대표 "카카오 플레이스 사진도 함께 — 가장 이상적으로"): 데모 시드용 실사진 세트 확보.
 *   동네딜·숙소 시드 공용 — 관련도 순으로 3~5장을 모은다.
 *
 * 이상적 우선순위(관련도 높은 순):
 *   ① 카카오 플레이스 등록 사진(fetchKakaoPlacePhotos) — **바로 그 place id 의 실제 사진**이라 관련도 100%.
 *   ② 부족분은 네이버 이미지검색 스코어링(fetchNaverImageUrls — 매장명 토큰/플레이스·블로그 CDN 우대/
 *      스톡 배제)으로 보충.
 *   ③ 그래도 없으면 업종/지역 일반 검색.
 *   → 카카오가 비공식 엔드포인트라 언젠가 막혀도 ②③ 로 자동 폴백(회귀 0). 전부 fail-soft.
 */
import type { Env } from '../types/env'
import { fetchNaverImageUrls, fetchNaverImageUrl } from './naver-image-search'
import { fetchKakaoPlacePhotos } from './kakao-place-photos'

export interface DemoPhotoOpts {
  /** 카카오 place id 또는 place URL — 있으면 등록 사진을 1순위로. */
  placeId?: string | null
  /** 매장/숙소명 — 네이버 스코어링 기준(제목 토큰 매칭). */
  nameQuery: string
  /** 네이버 보충 검색어(매장명 + 업종). 미지정 시 nameQuery 사용. */
  naverQuery?: string
  /** 업종/지역 일반 폴백 검색어(예: "가평 펜션"). */
  fallbackQuery?: string
  /** 목표 장수(3~5 권장). */
  count?: number
}

/**
 * 관련도 순 실사진 URL 배열(0~count 장). 첫 장 = 대표(카드 커버). fail-soft — 실패 시 [].
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
  // ① 카카오 플레이스 등록 사진(관련도 100% — 그 매장 실제 사진).
  if (opts.placeId) {
    try { add(await fetchKakaoPlacePhotos(opts.placeId, want)) } catch { /* fail-soft → 네이버 */ }
  }
  // ② 부족분 — 네이버 매장명 스코어링.
  if (out.length < want) {
    try {
      add(await fetchNaverImageUrls(env, opts.naverQuery || opts.nameQuery, {
        count: want - out.length, nameQuery: opts.nameQuery,
      }))
    } catch { /* fail-soft */ }
  }
  // ③ 그래도 부족 — 업종/지역 일반 검색(1~2장 보충, 대표 사진 이미 있으면 갤러리 채움용).
  if (out.length < want && opts.fallbackQuery) {
    try {
      const fb = await fetchNaverImageUrl(env, opts.fallbackQuery, Math.floor(Math.random() * 8))
      if (fb) add([fb])
    } catch { /* fail-soft */ }
  }
  return out
}
