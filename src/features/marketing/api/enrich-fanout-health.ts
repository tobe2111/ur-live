/**
 * 🪂 **팬아웃은 "띄웠다"만 안다 — 착지했는지는 다음 회차에 안다.**
 *
 * ## 왜 (2026-08-02 라이브 실측)
 * `/__ads/enrich-influencer-driver` 는 조각 K개를 띄우고 **즉시** 반환한다. 그 파일이 스스로
 * 주석에 적어 둔 그대로다 — *"이 응답은 '띄웠다'만 뜻한다."* 문제는 그 즉시 응답으로 **부모가
 * `ok=true 0ms` 하트비트를 찍는다**는 것이다.
 *
 * 실측:
 * ```
 *   ads:enrich-influencer-driver   ok=true  0ms      ← 하트비트는 초록
 *   enrich_lane.last_run           18:10 UTC (6시간 정지)
 *   total_measured                 10,498 → 10,630   (6시간에 +132)
 * ```
 * 자식이 CPU 한도로 전멸해도 화면은 **초록**이다. 어제 하루 종일 싸운
 * *"침묵이 성공처럼 보인다"* 가 **관측 계층 한 겹 위에서 재발**한 것이다.
 *
 * ## 그래서 무엇을 하나
 * 팬아웃이 뜰 때 **그 순간의 레인 스냅샷 시각**을 함께 적어 둔다. 다음 팬아웃 때 그 값과 현재
 * 스냅샷을 비교하면 **"지난번에 띄운 것이 실제로 뭔가를 했는가"** 가 판정된다.
 *
 * ⚠️ 이 판정은 **한 회차 늦다**(팬아웃 시점엔 자식이 아직 안 끝났으므로). 그게 이 구조의 한계이고,
 *   그래서 "지난 회차"를 본다. 즉시 판정하려면 자식이 완료를 세는 카운터가 필요한데, 그건 D1 쓰기가
 *   자식 수만큼 늘어 지금 문제(예산)를 키운다.
 *
 * ⚠️ **못 보는 것**: 자식 일부만 죽는 경우. 하나라도 착지하면 `landed=true` 다. 전멸만 잡는다.
 *   부분 실패는 `total_measured` 증가폭으로 봐야 한다(그 수치는 스냅샷에 이미 있다).
 */

/** 팬아웃 1회 기록. `platform_settings.ads_enrich_fanout_last` 에 JSON 으로 저장된다. */
export interface FanoutStamp {
  /** 팬아웃을 띄운 시각(ISO). */
  at: string
  /** 띄운 조각 수. */
  k: number
  /** 각 조각이 계획한 라운드 수. */
  planned: number
  /** **띄우기 직전** 레인 스냅샷의 `last_run` — 다음 회차가 이 값과 비교해 착지를 판정한다. */
  lane_before: string | null
}

export interface FanoutVerdict {
  /** 직전 팬아웃이 실제로 뭔가를 남겼는가. 판정 불가면 null(첫 실행·기록 손상). */
  landed: boolean | null
  /** 사람이 읽는 이유 — 하트비트 result 에 실린다. */
  reason: string
}

/**
 * 직전 팬아웃이 착지했는지 판정한다.
 *
 * @param prev  직전 팬아웃 기록(없으면 첫 실행)
 * @param laneLastRun  **지금** 레인 스냅샷의 `last_run`
 *
 * 규칙: 직전 팬아웃 이후 레인 스냅샷이 **한 번도 안 움직였으면** 그 팬아웃은 아무것도 못 했다.
 * ⚠️ 문자열 비교로 충분하다 — `last_run` 은 같은 포맷(`YYYY-MM-DD HH:MM:SS`)으로만 쓰인다.
 *   파싱해서 비교하면 UTC-naive 해석 실수(이 레포 실사고 4건 클래스)를 새로 들일 뿐이다.
 */
export function judgeFanout(prev: FanoutStamp | null | undefined, laneLastRun: string | null): FanoutVerdict {
  if (!prev || typeof prev.at !== 'string') return { landed: null, reason: '첫 팬아웃 — 비교할 직전 기록 없음' }
  if (!laneLastRun) return { landed: false, reason: '레인 스냅샷 자체가 없다 — 한 번도 착지한 적 없음' }
  if (prev.lane_before === undefined) return { landed: null, reason: '직전 기록에 비교 기준(lane_before)이 없다' }
  if (laneLastRun === prev.lane_before) {
    return { landed: false, reason: `직전 팬아웃(${prev.at}, k=${prev.k}) 이후 레인 스냅샷이 그대로다 — 자식이 아무것도 못 했다` }
  }
  return { landed: true, reason: `직전 팬아웃 이후 스냅샷 전진(${prev.lane_before} → ${laneLastRun})` }
}

/**
 * 하트비트에 실을 결과 객체.
 *
 * 🔴 **`ok` 를 뒤집는다** — 이게 이 파일의 요점이다. 필드만 추가하면 화면은 여전히 초록이고,
 * 그러면 "침묵이 성공처럼 보인다"를 못 고친 것이다. **직전 팬아웃이 전멸했으면 이번 하트비트는
 * 빨강**이어야 기존 stale-watch·경보가 잡는다.
 *
 * ⚠️ 판정 불가(`landed === null`)는 빨강으로 만들지 않는다 — 첫 실행마다 우는 경보는 곧 무시된다.
 */
export function fanoutBeatResult(k: number, planned: number, verdict: FanoutVerdict): { ok: boolean; result: Record<string, unknown> } {
  return {
    ok: verdict.landed !== false,
    result: { fanout: k, planned, prev_landed: verdict.landed, why: verdict.reason },
  }
}
