/**
 * 🔔 수집 건강 경보 — influencer-auto-collect 에서 분리(파일 크기 상한 준수).
 *   "신규 0건"이 며칠 무음이던 2026-07-20 실사고(배포가 시크릿을 wipe)의 재발 방지 장치.
 *   상태(경보 중/해제)는 platform_settings 한 칸에 두고, 회복 시 1회 해제 알림을 보낸다.
 */
import type { Env } from '@/worker/types/env'
import { readSetting, writeSetting } from './influencer-auto-collect'
import { judgeRotation } from './influencer-keyword-rotation'

export type CollectDiag = {
  yt: { configured: boolean; found: number; saved: number; error?: string }
  naver: { configured: boolean; found: number; saved: number; error?: string }
  tistory?: { configured: boolean; found: number; saved: number; error?: string }
}

const ALERT_KEY = 'ads_autocollect_alert_at' // 경보 throttle 상태(빈값=건강)

/** 🔔 조용한 실패 방어(2026-07-20 실사고 — deploy 가 시크릿 wipe, "신규 0건"이 며칠 무음): 키 소실 또는
 *  전 플랫폼 발굴 0 이면 Discord 경보(6h throttle · 회복 시 해제). fail-soft · 웹훅 미설정=no-op. */
export async function maybeAlertCollectHealth(env: Env, DB: D1Database, run: {
  diag: CollectDiag; saved: number; quotaHit: boolean
  /** 🔢 판단에 필요한 숫자 — 경보에 실어 보낸다(없으면 '?'). 종전엔 "확인해 보라"만 했다. */
  spent?: number; budget_total?: number; budget_exhausted?: boolean
  picks?: { planned?: number; processed?: number; from_cursor?: number }
}): Promise<void> {
  const webhook = env.DISCORD_WEBHOOK_URL
  if (!webhook) return
  const { diag, saved, quotaHit } = run
  const keyMissing = !diag.yt.configured || !diag.naver.configured
  // 🛡️ 2026-07-23: 풀 포화(발굴O·전부 중복 → saved=0)는 정상이라 오경보였음 → found 까지 0 일 때만 불건강.
  const foundTotal = diag.yt.found + diag.naver.found + (diag.tistory?.found || 0)
  // 🌵 2026-07-29 **순환 정체** 추가 — 위 두 조건은 "아무것도 못 건졌다"만 본다. 그런데 실제로 며칠을
  //   잡아먹은 실패는 그 모양이 아니었다: 매시간 `Too many subrequests` 로 죽으면서도 13~139건은 저장했고
  //   (saved>0·found>0), 그래서 이 경보는 **한 번도 울릴 수 없었다**. 정작 피해는 커버리지가 무너진 것이다.
  //   ⇒ 원인(한도/예산/버그)을 묻지 않고 **증상**을 직접 센다.
  // 🔄 2026-08-04 판정 교체 — 임계 "2일"이 이제 **한 바퀴(6.5일)보다 짧아** 완벽해도 80% 가 걸렸다.
  //   해제될 수 없는 경보라 매일 울리고, 시키는 처방(순환 가속)은 방향과 반대였다. 근거·배수는
  //   `judgeRotation` docblock. **쿼리 2개 → 1개**(왕복도 줄었다).
  const rot = await DB.prepare(`SELECT COUNT(*) AS active,
      SUM(CASE WHEN last_run_at >= datetime('now','-24 hours') THEN 1 ELSE 0 END) AS ran24h,
      MAX(julianday('now') - julianday(COALESCE(last_run_at, created_at))) AS oldest_days,
      AVG(julianday('now') - julianday(COALESCE(last_run_at, created_at))) AS avg_days
    FROM ad_discovery_keywords WHERE active = 1`)
    .first<{ active: number; ran24h: number; oldest_days: number; avg_days: number }>().catch(() => null)
  const activeTotal = rot?.active || 0
  const verdict = judgeRotation({
    active: activeTotal, ran24h: rot?.ran24h || 0,
    oldestDays: rot?.oldest_days || 0, avgDays: rot?.avg_days || 0,
  })
  const rotationStalled = verdict.stalled
  const cycleTxt = Number.isFinite(verdict.cycleDays) ? `${verdict.cycleDays.toFixed(1)}일` : '∞(정지)'
  const unhealthy = keyMissing || (saved === 0 && foundTotal === 0) || rotationStalled
  const prevAt = await readSetting(DB, ALERT_KEY)
  // ⚠️ 상대경로 필수 — 워커 런타임엔 `@/` alias 가 없다(dynamic import 는 빌드 시 resolve 안 됨).
  //   2026-08-04: 이 줄이 alias 였다. 경보를 쏘려는 순간에만 터지므로 **평소엔 안 보이고**,
  //   유어애즈는 웹훅이 미설정이라 이 분기 자체에 도달한 적이 없어 더 오래 숨어 있었다.
  const { sendDiscordAlert } = await import('../../../worker/utils/discord-alert')
  if (!unhealthy) {
    if (prevAt) { // 직전이 경보 상태였다 → 해제 + 회복 알림 1회.
      await writeSetting(DB, ALERT_KEY, '')
      await sendDiscordAlert(webhook, '유어애즈 인플루언서 수집 회복', `신규 ${saved}건 저장 · 활성 ${activeTotal}개 · 한 바퀴 ${cycleTxt} — 정상 재개.`, 'info')
    }
    return
  }
  const last = prevAt ? Date.parse(prevAt) : 0
  const now = Date.now()
  if (prevAt && Number.isFinite(last) && now - last < 6 * 3600 * 1000) return // 6h throttle
  await writeSetting(DB, ALERT_KEY, new Date(now).toISOString())
  const lines = [
    keyMissing ? '⚠️ API 키 미설정(시크릿 소실 의심 — ur-ads 워커 env 확인)'
      // 🔎 두 정체는 처방이 다르다 — 뭉뚱그리면 대표가 잘못된 곳을 본다.
      : verdict.reason === 'stopped' ? `🛑 키워드 순환 **정지** — 활성 ${activeTotal}개 중 24시간 동안 실행 0개(레인이 멎었는지 먼저 확인)`
      : rotationStalled ? `⚠️ 키워드 순환 **편식** — 한 바퀴 ${cycleTxt}인데 가장 밀린 키워드가 ${verdict.worstCycles.toFixed(1)}바퀴째 순번을 못 받음(라운드로빈이 깨진 상태)`
      : '⚠️ 전 플랫폼 신규 0건',
    `• YouTube: cfg=${diag.yt.configured} found=${diag.yt.found} saved=${diag.yt.saved}${diag.yt.error ? ` err=${diag.yt.error}` : ''}`,
    `• Naver: cfg=${diag.naver.configured} found=${diag.naver.found} saved=${diag.naver.saved}${diag.naver.error ? ` err=${diag.naver.error}` : ''}`,
    diag.tistory ? `• Tistory: cfg=${diag.tistory.configured} found=${diag.tistory.found} saved=${diag.tistory.saved}${diag.tistory.error ? ` err=${diag.tistory.error}` : ''}` : '',
    quotaHit ? '• YouTube 일일 쿼터 소진(내일 자동 재개)' : '',
    // 🔢 **값을 실어 보낸다** — 종전엔 "확인해 보라"만 했다. 그런데 확인처인 `limit_hit` 은 플랫폼 에러
    //   전용이라 예산이 100% 소진돼도 `false` 다(2026-08-04 실측: spent 56/56 · limit_hit false).
    //   그래서 경보를 받고 열어 봐도 "정상"으로 보였다. 판단에 필요한 숫자를 경보 안에 넣는다.
    rotationStalled ? `• 예산 ${run?.spent ?? '?'}/${run?.budget_total ?? '?'}${run?.budget_exhausted ? ' (소진)' : ''}`
      + ` · 키워드 ${run?.picks?.processed ?? '?'}/${run?.picks?.planned ?? '?'} 처리`
      + ` · 회전 ${run?.picks?.from_cursor ?? '?'}개/라운드` : '',
    // ⚠️ **"더 빨리 돌려라"를 처방으로 쓰지 않는다.** `CLAUDE.md` 유어애즈 절 실측이 *유입 1,613/일 vs
    //   측정 3,600/일 — 측정이 이기는 중*이라 발굴 가속은 미측정 백로그만 키운다(+네이버 차단 리스크).
    //   순환이 느린 것 자체는 고장이 아니고, 여기 걸렸다는 건 **배분이 깨졌다**는 뜻이다.
    rotationStalled ? '• 처방: 순환 가속이 아니라 배분 확인(집중/우선/일반 몫 · 커서 전진) — 발굴 가속은 미측정 백로그를 키운다' : '',
    '어드민 인플루언서 풀에서 상세 확인.',
  ].filter(Boolean)
  await sendDiscordAlert(webhook, '유어애즈 인플루언서 수집 경보', lines.join('\n'), keyMissing ? 'error' : 'warn')
}
