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
 */
import type { Env } from '@/worker/types/env'
import { ensureCompanySchema } from './company-discovery'
import { parseItems } from './hira-hospital-collect'

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
  diag: { configured: boolean; error?: string; sample?: unknown }
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
      WHERE active = 1 AND nps_checked_at IS NULL AND length(company_name) >= 2
      ORDER BY (CASE WHEN category = '대행사' THEN 0 ELSE 1 END), (tier IS NULL) ASC, tier ASC, id ASC LIMIT ?`)
    .bind(Math.min(100, Math.max(1, maxLeads)))
    .all<{ id: number; company_name: string; business_no: string | null; region: string | null; address: string | null }>()
    .catch(() => null))?.results || []

  let checked = 0, matched = 0, sample: unknown, lastMsg: string | undefined
  for (const t of targets) {
    checked++
    const markChecked = async (members: number | null) => {
      await DB.prepare("UPDATE ad_company_leads SET nps_members = ?, nps_checked_at = datetime('now') WHERE id = ?").bind(members, t.id).run().catch(() => null)
    }
    const bizDigits = String(t.business_no || '').replace(/\D/g, '')
    const biz6 = bizDigits.length === 10 ? bizDigits.slice(0, 6) : ''
    // ① 사업장 기본 검색(상호 + 있으면 사업자번호 6자리로 서버측 축소)
    const params = new URLSearchParams({ wkpl_nm: t.company_name, numOfRows: '20', pageNo: '1', dataType: 'JSON' })
    if (biz6) params.set('bzowr_rgst_no', biz6)
    const url = `${NPS_BASE}/getBassInfoSearchV2?serviceKey=${encodeURIComponent(key)}&${params.toString()}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) }).catch(() => null)
    if (!res || !res.ok) { lastMsg = res ? `HTTP ${res.status}` : '네트워크 오류'; await markChecked(null); continue }
    const { items, msg } = parseItems(await res.text().catch(() => ''))
    if (msg) lastMsg = msg
    if (!sample && items[0]) sample = items[0]
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
    if (!seq) { await markChecked(null); continue }
    // ③ 상세 조회 → 가입자 수
    const dRes = await fetch(`${NPS_BASE}/getDetailInfoSearchV2?serviceKey=${encodeURIComponent(key)}&seq=${encodeURIComponent(seq)}&dataType=JSON`, { signal: AbortSignal.timeout(15000) }).catch(() => null)
    if (!dRes || !dRes.ok) { await markChecked(null); continue }
    const detail = parseItems(await dRes.text().catch(() => ''))
    const members = parseInt(g(detail.items[0] || {}, 'jnngpCnt', 'jnngp_cnt'), 10)
    if (Number.isFinite(members) && members > 0) { await markChecked(members); matched++ }
    else await markChecked(null)
  }

  const error = checked > 0 && matched === 0 && lastMsg ? `API: ${lastMsg}` : undefined
  const s: NpsStats = {
    last_run: stamp, checked, matched,
    total_checked: (prev?.total_checked || 0) + checked, total_matched: (prev?.total_matched || 0) + matched,
    diag: { configured: true, error, sample },
  }
  await persist(s)
  return s
}
