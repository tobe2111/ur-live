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

// ── ①-b 아웃리치 **거부 명시** 판별 ─────────────────────────────────────
/**
 * 🚫 소개글에 "제안 사절"을 **써 둔 사람** — 2026-07-29 대표 제보(유튜브 `똘비 ddolbi`:
 *   "공동구매 제안은 정중히 사양합니다").
 *
 *   왜 노이즈 필터보다 우선인가: 노이즈는 *낭비*지만 이건 **거부 의사 무시**다. 보내 봐야 답이 없고
 *   브랜드 인상만 깎인다. 게다가 하필 공동구매 축을 새로 넣은 참이라(#835 시드) **바로 그 키워드로
 *   이런 분들이 대량 유입**된다 — 지금 안 넣으면 풀에 조용히 쌓인다.
 *
 *   판별: **주제어 + 거부어가 25자 안에 함께** 있을 때만(단독어는 오탐이 크다).
 *     · `사양` 단독은 "제품 사양"(spec)에 걸린다 → 서술형 어미(`사양합니다`)나 `정중히 사양`만 인정
 *     · `사절` 은 "친선 사절단"이 있어 `사절단` 제외
 *     · "협찬 문의 환영"처럼 **수락**하는 문장엔 거부어가 없으므로 통과
 *     · 주제어에서 `메일/문의` 는 뺐다 — "메일은 안 받아요(DM 주세요)"는 채널 선호지 거부가 아니다
 *
 *   ⚠️ `looksLikeBrandChannel` 과 같은 처방 — **태깅만**(삭제 아님). 오탐이면 숨김일 뿐 데이터는 남는다.
 */
const OPTOUT_TOPIC_RE = /(협찬|광고|제휴|공동\s*구매|공구|제안|체험단|홍보|브랜디드|마케팅|dm|디엠|쪽지|sponsor|collab)/i
const OPTOUT_DECLINE_RE = /(정중히\s*(사양|사절|거절)|사양\s*(합니다|해요|드립니다|드려요|할게요|하겠습니다|함)|사절(?!단)|거절합니다|받지\s*않(습니다|아요|음|습니당)|안\s*받(습니다|아요|습니당)|받지않|no\s+(sponsor|paid)|not\s+accepting)/i

/** 25자 = "공동구매 제안은 정중히 사양합니다" 같은 실제 문장을 덮되, 문단 건너 오결합은 막는 폭. */
const OPTOUT_WINDOW = 25

/**
 * 아웃리치를 **명시적으로 거부**한 채널인가 — 보수적(주제어+거부어 동시 근접).
 * 순수함수(DB 왕복 0)라 저장 시점에도 부담 없이 부른다.
 */
export function declinesOutreach(name?: string | null, description?: string | null): boolean {
  const text = `${name || ''} ${description || ''}`
  if (!text.trim()) return false
  const re = new RegExp(OPTOUT_DECLINE_RE.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue } // 빈 매치 무한루프 방지
    const seg = text.slice(Math.max(0, m.index - OPTOUT_WINDOW), m.index + m[0].length + OPTOUT_WINDOW)
    if (OPTOUT_TOPIC_RE.test(seg)) return true
  }
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
  /** 🚫 소개글에 제안 거부를 명시한 채널(`declinesOutreach`) — 발송 큐 제외 대상. */
  opted_out?: number | boolean | null
  consented_at?: string | null
  source?: string | null
  /** 🏠 채널/블로그 홈 URL — 이메일·인스타가 없어도 **쪽지/댓글**로 접촉 가능한지 판단(스킴 필수). */
  url?: string | null
  /** 📅 마지막 글 날짜(YYYY-MM-DD). 네이버 검색 API 가 postdate 로 주므로 **RSS 측정 없이도** 알 수 있다. */
  last_post_at?: string | null
}

export interface ScoreResult { score: number; reasons: string[] }

/** 'YYYY-MM-DD' → 오늘로부터 며칠 전. 파싱 불가/미래 날짜면 null(= 신호 없음, 감점 아님). */
export function daysSince(iso: string | null | undefined, nowMs: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '').trim())
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (!Number.isFinite(t)) return null
  const d = (nowMs - t) / 86_400_000
  return d < 0 ? null : d // 미래 날짜는 데이터 오류 — 활동성 신호로 쓰지 않는다
}

/**
 * 리드 점수 0~100 — 높을수록 먼저 연락할 가치. 4축 합산 후 감점/가점.
 *   연락가능성 30 · 규모적합도 25 · 활동성 25 · 카테고리핏 20 (+동의 보너스, −브랜드 감점)
 *   ⚠️ 이 함수가 SSOT — SQL 로 중복 구현하지 말 것(드리프트 방지).
 */
export function scoreLead(l: ScoreInput, nowMs: number = Date.now()): ScoreResult {
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
    /**
     * 📝 블로그/카페 활동성 — 2026-07-29 근본수정.
     *   기존엔 `recent_posts_30d` 만 봤는데 이 값은 **RSS 측정을 마친 리드에만** 있다.
     *   라이브 실측: 블로거 28,673명 중 **26,245명(92%)이 미측정** → 전부 `posts30 = 0` 으로 떨어져
     *   "최근 30일 포스팅 없음"(활동성 0점)을 받았다. **아직 안 잰 것과 죽은 것이 구분되지 않았고**,
     *   그래서 상위 목록이 "먼저 측정된 소수"에 편향됐다(먼저 잰 순서 ≠ 좋은 순서).
     *   ⇒ ① 측정값이 있으면 그대로 ② 없으면 `last_post_at`(네이버 검색 API 의 postdate — **측정 없이도
     *   대부분 채워진다**)으로 판단 ③ 둘 다 없으면 **중립**(죽었다고 단정하지 않는다).
     */
    const measured = l.recent_posts_30d != null
    if (measured) {
      if (posts30 >= 12) activity = 25
      else if (posts30 >= 6) activity = 20
      else if (posts30 >= 2) activity = 13
      else if (posts30 === 1) activity = 7
      else reasons.push('최근 30일 포스팅 없음') // ← 측정 결과로서의 0. 미측정은 아래 '활동성 미측정(중립)'
    } else {
      const days = daysSince(l.last_post_at, nowMs)
      if (days == null) { activity = 12; reasons.push('활동성 미측정(중립)') }
      else if (days <= 14) { activity = 23; reasons.push('최근 2주 내 글') }
      else if (days <= 45) { activity = 18; reasons.push('최근 6주 내 글') }
      else if (days <= 120) { activity = 11 }
      else { activity = 4; reasons.push(`마지막 글 ${Math.round(days)}일 전`) }
    }
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
  /**
   * 🚫 거부 명시 — 브랜드 오분류(−35)보다 **더 크게** 깎는다. 브랜드는 "아마 아닐 것"이지만
   *   이건 본인이 직접 쓴 의사표시라 오탐이 아닌 한 되돌아올 일이 없다. 큐에서도 제외되므로
   *   점수는 목록 정렬용이지만, 상위에 남아 대표 눈을 뺏는 일이 없어야 한다.
   */
  if (l.opted_out) { score -= 60; reasons.push('아웃리치 거부 명시(제안 사절)') }
  /**
   * 🚫 연락 불가 리드 강한 감점 — 2026-07-29 신설.
   *   발송 큐(`pickReach`)는 이메일·인스타·**스킴 있는 url** 중 하나가 있어야 열 수 있고, 없으면
   *   큐에서 제외된다. 그런데 점수는 규모+활동성+카테고리로 **70점까지** 받을 수 있어, 연락할 방법이
   *   없는 리드가 `score_hot` 상위를 차지했다 — 하루 20명이 상한인 지금 그 자리는 곧 손실이다.
   *   ⚠️ 삭제·제외가 아니라 **후순위**다(보강이 돌면 연락처가 생겨 곧바로 제자리를 찾는다).
   */
  const reachable = !!(l.email || l.instagram || (l.url && /^https?:\/\//i.test(l.url)))
  if (!reachable) { score -= 40; reasons.push('연락 불가(발송 큐 제외 대상)') }

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
  // 🚫 2026-07-29: 소개글에 제안 거부를 명시한 채널(declinesOutreach). 태깅만 — 삭제 아님.
  'ALTER TABLE ad_influencer_leads ADD COLUMN opted_out INTEGER NOT NULL DEFAULT 0',
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
export async function runQualityPass(DB: D1Database, opts?: { max?: number; budget?: OpBudget }): Promise<{ scanned: number; branded: number; scored: number; opted_out: number; done: boolean }> {
  await ensureQualityColumns(DB)
  const MAX = Math.max(200, Math.min(40_000, opts?.max ?? 8000))
  const PAGE = 500
  let cursor = 0
  const raw = await DB.prepare(`SELECT value FROM platform_settings WHERE key = ?`).bind(QUALITY_CURSOR_KEY)
    .first<{ value: string }>().catch(() => null)
  if (raw?.value) cursor = Math.max(0, parseInt(raw.value, 10) || 0)

  let scanned = 0, branded = 0, scored = 0, optedOut = 0, done = false
  while (scanned < MAX) {
    // ⚠️ url·last_post_at 이 빠지면 아래 scoreLead 의 '연락 가능성'·'미측정 활동성' 보정이 통째로 무력화된다
    //   (undefined → 연락 불가로 오판 / 활동성 중립 폴백 불가). 컬럼 추가 시 이 SELECT 를 함께 볼 것.
    const rows = (await DB.prepare(`SELECT id, platform, name, description, subscriber_count, recent_avg_views,
        median_long_views, recent_posts_30d, email, instagram, links, category, is_brand, consented_at, source,
        url, last_post_at, opted_out
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
      /**
       * 🚫 거부 태그는 **한 번 서면 유지**(sticky). 재계산으로 풀지 않는 이유 두 가지:
       *   ① `description` 은 저장 시 500자로 잘린다 — 뒤쪽에 있던 "제안 사절"이 잘려 나가면
       *      다음 패스가 태그를 조용히 해제한다(같은 사람인데 판정이 저장 길이에 좌우됨).
       *   ② 소개글을 고쳐 문구가 사라져도, 명시적으로 받은 거부 의사를 우리가 먼저 무를 이유는 없다.
       *   해제가 필요하면 어드민에서 사람이 판단해 푼다(오탐 검수 경로 = `optedOutOnly=1` 필터).
       */
      const optOut = r.opted_out ? 1 : (declinesOutreach(r.name, r.description) ? 1 : 0)
      const { score } = scoreLead({ ...r, is_brand: brand, opted_out: optOut })
      if (brand && !r.is_brand) branded++
      if (optOut && !r.opted_out) optedOut++
      scored++
      stmts.push(DB.prepare('UPDATE ad_influencer_leads SET is_brand = ?, lead_score = ?, opted_out = ? WHERE id = ?').bind(brand, score, optOut, r.id))
    }
    for (let i = 0; i < stmts.length; i += 100) await DB.batch(stmts.slice(i, i + 100)).catch(() => null)
    if (opts?.budget?.exhausted) { cursor = pageStart; break } // 갱신이 잘렸으면 이 페이지를 다음 회차에 다시
    if (rows.length < PAGE) { done = true; break }
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(QUALITY_CURSOR_KEY, String(done ? 0 : cursor)).run().catch(() => null)
  return { scanned, branded, scored, opted_out: optedOut, done }
}
