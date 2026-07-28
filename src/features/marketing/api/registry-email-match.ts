/**
 * 🔗 레지스트리 이메일 이식 — **크롤 0회로 타깃 카테고리 이메일 확보** (2026-07-28 전수조사 결과).
 *
 *   전수조사가 드러낸 구조: 이메일 16,434건 중 **16,396건(99.8%)이 통신판매 원부(`source='commerce'`)에서
 *   그냥 받아온 것**이고 크롤이 만든 건 ~38건(0.2%)뿐이다. 반면 영업 타깃(대행사·전문서비스·간판)은
 *   `source='local'`(카카오·네이버)이라 **`business_no` 가 NULL** → 원부와 조인 키가 없어 그 이메일을 못 쓴다.
 *
 *   ⇒ **상호(+주소) 매칭으로 원부의 이메일·홈페이지를 타깃에 이식**한다. 외부 API·서브리퀘스트 **0** — 순수 DB 내부 작업이라
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

/**
 * 🪙 D1 예산 — **D1 쿼리도 서브리퀘스트다**. 이 레인은 "외부 API 0회" 라 무한정 쓸 수 있다고 적혀 있었는데,
 *   그게 `matched: 0` 이 몇 달 이어진 진짜 원인이었다(아래 matchRegistryEmails 주석 참조). 이제 세고, 다 쓰면 멈춘다.
 */
export interface D1Budget { left: number; exhausted?: boolean }
const spend = (b: D1Budget | undefined, n = 1): void => { if (b) { b.left -= n; if (b.left <= 0) b.exhausted = true } }

/** 법인격 표기·공백·괄호·기호를 털어낸 상호 지문. 양쪽(원부/타깃)에 **같은 함수**를 적용해야 매칭이 성립한다. */
export function normalizeCompanyName(raw: string | null | undefined): string {
  return String(raw || '')
    .replace(/\(주\)|\(유\)|\(재\)|\(사\)|㈜|㈐|주식회사|유한회사|합자회사|합명회사|재단법인|사단법인|유한책임회사/g, '')
    .replace(/[\s　]+/g, '')
    .replace(/[.,'"`~!@#$%^&*()\-_=+[\]{}|\\/<>?:;]/g, '')
    .toLowerCase()
}

/** 🔤 name_norm 백필 — 기존 행에 상호 지문을 채운다(신규 행은 저장 시 채워짐).
 *   ⚠️ 정규화를 SQL 로 흉내내지 않는다 — 그게 애초에 어긋남의 원인이었다. **JS 함수 하나**로만 계산한다.
 *   서브리퀘스트 2회(SELECT + batch 1회). 원부(commerce) 를 먼저 채워야 매칭이 살아난다 → 우선 정렬.
 *   @returns 남은 미처리 행이 더 있으면 false
 */
export async function backfillNameNorm(DB: D1Database, limit = 500, budget?: D1Budget): Promise<{ done: boolean; filled: number }> {
  spend(budget, 2)
  const rows = (await DB.prepare(
    `SELECT id, company_name FROM ad_company_leads
      WHERE name_norm IS NULL AND company_name IS NOT NULL AND company_name != ''
      ORDER BY (CASE WHEN source = 'commerce' THEN 0 ELSE 1 END), id ASC LIMIT ?`,
  ).bind(Math.max(1, Math.min(2000, limit))).all<{ id: number; company_name: string }>().catch(() => null))?.results || []
  if (!rows.length) return { done: true, filled: 0 }
  await DB.batch(rows.map(r => DB.prepare('UPDATE ad_company_leads SET name_norm = ? WHERE id = ?')
    .bind(normalizeCompanyName(r.company_name), r.id))).catch(() => null)
  return { done: rows.length < limit, filled: rows.length }
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
  /** 남은 지문 백필 여부 — true 면 아직 원부 일부가 매칭 대상에 안 들어와 있다(다음 패스가 이어받음). */
  backfilling?: boolean
  /** 이 패스가 쓴 D1 쿼리 수 / 예산 — 한도에 눌려 조기 종료했는지 판정(무증거 0건 금지). */
  d1?: number; d1_budget?: number; budget_exhausted?: boolean
}
const STATS_KEY = 'ads_registry_match_stats'
const CURSOR_KEY = 'ads_registry_match_cursor'

/**
 * 1 패스 — 이메일/홈페이지가 없는 타깃 리드를 원부와 대조해 **확신 매칭만** 이식.
 *   이메일은 즉시 자산이 되고, **홈페이지는 크롤 대상을 늘려 이메일 확보 경로를 새로 연다**
 *   (타깃의 73%가 사이트 미발견이라 크롤 자체가 불가능했던 병목의 정면 공략).
 *   서브리퀘스트 0(전부 D1). 커서로 대량 백로그를 나눠 순회한다.
 */
export async function matchRegistryEmails(env: Env, batch = 400, budget?: D1Budget): Promise<RegistryMatchStats> {
  // 🔤 매칭 전에 상호 지문을 채운다 — 원부(commerce) 우선이라 매칭 정확도가 회차마다 올라간다.
  //   예산이 허락하는 만큼 여러 번 돌린다(원부 10만행 → 500씩이면 200패스라 버튼 한 번으로는 영영 안 끝났다).
  const budgetStart = budget ? budget.left : 0
  let backfilling = false
  for (let i = 0; i < 20; i++) {
    if (budget && budget.left <= 12) { backfilling = true; break } // 매칭 몫은 남겨둔다
    const r = await backfillNameNorm(env.DB, 500, budget).catch(() => null)
    if (!r) { backfilling = true; break }
    if (r.done) break
    backfilling = true
  }
  const DB = env.DB
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  spend(budget, 2) // 아래 stats/cursor SELECT 2회
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: RegistryMatchStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as RegistryMatchStats : null } catch { prev = null }
  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let cursor = parseInt(curRaw?.value || '0', 10); if (!Number.isFinite(cursor) || cursor < 0) cursor = 0

  // 대상 = 이메일 없는 **비-원부** 리드(원부끼리 매칭은 의미 없음). 커서 순회로 전량 커버.
  spend(budget)
  const targets = (await DB.prepare(
    `SELECT id, company_name, address, region, website FROM ad_company_leads
      WHERE id > ? AND ((email IS NULL OR email = '') OR (website IS NULL OR website = '')) AND COALESCE(source,'') != 'commerce'
      ORDER BY id ASC LIMIT ?`
  ).bind(cursor, batch).all<{ id: number; company_name: string; address: string | null; region: string | null; website: string | null }>().catch(() => null))?.results || []

  const skip: Record<string, number> = {}
  const updates: { id: number; email: string | null; website: string | null }[] = []

  // 🧮 원부 후보를 **한꺼번에** 가져온다 (2026-07-28 근본수리).
  //   예전엔 대상 1건마다 SELECT 를 1~2회 날렸다 — batch=400 이면 최대 **800 쿼리**. D1 쿼리도 서브리퀘스트라
  //   40여 번째부터 전부 throw 했고, 그 throw 를 `.catch(() => null)` 가 삼켜 `cands=[]` → 전부
  //   **`no_registry_row` 로 기록**됐다. 라이브 실측이 정확히 그 모양이었다: `scanned:400 · matched:0 ·
  //   no_registry_row:395`. "원부에 그 회사가 없다"가 아니라 **조회를 못 한 것**이었는데 통계는 전자로 읽혔다.
  //   (헤더가 경고한 국민연금 레인의 '누적 매칭 0' 도 같은 모양일 가능성이 높다 — 별건으로 확인 필요.)
  //   ⇒ 이름 지문을 모아 `IN (…)` 으로 조회한다. D1 은 문장당 바인딩 100개까지라 90개씩 끊는다.
  //   비용: 400건에 5~6 쿼리(이전 800). 이제 한 패스가 예산 안에서 확실히 끝난다.
  const wanted: Array<{ t: typeof targets[number]; n: string }> = []
  for (const t of targets) {
    const n = normalizeCompanyName(t.company_name)
    if (n.length < 4 || GENERIC_NAME.test(n)) { const k = n.length < 4 ? 'name_too_short' : 'generic_name'; skip[k] = (skip[k] || 0) + 1; continue }
    wanted.push({ t, n })
  }
  type Cand = { company_name: string; address: string | null; email: string | null; website: string | null; name_norm: string }
  const byNorm = new Map<string, Cand[]>()
  const names = [...new Set(wanted.map(w => w.n))]
  for (let i = 0; i < names.length; i += 90) {
    if (budget?.exhausted) { skip.budget_exhausted = (skip.budget_exhausted || 0) + 1; break }
    const chunk = names.slice(i, i + 90)
    spend(budget)
    const rows = (await DB.prepare(
      `SELECT company_name, address, email, website, name_norm FROM ad_company_leads
        WHERE source = 'commerce' AND name_norm IN (${chunk.map(() => '?').join(',')})
          AND ((email IS NOT NULL AND email != '') OR (website IS NOT NULL AND website != ''))`
    ).bind(...chunk).all<Cand>().catch(() => null))
    if (!rows) { skip.registry_query_failed = (skip.registry_query_failed || 0) + 1; continue } // 조용한 0건 금지
    for (const r of rows.results || []) {
      const arr = byNorm.get(r.name_norm)
      // 이름당 6건까지만 — 예전 쿼리의 `LIMIT 5` 와 같은 의미(2건 이상이면 어차피 ambiguous 로 버린다)이고,
      //   흔한 상호가 수천 행을 물고 와 메모리를 먹는 것도 막는다.
      if (arr) { if (arr.length < 6) arr.push(r) } else byNorm.set(r.name_norm, [r])
    }
  }

  for (const { t, n } of wanted) {
    const exact = (byNorm.get(n) || []).filter(c => normalizeCompanyName(c.company_name) === n)
    if (!exact.length) { skip.no_registry_row = (skip.no_registry_row || 0) + 1; continue }
    const verdict = isConfidentMatch({ name: t.company_name, address: t.address, region: t.region }, { name: exact[0].company_name, address: exact[0].address }, exact.length === 1)
    if (!verdict.ok) { skip[verdict.reason] = (skip[verdict.reason] || 0) + 1; continue }
    const email = (exact[0].email || '').trim().toLowerCase() || null
    const website = (exact[0].website || '').trim() || null
    if (!email && !website) { skip.registry_row_empty = (skip.registry_row_empty || 0) + 1; continue }
    updates.push({ id: t.id, email, website })
  }

  // 반송 억제 목록에 있는 주소는 이식하지 않는다(품질 루프 존중).
  let matched = 0
  if (updates.length) {
    // 이메일은 반송 억제 목록에 걸리면 이식하지 않는다(품질 루프 존중). 홈페이지는 그와 무관하게 이식.
    const rows = await DB.batch(updates.map(u => DB.prepare(
      `UPDATE ad_company_leads
         SET email = CASE WHEN ? IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ad_email_suppress s WHERE s.email = ?)
                          THEN COALESCE(email, ?) ELSE email END,
             website = COALESCE(website, ?),
             contact_source = COALESCE(contact_source, 'registry'),
             active = CASE WHEN COALESCE(email, ?) IS NOT NULL OR phone IS NOT NULL THEN 1 ELSE active END
       WHERE id = ? AND ((email IS NULL OR email = '') OR (website IS NULL OR website = ''))`
    ).bind(u.email, u.email, u.email, u.website, u.email, u.id))).catch(() => null)
    spend(budget)
    if (!rows) skip.update_batch_failed = (skip.update_batch_failed || 0) + 1 // 조용한 0건 금지
    matched = (rows || []).reduce((s, r) => s + ((r as { meta?: { changes?: number } })?.meta?.changes || 0), 0)
  }

  const nextCursor = targets.length ? targets[targets.length - 1].id : 0 // 소진하면 0 으로 되돌려 다음 라운드 재순회
  spend(budget, 2)
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(nextCursor)).run().catch(() => null)
  const stats: RegistryMatchStats = {
    last_run: stamp, scanned: targets.length, matched,
    total_matched: (prev?.total_matched || 0) + matched, skip_reason: skip, done: targets.length < batch,
    backfilling, ...(budget ? { d1: Math.max(0, budgetStart - budget.left), d1_budget: budgetStart, budget_exhausted: !!budget.exhausted } : {}),
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(stats)).run().catch(() => null)
  return stats
}
