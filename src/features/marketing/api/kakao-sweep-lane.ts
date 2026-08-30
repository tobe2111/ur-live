/**
 * ☎️ 카카오 전화 스윕 레인 — `company-collect.ts` 에서 분리(2026-08-30, 600줄 래칫).
 *
 *   ⚠️ **이동만이다 — 로직 byte-불변.** 스윕이 소스별 조회로 바뀌며 파일이 612줄이 되어 래칫에 걸렸고,
 *     이 레인은 이미 자기 상수(`SWEEP_*`)와 자기 쿼리 SSOT(`kakao-sweep-query.ts`)를 갖고 있어
 *     잘라내기 가장 자연스러운 경계였다. 호출부 계약 유지를 위해 `company-collect.ts` 가 재수출한다
 *     (worker-ads 의 동적 import 3곳이 그 경로를 부른다 — 경로를 바꾸면 조용히 못 찾는다).
 *
 *   🎯 줄 세우기·인터리브 SSOT: `kakao-sweep-query.ts` (자주 틀리는 자리라 따로 뒀다).
 */
import type { Env } from '@/worker/types/env'
import { type FetchBudget } from './influencer-discovery'
import { subreqCapKey, resolveSubreqBudget, nextSubreqCap, envSubreqCap, envPlanValue, rowsWorthReading } from './collect-budget'
import { KAKAO_SWEEP_SOURCES_SQL, KAKAO_SWEEP_PER_SOURCE_SQL, interleaveBySource, tallySweep, parseSweepSources, shouldRefreshSources, type KakaoSweepRow, type SweepSourceTally } from './kakao-sweep-query'
import { ensureCompanySchema } from './company-discovery'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

/* ── ☎️ 카카오 전용 전화 스윕(2026-07-27 대표 "더 빠르고 정확히는?") ──────────────────
 *   보류 10만+ 의 대부분은 오프라인 업체 = 목표가 **전화**인데, 통합 보강은 예산 1/3 만 전화에 써서
 *   카카오 무료 쿼터(10만/일)가 크게 놀았음. 이 레인은 카카오만(1건=1콜, 네이버·크롤 무접촉) 대량 순회:
 *   허위 0: kakaoLocalLookup 은 상호+주소 매칭 실패 시 null(기존 SSOT 그대로).
 *
 *   🎯 2026-07-28 **우선순위 전환** — 라이브 실측이 시킨 변경:
 *     tier1·2(실제 콜드 접촉할 풀) 5,218곳 중 전화 없는 행이 **2,594곳뿐**인데, 이 스윕은 `ORDER BY id ASC`
 *     로 12만 행을 **입고 순서대로** 훑고 있었다. 무료 플랜 실효 처리량이 시간당 ~50건이라 tier1 에 닿는 데
 *     몇 달이 걸린다("일주일이면 끝난다"던 위 주석은 600건/시간을 전제한 것으로, 그 전제가 틀렸다).
 *     → **tier 오름차순**으로 훑는다. tier1·2 는 이틀이면 채워지고, 접촉 가능 풀이 2,624 → 5,200 으로 2배가 된다.
 *
 *   🔁 진행 방식도 id 커서 → **시도 도장(`kakao_checked_at`) + 30일 쿨다운** 으로 바꾼다.
 *     id 커서는 정렬이 id 순일 때만 성립한다 — 우선순위 정렬과 함께 쓰면 커서가 tier1 을 지나쳐 버린다.
 *     도장 방식은 보강 레인(`enrich_checked_at`)이 이미 쓰는 검증된 패턴이고, 실패한 행이 앞줄을 영원히
 *     막지 않게 해준다(그 사고가 `check-crawl-cooldown` 가드의 유래다).
 *
 *   🧮 D1 도 서브리퀘스트다 — 예전엔 kakao fetch 만 세고 UPDATE 는 공짜로 쳤다(보강 레인에서 이미 고친 결함).
 *     도장·전화저장을 **배치 1회씩**으로 묶고 예산에 계상한다. */
/**
 * @returns `tried`/`limit_hit` 는 **self-chain 판정용**(2026-07-29) — 체인이 "진전이 있었나"를 알아야
 *   한 건도 못 한 라운드를 40번 반복하는 헛돌기를 막는다. `done`=대상 소진.
 */
/**
 * 🧾 **루프가 남겨야 하는 부기(簿記) 몫** — 2026-07-29 라이브 실측 후 정정.
 *
 * 루프 뒤에는 D1 쓰기/읽기가 **4회** 따라온다:
 *   ① 전화 확보분 배치 저장 ② 시도 도장 배치 ③ 학습 상한 갱신 ④ **자기 스탬프**
 *   (2026-08-30: 예전의 ④ '직전 통계 조회' 는 **회차 앞으로 옮겼다** — 소스 목록 캐시가 같은
 *    블롭에 얹혀 있어 시작할 때 필요하다. 총 횟수는 그대로이고 이 예약분은 여유 2를 남긴다.)
 * 그런데 루프는 `left <= 2` 에서 멈췄다 — 2만 남기고 5를 쓰려 했으니 뒤쪽 3개가 예산 밖이다.
 * D1 도 서브리퀘스트라 예산을 넘기면 던지고, 전부 `.catch(() => null)` 이라 **조용히 사라진다.**
 * 그리고 하필 마지막이 자기 스탬프다 ⇒ **레인이 돌았는데 "안 돈 것"처럼 보인다.**
 *
 * 실측(2026-07-29): 이 레인은 매시간 디스패치되는데 `ads_kakao_sweep_stats.last_run` 이 13:01 에
 * 멈춰 있었다. 같은 블록의 `reclassify` 는 매시간 갱신됐다 — 차이는 그쪽이 예산을 안 쓴다는 것뿐이다.
 *
 * ⚠️ 이 상수는 **아래 실제 쓰기 횟수와 맞물려 있다.** 쓰기를 추가하면 이 값도 함께 올릴 것
 *   (안 올리면 또 조용히 마지막 것부터 잘린다 — 그게 이 주석이 존재하는 이유다).
 * ⚠️ 이것으로도 못 막는 경우: **플랫폼 한도**(`budget.limitHit`)를 실제로 친 회차는 이후 어떤
 *   서브리퀘스트도 못 쓴다. 그건 예약으로 해결되지 않는다(그래서 한도 자체를 학습해 낮춘다).
 */
const SWEEP_BOOKKEEPING_RESERVE = 6

/**
 * ⏱️ **회차 벽시계 마감선** (2026-08-03 — 대표 승인 "다른 고비용 레인도 같은 방식으로")
 *
 * 이 스윕은 실측 **31초**를 썼다(`cpu_risk=danger`, 침묵 목록 1위). 예산(`budget.left`)은
 * **요청 수**만 세는데, 카카오 조회 한 번의 *응답 시간*은 아무도 안 본다 — 예산이 남아 있는 한
 * 느린 응답이 계속 쌓여 부모 cron 의 CPU 를 태운다(`dispatch-budget.ts` 가 기록한 그 구조:
 * 부모가 죽으면 매달린 자식이 전부 끌려간다).
 *
 * ⚠️ **"기아 걱정 없다"던 옛 주석은 틀렸다**(2026-08-04 실측이 반증) — 도장은 시도분에만 찍히지만
 *   30일 쿨다운이 **한 바퀴(411일)보다 짧아** 앞줄이 계속 재적격됐다. 수리: 아래 `ORDER BY` 주석.
 */
const SWEEP_RUN_DEADLINE_MS = 12_000
const SWEEP_RUN_DEADLINE_MS_PAID = 24_000

export async function runKakaoPhoneSweep(env: Env): Promise<{ scanned: number; found: number; cursor: number; done: boolean; tried?: number; limit_hit?: boolean; day_lookups?: number }> {
  const DB = adsLeadsDb(env)
  const schemaSpent = await ensureCompanySchema(DB) // 스키마 DDL 실비(아래 예산에서 차감)
  const { kakaoLocalLookup } = await import('./contact-enrich')
  const key = env.KAKAO_REST_API_KEY || ''
  if (!key) return { scanned: 0, found: 0, cursor: 0, done: false }
  const cap = Math.min(600, Math.max(50, parseInt((env as unknown as { ADS_KAKAO_SWEEP_CAP?: string }).ADS_KAKAO_SWEEP_CAP || '', 10) || 600))
  // 🩹 2026-07-28 근본수리(실측: "주소는 있는데 전화가 없는" 리드 1만+): 이 스윕은 예산 객체를 안 넘겨
  //   회당 600 fetch 를 무통제로 쏘았고, 서브리퀘스트 한도를 넘으면 이후 조회가 전부 조용히 실패했다.
  //   그런데 커서는 **무조건 마지막 행까지 전진**해서, 한 건도 못 받은 라운드의 600건이 통째로 건너뛰어졌다
  //   (`id > cursor` 라 커서가 한 바퀴 돌 때까지 영구 방치 — 백로그 규모상 8일+). 스윕이 '지나갔지만
  //   실제로는 조회한 적 없는' 행이 계속 쌓인 이유. → ① 학습 상한 안에서만 쏘고 ② **실제 처리한 행까지만
  //   커서를 전진**시킨다(시도 못 한 행은 다음 라운드에 다시 잡히게).
  const learnedCap = Math.max(0, parseInt((await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(subreqCapKey('kakao_sweep'))
    .first<{ value: string }>().catch(() => null))?.value || '', 10) || 0)
  // ⚠️ 2026-07-28: 예산은 `cap`(env 천장 600)이 아니라 **학습 상한과의 더 작은 쪽**에서 시작한다.
  //   소비량을 `cap - budget.left` 로 계산하면(예전 코드) 학습값 63 으로 시작했는데 600 기준으로 재서
  //   실제의 ~10배가 나온다 → 한도 오류 시 백오프가 `floor(590*0.8)=472` 로 **상한을 오히려 폭등**시켰다
  //   (되내려와야 할 안전판이 거꾸로 작동). 시작값을 명시 상수로 잡아 두 곳이 어긋날 수 없게 한다.
  // 🧱 플랫폼 천장 — 학습 상한이 이 값을 넘지 못한다(기본 60, 근거·조정법은 collect-budget 주석).
  const pcap = envSubreqCap(env)
  const budgetTotal = resolveSubreqBudget(cap, learnedCap, pcap)
  const budget: FetchBudget = { left: budgetTotal - schemaSpent }
  // 🧮 **예산이 못 쓸 행은 읽지도 않는다** (2026-08-04). 예전엔 `LIMIT cap`(최대 600)을 읽고 나서
  //   예산을 셌는데 천장이 무료 캡(기본 60)이라 시도 가능한 행은 ~50개뿐 — 550행은 역직렬화만
  //   되고 아래 `break` 에 버려졌다. 실측: 이 레인이 6,640ms 에 CPU 한도로 사망(벽시계 마감 12s 는
  //   닿지도 못했다 — CPU 는 벽시계를 못 넘으니 그건 대기가 아니라 계산이다).
  //   ⚠️ 대상 불변(잘린 꼬리는 원래 안 쓰던 행, 도장은 시도분에만). 근거·한계: `rowsWorthReading` 헤더.
  const rowCap = rowsWorthReading(budget.left - SWEEP_BOOKKEEPING_RESERVE, cap)
  // 🎯 줄 세우기 SSOT + 두 번의 수리 근거는 `kakao-sweep-query.ts` 헤더(자주 틀리는 자리라 분리했다).
  // 🔀 소스별 상위 N 을 각각 뽑아 코드에서 인터리브한다 — 예전엔 창 함수 한 방이었는데 60건 뽑으려고
  //   31만 행을 정렬했다(회당 165만 행 읽기). 같은 답, 다른 계산법. 근거는 kakao-sweep-query 헤더 ③.
  //   ⚠️ 서브리퀘스트가 1 → (1 + 소스수) 로 는다. **먼저 예산에서 빼고** 시작한다 — 안 빼면
  //     크롤 몫을 조용히 잠식한다(이 레인이 예전에 부기로 예산을 먹힌 것과 같은 클래스).
  // 📦 **직전 통계 블롭을 여기서 읽는다**(예전엔 루프 뒤였다). 소스 목록 캐시가 이 블롭에 얹혀
  //   다니므로 앞으로 옮겨야 쓸 수 있고, 읽는 횟수 자체는 그대로 1회다(부기 몫도 그대로).
  const prevRaw = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_kakao_sweep_stats'").first<{ value: string }>().catch(() => null)
  budget.left -= 1
  let prevBlob: Record<string, unknown> | null = null
  try { prevBlob = prevRaw?.value ? JSON.parse(prevRaw.value) as Record<string, unknown> : null } catch { /* 초기 */ }
  // 🕐 소스 목록은 회차마다 달라지는 값이 아니다 — 새 수집기가 생길 때만 바뀐다. 그런데 그 조회가
  //   라이브에서 **35.5만 행**이라(이유는 kakao-sweep-query 헤더의 정정) 매 회차 다시 세는 건 낭비다.
  //   ⚠️ 그렇다고 캐시만 믿으면 새 소스가 영원히 안 보인다 — TTL 이 그 위험의 상한이다.
  const cached = parseSweepSources(prevBlob)
  const refreshSources = shouldRefreshSources(cached, Date.now())
  let sources: string[]
  if (refreshSources) {
    const srcRows = (await DB.prepare(KAKAO_SWEEP_SOURCES_SQL).all<{ source: string | null }>().catch(() => null))?.results
    budget.left -= 1
    // 조회 실패는 **빈 목록이 아니라 중단**이다 — 빈 목록으로 진행하면 "대상이 없다"로 조용히 기록된다.
    //   ⚠️ 캐시로 폴백하지도 않는다: 실패는 "대상이 그대로일 것"의 근거가 못 된다.
    if (!srcRows) return { scanned: 0, found: 0, cursor: 0, done: false }
    sources = srcRows.map(r => r.source).filter((x): x is string => !!x)
  } else {
    sources = cached!.sources
  }
  const sourcesAt = refreshSources ? Date.now() : cached!.at
  budget.left -= sources.length
  const perSource: KakaoSweepRow[][] = []
  for (const src of sources) {
    const got = (await DB.prepare(KAKAO_SWEEP_PER_SOURCE_SQL)
      .bind(src, rowCap).all<KakaoSweepRow>().catch(() => null))?.results
    if (got) perSource.push(got)
  }
  const rows = interleaveBySource(perSource, rowCap)
  if (!rows.length) return { scanned: 0, found: 0, cursor: 0, done: true }
  let found = 0
  const startedAt = Date.now()
  const runDeadlineMs = envPlanValue(undefined, SWEEP_RUN_DEADLINE_MS, SWEEP_RUN_DEADLINE_MS_PAID, env)
  let stoppedBy: string | undefined
  const tried: number[] = []                                   // 시도한 행 → 도장(배치 1회)
  const hits: Array<{ id: number; phone: string }> = []        // 전화 확보분 → 저장(배치 1회)
  const bySource: SweepSourceTally = {}                        // 📊 소스별 적중률 — 다음 단계(수율 가중)의 근거
  for (const r of rows) {
    if (budget.left <= SWEEP_BOOKKEEPING_RESERVE || budget.limitHit) { stoppedBy = 'budget'; break } // 아래 부기 몫을 남겨둔다(상수 주석 참조)
    if (Date.now() - startedAt > runDeadlineMs) { stoppedBy = 'deadline'; break }
    const k = await kakaoLocalLookup(key, r.company_name, r.region, r.address, budget)
    if (budget.limitHit) break // 한도 도달 — 이 행은 조회된 적 없으므로 도장도 찍지 않는다(다음 라운드 재시도)
    tried.push(r.id)
    tallySweep(bySource, r.source, !!k.phone)
    if (k.phone) { found++; hits.push({ id: r.id, phone: k.phone }) }
  }
  // 💾 쓰기는 배치로 — 건건이 쓰면 부기(簿記)가 예산을 먹어 크롤 기회를 줄인다(보강 레인과 동일 교훈).
  if (hits.length) {
    budget.left -= 1
    await DB.batch(hits.map(h => DB.prepare(
      "UPDATE ad_company_leads SET phone = COALESCE(phone, ?), contact_source = COALESCE(contact_source, 'kakao'), active = 1 WHERE id = ?",
    ).bind(h.phone, h.id))).catch(() => null)
  }
  if (tried.length) {
    budget.left -= 1
    // 숫자 id 만 보간 — 바인딩 개수 가변 회피(D1 문장당 100개 제한과 무관하게 안전).
    await DB.prepare(`UPDATE ad_company_leads SET kakao_checked_at = datetime('now') WHERE id IN (${tried.join(',')})`)
      .run().catch(() => null)
  }
  const nextCap = nextSubreqCap(budgetTotal - budget.left, !!budget.limitHit, learnedCap, cap, pcap)
  if (nextCap != null) await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(subreqCapKey('kakao_sweep'), String(nextCap)).run().catch(() => null)
  // (직전 통계는 회차 앞에서 이미 읽었다 — 소스 목록 캐시가 같은 블롭에 있기 때문.)
  const totalFound = Number(prevBlob?.total_found) || 0
  const prevDay = String(prevBlob?.day || ''); const prevDayLookups = Number(prevBlob?.day_lookups) || 0
  // 📊 하루 조회량(2026-07-29) — self-chain 으로 처리량을 올리기 전에 **카카오 일일 쿼터 소비를 눈으로 보고**
  //   판단하기 위한 계수기. 같은 stats 블롭에 얹으므로 추가 쿼리 0. KST 기준으로 리셋.
  const kstToday = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
  const dayLookups = prevDay === kstToday ? prevDayLookups : 0
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind('ads_kakao_sweep_stats', JSON.stringify({
    last_run: new Date().toISOString().slice(0, 19).replace('T', ' '), scanned: rows.length, found, tried: tried.length, total_found: totalFound + found,
    day: kstToday, day_lookups: dayLookups + tried.length,
    // 📊 이번 회차의 소스별 시도/적중. **아직 아무 판정에도 안 쓴다** — 증거 없이 가중하면
    //   "storeinfo 수율 2.7%니 잘라내자"(실은 한 번도 조회된 적 없었다) 오판을 반복한다.
    by_source: bySource,
    // 🕐 소스 목록 캐시 — 다음 회차가 이걸 보고 35.5만 행 조회를 건너뛴다. **시각을 같이 저장해야**
    //   TTL 판정이 된다(시각 없이 목록만 저장하면 영원히 안 늙는 캐시가 되어 새 소스가 굶는다).
    sources, sources_at: sourcesAt,
    limit_hit: !!budget.limitHit, // 한도로 조기 중단했는가 — true 면 남은 행은 커서 미전진(다음 라운드 재시도)
    // 📟 왜 멈췄는지 — 'deadline' 이면 예산이 아니라 시간이 병목이다(둘의 처방이 다르다).
    stopped_by: stoppedBy,
  })).run().catch(() => null)
  return { scanned: rows.length, found, cursor: 0, done: false, tried: tried.length, limit_hit: !!budget.limitHit, day_lookups: dayLookups + tried.length }
}
