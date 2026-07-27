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
export async function reextractPoolContacts(DB: D1Database): Promise<{ scanned: number; filled: number }> {
  await ensureInfluencerSchema(DB)
  let scanned = 0, filled = 0
  for (let off = 0; ; off += 2000) {
    const rows = (await DB.prepare(`SELECT id, description, email, instagram, tiktok, links FROM ad_influencer_leads
        WHERE account_id = ? AND description IS NOT NULL AND description != '' ORDER BY id ASC LIMIT 2000 OFFSET ?`).bind(POOL, off)
      .all<{ id: number; description: string | null; email: string | null; instagram: string | null; tiktok: string | null; links: string | null }>().catch(() => null))?.results || []
    if (!rows.length) break
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
    if (rows.length < 2000) break
  }
  return { scanned, filled }
}

/**
 * 🌙 야간 자동 정비(매일 1회, ur-ads cron KST 03시) — 버튼 시퀀스의 자동화:
 *   ① 중복 통합(그룹 상한 축소 — 며칠에 걸쳐 수렴) ② 연락처 재추출(날조 이메일 소급 제거)
 *   ③ 카테고리 재분류(저장 기반). ※ 라이브 재보정/재조회는 fetch-heavy 라 별도 시간대(runNightlyRescan).
 *   결과를 platform_settings 에 기록(무음 실패 방지 — 어드민 stats 로 노출 가능).
 */
export async function runNightlyMaintenance(env: Env): Promise<Record<string, unknown>> {
  const DB = env.DB
  const out: Record<string, unknown> = { at: new Date().toISOString(), kind: 'maintenance' }
  try { out.merge = await mergeDuplicatePool(DB, { groupCap: 150 }) } catch (e) { out.merge_error = (e as Error)?.message || 'fail' }
  try { out.reextract = await reextractPoolContacts(DB) } catch (e) { out.reextract_error = (e as Error)?.message || 'fail' }
  try { out.reclassify = await runReclassifyPool(DB) } catch (e) { out.reclassify_error = (e as Error)?.message || 'fail' }
  // 🏅 품질 패스 — 브랜드 공식 채널 태깅 + 리드 스코어 재계산(커서 순환, 회차당 상한 있음).
  try { out.quality = await runQualityPass(DB) } catch (e) { out.quality_error = (e as Error)?.message || 'fail' }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind('ads_maintenance_last', JSON.stringify(out).slice(0, 1000)).run().catch(() => null)
  return out
}

/** 🌙 야간 라이브 재보정(별도 시간대 KST 04시 — fetch-heavy 라 자체 인보케이션 예산 사용):
 *   🧭 카테고리 전체 재보정(커서 이어받기) + 🔄 라이브 재조회 2패스(0회·무메일·미분류 우선)
 *   + 📝 블로거 스윕(활동성·이웃수·프로필 연락처 — 시간당 20 개로는 백로그가 느려 밤에 60 개 추가). */
export async function runNightlyRescan(env: Env): Promise<Record<string, unknown>> {
  const DB = env.DB
  const out: Record<string, unknown> = { at: new Date().toISOString(), kind: 'rescan' }
  try { out.rescan = await runCategoryRescan(env) } catch (e) { out.rescan_error = (e as Error)?.message || 'fail' }
  // passes 4 = 80채널/밤 — 기존 측정행의 롱폼 중앙값 소급 가속(YT units ~100/밤 — 일일 쿼터 10k 대비 미미).
  try { out.refetch = await runYtLiveRefetch(env, 4) } catch (e) { out.refetch_error = (e as Error)?.message || 'fail' }
  try { out.naver = await enrichNaverActivity(DB, { left: 150 }, 60) } catch (e) { out.naver_error = (e as Error)?.message || 'fail' }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind('ads_maintenance_rescan_last', JSON.stringify(out).slice(0, 1000)).run().catch(() => null)
  return out
}
