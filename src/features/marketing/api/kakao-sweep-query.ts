/**
 * ☎️ **카카오 전화 스윕 — 줄 세우기** (SQL SSOT).
 *
 * ## 왜 별도 모듈인가
 * 이 한 줄(`ORDER BY`)이 곧 처리량 배분이다. 2026-08-04 하루에 두 번 고쳤고 두 번 다
 * **실측을 보고서야** 무엇이 굶고 있었는지 알았다 — 그만큼 자주 틀리는 자리라 테스트가 붙는 곳에 둔다.
 *
 * ## 두 번의 수리
 *
 * ### ① 기아(2026-08-04 오전) — 앞줄이 30일마다 되살아난다
 * ```
 *   ORDER BY tier ASC, id ASC 뿐  →  storeinfo 17,979건이 주소를 100% 갖고도 조회 이력 0건
 *   쿨다운 30일 < 한 바퀴 411일   →  커서가 없는 이 설계에선 앞줄만 무한 반복
 * ```
 * → `(kakao_checked_at IS NOT NULL) ASC` 를 맨 앞에 두어 **미조회 우선**. 이걸로 반복은 끊겼다.
 *
 * ### ② 그런데 그것만으로는 안 닿았다(같은 날 오후, 라이브 재실측)
 * 미조회끼리는 여전히 tier 가 줄을 세워서, 실제 대기열은 이랬다:
 * ```
 *   t1~2 local        867
 *   t3   storeinfo  2,742   ← 여기까지만 닿는다(≈10일)
 *   t4   commerce 111,256   ← 벽
 *   t5   storeinfo 15,518   ← 309일 뒤. 사실상 그대로 굶는다
 * ```
 * "3,500 전화"라고 보고했지만 실제로 닿는 건 2,742건뿐이었다. **tier 를 안 건드렸다고 신중하게
 * 설계해 놓고 기대값은 tier 를 무시한 채 계산한 것** — 축을 늘리는 것만으로는 부족했다.
 *
 * → **소스별 인터리브**(`ROW_NUMBER() OVER (PARTITION BY source …)`). 각 소스의 1등끼리, 2등끼리
 *   묶어 뽑으므로 **큰 소스가 작은 소스를 구조적으로 굶길 수 없다**. 실측 확인: `rn <= 9` 로 뽑으면
 *   storeinfo·market·local·commerce 가 **각 9건씩** 나온다(예전엔 commerce 가 전부 가져갔다).
 *
 * ## 왜 tier 를 뒤집지 않았나 — 무지의 방향을 고쳤다
 * "commerce(통신판매)보다 storeinfo(오프라인 매장)가 먼저여야 하지 않나"는 **추측**이다. 소스별
 * 적중률(조회 대비 전화 확보)을 우리는 **한 번도 재본 적이 없다** — commerce 는 조회를 받은 적이
 * 없으니 낮은지 높은지 알 수가 없다(어제 storeinfo 를 "수율 2.7%라 잘라내자"고 오판한 것과 **같은 함정**:
 * 분모가 처리된 적이 없었다). 인터리브는 **모든 소스가 증거를 만들게** 한다. 증거가 쌓이면 그때
 * 수율로 가중한다 — 키워드 축이 `contactPenalty`(증거 40건 이상일 때만 감점)로 밟은 순서 그대로다.
 *
 * ⚠️ **이 모듈이 못 하는 것**: 처리량(하루 360조회)은 그대로다. 그건 순서가 아니라 CPU 문제다
 *   (`docs/handoff/2026-08-04-tick-cpu-ceiling.md`). 여기서 정하는 건 **그 360을 누구에게 쓰는가**뿐.
 */

/**
 * ### ③ 창 함수가 60건 뽑으려고 31만 행을 정렬하고 있었다 (2026-08-30, 대표 "3,4까지 해줘")
 * ```
 *   회당 rows_read 1,654,670   ×  시간당 1회  =  하루 3,970만 행
 *   그렇게 읽어서 실제로 쓰는 건 60행이다.
 * ```
 * `ROW_NUMBER() OVER (PARTITION BY source …)` 는 **전 대상의 등수를 다 매겨야** 바깥 `LIMIT` 를
 * 적용할 수 있다. 그래서 인덱스를 붙여도 안 준다(실측: 800ms → 453ms, 여전히 전량 정렬).
 *
 * ⇒ **같은 줄 세우기를 SQL 창이 아니라 [소스별 상위 N] + [코드 인터리브]로 만든다.**
 *   등수(`rn`)는 소스별 결과 배열의 **인덱스 그 자체**이므로 계산할 필요가 없다.
 *   로컬 동일 분포 재현: **800ms → 0.6ms, 뽑히는 60행이 순서까지 동일**.
 *
 * ⚠️ **대상 집합(WHERE)과 안쪽 정렬은 여전히 한 글자도 안 건드렸다** — 세 번의 수리에서 계속 그렇다.
 *   바뀐 것은 *같은 답을 어떻게 계산하는가* 뿐이고, 그 동치성은 유닛이 실제 SQLite 로 대조한다.
 * ⚠️ 서브리퀘스트는 1회 → (1 + 소스수)회로 는다. 지금 대상 소스는 3개(commerce·storeinfo·local)라
 *   4회다. 호출부가 그만큼을 예산에서 먼저 뺀다 — 안 빼면 크롤 몫을 조용히 잠식한다.
 */

/**
 * 🎯 **대상 집합** — ①②③ 세 번의 수리에서 **한 번도 안 건드렸다**. 넓히거나 좁힌 적이 없다.
 */
export const KAKAO_SWEEP_WHERE =
  `merged_into IS NULL AND (phone IS NULL OR phone = '') AND address IS NOT NULL AND address != ''
     AND (kakao_checked_at IS NULL OR kakao_checked_at < datetime('now', '-30 days'))`

/**
 * 🪜 **소스 안에서의 줄 세우기**: 미조회 → 연락처 없음 → tier → id.
 *   ②는 이미 이메일이 있어 부를 수 있는 리드에 희소한 조회를 안 쓰기 위한 것 —
 *   목표는 조회 수가 아니라 *부를 수 있는 사람 수*다.
 */
export const KAKAO_SWEEP_INNER_ORDER =
  `(kakao_checked_at IS NOT NULL) ASC, (email IS NOT NULL AND email <> '') ASC, (tier IS NULL) ASC, tier ASC, id ASC`

/**
 * 🔎 지금 대상이 있는 소스들. **코드에 목록을 박지 않는다** — 박으면 새 수집기가 소스를 하나 더
 *   만들었을 때 그 소스가 **영원히 굶는다**(이 파일이 두 번 고친 사고가 정확히 그 모양이었다).
 *
 * 🩸 **여기 있던 "실측 0.0ms" 는 틀렸다**(2026-08-30 배포 후 라이브 재측정 — 정정).
 *   로컬 소규모 데이터에서 나온 값을 그대로 옮겨 적은 것이고, 라이브에서는 **355,231행**을 읽는다.
 *   이유: 30일 쿨다운(`kakao_checked_at < now-30d`)이 부분 인덱스의 조건에 **없어서** 인덱스를
 *   선두 컬럼으로 건너뛰지 못하고 전 엔트리를 훑는다. 쿨다운을 인덱스 조건에 넣을 수도 없다
 *   (`datetime('now')` 는 비결정적이라 부분 인덱스에 못 쓴다).
 *   ⚠️ 쿨다운을 빼고 재 봐도 **같은 355,230행**이었다 — SQLite 가 DISTINCT 를 선두 컬럼 skip-scan
 *   으로 최적화해 주지 않는다. 즉 쿼리를 다듬어서 줄일 수 있는 종류가 아니다.
 *
 * ⇒ 그래서 **결과를 캐시한다**(아래 `shouldRefreshSources`). 소스 집합은 회차마다 달라지는 값이
 *   아니다 — 새 수집기가 생길 때만 바뀐다.
 */
export const KAKAO_SWEEP_SOURCES_SQL =
  `SELECT DISTINCT source FROM ad_company_leads WHERE ${KAKAO_SWEEP_WHERE}`

/**
 * ⏳ **소스 목록 캐시의 수명.** 짧게 잡을 이유가 없고(집합은 거의 안 바뀐다), 길게 잡으면
 *   새 수집기의 소스가 그만큼 늦게 발견된다 — 그게 이 값이 정하는 유일한 트레이드오프다.
 *   6시간이면 하루 24회 → 4회. 회당 35.5만 행이므로 하루 **852만 → 142만 행**.
 *
 * ⚠️ **0 이나 무한대로 만들지 말 것**: 0 이면 캐시가 없는 것과 같고(=원래 비용으로 복귀),
 *   무한대면 새 소스가 **영원히 굶는다** — 이 파일이 두 번 고친 바로 그 사고다.
 */
export const SWEEP_SOURCES_TTL_MS = 6 * 3_600_000

/** 캐시된 소스 목록의 모양. 스윕 통계 블롭(`ads_kakao_sweep_stats`)에 얹혀 다닌다 — 추가 쿼리 0. */
export interface CachedSweepSources { sources: string[]; at: number }

/**
 * 캐시가 쓸 만한가. **모양이 조금이라도 이상하면 새로 조회한다**(빈 배열·숫자 아닌 시각·미래 시각).
 * 조용히 빈 목록으로 진행하면 "대상이 없다"로 기록되고 레인이 아무 일도 안 한 채 성공으로 보인다.
 */
export function parseSweepSources(blob: Record<string, unknown> | null | undefined): CachedSweepSources | null {
  if (!blob) return null
  const raw = blob.sources
  const at = Number(blob.sources_at)
  if (!Array.isArray(raw) || raw.length === 0) return null
  if (!Number.isFinite(at) || at <= 0) return null
  const sources = raw.filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (sources.length !== raw.length) return null
  return { sources, at }
}

/** 지금 다시 조회해야 하는가 — 캐시가 없거나, 깨졌거나, TTL 을 넘겼거나, 시각이 미래면. */
export function shouldRefreshSources(cached: CachedSweepSources | null, nowMs: number): boolean {
  if (!cached) return true
  const age = nowMs - cached.at
  return age < 0 || age >= SWEEP_SOURCES_TTL_MS
}

/** 한 소스의 상위 N. `?`=source, `?`=N. 인덱스가 이 정렬을 그대로 담아 앞에서 N개만 걷고 멈춘다. */
export const KAKAO_SWEEP_PER_SOURCE_SQL =
  `SELECT id, company_name, region, address, source, tier FROM ad_company_leads
    WHERE source = ? AND ${KAKAO_SWEEP_WHERE}
    ORDER BY ${KAKAO_SWEEP_INNER_ORDER} LIMIT ?`

/** 스윕이 읽어 오는 행 모양. `source` 는 소스별 적중률 계측용(다음 단계의 가중치 근거). */
export interface KakaoSweepRow {
  id: number
  company_name: string
  region: string | null
  address: string
  source: string | null
  /** 인터리브의 동률 판정에 쓴다(같은 등수끼리는 tier → id). 예전 바깥 `ORDER BY` 와 같은 규칙. */
  tier?: number | null
}

/**
 * 🔀 **소스 사이의 줄 세우기** — 각 소스의 1등끼리, 2등끼리 묶어 뽑는다. 큰 소스가 작은 소스를
 * 구조적으로 굶길 수 없게 하는 장치이고, 예전 SQL 의 `ORDER BY rn ASC, (tier IS NULL), tier, id` 와
 * **같은 답**을 낸다(등수 = 배열 인덱스).
 *
 * ⚠️ 동률(같은 등수) 안의 순서를 tier → id 로 두는 것이 핵심이다. 빼면 소스 삽입 순서가 순위를
 *   정하게 되어, 대상이 많은 소스가 늘 앞자리를 가져간다(=예전 기아로 되돌아간다).
 */
export function interleaveBySource(perSource: KakaoSweepRow[][], limit: number): KakaoSweepRow[] {
  const out: KakaoSweepRow[] = []
  const deepest = perSource.reduce((m, a) => Math.max(m, a.length), 0)
  for (let rank = 0; rank < deepest && out.length < limit; rank++) {
    const tie = perSource.map(a => a[rank]).filter(Boolean) as KakaoSweepRow[]
    tie.sort((a, b) => {
      const an = a.tier == null ? 1 : 0, bn = b.tier == null ? 1 : 0
      if (an !== bn) return an - bn
      if (an === 0 && a.tier !== b.tier) return (a.tier as number) - (b.tier as number)
      return a.id - b.id
    })
    for (const r of tie) { if (out.length >= limit) break; out.push(r) }
  }
  return out
}

/**
 * 📊 소스별 시도/적중 누적 — **다음 단계(수율 가중)의 유일한 근거**다.
 *   지금은 아무 판정에도 안 쓴다. 증거 없이 가중하면 어제의 오판을 반복하게 된다.
 */
export type SweepSourceTally = Record<string, { tried: number; found: number }>

/** 한 건의 결과를 소스 칸에 더한다(소스가 비면 `unknown`). */
export function tallySweep(t: SweepSourceTally, source: string | null | undefined, found: boolean): void {
  const k = source || 'unknown'
  const cur = t[k] || (t[k] = { tried: 0, found: 0 })
  cur.tried += 1
  if (found) cur.found += 1
}
