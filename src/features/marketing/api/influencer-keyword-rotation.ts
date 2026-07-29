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
import { isSubrequestLimitError } from './collect-budget'

/** 우선 카테고리 — 유어딜 딜과 결이 맞는 축(맛집·뷰티·숙소). 선택 점수에 가중된다. */
//   🛒 '공동구매' 추가(2026-07-29 대표 지시) — 이미 자기 팔로워에게 직접 파는 층이라 링크샵 전환 장벽이
//   가장 낮다. 우선풀에 넣어야 희소한 YT 검색 슬롯이 실제로 이 축에 배정된다(시드만 늘리면 균등 순환에 묻힌다).
export const PRIORITY_CATEGORIES = ['공동구매', '맛집', '푸드', '외식창업', '숙소', '네일', '뷰티']

export interface YtPickKeyword {
  id: number
  keyword: string
  category: string | null
  /** 'seed'(대표 큐레이션) | 'auto'(해시태그 자동확장) | 'manual' — 자동확장 상한을 auto 에만 적용하기 위해 필요. */
  source?: string | null
  saved_total?: number
  last_saved?: number
  last_run_at?: string | null
  /** 🌵 연속 무수확 횟수 — 한 명이라도 저장되면 0 으로 리셋된다(고갈 판정의 유일한 근거). */
  barren_streak?: number
  /** 🌾 누적 **발견** 수. `saved_total` 과 짝을 이뤄 '수확률'을 만든다 — 아래 `yieldPenalty` 참조. */
  found_total?: number
}

/**
 * 🌾 **수확률 페널티** — `barren_streak` 이 구조적으로 못 보는 낭비 (2026-07-29 라이브 실측).
 *
 * ## barren_streak 의 사각지대
 * 그 카운터는 **`found == 0`**(아무도 못 찾음) 회차만 센다. 그래서
 * **"많이 찾았는데 한 명도 안 남는"** 키워드는 streak 가 영원히 0 이고, 고갈 판정에 걸리지 않는다.
 *
 * 라이브 실측(2026-07-29) — 전부 `active=1 · barren_streak=0`:
 * ```
 *   [숙소] 한옥스테이   found=117  saved=0
 *   [맛집] 부산 맛집    found=123  saved=0
 *   [숙소] 펜션 추천    found=119  saved=0
 *   [맛집] 로컬 맛집    found=105  saved=0     → 검색 464건, 리드 0명
 *   [맛집] 방배 카페    found=154  saved=1  (0.6%)
 * ```
 * 게다가 넷 다 `PRIORITY_CATEGORIES`(숙소·맛집)라 점수에서 **+50 을 받는다** —
 * 아무것도 못 내면서 희소한 YT 검색 슬롯(하루 100회)에서 *우대*받고 있었다.
 *
 * ## 왜 '삭제'가 아니라 '감점'인가
 * `saved 0` 의 원인은 둘이고 **구분할 수 없다**: ① 키워드가 나쁘다 ② 찾은 사람이 **전부 이미 풀에 있다**
 * (=고갈). 둘 다 "지금 이 슬롯을 여기 쓰지 말라"는 결론은 같지만, ②는 시간이 지나면 되살아난다
 * (새 크리에이터는 계속 생긴다). 그래서 배제가 아니라 **점수 감점**이다 — 더 나은 키워드가 쿨다운이면
 * 여전히 뽑히고, 한 명이라도 건지면 `last_saved * 3` 과 수확률 상승으로 즉시 복귀한다.
 *
 * ⚠️ **증거가 쌓이기 전엔 벌주지 않는다**(`YIELD_EVIDENCE_MIN`) — 갓 만든 키워드를 0%로 낙인찍으면
 *    탐색이 죽는다(`pickYtKeywords` 가 신규 탐색 슬롯을 따로 보장하는 이유와 같은 정신).
 */
export const YIELD_EVIDENCE_MIN = 60   // 이만큼 찾아본 뒤에야 수확률을 신뢰한다
export const YIELD_OK_RATE = 0.10      // 10% 이상이면 정상 — 손대지 않는다
export const YIELD_PENALTY_MAX = 60    // 0% 일 때의 감점 = 우선 카테고리 보너스(+50)를 상쇄하고 남는 값

export function yieldPenalty(k: YtPickKeyword): number {
  const found = Math.max(0, k.found_total || 0)
  if (found < YIELD_EVIDENCE_MIN) return 0
  const rate = Math.max(0, k.saved_total || 0) / found
  if (rate >= YIELD_OK_RATE) return 0
  return Math.round(((YIELD_OK_RATE - rate) / YIELD_OK_RATE) * YIELD_PENALTY_MAX)
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
  //   🌾 수확률 감점 추가(2026-07-29) — `barren_streak` 은 "못 찾음"만 보고 "찾았는데 안 남음"을 못 본다.
  const score = (k: YtPickKeyword) => (k.last_saved || 0) * 3 + Math.min(k.saved_total || 0, 100)
    + (k.category && priorityCats.includes(k.category) ? 50 : 0) - Math.max(0, k.barren_streak || 0) * 25
    - yieldPenalty(k)
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

/**
 * 🌵 **이 회차의 결과를 키워드 판정에 써도 되는가** (2026-07-29 — 순수함수로 승격).
 *
 *   같은 버그가 두 번 나왔다. 둘 다 "수확 0" 을 키워드 탓으로 기록한 것인데, 원인은 달랐다:
 *     ① 예산 고갈·서브리퀘스트 한도 — 우리 쪽이 굶어서 fetch 가 전부 실패 (#851 에서 수리)
 *     ② **검색을 한 번도 성공 못 함** — YT 쿼터 소진(`quotaHit`/예산/배치상한)이면 호출조차 안 하고,
 *        그 사이 네이버까지 실패하면 예산은 멀쩡한데 `found 0` 이 남는다.
 *   ②의 라이브 증거: `먹방`·`홈카페`·`뷰티 유튜버`·`코스메틱 추천`·`맛집 브이로그` 가 전부
 *   `found_total = 0`. 한국에서 가장 많이 검색되는 축들이 진짜로 0 일 리 없다.
 *
 *   기록되면 대가가 크다 — 점수 −25/회(`pickYtKeywords`) · 쿨다운 +6h/회(최대 4일) ·
 *   auto 는 8회면 **영구 비활성**. 즉 잘 되는 키워드를 스스로 은퇴시키는 자기강화 루프가 된다.
 *   ⇒ **물어봤는가**를 판정의 전제로 둔다. 안 물어봤으면 답을 기록하지 않는다(무판정).
 */
export function isUnjudgedRound(r: {
  /** 이 키워드 처리 후 남은 예산 */ budgetLeft: number
  /** 성공한 검색 호출 수(YT·네이버 합) */ searchedOk: number
  ytError?: string
  naverError?: string
}): boolean {
  return r.budgetLeft <= 0 || r.searchedOk === 0
    || isSubrequestLimitError(r.ytError) || isSubrequestLimitError(r.naverError)
}
