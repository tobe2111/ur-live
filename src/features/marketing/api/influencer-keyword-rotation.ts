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
//   🛒 '공동구매' 추가(2026-07-29 대표 지시) — 이미 자기 팔로워에게 직접 파는 층이라 링크샵 전환 장벽이
//   가장 낮다. 우선풀에 넣어야 희소한 YT 검색 슬롯이 실제로 이 축에 배정된다(시드만 늘리면 균등 순환에 묻힌다).
export const PRIORITY_CATEGORIES = ['공동구매', '맛집', '푸드', '외식창업', '숙소', '네일', '뷰티']

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

/**
 * 🌱 **신규(auto) 키워드 전용 쿼터** (2026-07-29 신설 — 실측으로 드러난 교착 해소).
 *
 *   교착의 정체: 승격 자리를 `MAX_ACTIVE_KEYWORDS - 활성전체` 로 셌는데, 시드만으로 이미 상한에 닿는다
 *   (일반 ~90 + 지역그리드 100 + 방배 11 ≈ 200). 라이브 실측 **활성 210 = seed 190 + auto 20** →
 *   `room = max(0, 200 - 210) = 0` → **신규 키워드가 영원히 승격 못 한다**(`promoted: []` 고착).
 *   그 결과 수집은 고갈된 셋만 반복해 `found 332 → saved 3`(99% 중복)이 됐다.
 *
 *   왜 시드를 줄이지 않는가: 바로 위 은퇴 규칙의 주석대로 **시드는 대표가 고른 지역/업종 축**이라
 *   비활성화하면 커버리지에 구멍이 난다. 쿨다운(`ytCooldownMs`)이 이미 시드의 *검색 슬롯* 점유를 막는다.
 *   문제는 쿨다운과 승격 자리 계산이 **서로 다른 것을 센다**는 점이었다 — 쿨다운은 검색 슬롯, room 은
 *   활성 *행 수*. 쿨다운된 시드도 행으로는 살아 있어 room 을 0 으로 눌렀다.
 *   ⇒ 두 관심사를 분리한다: 시드=커버리지(대표가 정함, 무제한) · auto=발굴(자기 쿼터로 제한).
 *   불모 auto 는 기존 규칙(`barren_streak >= 8`)이 회수하므로 이 쿼터는 계속 재활용된다.
 */
export const MAX_AUTO_KEYWORDS = 60

/** 신규 키워드가 들어갈 자리 — 시드 수와 **무관**해야 발굴이 굶지 않는다(위 상수 주석 참조). */
export function autoPromotionRoom(activeAutoCount: number, cap = MAX_AUTO_KEYWORDS): number {
  const n = Number.isFinite(activeAutoCount) ? Math.max(0, activeAutoCount) : 0
  const c = Number.isFinite(cap) ? Math.max(0, cap) : 0
  return Math.max(0, c - n)
}
