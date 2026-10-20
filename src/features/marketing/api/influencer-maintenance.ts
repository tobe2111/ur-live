/**
 * 🌙 2026-07-26 인플루언서 풀 자동 정비 (대표 "버튼 말고 자동으로") — 어드민 버튼과 동일 로직의 SSOT 모듈.
 *   버튼(admin-ads-influencers.routes)과 야간 cron(ur-ads scheduled)이 같은 함수를 호출 — 로직 이원화 금지.
 *   전부 멱등: 밤마다 돌려도 이미 정리된 풀엔 no-op. 실행 결과는 platform_settings('ads_maintenance_last')에 기록.
 *   🔒 서비스 분리: ad_* + platform_settings 만 접근.
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '@/worker/types/env'
import { ensureInfluencerSchema, extractContacts, stripVideoTitles } from './influencer-discovery'
import { reextractEmail, runReclassifyPool, runCategoryRescan, runYtLiveRefetch, enrichNaverActivity, poolScanShouldStop } from './influencer-performance'
import { recomputeKeywordContactYieldBucketed } from './influencer-keyword-yield' // 📉 2026-09-02 6h 버킷 게이트
import { cleanSelfLinks, SELF_BLOG_LIKE } from './influencer-self-link'
import { runQualityPass, QUALITY_DEADLINE_MS_FREE } from './influencer-quality'
import { acquireLease, releaseLease, MAINTAIN_LEASE_KEY, MAINTAIN_LEASE_TTL_MS } from './collect-lease'
import { MAINT_PHASE_CURSOR_KEY, MAINT_SCHEDULE_VERSION, parsePhaseCursor, formatPhaseCursor, nextPhaseSlot } from './maintenance-phase-cursor'
import { subreqCapKey, resolveSubreqBudget, nextSubreqCap, envSubreqCap, envLaneBudget, envPlanValue } from './collect-budget'
import { budgetedDb, newOpBudget, type OpBudget } from './maintenance-budget'
import { applyQuantum, readLaneSettings } from './cpu-quantum'
import { RESCAN_DEADLINE_MS, RESCAN_DEADLINE_MS_PAID, RESCAN_ORDER_KEY, normalizeOrder, nextOrder, rotatedOrder } from './rescan-rotation'
import { healNaverHandles } from './influencer-handle-heal'
// 📍 지역 백필 — 여기(정비 인보케이션)가 제자리다. 근거는 `sweepRegions` 주석.
import { backfillRegions, recheckBlankRegions } from './influencer-region'
// 🏘️ 카페 회원수 — 발굴 API 가 안 주는 값이라 카페 홈에서 1회성으로 채운다(그 파일 헤더 참조).
import { fillCafeMemberCounts } from './influencer-cafe-members'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

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

/**
 * 🔢 **재추출 규칙 버전** — 올리면 다음 회차가 커서를 0 으로 되돌려 전수를 **한 번** 다시 훑는다.
 *
 *   `extractContacts` / `reextractEmail` / `stripVideoTitles` 를 고쳤으면 **같은 커밋에서 +1** 할 것.
 *   안 올리면 옛 규칙으로 이미 훑은 행은 아래 "다 훑은 뒤엔 새 행만"(주차) 때문에 **영원히 재추출되지 않는다** —
 *   에러도 경고도 없이 개선이 라이브에 안 닿는다. 이 레포의 `CLASSIFY_RULES_VERSION` 과 같은 계약이고,
 *   `check-rules-version-bump` 가 지키는 것과 같은 실패 양식이다.
 */
export const REEXTRACT_RULES_VERSION = 3 // rules-version-ok — 2026-08-05 판정을 **더 좁은 가드로 교체**(면제가 아니다): `check-rules-version-bump` 는 감시 파일이 한 글자만 바뀌어도 bump 를 요구해 **계측 한 줄에도 36,880행 재추출이 처음부터 다시 돈다**(진행 중 패스는 버려지고 CPU 만 헛돈다 — 08-04 의 2→3 이 그 무변화 한 바퀴였다). 이제 `src/tests/unit/reextract-rules-fingerprint.test.ts` 가 **정규식 상수 + 추출 함수 본문**만 해싱해 판정한다: 계측은 안 걸리고 규칙은 한 글자만 바뀌어도 걸린다. ⚠️ 그 지문 목록에서 빠진 헬퍼를 추출 경로에 끼우면 아무도 안 잡는다 — 새 헬퍼는 그 파일에 추가할 것

/**
 * 커서 저장 형태 `"<version>:<cursor>"`.
 *
 * ⚠️ 옛 형태(숫자만)는 **version 0** 으로 읽어 0 을 돌려준다 — 배포 직후 딱 한 바퀴 전수를 다시 훑고,
 *   그 다음부터 새 형태로 주차된다. 형태를 못 알아보면 조용히 0 으로 떨어져 매번 전수를 도는(=지금 고치는
 *   바로 그 병) 상태가 되므로, 파싱은 관대하되 **버전 불일치만이 리셋의 유일한 이유**여야 한다.
 */
export function parseReextractCursor(raw: string | null | undefined, version: number): number {
  const s = String(raw ?? '').trim()
  if (!s) return 0
  const i = s.indexOf(':')
  const v = i < 0 ? 0 : parseInt(s.slice(0, i), 10)
  const c = parseInt(i < 0 ? s : s.slice(i + 1), 10)
  if (!Number.isFinite(v) || v !== version) return 0 // 규칙이 바뀌었다 → 전수 한 바퀴
  return Number.isFinite(c) && c > 0 ? c : 0
}

export const formatReextractCursor = (version: number, cursor: number): string =>
  `${version}:${Math.max(0, Math.floor(Number.isFinite(cursor) ? cursor : 0))}`

/**
 * 🔗 기존 풀 소개글 연락처 재추출(백필, 멱등) — 개선된 추출기 재적용(API 재호출 0). 날조/대행사 이메일 소급 정리 포함.
 *
 * ## 🩸 2026-08-02 — 이 패스가 **같은 단계의 뒤 작업을 죽이고 있었다**(라이브 실측)
 * `ads:maintenance?phase=reextract` 가 `err=Error`(ms 13,541)로 죽고 있었고, `ads_maintenance_last` 에
 * `region`·`cafemembers` 키가 **한 번도** 나타난 적이 없었다 — 둘 다 이 함수 *다음*에 서 있어서다.
 *
 * 원인은 마지막 두 줄이었다: 전수를 다 훑으면 커서를 **0 으로 되돌렸다.** 그래서 매 회차가
 * 36,880행을 처음부터 다시 훑었고(라이브 결과 `scanned: 36,880 · filled: 0` — 저장 시점에 이미 추출하므로
 * 재수확이 구조적으로 0), 그 CPU 로 인보케이션이 끝나 **뒤에 선 지역 백필·카페 회원수는 시작조차 못 했다.**
 * `poolScanShouldStop` 은 이 함수 안에서만 멈출 뿐, 이미 쓴 CPU 를 되돌려주지 않는다.
 *
 * ⇒ **다 훑었으면 커서를 그 자리에 주차한다.** 다음 회차는 `id > cursor` 인 **새 행만** 본다(보통 0~수백).
 *   규칙을 고쳤을 때만 `REEXTRACT_RULES_VERSION` 으로 전수를 한 바퀴 되돌린다.
 *
 * ⚠️ 이 변경 뒤 `scanned: 0` 은 **고장이 아니라 정상**(새 행이 없다)이다. 예전처럼 큰 `scanned` 가 보고
 *   싶다면 규칙 버전을 올려야 하고, 그건 규칙을 실제로 바꿨을 때만 정당하다.
 */
export async function reextractPoolContacts(DB: D1Database, opts?: { budget?: OpBudget; rawDB?: D1Database }): Promise<{ scanned: number; filled: number; done: boolean; from?: number; cursor?: number; saved?: boolean }> {
  await ensureInfluencerSchema(DB)
  // 🔗 2026-07-28: OFFSET 전수스캔 → **id 커서**(품질/재분류 패스와 동일 패턴). 무료 플랜 예산에선 한 실행이
  //   전수를 못 도는데, 커서가 없으면 매번 앞부분만 다시 훑고 뒤쪽 백로그는 영원히 재추출되지 않는다.
  const CURSOR_KEY = 'ads_reextract_cursor'
  const PAGE = 2000
  const cRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY)
    .first<{ value: string }>().catch(() => null)
  const from = parseReextractCursor(cRaw?.value, REEXTRACT_RULES_VERSION)
  let cursor = from
  let scanned = 0, filled = 0, done = false
  const startedMs = Date.now()   // ⏱️ 인보케이션당 작업 상한(poolScanShouldStop) — 재분류와 같은 CPU 사고를 공유한다
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
    // ⏱️ 여기까지가 이 인보케이션의 몫 — `done` 을 false 로 남겨 커서가 다음 회차로 이어진다(커버리지 손실 0).
    if (poolScanShouldStop(scanned, startedMs, Date.now())) break
  }
  // 🅿️ 다 훑었어도 **0 으로 되돌리지 않는다** — 그게 매 회차 전수 재스캔의 원인이었다(위 docblock).
  //   다음 회차는 여기서 이어받아 새 행만 본다. 전수 재스캔은 규칙 버전 bump 로만 일어난다.
  // 🩸 **커서 저장은 예산 밖(raw DB)에서 한다** (2026-08-03 라이브 실측). 호출부가 넘기는 `DB` 는
  //   `budgetedDb` 라 예산이 바닥나면 쓰기가 잘리는데, 이 저장은 함수의 **마지막** 동작이라 하필
  //   그때 실행된다. 그리고 `.catch(() => null)` 이 삼켜 조용히 사라진다 —
  //   **일은 하고 진도만 안 남는 것**이 되고, 다음 회차가 같은 페이지를 다시 훑는다.
  //   실측: `reextract {scanned: 2000, filled: 0}` 인데 커서는 13시간째 `13398`(그것도 판 접두사 없는
  //   옛 형식) 그대로였다 — 즉 이 줄이 **라이브에서 한 번도 성공한 적이 없었다.**
  //   같은 파일의 `ads_maintenance_last` 스탬프는 이미 "예산 밖에서, 항상" 규칙을 쓴다. 커서만 빠져 있었다.
  //
  // 🔬 **저장 결과를 관측한다** (2026-08-03). 라이브에서 `scanned: 2000` 인데 커서는 13시간째 그대로였고,
  //   그게 ⓐ 메모리 커서가 애초에 안 움직였는지 ⓑ 움직였는데 저장이 삼켜졌는지 **구분할 방법이 없었다**
  //   (`.catch(() => null)` 이 실패를 지운다). `from`/`cursor`/`saved` 를 남기면 다음 회차가 답을 준다.
  const saveRes = await (opts?.rawDB ?? DB).prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(CURSOR_KEY, formatReextractCursor(REEXTRACT_RULES_VERSION, cursor)).run().catch(() => null)
  return { scanned, filled, done, from, cursor, saved: !!saveRes }
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
    if (r.busy) { out.busy = true; break }
    // 결과 + 실패사유 + 예산상태를 모두 승계 — 버튼 응답에서 "왜 조금만 됐는지"가 보여야 한다.
    if (r[phase] !== undefined) out[phase] = r[phase]
    if (r[`${phase}_error`] !== undefined) out[`${phase}_error`] = r[`${phase}_error`]
    if (r.paused) out.paused = true
    if (r.limit_hit) out.limit_hit = true
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
export type MaintPhase = 'merge' | 'reextract' | 'reclassify' | 'quality' | 'handle' | 'selflink'
// 🩹 'handle' = 손상 네이버 핸들 복구(2026-07-28 신설). 이 단계가 끝나기 전까지 블로거 보강 레인의
//    큐 앞머리는 측정 불가 행으로 막혀 있다 — 정비 순환에서 가장 먼저 값을 내는 단계다.
export const MAINT_PHASES: MaintPhase[] = ['merge', 'reextract', 'reclassify', 'quality', 'handle', 'selflink']
export const isMaintPhase = (v: unknown): v is MaintPhase => MAINT_PHASES.includes(v as MaintPhase)

/**
 * ⏱️ **시간대별 단계 배정표** — 균등 순환(`PHASES[h % 5]`)을 라이브 실측으로 대체(2026-07-29).
 *
 *   왜 균등이 틀렸나: 단계마다 남은 일의 양이 다른데 슬롯은 똑같이 나눠 갖고 있었다.
 *   같은 날 어드민 실측(`ads_maintenance_last`):
 *     - `reextract` — **전수 36,880행을 훑고 `filled: 0`, `done: true`.** 저장 시점에 이미 추출하므로
 *       남은 일이 구조적으로 없다. 그런데도 5시간마다 한 슬롯(정비 용량의 20%)을 통째로 가져갔다.
 *     - `merge` — `merged: 5`(그룹 3). 값은 있지만 소량이고 시급하지 않다.
 *     - `reclassify` — 38,382행을 회차당 3,000행씩. 균등 배정이면 전수 한 바퀴에 13회차 × 5h = **65시간**.
 *       분류 규칙을 고쳐도 라이브에 닿는 데 2.7일이 걸린다는 뜻이다(#867 이 정확히 그 상황이었다).
 *     - `handle` — `fixed: 2,481`(+`reopened: 150`)로 **수율이 가장 높고 아직 `done: false`**.
 *       게다가 이 단계가 밀린 만큼 블로거 보강 레인의 큐 앞머리가 측정 불가 행으로 막힌다(아래 주석 참조)
 *       — 즉 풀의 74%를 차지하는 네이버 블로거 연락처 확보라는 **가장 큰 레버의 관문**이다.
 *   ⇒ **일이 남은 쪽으로 옮긴다.** 10슬롯 중 `reclassify` 3 · `handle` 3(각 기존 2) ←
 *      `reextract` 1 · `merge` 1(각 기존 2). `quality` 2 유지.
 *      전수 스윕: reclassify 65h → **43h**, handle 은 회차가 1.5배.
 *
 *   ⚠️ **줄이는 쪽을 0으로 만들지 않는다.** 지금 `filled: 0` 인 건 "고장"이 아니라 "다 했다"이고,
 *   미추출 행이 새로 생기면 다시 값이 나와야 한다. 10시간에 한 번이면 자기치유가 유지된다.
 *   ⚠️ 이 표에서 빠진 단계는 **영원히 안 돈다** — 침묵이 아니라 부재라 경보에도 안 잡힌다.
 *   그래서 `MAINT_PHASES` 전 단계 포함을 유닛(ads-lane-cadence)이 강제한다.
 *   ⚠️ 배분의 **타당성**은 코드가 못 본다(라이브 수율은 코드 밖 사실이다). 위 수치가 뒤집히면
 *   — 예컨대 `handle` 이 `done: true` 로 끝나면 — 그 슬롯은 다시 남는 일 쪽으로 옮겨야 한다.
 */
/**
 * 🔁 **2026-08-02 재배분 — 위 주석이 예고한 그 상황이 왔다.**
 *
 *   *"위 수치가 뒤집히면 — 예컨대 `handle` 이 `done: true` 로 끝나면 — 그 슬롯은 다시 남는 일 쪽으로
 *   옮겨야 한다."* 라이브 `ads_maintenance_last` 실측:
 *     - `handle` → `{ scanned: 34, fixed: 0, unfixable: 34, done: true }` — **고칠 게 남지 않았다.**
 *       3슬롯(하루 6회)이 매번 같은 34행을 확인하고 0을 고치고 있었다.
 *     - `reextract` 는 이제 **지역 백필(미판정 36,269 = 89%) + 카페 회원수(3,142행 전부 0)** 를 이고 있다.
 *       배정표를 짤 때의 근거("할 일이 구조적으로 없다")가 **더는 사실이 아니다.**
 *   ⇒ `handle` 3 → 1 · `reextract` 1 → 3.
 *
 *   🕘 **슬롯 자리가 결과를 바꾼다** — 인덱스 7 은 hour 19(야간 재보정에 양보)에 걸려 하루 **1회**만 돈다.
 *     그래서 1슬롯 단계(`merge`·`selflink`·`handle`)를 거기 두면 간격이 24h 로 벌어져 경보 창을 깬다.
 *     `handle` 은 인덱스 4(hour 4·16)에 두고, 양보로 한 번 깎여도 되는 `reextract`(3슬롯)가 7을 받는다.
 *     결과: reextract 는 hour 1·7·10·13·22 — 최대 간격 9h.
 */
export const MAINT_SCHEDULE: MaintPhase[] = [
  'merge', 'reextract', 'reclassify', 'quality', 'handle',
  // 🧹 자기링크 정리(2026-07-29 대표 승인) — 백로그가 작고(후보 ~1,029행) 끝나면 **스스로 싸진다**:
  //   비워진 행은 `links LIKE '%naver.com%'` 후보에서 빠져 다음 바퀴엔 즉시 done 이다.
  //   그래서 상시 슬롯으로 두어 **유입 필터가 놓친 새 오염의 자가치유**까지 겸하게 한다.
  'selflink',
  'reclassify', 'reextract', 'quality', 'reclassify', 'reextract',
  // 🔢 10 → 12 슬롯. 단순히 selflink 를 덧붙이면(11슬롯) **실제 최대 간격이 10h → 13h 로 벌어진다**
  //   (24 를 11 로 나눌 때의 자정 불연속 — 유닛이 이걸 잡아냈다). 12 는 24 의 약수라 각 슬롯이 하루
  //   **정확히 2회** 고정 시각에 돌고 최대 간격이 12h 로 떨어진다. 남는 한 자리는 전수 한 바퀴가 가장 느린
  //   `reclassify`(65시간)에 준다 — 경보 창을 지키면서 커버리지가 가장 급한 쪽을 채운다.
  'reclassify',
]

/**
 * 📏 **슬롯 배분 의도** — 배정표의 개수를 근거와 함께 한 번 더 적는다(중복이 아니라 *계약*이다).
 *
 *   유닛이 이 표와 `MAINT_SCHEDULE` 의 일치를 강제하므로, 배정표를 손대면 **근거 한 줄을 같이** 고치게 된다.
 *
 *   ## 왜 이 형태인가 — 유닛이 옳은 변경을 막은 적이 있다
 *   이전 판은 유닛 안에 `busy = ['reclassify','handle']` / `idle = ['reextract','merge']` 처럼
 *   **2026-07-29 그날의 라이브 사실을 박아** 뒀다. 그 사실이 뒤집히자(`handle` → `done:true·unfixable 34`,
 *   `reextract` 는 지역·카페 백로그를 떠안음) 유닛이 *정당한 재배분*에 빨간불을 냈다.
 *   근거를 코드 옆에 두면 배정표와 **같이 늙는다** — 테스트가 사실을 소유하지 않는다.
 *
 *   ⚠️ 여전히 코드가 못 보는 것: 이 `why` 가 **지금도 참인지**. 라이브 수율은 코드 밖 사실이라,
 *     `ads_maintenance_last` 를 보고 뒤집혔으면 이 표부터 고칠 것.
 */
export const MAINT_SLOT_INTENT: Record<MaintPhase, { slots: number; why: string }> = {
  reclassify: { slots: 4, why: '전수 한 바퀴 65h — 커버리지가 가장 느리다' },
  reextract: { slots: 3, why: '지역 미판정 36,269(89%) + 카페 회원수 3,142행 전부 0 — 이 단계가 이고 있다' },
  quality: { slots: 2, why: 'scanned 4,500 · done:false — 진행 중' },
  handle: { slots: 1, why: 'done:true · unfixable 34 — 고칠 게 없다(새 손상 유입 감시용 최소 슬롯)' },
  merge: { slots: 1, why: 'merged 5(그룹 5) — 소량이고 시급하지 않다' },
  selflink: { slots: 1, why: '끝나면 스스로 싸진다 — 비운 행은 다음 바퀴 후보에서 빠진다' },
}

/** 단계 실행 lease TTL — 단계 하나는 짧다(예산 상한이 있으므로). 전체 파이프라인 TTL 과 별개. */
const PHASE_LEASE_TTL_MS = 3 * 60_000
/** 리스 해제·스탬프·커서 기록용으로 남겨두는 연산(예산에서 제외) — 이게 없으면 "기록조차 못 하는" 원래 병이 재발. */
const RESERVE_OPS = 6
/**
 * 🏘️ 회차당 카페 회원수 시도 상한 — 이 일은 **상한이 있어서** 예산을 다 먹지 않는다.
 *   그래서 `reextract` 단계에서 **맨 앞**에 둔다(순서로 굶주림을 막는다 — 예약 계산은 한 번 실패했다).
 *   3,142개 전수라 회차당 20이면 ~160회차. 지역 백필이 끝나면 이 값을 올릴 여지가 생긴다.
 */
const CAFE_MAX = 20

/**
 * 📍 **지역 백필 스윕** — `region` 이 비어 있는 행을 `source_keyword` 에서 채운다(외부 호출 0, D1 전용).
 *
 *   ## 왜 여기(정비)로 옮겼나 — 라이브 실측 2026-07-29
 *   | 지역 판정 | 인원 | 비중 |
 *   |---|---|---|
 *   | 값 있음 | **282** | **0.7%** |
 *   | 지역 없는 키워드로 확정(`''`) | 1,808 | 4.6% |
 *   | **미판정(NULL)** | **37,075** | **94.7%** |
 *
 *   `강남 맛집` 한 키워드로만 741명을 모았는데 어드민에서 `region=강남` 을 고르면 **0명**이 나온다.
 *   유어딜 동네딜은 지역×업종 매칭이 본질이라, 그 축이 사실상 없는 상태였다.
 *
 *   ❗ **처음엔 "예산 고갈로 백필이 굶는다"고 읽었는데 틀렸다.** 채워진 2,090건(=filled+none)이
 *   정확히 5회차 × 400 이라, 백필은 **정상 동작 중이고 단지 느렸다**(회차당 400행 → 37,075건에 약 3.9일).
 *   ⇒ 고칠 것은 "고장"이 아니라 **자리와 크기**다.
 *
 *   자리: 그전엔 수집 인보케이션의 **꼬리**에 있었다. 그 지점은 발굴이 예산을 다 쓴 뒤라 크게 못 늘린다.
 *   반면 `reextract` 단계는 전수 36,880행을 훑고 `filled: 0` — **할 일이 없는데 자기 인보케이션
 *   (fresh 예산)을 통째로 갖고 있었다.** 둘을 맞바꾼다.
 *   크기: 한 청크(500행)가 [SELECT 1 + batch 5] ≈ 6 ops 라, 남은 예산이 허락하는 만큼 반복한다.
 *
 *   ⚠️ 커서가 없어도 된다 — 처리된 행은 값이 `NULL` 이 아니게 되므로 다음 청크가 자연히 다음 구간을 잡는다.
 *   ⚠️ **한 곳에서만 돈다** — 수집 꼬리의 호출은 같은 커밋에서 제거했다(두 벌로 두면 조용히 갈라진다).
 *   ⚠️ 정비를 끄면(`ADS_AUTO_MAINTENANCE_ENABLED='false'`) 지역 백필도 함께 멈춘다.
 */
export async function sweepRegions(DB: D1Database, budget: OpBudget, reserve = 0): Promise<{ filled: number; chunks: number; done: boolean }> {
  // 규칙 버전이 올랐을 때만 1회 — 그 외엔 조회 1번으로 즉시 반환(멱등).
  try { await recheckBlankRegions(DB, POOL) } catch { /* 다음 회차가 재시도 */ }
  let filled = 0, chunks = 0, done = false
  // 🅰️ `reserve` — **뒤에 선 작업 몫을 남긴다.** 이 스윕은 `budget.left` 가 바닥날 때까지 도는데,
  //   같은 단계의 뒤 작업(카페 회원수·재추출)이 그 뒤에 있으므로 예약 없이는 **영구히 굶는다**
  //   (그게 2026-08-02 에 고친 병의 절반이다 — 나머지 절반은 재추출의 전수 재스캔이었다).
  //   ⚠️ 다 끝나면(`done`) 예약분은 자동으로 뒤 작업에 넘어간다 — 호출부가 `budget.left` 로 크기를 정한다.
  const floor = Math.max(6, 6 + Math.max(0, Math.floor(reserve)))
  // 청크당 ~6 ops. 예산이 그만큼도 안 남았으면 다음 회차에 넘긴다(무리해서 시작하지 않는다).
  while (!budget.exhausted && budget.left >= floor) {
    let n = 0
    try { n = await backfillRegions(DB, POOL, 500) } catch { break } // 한도 예외 — 다음 회차가 이어받음
    chunks++
    filled += n
    if (n === 0) { done = true; break }  // 미판정 행이 더 없다 = 전수 완료
  }
  return { filled, chunks, done }
}

/**
 * 🌙 정비 1단계 실행 — 예산 안에서 진행하고, **성공/중단/한도 여부를 반드시 기록**한다.
 *   반환·기록 형태는 기존 `ads_maintenance_last`(어드민 패널)와 호환(단계 키를 병합 갱신).
 */
export async function runMaintenancePhase(env: Env, phase: MaintPhase): Promise<Record<string, unknown>> {
  const DB = adsLeadsDb(env)
  const at = new Date().toISOString()
  if (!await acquireLease(DB, MAINTAIN_LEASE_KEY, PHASE_LEASE_TTL_MS)) return { at, kind: 'maintenance', phase, busy: true }

  const envBudget = Math.max(10, Math.min(900, envLaneBudget(env.ADS_MAINT_OPS_BUDGET, 60, env)))
  // 🧠 학습 상한 + CPU 배수를 한 문장으로(조회 수 동일) — 실제로 CPU 한도로 죽은 기록이 있는 레인이라(2026-08-02 `phase=quality`) **하트비트 이름 그대로 phase 별로** 배우고, 작업량(=D1 연산 수)에 그 배수를 건다.
  const s = await readLaneSettings(DB, [subreqCapKey('maintenance')], `ads:maintenance?phase=${phase}`)
  const learnedCap = Math.max(0, parseInt(s.get(subreqCapKey('maintenance')) || '', 10) || 0)
  const pcap = envSubreqCap(env) // 🧱 플랫폼 천장 — 학습 상한도 이 위로 못 간다(기본 60, 근거·조정법은 collect-budget 주석).
  const total = applyQuantum(resolveSubreqBudget(envBudget, learnedCap, pcap), s.q, 10)
  const budget = newOpBudget(Math.max(6, total - RESERVE_OPS))
  const bdb = budgetedDb(DB, budget)

  const out: Record<string, unknown> = { at, kind: 'maintenance', phase }
  try {
    if (phase === 'merge') out.merge = await mergeDuplicatePool(bdb, { groupCap: 150 })
    else if (phase === 'reextract') {
      // 🔻 **순서가 곧 우선순위다.** 이 단계는 세 작업을 한 인보케이션에서 이어 돌리는데, 앞의 것이
      //   예산/CPU 를 다 쓰면 뒤의 것은 *시작조차 못 한다*(실측: `region`·`cafemembers` 키가 한 번도
      //   `ads_maintenance_last` 에 없었다 — 재추출이 매번 전수를 훑다 죽어서다).
      //   ⇒ **남은 백로그가 큰 것부터** 앞에 둔다. 재추출은 커서 주차 후 새 행만 보므로(위 docblock)
      //     보통 즉시 끝나지만, 규칙 버전을 올린 회차엔 전수를 도므로 **뒤에 두는 편이 안전하다.**
      // 🏘️ 카페 회원수(2026-07-29 대표 "카운팅이 안 됨") — **작고 상한이 있는 일을 먼저** 돌린다.
      //   ⚠️ 첫 판은 지역을 앞에 두고 `CAFE_RESERVE` 로 카페 몫을 예약했다. **안 먹었다** — 라이브 첫 회차가
      //     `selected 20 · tried 3` 이었다(예산이 3건 만에 바닥). 예약은 "앞 작업이 얼마를 쓰는지"를
      //     정확히 알아야 성립하는데 지역 청크의 실제 ops 는 고정이 아니다.
      //   ⇒ **순서로 보장한다.** 카페는 상한(CAFE_MAX)이 있어 예산을 다 먹을 수 없고, 지역은 남은 걸
      //     전부 쓰는 성질이라 뒤에 두는 편이 안전하다. 예약(계산)보다 순서(구조)가 덜 틀린다.
      //   ⚠️ **배정표에 13번째 슬롯을 만들지 않는다** — 12는 24의 약수라 각 단계가 매일 같은 시각에
      //   정확히 2번 돈다. 13이면 그 성질이 깨져 경보 창(12h)까지 흔들린다(유닛이 그 값을 고정한다).
      //   ⚠️ 여기만 외부 fetch 를 쓴다 — 전수 1회성이라(3,142개) 다 채우면 조회 1번으로 끝난다.
      out.cafemembers = await fillCafeMemberCounts(bdb, POOL, budget, CAFE_MAX)
      //   💱 지역은 ops 당 산출이 83배다(청크 500행당 ~6 ops · D1 전용 vs 카페 1건당 fetch 1).
      //     그래서 **남은 예산을 전부** 가져간다 — 뒤의 재추출은 커서 주차 후 보통 즉시 끝난다.
      out.region = await sweepRegions(bdb, budget, 0) // 지역 미판정 32,761행 — D1 전용, 외부 호출 0
      out.reextract = await reextractPoolContacts(bdb, { budget, rawDB: DB })
    }

    else if (phase === 'reclassify') { out.reclassify = await runReclassifyPool(bdb, { budget }); out.kwyield = await recomputeKeywordContactYieldBucketed(DB).catch(() => null) } // 🎯 목적함수 재계산 — 근거·원본DB(예산 밖)인 이유는 `influencer-keyword-yield.ts` 헤더. 📉 2026-09-02 6h 버킷(92회/일 → 4회/일 — 하루 1,410만 행)
    else if (phase === 'handle') out.handle = await healNaverHandles(bdb, { budget })
    else if (phase === 'selflink') out.selflink = await cleanSelfLinkNoise(bdb, { budget })
    // ⏱️ 마감선도 요금제를 따른다 — 유료는 CPU 한도가 다른 세계라 같은 값이면 늘어난 한도가 그냥 남는다.
    else out.quality = await runQualityPass(bdb, { budget, deadlineMs: envPlanValue(undefined, QUALITY_DEADLINE_MS_FREE, 12_000, env) })
  } catch (e) {
    out[`${phase}_error`] = (e as Error)?.message || 'fail'
  } finally {
    out.ops = budget.used
    out.cap = total
    out.paused = !!budget.exhausted   // 예산 소진으로 중단 — 다음 회차가 커서로 이어받는다(정상 동작)
    out.limit_hit = !!budget.limitHit // 플랫폼 한도 예외 관측 — 학습 상한을 내린다
    // 📉 학습 상한 갱신 — 수집 레인과 **같은 SSOT·같은 키**(한도는 워커 단위라 레인별로 다르지 않다).
    const nextCap = nextSubreqCap(budget.used, !!budget.limitHit, learnedCap, envBudget, pcap)
    if (nextCap != null) {
      await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
        .bind(subreqCapKey('maintenance'), String(nextCap)).run().catch(() => null)
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

/**
 * 🔁 **다음 단계를 커서로 골라 한 번 돈다** — 알람 레인(호출부 없는 독립 인보케이션)용 진입점.
 *
 *   cron 경로는 `MAINT_SCHEDULE[hourUTC % 12]` 로 단계를 고른다. 알람은 **한 시간에 12번** 깨어나므로
 *   그 방식을 그대로 쓰면 12회차가 전부 같은 단계를 돌아 아무 의미가 없다 ⇒ 회전축을 커서로 옮긴다.
 *   배정표(`MAINT_SCHEDULE`)와 슬롯 가중치는 **그대로 재사용**한다 — 순서대로 한 바퀴 돌면 슬롯 비율이
 *   그대로 빈도가 되므로 계약이 동일하다.
 *
 *   🅿️ **커서는 실행 전에 전진시킨다.** 단계가 죽어도 다음 회차는 다음 자리로 간다 — 안 그러면 무거운
 *     단계 하나가 죽을 때마다 같은 자리를 무한 재시도하며 뒤를 영원히 굶긴다(라이브에서 이미 겪은 형태).
 *   ⚠️ 리스는 `runMaintenancePhase` 가 잡는다 — 야간 재보정과 겹치면 `busy: true` 로 조용히 비켜난다.
 */
export async function runNextMaintenancePhase(env: Env): Promise<Record<string, unknown>> {
  const DB = adsLeadsDb(env)
  const raw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
    .bind(MAINT_PHASE_CURSOR_KEY).first<{ value: string }>().catch(() => null)
  const cursor = parsePhaseCursor(raw?.value, MAINT_SCHEDULE_VERSION)
  const { index, nextCursor } = nextPhaseSlot(cursor, MAINT_SCHEDULE.length)
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(MAINT_PHASE_CURSOR_KEY, formatPhaseCursor(MAINT_SCHEDULE_VERSION, nextCursor)).run().catch(() => null)
  const phase = MAINT_SCHEDULE[index]!
  return { slot: index, ...(await runMaintenancePhase(env, phase)) }
}

/** 🌙 야간 라이브 재보정(별도 시간대 KST 04시 — fetch-heavy 라 자체 인보케이션 예산 사용):
 *   🧭 카테고리 전체 재보정(커서 이어받기) + 🔄 라이브 재조회 2패스(0회·무메일·미분류 우선)
 *   + 📝 블로거 스윕(활동성·이웃수·프로필 연락처 — 시간당 20 개로는 백로그가 느려 밤에 60 개 추가). */
export async function runNightlyRescan(env: Env): Promise<Record<string, unknown>> {
  const DB = adsLeadsDb(env)
  // 🔒 정비와 같은 lease — 이쪽은 **YouTube 쿼터를 쓰기 때문에** 중복 실행이 곧 하루 예산 낭비(수집 몫 잠식).
  if (!await acquireLease(DB, MAINTAIN_LEASE_KEY, MAINTAIN_LEASE_TTL_MS)) {
    // 🔇 진 쪽도 흔적을 남긴다 — 없으면 '경합에 졌다'와 '한 번도 안 돌았다'가 구분되지 않는다.
    //   근거(2026-07-27 이틀 막힌 오진)는 `rescan-rotation.ts` 헤더에 옮겨 뒀다.
    const busy = { at: new Date().toISOString(), kind: 'rescan', busy: true }
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_maintenance_rescan_last', JSON.stringify(busy)).run().catch(() => null)
    return busy
  }
  const out: Record<string, unknown> = { at: new Date().toISOString(), kind: 'rescan' }
  try {
    // ⏱️ 회차 마감선 + 선두 회전 — 근거와 순수함수는 `rescan-rotation.ts`(그 파일 헤더 참조).
    //   마감선만 넣으면 마지막(naver)이 하루 1회 레인이라 **영구 미실행**이 된다.
    const startedAt = Date.now()
    const runDeadlineMs = envPlanValue(undefined, RESCAN_DEADLINE_MS, RESCAN_DEADLINE_MS_PAID, env)
    const jobs: Array<{ name: string; run: () => Promise<unknown> }> = [
      { name: 'rescan', run: () => runCategoryRescan(env) },
      // passes 4 = 80채널/밤 — 기존 측정행의 롱폼 중앙값 소급 가속(YT units ~100/밤 — 일일 쿼터 10k 대비 미미).
      { name: 'refetch', run: () => runYtLiveRefetch(env, 4) },
      { name: 'naver', run: () => enrichNaverActivity(DB, { left: 150 }, 60) },
    ]
    const ordRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(RESCAN_ORDER_KEY)
      .first<{ value: string }>().catch(() => null)
    const from = normalizeOrder(ordRaw?.value, jobs.length)
    out.first_job = jobs[from].name

    let ran = 0
    for (const idx of rotatedOrder(from, jobs.length)) {
      if (Date.now() - startedAt > runDeadlineMs) { out.stopped_by = 'deadline'; break }
      const j = jobs[idx]
      ran++
      try { out[j.name] = await j.run() } catch (e) { out[`${j.name}_error`] = (e as Error)?.message || 'fail' }
    }
    // 다음 회차는 이번에 **못 돌린 작업**부터 — 잘려도 3회 안에 셋 다 선두를 받는다.
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(RESCAN_ORDER_KEY, String(nextOrder(from, ran, jobs.length))).run().catch(() => null)

    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_maintenance_rescan_last', JSON.stringify(out).slice(0, 1000)).run().catch(() => null)
  } finally { await releaseLease(DB, MAINTAIN_LEASE_KEY) }
  return out
}

/**
 * 🧹 **자기링크 정리 패스** — 노이즈가 진짜 연락처의 자리를 막고 있던 것을 되돌린다 (2026-07-29, 대표 승인).
 *
 *   판정은 `influencer-self-link.ts`(SSOT) — 발굴·측정·재조우 스킵이 쓰는 것과 **같은 규칙**이다.
 *   유입은 이미 막았지만 **기존 행은 그대로 남아 있어**, 그 행들은 백필이 구조적으로 불가능하다
 *   (`COALESCE(links, ?)` 는 빈 칸만 채우는데 links 가 자기링크로 차 있다).
 *
 *   되돌릴 수 있는 변경이다: 비운 자리는 다음 측정이 다시 채우고, 그때는 걸러진 값만 들어간다.
 *   ⚠️ 네이버 블로거만 — 유튜버에게 블로그 링크는 크로스플랫폼 발자국이라 값지다.
 *   커서·배치·멱등은 형제 패스(`reextractPoolContacts`)와 동일. 예산 소진 시 다음 회차가 이어받는다.
 */
export async function cleanSelfLinkNoise(DB: D1Database, opts?: { budget?: OpBudget }): Promise<{ scanned: number; cleared: number; stripped: number; done: boolean }> {
  const CURSOR_KEY = 'ads_selflink_cursor', PAGE = 500
  let cursor = 0
  const cRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  if (cRaw?.value) cursor = Math.max(0, parseInt(cRaw.value, 10) || 0)
  let scanned = 0, cleared = 0, stripped = 0, done = false
  for (;;) {
    // `SELF_BLOG_LIKE` 로 **넓게** 후보를 뽑고(정규식을 SQL 에서 못 쓴다) 정밀 판정은 순수함수가 한다. 📉 2026-09-02: `links IS NOT NULL` 을 명시해야 부분 인덱스 `idx_ad_inf_leads_selflink` 가 쓰인다(LIKE 는 유도 안 됨).
    const rows = (await DB.prepare(`SELECT id, links FROM ad_influencer_leads
        WHERE account_id = ? AND platform = 'naver_blog' AND id > ? AND links IS NOT NULL AND links LIKE ? ORDER BY id ASC LIMIT ?`)
      .bind(POOL, cursor, SELF_BLOG_LIKE, PAGE)
      .all<{ id: number; links: string | null }>().catch(() => null))?.results || []
    if (!rows.length) { if (!opts?.budget?.exhausted) done = true; break }
    for (const r of rows) cursor = Math.max(cursor, r.id)
    scanned += rows.length
    const ups: ReturnType<typeof DB.prepare>[] = []
    for (const r of rows) {
      const next = cleanSelfLinks(r.links)
      if (next === undefined) continue // 손댈 것 없음
      if (next === null) cleared++; else stripped++
      ups.push(DB.prepare('UPDATE ad_influencer_leads SET links = ? WHERE id = ?').bind(next, r.id))
    }
    if (ups.length) await DB.batch(ups).catch(() => null)
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(CURSOR_KEY, String(cursor)).run().catch(() => null)
    if (opts?.budget?.exhausted) break
    if (rows.length < PAGE) { done = true; break } // 📉 2026-09-02: 꼬리(PAGE 미만)면 여기서 끝 — 빈 페이지를 한 번 더 물어보지 않는다.
  }
  // 한 바퀴 끝나면 커서를 되감는다 — 새로 들어온 행(유입 필터가 놓친 것)도 다음 바퀴에 잡히게.
  if (done) await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(CURSOR_KEY, '0').run().catch(() => null)
  return { scanned, cleared, stripped, done }
}
