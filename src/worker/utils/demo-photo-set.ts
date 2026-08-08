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
 *
 * 🔴 2026-08-08 (대표 신고 "데모 숙소 정보가 전혀 맞지 않음, 특히 사진들" — 라이브 실사 후 수리):
 *   ③④ 는 **그 매장의 사진이라는 보장이 전혀 없다.** 실측 피해:
 *     · "경포파도네 프리미엄 숲속 풀빌라" → **연합뉴스 워터마크가 박힌 파도 뉴스 사진**
 *       (매장명이 "경포 파도"로 읽혀 뉴스 이미지가 스코어링을 통과)
 *     · "위대한게스트 스탠다드 룸" → 바닷가 주차장 스냅
 *     · "헬스보이짐 1개월 이용권" → 타 업체 이벤트 배너
 *   무관한 사진은 품질 문제로 끝나지만 **언론사 사진은 저작권 문제**다. 그래서:
 *     · 언론사/뉴스 도메인은 **하드 배제**(아래 BLOCKED_PHOTO_HOSTS) — 스코어와 무관하게 버린다
 *     · ④(업종·지역 일반 검색)는 **제거**. 그 매장과 아무 관계가 없는데 "그 매장 사진" 자리에 앉는다.
 *       사진이 없으면 **없는 채로 둔다** — 없는 것보다 틀린 게 나쁘다(호출부가 플레이스홀더 처리).
 *   ⇒ 남은 경로 ①②③ 은 전부 "그 매장"에 근거가 있다(①② 지도 등록 사진, ③ 매장명 토큰 매칭).
 */
import type { Env } from '../types/env'
import { fetchNaverImageUrls } from './naver-image-search'
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
/**
 * 🚫 언론사·뉴스 CDN — **매장 사진일 수 없고, 저작권이 살아 있다.**
 *   워터마크가 박힌 채로 상업 화면에 걸리면 품질이 아니라 법 문제가 된다(2026-08-08 연합뉴스 실사고).
 *   ⚠️ 목록은 **줄이지 말 것**. 늘리는 건 자유.
 */
const BLOCKED_PHOTO_HOSTS = [
  'yna.co.kr', 'yonhapnews', 'newsis.com', 'news1.kr', 'newspim', 'hankyung.com',
  'mk.co.kr', 'chosun.com', 'donga.com', 'joins.com', 'joongang.co.kr', 'khan.co.kr',
  'hani.co.kr', 'seoul.co.kr', 'kbs.co.kr', 'imbc.com', 'sbs.co.kr', 'ytn.co.kr',
  'newsroom', 'pressian', 'nocutnews', 'edaily.co.kr', 'fnnews.com', 'asiae.co.kr',
  'wikitree', 'insight.co.kr', 'dispatch.co.kr', 'osen.co.kr', 'sporbiz',
  'shutterstock', 'gettyimages', 'istockphoto', 'alamy', '123rf', 'dreamstime',
] as const

/** 그 매장 사진일 수 없는 출처인가. 판정 실패(파싱 불가)는 **버리는 쪽**으로 — 확신 없으면 안 쓴다. */
export function isBlockedPhotoUrl(url: string): boolean {
  if (!url) return true
  const low = url.toLowerCase()
  return BLOCKED_PHOTO_HOSTS.some((h) => low.includes(h))
}

export async function fetchDemoPhotos(env: Env, opts: DemoPhotoOpts): Promise<string[]> {
  const want = Math.max(1, Math.min(6, opts.count ?? 4))
  const out: string[] = []
  const seen = new Set<string>()
  const add = (arr: string[]) => {
    for (const u of arr) {
      if (out.length >= want) break
      // 🚫 2026-08-08: 언론사/스톡은 스코어와 무관하게 버린다(저작권).
      if (u && !seen.has(u) && !isBlockedPhotoUrl(u)) { seen.add(u); out.push(u) }
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
  // ④ **제거됨 (2026-08-08).** 업종/지역 일반 검색은 그 매장과 아무 관계가 없는 사진을 "그 매장 대표사진"
  //    자리에 앉힌다. 화면을 채우려고 거짓 정보를 만드는 셈이라, 비우는 쪽이 옳다.
  //    (opts.fallbackQuery 는 호출부 호환을 위해 타입에 남겨두되 더는 사용하지 않는다.)
  return out
}
