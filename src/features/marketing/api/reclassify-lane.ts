/**
 * 🧭 **소급 재분류 레인 본문** — `worker-ads/index.ts` 의 kick 인라인에서 추출 (2026-08-05).
 *
 * ## 왜 추출했나
 * DO 알람 이관(#1057 성공 후 확장)으로 이 레인을 **cron 과 알람 두 경로**가 부르게 됐다.
 * 인라인 본문을 복제하면 마감선·행상한 로직이 두 벌이 되고, 한쪽만 고쳐지는 순간 조용히 갈린다
 * (이 레포가 반복해 만난 실패 양식). **로직은 byte-이동** — 아래 본문·주석은 index.ts 에 있던 그대로다.
 *
 * ⏱️ **패스 루프에 마감선** (2026-08-03 라이브 실측 — 이 레인은 **매시간 CPU 한도로 죽고 있었다**).
 *
 *   `cron_hb:ads:reclassify-company?passes=5` → `ok=false ms=3880 detail=Worker exceeded CPU time limit.`
 *   5패스 × 1,000행 × 행당 정규식 ~20개 = **10만 회**를 한 인보케이션에서 돌린다. 이건
 *   `ads-cpu-work-cap` 이 이미 세운 교리 — *"막아야 하는 건 페이지 크기가 아니라 **인보케이션당 총량**"* —
 *   을 이 **호출부**가 어기고 있던 것이다(함수 자체는 호출당 1,000행으로 이미 묶여 있다).
 *
 *   ✅ **커버리지 손실 0**: 각 패스가 끝날 때 커서를 저장하고 `done:false` 로 남긴다 —
 *     일찍 멈춰도 다음 회차가 그 지점부터 이어받는다(시간만 더 걸린다).
 *   ⚠️ 벽시계는 CPU 의 **근사**다(대기 시간이 섞인다). 정확한 계측은 런타임이 안 준다 —
 *     그래서 관측된 사망 지점(3,880ms)의 **절반 아래**로 잡는다.
 *
 *   🩹 **2026-08-04 — 시간만으론 못 막았다.** 마감선 1,800ms 를 넣고도 `ms=1316` 에 CPU 한도로
 *     죽었다(자기 마감선에 닿기도 전에). 외부 호출 없는 DB-only 루프라 **벽시계가 안 흐르는데
 *     정규식은 CPU 를 계속 태운다** ⇒ 교리대로 **행 총량**으로도 묶는다(시간 상한은 병행).
 *   ⏰ **2026-08-05 — 그래도 죽어서 알람으로 이관.** 행상한·시간상한을 다 넣고도 부모 cron 꼬리에서
 *     끌려 죽었다(같은 정각의 다른 레인이 부모 CPU 를 소진). DO 알람은 부모가 없어 자기 예산을 받는다.
 *   🧠 **2026-08-05 머지 이식 — CPU 사망 학습분 반영.** main(#1076)이 인라인 본문에
 *     `reclassifyWorkPlan(env, adsLeadsDb(env))`(async — cpu-quantum 학습배수 소비)를 배선했는데 같은 시각
 *     이 파일로 본문이 추출되고 있었다. 두 벌이 갈리지 않게 여기(단일 본문)로 옮겨 왔다 —
 *     cron·알람 어느 경로로 돌아도 사망 이력만큼 행 상한이 자동으로 줄어든다.
 */
import type { Env } from '@/worker/types/env'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

export async function runReclassifyLane(env: Env): Promise<Record<string, unknown>> {
  const { reclassifyCompanyLeads } = await import('./company-discovery')
  const { reclassifyWorkPlan } = await import('./collect-budget')
  const { sweepCompanyHygiene } = await import('./company-hygiene-sweep')
  const { rowsPerPass, maxRows, deadlineMs } = await reclassifyWorkPlan(env, adsLeadsDb(env)) // 🧠 CPU 사망 학습분 반영(cpu-quantum.ts)
  const t0 = Date.now()
  // 🧹 위생 백로그 스윕 — **랩보다 먼저**. 랩은 250행/시간이라 한 바퀴에 50일이고, 그 사이 대표가
  //   화면에서 보는 것은 옛 번호다. 결함 행만 좁혀 도는 1회성이고 완주하면 설정 1행 읽기로 끝난다.
  //   ⚠️ fail-soft — 이 스윕이 죽어도 재분류는 그대로 돌아야 한다(부가 작업이 본업을 막으면 안 된다).
  const hygiene = await sweepCompanyHygiene(adsLeadsDb(env)).catch(() => null)
  let last = await reclassifyCompanyLeads(adsLeadsDb(env), rowsPerPass) // 첫 패스만 housekeeping(억제 스윕)
  let passes = 1, rows = rowsPerPass
  for (; passes < 5 && !last.done && rows < maxRows && Date.now() - t0 < deadlineMs; passes++, rows += rowsPerPass) last = await reclassifyCompanyLeads(adsLeadsDb(env), rowsPerPass, false)
  // 관측: 매번 상한에서 끊기면 더 내려야 한다는 신호다(그때 커서 전진률을 같이 볼 것).
  return {
    ...last, passes, rows, elapsed_ms: Date.now() - t0,
    stopped_by: last.done ? 'done' : (rows >= maxRows ? 'rows' : (Date.now() - t0 >= deadlineMs ? 'deadline' : 'passes')),
    // 위생 스윕 진척 — 완주 전엔 `hyg=fixed/scanned`, 완주 후엔 `hyg=done`(하트비트로 판정 가능하게).
    hyg: hygiene ? (hygiene.skipped ? 'done' : `${hygiene.fixed}/${hygiene.scanned}@${hygiene.cursor}${hygiene.done ? ' done' : ''}`) : 'err',
  }
}
