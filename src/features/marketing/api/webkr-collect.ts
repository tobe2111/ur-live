/**
 * 🏠 **홈페이지 출처 전용 수집 레인** (`collect-webkr`) — 2026-08-22, 대표 지시
 *   *"홈페이지 출처인 경우에 이메일 연락처를 잘 수집하는 것 같은데 … 최대한 많이 확보할 수도 있어?"*
 *
 * ## 대표의 관찰이 맞다 (라이브 실측 2026-08-22, `ad_company_leads`)
 * ```
 *   출처별 이메일 수율                       크롤(홈페이지)이 만든 이메일
 *   webkr     2,860행 · 828 (29.0%)          homepage  1,117건
 *   local    11,852행 · 429 ( 3.6%)            └ webkr 824 · local 240 · storeinfo 53
 *   commerce 302,591행 · 40,042 (13.2%)      ← 등록부가 직접 준 값(크롤 성과 아님)
 *   storeinfo 33,844행 · 74 ( 0.2%)
 * ```
 * webkr 은 **전 행이 사이트를 갖고 들어온다** — 그래서 크롤이 통하고, 그래서 수율이 최고다.
 *
 * ## 그런데 왜 하루 150행뿐이었나 — 벽시계에 굶어 죽는다 (실측)
 * ```
 *   ads_company_stats  keywords: 3개 · spent: 12 · run_ms: 12,571 · deadline_hit: true
 * ```
 * `collect-company` 는 키워드마다 [네이버 지역검색 → 카카오 로컬 → 웹문서] 를 **순차**로 돌고
 * 회차 마감이 **12초**(무료)다. 웹문서는 그 줄의 **맨 끝**이라 가장 먼저 잘린다. 예산(서브리퀘스트)이
 * 남아도(12/50) 시간이 없어서 못 도는 것이라 — 예산을 키워도 안 늘어난다.
 * 게다가 그 레인은 **홀수시만**(하루 12회) 돈다.
 *
 * ## 그래서 이 레인이 하는 일
 * **웹문서 검색만** 한다(지도·카카오·크롤 없음). 알람 레인은 이름별 DO 인스턴스라 자기 인보케이션·
 * 자기 12초·자기 예산을 받는다 ⇒ 같은 무료 플랜에서 **회차가 곱해진다**(등록부 헤더의 승격 근거
 * *"회차를 못 받아 굶는다"* 에 정확히 해당).
 * 크롤은 하지 않는다 — 이미 `enrich-company` 가 출처 무관으로 사이트 보유 행을 크롤하고 있고,
 * **미크롤 잔량이 124건뿐**이라 병목이 아니다(병목은 새 사이트를 못 찾는 것이었다).
 *
 * ## 쿼터 (늘려도 되는 근거)
 * 네이버 검색 API 일 25,000 중 **실사용 0.7%**. 이 레인이 최대치로 돌아도 하루 ~600 콜(2.4%)이다.
 *
 * 🔻 롤백: env `ADS_WEBKR_LANE_DISABLED='true'` → 다음 회차부터 no-op(코드 변경 0).
 *   게이트는 `collect-company` 와 같은 `ADS_COMPANY_COLLECT_ENABLED` 를 공유한다 —
 *   업체 수집을 끄면 이 레인도 함께 꺼져야 하고, 별도 ON 스위치를 새로 만들면 배포 후
 *   대시보드에서 켜 줄 때까지 아무 일도 안 일어난다(그 자체가 흔한 무음 실패다).
 */
import type { Env } from '@/worker/types/env'
import type { FetchBudget } from './influencer-discovery'
import { envLaneBudget, envSubreqCap, companyRunDeadlineMs } from './collect-budget'
import { flushNaverCalls, armNaverAndReadSettings } from './naver-api-usage'
import { saveCompanyLeadsCounted, ensureCompanySchema, type CompanyLead } from './company-discovery'
import { pickCompanyKeywords, type PickKeyword } from './company-keyword-pick'
import { searchNaverWeb } from './webkr-search'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

export interface WebkrCollectStats {
  last_run: string; found: number; saved: number; upserted: number; keywords: string[]
  cursor: number; total_runs: number; total_saved: number; total_keywords: number
  spent: number; limit_hit: boolean; run_ms: number; deadline_hit: boolean
  diag: { configured: boolean; error?: string }
}

const STATS_KEY = 'ads_webkr_stats'

/**
 * 🧵 **동시 실행 폭** — 이 레인의 유일한 처방이다.
 *
 * 순차로 돌면 12초 안에 3~4 키워드밖에 못 넣는다(그게 `collect-company` 가 겪는 것이다).
 * 웹문서 검색은 **네트워크 대기**가 전부라 병렬로 겹치면 벽시계가 곧바로 몇 배가 된다.
 * ⚠️ 폭을 더 키우지 말 것 — 서브리퀘스트 예산(무료 인보케이션당 50)이 곧 천장이라
 * 폭만 키우면 예산이 먼저 말라 **같은 회차 안에서 뒤쪽 키워드가 통째로 0건**이 된다.
 */
export const WEBKR_CONCURRENCY = 4

/** 회차당 키워드 수 — 예산(≈40) ÷ 키워드당 1~2페이지. 폭×3 이면 마지막 조가 예산 끝물에 걸린다. */
const DEFAULT_BATCH = 12

/**
 * 한 회차. 게이트 체크는 호출부(레인 등록부).
 *
 * 커서는 `collect-company` 와 **별도 키**(`ads_webkr_stats.cursor`)다 — 같은 커서를 나눠 쓰면
 * 두 레인이 서로의 진행분을 건너뛴다(회전 창 주석이 경고하는 바로 그 사고).
 */
export async function runWebkrCollect(env: Env): Promise<WebkrCollectStats> {
  const DB = adsLeadsDb(env)
  const startedAt = Date.now()
  const schemaSpent = await ensureCompanySchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const clientId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID
  const clientSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET
  const pick = await armNaverAndReadSettings(DB, [STATS_KEY]) // 쿼터는 앱 단위 — 이 레인도 같은 통에 센다
  let prev: WebkrCollectStats | null = null
  try { const v = pick(STATS_KEY); prev = v ? JSON.parse(v) as WebkrCollectStats : null } catch { prev = null }

  const base = {
    last_run: stamp, found: 0, saved: 0, upserted: 0, keywords: [] as string[],
    cursor: prev?.cursor || 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0,
    total_keywords: prev?.total_keywords || 0, spent: 0, limit_hit: false,
    run_ms: 0, deadline_hit: false,
  }
  const save = async (s: WebkrCollectStats) => {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null)
    return s
  }

  if (!clientId || !clientSecret) {
    return save({ ...base, run_ms: Date.now() - startedAt, diag: { configured: false, error: 'NOT_CONFIGURED: NAVER_SEARCH_CLIENT_ID/SECRET 미설정' } })
  }

  const totalRow = await DB.prepare('SELECT COUNT(*) AS n FROM ad_company_keywords WHERE active = 1').first<{ n: number }>().catch(() => null)
  const total = Number(totalRow?.n) || 0
  let cursor = prev?.cursor || 0
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0
  const batchSize = Math.max(1, parseInt(env.ADS_WEBKR_BATCH || '', 10) || DEFAULT_BATCH)
  const kws = await pickCompanyKeywords(DB, total, cursor, batchSize)
  if (!kws.length) {
    // 커서를 되감지 않는다 — D1 일시 실패로 창이 비었을 뿐인데 리셋하면 진행분을 잃는다.
    return save({ ...base, cursor, total_keywords: total, run_ms: Date.now() - startedAt, diag: { configured: true } })
  }

  const budgetTotal = Math.max(1, Math.min(Math.max(5, envLaneBudget(env.ADS_WEBKR_SUBREQUEST_BUDGET, 40, env)), envSubreqCap(env)) - schemaSpent)
  const budget: FetchBudget = { left: budgetTotal }
  const runDeadlineMs = companyRunDeadlineMs(env)
  const overDeadline = () => Date.now() - startedAt > runDeadlineMs

  const leads: CompanyLead[] = []
  const used: string[] = []
  const perKeyword = new Map<number, number>()
  for (let i = 0; i < kws.length && !budget.limitHit && budget.left > 0 && !overDeadline(); i += WEBKR_CONCURRENCY) {
    const group = kws.slice(i, i + WEBKR_CONCURRENCY)
    const results = await Promise.all(group.map(async (kw: PickKeyword) => {
      // tier1(대행사)만 2페이지 — `collect-company` 와 같은 깊이 규칙을 그대로 승계한다.
      const pages = kw.tier === 1 ? 2 : 1
      const got = await searchNaverWeb(clientId, clientSecret, kw, budget, pages).catch(() => [] as CompanyLead[])
      return { kw, got }
    }))
    for (const r of results) {
      used.push(r.kw.keyword)
      perKeyword.set(r.kw.id, r.got.length)
      leads.push(...r.got)
    }
  }

  // 저장은 **회차 끝에 한 번** — 청크(50) 배치라 D1 왕복이 리드 수에 비례하지 않는다.
  //   `requireContact`(기본 ON)는 collect-company 와 동일 — webkr 리드는 연락처가 없어 보류(active=0)로
  //   들어가고, `enrich-company` 크롤이 이메일을 붙이면 그때 승격된다(그게 이 파이프라인의 설계다).
  const requireContact = env.ADS_COMPANY_REQUIRE_CONTACT !== 'false'
  const counted = leads.length
    ? await saveCompanyLeadsCounted(DB, leads, { requireContact }).catch(() => ({ inserted: 0, upserted: 0 }))
    : { inserted: 0, upserted: 0 }

  // 키워드 부기는 batch 1회 — 건건이 쓰면 회차 예산의 4분의 1을 부기에 쓴다(enrich 레인이 겪은 사고).
  if (perKeyword.size) {
    const stmts = [...perKeyword.entries()].map(([id, n]) =>
      DB.prepare("UPDATE ad_company_keywords SET found_total = found_total + ?, last_run_at = datetime('now') WHERE id = ?").bind(n, id))
    await DB.batch(stmts).catch(() => null)
  }

  // 커서는 **실제로 돈 만큼**만 전진한다(계획한 창 크기가 아니라) — 예산·마감으로 못 돈 키워드를
  //   건너뛰면 그 자리는 회전 경계에 고정돼 **영영 조회되지 않는다**(company-collect 주석의 실사고).
  const nextCursor = total > 0 ? (cursor + used.length) % total : 0

  const s: WebkrCollectStats = {
    last_run: stamp, found: leads.length, saved: counted.inserted, upserted: counted.upserted,
    keywords: used, cursor: nextCursor, total_runs: (prev?.total_runs || 0) + 1,
    total_saved: (prev?.total_saved || 0) + counted.inserted, total_keywords: total,
    spent: budgetTotal - budget.left, limit_hit: !!budget.limitHit,
    run_ms: Date.now() - startedAt, deadline_hit: overDeadline(),
    diag: { configured: true },
  }
  await save(s)
  await flushNaverCalls(DB, Date.now())
  return s
}
