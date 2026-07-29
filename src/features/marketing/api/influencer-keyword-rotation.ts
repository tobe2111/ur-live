/**
 * 🎯 YT 검색 슬롯 키워드 선택 — **순수 로직 전용**(DB·fetch 없음 → 전량 유닛 테스트 가능).
 *
 *   2026-07-21 실병목: YouTube Search Queries/day = 100회. 희소한 검색을 균등 순환에 흘리면
 *   "잘 무는 키워드"가 굶는다 → 성과 가중 선택 + 신규 탐색 슬롯 보장.
 *   2026-07-29 고갈 억제 추가(아래 `ytCooldownMs`).
 *
 *   ⚠️ `influencer-auto-collect.ts` 에서 분리된 이유는 그 파일이 600줄 래칫에 닿았기 때문이다.
 *   호환을 위해 원래 모듈이 이 심볼들을 그대로 재수출한다(기존 import 경로 유지).
 */

/** 우선 카테고리 — 유어딜 딜과 결이 맞는 축(맛집·뷰티·숙소). 선택 점수에 가중된다. */
export const PRIORITY_CATEGORIES = ['맛집', '푸드', '외식창업', '숙소', '네일', '뷰티']

export interface YtPickKeyword {
  id: number
  keyword: string
  category: string | null
  saved_total?: number
  last_saved?: number
  last_run_at?: string | null
  /** 🌵 연속 무수확 횟수 — 한 명이라도 저장되면 0 으로 리셋된다(고갈 판정의 유일한 근거). */
  barren_streak?: number
}

const YT_PICK_COOLDOWN_MS = 6 * 3600 * 1000 // 같은 키워드 최소 6h 간격(하루 최대 4회 — 5각도 회전과 조합)

/**
 * 🌵 고갈 키워드 억제(2026-07-29) — 연속 무수확 1회마다 쿨다운을 6h 씩 더 준다(상한 4일).
 *   근거(라이브 실측): `found 5 → saved 0` 인데 검색 쿼터는 39/90 만 소진 — 다 훑은 키워드가
 *   점수 상위를 지키며 슬롯을 계속 먹고 있었다. **삭제가 아니라 간격 확대**인 이유는 키워드가
 *   영구히 죽는 게 아니라서다(새 크리에이터는 계속 생긴다). 한 명이라도 건지면 streak=0 → 즉시 복귀.
 */
export const BARREN_COOLDOWN_STEP_MS = 6 * 3600 * 1000
export const BARREN_COOLDOWN_MAX_MS = 4 * 24 * 3600 * 1000
export function ytCooldownMs(k: YtPickKeyword): number {
  const streak = Math.max(0, k.barren_streak || 0)
  return Math.min(YT_PICK_COOLDOWN_MS + streak * BARREN_COOLDOWN_STEP_MS, BARREN_COOLDOWN_MAX_MS)
}

/** 성과 가중 YT 키워드 선택(순수 — 테스트 가능). 탐색 슬롯 1개(미실행 키워드) + 나머지는 성과순(쿨다운 준수). */
export function pickYtKeywords(kws: YtPickKeyword[], n: number, nowMs: number, priorityCats: string[] = PRIORITY_CATEGORIES): YtPickKeyword[] {
  if (n <= 0 || !kws.length) return []
  const ranAt = (k: YtPickKeyword) => k.last_run_at ? Date.parse(k.last_run_at.replace(' ', 'T') + (/[zZ+]/.test(k.last_run_at.slice(10)) ? '' : 'Z')) : NaN
  //   🌵 누적 성과(`saved_total`)는 과거의 영광이라 고갈돼도 점수를 떠받친다 → 연속 무수확만큼 깎는다.
  //   최근 성과(`last_saved`)와 우선 카테고리 가중은 그대로(잘 무는 키워드는 여전히 최우선).
  const score = (k: YtPickKeyword) => (k.last_saved || 0) * 3 + Math.min(k.saved_total || 0, 100)
    + (k.category && priorityCats.includes(k.category) ? 50 : 0) - Math.max(0, k.barren_streak || 0) * 25
  const neverRun = kws.filter(k => !k.last_run_at).sort((a, b) => a.id - b.id)
  const cooled = kws.filter(k => { const t = ranAt(k); return Number.isFinite(t) && nowMs - t >= ytCooldownMs(k) })
    .sort((a, b) => score(b) - score(a) || ranAt(a) - ranAt(b))
  const picks: YtPickKeyword[] = []; const seen = new Set<number>()
  const take = (k?: YtPickKeyword) => { if (k && !seen.has(k.id) && picks.length < n) { seen.add(k.id); picks.push(k) } }
  take(neverRun[0]) // 탐색 보장 — 새 키워드가 영영 안 돌지 않게(있을 때만)
  for (const k of cooled) take(k)
  for (const k of neverRun) take(k)
  if (picks.length < n) for (const k of kws.slice().sort((a, b) => score(b) - score(a))) take(k) // 쿨다운 무시 폴백(풀이 작을 때)
  return picks
}
