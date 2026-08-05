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
 * 대기열 한 묶음. `?` = 읽을 행 수(`rowsWorthReading` 이 예산에서 유도).
 *
 * - **안쪽 정렬(소스 내부)**: 미조회 → 연락처 없음 → tier → id.
 *   ②는 이미 이메일이 있어 부를 수 있는 리드에 희소한 조회를 안 쓰기 위한 것 —
 *   목표는 조회 수가 아니라 *부를 수 있는 사람 수*다.
 * - **바깥 정렬(소스 사이)**: `rn` 먼저 = 인터리브. 같은 `rn` 안에서는 tier 가 앞자리를 정한다.
 * - 🔒 `WHERE` 는 ①·② 두 수리에서 **한 번도 안 건드렸다** — 대상 집합을 넓히거나 좁힌 적이 없다.
 */
export const KAKAO_SWEEP_SQL =
  `SELECT id, company_name, region, address, source FROM (
     SELECT id, company_name, region, address, source, tier,
            ROW_NUMBER() OVER (PARTITION BY source ORDER BY
              (kakao_checked_at IS NOT NULL) ASC,
              (email IS NOT NULL AND email <> '') ASC,
              (tier IS NULL) ASC, tier ASC, id ASC) AS rn
       FROM ad_company_leads
      WHERE merged_into IS NULL AND (phone IS NULL OR phone = '') AND address IS NOT NULL AND address != ''
        AND (kakao_checked_at IS NULL OR kakao_checked_at < datetime('now', '-30 days'))
   ) ORDER BY rn ASC, (tier IS NULL) ASC, tier ASC, id ASC LIMIT ?`

/** 스윕이 읽어 오는 행 모양. `source` 는 소스별 적중률 계측용(다음 단계의 가중치 근거). */
export interface KakaoSweepRow {
  id: number
  company_name: string
  region: string | null
  address: string
  source: string | null
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
