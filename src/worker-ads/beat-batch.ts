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
    return p
  }

  return {
    add(beat: PendingBeat): void {
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
      sealed = true
    },
    /** 테스트/진단용 — 아직 안 쓴 건수. */
    get size(): number { return pending.length },
  }
}
