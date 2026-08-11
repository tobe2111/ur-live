/**
 * 🏛️ **나라장터 조달업체(사용자정보 서비스) — 대행사 새 수집 루트** (2026-08-11 대표 *"아직 손 안댄거 다 해줘"*).
 *
 * ## 왜 되살리는가 — 대행사는 **분류 문제가 아니라 수집원 문제**다
 * `docs/handoff/2026-08-03-collection-routes-map.md` 의 실측:
 * ```
 *   category='대행사'  1,989건 중 연락처 보유 111건(5.6%)
 *   통신판매 원부에서 업태 필터로 짜내 봐야 300건 안팎  ← 재분류로는 안 나온다
 * ```
 * 그래서 **새 루트**가 필요했고, 이게 그중 지금 만들 수 있는 하나다.
 * 나라장터 입찰참가자격 등록업체 = **검증된 사업자**(사업자번호·대표·주소·전화가 등록돼 있다).
 * 그중 광고·마케팅 계열만 받아 `ad_company_leads` 로 넣는다.
 *
 * ## 🩸 이 레인은 한 번 죽었다 — 왜 죽었고 무엇이 달라졌나
 * 2026-07-27 에 같은 API 로 만들었는데 **15회 연속 `NO_OPENAPI_SERVICE_ERROR`(코드 12)** 였고,
 * 그 판정을 *"이 주소가 폐기됐다"* 로 읽어 2026-08-04 에 레인을 통째로 지웠다
 * (`nara-contract-collect.ts` 주석에 *"구 UsrInfoService02 는 code 12"* 로 남아 있다).
 *
 * **그 판정이 틀렸다.** 2026-08-10 대표가 포털 Swagger 화면을 공유해 확정된 것:
 * ```
 *   주소  https://apis.data.go.kr/1230000/ao/UsrInfoService02      ← 살아 있다
 *   op    getPrcrmntCorpBasicInfo02                                ← 옛 코드는 '02' 가 없었다
 * ```
 * 코드 12 는 *주소 부재*와 *오퍼레이션 오타*를 **구분하지 못한다**(`public-data-diag` 가 그 함정을
 * 명시해 뒀는데, 그때는 주소 쪽으로 읽었다). ⇒ **같은 오독을 또 하지 않도록** 이 레인은 이름을
 * 추측에 맡기지 않고 **한 번의 실측으로 스스로 정한다**(아래 `OP_FALLBACKS` — 공정위 레인과 같은 처방).
 *
 * ## 왜 이 API 가 값진가 — **연락처가 응답에 직접 들어 있다**
 * 인플루언서는 이메일 보유 15%, 대행사는 79% 인데 **대행사 모수가 작다.** 이 원부는 전화(그리고 많은
 * 경우 홈페이지)를 함께 주므로, 홈페이지가 있으면 기존 이메일 크롤 레인이 그대로 이어받는다.
 * 일 한도 10,000 요청이라 회차당 5페이지(무료)로는 여유가 크다.
 *
 * 게이트 `ADS_NARA_VENDOR_ENABLED` — **기본 ON**(opt-out). 나라장터 계약 레인과 같은 규약이고,
 * 근거는 2026-08-04 대표 *"자동으로 데이터 나오게끔"*. 끄려면 `'false'`.
 * 키 `PUBLIC_DATA_SERVICE_KEY`. 무배포 교정: `ADS_NARA_VENDOR_ENDPOINT` / `ADS_NARA_VENDOR_OP`.
 *
 * ⚠️ 수집 ≠ 발송 — 공개 등록 정보만 모은다. 발송은 대표가 한다(CLAUDE.md).
 */
import type { Env } from '@/worker/types/env'
import { envPlanValue } from './collect-budget'
import { saveCompanyLeads, ensureCompanySchema, type CompanyLead } from './company-discovery'
import { describePublicDataFailure, serviceKeyParam, laneShouldSkip, updateLaneHealth, laneHealthNote, type LaneHealth, isNoValue } from './public-data-diag'

export const NARA_VENDOR_BASE = 'https://apis.data.go.kr/1230000/ao/UsrInfoService02'
/** 대표 Swagger 화면(2026-08-10)으로 확정. 옛 코드의 `getPrcrmntCorpBasicInfo`(02 없음)가 코드 12 의 원인이었다. */
export const NARA_VENDOR_OP = 'getPrcrmntCorpBasicInfo02'
/**
 * 🔁 오퍼레이션 후보 — 첫 이름이 **코드 12(주소 없음)** 일 때만 다음 이름으로 한 번 더 쏜다.
 *
 * ⚠️ **코드 12 일 때만** 넘어간다. 키·트래픽·파라미터 오류에 후보를 돌리면 같은 실패를 N배로 반복해
 *   예산만 태운다(공정위 레인에서 이미 겪었다).
 * ⚠️ 이 환경은 `apis.data.go.kr` 이 프록시 차단이라 **개발 중에 이름을 검증할 방법이 없다.**
 *   그래서 추측을 코드에 굳히는 대신 라이브가 한 번 재고 그 답을 기억하게 한다.
 */
const OP_FALLBACKS = ['getPrcrmntCorpBasicInfo', 'getPrcrmntCorpInfo02'] as const
const OP_KEY = 'ads_naravendor_op'

/**
 * 대행사/마케팅 계열 판별 — 업체명·업종 어느 필드든 매칭(응답 필드명이 불확실해 전 값을 훑는다).
 * ⚠️ 미매칭은 저장하지 않는다. 이 원부는 대부분 건설·물품 업체라, 안 거르면 **대행사 리드가 잡음에 덮인다**
 *   (유어애즈 지표는 총 인원이 아니라 "제안 보낼 수 있는 리드 수" — CLAUDE.md).
 */
export const AGENCY_RE = /광고|마케팅|홍보|커뮤니케이션|미디어|디자인|이벤트|프로모션|콘텐츠|브랜딩|퍼포먼스|기획|판촉|인쇄/

/** 루프가 자기 기록(op 학습·통계·커서)에 쓸 몫. */
const BOOKKEEPING_RESERVE = 1
/**
 * ⏱️ 회차 벽시계 마감선 — **커서 저장이 루프 뒤에 있다는 사실이 이 값을 필수로 만든다.**
 *   루프가 인보케이션 한도에 맞아 죽으면 저장에 도달하지 못하고 다음 회차가 **같은 페이지를 또 훑는다
 *   (전진 0)** — commerce(08-02)·quality(08-03)가 정확히 그렇게 조용히 멈췄고, 지워진 옛 버전의 이
 *   레인에는 이 마감선이 **없었다**.
 */
const VENDOR_RUN_MS = 6_000

const stripTag = (s: unknown): string => String(s ?? '').replace(/<[^>]+>/g, '').trim()
type RawV = Record<string, unknown>
// ⚠️ 별칭 폴백은 `isNoValue` 를 통과해야 한다 — 포털이 '값 없음'을 `"N/A"` 문자열로 주는데 truthy 라
//   앞 별칭에서 걸리면 **뒤 별칭의 진짜 값을 건너뛴다**(통신판매에서 주소 31.7% 를 그렇게 잃었다).
const g = (it: RawV, ...keys: string[]): string => { for (const k of keys) { const v = it[k]; if (!isNoValue(v)) return stripTag(v) } return '' }
const pickRegion = (addr: string): string | null => { const m = addr.match(/([가-힣]+?)(시|군|구)\s/); return m ? m[1].replace(/특별|광역|자치|도$/g, '').slice(0, 20) : null }

/** 마스킹된 값은 버린다 — 원부가 전화를 `***********` 로 주는 경우가 있다(계약 레인 실측). */
const unmasked = (s: string): string | null => (s && !/^[*·\-\s]+$/.test(s) && !s.includes('***') ? s : null)
/** 홈페이지는 스킴이 빠져 오는 경우가 많다 — 크롤 레인이 바로 쓸 수 있게 정규화. */
const normUrl = (s: string): string | null => {
  const t = s.trim()
  if (!t || t.length < 4 || !/\./.test(t)) return null
  return /^https?:\/\//i.test(t) ? t.slice(0, 300) : `http://${t}`.slice(0, 300)
}

async function fetchVendorPage(
  base: string, op: string, key: string, page: number, bgnDt: string, endDt: string, budget: { left: number },
): Promise<{ items: RawV[]; code: string; msg?: string }> {
  if (budget.left <= 0) return { items: [], code: '' }
  budget.left -= 1
  const url = `${base}/${op}?serviceKey=${serviceKeyParam(key)}&pageNo=${page}&numOfRows=200&type=json&_type=json&inqryDiv=1&inqryBgnDt=${bgnDt}&inqryEndDt=${endDt}`
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null)
  // 🩺 실패 본문을 버리지 않는다 — data.go.kr 은 원인 코드를 본문에 담아 준다(public-data-diag SSOT).
  if (!res || !res.ok) return { items: [], code: '', msg: await describePublicDataFailure(res) }
  const raw = await res.text().catch(() => '')
  let data: Record<string, unknown> | null = null
  try { data = JSON.parse(raw) as Record<string, unknown> } catch { data = null }
  if (!data) return { items: [], code: '', msg: raw.slice(0, 160).replace(/<[^>]+>/g, ' ').trim() || '비JSON 응답' }
  const resp = (data.response ?? data) as Record<string, unknown>
  // ⚠️ 봉투는 평평할 수도 `header` 로 감싸일 수도 있다 — 공정위에서 이 오독으로 진짜 사유를 두 주간 못 봤다.
  const codeSrc = (resp.header ?? resp ?? data) as Record<string, unknown>
  const code = String(codeSrc.resultCode ?? '')
  const rm = String(codeSrc.resultMsg ?? '')
  const body = (resp.body ?? data) as Record<string, unknown>
  let items = (body?.items ?? body?.item ?? []) as unknown
  if (items && !Array.isArray(items) && typeof items === 'object') items = (items as Record<string, unknown>).item ?? []
  const arr = Array.isArray(items) ? items as RawV[] : (items && typeof items === 'object' ? [items as RawV] : [])
  const msg = code && code !== '00' && code !== '0' ? `${code} ${rm}`.trim() : undefined
  return { items: arr, code, msg }
}

export interface NaraVendorStats {
  last_run: string; page: number; scanned: number; matched: number; saved: number
  total_runs: number; total_saved: number; op?: string
  diag: { configured: boolean; error?: string; sample?: unknown; stoppedBy?: string }
  health?: LaneHealth
}
const STATS_KEY = 'ads_naravendor_stats'
const CURSOR_KEY = 'ads_naravendor_cursor'

/** 조달업체 1회차. 최근 N일 등록/변경 구간을 페이지 커서로 순환하며 대행사 계열만 저장. */
export async function runNaraVendorCollect(env: Env, maxPagesArg?: number): Promise<NaraVendorStats> {
  // 🎚️ 회차당 일감도 요금제를 따른다 — 예산만 커지고 이 숫자가 고정이면 늘어난 예산이 남는다.
  const maxPages = maxPagesArg ?? envPlanValue(undefined, 5, 15, env)
  const DB = env.DB
  await ensureCompanySchema(DB)
  const now = new Date()
  const nowMs = now.getTime()
  const runDeadline = nowMs + VENDOR_RUN_MS
  const stamp = now.toISOString().slice(0, 19).replace('T', ' ')
  const key = env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const base = (env as unknown as { ADS_NARA_VENDOR_ENDPOINT?: string }).ADS_NARA_VENDOR_ENDPOINT || NARA_VENDOR_BASE
  const days = Math.max(7, parseInt((env as unknown as { ADS_NARA_VENDOR_DAYS?: string }).ADS_NARA_VENDOR_DAYS || '', 10) || 90)

  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: NaraVendorStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as NaraVendorStats : null } catch { prev = null }
  const persist = async (s: NaraVendorStats): Promise<void> => {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null)
  }
  const base0: NaraVendorStats = {
    last_run: stamp, page: prev?.page || 0, scanned: 0, matched: 0, saved: 0,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: true },
  }
  if (!key) { const s = { ...base0, diag: { configured: false, error: 'NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정' } }; await persist(s); return s }
  // 🩹 하드 실패 백오프 — 재시도로 낫지 않는 실패를 계속 쏘면 서브리퀘스트를 **잘 도는 레인에서 빼앗는다**.
  if (laneShouldSkip(prev?.health, nowMs)) {
    const s = { ...base0, diag: { configured: true, error: `대기: ${laneHealthNote(prev?.health, nowMs)}` }, health: prev?.health }
    await persist(s); return s
  }

  // 학습된 오퍼레이션 이름이 있으면 그것부터(다음 회차엔 재시도 0).
  const learnedOp = (await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(OP_KEY)
    .first<{ value: string }>().catch(() => null))?.value || ''
  const envOp = (env as unknown as { ADS_NARA_VENDOR_OP?: string }).ADS_NARA_VENDOR_OP || ''
  let op = envOp || learnedOp || NARA_VENDOR_OP

  const p2 = (n: number): string => String(n).padStart(2, '0')
  const ymdhm = (d: Date, hm: string): string => `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}${hm}`
  const bgnDt = ymdhm(new Date(nowMs - days * 86400000), '0000')
  const endDt = ymdhm(now, '2359')

  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let page = parseInt(curRaw?.value || '1', 10)
  if (!Number.isFinite(page) || page < 1) page = 1

  const budget = { left: Math.max(6, maxPages + 3) }
  let scanned = 0, matched = 0, saved = 0, sample: unknown, lastMsg: string | undefined, stoppedBy = 'pages'
  for (let i = 0; i < Math.max(1, maxPages); i++) {
    if (budget.left <= BOOKKEEPING_RESERVE) { stoppedBy = 'budget'; break }
    if (Date.now() >= runDeadline) { stoppedBy = 'deadline'; break }
    let r = await fetchVendorPage(base, op, key, page, bgnDt, endDt, budget)
    // 🔁 **주소 부재(코드 12)일 때만** 다음 이름으로 — 첫 페이지에서 한 번만. 맞으면 그 이름을 기억한다.
    if (i === 0 && !r.items.length && r.code === '12' && !envOp) {
      for (const cand of OP_FALLBACKS) {
        if (budget.left <= BOOKKEEPING_RESERVE || Date.now() >= runDeadline) break
        const alt = await fetchVendorPage(base, cand, key, page, bgnDt, endDt, budget)
        if (alt.items.length || alt.code === '00' || alt.code === '0') { op = cand; r = alt; break }
      }
      if (r.items.length) {
        await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(OP_KEY, op).run().catch(() => null)
      }
    }
    if (r.msg) lastMsg = r.msg
    if (!sample && r.items[0]) sample = r.items[0]
    if (!r.items.length) { page = 1; stoppedBy = 'empty'; break }  // 구간 소진 → 다음 회차엔 처음부터(구간이 매일 굴러간다)
    scanned += r.items.length
    const leads: CompanyLead[] = []
    for (const it of r.items) {
      // 전 필드 값을 훑는다 — 업종 필드명이 불확실하다. 미매칭은 저장 안 함(잡업종 유입 차단).
      const hay = Object.values(it).map(v => String(v ?? '')).join(' ')
      if (!AGENCY_RE.test(hay)) continue
      const name = g(it, 'corpNm', 'prcrmntCorpNm', 'bidprcCorpNm', 'entrpsNm', 'cmpnyNm', 'bzmnNm')
      if (name.length < 2) continue
      const addr = g(it, 'adrs', 'addr', 'corpAdrs', 'lctnAddr')
      const phone = unmasked(g(it, 'telNo', 'telno', 'cttpcNo', 'ofclTelno', 'corpTelNo'))
      const site = normUrl(g(it, 'hmpgAdrs', 'homepageUrl', 'hmpgUrl', 'wbsteAdrs'))
      const email = unmasked(g(it, 'emailAdrs', 'email', 'ofclEmailAdrs'))
      matched++
      leads.push({
        company_name: name, category: '대행사', subcategory: '조달등록', tier: 2,
        region: pickRegion(addr), address: addr || null,
        phone, email: email || null, website: site,
        business_no: g(it, 'bizno', 'brno', 'bizRegNo', 'bzmnRegNo') || null,
        description: [g(it, 'ceoNm', 'rprsntvNm') && `대표 ${g(it, 'ceoNm', 'rprsntvNm')}`, '나라장터 등록업체'].filter(Boolean).join(' · ') || null,
        // 🏷️ 출처 표기는 정직하게 — 전화가 있으면 정부등록, 홈페이지만 있으면 크롤 대상이라는 뜻이다.
        contact_source: phone ? 'govreg' : (site ? 'web' : null),
        source: 'nara', source_keyword: g(it, 'rgstDt', 'inqryDiv') || 'nara',
      })
    }
    // ⚠️ `requireContact` — 연락처 없는 행은 명단이 아니다(유어애즈 지표는 "제안 보낼 수 있는 리드 수").
    saved += await saveCompanyLeads(DB, leads, { requireContact: true }).catch(() => 0)
    page++
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(page)).run().catch(() => null)

  // 🩸 코드 12 를 "주소가 폐기됐다"로 읽어 레인을 통째로 지운 전례가 있다(위 헤더). 화면에 **둘 다** 적는다.
  const hint = lastMsg && /NO_OPENAPI_SERVICE_ERROR|^12\b|HTTP 404/.test(lastMsg)
    ? ` — 주소 부재 **또는 오퍼레이션 오타**(이 코드로는 구분 안 됨). 포털 '미리보기' 실제 호출 URL 과 대조 후`
      + ` ADS_NARA_VENDOR_ENDPOINT/ADS_NARA_VENDOR_OP 로 무배포 교정(현재: ${base}/${op})`
    : ''
  const error = saved === 0 && lastMsg ? `API: ${lastMsg}${hint}` : undefined
  const s: NaraVendorStats = {
    last_run: stamp, page, scanned, matched, saved, op,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved,
    diag: { configured: true, error, sample, stoppedBy },
    health: updateLaneHealth(prev?.health, error || null, nowMs),
  }
  await persist(s)
  return s
}
