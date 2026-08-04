/**
 * 🏛️ **상권 축 2단계 — 나라장터 계약정보(상권활성화 용역)** (2026-08-04 대표 지시 *"이것도 필요해"*).
 *
 * 대표 원문: *"나라장터 낙찰 이력 — 과거 상권활성화 용역을 누가 따갔는지. **타깃과 경쟁사가 동시에 나옵니다.**"*
 * 그 말이 이 레인의 설계 그대로다 — 계약 한 건에서 **둘**을 만든다:
 *
 * | 역할 | 무엇 | 왜 리드인가 |
 * |---|---|---|
 * | 수주사(`rprsntCorpNm`) | 상권 용역을 실제로 수행한 업체 | 경쟁사이자 **제휴 대상**(이미 상권 사업을 한다) |
 * | 발주기관(`dmndInsttNm`) | 지자체·상권활성화재단 등 | 상권 예산을 **집행하는 쪽** = 타깃 |
 *
 * ## 📞 연락처 — 대표 확정 **B안**(2026-08-04)
 * A(기관명만) / B(담당자 이름·전화·이메일 포함) 중 대표가 **B** 를 골랐다. 원부가 공시하는
 * `dmndInsttOfclNm`/`dmndInsttOfclTel`/`dmndInsttOfclEmailAdrs` 를 그대로 옮긴다.
 * ⚠️ **추측 생성은 여전히 안 한다** — 공시된 값만, 마스킹된 값은 버린다(아래 `unmasked`).
 * ⚠️ 수주사 전화 `rprsntCorpContactTel` 은 원부가 **`***********` 로 가려서** 준다(실측).
 *    대신 `rprsntCorpBizrno`(사업자등록번호)가 오므로 `companyKey` 가 `b:` 키를 만들어
 *    **이미 가진 통신판매 풀(13만)과 자동으로 합쳐진다** — 대표가 말한 *"조인만 하면 됩니다"* 가 여기다.
 *
 * ## 🎯 왜 전량이 아니라 상권 계약만인가
 * 이 원부는 **26,445건**(실측)이고 대부분 대학·병원 물품 구매다. 통째로 넣으면 상권 리드가
 * 잡음에 덮인다. 유어애즈 지표는 총 인원이 아니라 *"제안 보낼 수 있는 리드 수"* 이므로
 * (CLAUDE.md) **계약명이 상권 계열인 것만** 넣는다.
 *
 * ## 🧪 파라미터 자가측정 (`param_mode`)
 * 원부가 크고(26k) 롤링이라 **날짜 창**(`inqryBgnDate`/`inqryEndDate`)이 되면 하루치 ~3페이지로 끝난다.
 * 그런데 그 파라미터를 이 서비스가 받는지 **이 환경에서는 확인할 방법이 없다**(포털 문서 403·프록시 차단).
 * ⇒ 추측해서 박지 않고 **레인이 스스로 측정**한다: 창 파라미터로 쏴 보고, 게이트웨이가 오류를 내면
 *   **같은 페이지를 파라미터 없이 한 번만** 재시도하고 그 판정을 기억한다(`param_mode`).
 *   `apis.data.go.kr` 은 모르는 파라미터를 **조용히 무시**하므로(실측: `pageIndex`·`_type` 을 얹어도 200)
 *   최악의 경우에도 *무시된 채 전량 페이징* 으로 정상 동작한다 — 다운사이드가 없다.
 *   ⚠️ 기억된 판정은 **버전으로 잠근다**(`NARA_PARAM_STATE_VERSION`) — 인허가 레인에서 겪은
 *     *"코드 기본값을 고쳤는데 DB 에 굳은 옛 판정이 이겨서 라이브가 안 변한다"* 를 그대로 반복하지 않기 위해.
 *
 * 게이트 `ADS_NARA_CONTRACT_ENABLED` — **기본 ON**(2026-08-04 대표 *"자동으로 데이터 나오게끔"*, opt-out).
 * 키 `PUBLIC_DATA_SERVICE_KEY`.
 * ⚠️ 수집 ≠ 발송. SSOT: partner-company-collection.md.
 */
import type { Env } from '@/worker/types/env'
import { envPlanValue } from './collect-budget'
import { saveCompanyLeadsCounted, ensureCompanySchema, type CompanyLead } from './company-discovery'
import { describePublicDataFailure, serviceKeyParam, laneShouldSkip, updateLaneHealth, laneHealthNote, type LaneHealth, isNoValue } from './public-data-diag'

/** 조달청 공공데이터개방표준서비스 — 2026-08-03 프로브로 **살아있음 확인**(구 `UsrInfoService02` 는 code 12). */
export const NARA_CONTRACT_BASE = 'https://apis.data.go.kr/1230000/ao/PubDataOpnStdService'
export const NARA_CONTRACT_OP = 'getDataSetOpnStdCntrctInfo'

/**
 * 🏙️ 상권 계열 계약 판별 — **계약명**(`cntrctNm`)에만 건다.
 *
 * ⚠️ `시장` 단독을 넣지 않는다 — "시장조사 용역"·"농수산물시장"까지 걸려 잡음이 폭증한다.
 *   (`전통시장`·`시장현대화`처럼 **붙은 형태**로만 받는다.)
 */
export const DISTRICT_CONTRACT_RE = /상권|전통시장|시장현대화|상점가|상인회|골목형|중심시가지|청년몰|상권르네상스|소상공인/

/** 발주기관 리드의 축 — `지역조직`(이미 있는 축)을 그대로 쓴다. 새 카테고리를 만들지 않는다. */
export const NARA_INST_CATEGORY = '지역조직'
export const NARA_INST_SUBCATEGORY = '상권담당기관'
export const NARA_INST_TIER = 3
/** 수주사 리드의 축 — 상권 용역을 수행하는 대행사(tier 2). */
export const NARA_CORP_CATEGORY = '대행사'
export const NARA_CORP_SUBCATEGORY = '상권용역'
export const NARA_CORP_TIER = 2

type RawC = Record<string, unknown>
const stripTag = (s: unknown): string => String(s ?? '').replace(/<[^>]+>/g, '').trim()
/** 첫 유효값. ⚠️ `isNoValue` 통과 필수 — 포털이 '값 없음'을 `"N/A"` 로 주는데 truthy 라 앞 별칭이 진짜 값을 가린다. */
const g = (it: RawC, ...keys: string[]): string => { for (const k of keys) { const v = it[k]; if (!isNoValue(v)) return stripTag(v) } return '' }

/**
 * 🙈 **마스킹된 값은 없는 값이다.** 이 원부는 수주사 전화를 `***********` 로 준다(실측).
 *   그대로 저장하면 "연락처 있음"으로 집계돼 **접촉 풀이 거짓말을 한다** — 보류(active=0)로 가야 맞다.
 */
export function unmasked(raw: string): string {
  return raw.includes('*') ? '' : raw
}

/** 저장 가능한 전화만 — 숫자 9~12자리. 마스킹·내선·쓰레기값은 버린다(지어내지 않는다). */
export function contractPhone(raw: string): string | null {
  const t = unmasked(String(raw || '').trim())
  const d = t.replace(/\D/g, '')
  return d.length >= 9 && d.length <= 12 ? t : null
}

/** 저장 가능한 이메일만 — 공시값 그대로, 마스킹·비이메일은 버린다. */
export function contractEmail(raw: string): string | null {
  const t = unmasked(String(raw || '').trim()).toLowerCase()
  return /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(t) ? t.slice(0, 190) : null
}

/** 주소에서 시/군/구(파트너 풀 `region` 규약 — 접미사 제거). */
export function pickAddrRegion(addr: string): string | null {
  const m = String(addr || '').match(/([가-힣]+?)(시|군|구)\s/)
  return m ? m[1].replace(/특별|광역|자치|도$/g, '').slice(0, 20) : null
}

/**
 * 기관명에서 지역 — 발주기관엔 **주소 필드가 아예 없다**(실측). 이름이 유일한 단서다.
 *
 * ⚠️ 별도 규칙을 쓰지 않고 **주소와 같은 판정**(`pickAddrRegion`)을 쓴다. 지역 값이 소스마다
 *   다른 규칙으로 만들어지면 어드민 지역 필터가 소스별로 갈린다(같은 서울이 `서울`/`서울특별`로 나뉜다).
 *   이름 끝에 공백을 붙이는 이유는 그 정규식이 **행정단위 뒤 공백**을 요구하기 때문이다.
 *
 * `"서울특별시 종로구청"` → `서울` · `"신성대학교 산학협력단"` → `null`(추측하지 않는다).
 */
export function pickInstRegion(name: string): string | null {
  return pickAddrRegion(`${String(name || '').trim()} `)
}

const won = (raw: string): string => {
  const n = Number(String(raw || '').replace(/\D/g, ''))
  if (!Number.isFinite(n) || n <= 0) return ''
  return n >= 100_000_000 ? `${Math.round(n / 10_000_000) / 10}억원` : `${Math.round(n / 10_000).toLocaleString()}만원`
}

/**
 * 계약 1건 → 리드 **최대 2건**(수주사 · 발주기관). 상권 계약이 아니면 빈 배열.
 * 필드명은 **라이브 응답 실측**(2026-08-04 프로브) — 추측 아님.
 */
export function toContractLeads(it: RawC): CompanyLead[] {
  const cntrctNm = g(it, 'cntrctNm')
  if (!DISTRICT_CONTRACT_RE.test(cntrctNm)) return []
  const out: CompanyLead[] = []
  const amt = won(g(it, 'cntrctAmt', 'ttalCntrctAmt'))
  const date = g(it, 'cntrctCnclsDate')
  const instNm = g(it, 'dmndInsttNm', 'cntrctInsttNm')
  const evidence = [cntrctNm.slice(0, 80), amt, date].filter(Boolean).join(' · ')

  // ① 수주사 — 전화는 마스킹돼 오지만 사업자번호가 오므로 `b:` 키로 기존 풀과 자동 병합된다.
  const corp = g(it, 'rprsntCorpNm')
  if (corp.length >= 2) {
    const addr = g(it, 'rprsntCorpAdrs')
    const phone = contractPhone(g(it, 'rprsntCorpContactTel'))
    const ceo = g(it, 'rprsntCorpCeoNm')
    out.push({
      company_name: corp,
      category: NARA_CORP_CATEGORY, subcategory: NARA_CORP_SUBCATEGORY, tier: NARA_CORP_TIER,
      region: pickAddrRegion(addr), address: addr || null,
      phone, email: null, website: null,
      business_no: g(it, 'rprsntCorpBizrno') || null,
      description: [ceo && `대표 ${ceo}`, instNm && `발주 ${instNm}`, evidence].filter(Boolean).join(' · ').slice(0, 400) || null,
      contact_source: phone ? 'govreg' : null,
      source: 'nara', source_keyword: '상권용역',
    })
  }

  // ② 발주기관 — 대표 확정 B안: 담당자 이름·전화·이메일까지 옮긴다(공시값 한정).
  if (instNm.length >= 2) {
    const ofclNm = g(it, 'dmndInsttOfclNm', 'cntrctInsttOfclNm')
    const phone = contractPhone(g(it, 'dmndInsttOfclTel', 'cntrctInsttOfclTel'))
    const email = contractEmail(g(it, 'dmndInsttOfclEmailAdrs', 'cntrctInsttOfcl'))
    const dept = g(it, 'dmndInsttOfclDeptNm', 'cntrctInsttChrgDeptNm')
    out.push({
      company_name: instNm,
      category: NARA_INST_CATEGORY, subcategory: NARA_INST_SUBCATEGORY, tier: NARA_INST_TIER,
      region: pickInstRegion(instNm), address: null,
      phone, email, website: null, business_no: null,
      description: [dept, ofclNm && `담당 ${ofclNm}`, evidence].filter(Boolean).join(' · ').slice(0, 400) || null,
      contact_source: phone || email ? 'govreg' : null,
      source: 'nara', source_keyword: '상권발주',
    })
  }
  return out
}

/**
 * 🧪 파라미터 모드. `window` = 날짜 창 시도 · `plain` = 페이징만(측정으로 확정된 폴백).
 * ⚠️ 이 판정은 D1 에 굳으므로 **버전으로 잠근다** — 아래 상수를 올리면 전부 재측정한다.
 *   (인허가 레인에서 `LICENSE_STATE_VERSION` 없이 굳은 판정이 코드 수정을 이겨 라이브가 안 변했다.)
 */
export type NaraParamMode = 'window' | 'plain'
export const NARA_PARAM_STATE_VERSION = 1
export function usableParamMode(mode: unknown, v: unknown): NaraParamMode | null {
  if (Number(v || 0) !== NARA_PARAM_STATE_VERSION) return null
  return mode === 'window' || mode === 'plain' ? mode : null
}

/** KST 기준 `YYYYMMDD` — 워커 TZ 는 UTC 라 +9h 후 날짜를 취한다(CLAUDE.md KST 규약). */
export const kstYmd = (ms: number): string => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, '')

export function buildContractUrl(base: string, op: string, key: string, o: { page: number; rows: number; mode: NaraParamMode; bgn: string; end: string }): string {
  const win = o.mode === 'window' ? `&inqryDiv=1&inqryBgnDate=${o.bgn}&inqryEndDate=${o.end}` : ''
  return `${base}/${op}?serviceKey=${serviceKeyParam(key)}&pageNo=${o.page}&numOfRows=${o.rows}&type=json${win}`
}

async function fetchContractPage(url: string, budget: { left: number }): Promise<{ items: RawC[]; count: number; total: number; msg?: string }> {
  if (budget.left <= 0) return { items: [], count: 0, total: 0 }
  budget.left -= 1
  let res: Response | null = null
  let netMsg = '네트워크 오류'
  try { res = await fetch(url, { signal: AbortSignal.timeout(15000) }) } catch (err) {
    const m = err instanceof Error ? err.message : String(err || '')
    if (/too many subrequests/i.test(m)) netMsg = '⛔ 플랫폼 요청한도 도달 — 페이지 수를 줄여 나눠 수집'
  }
  if (!res || !res.ok) return { items: [], count: 0, total: 0, msg: await describePublicDataFailure(res, netMsg) }
  const raw = await res.text().catch(() => '')
  let data: Record<string, unknown> | null = null
  try { data = JSON.parse(raw) as Record<string, unknown> } catch { data = null }
  if (!data) return { items: [], count: 0, total: 0, msg: raw.slice(0, 160).replace(/<[^>]+>/g, ' ').trim() || '비JSON 응답' }
  const resp = (data.response ?? data) as Record<string, unknown>
  const header = resp.header as Record<string, unknown> | undefined
  const rc = header ? String(header.resultCode ?? '') : ''
  const rm = header ? String(header.resultMsg ?? '') : ''
  const body = (resp.body ?? data.body ?? data) as Record<string, unknown>
  let items = (body?.items ?? body?.item ?? []) as unknown
  if (items && !Array.isArray(items) && typeof items === 'object') items = (items as Record<string, unknown>).item ?? []
  const arr = Array.isArray(items) ? items as RawC[] : (items && typeof items === 'object' ? [items as RawC] : [])
  // ⚠️ 200 이어도 헤더가 실패를 말할 수 있다 — 삼키지 않는다(그게 파라미터 자가측정의 신호원이다).
  const msg = (rc && rc !== '00' && rc !== '0') || (rm && !/normal|정상|success/i.test(rm)) ? `${rc} ${rm}`.trim() : undefined
  return { items: arr, count: arr.length, total: Number(body?.totalCount) || 0, msg }
}

export interface NaraContractStats {
  last_run: string; scanned: number; matched: number; saved: number; upserted: number
  page: number; total: number; total_runs: number; total_saved: number
  /** 회차가 **왜 멈췄나** — `deadline` 이 잦으면 페이지/행 수를 줄인다. */
  stopped_by?: string
  /** 🧪 측정된 파라미터 모드 + 그 판정의 버전(코드가 바뀌면 무효화된다). */
  param_mode?: NaraParamMode; param_v?: number
  diag: { configured: boolean; error?: string; sample?: unknown }
  health?: LaneHealth
}
const STATS_KEY = 'ads_naracontract_stats'
const CURSOR_KEY = 'ads_naracontract_cursor'

export async function runNaraContractCollect(env: Env): Promise<NaraContractStats> {
  const DB = env.DB
  await ensureCompanySchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const key = env.PUBLIC_DATA_SERVICE_KEY || ''
  const e = env as unknown as Record<string, string | undefined>
  const base = e.ADS_NARA_CONTRACT_ENDPOINT || NARA_CONTRACT_BASE
  const op = e.ADS_NARA_CONTRACT_OP || NARA_CONTRACT_OP
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: NaraContractStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as NaraContractStats : null } catch { prev = null }
  const persist = async (s: NaraContractStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  const base0 = (error?: string, health?: LaneHealth): NaraContractStats => ({
    last_run: stamp, scanned: 0, matched: 0, saved: 0, upserted: 0, page: prev?.page || 1, total: prev?.total || 0,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0,
    param_mode: prev?.param_mode, param_v: prev?.param_v,
    diag: { configured: !error?.startsWith('NOT_CONFIGURED'), error }, health,
  })
  if (!key) { const s = base0('NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정'); await persist(s); return s }

  const now = Date.now()
  // 하드 실패 백오프 — 낫지 않는 실패를 계속 쏘면 잘 도는 레인의 서브리퀘스트를 빼앗는다.
  if (laneShouldSkip(prev?.health, now)) {
    const s = base0(`대기: ${laneHealthNote(prev?.health, now)}`, prev?.health); await persist(s); return s
  }

  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let page = parseInt(curRaw?.value || '1', 10); if (!Number.isFinite(page) || page < 1) page = 1
  // 📦 행 수를 크게 잡지 않는다 — 계약 1건이 ~1.9KB 라 500행이면 1MB 파싱이고, 무료 플랜에서
  //   **CPU 로 죽는 자리**다(이 레포가 반복해 겪은 그 죽음). 무료 200(페이지당 ~380KB) / 유료 400.
  //   ⚠️ 요청 **수**가 아니라 파싱량만 늘므로 이 노브가 묶인 건 포털 쿼터가 아니라 CPU 다(plan-knobs `cf`).
  const rows = Math.min(500, Math.max(50, envPlanValue(e.ADS_NARA_CONTRACT_ROWS, 200, 400, env)))
  // 📄 회차당 페이지 — 실측(2026-08-04 첫 회차)이 `stopped_by:"pages"` 였다. 즉 **마감선(20s)이 아니라
  //   페이지 수에서 멈췄다** = 시간이 남는다. 원부 29,129건을 200행씩 도는데 8페이지면 한 바퀴에 25회차(25일)라
  //   롤링 원부를 못 따라간다 → 20 으로. 마감선이 백스톱이라 느린 날엔 알아서 일찍 멈춘다(커서는 진행분 보존).
  const budget = { left: Math.min(40, Math.max(1, parseInt(e.ADS_NARA_CONTRACT_PAGES || '', 10) || 20)) }
  const windowDays = Math.min(90, Math.max(1, parseInt(e.ADS_NARA_CONTRACT_DAYS || '', 10) || 7))
  const bgn = kstYmd(now - windowDays * 86_400_000)
  const end = kstYmd(now)
  let mode: NaraParamMode = usableParamMode(prev?.param_mode, prev?.param_v) || 'window'
  let fellBack = false

  // ⏱️ 벽시계 마감선 — 페이지 수만으로 묶으면 상대가 느릴 때 루프가 한도에 먼저 걸려 **커서 저장에
  //   도달하지 못하고**, 다음 회차가 같은 지점을 또 훑는다("조용한 전진 0").
  const deadline = now + Math.min(60_000, Math.max(5_000, envPlanValue(e.ADS_NARA_CONTRACT_DEADLINE_MS, 20_000, 45_000, env)))
  let scanned = 0, matched = 0, saved = 0, upserted = 0, total = prev?.total || 0, sample: unknown, lastMsg: string | undefined
  let stoppedBy: 'pages' | 'deadline' | 'end' | 'empty' = 'pages'
  // 🧾 루프 뒤 D1 쓰기가 둘(커서·통계). 예산을 페이지에 다 쓰면 "돌긴 돌았는데 기록이 없는" 회차가 된다.
  const RESERVE = 2
  while (budget.left > RESERVE) {
    if (Date.now() >= deadline) { stoppedBy = 'deadline'; break }
    let r = await fetchContractPage(buildContractUrl(base, op, key, { page, rows, mode, bgn, end }), budget)
    // 🧪 자가측정 — 창 파라미터로 실패하면 **같은 페이지를 파라미터 없이 한 번만** 재시도하고 그 판정을 굳힌다.
    if (r.msg && mode === 'window' && !fellBack && budget.left > RESERVE) {
      fellBack = true; mode = 'plain'
      r = await fetchContractPage(buildContractUrl(base, op, key, { page, rows, mode, bgn, end }), budget)
    }
    if (r.msg) lastMsg = r.msg
    if (!sample && r.items[0]) sample = r.items[0]
    if (r.total) total = r.total
    if (!r.count) { stoppedBy = 'empty'; page = 1; break }
    scanned += r.count
    const leads = r.items.flatMap(toContractLeads)
    matched += leads.length
    // requireContact:true — 연락처 없는 리드(전화가 마스킹된 수주사)는 보류(active=0)로 들어가고,
    //   기존 보강 레인이 웹에서 연락처를 찾으면 자동 승격된다. 없는 연락처를 지어내지 않는다.
    const c = await saveCompanyLeadsCounted(DB, leads, { requireContact: true }).catch(() => ({ inserted: 0, upserted: 0 }))
    saved += c.inserted; upserted += c.upserted
    page++
    // 🔁 원부를 다 돌면 1페이지로 — 커서가 끝에 박히면 갱신분을 영영 못 받는다.
    if (total && (page - 1) * rows >= total) { page = 1; stoppedBy = 'end'; break }
    if (r.count < rows) { page = 1; stoppedBy = 'end'; break }
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(page)).run().catch(() => null)
  // 스캔은 됐는데 매칭이 0인 것은 **실패가 아니다**(상권 계약이 그 페이지에 없었을 뿐) — 오류로 적지 않는다.
  const error = scanned === 0 && lastMsg ? `API: ${lastMsg}` : undefined
  const s: NaraContractStats = {
    last_run: stamp, scanned, matched, saved, upserted, page, total, stopped_by: stoppedBy,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved,
    param_mode: mode, param_v: NARA_PARAM_STATE_VERSION,
    diag: { configured: true, error, sample }, health: updateLaneHealth(prev?.health, error || null, now),
  }
  await persist(s)
  return s
}
