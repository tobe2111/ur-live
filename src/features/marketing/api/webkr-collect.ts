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
import { pickCompanyKeywords, rotationAdvance, type PickKeyword } from './company-keyword-pick'
import { searchNaverWeb } from './webkr-search'
import {
  OPENAPI_BLOCK_KEY, flushOpenapiBlock, isBackedOff, naverOpenapiBlocked, openapiBlockSnapshot, parseOpenapiBlock,
} from './naver-openapi-block'
import {
  SUBCAT_YIELD_KEY, kstDay, parseSubcatYield, recomputeSubcatYield, suppressCompanyPool, suppressedSubcats,
} from './company-subcat-yield'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

export interface WebkrCollectStats {
  last_run: string; found: number; saved: number; upserted: number; keywords: string[]
  cursor: number; total_runs: number; total_saved: number; total_keywords: number
  spent: number; limit_hit: boolean; run_ms: number; deadline_hit: boolean
  /** 🚧 네이버 오픈API 차단 관측(회차 단위). `tripped` 면 이 회차가 **중간에 멈춘 것**이다 — 수율 0 과 구분된다. */
  openapi_block?: { streak: number; blocked: number; ok: number; tripped: boolean; last_status: number | null }
  /** 🎯 이번 회차에 수율 미달로 건너뛴 업종(자동 은퇴). 비어 있으면 아무도 안 막혔다는 뜻이다. */
  suppressed?: string[]
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
 * 🧾 **부기(簿記) 몫** — 루프가 예산을 다 태우면 회차가 **자기 기록을 못 남긴다.**
 *
 * 루프 뒤에 반드시 도는 D1 접근: 리드 저장(전후 COUNT + 청크 batch ≈ 4) · 키워드 부기 batch(1)
 * · 스냅샷 저장(1) · 네이버 누적 flush(읽기 1 + 쓰기 1) · **차단 관측 flush(읽기 1 + 쓰기 1)**
 * · 하루 한 번 도는 업종 수율 재계산(읽기 1 + 쓰기 1).
 * 이걸 안 남기면 수집은 실제로 했는데
 * `ads_webkr_stats` 가 안 갱신돼 **"돌았는데 안 돈 것"** 으로 보인다 — 원인 규명이 가장 어려운 모양이다.
 * (같은 이유로 `runKakaoPhoneSweep` 이 `SWEEP_BOOKKEEPING_RESERVE` 를 둔다.)
 */
const BOOKKEEPING_RESERVE = 12

/** 루프 전에 이미 쓴 D1: settings 읽기 · 활성 키워드 COUNT · 키워드 픽 · 조기 스냅샷 1. */
const UPFRONT_D1 = 4

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
  // 🎯 수율 표를 **이미 하던 설정 읽기에 얹는다** — 서브리퀘스트 추가 0(`armNaverAndReadSettings` 의 존재 이유).
  const pick = await armNaverAndReadSettings(DB, [STATS_KEY, SUBCAT_YIELD_KEY, OPENAPI_BLOCK_KEY]) // 쿼터는 앱 단위 — 이 레인도 같은 통에 센다
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

  /**
   * 🚧 **회차를 넘는 백오프** — 지난 회차가 차단으로 끝났으면 그 시각까지 아예 안 쏜다.
   *   안 그러면 막힘이 몇 시간 갈 때 매 회차 3번씩 헛쏘고, 실패 응답도 그날 쿼터를 먹는다.
   *   깨끗한 회차 한 번이면 저장된 `until` 이 0 이 되어 즉시 풀린다(회복 즉시 인정).
   */
  const blockBlob = parseOpenapiBlock(pick(OPENAPI_BLOCK_KEY))
  if (isBackedOff(blockBlob, Date.now())) {
    return save({
      ...base, run_ms: Date.now() - startedAt,
      diag: { configured: true, error: `backoff: 네이버 오픈API 차단(연속 ${blockBlob.trips || 1}회) — ${new Date(Number(blockBlob.until)).toISOString().slice(0, 19).replace('T', ' ')} 이후 재시도` },
    })
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

  // ⚠️ 하한은 [부기 예약 + 선불 D1 + 한 조(폭 4 × 최대 2페이지)] 를 다 덮어야 한다 —
  //   못 덮으면 루프 조건이 처음부터 거짓이라 **한 키워드도 안 돈다**(스키마 DDL 이 도는 콜드 회차가 그렇다).
  const budgetFloor = BOOKKEEPING_RESERVE + UPFRONT_D1 + WEBKR_CONCURRENCY * 2
  const budgetTotal = Math.max(budgetFloor, Math.min(Math.max(5, envLaneBudget(env.ADS_WEBKR_SUBREQUEST_BUDGET, 40, env)), envSubreqCap(env)) - schemaSpent)
  const budget: FetchBudget = { left: budgetTotal }
  /**
   * 🧾 **D1 도 서브리퀘스트다** (2026-08-23 라이브 실측으로 배운 것).
   *
   * 첫 판은 이 카운터가 **웹문서 fetch 만** 셌다. 그래서 `BOOKKEEPING_RESERVE` 가 8을 남겨 놨다고
   * 믿는 동안 플랫폼 한도(무료 인보케이션당 50, D1 포함)는 이미 말라 있었고, **회차 끝의 기록 쓰기가
   * 조용히 실패**했다 — 행은 저장되는데 `ads_webkr_stats` 도 레인 하트비트도 11시간 동안 한 번도
   * 안 찍혔다(관측면만 죽고 수집은 돌아 더 알아채기 어려웠다).
   * ⇒ 예산을 쓰는 모든 D1 호출을 여기서 함께 센다(보강 레인 `enrich-lane` 이 쓰는 검증된 패턴).
   */
  const spendD1 = (n = 1) => { budget.left -= n }
  spendD1(UPFRONT_D1 - 1) // 소급 계상: settings 읽기 · COUNT · 키워드 픽 (조기 스냅샷 1은 아래에서)
  const runDeadlineMs = companyRunDeadlineMs(env)
  const overDeadline = () => Date.now() - startedAt > runDeadlineMs

  /**
   * 📸 **먼저 남기고 시작한다.** 회차가 중간에 죽어도(한도·CPU·벽시계) 그 사실이 보이게.
   *   끝에서 한 번만 쓰면, 죽는 회차는 **영원히 기록이 없다** — 그게 이 레인이 겪은 실제 증상이다.
   *   비용 1. `partial: true` 로 남기고 정상 종료 시 최종본으로 덮는다.
   */
  spendD1()
  await save({ ...base, cursor, total_keywords: total, keywords: kws.map(k => k.keyword),
    spent: budgetTotal - budget.left, run_ms: Date.now() - startedAt,
    diag: { configured: true, error: 'partial: 회차 진행 중(정상 종료 시 덮어씀)' } })

  const leads: CompanyLead[] = []
  const used: string[] = []
  const usedKw: PickKeyword[] = [] // 커서 전진 근거 — 우선 픽(미실행)은 회전 시퀀스 밖이라 빼야 한다
  const perKeyword = new Map<number, number>()

  /**
   * 🎯 **저수율 업종 자동 은퇴** — 이번 회차에 건너뛸 자리를 미리 정한다.
   *
   * ⚠️ 건너뛴 자리도 `usedKw` 에 **넣는다**. 회전 커서에서 이 자리는 *소비된* 것이라야 한다 —
   *   안 넣으면 다음 회차가 같은 자리를 또 읽어 **회전이 제자리에 갇힌다**(2026-08-23 에 실제로 겪은
   *   사고와 같은 클래스: 조용하고, 에러가 없고, 백로그만 안 준다).
   *   대신 fetch 를 안 하므로 예산·쿼터는 아끼고, 부기(`perKeyword`)에는 안 넣는다 —
   *   0건을 기록하면 "재 봤더니 없더라"로 읽혀 **자기가 만든 증거로 자기를 정당화**하게 된다.
   */
  const suppress = suppressedSubcats(parseSubcatYield(pick(SUBCAT_YIELD_KEY)), prev?.total_runs || 0)
  const skipIdx = suppressCompanyPool(kws, suppress)
  const skipped: string[] = []

  // 🚧 `naverOpenapiBlocked()` — 429/403 이 연속 3회면 즉시 멈춘다. 막힌 채로 남은 조를 다 돌면
  //   그 회차 결과가 전부 0 이 되고(수율 학습 오염), 실패 호출이 그날 쿼터만 태운다.
  for (let i = 0; i < kws.length && !budget.limitHit && !naverOpenapiBlocked() && budget.left > BOOKKEEPING_RESERVE && !overDeadline(); i += WEBKR_CONCURRENCY) {
    const group = kws.slice(i, i + WEBKR_CONCURRENCY)
    const results = await Promise.all(group.map(async (kw: PickKeyword, gi: number) => {
      if (skipIdx.has(i + gi)) return { kw, got: [] as CompanyLead[], skip: true }
      // tier1(대행사)만 2페이지 — `collect-company` 와 같은 깊이 규칙을 그대로 승계한다.
      const pages = kw.tier === 1 ? 2 : 1
      const got = await searchNaverWeb(clientId, clientSecret, kw, budget, pages).catch(() => [] as CompanyLead[])
      return { kw, got, skip: false }
    }))
    for (const r of results) {
      usedKw.push(r.kw) // 건너뛴 자리도 회전에서는 소비된 것 — 위 주석 참조
      if (r.skip) { skipped.push(r.kw.keyword); continue }
      used.push(r.kw.keyword)
      perKeyword.set(r.kw.id, r.got.length)
      leads.push(...r.got)
    }
  }

  // 저장은 **회차 끝에 한 번** — 청크(50) 배치라 D1 왕복이 리드 수에 비례하지 않는다.
  //   `requireContact`(기본 ON)는 collect-company 와 동일 — webkr 리드는 연락처가 없어 보류(active=0)로
  //   들어가고, `enrich-company` 크롤이 이메일을 붙이면 그때 승격된다(그게 이 파이프라인의 설계다).
  const requireContact = env.ADS_COMPANY_REQUIRE_CONTACT !== 'false'
  spendD1(leads.length ? 3 + Math.ceil(leads.length / 50) : 0) // 전후 COUNT 2 + 스키마 보장 1 + 청크 batch
  const counted = leads.length
    ? await saveCompanyLeadsCounted(DB, leads, { requireContact }).catch(() => ({ inserted: 0, upserted: 0 }))
    : { inserted: 0, upserted: 0 }

  // 키워드 부기는 batch 1회 — 건건이 쓰면 회차 예산의 4분의 1을 부기에 쓴다(enrich 레인이 겪은 사고).
  if (perKeyword.size) {
    const stmts = [...perKeyword.entries()].map(([id, n]) =>
      DB.prepare("UPDATE ad_company_keywords SET found_total = found_total + ?, last_run_at = datetime('now') WHERE id = ?").bind(n, id))
    spendD1()
    await DB.batch(stmts).catch(() => null)
  }

  // 커서는 **회전 창에서 실제로 돈 만큼**만 전진한다.
  //   ⚠️ 두 가지를 동시에 지켜야 한다 — ① 예산·마감으로 못 돈 자리를 건너뛰지 않을 것
  //   ② **우선 픽(미실행)은 커서 시퀀스 밖이므로 세지 않을 것**. ②를 빼먹으면 우선 자리 수만큼
  //   매 회차 건너뛰어 그 자리가 영영 조회되지 않는다(2026-08-23 라이브에서 실제로 9칸씩 났다).
  const nextCursor = total > 0 ? (cursor + rotationAdvance(usedKw)) % total : 0

  const s: WebkrCollectStats = {
    last_run: stamp, found: leads.length, saved: counted.inserted, upserted: counted.upserted,
    keywords: used, cursor: nextCursor, total_runs: (prev?.total_runs || 0) + 1,
    total_saved: (prev?.total_saved || 0) + counted.inserted, total_keywords: total,
    spent: budgetTotal - budget.left, limit_hit: !!budget.limitHit,
    run_ms: Date.now() - startedAt, deadline_hit: overDeadline(),
    openapi_block: openapiBlockSnapshot(),
    suppressed: skipped,
    diag: { configured: true },
  }
  await save(s)
  await flushNaverCalls(DB, Date.now())
  // 📉 `foundZero` — 키워드를 실제로 돌았는데 한 건도 못 얻은 회차. 소프트 스로틀(200+빈 결과) 대조용
  //   **관측치일 뿐**이다 — 키워드가 정말 마른 경우와 구분하지 못하므로 이 값으로 판단하지 않는다.
  await flushOpenapiBlock(DB, Date.now(), { foundZero: used.length > 0 && leads.length === 0 })
  /**
   * 🎯 **하루 한 번** 업종 수율을 다시 잰다 — 그래서 오늘의 판정이 내일 스스로 갱신된다.
   *   저장된 표의 기준일이 오늘이 아닐 때만 돈다(서브리퀘스트 2/일). 실패해도 던지지 않는다.
   *   ⚠️ 부기 예약 밖에서 돌리지 말 것 — 이건 회차의 마지막 D1 사용이고, 예약이 이 몫을 덮는다.
   */
  const yieldBlob = parseSubcatYield(pick(SUBCAT_YIELD_KEY))
  if (!yieldBlob || yieldBlob.day !== kstDay(Date.now())) await recomputeSubcatYield(DB, Date.now())
  return s
}
