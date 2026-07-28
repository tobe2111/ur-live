/**
 * 🔗 레지스트리 이메일 이식 — **크롤 0회로 타깃 카테고리 이메일 확보** (2026-07-28 전수조사 결과).
 *
 *   전수조사가 드러낸 구조: 이메일 16,434건 중 **16,396건(99.8%)이 통신판매 원부(`source='commerce'`)에서
 *   그냥 받아온 것**이고 크롤이 만든 건 ~38건(0.2%)뿐이다. 반면 영업 타깃(대행사·전문서비스·간판)은
 *   `source='local'`(카카오·네이버)이라 **`business_no` 가 NULL** → 원부와 조인 키가 없어 그 이메일을 못 쓴다.
 *
 *   ⇒ **상호(+주소) 매칭으로 원부 이메일을 타깃에 이식**한다. 외부 API·서브리퀘스트 **0** — 순수 DB 내부 작업이라
 *   크롤 한도 문제와 무관하고 즉시 대량 처리된다. 같은 사업자가 통신판매업도 신고했다면 그 이메일이 곧 그 업체 것이다.
 *
 *   ⚠️ **허위 0 — 오귀속(엉뚱한 회사 이메일 부착)이 이 기능의 유일한 리스크**라 게이트를 세 겹으로 둔다:
 *     ① **유일 매칭만**(정규화 상호가 원부에서 정확히 1건일 때만) — 동명이인 다수면 판단 불가 → 건너뜀
 *     ② **주소 합의**(양쪽에 주소가 있으면 행정구역/도로명 토큰이 겹쳐야 함)
 *     ③ **식별력 있는 상호만**(정규화 후 4자 이상. '스튜디오'·'컨설팅' 류 일반명사 단독 제외)
 *   판단이 서지 않으면 **비워둔다**. 만들어내지 않는다.
 *
 *   ⚠️ 선행 전례: 국민연금 규모조회가 같은 상호 매칭으로 **누적 매칭 0** 이다(정규화 불일치 추정).
 *   그래서 여기선 정규화를 SQL 이 아니라 **JS 에서 동일 함수로 양쪽에 적용**하고, 매칭 실패 사유를 집계해
 *   "왜 안 붙었나"를 데이터로 남긴다(추측 금지).
 */
import type { Env } from '@/worker/types/env'

/** 법인격 표기·공백·괄호·기호를 털어낸 상호 지문. 양쪽(원부/타깃)에 **같은 함수**를 적용해야 매칭이 성립한다. */
export function normalizeCompanyName(raw: string | null | undefined): string {
  return String(raw || '')
    .replace(/\(주\)|\(유\)|\(재\)|\(사\)|㈜|㈐|주식회사|유한회사|합자회사|합명회사|재단법인|사단법인|유한책임회사/g, '')
    .replace(/[\s　]+/g, '')
    .replace(/[.,'"`~!@#$%^&*()\-_=+[\]{}|\\/<>?:;]/g, '')
    .toLowerCase()
}

/** 일반명사 단독 상호 — 유일 매칭이어도 동일 업체라 볼 수 없다(식별력 부족). */
const GENERIC_NAME = /^(스튜디오|컨설팅|마케팅|디자인|기획|광고|미디어|커뮤니케이션|파트너스|그룹|컴퍼니|코리아|서비스|시스템|솔루션|테크|랩|랩스|하우스|센터|플러스|월드)$/

/** 주소 지문 토큰(동/로/길 + 번지) — 두 주소가 같은 곳을 가리키는지 판정. */
function addrTokens(s: string | null | undefined): Set<string> {
  return new Set((String(s || '')).replace(/\s+/g, ' ').match(/[가-힣]+[동로길시군구]|\d+(?:-\d+)?/g) || [])
}
/** 주소 합의 — 공유 토큰 2개 이상이면 같은 곳으로 본다(contact-enrich sameAddr 와 동일 기준). */
export function addressAgrees(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = addrTokens(a), tb = addrTokens(b)
  if (!ta.size || !tb.size) return false
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared >= 2
}

/**
 * 두 행이 **같은 업체**라고 확신할 수 있는가 — 위 3겹 게이트의 순수함수 판정(유닛 테스트 대상).
 * @param unique 정규화 상호가 원부에서 유일했는가(호출부가 SQL 로 판정해 전달)
 */
export function isConfidentMatch(
  target: { name: string; address?: string | null; region?: string | null },
  registry: { name: string; address?: string | null },
  unique: boolean,
): { ok: boolean; reason: string } {
  if (!unique) return { ok: false, reason: 'ambiguous' }              // ① 동명 다수 → 판단 불가
  const n = normalizeCompanyName(target.name)
  if (n.length < 4) return { ok: false, reason: 'name_too_short' }     // ③ 식별력 부족
  if (GENERIC_NAME.test(n)) return { ok: false, reason: 'generic_name' }
  if (n !== normalizeCompanyName(registry.name)) return { ok: false, reason: 'name_mismatch' }
  const bothHaveAddr = !!(target.address || '').trim() && !!(registry.address || '').trim()
  if (bothHaveAddr) {                                                  // ② 주소 합의(양쪽 있을 때만 요구)
    if (!addressAgrees(target.address, registry.address)) return { ok: false, reason: 'address_conflict' }
    return { ok: true, reason: 'name+address' }
  }
  // 주소가 한쪽이라도 없으면 상호만으로 판단 — 매우 식별력 높은 이름(6자+)일 때만 허용.
  if (n.length >= 6) return { ok: true, reason: 'name_only_distinctive' }
  return { ok: false, reason: 'need_address' }
}

export interface RegistryMatchStats {
  last_run: string; scanned: number; matched: number; total_matched: number
  skip_reason: Record<string, number>; done: boolean
}
const STATS_KEY = 'ads_registry_match_stats'
const CURSOR_KEY = 'ads_registry_match_cursor'

/**
 * 1 패스 — 이메일 없는 타깃 리드를 원부(이메일 보유)와 대조해 확신 매칭만 이식.
 * 서브리퀘스트 0(전부 D1). 커서로 대량 백로그를 나눠 순회한다.
 */
export async function matchRegistryEmails(env: Env, batch = 400): Promise<RegistryMatchStats> {
  const DB = env.DB
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: RegistryMatchStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as RegistryMatchStats : null } catch { prev = null }
  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let cursor = parseInt(curRaw?.value || '0', 10); if (!Number.isFinite(cursor) || cursor < 0) cursor = 0

  // 대상 = 이메일 없는 **비-원부** 리드(원부끼리 매칭은 의미 없음). 커서 순회로 전량 커버.
  const targets = (await DB.prepare(
    `SELECT id, company_name, address, region FROM ad_company_leads
      WHERE id > ? AND (email IS NULL OR email = '') AND COALESCE(source,'') != 'commerce'
      ORDER BY id ASC LIMIT ?`
  ).bind(cursor, batch).all<{ id: number; company_name: string; address: string | null; region: string | null }>().catch(() => null))?.results || []

  const skip: Record<string, number> = {}
  const updates: { id: number; email: string }[] = []

  for (const t of targets) {
    const n = normalizeCompanyName(t.company_name)
    if (n.length < 4 || GENERIC_NAME.test(n)) { skip[n.length < 4 ? 'name_too_short' : 'generic_name'] = (skip[n.length < 4 ? 'name_too_short' : 'generic_name'] || 0) + 1; continue }
    // 원부 후보 — 상호 앞부분으로 좁힌 뒤(인덱스 활용 불가하므로 LIKE 로 1차 축소) JS 정규화로 확정.
    //   최대 5건만 보고, 정규화 일치가 2건 이상이면 ambiguous 로 건너뛴다(오귀속 방지).
    const cands = (await DB.prepare(
      `SELECT company_name, address, email FROM ad_company_leads
        WHERE source = 'commerce' AND email IS NOT NULL AND email != ''
          AND REPLACE(REPLACE(REPLACE(LOWER(company_name),' ',''),'(주)',''),'주식회사','') LIKE ?
        LIMIT 5`
    ).bind(`%${n.slice(0, 12)}%`).all<{ company_name: string; address: string | null; email: string }>().catch(() => null))?.results || []
    const exact = cands.filter(c => normalizeCompanyName(c.company_name) === n)
    if (!exact.length) { skip.no_registry_row = (skip.no_registry_row || 0) + 1; continue }
    const verdict = isConfidentMatch({ name: t.company_name, address: t.address, region: t.region }, { name: exact[0].company_name, address: exact[0].address }, exact.length === 1)
    if (!verdict.ok) { skip[verdict.reason] = (skip[verdict.reason] || 0) + 1; continue }
    updates.push({ id: t.id, email: exact[0].email.toLowerCase() })
  }

  // 반송 억제 목록에 있는 주소는 이식하지 않는다(품질 루프 존중).
  let matched = 0
  if (updates.length) {
    const rows = await DB.batch(updates.map(u => DB.prepare(
      `UPDATE ad_company_leads SET email = COALESCE(email, ?), contact_source = COALESCE(contact_source, 'registry'),
         active = 1
       WHERE id = ? AND (email IS NULL OR email = '')
         AND NOT EXISTS (SELECT 1 FROM ad_email_suppress s WHERE s.email = ?)`
    ).bind(u.email, u.id, u.email))).catch(() => null)
    matched = (rows || []).reduce((s, r) => s + ((r as { meta?: { changes?: number } })?.meta?.changes || 0), 0)
  }

  const nextCursor = targets.length ? targets[targets.length - 1].id : 0 // 소진하면 0 으로 되돌려 다음 라운드 재순회
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(nextCursor)).run().catch(() => null)
  const stats: RegistryMatchStats = {
    last_run: stamp, scanned: targets.length, matched,
    total_matched: (prev?.total_matched || 0) + matched, skip_reason: skip, done: targets.length < batch,
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(stats)).run().catch(() => null)
  return stats
}
