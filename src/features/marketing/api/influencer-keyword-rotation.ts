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
import { contactPenalty } from './influencer-keyword-yield'

/** 우선 카테고리 — 유어딜 딜과 결이 맞는 축(맛집·뷰티·숙소). 선택 점수에 가중된다. */
//   🛒 '공동구매' 추가(2026-07-29 대표 지시) — 이미 자기 팔로워에게 직접 파는 층이라 링크샵 전환 장벽이
//   가장 낮다. 우선풀에 넣어야 희소한 YT 검색 슬롯이 실제로 이 축에 배정된다(시드만 늘리면 균등 순환에 묻힌다).
export const PRIORITY_CATEGORIES = ['공동구매', '맛집', '푸드', '외식창업', '숙소', '네일', '뷰티']

/**
 * 🎯 **집중 축(focus)** — 배치의 일부를 통째로 떼어 주는 전용 슬롯 (2026-08-02 대표 확정 "C안").
 *
 *   ## 왜 우선 풀에 얹지 않고 따로 떼나
 *   우선 풀(3/4)에 한 축을 더 넣으면 그 축은 **7분의 1**만 받는다. 마케팅대행사는 절대 수가 적어
 *   (전국 수천 곳) 그 속도로는 몇 주가 걸린다. 반대로 전용 슬롯이면 며칠이면 훑는다.
 *
 *   ## 왜 이 축인가
 *   대행사 리드 1건은 **매장 N건으로 곱해진다** — 다른 축은 전부 1:1이다. 유어딜 입장에서 한 사람이
 *   여러 매장을 물어오는 유일한 부류라, 같은 예산으로 가장 많은 매장을 만든다.
 *
 *   ## ⚠️ 자기 반납이 이 설계의 핵심이다
 *   전용 슬롯은 **비어 있으면 스스로 반납**한다(`planKeywordSplit` 이 실제 가용 키워드 수로 clamp).
 *   대행사 키워드가 고갈되면(무수확이 쌓여 자동 비활성) 그 슬롯은 다음 회차부터 우선/일반 풀로 돌아간다.
 *   ⇒ "다 훑고 나서도 1/4을 영원히 낭비"하는 상태가 구조적으로 안 생긴다.
 *   ⚠️ 축을 늘릴 땐 신중히 — 여기 넣는 만큼 맛집·뷰티 같은 본업 축의 순번이 뒤로 밀린다.
 */
export const FOCUS_CATEGORIES = ['마케팅대행사']

/**
 * 🔁 **축별 회전 배수** — 몫을 *슬롯 수*가 아니라 *한 바퀴 시간*으로 정한다 (2026-08-05 대표 "가장 이상적으로").
 *
 * ## 왜 바꿨나 (라이브 실측)
 * 예전 규칙은 **슬롯 비율 고정**이었다(집중 25%, 나머지를 우선:일반 3:1). 그러면 풀 크기가 변할 때마다
 * 한 바퀴 시간이 제멋대로 흘러간다 — **맛집에 키워드를 더 넣으면 숙소가 조용히 굶는다.** 아무도 그걸
 * 바꾼 적이 없는데도. 2026-08-05 실측이 정확히 그 누적 결과였다:
 *
 *   집중 19개가 4슬롯(키워드당 0.211) · 우선 315개가 9슬롯(0.029) · 일반 65개가 3슬롯(0.046)
 *   ⇒ **집중 축 키워드가 우선 축보다 7배 자주** 돌았다. 마케팅대행사 19개 중 18개가 24h 내 실행된 반면
 *     숙소 19개는 12개가 **한 번도 안 돌았고** 24h 실행 0, 골프 6개 전부 미실행.
 *
 * ## 새 규칙
 * 몫 ∝ (그 축의 가용 키워드 수) × (배수). 이러면 **한 바퀴 시간 ∝ 1/배수** 가 되어 풀 크기와 무관해진다 —
 * 축에 키워드를 100개 더 넣어도 다른 축의 순번이 밀리지 않는다(그 축이 느려질 뿐이다).
 *
 * 배수는 대표가 정한 축 우선순위를 **그대로 보존**한다. 다만 "집중이 25% 슬롯"이 아니라
 * "집중이 3배 자주 돈다"로 표현이 바뀌었다. 값을 바꾸려면 여기 숫자 하나만 고치면 된다.
 */
export const AXIS_ROTATION_MULTIPLIER = { focus: 3, priority: 2, general: 1 } as const

/**
 * 배치를 [집중 · 우선 · 일반] 으로 나눈다 — **순수**(유닛으로 고정).
 *
 *   불변식 넷(앞 셋은 종전과 동일):
 *     ① 합계는 `total` 을 절대 안 넘는다
 *     ② 슬롯을 버리지 않는다 — 가용 키워드가 있으면 `min(total, 가용합계)` 만큼 꽉 채운다
 *     ③ 각 몫은 그 풀의 **실제 가용 수**를 안 넘는다(= 빈 풀은 자동 반납)
 *     ④ 🆕 비지 않은 축은 **최소 1슬롯**을 받는다(슬롯이 축 수보다 많을 때) —
 *        비례 배분만 하면 작은 풀(집중 19)이 큰 풀(우선 315) 옆에서 **매 회차 0** 이 되어
 *        전략 축이 사실상 꺼진다. 반올림이 정책을 삼키지 않게 하는 바닥이다.
 */
export function planKeywordSplit(
  total: number, focusAvail: number, priAvail: number, genAvail: number,
  mult: { focus: number; priority: number; general: number } = AXIS_ROTATION_MULTIPLIER,
): { nFocus: number; nPri: number; nGen: number } {
  const cap = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0
  const av = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0)
  const avail = [av(focusAvail), av(priAvail), av(genAvail)]
  const w = [avail[0] * mult.focus, avail[1] * mult.priority, avail[2] * mult.general]
  const budget = Math.min(cap, avail[0] + avail[1] + avail[2])
  const out = [0, 0, 0]
  if (budget <= 0) return { nFocus: 0, nPri: 0, nGen: 0 }

  // ④ 바닥 — 비지 않은 축부터 1씩(가중치 큰 순). 슬롯이 모자라면 큰 축이 먼저 받는다.
  const order = [0, 1, 2].sort((a, b) => w[b] - w[a])
  let left = budget
  for (const i of order) { if (left > 0 && avail[i] > 0) { out[i] = 1; left-- } }

  // 비례 배분(최대잔여) — 바닥을 뺀 나머지를 가중치대로.
  const wSum = w[0] + w[1] + w[2]
  if (left > 0 && wSum > 0) {
    const want = w.map(x => (left * x) / wSum)
    const base = want.map(x => Math.floor(x))
    for (let i = 0; i < 3; i++) { const add = Math.min(base[i], avail[i] - out[i]); out[i] += add; left -= add }
    // 남은 슬롯은 소수부 큰 축부터 — 가용분이 남아 있는 축에만.
    const rest = [0, 1, 2].sort((a, b) => (want[b] - Math.floor(want[b])) - (want[a] - Math.floor(want[a])))
    while (left > 0) {
      const i = rest.find(k => out[k] < avail[k])
      if (i === undefined) break
      out[i]++; left--
      rest.push(rest.splice(rest.indexOf(i), 1)[0])   // 라운드로빈으로 돌려 한 축이 독식하지 않게
    }
  }
  // ② 슬롯을 버리지 않는다 — 위에서 남았으면 가용분 있는 축이 마저 가져간다.
  for (const i of order) { while (left > 0 && out[i] < avail[i]) { out[i]++; left-- } }
  return { nFocus: out[0], nPri: out[1], nGen: out[2] }
}

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
  /** 🎯 유튜브 연락처 성과(주기 재계산 — `influencer-keyword-yield.ts`). 없으면 감점 0. */
  yt_leads?: number
  yt_contacts?: number
  /** 🌾 누적 **발견** 수. `saved_total` 과 짝을 이뤄 '수확률'을 만든다 — 아래 `yieldPenalty` 참조. */
  found_total?: number
}

/**
 * 🌾 **수확률 페널티** — `barren_streak` 이 구조적으로 못 보는 낭비 (2026-07-29 라이브 실측).
 *
 * ## barren_streak 의 사각지대
 * 그 카운터는 **`saved == 0`**(저장 0) 회차 연속을 센다(수집 루프의 `CASE WHEN ? > 0` 이 `v.saved` 에
 * 바인딩 — 2026-08-09 정정: 예전 판은 "found==0 만 센다"고 적었는데 **코드와 달랐다**). 그래서 사각지대는
 * "많이 찾는" 키워드 일반이 아니라, **가끔 1명씩 떨궈 streak 을 리셋하는 저수율(drip)** 키워드다 —
 * 8연속 빈손에 영영 못 닿아 고갈 판정에 안 걸린다(라이브 5개 좀비 중 4개가 정확히 이 부류: saved 2~9).
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

/**
 * 🧭 **탐색 순번** — 한 번도 안 돈 키워드 중 누구를 먼저 보낼 것인가.
 *
 * ## 왜 FIFO 가 틀렸나 (2026-07-29 라이브 실측)
 * 예전엔 `sort(a.id - b.id)`, 즉 **들어온 순서**였다. 그 결과:
 * ```
 *   미실행 키워드 703개 · 그중 자동확장(해시태그) 557개
 *   대표가 오늘 07:00 시드한 '공동구매' 41개 → 큐 순번 582~622위
 *   탐색 슬롯은 라운드당 1개 · 오늘 실행된 키워드는 전체 30개
 *   ⇒ 첫 공동구매 키워드 차례까지 대략 **75일**
 * ```
 * 즉 **대표가 방금 지정한 전략 축이, 기계가 만든 해시태그 557개 뒤에 줄을 섰다.**
 * 이건 우선순위 문제가 아니라 *줄 세우는 기준*이 없던 것이다 — `PRIORITY_CATEGORIES`(+50)는
 * 이미 돌아본 키워드(`cooled`)의 점수에만 쓰이고, 미실행 큐는 아무 기준 없이 id 순이었다.
 *
 * ## 기준
 * ① **사람이 고른 것 먼저**(`seed`/`manual`) — 자동확장은 기계의 추측이고, 시드는 대표의 축이다.
 * ② 같은 등급이면 **우선 카테고리 먼저**. ③ 그 다음에야 id(들어온 순서).
 *
 * ⚠️ 이것이 **못 고치는 것**: 탐색 슬롯 수(라운드당 1)는 그대로다. 41개를 다 돌려면 여전히
 *    41라운드(현 속도로 ~5일)가 걸린다. 슬롯을 늘리는 건 성과 키워드의 몫을 깎는 일이라
 *    별도 판단이며, 지금 병목은 *순서*지 슬롯 수가 아니었다(75일 → 다음 라운드).
 */
export function exploreRank(k: YtPickKeyword, priorityCats: string[] = PRIORITY_CATEGORIES): number {
  const curated = (k.source || '') === 'auto' ? 1 : 0   // source 미상은 사람 것으로 본다(보수적)
  const prio = k.category && priorityCats.includes(k.category) ? 0 : 1
  return curated * 2 + prio
}

/** 성과 가중 YT 키워드 선택(순수 — 테스트 가능). 탐색 슬롯 1개(미실행 키워드) + 나머지는 성과순(쿨다운 준수). */
export function pickYtKeywords(kws: YtPickKeyword[], n: number, nowMs: number, priorityCats: string[] = PRIORITY_CATEGORIES): YtPickKeyword[] {
  if (n <= 0 || !kws.length) return []
  const ranAt = (k: YtPickKeyword) => k.last_run_at ? Date.parse(k.last_run_at.replace(' ', 'T') + (/[zZ+]/.test(k.last_run_at.slice(10)) ? '' : 'Z')) : NaN
  //   🌵 누적 성과(`saved_total`)는 과거의 영광이라 고갈돼도 점수를 떠받친다 → 연속 무수확만큼 깎는다.
  //   최근 성과(`last_saved`)와 우선 카테고리 가중은 그대로(잘 무는 키워드는 여전히 최우선).
  //   🌾 수확률 감점 추가(2026-07-29) — `barren_streak` 은 "못 찾음"만 보고 "찾았는데 안 남음"을 못 본다.
  //   🎯 **연락처 감점**(2026-08-04 대표 *"이메일 및 연락처 수집율로 기준해서 개선"*) — 위 셋이 보는 것은
  //   전부 *몇 명 모았나* 다. 그런데 지표는 *제안 보낼 수 있는 리드 수*라, 연락처 0% 인 키워드가
  //   리드를 잘 물어오면 여기서 **우수로 평가된다**(실측: 금천 네일 118건 · 이메일 0건 · 감점 0).
  //   유튜브 한정인 이유는 `influencer-keyword-yield.ts` 헤더 참조(네이버는 우리 백로그가 신호를 오염시킨다).
  const score = (k: YtPickKeyword) => (k.last_saved || 0) * 3 + Math.min(k.saved_total || 0, 100)
    + (k.category && priorityCats.includes(k.category) ? 50 : 0) - Math.max(0, k.barren_streak || 0) * 25
    - yieldPenalty(k) - contactPenalty(k.yt_leads, k.yt_contacts)
  // 🧭 미실행 큐는 **사람이 고른 것 → 우선 카테고리 → 들어온 순서**(위 exploreRank 의 실측 근거).
  const neverRun = kws.filter(k => !k.last_run_at)
    .sort((a, b) => exploreRank(a, priorityCats) - exploreRank(b, priorityCats) || a.id - b.id)
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
 *
 * ## 📈 60 → 120 (2026-08-09 — 대표 "1번(키워드 수율)" 지시의 본 처방)
 *
 *   **07-21 발굴 스파이크(12,533/일 — 평소의 2배)의 정체가 실측으로 풀렸다**: 07-20 에 키워드
 *   862개가 만들어지고 202개가 활성화된 **다음날**이다. 신선한 키워드의 첫 회차는 그 키워드의
 *   기존 글 백로그를 수확한다(고갈 곡선 실측: 회당 저장이 실행 5~14회 14.3 → 30회+ 2.4).
 *   그런데 라이브는 `active 60 / room 0` 고착 — 승격 대기 후보 **2,981개**(hits≥5 충족)가
 *   barren(8연속 빈손) 은퇴로만 열리는 자리를 기다리고 있었다(사실상 안 열림 — streak 1 이 8개뿐).
 *
 *   ⚠️ **이 값은 네이버 호출량과 무관하다** — 회차당 검색 수는 `COLLECT_KEYWORDS_PER_ROUND`(6)가
 *   정하고 그건 그대로다. 풀이 커지면 한 바퀴가 길어질 뿐(399→~459개, 2.8→3.2일). 즉 이 상향은
 *   차단 리스크 0 으로 신선도만 올린다 — 그 리스크를 지는 레버(회차 폭)와 혼동하지 말 것.
 *   부작용: 한 바퀴 시간이 늘면 순환 경보 임계(`judgeRotation`)도 자동으로 따라간다(주기 비례).
 */
export const MAX_AUTO_KEYWORDS = 120

/** 신규 키워드가 들어갈 자리 — 시드 수와 **무관**해야 발굴이 굶지 않는다(위 상수 주석 참조). */
export function autoPromotionRoom(activeAutoCount: number, cap = MAX_AUTO_KEYWORDS): number {
  const n = Number.isFinite(activeAutoCount) ? Math.max(0, activeAutoCount) : 0
  const c = Number.isFinite(cap) ? Math.max(0, cap) : 0
  return Math.max(0, c - n)
}

/**
 * 🕊️ **은퇴 증거의 유통기한(가석방)** — 대표 확정 2026-08-09 *"영구 배제가 되면 안된다"*.
 *
 *   근거는 `yieldPenalty` 의 관찰과 같다 — 새 크리에이터는 계속 생기므로 "그때 못 물었다"가 "영영 못
 *   문다"는 아니다. 마지막 실행이 이 일수보다 오래됐으면 은퇴 증거를 **낡은 것**으로 보고 조건에서 뺀다.
 *   차단(`PROMOTE_NOT_RETIRABLE_SQL`)은 이 조각들의 부정이라 **자동으로 함께 만료**된다: 30일 뒤
 *   재승격 가능 → 한 회차 돌아 재평가 → 또 빈손이면 증거가 신선해져 다시 30일 차단. 나쁜 키워드의
 *   비용은 30일당 슬롯 1개로 유계이고, 영구 배제는 구조적으로 불가능하다.
 *   활성 키워드는 회전 랩(~3일)상 last_run_at 이 항상 신선해 **은퇴 동작은 사실상 불변**이다.
 */
export const RETIRE_EVIDENCE_FRESH_DAYS = 30
const FRESH_EVIDENCE = `last_run_at IS NOT NULL AND last_run_at >= datetime('now','-${RETIRE_EVIDENCE_FRESH_DAYS} days')`

/**
 * 🪦 **auto 은퇴 3문(수집 회차 시작에 실행)의 WHERE 조각** — 은퇴문과 승격 차단이 **같은 문자열**을 봐야 한다.
 *
 *   ⚠️ 전부 COALESCE 로 감싼 이유: 이 조각은 승격 차단(`PROMOTE_NOT_RETIRABLE_SQL`)에서 **NOT(...)** 으로도
 *   쓰이는데, 미실행 후보는 found/saved/barren 이 NULL 일 수 있다. bare 비교(`found_total >= 50`)는 NULL 을
 *   내고, SQL 3치 논리에서 `NOT(NULL OR …)` 은 NULL = 제외 — **신선 후보 전체가 승격에서 조용히 빠진다.**
 *   COALESCE 면 각 조각이 항상 참/거짓이라 그 함정이 없다(은퇴문 쪽 의미는 동일 — NULL 은 어차피 은퇴 아님).
 *   `last_run_at` 비교는 `FRESH_EVIDENCE` 의 선행 `IS NOT NULL` 이 단락시켜 같은 이유로 NULL-안전하다.
 */
export const AUTO_RETIRE_WHERE = {
  /** (F-30) 이틀+ 돌았는데 성과 0 — 탐색 슬롯 점유 차단(증거 30일 유통기한). */
  f30: `COALESCE(saved_total, 0) = 0 AND ${FRESH_EVIDENCE} AND last_run_at <= datetime('now','-2 days')`,
  /** 🌵 연속 무수확(저장 0 회차) 8회+ — 고갈(증거 30일 유통기한). */
  barren: `COALESCE(barren_streak, 0) >= 8 AND ${FRESH_EVIDENCE}`,
  /** 🌾 수율 — 찾긴 하는데(found 50+) 새 리드가 안 남음(saved <10). barren 의 drip 사각지대를 닫는다. */
  yield: `COALESCE(found_total, 0) >= 50 AND COALESCE(saved_total, 0) < 10 AND ${FRESH_EVIDENCE}`,
} as const

/**
 * 🧟 **승격 차단 — "다음 회차 시작에 즉시 재은퇴될" 키워드는 되살리지 않는다** (2026-08-09 라이브 실측).
 *
 * ## 무엇이 고장이었나 (livelock — cap 120 개방이 무장시킨 자리)
 * 은퇴는 `active=0` 만 쓴다 — `hits` 는 그대로고 **재발굴될 때마다 계속 쌓인다**(upsert 는 active 무관).
 * 그런데 승격 후보 쿼리는 `active=0 AND hits>=5` 뿐이라, 은퇴자가 그 회차 topTags 에 다시 채굴되면
 * `hits DESC` 에서 **신선 큐를 제치고 재승격**된다. 수율/F-30/barren 조건은 전부 **평생 카운터**
 * (found/saved/streak 은 리셋되지 않는다)라 재승격자는 다음 회차 시작의 은퇴 batch 가 **돌기도 전에 다시
 * 은퇴**시킨다 — 한 번도 안 돌고 승격 슬롯만 태우는 순환이다. 라이브 실측(2026-08-09): 좀비 5개
 * (재테크 hits 260 · 동작카페 124 · 감성카페 103 · 재테크블로그 56 · 중랑네일 49), 그중 4개가 카테고리
 * 게이트 통과(맛집/네일) = 재승격 가능. 수율 은퇴가 도는 한 이 집합은 **단조 증가**한다.
 *
 * ## 이 가드가 막지 않는 것 (의도)
 * 2026-07-29 결정(`healBarrenStreakOnce` docblock)의 복귀 경로는 살아 있다 — 오염된 barren 으로 잘못
 * 은퇴됐다 힐링된 고수율 키워드(맛집 saved 414 · 피부관리 363 …)는 세 조건 어디에도 안 걸려 재승격된다
 * (실제로 #1106 cap 개방 직후 그 경로로 복귀했다 — 관측 15개 전원 온타깃). 막는 것은 오직
 * "되살려도 즉시 재은퇴 = 순수 낭비" 클래스이고, 그 차단도 **영구가 아니다** — 증거가 낡으면
 * (`RETIRE_EVIDENCE_FRESH_DAYS`) 은퇴 조건과 함께 만료되어 재도전 1회가 열린다(대표 확정 2026-08-09).
 */
export const PROMOTE_NOT_RETIRABLE_SQL =
  `NOT ((${AUTO_RETIRE_WHERE.f30}) OR (${AUTO_RETIRE_WHERE.barren}) OR (${AUTO_RETIRE_WHERE.yield}))`

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

/**
 * 🔀 **YT 픽과 커서 픽을 번갈아 놓는다** — 커서가 영영 안 도는 것을 푼다 (2026-07-29 실측).
 *
 * ## 무엇이 고장이었나 (12:00 틱)
 * `picks { planned: 16, processed: 2, from_yt: 2, from_cursor: 0 }` — 16개를 계획했는데 예산으로 2개만
 * 돌았고 **둘 다 YT 픽**이었다. 배열이 `[...ytPicks, ...cursorPicks]` 라 커서 픽은 전부 꼬리에 있었다.
 *
 * 그런데 커서 전진은 `prefixDone`(처리된 **선행 구간** 길이)으로 계산한다 → 커서 픽이 한 번도 처리되지
 * 않으니 `nextCursor = cursor + 0` → **커서가 영원히 제자리**다. 두 결함이 서로를 강화한다:
 * 꼬리라서 못 돌고, 못 도니까 커서가 안 밀리고, 안 밀리니 다음 회차도 같은 자리다.
 * ⇒ 활성 키워드 330개 중 **매 회차 같은 소수만** 돌고 나머지는 순번을 못 받는다(수집 폭이 구조적으로 갇힘).
 *
 * ## 오늘 세 번째 같은 병
 * ① 보강 레인: 마지막 track(naver)이 **시계**를 못 받음 · ② 그 전엔 마지막 track 이 **예산**을 못 받음 ·
 * ③ 여기: 뒤쪽 픽이 **순번**을 못 받음. **줄을 세우면 꼬리가 굶는다** — 자원이 무엇이든.
 *
 * ⚠️ 이 함수만으론 부족하다: 순서를 섞으면 커서 픽이 YT 슬롯(희소 자원)을 가져가 성과가중 선택이 희석된다.
 *   그래서 호출부에서 YT 게이트를 **위치 기반(`ytUsed < batch`)에서 멤버십 기반(`ytIds.has`)으로** 함께 바꾼다.
 *   둘 중 하나만 하면 안 된다 — 순서와 쿼터 배분이 한 조건에 얽혀 있던 것이 원인이기 때문이다.
 *
 * ⚠️ 상대 순서는 보존한다 — `prefixDone` 이 각 목록의 **선행 구간**을 세므로 뒤섞으면 커서 계산이 깨진다.
 */
export function interleavePicks<T>(ytPicks: T[], cursorPicks: T[], total: number): T[] {
  const out: T[] = []
  const cap = Number.isFinite(total) ? Math.max(0, total) : 0
  for (let i = 0; i < Math.max(ytPicks.length, cursorPicks.length) && out.length < cap; i++) {
    if (i < ytPicks.length && out.length < cap) out.push(ytPicks[i])
    if (i < cursorPicks.length && out.length < cap) out.push(cursorPicks[i])
  }
  return out
}

/**
 * 🔀 **세 풀(집중·우선·일반)을 라운드로빈으로 병합** — 잘릴 때 공평하게 잘리도록 (2026-08-04).
 *
 * ## 무엇이 고장이었나 (커버리지 붕괴 경보, 라이브 실측)
 * ```
 *   활성 399  ·  never 117  ·  2일+ 206        ← 323개가 이틀째 미실행
 *   회차: planned 16 → processed 5 (spent 56/56, 예산 소진)
 *   24h 실제 실행 54개 = 집중 18 + 나머지 ~36  ← 하루 120슬롯인데 54개뿐
 * ```
 * 옛 코드는 `[...focusPicks, …]` 로 **집중 축을 무조건 앞머리**에 뒀다. 예산이 5개에서 끊기니
 * 집중 4개가 앞자리를 먹고 **일반 풀엔 1개**만 남았다. 게다가 커서 전진은 `prefixDone`
 * (처리된 **앞부분만** 셈)이라 뒤 풀은 잘릴 뿐 아니라 **커서도 안 움직여 다음 회차에 같은 키워드를
 * 또 내놓는다** — 일반 풀(~300개) 한 바퀴에 12일 이상.
 *
 * ## 🗺️ 앞머리의 근거는 이미 낡아 있었다
 * 옛 주석은 *"YT 슬롯(희소)에 확실히 들어가게"* 였는데, 지금 YT 픽은 `pickYtKeywords` 가
 * **전체 키워드에서 따로** 뽑고 호출부는 오히려 그 id 들을 **제외**한다. 앞머리는 YT 에 아무 도움이
 * 안 되면서 일반 풀만 굶기고 있었다(이 레포가 부르는 "낡은 지도").
 *
 * ⚠️ **몫은 안 바꾼다** — 배분은 `planKeywordSplit` 그대로고, 이 함수는 **순서만** 정한다.
 *   집중 풀은 18개뿐이라 회차당 ~2개로도 하루 두 바퀴 이상 돈다(과잉 해소).
 */
export function mergeKeywordPicks<T>(focus: T[], pri: T[], gen: T[]): T[] {
  const out: T[] = []
  for (let i = 0; i < Math.max(focus.length, pri.length, gen.length); i++) {
    if (i < focus.length) out.push(focus[i])
    if (i < pri.length) out.push(pri[i])
    if (i < gen.length) out.push(gen[i])
  }
  return out
}

/**
 * 📉 **네이버 발굴 시점 컨택 보강 상한** (2026-08-04 — 대표 *"수집과 보강 다 잘 되게 하면 안돼?"*).
 *
 * ## 왜 5 → 1 인가 (라이브 실측 — 추측 아님)
 * ```
 *   회차 예산 56 의 내역:  yt 24 · naver 28 · cafe 0 · tistory 4 · save 0
 *   네이버가 54%(28/56)를 쓴다.  그 결과는?
 *
 *   미측정 행(= 순수 수집 결과)의 이메일 보유율
 *     네이버 블로그  1.3%      ← 수집 시점 보강이 만든 전부
 *     유튜브        22.4%     ← 이건 channels.list 응답(공짜)에서 나온다
 * ```
 * **버그가 아니라 산수다**: 키워드당 발굴 ~69명인데 `enrichMax` 5명만 보강 = **7%**.
 * 7% × 홈 수율 25% ≈ 1.8% — 실측 1.3% 와 맞는다. 그리고 **보강 레인은 같은 사람들을 100% 커버**한다
 * (미측정 1.1% → 측정 25.0%, 2026-08-03 실측). ⇒ 수집 시점 네이버 보강은 **어차피 할 일의 7%를
 * 미리 하면서 예산의 절반 이상을 쓰는 중복**이다.
 *
 * ⚠️ **0 이 아니라 1 인 이유**: 경로 자체를 없애면 그 코드가 죽었는지 살았는지 알 수 없게 된다.
 *   1 이면 회차마다 한 명은 지나가므로 `diag.naver` 로 **경로가 살아 있음이 계속 확인**된다.
 *   ⚠️ 유튜브는 **건드리지 않았다** — 22.4% 는 `enrichMax` 가 아니라 `channels.list` 설명에서 나오고
 *   그 몫(영상 스니펫 보충)의 실제 기여는 아직 안 쟀다. 재기 전에 줄이지 않는다.
 */
export const NAVER_COLLECT_ENRICH_MAX = 1

/**
 * 🧊 **회차당 키워드 상한 — "폭 동결"** (2026-08-04, 대표 승인 "①만 진행").
 *
 * ## 왜 남은 예산으로 키워드를 더 돌리지 않는가
 * 위 `NAVER_COLLECT_ENRICH_MAX` 축소로 키워드당 비용이 ~10.4 → ~6 이 된다. 그대로 두면 루프가
 * **자동으로 회차당 5개 → 9개**를 돌아 커버리지가 1.8배가 된다. 매력적으로 들리지만 **지금 하면 손해다**:
 * ```
 *   블로그  유입 3,895/일  vs  측정 4,184/일   →  여유 +289 (백로그 19,963 → 69일)
 *   폭을 1.8배로 넓히면 유입 ~7,000/일  →  백로그가 **매일 +2,800 으로 증가 반전**
 * ```
 * 새 행은 이메일 1.3% 이고 그걸 25% 로 만드는 것이 측정인데, **측정이 병목**이다.
 * ⇒ 폭을 넓히면 행 수만 늘고 **발송 가능 리드는 거의 안 는다.** 지금 병목은 수집이 아니다.
 *
 * ## 🔓 언제 푸는가
 * **측정 처리량이 올라간 뒤.** 그때 이 상수를 올리거나 `ADS_COLLECT_KEYWORD_CAP` 을 세우면
 * 위에서 회수한 예산이 **즉시** 폭으로 전환된다(코드 변경 없이).
 * ⚠️ 측정을 올리는 것 자체는 **네이버 직접 조회 부하**(하루 ~8,000 요청)를 늘리는 일이라
 *   차단 위험 판단이 먼저다 — 숫자 없이 밀지 말 것.
 *
 * 현재값 6 = 실측 처리량 5 보다 살짝 위(정상 변동 흡수), 자동 확대(9)는 차단.
 */
export const COLLECT_KEYWORDS_PER_ROUND = 6

/**
 * 회차당 키워드 상한 — env(`ADS_COLLECT_KEYWORD_CAP`)로 재배포 없이 조정 가능(1~40).
 * ⚠️ 파라미터가 `unknown` 인 이유: 워커 `Env` 타입에 이 키가 선언돼 있지 않아 좁은 구조 타입으로 받으면
 *   **TS2559**("공통 속성이 없다")가 난다. `alarmEnabled(env: unknown)` 과 같은 형태로 맞춘다.
 */
export function keywordsPerRoundCap(env: unknown): number {
  const raw = parseInt(String((env as { ADS_COLLECT_KEYWORD_CAP?: string } | undefined)?.ADS_COLLECT_KEYWORD_CAP ?? ''), 10)
  return Number.isFinite(raw) && raw > 0 ? Math.min(40, raw) : COLLECT_KEYWORDS_PER_ROUND
}

/* ────────────────────────────────────────────────────────────────────────────
 * 🩺 순환 건강 판정 — **한 바퀴를 관측으로 재고**, 상수와 비교하지 않는다 (2026-08-04)
 * ──────────────────────────────────────────────────────────────────────────── */

/** `judgeRotation` 입력 — 전부 D1 한 쿼리에서 나온다(추가 왕복 0). */
export interface RotationSample {
  /** 활성 키워드 수. */
  active: number
  /** 최근 24시간에 순번을 받은 **서로 다른** 키워드 수 = 관측 처리량. */
  ran24h: number
  /** 가장 오래 순번을 못 받은 키워드의 나이(일). 한 번도 안 돈 키워드는 **등록일** 기준. */
  oldestDays: number
  /** 평균 나이(일). 완전한 라운드로빈이면 한 바퀴의 절반이다. */
  avgDays: number
}

export interface RotationVerdict {
  /** 관측 처리량으로 계산한 한 바퀴(일). 처리량 0 이면 `Infinity`. */
  cycleDays: number
  /** 가장 오래 밀린 키워드가 몇 바퀴째 밀렸나. 이상적 라운드로빈이면 ≤1. */
  worstCycles: number
  stalled: boolean
  /** `stopped` = 아예 안 돎 · `starved` = 도는데 특정 꼬리만 계속 건너뜀 · null = 건강. */
  reason: 'stopped' | 'starved' | null
}

/**
 * ⚠️ **왜 "이틀"을 버리는가 — 그 임계는 *성공할 수 없었다*.**
 *
 * 종전 판정은 `활성의 30% 초과가 2일째 미실행` 이었다. 이 값은 키워드 **210개 · 한 바퀴 ~10시간**
 * 시절에 잡은 것이고, 그때는 2일이 한 바퀴의 **다섯 배**라 넘으면 진짜 고장이었다. 그런데 지금
 * 라이브는(2026-08-04 실측):
 *
 * ```
 *   활성 399  ·  24h 실행 61  →  한 바퀴 6.5일
 *   2일 초과 320개(80%)   ← 임계 30% 를 언제나 넘는다
 *   평균 나이 5.68일 ≈ 0.87 바퀴 · 14일 초과 0개   ← 순환은 **정상적으로 돌고 있다**
 * ```
 * **2일이 한 바퀴보다 짧으니, 시스템이 완벽해도 80% 가 "2일째 미실행"이다.** 즉 이 경보는
 * 울리는 것 말고는 할 수 있는 게 없었다 — 이 레포가 반복해 만난 *"실패할 수 없는 가드"* 의 거울상,
 * **해제될 수 없는 경보**다. 매일 울리는 경보는 곧 아무도 안 읽는 경보가 된다.
 *
 * ⚠️ **그리고 이 경보가 시키는 처방이 방향과 반대였다.** 문구는 순환을 더 빨리 돌리라고 하는데,
 *   `CLAUDE.md` 유어애즈 절의 실측은 *유입 1,613/일 vs 측정 3,600/일 — 측정이 이기는 중*이고
 *   그래서 *"처리량을 더 밀지 말 것(네이버 차단 리스크)"* 이다. 발굴을 더 빨리 돌리면 미측정
 *   백로그만 늘어 **목표 지표(발송 가능 리드)를 오히려 늦춘다.**
 *
 * ⇒ 상수 대신 **관측된 한 바퀴**와 비교한다. 두 가지만 진짜 고장이다:
 *   · `stopped`  — 24시간 동안 아무 키워드도 순번을 못 받았다(순환 자체가 멎음).
 *   · `starved`  — 돌고는 있는데 특정 꼬리가 **여러 바퀴째** 건너뛰어진다(라운드로빈이 깨진 것).
 *
 * ⚠️ 배수 3 은 **여유를 둔 값**이다. 실측 최악이 2.21 바퀴(14.46일/6.5일)인데, 몫 배분상
 *   집중·우선 풀이 슬롯을 먼저 가져가므로 일반 풀의 꼬리는 원래 1 바퀴를 넘는다. 2 로 두면
 *   정상 상태에서 울린다(방금 버린 임계와 같은 병). 3 을 넘으면 배분이 아니라 **버그**다.
 * ⚠️ 표본이 작으면(`active < 20`) 판정하지 않는다 — 시드 직후 노이즈.
 */
export const ROTATION_STARVE_CYCLES = 3

/**
 * 🛟 **기아 방지 슬롯** — 라운드당 1픽은 "가장 오래 굶은 미실행 키워드"가 무조건 받는다 (2026-08-04).
 *
 * ## 왜 (라이브 경보 → 실측 — `starved` 판정이 실전에서 처음 잡은 것)
 * ```
 *   자동확장 키워드 24개 · 생성 14.9일 · 실행 0회        ← 전부 source='auto'
 *   pri 풀 315 · 커서 177 · '동네맛집' idx 145 → 거리 275
 *   커서 전진 실측 ~28/일  ⇒  첫 실행까지 약 10일 더
 * ```
 * 이들은 커서 정체기(#1035 이전 — 꼬리 픽이 처리 안 돼 커서가 며칠 제자리)에 태어나 순번을 놓쳤고,
 * 지금은 커서에서 **가장 먼 자리**라 수리 후에도 열흘을 더 기다린다. YT 탐색 슬롯도 못 탄다 —
 * `exploreRank` 가 사람 시드를 앞세우는 건 옳지만, 시드가 계속 유입되는 한 auto 는 **무한 연기**된다
 * (우선순위 스케줄링의 고전적 기아 — aging 없는 strict priority).
 *
 * ## 해법 — 가속이 아니라 **순서 보정**
 * 총 픽 수는 그대로 두고, 라운드당 1픽만 "미실행 중 가장 오래된 것"(id 최소 = 생성순)에게 준다.
 * 24개 잔량이면 실효 라운드 기준 1~3일에 소진되고, 이후로는 **어떤 키워드도 미실행인 채로
 * 풀 한 바퀴 이상을 기다릴 수 없다**(상한이 생김). 커서 수학 무접촉 — 구조는 호출부 주석 참조.
 *
 * ⚠️ **이 함수가 못 하는 것**: "한 번 돌았지만 오래된" 키워드는 구제하지 않는다 — 그건 커서 순환이
 *   정상적으로 처리한다(구제 대상을 넓히면 이 슬롯이 제2의 커서가 되어 진짜 커서를 굶긴다).
 */
export function pickStarvationRescue<T extends { id: number; last_run_at?: string | null }>(
  kws: readonly T[], excludeIds: ReadonlySet<number>,
): T | null {
  let oldest: T | null = null
  for (const k of kws) {
    if (k.last_run_at || excludeIds.has(k.id)) continue
    if (!oldest || k.id < oldest.id) oldest = k   // id 최소 = 가장 먼저 만들어진 미실행
  }
  return oldest
}

export function judgeRotation(s: RotationSample): RotationVerdict {
  const active = Number(s.active) || 0
  const ran = Number(s.ran24h) || 0
  const oldest = Number.isFinite(s.oldestDays) ? Number(s.oldestDays) : 0
  const cycleDays = ran > 0 ? active / ran : Number.POSITIVE_INFINITY
  const worstCycles = Number.isFinite(cycleDays) && cycleDays > 0 ? oldest / cycleDays : Number.POSITIVE_INFINITY
  if (active < 20) return { cycleDays, worstCycles, stalled: false, reason: null }
  if (ran === 0) return { cycleDays, worstCycles, stalled: true, reason: 'stopped' }
  if (worstCycles > ROTATION_STARVE_CYCLES) return { cycleDays, worstCycles, stalled: true, reason: 'starved' }
  return { cycleDays, worstCycles, stalled: false, reason: null }
}
