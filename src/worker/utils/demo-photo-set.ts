/**
 * 🖼️ 2026-07-20 (대표 "카카오 플레이스 사진도 함께 — 가장 이상적으로"): 데모 시드용 실사진 세트 확보.
 *   동네딜·숙소 시드 공용 — 관련도 순으로 3~5장을 모은다.
 *
 * 이상적 우선순위(대표사진 = 커버 out[0] 이 되도록):
 *   ⚠️ 2026-10-26 갱신 — 현행 순서는 fetchDemoPhotos 본문 주석(네이버 업체사진 → 카카오 업체사진)이 정본이다.
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
import { fetchKakaoPlacePhotos, classifiedTagsFor, fetchKakaoMyStorePhotos } from './kakao-place-photos'
import { demoPhotoJudgeOn, judgeDemoPhotos, JUDGE_MAX_IMAGES } from './demo-photo-judge'
import { fetchNaverPlaceBusinessPhotos } from './naver-place-photo'

export interface DemoPhotoOpts {
  /** 카카오 place id 또는 place URL — 있으면 등록 사진을 1순위로. */
  placeId?: string | null
  /** 매장/숙소명 — 네이버 지도 대표사진 검색 + 이미지 스코어링 기준(제목 토큰 매칭). */
  nameQuery: string
  /** 매장 주소 — 네이버 지도 대표사진 검색 정확도(동명 매장 구분). */
  address?: string | null
  /** @deprecated 2026-10-25 이미지검색 제거로 미사용(호출부 호환용). */
  naverQuery?: string
  /** 업종/지역 일반 폴백 검색어(예: "가평 펜션"). */
  fallbackQuery?: string
  /** 목표 장수(3~5 권장). */
  count?: number
  /** 상품 종류(products.category) — 분류 사진 태그를 고른다(식사=음식 먼저, 그 밖=가게 안·밖). */
  category?: string | null
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

/**
 * 🚨 후보 조회용 SQL 조각 — `(col LIKE '%h1%' OR col LIKE '%h2%' …)`.
 *
 * 2026-09-02 QA 에서 **동아일보 사진이 만화카페 딜 카드에 라이브로 떠 있었다**(id 2879). 정비(recondition)는
 * 그런 행을 만나면 바로 내리지만(`is_active=0`), 큐가 `ORDER BY p.id` 라 순번이 올 때까지 기다린다 —
 * 그날 백로그 40건 · 시간당 3건이라 **13시간**이 남아 있었다. 저작권 사진은 "나중"이 없다 ⇒ 큐에서 먼저 본다.
 *
 * ⚠️ 값이 SQL 에 그대로 들어가므로 목록에 따옴표가 없어야 한다(도메인 문자열만 — 가드가 검사한다).
 */
export function blockedPhotoSql(col: string): string {
  return '(' + BLOCKED_PHOTO_HOSTS.map((h) => `${col} LIKE '%${h}%'`).join(' OR ') + ')'
}

/** 그 매장 사진일 수 없는 출처인가. 판정 실패(파싱 불가)는 **버리는 쪽**으로 — 확신 없으면 안 쓴다. */
export function isBlockedPhotoUrl(url: string): boolean {
  if (!url) return true
  const low = url.toLowerCase()
  return BLOCKED_PHOTO_HOSTS.some((h) => low.includes(h))
}

/** 데모 사진이 갖춰야 할 최소 장수(대표 지시 "최소 3장 이상"). 모자라면 숨기지 않고 주기적으로 다시 채운다. */
export const DEMO_MIN_PHOTOS = 3

/**
 * 🚫 이미지검색·블로그에서 온 사진인가(2026-10-25). 그 경로는 사진 출처에서 뺐으므로, 이미 박혀 있는
 *   갤러리에서도 걷어낸다. 검색 결과는 `search.pstatic.net` 프록시로 감싸 저장됐다(`naver-safe-image`).
 *   ⚠️ R2 로 이관된 커버는 출처를 알 수 없어 여기서 못 잡는다 — recondition 이 커버를 새 업체 사진으로 바꾼다.
 */
export function isSearchDerivedPhoto(url: string | null | undefined): boolean {
  if (!url) return false
  return /search\.pstatic\.net|blogfiles\.|postfiles\.|mblogthumb-phinf|blogpfthumb|dthumb-phinf|pup-review-phinf|myplace-phinf/i.test(url)
}

/**
 * 🤖 2026-10-27 (대표 "매장주 제공 사진이 있는 매장만 · 그 사진들 중에서도 연관되게") — AI 판정 모드의 수집.
 *   후보 = 카카오 **매장주 제공(MYSTORE)** 사진만 → Claude Haiku 가 한 장씩 판정 → 통과한 것만.
 *   `known=false` 는 "모른다"(카카오 응답 실패·판정 실패) — 호출부는 사진을 바꾸지도 데모를 내리지도 않는다.
 *   `known=true` 이고 3장 미만이면 그 매장은 **확정적으로** 쓸 만한 매장주 사진이 모자란 것이다.
 *   ⚠️ 네이버 업체사진은 이 모드에서 부르지 않는다 — Cloudflare 에서 막혀(429) 예산만 쓰고, 대표가 정한 출처는
 *   "매장주 제공" 하나다. 서브리퀘스트 = 카카오 1 + 판정 1.
 */
export async function collectJudgedDemoPhotos(env: Env, opts: DemoPhotoOpts): Promise<{ photos: string[]; known: boolean }> {
  const want = Math.max(1, Math.min(6, opts.count ?? 4))
  // 카카오 장소가 없는 데모는 매장주 사진을 받을 길이 없다 — 확정적으로 모자란 것으로 본다(교체 대상).
  if (!opts.placeId) return { photos: [], known: true }
  const got = await fetchKakaoMyStorePhotos(opts.placeId, JUDGE_MAX_IMAGES).catch(() => ({ photos: [] as string[], total: null }))
  if (got.total == null) return { photos: [], known: false }
  const cands = got.photos.filter((u) => !isBlockedPhotoUrl(u))
  // 후보가 3장도 안 되면 판정할 필요도 없이 모자란다(판정 비용 0).
  if (cands.length < DEMO_MIN_PHOTOS) return { photos: [], known: true }
  const verdict = await judgeDemoPhotos(env, cands, { storeName: opts.nameQuery, category: opts.category })
  if (!verdict) return { photos: [], known: false }
  return { photos: cands.filter((_, i) => verdict[i]).slice(0, want), known: true }
}

export async function fetchDemoPhotos(env: Env, opts: DemoPhotoOpts): Promise<string[]> {
  // 🤖 키가 있으면 AI 판정 모드 — 판정을 못 했으면(known=false) 사진을 쓰지 않는다(판정 안 된 사진 금지).
  if (demoPhotoJudgeOn(env)) return (await collectJudgedDemoPhotos(env, opts)).photos
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
  // 🏪 2026-10-26 (대표 "업체가 올린 사진이 가장 좋잖아") — 출처는 **업체가 직접 올린 사진뿐**이다.
  //   ① 네이버 플레이스 업체사진 탭(분류가 가장 잘 돼 있다 — 대표 판단) ② 모자라면 카카오 업체 사진
  //   (매장주·제휴사 제공). 손님 리뷰·블로그 사진은 어느 쪽에서도 받지 않는다.
  //   ⚠️ 종전 1순위였던 카카오 og:image 는 Cloudflare 에서 403 이라 라이브 수집이 0장이었다(진단 2484).
  if (opts.nameQuery) {
    try { add(await fetchNaverPlaceBusinessPhotos(opts.nameQuery, opts.address, want)) } catch { /* fail-soft → 카카오 */ }
  }
  // 🏷️ 2026-10-27 (대표 "업체사진→분류사진") — 카카오 업체 사진, 그래도 모자라면 카카오가 장면을
  //   분류한 사진(식사=음식·내부·외부 / 그 밖=내부·외부). 분류 없는 사진은 받지 않는다.
  if (out.length < want && opts.placeId) {
    try { add(await fetchKakaoPlacePhotos(opts.placeId, want, classifiedTagsFor(opts.category))) } catch { /* fail-soft */ }
  }
  // ③ **제거됨 (2026-10-25 대표 — "블로그에서 사진 발췌해서 의미없는 것도 올려와져").**
  //    네이버 이미지검색은 "그 이름으로 검색된 웹 이미지"라 블로그 본문 사진이 섞이고(블로그 호스트에
  //    가산점까지 줬다), 이름이 하나도 안 맞는 0점 사진도 통과했다. 사진 출처는 **지도에 등록된 사진뿐**이다.
  //    모자라면 지어내지 않는다 — 3장이 안 되면 recondition 이 주기적으로 다시 시도한다(demo-image-rehost.ts).
  // ④ 제거됨 (2026-08-08) — 업종/지역 일반 검색.
  return out
}
