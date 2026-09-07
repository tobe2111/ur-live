/**
 * 어필리에이트(담아서 팔면 적립) 프로그램이 켜져 있는가 — **표시 게이트**
 *
 * 🩸 2026-09-06: 이 프로그램은 2026-08-22 대표 확정("어필리에이트 전략은 빼려고 해. 심플하게")으로
 *   꺼졌다. 지급 경로(`affiliate-credit.ts creditAffiliateForOrder`)는 스위치를 보고 즉시
 *   `PROGRAM_DISABLED` 로 돌아선다. **그런데 화면은 그 스위치를 몰랐다.**
 *
 *   그전까지는 우연히 안 들켰다 — 유어샵 배지가 적립률 단위를 잘못 읽어(분수를 퍼센트로) 늘 0 이 나와
 *   아예 안 떴기 때문이다. 2026-09-05 에 그 단위 버그를 고치자 **꺼진 프로그램의 적립이 화면에 뜨기
 *   시작했다**("쓰면 2%"). 버그가 다른 버그를 가려 주고 있었던 셈이고, 하나를 고치자 다른 하나가 드러났다.
 *
 * ⚠️ **fail-closed** — 설정을 못 읽으면 `false`(안 보여 준다). 확인 못 한 돈을 약속하는 것보다
 *   배지가 안 뜨는 쪽이 낫다. (지급 경로도 같은 방향으로 닫힌다.)
 *
 * 💰 **비용**: 목록 API 는 엣지 캐시되는 핫 경로라 요청마다 설정을 읽으면 안 된다 →
 *   isolate 모듈 메모 + 60초 TTL. 워밍된 isolate 에서는 D1 읽기 0.
 */

/** key: D1 인스턴스, value: [판정, 만료 ms] */
const _memo = new WeakMap<D1Database, [boolean, number]>()
const TTL_MS = 60_000

export function _resetAffiliateProgramMemo(DB: D1Database): void {
  _memo.delete(DB)
}

export async function isAffiliateProgramEnabled(DB: D1Database): Promise<boolean> {
  const hit = _memo.get(DB)
  if (hit && hit[1] > Date.now()) return hit[0]
  let on = false
  try {
    const row = await DB.prepare(
      "SELECT value FROM platform_settings WHERE key = 'affiliate_program_enabled'"
    ).first<{ value: string }>()
    on = row?.value === 'true'   // 행 부재 = 꺼짐 (affiliate-credit.ts 와 동일 판정)
  } catch {
    on = false                    // 못 읽으면 약속하지 않는다
  }
  _memo.set(DB, [on, Date.now() + TTL_MS])
  return on
}

/**
 * 프로그램이 꺼져 있으면 행의 `referral_enabled` 를 0 으로 눕힌다.
 * 화면 SSOT(`shared/affiliate-rate.ts effectiveAffiliateRate`)가 0 을 '적립 없음'으로 읽어
 * 배지를 감춘다 — **클라이언트 변경 없이** 세 화면이 한 번에 정직해진다.
 */
export function gateAffiliateRows<T>(rows: T[], programOn: boolean): T[] {
  if (programOn) return rows
  for (const r of rows) {
    const o = r as unknown as { referral_enabled?: unknown }
    if (o.referral_enabled !== undefined) o.referral_enabled = 0
  }
  return rows
}
