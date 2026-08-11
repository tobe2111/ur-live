/**
 * ⏰ 기대 cron 식 목록 — **"한 번도 안 돈 것"을 보이게 한다** 〔2026-07-29 신설〕
 *
 * ## 왜 필요했나 (실제 사고)
 *
 * `scheduled.ts` 는 10개 cron 식으로 분기하는데, 라이브 Worker 에는 **3개만 등록돼 있었다**.
 * 그래서 `payouts-generate`(주간 정산 지급)·`d1-backup`(주간 백업)·`toss-refund-retry` 가
 * **한 번도 돈 적이 없었다.** 몇 달간 아무도 몰랐다 — **에러가 안 나기 때문**이다.
 *
 * 기존 감시(`cron-stale-watch` / `getCronHealth`)는 **"뛴 적 있는 게 멈췄나"**만 본다.
 * 한 번도 안 뛴 작업은 하트비트 목록에 **아예 없어서** 침묵 판정 대상에 들어가지도 않는다
 * (실측: 그 상태에서 `missing: []` 이 반환됐다). ⇒ **부재는 침묵과 다르게 생겼다.**
 *
 * ## 설계
 *
 * *기대 목록(정적, 코드에서 옴)* vs *실제 기록(런타임, 하트비트에서 옴)* 을 대조한다.
 * **둘 다 있어야** 판정된다 — 한쪽만으로는 이 사고를 못 잡는다.
 *
 * 목록을 `scheduled.ts` 안이 아니라 여기 두는 이유: `scheduled.ts` 는 번들 cron 게이트가 있는
 * **머니 인접 파일**이라 관측용 상수 때문에 건드리지 않는다. 대신 **드리프트는 테스트가 강제**한다
 * (`cron-expected.test.ts` 가 `scheduled.ts` 의 `cron === '...'` 분기를 파싱해 이 목록과 집합 동일성 검사).
 *
 * ⚠️ **이 모듈이 못 보는 것**: 대시보드의 *실제* 트리거 목록(레포는 못 읽는다).
 *   판정은 **"코드가 기대하는데 한 번도 안 뛴 식"** 까지이고, 원인 확정(미등록인가 / 등록됐는데 실패인가)은
 *   사람이 대시보드를 봐야 한다. 그래도 **"아무도 모르는 상태"는 끝난다.**
 */

/**
 * `scheduled.ts` 가 분기하는 cron 식 전부.
 * ⚠️ `scheduled.ts` 에 분기를 추가/삭제하면 **여기도 같이 고쳐야 한다** — 안 고치면 테스트가 빨강.
 */
export const EXPECTED_CRON_EXPRESSIONS: readonly string[] = [
  '*/5 * * * *',
  '0 0 * * 1',
  '0 18 * * *',
  '0 19 * * *',
  '0 20 * * 0',
]

// 📉 2026-08-11 — 목록이 10 → 5 로 줄었다. **작업이 줄어서가 아니라 반대다.**
//
//   `*` + `/2` · `0 * * * *` · `0 3 * * *` · `0 9 * * *` 네 식은 **등록된 적이 없어 한 번도 안 돌았고**
//   (이 모듈이 잡으려던 바로 그 상태), 계정 cron 트리거 한도가 5개라 늘릴 수도 없었다. 그래서
//   그 블록들을 **살아 있는 5분 틱 위의 분 게이트**로 옮겼다(`worker/cron-slot.ts`) — 작업 29개는
//   그대로 돌고, 식만 사라진 것이다.
//
//   ⚠️ **대신 잃은 것**: 이제 그 작업들의 부재를 *식 단위*로는 못 본다(전부 5분 식으로 보인다).
//     판정은 **작업 단위 하트비트**(`cron_hb:{name}` · `GET /api/admin/cron-heartbeats`)로 넘어갔다 —
//     `slotDue` 의 분이 5분 격자를 벗어나면 그 작업만 조용히 죽는데, 그건 `cron-slot-gate.test.ts`
//     가 5의 배수 강제로 막는다. 두 축이 짝이다.
//
//   ⚠️ 이 주석을 블록주석(/* */)으로 되돌리지 말 것 — cron 식의 `*` + `/` 가 주석을 조기 종료시킨다
//     (2026-08-11 에 실제로 그렇게 깨져 테스트 파일 13개가 트랜스폼 실패했다).

/**
 * 같은 일정의 **다른 표기**. 카노니컬(위 목록) → 별칭.
 *
 * 왜 필요한가: CF 의 day-of-week 는 **1-7 또는 MON-SUN** 이라 `0 20 * * 0` 을 **거부**한다
 * (code 10100 — 그리고 스케줄 PUT 은 원자적이라 이 한 줄이 배열 전체를 막았다).
 * 교정 표기로 등록하면 CF 는 **등록된 문자열 그대로** `event.cron` 에 넣으므로, 디스패처가
 * `0 20 * * 0` 만 보고 있으면 **등록도 됐고 발화도 하는데 아무 핸들러도 안 도는** 상태가 된다.
 * 실패보다 더 안 보이는 상태라 미리 셋 다 받는다.
 *
 * ⚠️ 별칭은 `EXPECTED_CRON_EXPRESSIONS` 에 **넣지 않는다.** 넣으면 한 작업이 never-fired 목록에
 * 3줄로 나와 판정을 오염시킨다. 기대 목록은 *일정 하나당 한 줄*을 유지한다.
 */
export const CRON_EXPRESSION_ALIASES: Readonly<Record<string, string>> = {
  '0 20 * * SUN': '0 20 * * 0',
  '0 20 * * 7': '0 20 * * 0',
}

/** 디스패처가 **받아야 하는** 문자열 전부 = 기대 목록 + 별칭. */
export const ACCEPTED_CRON_EXPRESSIONS: readonly string[] = [
  ...EXPECTED_CRON_EXPRESSIONS,
  ...Object.keys(CRON_EXPRESSION_ALIASES),
]

/** 별칭을 기대 목록의 표기로 되돌린다(드리프트 검사용). */
export function canonicalCron(cron: string): string {
  return CRON_EXPRESSION_ALIASES[cron] ?? cron
}

export interface NeverFiredEntry {
  /** 기대했지만 기록이 0인 cron 식. */
  cron: string
  /** 이 식이 한 번은 돌았어야 하는 시간(분) — 추적 창이 이보다 길어야 판정한다. */
  expected_within_min: number
}

/**
 * **한 번도 안 뛴 cron 식**을 찾는다.
 *
 * @param firedCrons 하트비트에 실제로 기록된 cron 식들(중복 무관)
 * @param trackedMin 하트비트 추적을 시작한 뒤 흐른 시간(분)
 * @param maxAgeOf 식별 기대 최대 간격(분). 없으면(해석 불가) 그 식은 **판정하지 않는다**
 * @param expected 기대 목록(테스트 주입용 — 기본값은 위 상수)
 *
 * 🛡️ **오탐 방지가 이 함수의 핵심**: 주간 작업(`0 0 * * 1`)은 추적 7일이 지나야 "안 뛰었다"고
 *   말할 수 있다. 추적 창이 짧으면 **조용히 판정을 미룬다** — 배포 직후 전건 빨강을 만들지 않는다.
 *   (이 사고를 조사할 때도 추적 창이 4.7시간뿐이라 일간·주간을 "판정 불가"로 남겨야 했고,
 *    그 절제가 실제로 오진을 막았다 — `0 18`·`0 19` 는 등록돼 있었다.)
 */
export function findNeverFired(
  firedCrons: Iterable<string | null | undefined>,
  trackedMin: number,
  maxAgeOf: (cron: string) => number | null,
  expected: readonly string[] = EXPECTED_CRON_EXPRESSIONS,
): NeverFiredEntry[] {
  const fired = new Set<string>()
  for (const c of firedCrons) if (typeof c === 'string' && c) fired.add(c.trim())

  const out: NeverFiredEntry[] = []
  for (const cron of expected) {
    if (fired.has(cron)) continue
    const within = maxAgeOf(cron)
    if (within == null) continue          // 해석 불가 → 모르면 조용히 있는다
    if (!(trackedMin > within)) continue  // 아직 기회가 없었다 → 판정 보류(오탐 방지)
    out.push({ cron, expected_within_min: within })
  }
  return out
}
