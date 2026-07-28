/**
 * 🌙 2026-07-26 인플루언서 풀 자동 정비 (대표 "버튼 말고 자동으로") — 어드민 버튼과 동일 로직의 SSOT 모듈.
 *   버튼(admin-ads-influencers.routes)과 야간 cron(ur-ads scheduled)이 같은 함수를 호출 — 로직 이원화 금지.
 *   전부 멱등: 밤마다 돌려도 이미 정리된 풀엔 no-op. 실행 결과는 platform_settings('ads_maintenance_last')에 기록.
 *   🔒 서비스 분리: ad_* + platform_settings 만 접근.
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '@/worker/types/env'
import { ensureInfluencerSchema, extractContacts, stripVideoTitles } from './influencer-discovery'
import { reextractEmail, runReclassifyPool, runCategoryRescan, runYtLiveRefetch, enrichNaverActivity } from './influencer-performance'
import { runQualityPass } from './influencer-quality'
import { acquireLease, releaseLease, MAINTAIN_LEASE_KEY, MAINTAIN_LEASE_TTL_MS } from './collect-lease'
import { SUBREQ_CAP_KEY, resolveSubreqBudget, nextSubreqCap } from './collect-budget'
import { budgetedDb, newOpBudget, type OpBudget } from './maintenance-budget'

const POOL = 0

/** 🧬 중복 리드 통합 — 1차 이메일 / 2차 인스타(가드) / 3차 공유링크(가드) / 4차 이름+카테고리. 멱등(재실행 수렴). */
export async function mergeDuplicatePool(DB: D1Database, opts?: { groupCap?: number }): Promise<{ merged: number; mergedEmail: number; mergedInsta: number; mergedLink: number; mergedName: number; groups: number }> {
  await ensureInfluencerSchema(DB)

  const rank = "CASE status WHEN 'contracted' THEN 4 WHEN 'interested' THEN 3 WHEN 'contacted' THEN 2 WHEN 'hold' THEN 1 ELSE 0 END"
  type MRow = { id: number; email: string | null; instagram: string | null; tiktok: string | null; links: string | null; status: string | null; consented_at: string | null; source: string | null; memo: string | null; contacted_at: string | null; follow_up_at: string | null; subscriber_count: number | null; recent_avg_views: number | null; description: string | null }
  const MERGE_COLS = 'id, email, instagram, tiktok, links, status, consented_at, source, memo, contacted_at, follow_up_at, subscriber_count, recent_avg_views, description'
  const rankOf = (s: string | null) => (({ contracted: 4, interested: 3, contacted: 2, hold: 1 }) as Record<string, number>)[s || ''] || 0
  const GROUP_CAP = Math.max(20, Math.min(400, opts?.groupCap ?? 400)) // 실행당 패스별 그룹 상한(잔여는 다음 실행이 이어받음, 멱등)
  // 한 그룹(같은 키의 리드들)을 대표 1건으로 통합 — 삭제되는 행의 정보를 대표에 **보존 백필**(소실 방지).
  //   ⚠️ 동의증빙(consented_at)·수신동의는 병합으로 소실되면 합법 발송 대상이 사라짐(정보통신망법) → 그룹 전체에서 보존.
  //   🛡️ 2026-07-23 전수조사: 구독자수/평균조회수/소개글도 보존(그룹 최대/firstNonEmpty) — 이전엔 미보존 컬럼이라
  //   블로그 행이 대표로 뽑히면 YT 채널의 도달력 지표가 영구 소실돼 tier/핏 정렬에서 그 인플루언서가 사라졌음.
  const mergeRows = async (rows: MRow[], opts?: { guardDistinctEmail?: boolean }): Promise<number> => {
    if (rows.length < 2) return 0
    // 🛡️ 오병합 방지 — 서로 다른 이메일이 2개↑면 다른 사람이 같은 핸들/링크(대행사·협업·소속사)를 참조한 것 → 병합 안 함.
    if (opts?.guardDistinctEmail) {
      const emails = new Set(rows.map(r => (r.email || '').toLowerCase().trim()).filter(Boolean))
      if (emails.size > 1) return 0
    }
    const keep = rows[0]; const drop = rows.slice(1)
    const firstNonEmpty = (k: keyof MRow) => (rows.find(r => r[k] != null && r[k] !== '')?.[k] ?? null)
    const em = firstNonEmpty('email'), ig = firstNonEmpty('instagram'), tt = firstNonEmpty('tiktok'), lk = firstNonEmpty('links'), memo = firstNonEmpty('memo'), desc = firstNonEmpty('description')
    const status = rows.reduce<string | null>((a, r) => rankOf(r.status) > rankOf(a) ? r.status : a, keep.status) // 그룹 최고 상태
    const src = rows.find(r => r.source === 'inbound')?.source ?? keep.source ?? null                            // inbound(동의출처) 우선
    const consent = rows.map(r => r.consented_at).filter((v): v is string => !!v).sort()[0] ?? null              // 최초 동의시각
    const contacted = rows.map(r => r.contacted_at).filter((v): v is string => !!v).sort()[0] ?? null
    const followUp = rows.map(r => r.follow_up_at).filter((v): v is string => !!v).sort()[0] ?? null
    const maxSubs = Math.max(...rows.map(r => Number(r.subscriber_count) || 0))                                  // 도달력 지표 그룹 최대 보존
    const maxAvg = Math.max(...rows.map(r => Number(r.recent_avg_views) || 0))
    await DB.prepare('UPDATE ad_influencer_leads SET email=?, instagram=?, tiktok=?, links=?, status=?, consented_at=?, source=?, memo=?, contacted_at=?, follow_up_at=?, subscriber_count=?, recent_avg_views=?, description=COALESCE(description, ?) WHERE id=?')
      .bind(em, ig, tt, lk, status, consent, src, memo, contacted, followUp, maxSubs, maxAvg, desc, keep.id).run().catch(() => null)
    await DB.batch(drop.map(r => DB.prepare('DELETE FROM ad_influencer_leads WHERE id = ? AND account_id = ?').bind(r.id, POOL))).catch(() => null)
    return drop.length
  }
  // ⚖️ 동의(consented_at)·inbound 리드를 최우선 대표로 — 병합 시 삭제되면 수신동의·동의증빙이 소실돼
  //   합법 발송 대상(정보통신망법)이 사라짐. 그 다음 상태 랭크 → **구독자수(채널 정체성 — YT 행이 블로그 행에 안 밀리게)**
  //   → 정보량 순으로 대표 선정(2026-07-23: 정보량이 구독자보다 앞서 YT 채널 정체성이 삭제되던 순서 역전).
  const orderBy = `(consented_at IS NOT NULL) DESC, (CASE WHEN source = 'inbound' THEN 1 ELSE 0 END) DESC, ${rank} DESC, subscriber_count DESC, (CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN instagram IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN links IS NOT NULL THEN 1 ELSE 0 END) DESC, id ASC`
  let mergedEmail = 0, mergedInsta = 0
  // 1차 — 이메일.
  const emailGroups = (await DB.prepare(`SELECT email, COUNT(*) AS n FROM ad_influencer_leads
    WHERE account_id = ? AND email IS NOT NULL AND email != '' GROUP BY LOWER(email) HAVING n > 1`).bind(POOL)
    .all<{ email: string; n: number }>().catch(() => null))?.results || []
  for (const g of emailGroups.slice(0, GROUP_CAP)) {
    const rows = (await DB.prepare(`SELECT ${MERGE_COLS} FROM ad_influencer_leads
      WHERE account_id = ? AND LOWER(email) = LOWER(?) ORDER BY ${orderBy}`).bind(POOL, g.email)
      .all<MRow>().catch(() => null))?.results || []
    mergedEmail += await mergeRows(rows)
  }
  // 2차 — 인스타 핸들(이메일 병합 후 남은 상태 기준). 크로스플랫폼 동일인 자동 병합.
  const igGroups = (await DB.prepare(`SELECT LOWER(instagram) AS ig, COUNT(*) AS n FROM ad_influencer_leads
    WHERE account_id = ? AND instagram IS NOT NULL AND instagram != '' GROUP BY LOWER(instagram) HAVING n > 1`).bind(POOL)
    .all<{ ig: string; n: number }>().catch(() => null))?.results || []
  for (const g of igGroups.slice(0, GROUP_CAP)) {
    const rows = (await DB.prepare(`SELECT ${MERGE_COLS} FROM ad_influencer_leads
      WHERE account_id = ? AND LOWER(instagram) = ? ORDER BY ${orderBy}`).bind(POOL, g.ig)
      .all<MRow>().catch(() => null))?.results || []
    mergedInsta += await mergeRows(rows, { guardDistinctEmail: true }) // 인스타 병합은 서로 다른 이메일이면 다른 사람 → 스킵
  }
  // 3차 — 공유 링크(links: linktr.ee/블로그/유튜브 교차링크, 소문자 공백결합). 인메모리 그룹핑(멀티값 컬럼).
  //   🛡️ 2026-07-23: links 엔 협업 채널/소속사 URL(타인 공유 링크)도 섞여 남남이 한 그룹으로 묶일 수 있어
  //   guardDistinctEmail 을 2차와 동일 적용 — 이메일이 서로 다르면 다른 사람으로 보고 병합 스킵(오병합→오발송 차단).
  let mergedLink = 0
  const richness = (r: MRow) => (r.email ? 1 : 0) + (r.instagram ? 1 : 0) + (r.links ? 1 : 0)
  const cmpMR = (a: MRow, b: MRow) =>
    ((b.consented_at ? 1 : 0) - (a.consented_at ? 1 : 0)) ||
    (((b.source === 'inbound') ? 1 : 0) - ((a.source === 'inbound') ? 1 : 0)) ||
    (rankOf(b.status) - rankOf(a.status)) ||
    ((Number(b.subscriber_count) || 0) - (Number(a.subscriber_count) || 0)) || // 구독자 우선(orderBy 와 동일 — 채널 정체성 보존)
    (richness(b) - richness(a)) ||
    (a.id - b.id)
  const linkRows = (await DB.prepare(`SELECT ${MERGE_COLS} FROM ad_influencer_leads WHERE account_id = ? AND links IS NOT NULL AND links != ''`).bind(POOL)
    .all<MRow>().catch(() => null))?.results || []
  const byLink = new Map<string, MRow[]>()
  for (const r of linkRows) for (const tok of String(r.links || '').split(/\s+/).filter(t => t.length >= 8)) {
    const arr = byLink.get(tok) || []; arr.push(r); byLink.set(tok, arr)
  }
  const doneLink = new Set<number>()
  let linkGroupsDone = 0
  for (const [, group] of byLink) {
    if (linkGroupsDone >= GROUP_CAP) break
    const rows = group.filter(r => !doneLink.has(r.id))
    if (rows.length < 2) continue
    rows.sort(cmpMR)
    const n = await mergeRows(rows, { guardDistinctEmail: true })
    if (n) { mergedLink += n; rows.forEach(r => doneLink.add(r.id)); linkGroupsDone++ }
  }
  // 4차 — 이름+카테고리 코로보레이션(동명이인 방지: 이메일·인스타 둘 다 없는 잔여 + 같은 카테고리 + 2개+ 플랫폼 + 이름 3자↑).
  let mergedName = 0
  const NAME_STOP = new Set(['영상', '채널', '유튜브', '블로그', '공식', 'official', 'daily', 'vlog', 'tv'])
  const nameGroups = (await DB.prepare(`SELECT LOWER(TRIM(name)) AS nm, LOWER(COALESCE(category,'')) AS cat, COUNT(*) AS n, COUNT(DISTINCT platform) AS plats
    FROM ad_influencer_leads WHERE account_id = ? AND name IS NOT NULL AND LENGTH(TRIM(name)) >= 3
      AND (email IS NULL OR email = '') AND (instagram IS NULL OR instagram = '')
    GROUP BY LOWER(TRIM(name)), LOWER(COALESCE(category,'')) HAVING n > 1 AND plats > 1`).bind(POOL)
    .all<{ nm: string; cat: string; n: number; plats: number }>().catch(() => null))?.results || []
  for (const g of nameGroups.slice(0, GROUP_CAP)) {
    if (!g.nm || NAME_STOP.has(g.nm)) continue
    const rows = (await DB.prepare(`SELECT ${MERGE_COLS} FROM ad_influencer_leads
      WHERE account_id = ? AND LOWER(TRIM(name)) = ? AND LOWER(COALESCE(category,'')) = ?
        AND (email IS NULL OR email = '') AND (instagram IS NULL OR instagram = '') ORDER BY ${orderBy}`).bind(POOL, g.nm, g.cat)
      .all<MRow>().catch(() => null))?.results || []
    mergedName += await mergeRows(rows)
  }
  return { merged: mergedEmail + mergedInsta + mergedLink + mergedName, mergedEmail, mergedInsta, mergedLink, mergedName, groups: emailGroups.length + igGroups.length }
}

/** 🔗 기존 풀 소개글 연락처 재추출(백필, 멱등) — 개선된 추출기 재적용(API 재호출 0). 날조/대행사 이메일 소급 정리 포함. */
export async function reextractPoolContacts(DB: D1Database, opts?: { budget?: OpBudget }): Promise<{ scanned: number; filled: number; done: boolean }> {
  await ensureInfluencerSchema(DB)
  // 🔗 2026-07-28: OFFSET 전수스캔 → **id 커서**(품질/재분류 패스와 동일 패턴). 무료 플랜 예산에선 한 실행이
  //   전수를 못 도는데, 커서가 없으면 매번 앞부분만 다시 훑고 뒤쪽 백로그는 영원히 재추출되지 않는다.
  const CURSOR_KEY = 'ads_reextract_cursor'
  const PAGE = 2000
  let cursor = 0
  const cRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY)
    .first<{ value: string }>().catch(() => null)
  if (cRaw?.value) cursor = Math.max(0, parseInt(cRaw.value, 10) || 0)
  let scanned = 0, filled = 0, done = false
  for (;;) {
    const rows = (await DB.prepare(`SELECT id, description, email, instagram, tiktok, links FROM ad_influencer_leads
        WHERE account_id = ? AND id > ? AND description IS NOT NULL AND description != '' ORDER BY id ASC LIMIT ?`).bind(POOL, cursor, PAGE)
      .all<{ id: number; description: string | null; email: string | null; instagram: string | null; tiktok: string | null; links: string | null }>().catch(() => null))?.results || []
    if (!rows.length) { if (!opts?.budget?.exhausted) done = true; break }
    const pageStart = cursor
    for (const r of rows) cursor = Math.max(cursor, r.id)
    scanned += rows.length
    const ups: ReturnType<typeof DB.prepare>[] = []
    for (const r of rows) {
      const ex = extractContacts(stripVideoTitles(r.description || '')) // 🏷️ 영상 제목 속 타인 핸들 오수집 방지(F-10)
      const sets: string[] = []; const binds: (string | number | null)[] = []
      const emFix = reextractEmail(r.description, r.email) // 빈칸 채움 + 대행사→개인 교정 + 가짜메일(전치사 at) 제거
      if (emFix !== undefined) { sets.push('email = ?'); binds.push(emFix) }
      if (!r.instagram && ex.instagram[0]) { sets.push('instagram = ?'); binds.push(ex.instagram[0]) }
      if (!r.tiktok && ex.tiktok[0]) { sets.push('tiktok = ?'); binds.push(ex.tiktok[0]) }
      // links 합집합(공백 조인, dedup, 최대 8) — 기존 링크인바이오 보존 + 신규 유튜브/블로그 추가.
      const existing = (r.links || '').split(/\s+/).filter(Boolean)
      const merged = Array.from(new Set([...existing, ...ex.links])).slice(0, 8).join(' ')
      if (merged && merged !== (r.links || '')) { sets.push('links = ?'); binds.push(merged) }
      if (sets.length) ups.push(DB.prepare(`UPDATE ad_influencer_leads SET ${sets.join(', ')} WHERE id = ? AND account_id = ?`).bind(...binds, r.id, POOL))
    }
    for (let i = 0; i < ups.length; i += 100) await DB.batch(ups.slice(i, i + 100)).catch(() => null)
    filled += ups.length
    if (opts?.budget?.exhausted) { cursor = pageStart; scanned -= rows.length; break } // 쓰기가 잘림 → 이 페이지 재시도
    if (rows.length < PAGE) { done = true; break }
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(CURSOR_KEY, String(done ? 0 : cursor)).run().catch(() => null)
  return { scanned, filled, done }
}

/**
 * 🌙 야간 자동 정비(매일 1회, ur-ads cron KST 03시) — 버튼 시퀀스의 자동화:
 *   ① 중복 통합(그룹 상한 축소 — 며칠에 걸쳐 수렴) ② 연락처 재추출(날조 이메일 소급 제거)
 *   ③ 카테고리 재분류(저장 기반). ※ 라이브 재보정/재조회는 fetch-heavy 라 별도 시간대(runNightlyRescan).
 *   결과를 platform_settings 에 기록(무음 실패 방지 — 어드민 stats 로 노출 가능).
 */
export async function runNightlyMaintenance(env: Env): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { at: new Date().toISOString(), kind: 'maintenance' }
  for (const phase of MAINT_PHASES) {
    const r = await runMaintenancePhase(env, phase)
    Object.assign(out, { [phase]: r[phase] })
    if (r.busy) { out.busy = true; break }
  }
  return out
}

// ── 🧮 예산 인지 단계 실행(2026-07-28 근본수리) ─────────────────────────────
//   이전 구조는 4단계를 **한 인보케이션**에서 연달아 돌렸다 — 그런데 중복통합만 해도 그룹당 3쿼리 × 150그룹,
//   재추출/재분류는 3.6만 행 전수 페이징이라 **한 실행에 수백~수천 D1 연산**이 필요했다.
//   무료 플랜의 실효 상한은 인보케이션당 ~29(학습값). 즉 매 실행이 한도에서 죽었고, 모든 D1 호출이
//   `.catch(() => null)` 이라 **마지막 결과 기록조차 실패** → 어드민엔 "아무것도 안 돎"으로만 보였다.
//   ⇒ ① 단계당 1 인보케이션(fresh 예산) ② 예산 래퍼로 소진 시 안전 중단 ③ 커서로 다음 회차 이어받기
//      ④ **결과 스탬프는 예산 밖에서 항상 기록**(무음 정지 구조적 불가).
export type MaintPhase = 'merge' | 'reextract' | 'reclassify' | 'quality'
export const MAINT_PHASES: MaintPhase[] = ['merge', 'reextract', 'reclassify', 'quality']
export const isMaintPhase = (v: unknown): v is MaintPhase => MAINT_PHASES.includes(v as MaintPhase)

/** 단계 실행 lease TTL — 단계 하나는 짧다(예산 상한이 있으므로). 전체 파이프라인 TTL 과 별개. */
const PHASE_LEASE_TTL_MS = 3 * 60_000
/** 리스 해제·스탬프·커서 기록용으로 남겨두는 연산(예산에서 제외) — 이게 없으면 "기록조차 못 하는" 원래 병이 재발. */
const RESERVE_OPS = 6

/**
 * 🌙 정비 1단계 실행 — 예산 안에서 진행하고, **성공/중단/한도 여부를 반드시 기록**한다.
 *   반환·기록 형태는 기존 `ads_maintenance_last`(어드민 패널)와 호환(단계 키를 병합 갱신).
 */
export async function runMaintenancePhase(env: Env, phase: MaintPhase): Promise<Record<string, unknown>> {
  const DB = env.DB
  const at = new Date().toISOString()
  if (!await acquireLease(DB, MAINTAIN_LEASE_KEY, PHASE_LEASE_TTL_MS)) return { at, kind: 'maintenance', phase, busy: true }

  const envBudget = Math.max(10, Math.min(800, parseInt(String(env.ADS_MAINT_OPS_BUDGET || ''), 10) || 60))
  const learnedRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(SUBREQ_CAP_KEY)
    .first<{ value: string }>().catch(() => null)
  const learnedCap = Math.max(0, parseInt(learnedRaw?.value || '', 10) || 0)
  const total = resolveSubreqBudget(envBudget, learnedCap)
  const budget = newOpBudget(Math.max(6, total - RESERVE_OPS))
  const bdb = budgetedDb(DB, budget)

  const out: Record<string, unknown> = { at, kind: 'maintenance', phase }
  try {
    if (phase === 'merge') out.merge = await mergeDuplicatePool(bdb, { groupCap: 150 })
    else if (phase === 'reextract') out.reextract = await reextractPoolContacts(bdb, { budget })
    else if (phase === 'reclassify') out.reclassify = await runReclassifyPool(bdb, { budget })
    else out.quality = await runQualityPass(bdb, { budget })
  } catch (e) {
    out[`${phase}_error`] = (e as Error)?.message || 'fail'
  } finally {
    out.ops = budget.used
    out.cap = total
    out.paused = !!budget.exhausted   // 예산 소진으로 중단 — 다음 회차가 커서로 이어받는다(정상 동작)
    out.limit_hit = !!budget.limitHit // 플랫폼 한도 예외 관측 — 학습 상한을 내린다
    // 📉 학습 상한 갱신 — 수집 레인과 **같은 SSOT·같은 키**(한도는 워커 단위라 레인별로 다르지 않다).
    const nextCap = nextSubreqCap(budget.used, !!budget.limitHit, budget.left <= 0, learnedCap, envBudget)
    if (nextCap != null) {
      await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
        .bind(SUBREQ_CAP_KEY, String(nextCap)).run().catch(() => null)
      out.next_cap = nextCap
    }
    // ⭐ 결과 기록 — **예산 밖(실제 DB)에서, 항상**. 이전 단계 기록과 병합해 어드민 한 줄 요약을 유지.
    const prevRaw = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_maintenance_last'")
      .first<{ value: string }>().catch(() => null)
    let prev: Record<string, unknown> = {}
    try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as Record<string, unknown> : {} } catch { prev = {} }
    for (const k of Object.keys(prev)) if (k.endsWith('_error') || k === 'at' || k === 'kind' || k === 'phase') delete prev[k]
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_maintenance_last', JSON.stringify({ ...prev, ...out }).slice(0, 2000)).run().catch(() => null)
    await releaseLease(DB, MAINTAIN_LEASE_KEY)
  }
  return out
}

/** 🌙 야간 라이브 재보정(별도 시간대 KST 04시 — fetch-heavy 라 자체 인보케이션 예산 사용):
 *   🧭 카테고리 전체 재보정(커서 이어받기) + 🔄 라이브 재조회 2패스(0회·무메일·미분류 우선)
 *   + 📝 블로거 스윕(활동성·이웃수·프로필 연락처 — 시간당 20 개로는 백로그가 느려 밤에 60 개 추가). */
export async function runNightlyRescan(env: Env): Promise<Record<string, unknown>> {
  const DB = env.DB
  // 🔒 정비와 같은 lease — 이쪽은 **YouTube 쿼터를 쓰기 때문에** 중복 실행이 곧 하루 예산 낭비(수집 몫 잠식).
  if (!await acquireLease(DB, MAINTAIN_LEASE_KEY, MAINTAIN_LEASE_TTL_MS)) return { at: new Date().toISOString(), kind: 'rescan', busy: true }
  const out: Record<string, unknown> = { at: new Date().toISOString(), kind: 'rescan' }
  try {
    try { out.rescan = await runCategoryRescan(env) } catch (e) { out.rescan_error = (e as Error)?.message || 'fail' }
    // passes 4 = 80채널/밤 — 기존 측정행의 롱폼 중앙값 소급 가속(YT units ~100/밤 — 일일 쿼터 10k 대비 미미).
    try { out.refetch = await runYtLiveRefetch(env, 4) } catch (e) { out.refetch_error = (e as Error)?.message || 'fail' }
    try { out.naver = await enrichNaverActivity(DB, { left: 150 }, 60) } catch (e) { out.naver_error = (e as Error)?.message || 'fail' }
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_maintenance_rescan_last', JSON.stringify(out).slice(0, 1000)).run().catch(() => null)
  } finally { await releaseLease(DB, MAINTAIN_LEASE_KEY) }
  return out
}
