/**
 * 🩺 **수확 0 이 오래 지속되는 레인을 드러낸다** (2026-08-02 라이브 실측 후 신설).
 *
 * ## 무엇이 안 보였나 (실측)
 * ```
 *   collect-hira   총 60회 실행 · total_saved 0 · diag.error "네트워크 오류: timeout"
 *   collect(인허가) 총 27회 실행 · total_saved 0 · diag.error "API: HTTP 500"
 *   하트비트:      ads:collect-hira  ok=true  ms=25750      ← 초록이다
 * ```
 * **60회를 돌아 한 건도 못 캤는데 어디서도 빨간불이 아니다.** 하트비트는 "예외 없이 끝났는가"만 보고,
 * 레인은 실패를 `diag.error` 에 얌전히 적고 정상 종료하기 때문이다. 이 레포가 반복해 만난
 * *"부재는 침묵과 다르게 생겼다"* 클래스이고, 지금은 그 침묵이 **대표 우선순위를 잠식**한다 —
 * 죽은 레인도 살아 있는 레인과 **똑같이 회차 순번을 나눠 갖는다**(같은 도메인 예산).
 *
 * ## 왜 새로 만들었나 — 기존 경보는 한 레인 전용이었다
 * `collect-health-alert.ts` 가 이미 있지만 **호출부가 `influencer-auto-collect` 하나뿐**이고
 * 그 레인의 진단 모양(`{yt, naver, tistory}`)에 묶여 있다. 공공데이터·매장 레인 6종은 무방비였다.
 * 이건 "기능이 없다"가 아니라 **"기능이 한 곳만 쓴다"** 이다.
 *
 * ## 🛡️ 오경보를 안 내는 규칙 (2026-07-23 의 교훈을 그대로 승계)
 * **발굴은 되는데 저장이 0** 인 것은 **정상**이다 — 풀이 포화돼 전부 중복이면 그렇게 된다.
 * 그래서 `saved === 0` 만으로는 절대 불건강으로 보지 않고, **`found` 까지 0** 일 때만 본다.
 * (기존 경보가 같은 이유로 판정식을 고쳤다. 두 곳이 다른 규칙을 쓰면 한쪽이 반드시 틀린다.)
 *
 * ## ⚠️ 이 판정이 **하지 않는 것**
 * - 레인을 **끄지 않는다.** 자동 비활성은 되돌리기 어렵고, 외부 API 의 일시 장애와 영구 장애를
 *   이 신호만으로는 못 가른다. 여기서는 **보이게만** 하고 판단은 사람이 한다.
 * - 원인을 진단하지 않는다. `diag.error` 원문을 **그대로 옮길 뿐** 해석하지 않는다(허위 0).
 *
 * ## 📊 왜 이게 한 레인의 문제가 아닌가 (2026-08-02 전수 프로브)
 * 6개 공공 소스를 한 번에 찔러 보니 **셋이 같은 오류로 죽어 있었다**:
 * ```
 *   ✅ commerce-status  200 · totalCount 2,649,436     ✅ commerce-detail  200 · 2,725,361
 *   🔴 franchise 400 · NO_OPENAPI_SERVICE_ERROR   🔴 nara 400 · 〃   🔴 localdata 400 · 〃
 *   ⚠️ nps 503 · SERVICETIMEOUT_ERROR(일시)
 * ```
 * **같은 서비스키로 commerce 는 200** 이므로 키가 아니라 **주소** 문제다. 그리고 이것이 풀 구성을
 * 그대로 설명한다 — 파트너 175,139건 중 commerce 가 **151,417건(86%)**, 매장 46,182건 중 학원이
 * **97%**. *유일하게 살아 있는 소스가 그것들이기 때문*이다. 죽은 레인은 매일 순번만 쓰고 0건을 남긴다.
 */

/** 레인이 `platform_settings` 에 남기는 통계의 공통 부분만 본다(레인마다 나머지 필드는 다르다). */
export interface LaneYieldStat {
  found?: number
  saved?: number
  total_runs?: number
  total_saved?: number
  last_run?: string
  diag?: { configured?: boolean; error?: string } | null
}

export interface LaneYieldVerdict {
  lane: string
  /** 사람이 읽는 한 줄 — 화면에 그대로 띄운다. */
  message: string
  severity: 'dead' | 'warn'
  runs: number
  error?: string
}

/** 이 횟수 이상 돌고도 누적 저장이 0 이면 "한 번도 성공한 적 없다"로 본다.
 *  ⚠️ 낮추면 이제 막 켠 레인이 첫 회차부터 빨간불이 된다(설정 직후의 정상 상태를 사고로 오인). */
export const DEAD_AFTER_RUNS = 5

/**
 * 한 레인의 수확 건강을 판정한다. 건강하면 `null`.
 *
 * @param lane  화면에 띄울 레인 이름(하트비트 이름과 같게 두면 대조하기 쉽다)
 * @param stat  그 레인이 남긴 통계 스냅샷
 */
export function judgeLaneYield(lane: string, stat: LaneYieldStat | null | undefined): LaneYieldVerdict | null {
  if (!stat) return null
  const runs = Number(stat.total_runs) || 0
  const totalSaved = Number(stat.total_saved) || 0
  const found = Number(stat.found) || 0
  const err = String(stat.diag?.error || '').trim() || undefined

  // 🚫 미설정(키 없음)은 이 판정의 대상이 아니다 — 그건 '고장'이 아니라 '안 켰다'이고 다른 화면이 이미 말한다.
  if (stat.diag && stat.diag.configured === false) return null

  // ⛔ 한 번도 성공한 적 없다 — 누적 저장이 0 인 채로 충분히 여러 번 돌았다.
  if (runs >= DEAD_AFTER_RUNS && totalSaved === 0) {
    return {
      lane, runs, error: err, severity: 'dead',
      message: `${runs}회 실행했는데 저장이 0건입니다${err ? ` — ${err}` : ''}. 이 레인은 같은 도메인의 다른 레인과 회차 순번을 나눠 갖습니다.`,
    }
  }

  // ⚠️ 누적은 있는데 **이번 회차가 발굴조차 0** + 오류 원문이 남았다.
  //   🛡️ `found > 0` 이면 저장 0 이어도 정상이다(전부 중복 = 풀 포화). 그 오경보를 안 내는 게 이 조건의 핵심.
  if (totalSaved > 0 && found === 0 && err) {
    return { lane, runs, error: err, severity: 'warn', message: `직전 회차 발굴 0건 — ${err}` }
  }
  return null
}

/** 여러 레인을 한 번에. 건강한 레인은 결과에 없다(화면이 "이상 없음"을 스스로 판단하게). */
export function judgeLanes(entries: Array<{ lane: string; stat: LaneYieldStat | null | undefined }>): LaneYieldVerdict[] {
  return entries.map(e => judgeLaneYield(e.lane, e.stat)).filter((v): v is LaneYieldVerdict => v !== null)
}
