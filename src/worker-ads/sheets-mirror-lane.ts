/**
 * 📊 **매시간 구글시트 미러 레인** — worker-ads/index.ts 에서 분리 (2026-07-29).
 *
 *   분리 이유는 순수 위생이다(엔트리가 600줄 캡을 넘었다). **동작은 한 글자도 바꾸지 않았다** —
 *   아래 주석·순서·에러 처리는 원본 그대로다. 바뀐 건 사는 곳뿐이다.
 *
 *   ⚠️ 이 레인은 `kick()` 을 안 거치고 생 `ctx.waitUntil` 로 돈다(구조 유지 — 아래 Discord 중복억제와
 *   KICK_FAILED 스탬프가 하드-원 로직이라 라우트로 옮기는 건 별건이다). 대신 `beat` 로 하트비트를 남긴다.
 *   ⚠️ 이 레인의 하트비트는 부모의 마지막 flush **뒤에** 도착할 수 있다 — 그래서 누적기가 봉인 모드에서
 *   즉시 쓰도록 돼 있다(`beat-batch.ts`). 그 성질이 깨지면 이 레인은 다시 관측 밖으로 나간다.
 */
import type { Env } from '@/worker/types/env'

/** `adsBeat` 과 같은 시그니처(부모에서 그대로 주입). */
type BeatFn = (name: string, ok: boolean, ms: number, err?: unknown) => Promise<void>

/** 직전 회차의 에러(있으면) — Discord 중복억제의 비교 기준. 두 실행 경로(cron/알람)가 같은 걸 읽는다. */
async function readPrevSyncErr(env: Env): Promise<string | null> {
  const prevRaw = await env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_sheets_last_sync'").first<{ value: string }>().catch(() => null)
  try { return (JSON.parse(prevRaw?.value || '{}') as { error?: string | null }).error || null } catch { return null }
}

/** 에러가 **바뀐 첫 회에만** Discord 경보(같은 에러 매시간 스팸 방지 · 회복되면 기록이 ok 로 리셋). */
async function alertIfNewSyncError(env: Env, prevErr: string | null, error: string | null | undefined): Promise<void> {
  if (!error || !env.DISCORD_WEBHOOK_URL || (error || '') === (prevErr || '')) return
  const { sendDiscordAlert } = await import('@/worker/utils/discord-alert')
  await sendDiscordAlert(env.DISCORD_WEBHOOK_URL, '유어애즈 구글시트 동기화 실패', `${error}\n(해결 전까지 시트 미러 정지 — 어드민 정비 도구에서 수동 재시도 가능)`, 'warn').catch(() => null)
}

/**
 * ⏰ **알람 경로** — DO 알람 인보케이션에서 동기화를 **직접** 돌린다 (2026-08-04).
 *
 * ## 왜 이 레인이 알람 1순위인가 (라이브 실측 — `cron_failures` 3일치)
 * ```
 *   ads:sheets-sync   Worker exceeded CPU time limit.  ×16   ← 전 레인 중 최다 사망
 * ```
 * 이 레인은 자기가 무거워서 죽는 게 아니다 — 부모 cron 의 `waitUntil` 꼬리에 매달려 있다가
 * **부모가 CPU 한도로 죽을 때 같이 끌려간다**(아래 cron 경로 주석의 KICK_FAILED 가 그 흔적이다).
 * 알람은 부모가 없어 자기 CPU 예산 30초를 통째로 받는다(`lane-alarm-policy.ts` 헤더).
 *
 * ## cron 경로와의 차이 (셋 다 의도)
 * 1. **SELF 홉이 없다** — cron 경로의 `SELF.fetch` 는 *부모 예산에서 러너를 격리*하려는 것이었는데,
 *    알람 인보케이션은 이미 자기 예산이라 홉이 순수 낭비다(서브리퀘스트 1 + 왕복).
 * 2. **게이트를 러너가 본다** — cron 은 디스패치 전에 env 를 보지만 알람은 매시간 무조건 깨므로,
 *    `ADS_SHEETS_SYNC_ENABLED !== 'true'` 면 여기서 no-op 한다(consented-reminder 와 같은 관용구).
 * 3. **실패는 throw** — 알람의 실패 백오프(`fail_streak`)와 하트비트 `ok=false` 가 걸리게.
 *    cron 경로는 삼켰지만(부모를 못 죽이니까), 알람은 throw 가 곧 올바른 신호다.
 */
export async function runSheetsMirrorDirect(env: Env): Promise<Record<string, unknown>> {
  if (env.ADS_SHEETS_SYNC_ENABLED !== 'true') return { skipped: 'gate_off' }
  const prevErr = await readPrevSyncErr(env)
  const { syncInfluencerPoolToSheets } = await import('@/features/marketing/api/sheets-sync')
  const r = await syncInfluencerPoolToSheets(env, 'cron')
  await alertIfNewSyncError(env, prevErr, r.error)
  if (!r.ok) throw new Error(r.error || 'SYNC_FAILED')
  return r as unknown as Record<string, unknown>
}

/**
 * 게이트가 켜져 있을 때만 동기화를 띄운다. 반환 프로미스는 호출부가 `ctx.waitUntil` 로 붙든다.
 *
 * 🛡️ 2026-07-23: 실패가 무음으로 사라지던 것 — 결과는 sheets-sync 가 platform_settings 에 기록하고,
 *   여기서 **에러가 바뀐 첫 회에만** Discord 경보(같은 에러 매시간 스팸 방지 · 회복되면 기록이 ok 로 리셋).
 *   동기화 자체는 SELF 인보케이션에서(풀 성장에 비례하는 D1 페이지 읽기+Sheets 쓰기를 수집과 격리),
 *   경보 판단만 여기서(응답 JSON 파싱 — 1 fetch + D1 1읽기라 가벼움).
 */
export async function runSheetsMirrorLane(env: Env, beat: BeatFn): Promise<void> {
  const t0 = Date.now()
  try {
    const prevErr = await readPrevSyncErr(env)
    let r: { ok: boolean; error?: string | null }
    if (env.SELF?.fetch) {
      const resp = await env.SELF.fetch(new Request('https://ur-ads/__ads/sheets-sync?by=cron', { method: 'POST' }))
      r = await resp.json().then(j => j as { ok: boolean; error?: string | null }).catch(() => ({ ok: false, error: 'SELF_RESPONSE_PARSE' }))
    } else {
      const { syncInfluencerPoolToSheets } = await import('@/features/marketing/api/sheets-sync')
      r = await syncInfluencerPoolToSheets(env, 'cron')
    }
    await alertIfNewSyncError(env, prevErr, r.ok ? null : (r.error || 'unknown'))
    await beat('sheets-sync', r.ok, Date.now() - t0, r.ok ? undefined : new Error(r.error || 'SYNC_FAILED'))
  } catch (err) {
    await beat('sheets-sync', false, Date.now() - t0, err)
    // 🔎 2026-07-29: 여기서 통째로 삼키던 것이 **3세션을 잡아먹었다**. 실패의 실제 양식은
    //   "러너가 돌다 실패"가 아니라 **"러너가 시작조차 못 함"** 이었다 — 위 `SELF.fetch` 는 부모
    //   인보케이션의 서브리퀘스트 1개이고, 부모가 인라인 레인(백필 최대 192 fetch/시간)에 예산을
    //   다 쓰면 그 1개조차 못 써서 throw 한다. 그러면 sheets-sync 는 진입하지 않으니 자기 스탬프도
    //   못 남기고, 화면엔 **옛 `ok:true` 가 그대로** 남는다(실측: 48시간 정지인데 성공 표시).
    //   ⇒ 부모 쪽에서도 스탬프를 남긴다. best-effort(한도가 원인이면 이 D1 쓰기도 실패할 수 있다)지만,
    //   성공하는 회차엔 "kick 이 못 떴다"가 그대로 보인다 — 원인이 정반대인 두 경우가 갈린다.
    const msg = String((err as { message?: string } | null)?.message || err || '').slice(0, 200)
    await env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_sheets_last_sync', JSON.stringify({
        at: new Date().toISOString(), ok: false, rows: null,
        error: `KICK_FAILED: 동기화 러너를 띄우지 못했습니다(부모 인보케이션 예산 소진 의심) — ${msg}`,
      })).run().catch(() => null)
  }
}
