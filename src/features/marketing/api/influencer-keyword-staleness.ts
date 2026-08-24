/**
 * ⏳ **순환 선택 — 위치가 아니라 "얼마나 굶었나"로 고른다** (2026-08-24 대표 *"순환 편식은 수리해"*).
 *
 * ## 무엇이 고장나 있었나 (라이브 실측 2026-08-24)
 * ```
 *   활성 키워드 658 · 회차당 처리 7.8 · 시간당 1회차  ⇒  한 바퀴 3.5일이어야 한다
 *   실제:  평균 미실행 5.6일 · 최악 28.1일 · 7일+ 밀린 키워드 168개(26%)
 *   축별:  집중 25개인데 최악 13.6일 — 이 축은 한 바퀴가 ~1일이어야 하는 크기다
 * ```
 * 집중 축이 결정적 증거다. 키워드 25개에 하루 24회차면 **못 도는 게 불가능**한데 13.6일이 나왔다.
 * ⇒ 예산 부족도 회차 부족도 아니고 **선택 자체가 공평하지 않았다.**
 *
 * ## 원인 — *변하는 목록*에 대한 *위치 커서*
 * 옛 선택은 `pool[(cursor + i) % pool.length]` 였다. 그런데 그 `pool` 은 **회차마다 구성도 길이도 바뀐다**:
 *   · `suppressLowRotationYield` 가 5회차 중 4회차는 저수율 키워드를 빼고 준다(길이가 오르내린다)
 *   · 승격/은퇴가 멤버십을 바꾼다 — 새 키워드는 `id ASC` 라 **항상 끝에 붙는다**
 * 길이가 20↔25 로 오가면 커서 18 은 회차마다 **다른 키워드**를 가리킨다. 두 수열이 엇갈려 어떤 자리는
 * 반복해 방문되고 어떤 자리는 영영 안 걸린다 — 이게 "편식"의 정체다. 커서는 자기가 무엇을 건너뛰었는지
 * 모르고, 건너뛴 사실이 다음 회차에 아무 흔적도 남기지 않는다.
 *
 * ## 처방 — 자기교정되는 기준으로 바꾼다
 * "가장 오래 굶은 것부터." 건너뛰어진 키워드는 **더 굶어서 앞으로 나온다.** 풀 길이가 어떻게 변하든,
 * 새 키워드가 어디에 붙든, 예산이 어디서 끊기든 상한이 생긴다. 부수 효과 둘:
 *   · 예산 소진으로 처리 못 한 픽은 `last_run_at` 이 안 갱신되므로 **다음 회차에 자동으로 맨 앞**이다
 *     — 옛 `prefixDone` 커서 전진이 하던 일을 구조가 대신한다(별도 장치가 필요 없다).
 *   · 미실행(`last_run_at IS NULL`)은 나이 ∞ 라 항상 1순위 — `pickStarvationRescue` 는 이제 **백스톱**이다.
 *
 * ## ⚠️ 왜 저수율에 할인을 두는가 (이걸 빼면 조용한 회귀가 난다)
 * 나이순으로만 고르면 억제(`suppressLowRotationYield`)가 **무력화된다.** 저수율 키워드는 4/5 회차를
 * 건너뛰므로 남들보다 항상 더 늙어 있고, 탐침 회차마다 맨 앞을 싹쓸이한다. 그러면 억제 이전과 같은
 * 비율(=억제가 아무 일도 안 함)로 수렴한다 — 이 레포가 반복해 만든 **"죽은 손잡이"** 그대로다.
 *
 * 그래서 나이에 배율을 곱해 **순번을 늦춘다**. 값은 발명하지 않고 **지금 실측된 비율을 보존**한다:
 * ```
 *   저수율 72개 평균 8.35일  ·  나머지 586개 평균 5.24일   →   비율 1.59
 *   할인 0.6  ⇒  저수율은 남들의 1/0.6 ≈ 1.67배 늙어야 순번이 온다
 * ```
 * ⇒ 이번 변경은 **공평성 하나만** 바꾼다. 저수율에 배정되는 몫은 오늘과 같게 둔다(고칠 게 있으면
 *   그건 별도 판단이고, 두 가지를 한 번에 바꾸면 어느 쪽이 효과였는지 영영 못 가린다).
 *
 * ⚠️ 이 모듈이 **못** 하는 것: 축 간 몫(3:2:1)은 `planKeywordSplit` 이 정한다. 여기는 *한 축 안의 순서*만
 *   본다. 축 하나가 통째로 굶는 건 이 파일이 아니라 그 함수와 `carry` 가 막는다.
 */
import { isLowRotationYield, type RotationYieldRow } from './influencer-keyword-yield'

/**
 * 저수율 키워드의 나이 배율(0~1). 1 이면 할인 없음(= 억제 무력화), 0 이면 영구 배제.
 * 근거는 위 docblock — 라이브 실측 비율 1.59 를 보존하는 값이다.
 */
export const LOW_YIELD_STALENESS_DISCOUNT = 0.6

export type StalenessRow = RotationYieldRow & { id: number; last_run_at?: string | null }

/**
 * D1 의 `datetime('now')` 는 **`Z` 없는 UTC 문자열**(`'2026-08-24 01:02:03'`)이다. 그대로
 * `new Date(...)` 에 넣으면 런타임 TZ 로 해석돼 9시간이 어긋난다(이 레포의 상습 사고 클래스).
 * 여기서는 명시적으로 UTC 로 못박아 파싱한다. 파싱 불가/부재는 `null`(= 미실행 취급).
 */
export function runAtMs(raw: string | null | undefined): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const iso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s) ? `${s.replace(' ', 'T')}Z` : s
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

/**
 * 유효 나이(ms) — 클수록 먼저 뽑힌다. 미실행은 `Infinity`.
 * ⚠️ 시계 역행(마지막 실행이 미래)은 0 으로 눌러 음수 나이가 순번을 뒤집지 못하게 한다.
 */
export function effectiveAgeMs(k: StalenessRow, nowMs: number): number {
  const ran = runAtMs(k.last_run_at)
  if (ran == null) return Number.POSITIVE_INFINITY
  const age = Math.max(0, nowMs - ran)
  return isLowRotationYield(k) ? age * LOW_YIELD_STALENESS_DISCOUNT : age
}

/**
 * 가장 오래 굶은 `n` 개. 동률은 `id` 오름차순(= 먼저 만들어진 것 우선 — 결정적 순서).
 * `n` 이 풀보다 크면 풀 전체를 준다(슬롯을 버리지 않는다 — `planKeywordSplit` 불변식 ②와 같은 방향).
 */
export function pickStalest<T extends StalenessRow>(pool: readonly T[], n: number, nowMs: number): T[] {
  const want = Math.max(0, Math.min(Math.floor(n) || 0, pool.length))
  if (!want) return []
  const scored = pool.map(k => ({ k, age: effectiveAgeMs(k, nowMs) }))
  // ⚠️ `b.age - a.age` 로 쓰면 미실행끼리(∞ − ∞ = NaN) 비교가 무너져 순서가 엔진 마음대로가 된다.
  //    비교는 뺄셈이 아니라 부등호로 — 그래야 ∞ 가 섞여도 결정적이다.
  scored.sort((a, b) => (a.age === b.age ? a.k.id - b.k.id : (a.age > b.age ? -1 : 1)))
  return scored.slice(0, want).map(s => s.k)
}
