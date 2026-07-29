/**
 * 👥 파트너 리드 규모 검증 — 국민연금 가입 사업장 내역 (data.go.kr B552015/NpsBplcInfoInqireServiceV2) — 2026-07-27.
 *   대표 활용신청 승인(2026-07-27~2028-07-27, 공유키 PUBLIC_DATA_SERVICE_KEY). 새 리드 발굴용이 아니라
 *   **기존 리드(대행사 우선)의 직원 규모(가입자 수) 검증**용 — 1인 페이퍼 대행사와 실조직을 데이터로 구분.
 *
 *   흐름(리드당 최대 2콜): ① getBassInfoSearchV2(wkpl_nm=상호 [+bzowr_rgst_no 6자리]) → 후보 중
 *   **엄격 매칭**(상호 정규화 일치 + 사업자번호 6자리 or 주소 지역 토큰 일치)만 채택 — 동명 회사의
 *   직원수를 잘못 붙이면 오정보(허위)라 매칭 실패 시 저장 안 함. ② getDetailInfoSearchV2(seq) → 가입자수.
 *
 *   ⚠️ API 의 사업자번호는 앞 6자리만 공개(마스킹) — 그래서 상호 일치를 항상 함께 요구.
 *   ⚠️ 수집 ≠ 발송 — 공개 가입내역 수치만. 연락처 아님(연락처 폭포수와 무관).
 *   게이트 ADS_NPS_ENABLED(기본 OFF, hourUTC=16 = KST 01시 일 1회). 수동 트리거 게이트 무관.
 *
 *   🩹 2026-07-28 근본수리 — 이 레인은 **데이터를 조용히 망가뜨리고 있었다**:
 *     리드당 fetch 1~2 + UPDATE 1 인데 예산을 아무도 안 셌다(maxLeads 40 → 최대 120 서브리퀘스트,
 *     실효 한도는 ~50). 25번째쯤부터 전부 throw 하는데 그 실패가 `markChecked(null)` 로 이어져
 *     **조회된 적 없는 리드가 '조회 완료' 도장을 받았다**. `nps_checked_at` 은 쿨다운이 없어 **영구**다
 *     → 매 라운드 15~30 리드가 영원히 대상에서 빠졌다. 라이브 `checked:40 · matched:0` 이 그 모양이다.
 *     ⇒ ① 예산을 세고 ② **한도/네트워크 실패면 도장을 찍지 않고 중단**하며 ③ 쓰기를 배치로 묶는다.
 *     (도장을 찍는 것은 "실제로 조회했고 매칭이 없었다" 일 때뿐 — 그건 진짜 정보다.)
 */
import type { Env } from '@/worker/types/env'
import { ensureCompanySchema } from './company-discovery'
import { parseItems } from './hira-hospital-collect'
import { describePublicDataFailure, serviceKeyParam } from './public-data-diag'

const NPS_BASE = 'https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2'
const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[\s()㈜]|주식회사|유한회사|\(주\)|\(유\)/g, '')
/** 필드명 후보 조회(camel/snake/lower 방어) — data.go.kr 서비스별 표기가 흔들려 실응답 기준 방어 파싱. */
const g = (o: Record<string, string>, ...keys: string[]): string => {
  for (const k of keys) { if (o[k] != null && String(o[k]).trim() !== '') return String(o[k]).trim() }
  const lower = Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]))
  for (const k of keys) { const v = lower[k.toLowerCase()]; if (v != null && String(v).trim() !== '') return String(v).trim() }
  return ''
}
const regionTokens = (s: string) => new Set((s || '').match(/[가-힣]{2,}(?:시|군|구|동|로|길)/g) || [])

export interface NpsStats {
  last_run: string; checked: number; matched: number; total_checked: number; total_matched: number
  diag: { configured: boolean; error?: string; sample?: unknown; empty_probe?: { name: string; len: number; keys: string; totalCount: string; head: string } }
}
const STATS_KEY = 'ads_nps_stats'

/** 규모 검증 1틱 — 미조회 리드(대행사 우선) maxLeads 건. 매칭 실패도 checked 표시(재조회 안 함, 커서 전진). */
export async function runNpsWorkplaceEnrich(env: Env, maxLeads = 40): Promise<NpsStats> {
  const DB = env.DB
  await ensureCompanySchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const key = env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: NpsStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as NpsStats : null } catch { prev = null }
  const persist = async (s: NpsStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  if (!key) {
    const s: NpsStats = { last_run: stamp, checked: 0, matched: 0, total_checked: prev?.total_checked || 0, total_matched: prev?.total_matched || 0, diag: { configured: false, error: 'NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정' } }
    await persist(s); return s
  }

  // 대상: 규모 미조회 활성 리드 — 대행사(tier1 접점) 우선, 그다음 tier 순.
  const targets = (await DB.prepare(`SELECT id, company_name, business_no, region, address FROM ad_company_leads
      WHERE active = 1 AND merged_into IS NULL AND nps_checked_at IS NULL AND length(company_name) >= 2
      ORDER BY (CASE WHEN category = '대행사' THEN 0 ELSE 1 END), (tier IS NULL) ASC, tier ASC, id ASC LIMIT ?`)
    .bind(Math.min(100, Math.max(1, maxLeads)))
    .all<{ id: number; company_name: string; business_no: string | null; region: string | null; address: string | null }>()
    .catch(() => null))?.results || []

  let checked = 0, matched = 0, sample: unknown, lastMsg: string | undefined
  /** 빈 응답 1건의 증거(위 주석) — '검색 0건'과 '봉투 파싱 실패'를 다음 세션이 구분할 수 있게. */
  let emptyProbe: { name: string; len: number; keys: string; totalCount: string; head: string } | undefined
  // 🪙 서브리퀘스트 예산 — 이 레인이 유일하게 안 세고 있었다(오늘 고친 다른 레인들과 동일 계정 방식).
  //   한도(≈50) 안쪽에서 fetch·D1 을 모두 지불한다. 남는 2 는 마지막 배치 쓰기 몫.
  const budget = { left: Math.max(8, Math.min(45, maxLeads * 2)) }
  let limitHit = false
  const stamps: Array<{ id: number; members: number | null }> = [] // 도장은 모았다가 배치 1회
  for (const t of targets) {
    if (budget.left <= 2 || limitHit) break // 남은 행은 도장 없이 그대로 — 다음 라운드가 다시 집는다
    checked++
    /** ⚠️ 도장은 **실제로 조회한 뒤**에만 찍는다. 한도로 못 물어본 행에 찍으면 영구 배제된다(위 수리 사유). */
    const markChecked = (members: number | null) => { stamps.push({ id: t.id, members }) }
    const bizDigits = String(t.business_no || '').replace(/\D/g, '')
    const biz6 = bizDigits.length === 10 ? bizDigits.slice(0, 6) : ''
    // ① 사업장 기본 검색(상호 + 있으면 사업자번호 6자리로 서버측 축소)
    const params = new URLSearchParams({ wkpl_nm: t.company_name, numOfRows: '20', pageNo: '1', dataType: 'JSON' })
    if (biz6) params.set('bzowr_rgst_no', biz6)
    const url = `${NPS_BASE}/getBassInfoSearchV2?serviceKey=${serviceKeyParam(key)}&${params.toString()}`
    budget.left -= 1
    let netErr = ''
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) }).catch((e) => { netErr = String((e as Error)?.message || ''); return null })
    if (/too many subrequests/i.test(netErr)) { limitHit = true; checked--; break } // 우리 한도 — 이 행은 조회된 적 없다
    if (!res || !res.ok) {
      lastMsg = await describePublicDataFailure(res, netErr ? `네트워크 오류: ${netErr.slice(0, 80)}` : '네트워크 오류')
      // 상대 서버 실패는 '조회했으나 결과 없음' 이 아니다 — 도장 없이 넘긴다(다음 라운드 재시도).
      continue
    }
    const rawBody = await res.text().catch(() => '')
    const { items, msg } = parseItems(rawBody)
    if (msg) lastMsg = msg
    if (!sample && items[0]) sample = items[0]
    // 🩺 **0건의 정체를 남긴다**(2026-07-29) — 라이브가 `checked:40 · matched:0` 인데 `sample` 도 `error` 도
    //   없었다. 즉 매 요청이 200 인데 items 가 비어 있었다는 뜻인데, 그게 ⓐ 진짜로 검색 결과가 0 인지
    //   ⓑ 우리가 봉투를 못 푸는지 **구분할 근거가 하나도 없었다**(이 세션 내내 반복된 그 클래스).
    //   빈 응답의 최상위 키·본문 길이·totalCount 를 첫 1건만 기록한다(비용 0, 다음 세션이 추측 없이 판정).
    if (!items.length && !emptyProbe) {
      let keys = ''; let totalCount = ''
      try {
        const j = JSON.parse(rawBody) as Record<string, unknown>
        keys = Object.keys(j).join(',')
        const body = ((j.response as Record<string, unknown>)?.body ?? j.body) as Record<string, unknown> | undefined
        if (body) { keys += ` | body:${Object.keys(body).join(',')}`; totalCount = String(body.totalCount ?? '') }
      } catch { keys = '비JSON' }
      emptyProbe = { name: t.company_name.slice(0, 30), len: rawBody.length, keys: keys.slice(0, 200), totalCount, head: rawBody.slice(0, 160) }
    }
    // ② 엄격 매칭 — 상호 정규화 일치 필수 + (사업자6자리 or 지역 토큰) 보조 검증.
    const want = norm(t.company_name)
    const leadRegion = regionTokens(`${t.region || ''} ${t.address || ''}`)
    let seq = ''
    for (const it of items) {
      const nm = norm(g(it, 'wkplNm', 'wkpl_nm'))
      if (!nm || (nm !== want && !nm.includes(want) && !want.includes(nm))) continue
      const stcd = g(it, 'wkplJnngStcd', 'wkpl_jnng_stcd') // 1=등록(가입 중), 2=탈퇴
      if (stcd && stcd !== '1') continue
      const itBiz = g(it, 'bzowrRgstNo', 'bzowr_rgst_no').replace(/\D/g, '')
      const addr = g(it, 'wkplRoadNmDtlAddr', 'wkpl_road_nm_dtl_addr')
      const bizOk = !!biz6 && itBiz.slice(0, 6) === biz6
      let regionOk = false
      if (leadRegion.size) { for (const tok of regionTokens(addr)) if (leadRegion.has(tok)) { regionOk = true; break } }
      // 보조 검증: 사업자번호 있으면 그걸로, 없으면 지역으로. 둘 다 검증 불가(리드에 지역·주소 없음)면
      //   상호 완전일치(=== )일 때만 — 부분포함 매칭은 동명 리스크라 기각.
      if (!(bizOk || regionOk || (!biz6 && !leadRegion.size && nm === want))) continue
      seq = g(it, 'seq')
      break
    }
    if (!seq) { markChecked(null); continue } // 진짜 정보: 조회했고 일치가 없었다 → 도장 OK
    // ③ 상세 조회 → 가입자 수
    budget.left -= 1
    let dErr = ''
    const dRes = await fetch(`${NPS_BASE}/getDetailInfoSearchV2?serviceKey=${serviceKeyParam(key)}&seq=${encodeURIComponent(seq)}&dataType=JSON`, { signal: AbortSignal.timeout(15000) }).catch((e) => { dErr = String((e as Error)?.message || ''); return null })
    if (/too many subrequests/i.test(dErr)) { limitHit = true; break }
    if (!dRes || !dRes.ok) { lastMsg = await describePublicDataFailure(dRes, '상세조회 실패'); continue } // 도장 없이
    const detail = parseItems(await dRes.text().catch(() => ''))
    const members = parseInt(g(detail.items[0] || {}, 'jnngpCnt', 'jnngp_cnt'), 10)
    if (Number.isFinite(members) && members > 0) { markChecked(members); matched++ }
    else markChecked(null)
  }
  // 💾 도장은 배치 1회 — 건건이 쓰면 부기가 예산을 먹는다(오늘 다른 레인들과 동일 교훈).
  if (stamps.length) {
    await DB.batch(stamps.map(st => DB.prepare(
      "UPDATE ad_company_leads SET nps_members = ?, nps_checked_at = datetime('now') WHERE id = ?",
    ).bind(st.members, st.id))).catch(() => null)
  }

  // 한도로 끊긴 것은 '매칭 0' 과 전혀 다른 사건이다 — 뭉뚱그리면 또 오진한다.
  const error = limitHit ? `⛔ 플랫폼 요청한도 도달 — 조회 못 한 리드는 도장 없이 남겨 다음 라운드가 재시도 (checked=${checked})`
    : (checked > 0 && matched === 0 && lastMsg ? `API: ${lastMsg}` : undefined)
  const s: NpsStats = {
    last_run: stamp, checked, matched,
    total_checked: (prev?.total_checked || 0) + checked, total_matched: (prev?.total_matched || 0) + matched,
    diag: { configured: true, error, sample, empty_probe: emptyProbe },
  }
  await persist(s)
  return s
}
