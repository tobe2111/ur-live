/**
 * 📅 **YouTube 검색 쿼터 정책** — `influencer-auto-collect.ts` 에서 분리(2026-08-11, 600줄 래칫).
 *
 *   "하루 경계를 어디로 볼 것인가 · 검색을 몇 회까지 쓸 것인가 · 어느 각도로 검색할 것인가" 는
 *   그 자체로 하나의 관심사다(수집 루프의 절차와 별개). 로직은 이동만 — 동작 불변이고,
 *   기존 import 경로는 원 모듈이 재수출해 유지한다(`influencer-enrich-lane`·테스트 2개가 쓴다).
 *
 *   ⚠️ 쿼터·단가 상수(YT_DAILY_QUOTA_UNITS / YT_SEARCH_UNIT_COST)는 `influencer-enrich-lane` 이 SSOT 다 —
 *   그 모듈이 수집 모듈을 import 하므로 여기서 되import 하면 순환이다. 관계식은 테스트가 고정한다.
 */

// ── 📅 YT 쿼터 하루 경계 — 구글 쿼터는 태평양 자정(한국 오후 4~5시) 리셋. 카운터 키에 사용. ──
// ⚠️ 쿼터 경제(2026-07-27 "평균 0회 대부분" 실사고): search.list 1회=100 units → 검색 100회=일일 쿼터(10,000) 전부
//   → 성과측정(각 1 unit)이 하루 종일 403. 검색 90회로 낮춰 측정용 ~1,000 units/day 예약(~750채널/일 측정 여력).
//   env ADS_YT_SEARCH_BUDGET 로 조정(100 으로 되돌리면 측정 굶음 — ads-yt-scheduling.test 불변식이 차단).
// 🎯 **유튜브도 일일 90%** (2026-08-04 대표 *"각각 90%씩"*) — 이미 그 값이다. 우연이 아니라 계산이다:
//   10,000 units × 90% ÷ 100 units/search = **90 검색**. 남는 1,000 units 가 성과측정(각 1 unit) 몫이고,
//   100 으로 올리면 그 몫이 0이 되어 측정이 하루 종일 403 이 된다(2026-07-27 실사고).
export const YT_DAILY_TARGET_PCT = 0.9
export const YT_SEARCH_BUDGET_DEFAULT = 90

export function ytQuotaDayKey(nowMs: number): string {
  return new Date(nowMs).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) // YYYY-MM-DD
}

/** 값 형식 "YYYY-MM-DD:count" — 날짜가 바뀌면 자동으로 0부터(별도 리셋 작업 불필요). */
export const YT_USED_KEY = 'ads_yt_search_used'

/**
 * 🎥 **검색 각도 교대** — (검색타입 × 정렬)을 매 실행 순환. 같은 키워드도 각도가 다르면 다른 채널이 나온다
 *   → top-N 재탕이 아니라 커버리지가 계속 확장(수렴). date=신생/소형, viewCount=인기, relevance=관련.
 */
export const YT_ANGLES: { searchType: 'channel' | 'video'; order: 'relevance' | 'date' | 'viewCount' }[] = [
  { searchType: 'channel', order: 'relevance' },
  { searchType: 'video', order: 'date' },        // 최신 — 계속 새로 생기는 소형 크리에이터
  { searchType: 'channel', order: 'viewCount' }, // 인기 채널
  { searchType: 'video', order: 'relevance' },
  { searchType: 'video', order: 'viewCount' },
]

/** 이번 회차가 쓸 각도 — 실행 횟수로 순환(회차마다 다른 그물). */
export function pickYtAngle(totalRuns: number): (typeof YT_ANGLES)[number] {
  const n = Number.isFinite(totalRuns) ? Math.max(0, Math.floor(totalRuns)) : 0
  return YT_ANGLES[n % YT_ANGLES.length]
}
