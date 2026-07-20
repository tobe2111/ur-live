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
import { discoverYouTubeInfluencers, discoverNaverBloggers, discoverNaverCafes, discoverTistoryBloggers, ensureInfluencerSchema, extractContacts, pickBusinessEmail, fetchLinkInBioText, type InfluencerLead, type FetchBudget } from './influencer-discovery'

/** 공용 풀 계정 id — 실제 ad_accounts.id 는 1부터라 0 은 시스템 풀 전용 센티넬(충돌 없음). */
export const POOL_ACCOUNT_ID = 0

/** 자동확장 활성 키워드 상한(런어웨이 방지) + 후보 자동승격 임계(반복 등장 횟수). */
const MAX_ACTIVE_KEYWORDS = 200
const AUTO_PROMOTE_HITS = 3

/**
 * ⭐ 우선 카테고리 (대표 지시 2026-07-20 "맛집·숙소·네일·뷰티가 가장 중요") — 매 실행 배치의
 * 절반을 항상 이 카테고리 키워드에 배정(별도 커서로 순환), 나머지 절반이 전체 일반 순환.
 */
// ⭐ 유어딜 연관 최우선 카테고리 — 동네 맛집·카페·뷰티·네일·숙소 딜 + 외식/자영업(매장 사장·창업).
//   예: 홍석천·이원일 유튜브(맛집/외식업) 결. 매 배치의 3/4 를 이 풀에 배정.
export const PRIORITY_CATEGORIES = ['맛집', '푸드', '외식창업', '숙소', '네일', '뷰티']

/** 카테고리별 시드 키워드(한국). 탐색 *범위*라 구조 문서 갱신 대상 아님(자유 확장). */
const SEED: { category: string; keywords: string[] }[] = [
  // ⭐ 우선 분야 (대폭 보강)
  { category: '뷰티', keywords: ['뷰티 유튜버', '메이크업 튜토리얼', '스킨케어 리뷰', '코스메틱 추천', '헤어 스타일링', '피부관리 루틴', '뷰티 하울', '왁싱 후기'] },
  { category: '네일', keywords: ['네일아트', '셀프네일', '젤네일 디자인', '네일샵 추천', '네일 튜토리얼'] },
  { category: '맛집', keywords: ['맛집 추천', '서울 맛집', '부산 맛집', '맛집 리뷰', '동네 맛집', '카페 추천', '맛집 투어', '데이트 맛집', '로컬 맛집', '숨은 맛집', '노포 맛집', '골목식당'] },
  { category: '푸드', keywords: ['맛집 브이로그', '먹방', '홈카페', '베이킹 레시피', '자취요리'] },
  // ⭐ 외식/자영업 — 유어딜 매장(셀러) 결. 홍석천·이원일 류 외식업 인플루언서·매장 사장·창업 채널.
  { category: '외식창업', keywords: ['외식업', '자영업', '소상공인', '식당 창업', '카페 창업', '장사 노하우', '가게 홍보', '매장 마케팅', '요식업', '음식점 사장', '동네 가게', '소상공인 창업'] },
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

// 🗺️ 지역×업종 그리드 — 서울 25구 × {맛집·카페·뷰티·네일}. 소스 추가 없이 로컬 커버리지 극대화(유어딜 동네딜 결).
//   카페는 맛집 카테고리로 태깅(우선 커서). 커서 순환이라 쿼터 부담 없이 며칠에 걸쳐 도는 구조.
const SEOUL_GU = ['강남', '서초', '송파', '강동', '마포', '용산', '성동', '광진', '영등포', '동작', '관악', '강서', '양천', '구로', '금천', '종로', '중구', '성북', '동대문', '중랑', '노원', '도봉', '강북', '은평', '서대문']
const REGION_SEED: { category: string; keywords: string[] }[] = [
  { category: '맛집', keywords: SEOUL_GU.flatMap(gu => [`${gu} 맛집`, `${gu} 카페`]) },
  { category: '뷰티', keywords: SEOUL_GU.map(gu => `${gu} 뷰티`) },
  { category: '네일', keywords: SEOUL_GU.map(gu => `${gu} 네일`) },
]

export interface DiscoveryKeyword { id: number; keyword: string; category: string | null; active: number; hits: number; source: string; created_at: string }
interface AutoCollectStats {
  last_run: string; last_saved: number; last_keywords: string[]
  total_runs: number; total_saved: number; cursor: number
  promoted?: string[]; youtube_quota_hit?: boolean
  bio_enriched?: number // 🔗 이번 실행에서 링크인바이오 페이지로 이메일/인스타를 새로 채운 리드 수
  /** 🔎 진단(2026-07-20 "신규 0건" 사후) — 0건의 원인을 밖에서 알 수 있게 플랫폼별 결과를 기록.
   *  configured=키 존재 여부(ur-ads env), found=발굴 합계, saved=신규 저장, error=첫 실패 사유. */
  diag?: {
    yt: { configured: boolean; found: number; saved: number; error?: string }
    naver: { configured: boolean; found: number; saved: number; error?: string }
  }
}

const CURSOR_KEY = 'ads_autocollect_cursor'
const STATS_KEY = 'ads_autocollect_stats'
const ALERT_KEY = 'ads_autocollect_alert_at' // 🔔 조용한 실패 경보 throttle 상태(빈값=건강).

type CollectDiag = { yt: { configured: boolean; found: number; saved: number; error?: string }; naver: { configured: boolean; found: number; saved: number; error?: string } }

/**
 * 🔔 조용한 실패 방어(2026-07-20) — 수집이 켜져 있는데 **키 소실/전 플랫폼 0건**이면 Discord 경보.
 *   배경: 시크릿이 `wrangler deploy`(plaintext var wipe)로 지워져 "신규 0건"이 조용히 며칠 지속되던 사고
 *   클래스(2026-07-20 실발생) — diag 는 저장만 되고 push 가 없어 대시보드를 열기 전까지 아무도 모름.
 *   판정: 키 미설정(configured=false, =시크릿 소실 신호) 또는 saved===0(quota 소진이어도 naver 까지 0이면 문제).
 *   throttle: settings alert_at 로 6h 1회(24알림/day 방지) + 회복 시 즉시 해제(다음 실패는 지연 없이 알림).
 *   전부 fail-soft — 알림 실패가 수집을 막지 않는다. DISCORD_WEBHOOK_URL 미설정이면 no-op(회귀 0).
 */
async function maybeAlertCollectHealth(env: Env, DB: D1Database, run: { diag: CollectDiag; saved: number; quotaHit: boolean }): Promise<void> {
  const webhook = env.DISCORD_WEBHOOK_URL
  if (!webhook) return
  const { diag, saved, quotaHit } = run
  const keyMissing = !diag.yt.configured || !diag.naver.configured
  const unhealthy = keyMissing || saved === 0
  const prevAt = await readSetting(DB, ALERT_KEY)
  const { sendDiscordAlert } = await import('@/worker/utils/discord-alert')
  if (!unhealthy) {
    if (prevAt) { // 직전이 경보 상태였다 → 해제 + 회복 알림 1회.
      await writeSetting(DB, ALERT_KEY, '')
      await sendDiscordAlert(webhook, '유어애즈 인플루언서 수집 회복', `신규 ${saved}건 저장 — 정상 재개.`, 'info')
    }
    return
  }
  const last = prevAt ? Date.parse(prevAt) : 0
  const now = Date.now()
  if (prevAt && Number.isFinite(last) && now - last < 6 * 3600 * 1000) return // 6h throttle
  await writeSetting(DB, ALERT_KEY, new Date(now).toISOString())
  const lines = [
    keyMissing ? '⚠️ API 키 미설정(시크릿 소실 의심 — ur-ads 워커 env 확인)' : '⚠️ 전 플랫폼 신규 0건',
    `• YouTube: cfg=${diag.yt.configured} found=${diag.yt.found} saved=${diag.yt.saved}${diag.yt.error ? ` err=${diag.yt.error}` : ''}`,
    `• Naver: cfg=${diag.naver.configured} found=${diag.naver.found} saved=${diag.naver.saved}${diag.naver.error ? ` err=${diag.naver.error}` : ''}`,
    quotaHit ? '• YouTube 일일 쿼터 소진(내일 자동 재개)' : '',
    '어드민 인플루언서 풀에서 상세 확인.',
  ].filter(Boolean)
  await sendDiscordAlert(webhook, '유어애즈 인플루언서 수집 경보', lines.join('\n'), keyMissing ? 'error' : 'warn')
}

/**
 * 🚀 일괄 저장(DB.batch) — 청크당 1 batch(Free 한도 보호).
 *   2026-07-20 ①: INSERT OR IGNORE → **컨택 백필 upsert**. 신규는 INSERT, 기존 리드는 이메일/인스타/틱톡/
 *   링크가 **비어있을 때만** 새로 찾은 값으로 채움(늦게 발견된 컨택 자동 반영 — 자가치유). status/memo(수동
 *   큐레이션)·category 는 불변. DO UPDATE 의 WHERE 로 실제 채울 게 있을 때만 change=1 → 중복 인플레 없음.
 */
async function saveLeadsBatch(
  DB: D1Database, accountId: number, leads: InfluencerLead[],
  meta: { category?: string | null; sourceKeyword?: string | null },
): Promise<number> {
  if (!leads.length) return 0
  const sql = `INSERT INTO ad_influencer_leads
    (account_id, platform, channel_id, handle, name, url, subscriber_count, view_count, video_count, country, thumbnail, email, instagram, tiktok, links, description, category, source_keyword)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, platform, channel_id) DO UPDATE SET
      email = COALESCE(ad_influencer_leads.email, excluded.email),
      instagram = COALESCE(ad_influencer_leads.instagram, excluded.instagram),
      tiktok = COALESCE(ad_influencer_leads.tiktok, excluded.tiktok),
      links = COALESCE(ad_influencer_leads.links, excluded.links),
      subscriber_count = CASE WHEN excluded.subscriber_count > 0 THEN excluded.subscriber_count ELSE ad_influencer_leads.subscriber_count END
    WHERE (ad_influencer_leads.email IS NULL AND excluded.email IS NOT NULL)
       OR (ad_influencer_leads.instagram IS NULL AND excluded.instagram IS NOT NULL)
       OR (ad_influencer_leads.tiktok IS NULL AND excluded.tiktok IS NOT NULL)
       OR (ad_influencer_leads.links IS NULL AND excluded.links IS NOT NULL)`
  let saved = 0
  const CHUNK = 50
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

// 링크인바이오 서비스 자체 도메인 메일(support@linktr.ee 등) — 채널 주인 컨택 아님.
const PLATFORM_EMAIL_RE = /@(linktr\.ee|litt\.ly|inpock\.co\.kr|litelink\.at|taplink\.cc|link\.bio)$/i

/** 🔗 링크인바이오 백필(2026-07-20) — 이메일/인스타 없는 풀 리드의 linktr.ee 류 **공개 페이지**를 열어 컨택 보강.
 *  소개글엔 링크트리만 적고 이메일은 그 안에 두는 인플루언서 커버(합법·무료·쿼터 무관 — 무료 범위의 마지막 레버).
 *  매 실행 잔여 서브리퀘스트 예산으로 max 건(구독자 큰 순). 시도한 행은 성공/실패 무관 bio_checked_at 스탬프
 *  (재시도 폭주 방지) — 기존 풀 3천+ 도 매시간 순차 소진(자가치유). 채움은 빈 칸만(수동 데이터 불변). */
export async function enrichPoolFromLinkInBio(DB: D1Database, budget: FetchBudget, max: number): Promise<number> {
  if (max <= 0 || budget.left <= 0) return 0
  const rows = (await DB.prepare(`SELECT id, links, email, instagram, tiktok FROM ad_influencer_leads
    WHERE account_id = ? AND bio_checked_at IS NULL AND (email IS NULL OR instagram IS NULL)
      AND links IS NOT NULL AND (links LIKE '%linktr.ee%' OR links LIKE '%litt.ly%' OR links LIKE '%inpock.co.kr%' OR links LIKE '%litelink.at%' OR links LIKE '%link.bio%' OR links LIKE '%taplink.cc%')
    ORDER BY subscriber_count DESC, id DESC LIMIT ?`).bind(POOL_ACCOUNT_ID, max)
    .all<{ id: number; links: string | null; email: string | null; instagram: string | null; tiktok: string | null }>().catch(() => null))?.results || []
  if (!rows.length) return 0
  let enriched = 0
  const stmts: ReturnType<D1Database['prepare']>[] = []
  for (const r of rows) {
    if (budget.left <= 0) break // 예산 소진 — 스탬프 없이 중단(다음 틱이 이어받음)
    budget.left -= 1
    const link = (r.links || '').split(/\s+/).find(l => /^(?:https?:\/\/)?(?:linktr\.ee|litt\.ly|inpock\.co\.kr|litelink\.at|link\.bio|taplink\.cc)\//i.test(l)) || ''
    const html = link ? await fetchLinkInBioText(link) : ''
    const c = html ? extractContacts(html) : { emails: [], instagram: [], tiktok: [], links: [] }
    let email = r.email
    if (!email && html) {
      const picked = pickBusinessEmail(html)
      email = (picked && !PLATFORM_EMAIL_RE.test(picked) ? picked : null) || c.emails.find(e => !PLATFORM_EMAIL_RE.test(e)) || null
    }
    const insta = r.instagram || c.instagram[0] || null
    const tt = r.tiktok || c.tiktok[0] || null
    if ((email && !r.email) || (insta && !r.instagram) || (tt && !r.tiktok)) enriched++
    stmts.push(DB.prepare("UPDATE ad_influencer_leads SET email = ?, instagram = ?, tiktok = ?, bio_checked_at = datetime('now') WHERE id = ? AND account_id = ?")
      .bind(email, insta, tt, r.id, POOL_ACCOUNT_ID))
  }
  if (stmts.length) await DB.batch(stmts).catch(() => null)
  return enriched
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
  // 📊 키워드별 성과(누적 발굴/저장 + 직전 실행 저장 + 마지막 실행 시각) — "어느 지역 키워드가 잘 무는지" 관측용.
  await DB.prepare('ALTER TABLE ad_discovery_keywords ADD COLUMN found_total INTEGER NOT NULL DEFAULT 0').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_discovery_keywords ADD COLUMN saved_total INTEGER NOT NULL DEFAULT 0').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_discovery_keywords ADD COLUMN last_saved INTEGER NOT NULL DEFAULT 0').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_discovery_keywords ADD COLUMN last_run_at DATETIME').run().catch(() => null)
  // 시드(일반 ~90 + 지역그리드 100) — 개별 INSERT 대신 1 batch (Free 한도 절약). 멱등 INSERT OR IGNORE.
  const stmts = [...SEED, ...REGION_SEED].flatMap(g => g.keywords.map(kw =>
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
  // 🚀 "최대한 많이"(2026-07-20): 네이버 쿼터(25k/day)는 남아돌아 — YT 배정(batch)에 더해
  //   **네이버 전용 추가 키워드**(NAVER_EXTRA)를 같은 순환에서 더 돌림. YT 는 앞 batch 개만.
  const NAVER_EXTRA = 4
  const totalPick = batch + NAVER_EXTRA
  // 유어딜 연관(맛집·외식창업·뷰티·네일·숙소) 우선 — 배치의 3/4 를 우선 풀에(나머지 1/4 일반: 자가확장용 다양성).
  const basePri = priPool.length ? Math.min(priPool.length, Math.ceil(totalPick * 3 / 4)) : 0
  const nGen = Math.min(genPool.length, totalPick - basePri)
  const nPri = Math.min(priPool.length, totalPick - nGen) // 일반 풀이 모자라면 우선 풀이 추가로 채움
  // 우선/일반 인터리브 — YT 슬롯(앞 batch 개)에 우선·일반이 골고루 들어가게.
  const priPicks: { id: number; keyword: string; category: string | null }[] = []
  const genPicks: { id: number; keyword: string; category: string | null }[] = []
  for (let i = 0; i < nPri; i++) priPicks.push(priPool[(priCursor + i) % priPool.length])
  for (let i = 0; i < nGen; i++) genPicks.push(genPool[(cursor + i) % genPool.length])
  const picks: { id: number; keyword: string; category: string | null }[] = []
  for (let i = 0; i < Math.max(priPicks.length, genPicks.length); i++) {
    if (i < priPicks.length) picks.push(priPicks[i])
    if (i < genPicks.length) picks.push(genPicks[i])
  }

  const hasYouTube = !!env.YOUTUBE_API_KEY
  const naverId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID
  const naverSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET
  const hasNaver = !!(naverId && naverSecret)
  const kakaoKey = env.KAKAO_REST_API_KEY
  const hasTistory = !!kakaoKey
  // 🎥 YT 검색 각도 교대 — (검색타입 × 정렬)을 매 실행 순환. 같은 키워드도 각도가 다르면 다른 채널이 나옴
  //   → top-N 재탕이 아니라 커버리지가 계속 확장(수렴). date=신생/소형, viewCount=인기, relevance=관련.
  const YT_ANGLES: { searchType: 'channel' | 'video'; order: 'relevance' | 'date' | 'viewCount' }[] = [
    { searchType: 'channel', order: 'relevance' },
    { searchType: 'video', order: 'date' },       // 최신 — 계속 새로 생기는 소형 크리에이터
    { searchType: 'channel', order: 'viewCount' }, // 인기 채널
    { searchType: 'video', order: 'relevance' },
    { searchType: 'video', order: 'viewCount' },
  ]
  const ytAngle = YT_ANGLES[(prev?.total_runs || 0) % YT_ANGLES.length]
  // 네이버/티스토리도 정렬 교대(정확도↔최신) — 쿼터 여유라 순수 이득(최신순은 새 블로거 유입).
  const naverSort: 'sim' | 'date' = ((prev?.total_runs || 0) % 2 === 0) ? 'sim' : 'date'
  const tistorySort: 'accuracy' | 'recency' = ((prev?.total_runs || 0) % 2 === 0) ? 'accuracy' : 'recency'
  // 🔒 서브리퀘스트 예산(2026-07-20 실사고 "Too many subrequests") — 한 cron 실행의 외부 fetch 총량 상한.
  //   소진 시 이번 틱은 조기 종료(에러 아님), 커서가 다음 틱에서 이어받아 커버리지 손실 0(매시간 실행이라 총량 유지).
  //   기본 180 — env ADS_SUBREQUEST_BUDGET 로 조정. D1 쓰기는 별도라 여유(1000 한도 대비 안전).
  const budget: FetchBudget = { left: Math.max(20, parseInt(env.ADS_SUBREQUEST_BUDGET || '', 10) || 180) }

  let saved = 0
  let quotaHit = false
  const used: string[] = []
  const kwStats = new Map<number, { found: number; saved: number }>() // 📊 키워드별 발굴/저장(성과 관측)
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

  // YT 검색 페이지 수(키워드당 깊이) — 기본 2(page1=1~50위, page2=51~100위…). 쿼터는 quotaHit 가드가 관리.
  // 기본 1페이지(1~50위) — YT 일일 쿼터(기본 10k) 안에서 더 많은 키워드·지역 커버(시드 소싱은 깊이<폭).
  //   깊이가 더 필요하면 env ADS_YT_PAGES=2~5 로 상향(쿼터 여유/증액 시).
  const ytPages = Math.max(1, Math.min(5, parseInt(env.ADS_YT_PAGES || '', 10) || 1))
  let ytUsed = 0
  for (const k of picks) {
    if (budget.left <= 0) break // 🔒 서브리퀘스트 예산 소진 — 이번 틱 종료(다음 틱 커서 이어받음)
    used.push(k.keyword)
    let kFound = 0, kSaved = 0 // 이 키워드의 이번 실행 발굴/저장
    // YT 는 배치 상한(batch)개 키워드만(쿼터 예산) — 나머지는 네이버 전용. maxResults 50 × pages 로 깊이 확장.
    if (hasYouTube && !quotaHit && ytUsed < batch) {
      ytUsed++
      try {
        const r = await discoverYouTubeInfluencers(env, k.keyword, { maxResults: 50, pages: ytPages, enrichMax: 8, budget, searchType: ytAngle.searchType, order: ytAngle.order })
        if (r.ok) {
          diag.yt.found += r.leads?.length || 0; kFound += r.leads?.length || 0
          if (r.leads?.length) { const s = await saveLeadsBatch(DB, POOL_ACCOUNT_ID, r.leads, { category: k.category, sourceKeyword: k.keyword }); saved += s; diag.yt.saved += s; kSaved += s; mine(r.leads) }
        } else {
          if (r.error === 'QUOTA') quotaHit = true
          if (!diag.yt.error) diag.yt.error = `${r.error}${r.message ? `: ${r.message}` : ''}`
        }
      } catch (e) { if (!diag.yt.error) diag.yt.error = `THROW: ${(e as Error)?.message || 'unknown'}` }
    }
    if (hasNaver) {
      try {
        const r = await discoverNaverBloggers(naverId, naverSecret, k.keyword, { display: 100, enrichMax: 5, budget, sort: naverSort })
        if (r.ok) {
          diag.naver.found += r.leads?.length || 0; kFound += r.leads?.length || 0
          if (r.leads?.length) { const s = await saveLeadsBatch(DB, POOL_ACCOUNT_ID, r.leads, { category: k.category, sourceKeyword: k.keyword }); saved += s; diag.naver.saved += s; kSaved += s; mine(r.leads) }
        } else if (!diag.naver.error) diag.naver.error = `${r.error}${r.message ? `: ${r.message}` : ''}`
      } catch (e) { if (!diag.naver.error) diag.naver.error = `THROW: ${(e as Error)?.message || 'unknown'}` }
      // 네이버 카페 — 동일 키/쿼터풀(25k 여유). 커뮤니티(카페) 단위 집계.
      try {
        const r = await discoverNaverCafes(naverId, naverSecret, k.keyword, { display: 50, budget, sort: naverSort })
        if (r.ok && r.leads?.length) { const s = await saveLeadsBatch(DB, POOL_ACCOUNT_ID, r.leads, { category: k.category, sourceKeyword: k.keyword }); saved += s; diag.naver.found += r.leads.length; diag.naver.saved += s; kFound += r.leads.length; kSaved += s; mine(r.leads) }
      } catch { /* fail-soft */ }
    }
    // 티스토리(카카오 Daum 블로그 검색 — 무료 3만/일, 새 소스). 네이버 블로그와 무관한 별도 풀.
    if (hasTistory) {
      try {
        const r = await discoverTistoryBloggers(kakaoKey, k.keyword, { size: 50, budget, sort: tistorySort })
        if (r.ok && r.leads?.length) { const s = await saveLeadsBatch(DB, POOL_ACCOUNT_ID, r.leads, { category: k.category, sourceKeyword: k.keyword }); saved += s; diag.naver.found += r.leads.length; diag.naver.saved += s; kFound += r.leads.length; kSaved += s; mine(r.leads) }
      } catch { /* fail-soft */ }
    }
    const prevK = kwStats.get(k.id) // 같은 키가 한 실행에 중복되어도 누적
    kwStats.set(k.id, { found: (prevK?.found || 0) + kFound, saved: (prevK?.saved || 0) + kSaved })
  }
  // 📊 키워드별 성과 누적 저장(1 batch) — 어드민 키워드 칩에서 "어느 지역 키워드가 잘 무는지" 확인.
  if (kwStats.size) {
    await DB.batch(Array.from(kwStats.entries()).map(([id, v]) =>
      DB.prepare("UPDATE ad_discovery_keywords SET found_total = found_total + ?, saved_total = saved_total + ?, last_saved = ?, last_run_at = datetime('now') WHERE id = ?")
        .bind(v.found, v.saved, v.saved, id))).catch(() => null)
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

  // 🔗 링크인바이오 백필 — 남은 서브리퀘스트 예산으로 컨택 없는 리드의 링크트리 페이지 소진(틱당 최대 12).
  let bioEnriched = 0
  try { bioEnriched = await enrichPoolFromLinkInBio(DB, budget, Math.min(12, budget.left)) } catch { /* fail-soft */ }

  // 두 커서 각각 전진(우선/일반 풀 독립 순환).
  const nextPriCursor = priPool.length ? (priCursor + nPri) % priPool.length : 0
  const nextCursor = genPool.length ? (cursor + nGen) % genPool.length : 0
  const stats: AutoCollectStats = {
    last_run: stamp, last_saved: saved, last_keywords: used,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved,
    cursor: nextCursor, promoted, youtube_quota_hit: quotaHit, bio_enriched: bioEnriched, diag,
  }
  await writeSetting(DB, 'ads_autocollect_cursor_pri', String(nextPriCursor))
  await writeSetting(DB, CURSOR_KEY, String(nextCursor))
  await writeSetting(DB, STATS_KEY, JSON.stringify(stats))
  try { await maybeAlertCollectHealth(env, DB, { diag, saved, quotaHit }) } catch { /* fail-soft */ }
  return stats
}
