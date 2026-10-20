/**
 * ⏰ 죽은 cron 슬롯을 **살아 있는 `*​/5` 틱 위에서** 원래 주기로 되살린다.
 *
 * ## 왜 필요한가
 *
 * Cloudflare 는 **`wrangler.toml` 에 적힌 표현식만** 발화한다. 그런데 이 레포의 `scheduled.ts` 에는
 * `if (cron === '0 * * * *')` 처럼 **등록되지 않은 슬롯**이 여럿 있었고, 그 안의 작업들은
 * 에러도 하트비트도 없이 **그냥 안 돌았다**(2026-08-11 실측: 죽은 슬롯 5개 / 작업 29개).
 * 배포는 늘 초록불이라 아무도 몰랐다 — 이 레포가 반복해 만난 *"실패가 아니라 조용한 부재"* 클래스다.
 *
 * 트리거를 더 만들면 되지만 **계정 한도가 5개**이고 이미 5개를 다 쓰고 있다(ur-live 4 + ur-ads 1).
 * 그래서 이미 도는 `*​/5` 틱에서 **분·시·요일을 보고 게이트**한다. 같은 파일의 `ops-daily-digest`
 * 가 2026-08-03 에 쓴 것과 같은 수법이고, 여기서는 그걸 재사용 가능한 순수함수로 뽑았다.
 *
 * ## 분을 서로 다르게 주는 이유 (중요)
 *
 * `safeCron` 들은 **같은 인보케이션**에서 돌아 **서브리퀘스트 예산(무료 50)을 나눠 쓴다.**
 * 부활시킬 작업 29개를 한 분에 몰면 예산이 터져 뒤쪽 작업이 조용히 잘린다 — 2026-08-04 에
 * B2B 레인 3개가 정확히 그렇게 죽었다. 그룹마다 **다른 분**을 주면 각자 **다른 인보케이션**이라
 * 예산도 따로 받는다.
 *
 * ⚠️ **분은 반드시 5의 배수여야 한다** — `*​/5` 는 :00 :05 … 에만 오므로 7분을 쓰면 **영원히 안 돈다**
 * (이 파일이 고치려는 바로 그 침묵을 다시 만드는 셈). `slotDue` 가 그런 spec 을 **false 가 아니라
 * 예외**로 처리하지 않는 대신, 유닛테스트가 호출부 전수를 검사한다.
 *
 * ⚠️ **이 함수가 못 막는 것**: `*​/5` 자체가 등록에서 빠지는 경우. 그러면 여기 얹힌 전부가 같이
 * 죽는다 — 그건 `check-cron-slot-registered.mjs` 가 본다.
 */

export interface SlotSpec {
  /** UTC 분. **5의 배수만 유효**(`*​/5` 틱 격자). */
  minute: number
  /** UTC 시. 생략하면 매시. */
  hour?: number
  /** UTC 요일(0=일). 생략하면 매일. */
  dow?: number
}

/** `*​/5` 격자(300초)에 스냅한다 — 스케줄 시각이 :04:59.7 처럼 살짝 어긋나도 :05 로 읽는다. */
const TICK_MS = 5 * 60 * 1000

/**
 * 이번 `*​/5` 틱이 해당 슬롯의 실행 시점인가.
 *
 * @param scheduledTime `ScheduledEvent.scheduledTime` (epoch ms)
 */
export function slotDue(scheduledTime: number | undefined | null, spec: SlotSpec): boolean {
  // 시각을 모르면 **실행하지 않는다.** 여기서 true 로 열면 5분마다 도는 사고가 된다
  // (시간당 1회를 기대한 작업이 12배로 돌면 외부 API 한도·중복 발송으로 번진다).
  if (typeof scheduledTime !== 'number' || !Number.isFinite(scheduledTime)) return false

  const d = new Date(Math.round(scheduledTime / TICK_MS) * TICK_MS)
  if (d.getUTCMinutes() !== spec.minute) return false
  if (spec.hour !== undefined && d.getUTCHours() !== spec.hour) return false
  if (spec.dow !== undefined && d.getUTCDay() !== spec.dow) return false
  return true
}
