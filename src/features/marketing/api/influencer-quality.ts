/**
 * 🏅 인플루언서 풀 품질 레이어 (2026-07-27 대표 "모두 개선해줘")
 *   ① 브랜드 공식 채널 판별(is_brand) — 인플루언서가 아닌 기업/브랜드 계정을 **삭제 없이 태깅**해
 *      기존 노이즈 숨김 필터에 합류시킨다(오탐이 나도 숨김일 뿐 데이터는 보존).
 *   ② 리드 스코어링(lead_score 0~100) — 연락가능성·규모적합도·활동성·카테고리핏을 합산해
 *      "먼저 연락할 순서"를 정한다. 순수함수(scoreLead)라 유닛테스트로 고정.
 *   ③ runQualityPass — 야간 정비가 커서로 풀을 순회하며 ①②를 일괄 갱신(멱등).
 *
 *   ⚠️ 서비스 분리: ad_* 테이블 + platform_settings 만 접촉(소비자/도매 무관).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { runDdlOnce } from './ads-schema-guard'
import type { OpBudget } from './maintenance-budget'
import { isPersonalEmail } from './influencer-performance'

// ── ① 브랜드 공식 채널 판별 ──────────────────────────────────────────────
/** 이름에 나타나는 **강한** 브랜드 신호. 법인격 표기는 이름에서만 인정(소개글의 "문의: (주)샌드박스"는
 *  MCN/대행 연락처라 채널 자체가 브랜드라는 뜻이 아님 — 오탐 방지). */
const BRAND_NAME_RE = /(공식\s*(채널|계정|유튜브|블로그|스토어|스토어팜|몰|샵)|official\s*[-_ ]*(channel|account|store)|\(주\)|㈜|주식회사|\bInc\.?\b|\bCorp\.?\b|Co\.,?\s?Ltd)/i
/** 소개글의 강한 브랜드 신호 — "우리 브랜드의 공식 채널입니다" 류만. 단독 '공식'(예: "공식 문의")은 제외. */
const BRAND_DESC_RE = /(공식\s*(채널|계정|유튜브\s*채널|블로그|스토어|온라인몰|쇼핑몰)|브랜드\s*공식|official\s+(channel|account)\s+of|본사\s*운영)/i

/**
 * 브랜드/기업 공식 채널로 보이는가 — **보수적**(강한 신호 1개 이상). 개인 크리에이터를 브랜드로
 * 오분류하면 좋은 리드를 숨기게 되므로, 애매하면 false 를 반환한다.
 */
export function looksLikeBrandChannel(name?: string | null, description?: string | null): boolean {
  const n = String(name || '')
  const d = String(description || '')
  if (BRAND_NAME_RE.test(n)) return true
  if (BRAND_DESC_RE.test(d)) return true
  return false
}

// ── ② 리드 스코어링 ────────────────────────────────────────────────────
/** 유어딜 핵심 카테고리(오프라인 이용권/동네딜과 직결) — 핏 만점. */
const CORE_CATEGORIES = new Set(['맛집', '외식창업', '숙소', '뷰티', '네일', '여행', '푸드'])

export interface ScoreInput {
  platform?: string | null
  subscriber_count?: number | null
  recent_avg_views?: number | null
  median_long_views?: number | null
  recent_posts_30d?: number | null
  email?: string | null
  instagram?: string | null
  links?: string | null
  category?: string | null
  is_brand?: number | boolean | null
  consented_at?: string | null
  source?: string | null
}

export interface ScoreResult { score: number; reasons: string[] }

/**
 * 리드 점수 0~100 — 높을수록 먼저 연락할 가치. 4축 합산 후 감점/가점.
 *   연락가능성 30 · 규모적합도 25 · 활동성 25 · 카테고리핏 20 (+동의 보너스, −브랜드 감점)
 *   ⚠️ 이 함수가 SSOT — SQL 로 중복 구현하지 말 것(드리프트 방지).
 */
export function scoreLead(l: ScoreInput): ScoreResult {
  const reasons: string[] = []
  const platform = String(l.platform || '')
  const isYt = platform === 'youtube'
  const subs = Math.max(0, Number(l.subscriber_count) || 0)
  const posts30 = Math.max(0, Number(l.recent_posts_30d) || 0)
  // 성과 지표: 롱폼 중앙값 우선(쇼츠 착시 배제), 없으면 기존 평균으로 폴백.
  const perf = Math.max(0, Number(l.median_long_views) || Number(l.recent_avg_views) || 0)

  // (1) 연락 가능성 30 — 개인 이메일이 최고(직접 제안 가능). 대행사 메일/기타 링크는 절반 이하.
  let contact = 0
  if (l.email) {
    if (isPersonalEmail(l.email)) { contact = 30; reasons.push('개인 이메일 보유') }
    else { contact = 16; reasons.push('이메일 보유(대행사·기타)') }
  } else if (l.instagram) { contact = 9; reasons.push('인스타 보유') }
  else if (l.links) { contact = 5; reasons.push('링크만 보유') }
  else reasons.push('연락처 없음')

  // (2) 규모 적합도 25 — 유어딜 딜은 마이크로/중형이 실전 효율 최고. 초대형은 단가만 높고 전환 낮음.
  let scale = 0
  if (isYt) {
    if (subs >= 10_000 && subs < 500_000) { scale = 25; reasons.push('스위트스팟 규모') }
    else if (subs >= 5_000 && subs < 10_000) scale = 18
    else if (subs >= 500_000 && subs < 1_000_000) scale = 14
    else if (subs >= 1_000 && subs < 5_000) scale = 10
    else if (subs >= 1_000_000) { scale = 7; reasons.push('초대형(단가 부담)') }
    else scale = 4
  } else {
    // 네이버 블로그/카페 — 구독자(이웃수)가 대부분 미측정이라 규모는 중립 배점 + 이웃수 있으면 가산.
    scale = subs >= 3_000 ? 22 : subs > 0 ? 16 : 13
  }

  // (3) 활동성 25 — 최근에 실제로 활동하는가(죽은 채널 배제). YT=최근 조회수, 블로그=30일 포스팅.
  let activity = 0
  if (isYt) {
    if (perf >= 50_000) activity = 25
    else if (perf >= 10_000) activity = 21
    else if (perf >= 3_000) activity = 16
    else if (perf >= 500) activity = 10
    else if (perf > 0) activity = 5
    else reasons.push('최근 성과 미측정')
    // 구독자 대비 조회수가 높으면(찐팬 비율) 소폭 가산 — 규모보다 반응이 중요.
    if (subs > 0 && perf > 0 && perf / subs >= 0.2 && activity < 25) { activity = Math.min(25, activity + 3); reasons.push('구독자 대비 반응 좋음') }
  } else {
    if (posts30 >= 12) activity = 25
    else if (posts30 >= 6) activity = 20
    else if (posts30 >= 2) activity = 13
    else if (posts30 === 1) activity = 7
    else reasons.push('최근 30일 포스팅 없음')
  }

  // (4) 카테고리 핏 20 — 유어딜 핵심 카테고리 우선.
  let fit = 0
  const cat = String(l.category || '')
  if (CORE_CATEGORIES.has(cat)) { fit = 20; reasons.push(`핵심 카테고리(${cat})`) }
  else if (cat && cat !== '자동') fit = 10
  else reasons.push('카테고리 미분류')

  let score = contact + scale + activity + fit

  // 보정 — 동의 리드는 즉시 발송 가능(법적으로 자유)이라 최우선. 브랜드 공식 채널은 인플루언서가 아니라 큰 감점.
  if (l.consented_at || l.source === 'inbound') { score += 15; reasons.push('사전동의 리드') }
  if (l.is_brand) { score -= 35; reasons.push('브랜드 공식 채널 추정') }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons }
}

// ── ③ 스키마 + 일괄 갱신 패스 ────────────────────────────────────────────
const _qualityColPromise = new WeakMap<object, Promise<void>>()
/** is_brand(브랜드 공식 채널 추정) · lead_score(0~100) 컬럼 보장 — 멱등·memoized. */
/** 🧱 2026-07-28: 매 인보케이션 3 ALTER → 체크섬 1회 조회(무료 플랜 예산 회수). 목록 변경 시 자동 재적용. */
export const AD_QUALITY_DDL: string[] = [
  'ALTER TABLE ad_influencer_leads ADD COLUMN is_brand INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE ad_influencer_leads ADD COLUMN lead_score INTEGER',
  // 🏷️ 분류 근거(2026-07-27 대표 "정확하게 분류되고 있어?") — content(이름·소개글 규칙)/topic(유튜브
  //   자체분류)/keyword(수집 키워드 상속 = 재검증 대상). NULL(구데이터)은 keyword 로 간주해 집계.
  'ALTER TABLE ad_influencer_leads ADD COLUMN category_source TEXT',
]
export function ensureQualityColumns(DB: D1Database): Promise<void> {
  const c = _qualityColPromise.get(DB); if (c) return c
  const p = runDdlOnce(DB, 'ads_ddl_influencer_quality', AD_QUALITY_DDL).then(() => undefined)
  _qualityColPromise.set(DB, p); return p
}

const QUALITY_CURSOR_KEY = 'ads_quality_cursor'

/**
 * 🏅 품질 패스 — id 커서로 풀을 순회하며 is_brand 태깅 + lead_score 재계산(둘을 한 SELECT 로 처리).
 *   한 실행 상한(기본 8000행)에 걸리면 커서를 남겨 다음 밤에 이어받고, 끝까지 돌면 0 으로 리셋해
 *   다음 회차에 전체를 다시 검증(성과·연락처가 갱신되면 점수도 따라 움직여야 하므로 순환이 정답).
 */
export async function runQualityPass(DB: D1Database, opts?: { max?: number; budget?: OpBudget }): Promise<{ scanned: number; branded: number; scored: number; done: boolean }> {
  await ensureQualityColumns(DB)
  const MAX = Math.max(200, Math.min(40_000, opts?.max ?? 8000))
  const PAGE = 500
  let cursor = 0
  const raw = await DB.prepare(`SELECT value FROM platform_settings WHERE key = ?`).bind(QUALITY_CURSOR_KEY)
    .first<{ value: string }>().catch(() => null)
  if (raw?.value) cursor = Math.max(0, parseInt(raw.value, 10) || 0)

  let scanned = 0, branded = 0, scored = 0, done = false
  while (scanned < MAX) {
    const rows = (await DB.prepare(`SELECT id, platform, name, description, subscriber_count, recent_avg_views,
        median_long_views, recent_posts_30d, email, instagram, links, category, is_brand, consented_at, source
      FROM ad_influencer_leads WHERE account_id = 0 AND id > ? ORDER BY id ASC LIMIT ?`)
      .bind(cursor, PAGE).all<ScoreInput & { id: number; name: string | null; description: string | null }>().catch(() => null))?.results || []
    // ⚠️ 2026-07-28: 예산 소진으로 빈 배열이 온 것을 "끝났다"로 오판하면 아래에서 커서를 0 으로 리셋해
    //   **매번 같은 앞부분만 돌고 영원히 전진하지 못한다**(전화 스윕 커서 버그와 같은 클래스).
    if (!rows.length) { if (!opts?.budget?.exhausted) done = true; break }
    const pageStart = cursor // 이 페이지 쓰기가 예산에 잘리면 커서를 여기로 되돌린다(미기록 행 건너뜀 방지)
    const stmts = []
    for (const r of rows) {
      cursor = Math.max(cursor, r.id); scanned++
      const brand = looksLikeBrandChannel(r.name, r.description) ? 1 : 0
      const { score } = scoreLead({ ...r, is_brand: brand })
      if (brand && !r.is_brand) branded++
      scored++
      stmts.push(DB.prepare('UPDATE ad_influencer_leads SET is_brand = ?, lead_score = ? WHERE id = ?').bind(brand, score, r.id))
    }
    for (let i = 0; i < stmts.length; i += 100) await DB.batch(stmts.slice(i, i + 100)).catch(() => null)
    if (opts?.budget?.exhausted) { cursor = pageStart; break } // 갱신이 잘렸으면 이 페이지를 다음 회차에 다시
    if (rows.length < PAGE) { done = true; break }
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(QUALITY_CURSOR_KEY, String(done ? 0 : cursor)).run().catch(() => null)
  return { scanned, branded, scored, done }
}
