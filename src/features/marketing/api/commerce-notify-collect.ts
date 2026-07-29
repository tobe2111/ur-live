/**
 * 🛒 파트너 수집 — 통신판매사업자 (공정거래위원회, data.go.kr 1130000) — 2026-07-22.
 *   사업자가 통신판매업 신고 시 제출한 **상호·대표자·전화·전자우편(이메일)·주소**가 데이터에 직접 붙어 옴
 *   → 매칭 없이(오매칭·허위 위험 0) 연락처 확보. 온라인 겸업 업체(마케팅·쇼핑 관련) 발굴 + 이메일 소스.
 *   `ad_company_leads` 에 source='commerce' 로 저장(연락처 attached → active=1 직행).
 *
 *   게이트 `ADS_COMMERCE_ENABLED`. 키 `PUBLIC_DATA_SERVICE_KEY`(동일 data.go.kr 계정).
 *   ⚠️ 엔드포인트/필드는 표준 기준(placeholder) — 활용가이드로 확정. 방어적 파싱 + diag.sample.
 *   설계 SSOT: docs/design/partner-company-collection.md §12.
 */
import type { Env } from '@/worker/types/env'
import { saveCompanyLeadsCounted, ensureCompanySchema, type CompanyLead } from './company-discovery'
import { serviceKeyParam, isNoValue } from './public-data-diag'

// ✅ 두 서비스 모두 수집(사업자번호로 자동 병합, 대표 확인 2026-07-23):
//   ① 등록현황 MllBs_2Service/getMllBsInfo_2 = **전자우편(이메일) 포함** (이메일 핵심)
//   ② 등록상세 MllBsDtl_3Service/getMllBsInfoDetail_3 = 부가필드(운영상태/법인명 등)
//   각각 data.go.kr 활용신청 필요 — 미신청 서비스는 diag.error 로 표시되고 스킵(다른 서비스는 정상 수집).
//   ADS_COMMERCE_ENDPOINT/OP 는 ①(현황)을 override. pageNo/numOfRows(최대 10000) 페이지네이션.
const COMMERCE_SERVICES = [
  { name: 'status', label: '등록현황', base: 'https://apis.data.go.kr/1130000/MllBs_2Service', op: 'getMllBsInfo_2' },
  { name: 'detail', label: '등록상세', base: 'https://apis.data.go.kr/1130000/MllBsDtl_3Service', op: 'getMllBsInfoDetail_3' },
]

/** 통신판매 원항목 → CompanyLead. 필드명이 서비스/버전마다 달라 g() 다중별칭 + anyEmail/anyDomain 폴백. */
export function mapCommerceLead(it: RawCommerce): CompanyLead {
  // ✅ 실 필드(라이브 diag 확인 2026-07-23): 상호 bzmnNm · 대표 rprsvNm · 이메일 **rprsvEmladr**(대표자 이메일) ·
  //    주소 rnAddr(도로명)/lctnAddr(지번) · 사업자번호 brno · 신고번호 prmmiMnno.
  //  ⚠️ chrgDeptTelno = 처리부서(관공서) 전화 → **업체 전화 아님**(허위 방지, 매핑 금지). 업체 전화는 보강(카카오)로.
  const addr = g(it, 'rnAddr', 'lctnAddr', 'addr', 'dtlLctnAddr', 'bizAddr', 'lctnRoadNmAddr', 'lctnRnAddr')
  // ⚠️ data.go.kr 이 개인정보 보호로 대표자 이메일을 마스킹(dduki0**@naver.com)해서 줌 → 발송 불가 →
  //    마스킹(`*` 포함)이거나 이메일 형식 아니면 저장 안 함(쓸모없는 주소로 숫자 부풀리기 방지). anyEmail 은 이미 정규식 검증.
  const rawEml = g(it, 'rprsvEmladr', 'email', 'coEml', 'eml', 'emlAddr', 'coEmlAddr', 'rprsvEml', 'elctrnMailAdres')
  const email = (rawEml && !rawEml.includes('*') && EMAIL_RE.test(rawEml)) ? rawEml.toLowerCase() : anyEmail(it)
  const domain = anyDomain(it)
  // 🪦 폐업 판정(2026-07-29 라이브 실측: 온라인판매 리드 표본 2,000건 중 **10.2% 가 폐업**이고
  //   그중 35% 는 이메일까지 붙어 `active=1` 로 접촉 풀에 있었다 = 문 닫은 가게에 영업메일).
  //   등록부가 말해준 상태만 본다 — 상호/주소로 추측하지 않는다.
  const status = `${g(it, 'operSttusCdNm', 'operSttus')} ${g(it, 'bzmnRgsSttusSeNm', 'bzmnRgsSttusSe')}`
  const closed = /폐업|말소|휴업|취소/.test(status)
  return {
    // 통신판매사업자 = 일반 온라인 판매업체(대행사 아님) → '온라인판매' tier 4. (이전 '대행사' tier1 오분류는
    //   보강 우선순위(tier1 우선)를 통신판매가 독식하게 만들어 실제 대행사 리드를 밀어냈음 — 정합 교정.)
    company_name: g(it, 'bzmnNm', 'bsshNm', 'coNm', 'brmNm', 'entrNm', 'cmpnyNm'), category: '온라인판매', subcategory: g(it, 'upteNm', 'dclsfNm', 'idustyNm', 'taskNm') || '통신판매', tier: 4,
    region: pickRegion(addr), address: addr || null,
    phone: null, // 통신판매 데이터엔 업체 전화 없음(chrgDeptTelno 는 관공서) → 보강 단계에서 카카오로 확보
    email: email || null,
    // 🩹 2026-07-29: 예전엔 **이메일이 있으면 도메인을 버렸다**(`email ? null : domain`). 원래 의도는
    //   "크롤 관문이 필요 없으면 저장 안 함" 이었는데, 두 크롤 선정 쿼리 모두 `email IS NULL` 을 요구하므로
    //   도메인을 저장해도 **크롤 비용은 0** 이다. 반면 대표는 전화·메일로 직접 접촉하므로 회사 사이트는
    //   그 자체로 값이다(신고 원부의 도메인 = 고품질). 정보를 공짜로 버리고 있었다 → 항상 저장.
    website: domain ? (/^https?:\/\//i.test(domain) ? domain : `http://${domain}`) : null,
    business_no: g(it, 'brno', 'bizrno', 'bzmnRegNo') || null,
    description: [g(it, 'rprsvNm', 'rprsntvNm', 'ceoNm') && `대표 ${g(it, 'rprsvNm', 'rprsntvNm', 'ceoNm')}`, g(it, 'operSttusCdNm', 'operSttus')].filter(Boolean).join(' · ') || null,
    contact_source: email ? 'commerce' : null, // 이메일 있을 때만 통신판매 출처(전화는 보강 출처가 기록)
    source: 'commerce', source_keyword: g(it, 'prmmiMnno', 'mnno', 'dclrNo') || 'commerce',
    closed,
  }
}
const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()
const pickRegion = (addr: string): string | null => { const m = addr.match(/([가-힣]+?)(시|군|구)\s/); return m ? m[1].replace(/특별|광역|자치|도$/g, '').slice(0, 20) : null }

export type RawCommerce = Record<string, unknown>
const EMAIL_RE = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i
const DOMAIN_RE = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9.\-]+\.[a-z]{2,}(?:\/\S*)?$/i

/** 첫 매칭 키의 값(태그 제거). 표준 필드명이 API 버전마다 달라 다중 별칭. */
//   ⚠️ `isNoValue` 를 반드시 통과시킨다 — 포털은 '값 없음'을 `"N/A"` 문자열로 주는데 그게 truthy 라
//   앞 별칭에서 걸리면 **진짜 값이 있는 뒤 별칭을 건너뛴다**(실측: 리드 31.7% 가 주소 "N/A" + region null,
//   같은 행 지번주소엔 실제 주소가 있었다). 판정 SSOT 는 public-data-diag.
function g(it: RawCommerce, ...keys: string[]): string { for (const k of keys) { const v = it[k]; if (!isNoValue(v)) return stripTag(v) } return '' }
/** ⚠️ 필드명 불확실 대비 — **어떤 필드든 이메일 형태면** 회수(통신판매 신고본은 전자우편이 있음, 키 이름만 버전차).
 *   `*` 포함 값은 통째 스킵 — 마스킹("ab**cd@x.com")에서 부분매칭("cd@x.com")으로 **잘린 가짜 이메일**을 만들 위험 차단. */
function anyEmail(it: RawCommerce): string { for (const v of Object.values(it)) { const s = stripTag(v); if (!s || s.includes('*')) continue; const m = s.match(EMAIL_RE); if (m && !/@(?:example|test|sample)\./i.test(m[0])) return m[0].toLowerCase() } return '' }
/** 인터넷도메인 필드(크롤 관문 겸 **수동 접촉용 회사 사이트**). 이메일 형태는 제외. */
function anyDomain(it: RawCommerce): string { for (const [k, v] of Object.entries(it)) { if (!/dmn|domain|url|site|hmpg|hompage|homepage/i.test(k)) continue; const s = stripTag(v); if (s && !s.includes('@') && DOMAIN_RE.test(s)) return s } return '' }

async function fetchCommercePage(base: string, op: string, key: string, page: number, budget: { left: number }): Promise<{ items: RawCommerce[]; count: number; msg?: string }> {
  if (budget.left <= 0) return { items: [], count: 0 }
  budget.left -= 1
  const url = `${base}/${op}?serviceKey=${serviceKeyParam(key)}&pageNo=${page}&numOfRows=500&type=json&_type=json&resultType=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) }).catch(() => null)
  if (!res || !res.ok) return { items: [], count: 0, msg: res ? `HTTP ${res.status}` : '네트워크 오류' }
  const raw = await res.text().catch(() => '')
  let data: Record<string, unknown> | null = null
  try { data = JSON.parse(raw) as Record<string, unknown> } catch { data = null }
  if (!data) return { items: [], count: 0, msg: raw.slice(0, 160).replace(/<[^>]+>/g, ' ').trim() || '비JSON 응답' } // XML 오류(등록안됨 등) 그대로 노출
  const resp = (data.response ?? data) as Record<string, unknown>
  const header = resp.header as Record<string, unknown> | undefined
  const rc = header ? String(header.resultCode ?? '') : ''
  const rm = header ? String(header.resultMsg ?? '') : ''
  const body = (resp.body ?? data.body ?? data) as Record<string, unknown>
  let items = (body?.items ?? body?.item ?? data.data ?? []) as unknown
  if (items && !Array.isArray(items) && typeof items === 'object') items = (items as Record<string, unknown>).item ?? []
  const arr = Array.isArray(items) ? items as RawCommerce[] : (items && typeof items === 'object' ? [items as RawCommerce] : [])
  const msg = (rc && rc !== '00' && rc !== '0') || (rm && !/normal|정상|success/i.test(rm)) ? `${rc} ${rm}`.trim() : undefined
  return { items: arr, count: arr.length, msg }
}

export interface CommerceStats {
  last_run: string; found: number; saved: number; page: number; total_runs: number; total_saved: number
  /** 재확인(이미 알던 업체를 다시 만난) 건수 — `saved`(신규)와 함께 봐야 '완주'와 '고장'이 갈린다(2026-07-29). */
  upserted?: number
  /** 🪦 이번 회차에서 **폐업으로 판정돼 접촉 풀에서 빠진** 건수(2026-07-29). 저장은 되고 active=0 만 된다. */
  closed?: number
  diag: { configured: boolean; error?: string; sample?: unknown }
}
const STATS_KEY = 'ads_commerce_stats'
const CURSOR_KEY = 'ads_commerce_cursor'

export async function runCommerceCollect(env: Env): Promise<CommerceStats> {
  const DB = env.DB
  await ensureCompanySchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const key = env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: CommerceStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as CommerceStats : null } catch { prev = null }
  const persist = async (s: CommerceStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  if (!key) { const s: CommerceStats = { last_run: stamp, found: 0, saved: 0, page: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: false, error: 'NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정' } }; await persist(s); return s }

  // 🧹 기존에 저장된 마스킹 이메일(발송 불가) 정리 — NULL 처리 + 전화 없으면 보류로 되돌려 재보강(홈페이지 크롤로 진짜 이메일).
  await DB.prepare("UPDATE ad_company_leads SET email = NULL, contact_source = CASE WHEN contact_source = 'commerce' THEN NULL ELSE contact_source END, active = CASE WHEN (phone IS NULL OR phone = '') THEN 0 ELSE active END WHERE email LIKE '%*%'").run().catch(() => null)

  // 🕳️ 이미 저장된 자리표시자 주소("N/A")를 비운다 — **원부 재순회가 진짜 주소로 채우게 하려면 필수**다.
  //   upsert 가 `address = COALESCE(기존, 신규)` 라, "N/A" 가 남아 있으면 진짜 주소가 와도 **영원히 안 들어간다.**
  //   실측: 온라인판매 리드의 31.7% 가 이 상태(주소 "N/A" + region null)였고, 카카오 전화 스윕은
  //   `address != ''` 로 걸러 이 행들을 **없는 주소로 조회**하느라 예산을 태우고 있었다.
  await DB.prepare("UPDATE ad_company_leads SET address = NULL WHERE address IN ('N/A','n/a','N.A.','-','--','없음','미상','null')").run().catch(() => null)

  // 🪦 이미 저장된 폐업 업체를 접촉 풀에서 뺀다(위 마스킹 정리와 같은 성격의 자가 치유).
  //   description 에 `대표 X · 폐업처리` 형태로 등록부 상태가 이미 들어가 있다 — 새 수집을 기다리지 않고
  //   지금 있는 것부터 정리한다(원부 한 바퀴가 며칠 걸리므로 그때까지 계속 메일이 나간다).
  //   ⚠️ 삭제가 아니라 `active=0` — 재개업하면 등록부가 '정상'으로 알려주고 upsert 가 되살린다.
  await DB.prepare("UPDATE ad_company_leads SET active = 0 WHERE source = 'commerce' AND active = 1 AND (description LIKE '%폐업%' OR description LIKE '%말소%' OR description LIKE '%휴업%')").run().catch(() => null)

  // ①(현황)에 env override 적용. 두 서비스 각각 별도 커서 + 공유 예산.
  const services = COMMERCE_SERVICES.map((svc, idx) => idx === 0 ? {
    ...svc,
    base: (env as unknown as { ADS_COMMERCE_ENDPOINT?: string }).ADS_COMMERCE_ENDPOINT || svc.base,
    op: (env as unknown as { ADS_COMMERCE_OP?: string }).ADS_COMMERCE_OP || svc.op,
  } : svc)
  const totalBudget = Math.max(4, parseInt(env.ADS_ENRICH_BUDGET || env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 12)
  const budget = { left: totalBudget }
  const perService = Math.max(2, Math.floor(totalBudget / services.length))

  let found = 0, saved = 0, upserted = 0, closed = 0, sample: unknown, sampleHasEmail = false, lastPage = 0
  const msgs: string[] = []
  for (const svc of services) {
    const ck = `${CURSOR_KEY}_${svc.name}`
    const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(ck).first<{ value: string }>().catch(() => null)
    let page = parseInt(curRaw?.value || '1', 10); if (!Number.isFinite(page) || page < 1) page = 1
    for (let p = 0; p < perService && budget.left > 0; p++) {
      const { items, count, msg } = await fetchCommercePage(svc.base, svc.op, key, page, budget)
      if (msg) msgs.push(`${svc.label}: ${msg}`)
      if (items[0]) { const hasE = anyEmail(items[0]) !== ''; if (!sample || (hasE && !sampleHasEmail)) { sample = items[0]; sampleHasEmail = hasE } } // 이메일 든 샘플 우선(probe 정확도)
      if (!count) break
      const leads = items.map(mapCommerceLead).filter(l => l.company_name.length >= 2)
      found += leads.length
      closed += leads.filter(l => l.closed).length // 🪦 이번 회차에 걸러낸 폐업 — '수집량 하락'과 구분되게 보인다
      // 신규/재확인 분리(2026-07-29) — 원부를 다 훑으면 신규는 0 에 수렴한다. 그건 '죽음'이 아니라 '완주'다.
      const c = await saveCompanyLeadsCounted(DB, leads, { requireContact: true }).catch(() => ({ inserted: 0, upserted: 0 }))
      saved += c.inserted; upserted += c.upserted
      page++
    }
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(ck, String(page)).run().catch(() => null)
    lastPage = page
  }
  // 저장 0인데 API 메시지가 있으면 진단에 노출(활용신청 미승인/키오류/파라미터 등 원인 표시).
  const error = saved === 0 && msgs.length ? `API: ${msgs.join(' | ')}` : undefined
  const s: CommerceStats = { last_run: stamp, found, saved, upserted, closed, page: lastPage, total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved, diag: { configured: true, error, sample } }
  await persist(s)
  return s
}
