/**
 * 🧾 **디스패치 하트비트 일괄 쓰기** — 부모 cron 의 서브리퀘스트 비용을 절반으로 (2026-07-29).
 *
 * ## 산수가 원인을 지목한다
 * 부모 `scheduled()` 의 `kick` 한 번은 **2 서브리퀘스트**다 — `SELF.fetch` 1 + 하트비트 D1 쓰기 1.
 * 매시간 15~20개 레인을 던지면 **30~40**. 인보케이션 천장(이 플랫폼에서 ~50, D1 도 같은 지갑)에 바로 닿는다.
 *
 * 천장을 넘으면 뒤쪽 `SELF.fetch` 가 던지고, `catch` 가 실패를 기록하려는 **D1 쓰기도 같이 실패**한다.
 * ⇒ 그 레인은 `ok:false` 행이 아니라 **행 자체가 없다.** 라이브가 정확히 그 모습이었다:
 *   통신판매(2시간마다)가 02:00 이후 04·06·08·10·12 를 **통째로 걸렀고**, 실패 기록도 없었다.
 *
 * ## 왜 이 처방인가 (앞선 오진을 반복하지 않기 위해)
 * 같은 날 "레인이 즉시 응답하게" 라는 처방을 냈다가 되돌렸다 — 서비스 바인딩 피호출자는 호출자보다
 * 오래 살 수 없어서 작업이 **취소**됐다(#874 실측: 라운드 0회). 그건 *수명*을 건드리는 처방이었다.
 * 이번 처방은 **수명을 건드리지 않는다** — 레인은 예전과 똑같이 응답 전에 일하고, 부모도 예전과
 * 똑같이 기다린다. 줄어드는 건 **부기(簿記) 비용**뿐이다: 하트비트 N회 쓰기 → `DB.batch` **1회**.
 *
 * D1 `batch` 는 문장이 몇 개든 **서브리퀘스트 1개**다. 그래서 부모 비용이 `2N` → `N+1` 이 된다.
 * 20개 레인이면 40 → 21. 천장 아래로 내려간다.
 *
 * ## flush 이후에 온 기록은 **버리지 않고 즉시 쓴다** (봉인 모드)
 * 모든 레인이 `kick` 을 거치는 건 아니다 — 생 `ctx.waitUntil` 로 도는 레인(시트 미러 #882 등)은
 * 마지막 flush **뒤에** 하트비트를 남길 수 있다. 그걸 모으기만 하면 영영 안 나가고,
 * 그 레인은 *멈춘 것과 똑같이 생긴다* — 비용을 아끼려다 관측을 지우는 셈이다.
 * ⇒ flush 가 끝난 뒤의 `add()` 는 모으지 않고 **바로 쓴다**(그 건만 서브리퀘스트 1, 배칭 이전과 동일).
 *
 * ## 한계 (과신 금지)
 * - 부모가 flush 전에 죽으면 **그 묶음은 통째로 사라진다.** 그래서 `FLUSH_AT` 마다 중간 flush 해
 *   손실을 그 단위로 묶는다. 완전한 해법은 아니고 **손실을 유계로 만드는 것**이다.
 * - 봉인 모드의 즉시 쓰기도 부모가 이미 회수됐으면 못 나간다(수명은 이 모듈이 못 건드린다).
 * - 레인 자신의 완료 기록(각 러너의 `stats.diag`)은 이 경로와 무관하다 — 그쪽이 진짜 관측이다.
 */

import type { Env } from '@/worker/types/env'
/** 한 건의 하트비트 — `recordCronBeat` 과 같은 정보를 담되 쓰기를 미룬다. */
export interface PendingBeat {
  name: string
  ok: boolean
  ms: number
  cron?: string
  result?: unknown
  maxGapMin?: number
}

/** 이만큼 쌓이면 중간 flush — 부모가 죽어도 손실이 이 단위를 넘지 않게. */
export const FLUSH_AT = 10

/**
 * 가장 오래된 미기록 하트비트를 이보다 오래 들고 있지 않는다 (2026-07-29 **라이브 실측 후 추가**).
 *
 * 처음엔 임계치(10)와 마지막 flush 만 뒀는데, 라이브에서 **기록이 실제로 사라졌다**:
 * 14:00 회차에 `reclassify` 는 자기 스탬프가 `14:01:09` 인데(= 돌았다) 하트비트는 13:01 그대로였다.
 * 원인은 마지막 flush 가 **모든 디스패치가 끝나기를** 기다리는 데 있다 — 부모가 그 전에 회수되면
 * 임계치에 못 닿은 뒷부분이 통째로 사라진다. 내가 문서에 "한계"로 적어 둔 그 모드가 그대로 발생했다.
 *
 * ⇒ 나이 상한을 둔다. 타이머는 쓰지 않는다(타이머는 부모 **수명**을 건드린다 — 이 모듈이 절대
 *   넘지 않기로 한 선이다). `add()` 시점에만 검사하므로 비용 0이고, 손실 창이 라운드 전체에서
 *   이 값으로 줄어든다. 절약도 대부분 유지된다(레인 완료는 몰려서 오므로 여전히 묶인다).
 */
export const MAX_HOLD_MS = 3_000

/**
 * 하트비트 누적기. `add()` 는 쓰지 않고 모으기만 하고, 임계치에 닿거나 `flush()` 될 때 **한 번에** 쓴다.
 *
 * @param write 실제 쓰기(주입 — 테스트에서 D1 없이 검증). 반환값은 무시한다(fail-soft).
 */
export function createBeatBatch(write: (beats: PendingBeat[]) => Promise<void>, flushAt = FLUSH_AT, maxHoldMs = MAX_HOLD_MS) {
  let pending: PendingBeat[] = []
  let oldestAt = 0 // 지금 묶음의 첫 기록이 들어온 시각 — 나이 상한 판정용
  let sealed = false // flush 를 한 번 지난 뒤 — 이제 모으기만 하면 아무도 안 내보낸다
  const inflight: Promise<unknown>[] = []

  const flushNow = (): Promise<void> => {
    if (!pending.length) return Promise.resolve()
    const batch = pending
    pending = []
    const p = write(batch).catch(() => undefined) // 관측 실패가 작업을 막지 않는다
    inflight.push(p)
    // 🔒 **첫 flush 뒤로는 봉인** — 여기부터 오는 것은 '꼬리'다 (2026-07-29 라이브 실측 후 교정).
    //   레인 완료는 초반에 몰렸다가(빠른 레인) 느린 레인이 한참 뒤에 하나씩 온다. 그 꼬리를 모으면
    //   **뒤에 add 가 없어서 나이 상한이 발화하지 못하고**(상한은 add 시점에만 검사한다) 마지막 flush
    //   까지 대기하는데, 부모가 그 전에 회수되면 사라진다. 라이브에서 두 틱 연속 그랬다:
    //   `reclassify` 자기 스탬프 15:01:09 ↔ 하트비트 13:01(= 돌았는데 기록이 없다).
    //   ⇒ 몰린 구간(=절약이 실제로 생기는 곳)만 묶고, 꼬리는 도착 즉시 쓴다.
    sealed = true
    return p
  }

  /**
   * 📼 이 회차에 들어온 **모든** 하트비트(쓰였든 아니든). 회차 요약을 만들기 위한 것 —
   *   `cron_hb:` 는 레인당 최신 1건만 보관해 **시계열을 만들 수 없다**(`tick-history.ts` 참조).
   *   ⚠️ flush 로 비워지는 `pending` 과 달리 **절대 비우지 않는다.** 비우면 마지막 flush 시점에
   *     앞쪽 묶음이 사라져 요약이 실제보다 작아진다(= 붕괴를 과소보고).
   */
  const seen: Array<{ name: string; ok: boolean; ms: number }> = []

  return {
    add(beat: PendingBeat): void {
      seen.push({ name: beat.name, ok: beat.ok, ms: beat.ms })
      if (!pending.length) oldestAt = Date.now()
      pending.push(beat)
      // 봉인 뒤에는 임계치를 기다리지 않는다 — 기다리면 그 기록은 영영 안 나간다.
      // 나이 상한: 임계치에 못 닿아도 오래 들고 있지 않는다(라이브에서 실제로 잃은 그 경우).
      if (sealed || pending.length >= flushAt || Date.now() - oldestAt >= maxHoldMs) void flushNow()
    },
    /** 남은 것을 쓰고, 이미 시작된 쓰기까지 모두 끝나기를 기다린다. 이후 도착분은 즉시 쓰기로 전환. */
    async flush(): Promise<void> {
      await flushNow()
      await Promise.allSettled(inflight)
      sealed = true // (첫 flush 에서 이미 켜졌을 수 있다 — 아무것도 안 쓴 라운드를 위한 보장)
    },
    /** 테스트/진단용 — 아직 안 쓴 건수. */
    get size(): number { return pending.length },
    /** 이 회차에 들어온 하트비트 전부(요약용). flush 와 무관하게 누적된다. */
    get seenBeats(): ReadonlyArray<{ name: string; ok: boolean; ms: number }> { return seen },
  }
}

/**
 * 🛡️ **부모의 실패 기록이 자식의 성공 기록을 덮지 않는다** (2026-08-01 14:00 실측).
 *
 *   부모 기록은 설계상 *폴백*이라고 주석에 적혀 있었지만 실제 SQL 은 `INSERT OR REPLACE` —
 *   즉 **무조건 덮어쓰기**였다. 그날 틱에서:
 *
 *   | 레인 | 자식 스탬프(= 일을 끝냈다) | 부모가 덮어쓴 것 |
 *   |---|---|---|
 *   | `match-registry` | 14:01:05 | 14:01:10 `ok=false` |
 *   | `reclassify-company?passes=5` | 14:01:09 | 14:01:10 `ok=false` |
 *
 *   부모가 `await SELF.fetch` 응답을 못 받은 것은 **부모가 죽었기 때문**이지 레인이 실패해서가 아니다
 *   (같은 틱에 레인 7개가 **같은 순간** 같은 벽 ms 10505~10663 에서 끊겼다 — 코드에 10초 타임아웃은
 *   없으니 밖에서 한 번에 죽인 것이다). 그런데 화면에는 "이 레인 실패"로 남아 **멀쩡히 도는 수집기를
 *   고장으로 오진**하게 만든다. 실제로 그렇게 오진했다.
 *
 *   ⇒ 실패 쓰기는 **이번 틱 안에 이미 기록이 있으면 물러난다.** 자식 기록이 더 정확하다 —
 *     자식은 자기가 무엇을 했는지 알고 `failNote` 로 사유 원문까지 남긴다.
 *   ⚠️ 성공 쓰기는 **무조건** — 자식이 기록을 못 남긴 경우 부모의 성공 기록이 유일한 증거다.
 *   ⚠️ `COALESCE` 가 필요한 이유: 값이 JSON 이 아니거나 `at` 이 없으면 `json_extract` 는 NULL 이고,
 *     SQL 에서 `NULL < ?` 는 거짓이 아니라 **NULL** 이라 조건 전체가 성립하지 않는다 → 부모가 영영 못 쓴다.
 *   ⚠️ 못 막는 것: 자식이 **틱 시작 이전**에 쓴 낡은 기록은 이 가드가 안 본다(그건 덮는 게 맞다).
 *
 * @param tickStartIso 이 cron 틱이 시작한 시각(ISO). **배치 flush 시점이 아니라 틱 시작**이어야 한다 —
 *   flush 시점으로 잡으면 자식 기록보다 나중이 되어 가드가 통째로 무력해진다.
 */
export function makeBeatWriter(env: Env, tickStartIso: string) {
  return async (list: PendingBeat[]): Promise<void> => {
    const { buildCronBeatRow } = await import('@/worker/utils/cron-heartbeat')
    await env.DB.batch(list.map((b) => {
      const { key, value } = buildCronBeatRow(b.name, b.ok, b.ms, b.cron, b.result, b.maxGapMin)
      if (b.ok) return env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(key, value)
      // 실패 쓰기만 가드 — 이번 틱에 이미 누가(=자식이) 썼으면 그것을 남긴다.
      return env.DB.prepare(
        `INSERT INTO platform_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2
          WHERE COALESCE(json_extract(platform_settings.value, '$.at'), '') < ?3`,
      ).bind(key, value, tickStartIso)
    }))
  }
}
