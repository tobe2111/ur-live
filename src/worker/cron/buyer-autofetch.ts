/**
 * 🌐 유통스타트 — 바이어 풀 완전 무인 수집 크론 (2026-07-21, 대표 "완전 무인").
 *   매일 저장된 소스(리스트 URL)를 저장 쿠키로 자동 수집 → 웹사이트에서 이메일 보강.
 *   ⚠️ 이중 게이트: env `BUYER_AUTO_FETCH_ENABLED='true'` + 어드민 토글(`buyer_af_cron='1'`).
 *   쿠키 만료 시엔 조용히 0건(다음 갱신까지 대기). 유어딜 무관. cron 워커(worker-deploy)에서 실행.
 */
import type { Env } from '../types/env'
import { runSavedSources, getCronEnabled } from '../../features/supply/api/buyer-autofetch'
import { enrichLeadsFromWebsites } from '../../features/supply/api/buyer-web-enrich'

export async function handleBuyerAutofetchCron(env: Env): Promise<{ ran: boolean; saved: number; enriched: number }> {
  if (env.BUYER_AUTO_FETCH_ENABLED !== 'true') return { ran: false, saved: 0, enriched: 0 }
  if (!(await getCronEnabled(env).catch(() => false))) return { ran: false, saved: 0, enriched: 0 }
  // 1) 저장된 소스 자동 수집(저장 쿠키 사용). 2) 웹사이트 이메일 보강.
  //   ⚠️ 두 단계 subrequest 합계를 ~50(Cloudflare 한도) 아래로: collect 24 + enrich 14 ≈ 38.
  const collect = await runSavedSources(env, 15, 24).catch(() => ({ saved: 0 }))
  const enrich = await enrichLeadsFromWebsites(env, { max: 15, budget: 14 }).catch(() => ({ enriched: 0 }))
  return { ran: true, saved: collect?.saved || 0, enriched: enrich?.enriched || 0 }
}
