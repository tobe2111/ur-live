/**
 * 🎯 유어애즈 — 인플루언서 자동 수집 엔진 (Phase E, 2026-07-20, "무료 프리미엄")
 *   ur-ads 워커 cron(또는 어드민 수동 트리거)에서 호출. 무료 공식 API(YouTube Data v3 · 네이버 검색
 *   오픈API)로 키워드를 순환 발굴 → **공용 풀(ad_influencer_leads.account_id=0)** 에 누적 저장.
 *
 *   무료 프리미엄 3종:
 *     ① 동적 키워드 테이블(ad_discovery_keywords) — 어드민이 추가/비활성 가능 + cron 순환.
 *     ② 출처 카테고리 저장 — 어느 키워드/카테고리로 찾았는지 lead 에 태그(어드민 필터).
 *     ③ 해시태그 자동확장 — 수집된 채널 소개글의 #태그를 후보로 적립, 반복 등장 시 자동 활성화(자가성장).
 *
 *   ⚠️ [LEGAL/PIPA] 공식 API 가 반환하는 **공개** 채널 메타 + 공개 소개글 연락처만 저장(수기 발굴과 동일).
 *   실제 마케팅 발송은 정보통신망법상 사전동의 별도 — 이 엔진 범위 아님(수집 ≠ 발송).
 *
 *   설계: docs/design/urads-worker-split.md §4 Phase E. 게이트: env `ADS_AUTO_COLLECT_ENABLED==='true'`.
 */
import type { Env } from '@/worker/types/env'
import { discoverYouTubeInfluencers, discoverNaverBloggers, ensureInfluencerSchema, type InfluencerLead } from './influencer-discovery'

/** 공용 풀 계정 id — 실제 ad_accounts.id 는 1부터라 0 은 시스템 풀 전용 센티넬(충돌 없음). */
export const POOL_ACCOUNT_ID = 0

/** 자동확장 활성 키워드 상한(런어웨이 방지) + 후보 자동승격 임계(반복 등장 횟수). */
const MAX_ACTIVE_KEYWORDS = 200
const AUTO_PROMOTE_HITS = 3

/**
 * ⭐ 우선 카테고리 (대표 지시 2026-07-20 "맛집·숙소·네일·뷰티가 가장 중요") — 매 실행 배치의
 * 절반을 항상 이 카테고리 키워드에 배정(별도 커서로 순환), 나머지 절반이 전체 일반 순환.
 */
export const PRIORITY_CATEGORIES = ['맛집', '푸드', '숙소', '네일', '뷰티']

/** 카테고리별 시드 키워드(한국). 탐색 *범위*라 구조 문서 갱신 대상 아님(자유 확장). */
const SEED: { category: string; keywords: string[] }[] = [
  // ⭐ 우선 분야 (대폭 보강)
  { category: '뷰티', keywords: ['뷰티 유튜버', '메이크업 튜토리얼', '스킨케어 리뷰', '코스메틱 추천', '헤어 스타일링', '피부관리 루틴', '뷰티 하울', '왁싱 후기'] },
  { category: '네일', keywords: ['네일아트', '셀프네일', '젤네일 디자인', '네일샵 추천', '네일 튜토리얼'] },
  { category: '맛집', keywords: ['맛집 추천', '서울 맛집', '부산 맛집', '맛집 리뷰', '동네 맛집', '카페 추천', '맛집 투어', '데이트 맛집'] },
  { category: '푸드', keywords: ['맛집 브이로그', '먹방', '홈카페', '베이킹 레시피', '자취요리'] },
  { category: '숙소', keywords: ['숙소 추천', '펜션 추천', '풀빌라 후기', '호텔 리뷰', '감성숙소', '글램핑 후기', '한옥스테이'] },
  // 일반 분야
  { category: '패션', keywords: ['패션 하울', '데일리룩', '코디 추천', '빈티지 패션'] },
  { category: '여행', keywords: ['국내여행 브이로그', '호캉스 후기', '캠핑 브이로그', '해외여행 팁'] },
  { category: '육아', keywords: ['육아 브이로그', '아기용품 리뷰', '엄마표 놀이'] },
  { category: '운동', keywords: ['홈트레이닝', '헬스 브이로그', '다이어트 기록', '요가 스트레칭'] },
  { category: '반려동물', keywords: ['강아지 브이로그', '고양이 채널', '반려동물 용품'] },
  { category: '리빙', keywords: ['자취 인테리어', '살림 꿀팁', '홈스타일링'] },
  { category: 'IT/재테크', keywords: ['IT 리뷰', '가전 리뷰', '앱 추천', '재테크 브이로그', '주식 초보'] },
  { category: '취미', keywords: ['캘리그라피', '그림 그리기', '독서 추천', '차박 브이로그'] },
]

export interface DiscoveryKeyword { id: number; keyword: string; category: string | null; active: number; hits: number; source: string; created_at: string }
interface AutoCollectStats {
  last_run: string; last_saved: number; last_keywords: string[]
  total_runs: number; total_saved: number; cursor: number
  promoted?: string[]; youtube_quota_hit?: boolean
  /** 🔎 진단(2026-07-20 "신규 0건" 사후) — 0건의 원인을 밖에서 알 수 있게 플랫폼별 결과를 기록.
   *  configured=키 존재 여부(ur-ads env), found=발굴 합계, saved=신규 저장, error=첫 실패 사유. */
  diag?: {
    yt: { configured: boolean; found: number; saved: number; error?: string }
    naver: { configured: boolean; found: number; saved: number; error?: string }
  }
}

const CURSOR_KEY = 'ads_autocollect_cursor'
const STATS_KEY = 'ads_autocollect_stats'

/**
 * 🚀 일괄 저장(DB.batch) — 행단위 INSERT 수백 subrequest 가 Free 한도를 깨던 것(2026-07-20 실사고)을
 *   청크당 1 batch 호출로 축소. 의미는 saveInfluencerLeads 와 동일(INSERT OR IGNORE 멱등, changes 합산).
 */
async function saveLeadsBatch(
  DB: D1Database, accountId: number, leads: InfluencerLead[],
  meta: { category?: string | null; sourceKeyword?: string | null },
): Promise<number> {
  if (!leads.length) return 0
  const sql = `INSERT OR IGNORE INTO ad_influencer_leads
    (account_id, platform, channel_id, handle, name, url, subscriber_count, view_count, video_count, country, thumbnail, email, instagram, tiktok, links, description, category, source_keyword)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  let saved = 0
  const CHUNK = 25
  for (let i = 0; i < leads.length; i += CHUNK) {
    const stmts = leads.slice(i, i + CHUNK).map(l => DB.prepare(sql).bind(
      accountId, l.platform, l.channel_id, l.handle, l.name.slice(0, 120), l.url,
      l.subscriber_count, l.view_count, l.video_count, l.country, l.thumbnail,
      l.email, l.instagram, l.tiktok, l.links, l.description.slice(0, 500),
      meta.category ?? null, meta.sourceKeyword ?? null,
    ))
    const rs = await DB.batch(stmts).catch(() => null)
    if (rs) for (const r of rs) if (r?.meta?.changes === 1) saved++
  }
  return saved
}

async function readSetting(DB: D1Database, key: string): Promise<string | null> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(key).first<{ value: string }>().catch(() => null)
  const v = row?.value
  return v === undefined || v === null || v === '' ? null : String(v)
}
async function writeSetting(DB: D1Database, key: string, value: string): Promise<void> {
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(key, value).run().catch(() => null)
}

/** 키워드 테이블 보장 + 시드(최초 1회, 멱등 INSERT OR IGNORE). */
export async function ensureDiscoveryKeywords(DB: D1Database): Promise<void> {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_discovery_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE,
    category TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    hits INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'seed',
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  // 시드 ~40개 — 개별 INSERT(40 subrequest) 대신 1 batch (Free 한도 절약).
  const stmts = SEED.flatMap(g => g.keywords.map(kw =>
    DB.prepare('INSERT OR IGNORE INTO ad_discovery_keywords (keyword, category, active, source) VALUES (?, ?, 1, ?)')
      .bind(kw, g.category, 'seed')))
  await DB.batch(stmts).catch(() => null)
}

export async function listDiscoveryKeywords(DB: D1Database): Promise<DiscoveryKeyword[]> {
  await ensureDiscoveryKeywords(DB)
  const r = await DB.prepare('SELECT id, keyword, category, active, hits, source, created_at FROM ad_discovery_keywords ORDER BY active DESC, hits DESC, id ASC LIMIT 1000')
    .all<DiscoveryKeyword>().catch(() => null)
  return r?.results || []
}

export async function addDiscoveryKeyword(DB: D1Database, keyword: string, category?: string): Promise<{ ok: boolean; error?: string }> {
  const kw = (keyword || '').trim()
  if (kw.length < 2 || kw.length > 40) return { ok: false, error: 'INVALID' }
  await ensureDiscoveryKeywords(DB)
  await DB.prepare('INSERT OR IGNORE INTO ad_discovery_keywords (keyword, category, active, source) VALUES (?, ?, 1, ?)')
    .bind(kw, (category || '수동').slice(0, 40), 'manual').run().catch(() => null)
  return { ok: true }
}

export async function setKeywordActive(DB: D1Database, id: number, active: boolean): Promise<{ ok: boolean }> {
  await DB.prepare('UPDATE ad_discovery_keywords SET active = ? WHERE id = ?').bind(active ? 1 : 0, id).run().catch(() => null)
  return { ok: true }
}

export async function getAutoCollectStats(DB: D1Database): Promise<AutoCollectStats | null> {
  const raw = await readSetting(DB, STATS_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as AutoCollectStats } catch { return null }
}

// 공개 소개글에서 해시태그 후보 추출(자가성장 신호 — 명시적 토픽 마커라 품질 양호).
const HASHTAG_RE = /#([\p{L}\p{N}_]{2,20})/gu
function mineHashtags(text: string): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  HASHTAG_RE.lastIndex = 0
  while ((m = HASHTAG_RE.exec(text)) !== null) {
    const t = m[1]
    if (/^\d+$/.test(t)) continue // 순수 숫자 제외
    out.push(t)
  }
  return out
}

/**
 * 한 번의 자동 수집 실행(cron 1틱 또는 수동). 게이트 체크는 호출부에서.
 *   활성 키워드를 커서로 batch 개 순환 → YouTube+네이버 발굴 → 공용 풀 저장(카테고리 태그).
 *   수집물의 #해시태그를 후보 적립 → 반복 등장 시 자동 활성화(자가성장). 전부 fail-soft.
 */
export async function runInfluencerAutoCollect(env: Env): Promise<AutoCollectStats> {
  const DB = env.DB
  await ensureInfluencerSchema(DB) // 리드 테이블/컬럼 보장(신규 DB 안전 — saveLeadsBatch 는 ensure 안 함)
  await ensureDiscoveryKeywords(DB)
  const active = await DB.prepare('SELECT id, keyword, category FROM ad_discovery_keywords WHERE active = 1 ORDER BY id ASC')
    .all<{ id: number; keyword: string; category: string | null }>().catch(() => null)
  const kws = active?.results || []
  const prev = await getAutoCollectStats(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  if (!kws.length) {
    const empty: AutoCollectStats = { last_run: stamp, last_saved: 0, last_keywords: [], total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, cursor: 0 }
    await writeSetting(DB, STATS_KEY, JSON.stringify(empty))
    return empty
  }

  // ⚠️ 2026-07-20 실사고: batch=12 × 행단위 INSERT 수백 건이 Workers Free 호출당 한도 초과 →
  //   241건 저장 후 중도 사망(통계 미기록, "수집 실패" 표시). 기본 4 로 축소 + 저장은 DB.batch(아래).
  //   커서 순환이라 커버리지는 며칠에 걸쳐 동일 — 1회 부하만 낮춤(매시간 cron 이라 총량은 큼).
  const batch = Math.min(kws.length, Math.max(1, parseInt(env.ADS_AUTOCOLLECT_BATCH || '', 10) || 4))

  // ⭐ 우선 카테고리 절반 배정 — 배치의 ceil(1/2)은 우선 풀(맛집·푸드·숙소·네일·뷰티, 별도 커서),
  //   나머지는 일반 풀 순환. 한쪽 풀이 모자라면 다른 쪽이 잔여 슬롯을 채움(총 batch 개 유지).
  const priPool = kws.filter(k => k.category && PRIORITY_CATEGORIES.includes(k.category))
  const genPool = kws.filter(k => !(k.category && PRIORITY_CATEGORIES.includes(k.category)))
  let priCursor = parseInt((await readSetting(DB, 'ads_autocollect_cursor_pri')) || '0', 10)
  if (!Number.isFinite(priCursor) || priCursor < 0) priCursor = 0
  let cursor = parseInt((await readSetting(DB, CURSOR_KEY)) || '0', 10)
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0
  const basePri = priPool.length ? Math.min(priPool.length, Math.ceil(batch / 2)) : 0
  const nGen = Math.min(genPool.length, batch - basePri)
  const nPri = Math.min(priPool.length, batch - nGen) // 일반 풀이 모자라면 우선 풀이 추가로 채움
  const picks: { id: number; keyword: string; category: string | null }[] = []
  for (let i = 0; i < nPri; i++) picks.push(priPool[(priCursor + i) % priPool.length])
  for (let i = 0; i < nGen; i++) picks.push(genPool[(cursor + i) % genPool.length])

  const hasYouTube = !!env.YOUTUBE_API_KEY
  const naverId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID
  const naverSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET
  const hasNaver = !!(naverId && naverSecret)

  let saved = 0
  let quotaHit = false
  const used: string[] = []
  const hashtagFreq = new Map<string, number>()
  const mine = (leads: { description: string; links: string | null; name: string }[]) => {
    for (const l of leads) for (const t of mineHashtags(`${l.description} ${l.links || ''} ${l.name}`)) hashtagFreq.set(t, (hashtagFreq.get(t) || 0) + 1)
  }
  // 🔎 플랫폼별 진단 누적 — fail-soft 로 삼키더라도 *사유는 기록*해 어드민에서 0건 원인 확인 가능.
  const diag = {
    yt: { configured: hasYouTube, found: 0, saved: 0, error: undefined as string | undefined },
    naver: { configured: hasNaver, found: 0, saved: 0, error: undefined as string | undefined },
  }
  if (!hasYouTube) diag.yt.error = 'NOT_CONFIGURED: ur-ads 워커에 YOUTUBE_API_KEY 미설정'
  if (!hasNaver) diag.naver.error = 'NOT_CONFIGURED: ur-ads 워커에 NAVER_SEARCH_CLIENT_ID/SECRET 미설정'

  for (const k of picks) {
    used.push(k.keyword)
    if (hasYouTube && !quotaHit) {
      try {
        const r = await discoverYouTubeInfluencers(env, k.keyword, { maxResults: 15 })
        if (r.ok) {
          diag.yt.found += r.leads?.length || 0
          if (r.leads?.length) { const s = await saveLeadsBatch(DB, POOL_ACCOUNT_ID, r.leads, { category: k.category, sourceKeyword: k.keyword }); saved += s; diag.yt.saved += s; mine(r.leads) }
        } else {
          if (r.error === 'QUOTA') quotaHit = true
          if (!diag.yt.error) diag.yt.error = `${r.error}${r.message ? `: ${r.message}` : ''}`
        }
      } catch (e) { if (!diag.yt.error) diag.yt.error = `THROW: ${(e as Error)?.message || 'unknown'}` }
    }
    if (hasNaver) {
      try {
        const r = await discoverNaverBloggers(naverId, naverSecret, k.keyword, { display: 30 })
        if (r.ok) {
          diag.naver.found += r.leads?.length || 0
          if (r.leads?.length) { const s = await saveLeadsBatch(DB, POOL_ACCOUNT_ID, r.leads, { category: k.category, sourceKeyword: k.keyword }); saved += s; diag.naver.saved += s; mine(r.leads) }
        } else if (!diag.naver.error) diag.naver.error = `${r.error}${r.message ? `: ${r.message}` : ''}`
      } catch (e) { if (!diag.naver.error) diag.naver.error = `THROW: ${(e as Error)?.message || 'unknown'}` }
    }
  }

  // ③ 해시태그 자동확장 — 후보 hits 적립 + 임계 도달 시 활성화(상한 내에서).
  //   ⚠️ 2026-07-20: 태그별 개별 쿼리(수백 subrequest)가 Free 한도 초과의 공범 → 상위 50개만 + DB.batch 2회.
  const promoted: string[] = []
  const topTags = Array.from(hashtagFreq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 50)
  if (topTags.length) {
    const upsertSql = `INSERT INTO ad_discovery_keywords (keyword, category, active, hits, source)
      VALUES (?, '자동', 0, ?, 'auto')
      ON CONFLICT(keyword) DO UPDATE SET hits = hits + excluded.hits`
    await DB.batch(topTags.map(([tag, freq]) => DB.prepare(upsertSql).bind(tag, freq))).catch(() => null)
    // 임계 도달 후보를 한 번에 조회 → 상한 여유 내에서 batch 활성화.
    const room = Math.max(0, MAX_ACTIVE_KEYWORDS - kws.length)
    if (room > 0) {
      const ph = topTags.map(() => '?').join(',')
      const cands = await DB.prepare(`SELECT id, keyword FROM ad_discovery_keywords
        WHERE active = 0 AND hits >= ? AND keyword IN (${ph}) ORDER BY hits DESC LIMIT ?`)
        .bind(AUTO_PROMOTE_HITS, ...topTags.map(([t]) => t), room)
        .all<{ id: number; keyword: string }>().catch(() => null)
      const rows = cands?.results || []
      if (rows.length) {
        await DB.batch(rows.map(r => DB.prepare('UPDATE ad_discovery_keywords SET active = 1 WHERE id = ?').bind(r.id))).catch(() => null)
        promoted.push(...rows.map(r => r.keyword))
      }
    }
  }

  // 두 커서 각각 전진(우선/일반 풀 독립 순환).
  const nextPriCursor = priPool.length ? (priCursor + nPri) % priPool.length : 0
  const nextCursor = genPool.length ? (cursor + nGen) % genPool.length : 0
  const stats: AutoCollectStats = {
    last_run: stamp, last_saved: saved, last_keywords: used,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved,
    cursor: nextCursor, promoted, youtube_quota_hit: quotaHit, diag,
  }
  await writeSetting(DB, 'ads_autocollect_cursor_pri', String(nextPriCursor))
  await writeSetting(DB, CURSOR_KEY, String(nextCursor))
  await writeSetting(DB, STATS_KEY, JSON.stringify(stats))
  return stats
}
