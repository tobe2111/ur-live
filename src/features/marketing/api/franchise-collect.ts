/**
 * 🏢 파트너 수집 — 공정위 가맹사업 브랜드 목록 (공정거래위원회, data.go.kr 1130000) — 2026-07-23.
 *   프랜차이즈 **본사/브랜드**(브랜드명·법인명·대표·사업자번호·업종·주요상품)를 발굴 → `ad_company_leads` source='franchise'.
 *   가맹점 확장 중인 본사 = 유어딜에 매장을 다수 데려올 수 있는 파트너.
 *
 *   ✅ 실 엔드포인트(2026-08-05 **포털 Swagger 화면으로 확정**): FftcBrandRlsInfo2_Service / `getBrandinfo`.
 *      🩸 그전엔 `getBrandList` 였고 **21회 연속 실패**했다(`NO_OPENAPI_SERVICE_ERROR`). 승인·활용기간·키
 *      전부 정상인데 **오퍼레이션 이름 하나가 틀려서**였다. 07-23 주석은 "웹 확인"이라 적혀 있었지만
 *      실제로는 확인된 적이 없었다 — 이 환경은 `apis.data.go.kr` 이 프록시 차단이라 **찔러볼 수가 없고**,
 *      그래서 "확인했다"는 문장만 남고 검증은 비어 있었다(문서가 증거를 대신한 자리).
 *      ⚠️ 대소문자 주의: `getBrandInfo` 가 아니라 **`getBrandinfo`**(Swagger 의 응답 모델도 같은 표기).
 *   ⚠️ 이 API 는 **연락처(전화/이메일)를 직접 주지 않음**(브랜드·법인·사업자번호까지). 연락처는 **보강 단계**에서
 *      네이버 홈페이지 검색(브랜드명)→크롤로 확보(프랜차이즈 본사는 홈페이지 보유율 높아 이메일 수율 우수).
 *      → requireContact:true 로 저장(보류) → enrichHeldLeads 가 브랜드명으로 홈페이지 찾아 이메일/전화 채움.
 *
 *   게이트 `ADS_FRANCHISE_ENABLED`. 키 `PUBLIC_DATA_SERVICE_KEY`. ADS_FRANCHISE_ENDPOINT/OP 로 override.
 *   설계 SSOT: docs/design/partner-company-collection.md §12.
 */
import type { Env } from '@/worker/types/env'
import { saveCompanyLeads, ensureCompanySchema, type CompanyLead } from './company-discovery'
import { describePublicDataFailure, serviceKeyParam, laneShouldSkip, updateLaneHealth, laneHealthNote, type LaneHealth, isNoValue } from './public-data-diag'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

export const FRANCHISE_BASE = 'https://apis.data.go.kr/1130000/FftcBrandRlsInfo2_Service'
export const FRANCHISE_OP = 'getBrandinfo'
/**
 * 🔁 오퍼레이션 후보 — 첫 이름이 `NO_OPENAPI_SERVICE_ERROR`(=그 주소가 없음) 면 **다음 이름으로 한 번 더** 쏜다.
 *
 *   이 환경에서 `apis.data.go.kr` 은 프록시 차단이라 **개발 중에 이름을 검증할 방법이 없다.** 07-23 에
 *   그래서 못 맞춘 이름 하나로 21회를 버렸다. Swagger 화면으로 `getBrandinfo` 를 확정했지만 화면 글자가
 *   작아 대소문자를 100% 단정하기 어렵다 — **추측을 코드에 굳히는 대신 한 번의 실측으로 스스로 정하게** 한다.
 *   ⚠️ 후보는 **주소 부재(코드 12)일 때만** 넘어간다. 키·트래픽·파라미터 오류에 후보를 돌리면 같은 실패를
 *      N배로 반복해 예산만 태운다.
 */
const FRANCHISE_OP_FALLBACKS = ['getBrandInfo', 'getBrandList'] as const
/** 실측으로 확정된 이름을 기억한다 — 다음 회차부터 첫 시도에 맞는다(재시도 0). */
const OP_KEY = 'ads_franchise_op'
/**
 * 📅 **연도(`yr`) 자가치유** — 오퍼레이션 이름과 **똑같은 클래스**의 두 번째 함정.
 *
 *   2026-08-09 실측: 봉투 오독을 고치자 비로소 진짜 사유가 보였다 —
 *   `NO_OPENAPI_SERVICE_ERROR`(코드 12, 주소 없음)가 **사라지고** `ESSENTIAL_PARAMETER_ERROR`
 *   (코드 11, 필수 파라미터 누락)로 바뀌었다. 즉 **이름은 맞았고 파라미터가 빈 것**이다.
 *   우리가 안 보내는 파라미터는 `yr`(연도) 하나뿐이다(정보공개서는 연 단위로 등록된다).
 *
 *   ⚠️ 그렇다고 연도를 코드에 박지 않는다 — 박으면 **내년에 같은 자리에서 또 죽는다.**
 *   이름 때와 같은 방식으로 **한 번 실측해 스스로 정하게** 한다: 코드 11 이면 최근 연도부터
 *   차례로 한 번씩 시도하고, 맞은 값을 저장해 다음 회차부터 첫 시도에 맞춘다.
 *   ⚠️ **코드 11 일 때만** 넘어간다 — 키·트래픽 오류에 연도를 돌리면 같은 실패를 N배로 반복한다.
 */
/**
 * 📛 **연도 파라미터의 진짜 이름** — 대표가 공유한 포털 요청변수 화면으로 확정(2026-08-12).
 *
 * 🩸 2026-08-11 에 나는 *"연도 가설은 기각됐다"* 고 적었다. **그건 반만 맞았다.**
 *   연도가 필요한 것은 맞았고 **이름이 `yr` 이 아니라 `jngBizCrtraYr`(가맹사업기준년도)** 였다.
 *   그래서 자가치유가 2025·2026·2024 를 다 시도해도 전부 실패했다 — 값이 아니라 **키**가 틀렸으니
 *   어떤 값을 넣어도 코드 11 이었다. ⇒ *"자가치유가 돌았다 ≠ 원인을 맞혔다"*(교훈 ⑪)의 정확한 사례이고,
 *   내가 그때 *"다음 후보를 추측하지 말고 화면을 받자"* 로 멈춘 판단은 옳았다.
 * ⚠️ 포털 샘플값이 **2017** 이다 — 최신 연도에 데이터가 없을 수 있으므로 연도 순회는 그대로 둔다.
 */
export const FRANCHISE_YR_PARAM = 'jngBizCrtraYr'
const YR_KEY = 'ads_franchise_yr'
/** 시도할 연도 — 최신부터. 등록이 갱신되는 시차 때문에 '올해'가 아직 비어 있을 수 있다. */
const yearCandidates = (nowMs: number): string[] => {
  const y = new Date(nowMs).getUTCFullYear()
  // ⚠️ 포털 샘플이 2017 이라 **최신 연도가 비어 있을 수 있다.** 최신부터 훑되 몇 해 더 내려간다
  //   (등록 갱신 시차 + 원부가 과거 기준년도로만 채워져 있을 가능성). 회차당 한 번만 도는 순회다.
  return [String(y - 1), String(y), String(y - 2), String(y - 3), String(y - 4)]
}
/** 루프가 자기 기록(오퍼레이션 학습 · 통계 · 커서)에 쓸 몫 — 근거는 루프 위 주석. */
const BOOKKEEPING_RESERVE = 1
/**
 * ⏱️ 회차 벽시계 마감선 — 커서 저장이 루프 **뒤**에 있다는 사실이 이 값을 필수로 만든다.
 *   루프가 인보케이션 한도(≈10.5s)에 맞아 죽으면 저장에 도달하지 못하고 다음 회차가 **같은 페이지를 또
 *   훑는다(전진 0)** — commerce(08-02)·quality(08-03)가 정확히 그렇게 조용히 멈춰 있었다. 에러가 안 뜨니
 *   "느린가 보다"로 읽힌다. 한 페이지 fetch 타임아웃이 15s 라 **한 장만 물려도 회차가 통째로 날아가므로**
 *   스스로 물러나 커서를 남긴다(남은 페이지는 다음 회차가 이어받는다 — 손실 0).
 */
const FRANCHISE_RUN_MS = 6_000
const stripTag = (s: unknown): string => String(s ?? '').replace(/<[^>]+>/g, '').trim()
type RawFranchise = Record<string, unknown>
// ⚠️ 별칭 폴백은 `isNoValue` 를 통과해야 한다 — 포털이 '값 없음'을 `"N/A"` 문자열로 주는데 truthy 라
//   앞 별칭에서 걸리면 **뒤 별칭의 진짜 값을 건너뛴다**(통신판매에서 주소 31.7% 를 그렇게 잃었다).
const g = (it: RawFranchise, ...keys: string[]): string => { for (const k of keys) { const v = it[k]; if (!isNoValue(v)) return stripTag(v) } return '' }

/** 브랜드 1페이지 조회 → RawFranchise[]. 봉투 다형태 방어 + header resultMsg 회수. */
async function fetchBrandPage(base: string, op: string, key: string, page: number, yr: string, budget: { left: number }): Promise<{ items: RawFranchise[]; count: number; msg?: string }> {
  if (budget.left <= 0) return { items: [], count: 0 }
  budget.left -= 1
  const url = `${base}/${op}?serviceKey=${serviceKeyParam(key)}&pageNo=${page}&numOfRows=100&resultType=json${yr ? `&${FRANCHISE_YR_PARAM}=${encodeURIComponent(yr)}` : ''}`
  // 실패 원인을 삼키지 않는다 — 특히 플랫폼 서브리퀘스트 한도는 '네트워크 오류'로 뭉뚱그리면 영영 오진된다
  //   (2026-07-28 보강 레인 실사고와 동일 클래스).
  let res: Response | null = null
  let netMsg = '네트워크 오류'
  try { res = await fetch(url, { signal: AbortSignal.timeout(15000) }) } catch (err) {
    const m = err instanceof Error ? err.message : String(err || '')
    if (/too many subrequests/i.test(m)) netMsg = '⛔ 플랫폼 요청한도 도달(한 번에 너무 많은 페이지) — 페이지 수를 줄여 여러 번 나눠 수집'
  }
  // 🩺 실패 본문을 버리지 않는다 — data.go.kr 은 원인 코드를 본문에 담아 준다(public-data-diag SSOT).
  if (!res || !res.ok) return { items: [], count: 0, msg: await describePublicDataFailure(res, netMsg) }
  const raw = await res.text().catch(() => '')
  let data: Record<string, unknown> | null = null
  try { data = JSON.parse(raw) as Record<string, unknown> } catch { data = null }
  if (!data) return { items: [], count: 0, msg: raw.slice(0, 160).replace(/<[^>]+>/g, ' ').trim() || '비JSON 응답' }
  const resp = (data.response ?? data) as Record<string, unknown>
  // 🩸 2026-08-07 — **결과코드를 `header` 에서만 읽던 것이 실패를 성공으로 보이게 했다.**
  //   이 API 의 응답은 **평평하다**(Swagger 모델 `getBrandinfo_response { resultCode, resultMsg,
  //   numOfRows, pageNo, totalCount, items }`) — `header` 래퍼가 없다. 그래서 `header` 가 undefined 라
  //   `rc`/`rm` 이 빈 문자열이 되고, 아래 `msg` 판정이 **무조건 undefined** 가 됐다.
  //   실측: 오퍼레이션 이름을 고친 뒤 `NO_OPENAPI_SERVICE_ERROR` 는 사라졌는데 `found 0 · error 없음` 이
  //   3회 반복됐다 — 에러가 없는 게 아니라 **에러를 읽는 자리가 비어 있었다**(이 레포가 반복해 만난
  //   "실패가 조용히 성공처럼 보인다" 클래스). ⇒ header **또는 평평한 최상위** 어느 쪽에서든 읽는다.
  const codeSrc = (resp.header ?? resp ?? data) as Record<string, unknown>
  const rc = String(codeSrc.resultCode ?? '')
  const rm = String(codeSrc.resultMsg ?? '')
  const body = (resp.body ?? data.body ?? data) as Record<string, unknown>
  let items = (body?.items ?? body?.item ?? data.data ?? []) as unknown
  if (items && !Array.isArray(items) && typeof items === 'object') items = (items as Record<string, unknown>).item ?? []
  const arr = Array.isArray(items) ? items as RawFranchise[] : (items && typeof items === 'object' ? [items as RawFranchise] : [])
  const ok = (!rc || rc === '00' || rc === '0') && (!rm || /normal|정상|success/i.test(rm))
  // 🔎 **0건이 '정상 0건'인지 '조용한 실패'인지 구분한다.** totalCount 가 있으면 그 값을, 없으면 그 사실을
  //   남긴다 — 안 남기면 다음 세션이 또 "에러 없는데 0건"만 보고 원인을 못 찾는다.
  const total = codeSrc.totalCount ?? body?.totalCount
  const msg = !ok ? `${rc} ${rm}`.trim()
    : (arr.length === 0 ? `응답은 정상(rc=${rc || '없음'})인데 items 0 — totalCount=${total ?? '없음'} · 키=${Object.keys(resp).slice(0, 8).join(',')}` : undefined)
  return { items: arr, count: arr.length, msg }
}

export interface FranchiseStats { last_run: string; found: number; saved: number; page: number; total_runs: number; total_saved: number; diag: { configured: boolean; error?: string; sample?: unknown }; health?: LaneHealth }
const STATS_KEY = 'ads_franchise_stats'
const CURSOR_KEY = 'ads_franchise_cursor'

export async function runFranchiseCollect(env: Env): Promise<FranchiseStats> {
  const DB = adsLeadsDb(env)
  await ensureCompanySchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const key = env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const base = (env as unknown as { ADS_FRANCHISE_ENDPOINT?: string }).ADS_FRANCHISE_ENDPOINT || FRANCHISE_BASE
  // 🔁 오퍼레이션 이름 — env override > **실측으로 확정된 값** > 기본. 확정값이 있으면 후보 순회를 안 한다.
  const learnedOp = (await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(OP_KEY)
    .first<{ value: string }>().catch(() => null))?.value || ''
  const op = (env as unknown as { ADS_FRANCHISE_OP?: string }).ADS_FRANCHISE_OP || learnedOp || FRANCHISE_OP
  const learnedYr = (await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(YR_KEY)
    .first<{ value: string }>().catch(() => null))?.value || ''
  const yr = (env as unknown as { ADS_FRANCHISE_YEAR?: string }).ADS_FRANCHISE_YEAR || learnedYr || ''
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: FranchiseStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as FranchiseStats : null } catch { prev = null }
  const persist = async (s: FranchiseStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  if (!key) { const s: FranchiseStats = { last_run: stamp, found: 0, saved: 0, page: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: false, error: 'NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정' } }; await persist(s); return s }

  // 🩹 하드 실패 백오프(2026-07-29) — 재시도로 낫지 않는 실패(404·활용신청·회원등급)를 두 시간마다 다시
  //   쏘면, 인보케이션당 45~50 뿐인 서브리퀘스트를 **잘 도는 레인에서 빼앗는다**. 물러나되 주기적으로 찔러
  //   대표가 설정을 고치면 배포 없이 스스로 살아난다(public-data-diag SSOT).
  const now = Date.now()
  if (laneShouldSkip(prev?.health, now)) {
    const s: FranchiseStats = { last_run: stamp, found: 0, saved: 0, page: prev?.page || 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: true, error: `대기: ${laneHealthNote(prev?.health, now)}` }, health: prev?.health }
    await persist(s); return s
  }
  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let page = parseInt(curRaw?.value || '1', 10); if (!Number.isFinite(page) || page < 1) page = 1
  // ⚠️ 2026-07-28 수리: 이 레인이 **보강 전용 예산(ADS_ENRICH_BUDGET, 대표 설정값 800)** 을 빌려 쓰고 있었다
  //   → 한 인보케이션에 최대 800페이지 요청 = 플랫폼 서브리퀘스트 한도에 확실히 부딪히는 구조(보강 레인을
  //   죽인 것과 같은 결함). 브랜드 원부는 총 1만 건대라 회당 소량씩 커서로 순회하면 충분하다.
  const pagesPerRun = Math.min(30, Math.max(3, parseInt((env as unknown as { ADS_FRANCHISE_PAGES?: string }).ADS_FRANCHISE_PAGES || '', 10) || 8))
  const budget = { left: pagesPerRun }
  let found = 0, saved = 0, sample: unknown, lastMsg: string | undefined
  let useOp = op, useYr = yr
  // 🧾 **자기 기록 몫을 남긴다** — 이 루프는 이제 안에서 D1 을 쓸 수 있고(오퍼레이션 학습), 뒤에도 쓴다
  //   (통계·커서). D1 도 서브리퀘스트라, 0까지 태우면 그 쓰기들이 던지고 호출부가 전부 `.catch(() => null)`
  //   이라 **조용히 사라진다** — 하필 마지막이 자기 스탬프여서 *"돌았는데 안 돈 것"* 처럼 보인다
  //   (2026-07-30 카카오 스윕·통신판매에서 실제로 그랬다). 이 레인은 48시간에 한 번 도므로
  //   한 페이지를 양보하는 값이 스탬프를 잃는 값보다 훨씬 싸다.
  const runDeadline = now + FRANCHISE_RUN_MS
  for (let i = 0; i < budget.left + 3 && budget.left > BOOKKEEPING_RESERVE && Date.now() < runDeadline; i++) {
    let { items, count, msg } = await fetchBrandPage(base, useOp, key, page, useYr, budget)
    // 🔁 **주소 부재일 때만** 다음 후보로 — 첫 페이지에서 한 번만 시도한다(예산 낭비 방지).
    //   맞는 이름을 찾으면 저장해 다음 회차부터 재시도 0. 근거: `FRANCHISE_OP_FALLBACKS` 주석.
    if (i === 0 && !count && msg && /NO_OPENAPI_SERVICE_ERROR/i.test(msg)) {
      for (const cand of FRANCHISE_OP_FALLBACKS) {
        if (cand === useOp || budget.left <= 0) continue
        const r = await fetchBrandPage(base, cand, key, page, useYr, budget)
        if (r.count) { useOp = cand; items = r.items; count = r.count; msg = r.msg; break }
      }
      if (count) await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(OP_KEY, useOp).run().catch(() => null)
    }
    // 📅 **필수 파라미터 누락(코드 11)일 때만** 연도를 하나씩 — 첫 페이지에서 한 번만. 근거: `YR_KEY` 주석.
    // 📅 연도 순회 — **코드 11(이름/필수 누락) 또는 '오류 없이 0건'** 일 때. 후자를 안 보면,
    //   이름을 고친 뒤 *연도만 틀린* 경우가 **에러 없이 영원히 0건**으로 남는다(조용한 부재).
    if (i === 0 && !count && (!msg || /ESSENTIAL_PARAMETER_ERROR|필수.*파라미터/i.test(msg))) {
      for (const cand of yearCandidates(now)) {
        if (cand === useYr || budget.left <= BOOKKEEPING_RESERVE) continue
        const r = await fetchBrandPage(base, useOp, key, page, cand, budget)
        if (r.count) { useYr = cand; items = r.items; count = r.count; msg = r.msg; break }
      }
      if (count) await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(YR_KEY, useYr).run().catch(() => null)
    }
    if (msg) lastMsg = msg
    if (!sample && items[0]) sample = items[0]
    if (!count) break
    const leads: CompanyLead[] = items.map(it => {
      const brand = g(it, 'brandNm', 'brand', 'brandName')
      const corp = g(it, 'corpNm', 'jnghdCorpNm', 'coNm')
      const induty = [g(it, 'indutyLclasNm', 'induty', 'idustyLclasNm'), g(it, 'indutyMlsfcNm', 'idustyMlsfcNm')].filter(Boolean).join('>')
      const rep = g(it, 'jnghdRprsntvNm', 'rprsntvNm', 'prsdntNm', 'rprsvNm', 'ceoNm')
      const prod = g(it, 'mnProductNm', 'prductNm', 'mnProduct')
      return {
        company_name: brand || corp, category: '창업', subcategory: '프랜차이즈본사', tier: 5,
        region: null, address: null, phone: null, email: null, website: null,
        business_no: g(it, 'brno', 'bizrno', 'bzmnRegNo') || null,
        description: [corp && brand && corp !== brand ? `법인 ${corp}` : '', rep ? `대표 ${rep}` : '', induty, prod ? `상품 ${prod}` : ''].filter(Boolean).join(' · ') || null,
        contact_source: null, // 직접 연락처 없음 → 보강(네이버 홈페이지 검색→크롤)이 채움
        source: 'franchise', source_keyword: g(it, 'brandMngtNo', 'jnghdMngtNo', 'brandNm') || 'franchise',
      }
    }).filter(l => l.company_name.length >= 2)
    found += leads.length
    saved += await saveCompanyLeads(DB, leads, { requireContact: true }).catch(() => 0) // 보류 → enrichHeldLeads 가 홈페이지 검색으로 연락처 채움
    page++
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(page)).run().catch(() => null)
  // 404 는 키 문제가 아니라 **경로/오퍼레이션명 문제**다 — 그 사실과 무배포 교정 방법을 오류에 박아둔다
  //   (2026-07-28: 11회 연속 `API: HTTP 404` 만 뜨는데 무엇을 고쳐야 하는지 화면에 안 나와 방치됐다).
  const hint = lastMsg === 'HTTP 404' ? ` — 경로/오퍼레이션명 불일치. 공공데이터포털의 '가맹정보 브랜드 목록' 스펙 확인 후 ADS_FRANCHISE_ENDPOINT/ADS_FRANCHISE_OP env 로 무배포 교정(현재: ${base}/${op})` : ''
  const error = found === 0 && lastMsg ? `API: ${lastMsg}${hint}` : undefined
  const s: FranchiseStats = { last_run: stamp, found, saved, page, total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved, diag: { configured: true, error, sample }, health: updateLaneHealth(prev?.health, error || null, now) }
  await persist(s)
  return s
}
