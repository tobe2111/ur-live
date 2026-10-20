/**
 * 📐 **보강 레인 예산 배분 — 순수 정책** (`influencer-enrich-lane.ts` 에서 분리, 2026-08-04 600줄 래칫).
 *
 *   순수 이동이다. 로직 한 줄도 안 바꿨다 — 분리 사유는 파일 크기뿐이고, 레인이 재수출하므로
 *   기존 import 경로(`influencer-enrich-lane`)는 **무수정**이다(`influencer-keyword-store` 분리와 같은 방식).
 *
 *   여기 있는 건 **DB·fetch·시각을 안 만지는 순수 함수**뿐이다 — 그래서 유닛으로 전부 고정되고,
 *   배분 정책을 바꿀 때 레인 본체(예외 처리·스냅샷·체인)를 읽을 필요가 없다.
 *   ⚠️ 레인의 타입(`EnrichChainRollup` 등)을 참조하는 헬퍼는 **여기 두지 말 것** — 순환 import 가 된다.
 */

export function planInfluencerEnrich(budgetTotal: number): { bioMax: number; naverMax: number; ytMax: number } {
  const usable = Math.max(0, budgetTotal - 4)
  const bioMax = Math.max(0, Math.min(6, Math.floor(usable * 0.15)))
  /**
   * 📈 **YT 몫 0.35 → 0.55** (2026-08-04 라이브 실측 — 대표 승인 "2,3 진행").
   *
   *   근거는 *행 수*가 아니라 **서브리퀘스트당 이메일**이다. YT 는 건당 ~1 fetch, 블로거는 2(RSS+홈).
   *   같은 날 측정된 코호트 수율: **YT 26.7%(1,105→295) · 블로거 21.2%(2,580→547)**
   *   ⇒ 서브리퀘스트당 **0.267 vs 0.106 = 2.5배**. 같은 예산이면 YT 가 두 배 이상 이메일을 낸다.
   *
   *   ⚠️ **머릿수 수율(39% vs 26%)로 판단하면 안 된다** — 그건 *누적* 값이고, 측정이 좋은 채널부터
   *   훑어 온 탓에 **남은 큐에는 그대로 적용되지 않는다**(YT 일별 수율 43.8%→34.7%→26.7% 로 하락 중).
   *   위 숫자는 **같은 날 측정분끼리** 비교한 값이라 그 편향을 피한다. 이 우위는 계속 줄어들 수 있으니
   *   **다시 잴 것**: 두 플랫폼의 같은 날 코호트 수율이 2배 안으로 좁혀지면 이 비율을 되돌린다.
   *
   *   🔁 **과배정은 자동으로 되돌아온다** — YT 큐(현재 2,463행)가 마르면 `enrichYouTubePerformance` 가
   *   0행을 고르고 예산은 그대로 블로거가 쓴다. 상한 20 은 그 함수 내부 `LIMIT min(max,20)` 과 같은 값이라
   *   여기서 더 올려도 효과가 없다(올리려면 그 함수의 LIMIT 도 같이 올려야 한다).
   */
  const ytMax = Math.max(0, Math.min(20, Math.floor(usable * 0.55)))
  const naverMax = Math.max(0, Math.min(30, Math.floor((usable - bioMax - ytMax) / 2)))
  return { bioMax, naverMax, ytMax }
}

export function naverRoomFromRemaining(remaining: number, plannedMax: number): number {
  const left = Number.isFinite(remaining) ? remaining : 0
  const planned = Number.isFinite(plannedMax) ? plannedMax : 0
  const affordable = Math.floor(Math.max(0, left - 1) / 2)
  // 계획분보다 줄이지 않는다 — 앞 레인이 예산을 다 썼을 때 기존 동작으로 안전하게 되돌아간다.
  return Math.max(0, Math.min(30, Math.max(planned, affordable)))
}

/**
 * 📌 **블로거가 선두일 때 YT 몫을 떼어 놓는다** (2026-08-04).
 *
 * ## 무엇이 문제였나 (실측)
 * `naverRoomFromRemaining` 은 `max(planned, affordable)` 이라 **계획분을 이긴다** — 설계상 옳다
 * (앞 레인이 남긴 예산을 버리지 않으려는 것). 그런데 **블로거가 선두인 회차**에는 앞 레인이 아직
 * 아무것도 안 썼으므로 `affordable` 이 예산 전체가 되고, 블로거가 **전부** 가져간다.
 * 그 회차의 YT 는 `budget.left` 가 바닥나 **0행**이다. 즉 `ytMax` 를 아무리 올려도
 * **회차의 절반에서는 한 명도 못 잰다** — 선두 교대(`pickNaverFirst`)와 정면으로 부딪힌다.
 *
 * ⇒ 선두일 때만 **YT 예약분을 뺀 잔여**로 계산한다. 블로거는 여전히 남은 것 전부를 쓰고
 *   (`affordable` 이 예약분만큼만 줄어든다), 시간 바닥(`frontStageDeadline`)도 그대로다.
 *
 * ⚠️ 선두가 아닐 때는 **호출하지 말 것** — 그때는 YT 가 이미 썼으므로 또 빼면 예산을 버린다
 *   (이 레포가 네 번 만난 *"몫을 두 번 빼서 꼬리가 굶는"* 자리).
 */
export function naverRoomWithYtReserve(remaining: number, plannedMax: number, ytReserve: number): number {
  const reserve = Number.isFinite(ytReserve) ? Math.max(0, ytReserve) : 0
  const left = Number.isFinite(remaining) ? remaining : 0
  return naverRoomFromRemaining(Math.max(0, left - reserve), plannedMax)
}
