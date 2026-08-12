/**
 * 📢 공고 스캐너 엔진 — 나라장터 입찰공고 + 기업마당 지원사업 (2026-07-22).
 *   "상권활성화·소상공인·마케팅·창업" 키워드로 전일~당일 공고를 스캔 → gov_notices.
 *   게이트 `ADS_NOTICE_ENABLED`. 키 `PUBLIC_DATA_SERVICE_KEY`.
 *   ⚠️ 엔드포인트/필드/오퍼레이션(업무구분)은 표준 기준(placeholder) — 활용가이드로 확정. 방어적 파싱 + diag.
 *   설계 SSOT: docs/design/partner-company-collection.md §12.
 */
import type { Env } from '@/worker/types/env'
import { envLaneBudget, envPlanValue } from './collect-budget'
import { ensureNoticeSchema, saveNotices, type GovNotice } from './gov-notices'
import { serviceKeyParam, isNoValue, describePublicDataFailure } from './public-data-diag'

// ✅ 실 엔드포인트(대표 활용신청 승인 화면 확인 2026-07-27): 조달청_나라장터 **공공데이터개방표준서비스**
//   /1230000/ao/PubDataOpnStdService — 입찰공고는 날짜구간 조회(getDataSetOpnStdBidPblancInfo) 후 키워드를
//   우리 쪽에서 필터(개방표준은 구간 조회가 표준 — 검색 파라미터 미보장). 이전 BidPublicInfoService 는 placeholder.
//   (같이 승인된 사용자정보서비스 UsrInfoService02 는 조달업체 명부 — 공고 스캔과 무관, 미배선.)
const NARA_BASE = 'https://apis.data.go.kr/1230000/ao/PubDataOpnStdService'
/**
 * 🏢 기업마당(중기부) 지원사업 공고 — **대표가 공유한 포털 화면으로 확정**(2026-08-12).
 *
 * 🩸 그전 값은 `hpsBnaSituService/getSupportBusinessList` 였고 **주소와 오퍼레이션이 둘 다 틀렸다.**
 *   게이트웨이가 `NO_OPENAPI_SERVICE_ERROR`(코드 12)를 돌려줬는데, 그 코드는 *주소 부재*와
 *   *오퍼레이션 오타*를 구분하지 못한다 — 그래서 몇 달간 `grant: 0` 이었고 원인을 못 좁혔다.
 *   이 환경은 `apis.data.go.kr` 프록시 차단이라 **찔러볼 수가 없어** 화면이 유일한 확정 수단이었다.
 *
 *   확정값: End Point `https://apis.data.go.kr/1421000/bizinfo` · 상세기능 `/pblancBsnsService`
 */
const BIZINFO_BASE = 'https://apis.data.go.kr/1421000/bizinfo'
export const BIZINFO_OP = 'pblancBsnsService'
/**
 * 🔎 스캔 키워드 — **그물의 크기**. 회전 커서가 있어 한 회차에 다 못 봐도 다음 회차가 이어받는다.
 *
 *   2026-08-10 확장(대표 "지원사업 DB도 받고 싶어"): 기존 5개는 **상권/창업 축만** 덮었다.
 *   지원사업 공고는 *"지원사업·바우처·컨설팅·판로·온라인 진출"* 같은 말로 올라오는데 그 말이 하나도
 *   없었다 — 그물이 좁아서 못 잡은 것이지 공고가 없던 게 아니다.
 *   ⚠️ 키워드 하나 = 회차당 요청 1개다. 무료 플랜 인보케이션 예산(50~60)을 넘기지 않게
 *     **회전 커서**가 잘라서 돈다(기아 0 — `KW_CURSOR_KEY`).
 */
const KEYWORDS = [
  '상권활성화', '소상공인', '마케팅', '창업', '상권',
  '지원사업', '바우처', '컨설팅', '판로', '온라인 진출', '전통시장', '골목상권',
]
const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()
// ⚠️ 별칭 폴백은 `isNoValue` 를 통과해야 한다 — 포털이 '값 없음'을 `"N/A"` 문자열로 주는데 truthy 라
//   앞 별칭에서 걸리면 **뒤 별칭의 진짜 값을 건너뛴다**(통신판매에서 주소 31.7% 를 그렇게 잃었다).
const g = (it: Record<string, unknown>, ...keys: string[]): string => { for (const k of keys) { const v = it[k]; if (!isNoValue(v)) return stripTag(v) } return '' }

function pickArray(data: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!data) return []
  const body = ((data.response as Record<string, unknown>)?.body ?? data.body ?? data) as Record<string, unknown>
  let items = (body?.items ?? body?.item ?? data.data ?? (data as Record<string, unknown>).jsonArray ?? []) as unknown
  if (items && !Array.isArray(items) && typeof items === 'object') items = (items as Record<string, unknown>).item ?? []
  return Array.isArray(items) ? items as Record<string, unknown>[] : []
}

/**
 * 🩺 **실패 사유를 돌려준다** — 예전엔 네트워크·HTTP·JSON 실패를 전부 `null` 로 삼켰다.
 *
 *   그래서 기업마당(지원사업) 경로가 **10회 실행 내내 `grant: 0` 인데 `error` 는 비어 있었다**(실측).
 *   0건이 '오늘 공고가 없어서'인지 '주소가 틀려서'인지 화면에서 구분되지 않으니, 아무도 못 고친다 —
 *   공정위 가맹 레인이 오퍼레이션 이름 하나로 21회를 버린 것과 **정확히 같은 클래스**다.
 *   ⇒ `describePublicDataFailure`(public-data-diag SSOT)로 본문의 원인 코드까지 회수한다.
 */
async function fetchJson(url: string, budget: { left: number }): Promise<{ data: Record<string, unknown> | null; msg?: string }> {
  if (budget.left <= 0) return { data: null, msg: '예산 소진' }
  budget.left -= 1
  let res: Response | null = null
  try { res = await fetch(url, { signal: AbortSignal.timeout(15000) }) } catch (err) {
    return { data: null, msg: `네트워크: ${String((err as Error)?.message || '').slice(0, 80)}` }
  }
  if (!res.ok) return { data: null, msg: await describePublicDataFailure(res, `HTTP ${res.status}`) }
  const raw = await res.text().catch(() => '')
  try { return { data: JSON.parse(raw) as Record<string, unknown> } } catch {
    // JSON 을 요청했는데 XML/HTML 이 오면 대개 인증키·주소 문제다 — 본문 앞부분이 그걸 말해 준다.
    return { data: null, msg: raw.slice(0, 160).replace(/<[^>]+>/g, ' ').trim() || '비JSON 응답' }
  }
}

export interface NoticeStats { last_run: string; found: number; saved: number; bid: number; grant: number; total_runs: number; diag: { configured: boolean; error?: string; sampleBid?: unknown; sampleGrant?: unknown; stoppedBy?: string; kwFrom?: number } }
const STATS_KEY = 'ads_notice_stats'
/** 키워드 회전 커서 — 마감선에 잘려도 매 회차 같은 앞쪽만 보지 않게. */
const KW_CURSOR_KEY = 'ads_notice_kw_cursor'

/**
 * ⏱️ **회차 벽시계 마감선** (2026-08-03 — 대표 승인 "건당 비용 절감")
 *
 * 이 레인은 실측 **31초**를 썼다(하트비트 상위 4위, `cpu_risk=danger`). 그런데 예산은
 * `budget.left = 20` 인데 **실제 호출은 6번뿐**(입찰 1 + 키워드 5)이라 **예산이 한 번도 안 걸린다.**
 * 즉 이 레인의 비용은 *요청 수*가 아니라 **시간**인데, 시간을 재는 것이 아무것도 없었다.
 *
 * 공공 API 한 번이 `AbortSignal.timeout(15000)` 까지 버티므로 최악 6×15 = **90초**가 한 인보케이션에
 * 들어온다. 부모(cron 디스패처)의 CPU 예산은 그걸 못 버틴다 — `ads:scan-notices` 가 침묵 목록에
 * 올라 있던 이유다(`dispatch-budget.ts` 가 설명하는 "부모가 죽으며 자식을 끌고 간다").
 *
 * ⚠️ **마감선은 일을 줄이지 않는다 — 회차를 나눌 뿐이다.** 그래서 아래 회전 커서가 짝이다.
 *    커서 없이 마감선만 넣으면 뒤쪽 키워드가 **영원히** 안 돈다(구조적 기아 — 같은 파일에서
 *    이미 한 번 나온 클래스). 둘은 반드시 같이 간다.
 */
const RUN_DEADLINE_MS = 12_000
const RUN_DEADLINE_MS_PAID = 24_000

export async function runNoticeScan(env: Env): Promise<NoticeStats> {
  const DB = env.DB
  await ensureNoticeSchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const key = env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const naraBase = (env as unknown as { ADS_NARA_ENDPOINT?: string }).ADS_NARA_ENDPOINT || NARA_BASE
  const bizBase = (env as unknown as { ADS_BIZINFO_ENDPOINT?: string }).ADS_BIZINFO_ENDPOINT || BIZINFO_BASE
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: NoticeStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as NoticeStats : null } catch { prev = null }
  const persist = async (s: NoticeStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  if (!key) { const s: NoticeStats = { last_run: stamp, found: 0, saved: 0, bid: 0, grant: 0, total_runs: (prev?.total_runs || 0) + 1, diag: { configured: false, error: 'NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정' } }; await persist(s); return s }

  const budget = { left: Math.max(6, envLaneBudget(env.ADS_COMPANY_SUBREQUEST_BUDGET, 20, env)) }
  const startedAt = Date.now()
  const runDeadlineMs = envPlanValue(undefined, RUN_DEADLINE_MS, RUN_DEADLINE_MS_PAID, env)
  let stoppedBy: string | undefined
  let bid = 0, grant = 0, sampleBid: unknown, sampleGrant: unknown
  let bidMsg: string | undefined, grantMsg: string | undefined
  const all: GovNotice[] = []

  // 🔄 키워드 회전 — 이번 회차가 어디서 시작하는지. 마감선에 잘린 뒤쪽이 다음 회차의 앞이 된다.
  const kwCurRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(KW_CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let kwFrom = parseInt(kwCurRaw?.value || '0', 10)
  if (!Number.isFinite(kwFrom) || kwFrom < 0) kwFrom = 0
  kwFrom %= KEYWORDS.length

  // ── 나라장터 입찰(개방표준) — 최근 3일 구간 일괄 조회 후 키워드는 우리 쪽 필터(호출 1회로 전 키워드 커버) ──
  {
    const p2 = (n: number) => String(n).padStart(2, '0')
    const ymdhm = (d: Date, hm: string) => `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}${hm}`
    const now = new Date()
    const bgn = ymdhm(new Date(now.getTime() - 3 * 86400000), '0000')
    const end = ymdhm(now, '2359')
    const url = `${naraBase}/getDataSetOpnStdBidPblancInfo?serviceKey=${serviceKeyParam(key)}&pageNo=1&numOfRows=300&type=json&bidNtceBgnDt=${bgn}&bidNtceEndDt=${end}`
    const r = await fetchJson(url, budget)
    if (r.msg) bidMsg = r.msg
    const items = pickArray(r.data)
    if (!sampleBid && items[0]) sampleBid = items[0]
    for (const it of items) {
      const title = g(it, 'bidNtceNm', 'ntceNm')
      const kw = KEYWORDS.find(k => title.includes(k))
      if (!kw) continue // 상권/소상공인/마케팅 관련 공고만
      const no = g(it, 'bidNtceNo', 'ntceNo')
      if (!no) continue
      all.push({
        source: 'bid', notice_no: no, title, org: g(it, 'ntceInsttNm', 'dminsttNm') || null,
        biz_field: g(it, 'bsnsDivNm') || '입찰', url: g(it, 'bidNtceUrl', 'bidNtceDtlUrl') || null, amount: g(it, 'presmptPrce', 'asignBdgtAmt') || null,
        posted_date: g(it, 'bidNtceDt', 'bidNtceDate').slice(0, 10) || null, end_date: g(it, 'bidClseDt', 'bidClseDate', 'opengDt').slice(0, 10) || null, keyword: kw,
      })
      bid++
    }
  }
  // ── 기업마당 지원사업 — 키워드 검색 (회전 시작점부터 한 바퀴) ──
  let kwDone = 0
  for (let i = 0; i < KEYWORDS.length; i++) {
    const kw = KEYWORDS[(kwFrom + i) % KEYWORDS.length]
    if (budget.left <= 0) { stoppedBy = 'budget'; break }
    if (Date.now() - startedAt > runDeadlineMs) { stoppedBy = 'deadline'; break }
    kwDone++
    // ⚠️ 포맷 파라미터가 **`dataType`** 이다(`resultType` 아님 — 공정위 쪽과 이름이 다르다).
    //   검색은 `hashtags`(포털 요청변수 표) — 종전의 `searchCnst` 는 이 서비스에 없는 이름이었다.
    const url = `${bizBase}/${BIZINFO_OP}?serviceKey=${serviceKeyParam(key)}&numOfRows=30&pageNo=1&dataType=json&hashtags=${encodeURIComponent(kw)}`
    const r = await fetchJson(url, budget)
    if (r.msg) grantMsg = r.msg
    const items = pickArray(r.data)
    if (!sampleGrant && items[0]) sampleGrant = items[0]
    for (const it of items) {
      const no = stripTag(it.pblancId || it.pblancSn)
      if (!no) continue
      all.push({
        source: 'grant', notice_no: no, title: stripTag(it.pblancNm), org: stripTag(it.jrsdInsttNm || it.excInsttNm) || null,
        biz_field: stripTag(it.pldirSportRealmLclasCodeNm) || '지원사업', url: stripTag(it.pblancUrl || it.rceptEngnHmpgUrl) || null,
        posted_date: stripTag(it.creatPnttm).slice(0, 10) || null, end_date: stripTag(it.reqstEndDe).slice(0, 10) || null, keyword: kw,
      })
      grant++
    }
  }

  const saved = await saveNotices(DB, all).catch(() => 0)

  // 🔄 다음 회차는 이번에 **못 본 키워드**부터. 잘려도 한 바퀴는 반드시 돈다(기아 0).
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(KW_CURSOR_KEY, String((kwFrom + kwDone) % KEYWORDS.length)).run().catch(() => null)

  const s: NoticeStats = {
    last_run: stamp, found: all.length, saved, bid, grant, total_runs: (prev?.total_runs || 0) + 1,
    // 📟 왜 멈췄는지를 남긴다 — 없으면 "적게 걷혔다"가 고장인지 마감선인지 구분이 안 된다.
    // 🔎 **0건인 축의 사유만** 올린다 — 정상 축의 잡음 없이 "무엇이 왜 비었는가"가 한 줄로 보인다.
    //   축마다 따로 남기는 이유: 한쪽만 죽는 경우가 실제였다(입찰 15건 ↔ 지원사업 0건).
    diag: { configured: true, sampleBid, sampleGrant, stoppedBy, kwFrom,
      error: [bid === 0 && bidMsg ? `입찰: ${bidMsg}` : '', grant === 0 && grantMsg ? `지원사업: ${grantMsg}` : ''].filter(Boolean).join(' · ') || undefined },
  }
  await persist(s)
  return s
}
