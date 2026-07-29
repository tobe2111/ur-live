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
import { backfillRegions } from './influencer-region'
// 💾 저장(필터·2패스 upsert·백필)은 `influencer-save.ts` 로 분리(600줄 캡) — 호출부 호환 위해 재수출.
export { MIN_YT_SUBSCRIBERS } from './influencer-save'
import { saveLeadsBatch } from './influencer-save'
import { discoverYouTubeInfluencers, discoverNaverBloggers, discoverNaverCafes, ensureInfluencerSchema, stripVideoTitles, type FetchBudget } from './influencer-discovery'
import { ensureQualityColumns } from './influencer-quality'
import { ensurePerfExtraColumns, type NaverEnrichDiag } from './influencer-performance'
import { COLLECT_LEASE_KEY, COLLECT_LEASE_TTL_MS } from './collect-lease'
import { subreqCapKey, isSubrequestLimitError, resolveSubreqBudget, nextSubreqCap } from './collect-budget'
import { maybeAlertCollectHealth } from './collect-health-alert'

/** 공용 풀 계정 id — 실제 ad_accounts.id 는 1부터라 0 은 시스템 풀 전용 센티넬(충돌 없음). */
export const POOL_ACCOUNT_ID = 0

/** 자동확장 활성 키워드 상한(런어웨이 방지) + 후보 자동승격 임계(반복 등장 횟수). */
const MAX_ACTIVE_KEYWORDS = 200
const AUTO_PROMOTE_HITS = 5 // 🛡️ 2026-07-23: 채널 단위 dedupe 도입과 함께 3→5 — '서로 다른 채널 5곳'이 쓴 태그만 승격(단일 실행 폭주 승격 방지)

// ⭐ 우선 카테고리(대표 2026-07-20 "맛집·숙소·네일·뷰티 최우선") — 유어딜 연관(동네딜·매장·외식/자영업 결,
//   홍석천·이원일 류). 매 배치의 3/4 를 이 풀에 배정(별도 커서 순환), 나머지 1/4 이 전체 일반 순환.
//   SSOT 는 `influencer-keyword-rotation.ts`(선택 점수도 이 목록을 쓴다) — 두 벌로 두면 조용히 갈라진다.
export { PRIORITY_CATEGORIES } from './influencer-keyword-rotation'
import { PRIORITY_CATEGORIES } from './influencer-keyword-rotation'

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

// 📍 방배 국지 시딩(2026-07-21 대표 — 8월 방배 시드 크리에이터 소싱). 동/역세권 단위(서울 25구 그리드보다 좁음).
//   전부 우선풀 업종(맛집/뷰티/네일)으로 태깅 → 우선 커서(3/4 배정)를 탄다(전국 확대보다 방배가 먼저 커버).
//   '카페'는 REGION_SEED 관례대로 맛집 태깅 · '피티'(PT)는 운동이 우선풀에 없어 매장 결의 뷰티로 태깅(우선 커서 편입 목적).
const BANGBAE_SEED: { category: string; keywords: string[] }[] = [
  { category: '맛집', keywords: ['방배 맛집', '방배동 맛집', '방배 카페', '방배역 맛집', '이수역 맛집', '내방역 맛집', '사당역 맛집', '서리풀공원 맛집'] },
  { category: '뷰티', keywords: ['방배 미용실', '방배 피티'] },
  { category: '네일', keywords: ['방배 네일'] },
]

export interface DiscoveryKeyword { id: number; keyword: string; category: string | null; active: number; hits: number; source: string; created_at: string }
export interface AutoCollectStats {
  last_run: string; last_saved: number; last_keywords: string[]
  total_runs: number; total_saved: number; cursor: number
  pri_cursor?: number // ⭐ 우선 풀(맛집·뷰티 등) 커서 — 배치 3/4 를 배정하는 풀의 순환 위치(관측용)
  promoted?: string[]; youtube_quota_hit?: boolean
  /** @deprecated 2026-07-28 — 링크인바이오/블로거 보강은 `influencer-enrich-lane.ts` 로 이전(스냅샷 `ads_influencer_enrich_last`).
   *  옛 실행이 남긴 값을 읽는 화면이 있어 타입은 유지(신규 실행은 안 채움). */
  bio_enriched?: number
  /** @deprecated 2026-07-28 — 성과 보강도 `influencer-enrich-lane.ts` 로 이전. 옛 스냅샷 호환용. */
  perf_enriched?: number
  /** 🔎 진단(2026-07-20 "신규 0건" 사후) — 0건의 원인을 밖에서 알 수 있게 플랫폼별 결과를 기록.
   *  configured=키 존재 여부(ur-ads env), found=발굴 합계, saved=신규 저장, error=첫 실패 사유. */
  diag?: {
    yt: { configured: boolean; found: number; saved: number; error?: string }
    naver: { configured: boolean; found: number; saved: number; error?: string }
    tistory?: { configured: boolean; found: number; saved: number; error?: string }
    /** @deprecated 2026-07-28 — 블로거 보강은 전용 레인으로 이전. 옛 스냅샷 호환용. */
    naver_enrich?: NaverEnrichDiag
  }
  /** 🎯 YT 검색 예산(진짜 병목 = Search Queries/day, 기본 100회) — 어드민 "오늘 n/100" 표시용. */
  yt_budget?: { used: number; total: number; day: string }
  /** 🔒 다른 실행이 진행 중이라 이번 호출은 아무것도 안 함(lease busy) — 체인/버스트는 yt_budget 부재로 자연 종료. */
  busy?: boolean
  /**
   * 🔒 서브리퀘스트 예산 — **정상 실행에도** 남긴다(2026-07-29).
   *   이 레인은 매시간 `Too many subrequests` 로 수확을 버리는데, 예산 수치는 **크래시 때만**(`crash_spent`)
   *   기록돼 왔다. 즉 *정작 실패하는 경로*에서 "얼마를 썼고 상한이 얼마였는지"가 화면에 안 보였다.
   *   보강 레인(`enrich_lane`)은 이미 spent/budget_total/limit_hit 를 남긴다 — 그 비대칭을 없앤다.
   */
  spent?: number
  budget_total?: number
  /** 관측된 학습 상한(0 = 미학습). 이 값이 계속 내려가면 한도가 실제로 낮다는 뜻. */
  learned_cap?: number
  /** 이번 실행에서 한도 신호를 봤나(레인이 fail-soft 로 삼켜도 여기서 드러난다). */
  limit_hit?: boolean
  /** 💥 이번 실행이 예외로 끝났다 — 원문/시각/그 시점 사용량. 성공하면 다음 스냅샷에서 사라진다. */
  crash?: string
  crash_at?: string
  crash_spent?: number
  crash_budget?: number
}

const CURSOR_KEY = 'ads_autocollect_cursor'
const STATS_KEY = 'ads_autocollect_stats'



// 🔗 링크인바이오 백필(enrichPoolFromLinkInBio) · 📝 블로거 활동성 보강은 2026-07-28 에
//   `influencer-enrich-lane.ts`(보강 전용 레인)로 이동했다 — 수집 인보케이션의 서브리퀘스트를
//   발굴이 먼저 다 써서 **한 건도 못 돌던 것**이 라이브 실측으로 확인됐기 때문(그 파일 헤더 참조).

export async function readSetting(DB: D1Database, key: string): Promise<string | null> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(key).first<{ value: string }>().catch(() => null)
  const v = row?.value
  return v === undefined || v === null || v === '' ? null : String(v)
}
export async function writeSetting(DB: D1Database, key: string, value: string): Promise<void> {
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
  // 🌵 2026-07-29 고갈 카운터 — **연속** 무수확 횟수. `last_saved`(직전 1회)만으로는 "한때 잘 물었지만
  //   이제 다 훑은" 키워드를 구분할 수 없다. 실측: 유튜브가 `found 5 → saved 0` 인데 쿼터는 39/90만 씀 —
  //   `saved_total` 이 큰 옛 성공 키워드가 점수 상위를 계속 차지해 **이미 수확한 채널을 재방문**하고 있었다.
  //   (기존 은퇴 조건은 `saved_total = 0` 이라 이 부류를 영원히 못 걸러낸다.)
  await DB.prepare('ALTER TABLE ad_discovery_keywords ADD COLUMN barren_streak INTEGER NOT NULL DEFAULT 0').run().catch(() => null)
  // 시드(일반 ~90 + 지역그리드 100 + 방배 11) — 개별 INSERT 대신 1 batch (Free 한도 절약). 멱등 INSERT OR IGNORE.
  const stmts = [...SEED, ...REGION_SEED, ...BANGBAE_SEED].flatMap(g => g.keywords.map(kw =>
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
// 🛡️ 2026-07-23 전수조사(F-29/30): 범용/참여유도/캠페인 태그는 검색 키워드로 무의미한데 승격되면 하루 100회뿐인
//   YT 검색 슬롯(신규 키워드 탐색 보장)을 확정 소모 — 스톱리스트로 후보 진입 자체를 차단.
const HASHTAG_STOP = new Set(['shorts', 'shortsvideo', '쇼츠', '구독', '구독자', '좋아요', '일상', '브이로그', 'vlog', '맞팔', '맞팔환영', '소통', '팔로우', '팔로워', 'follow', 'followme', 'fyp', 'viral', '추천', '추천영상', '광고', '협찬', '내돈내산', '이벤트', '유튜브', 'youtube', '유튜버', '인스타', '인스타그램', 'instagram', '데일리', 'daily', '선팔', '좋테', '구취', '알고리즘', 'subscribe', 'like'])
function mineHashtags(text: string): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  HASHTAG_RE.lastIndex = 0
  while ((m = HASHTAG_RE.exec(text)) !== null) {
    const t = m[1]
    if (/^\d+$/.test(t)) continue // 순수 숫자 제외
    if (HASHTAG_STOP.has(t.toLowerCase())) continue // 범용/참여유도 태그 제외
    out.push(t)
  }
  return out
}

// ── 🎯 YT 검색 슬롯 성과 가중 선택 → `influencer-keyword-rotation.ts` 로 분리(600줄 래칫).
//   기존 import 경로 호환을 위해 그대로 재수출한다(테스트·호출부 무변경).
export { pickYtKeywords, ytCooldownMs, BARREN_COOLDOWN_STEP_MS, BARREN_COOLDOWN_MAX_MS, type YtPickKeyword } from './influencer-keyword-rotation'
import { pickYtKeywords, type YtPickKeyword } from './influencer-keyword-rotation'

// ── 📅 YT 쿼터 하루 경계 — 구글 쿼터는 태평양 자정(한국 오후 4~5시) 리셋. 카운터 키에 사용. ──
// ⚠️ 쿼터 경제(2026-07-27 "평균 0회 대부분" 실사고): search.list 1회=100 units → 검색 100회=일일 쿼터(10,000) 전부
//   → 성과측정(각 1 unit)이 하루 종일 403. 검색 90회로 낮춰 측정용 ~1,000 units/day 예약(~750채널/일 측정 여력).
//   env ADS_YT_SEARCH_BUDGET 로 조정(100 으로 되돌리면 측정 굶음 — ads-yt-scheduling.test 불변식이 차단).
export const YT_SEARCH_BUDGET_DEFAULT = 90
export function ytQuotaDayKey(nowMs: number): string {
  return new Date(nowMs).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) // YYYY-MM-DD
}
const YT_USED_KEY = 'ads_yt_search_used' // 값 형식 "YYYY-MM-DD:count" — 날짜 바뀌면 자동 0부터

/**
 * 한 번의 자동 수집 실행(cron 1틱 또는 수동). 게이트 체크는 호출부에서.
 *   활성 키워드를 커서로 batch 개 순환 → YouTube+네이버 발굴 → 공용 풀 저장(카테고리 태그).
 *   수집물의 #해시태그를 후보 적립 → 반복 등장 시 자동 활성화(자가성장). 전부 fail-soft.
 */
// 🔒 lease 키/TTL 은 collect-lease.ts 가 SSOT — 메인 워커 어드민도 같은 키로 '진행 중'을 읽는다
//   (그쪽이 이 파일을 import 하면 수집 엔진이 메인 번들에 통째로 실림 → 키만 분리).
const LEASE_KEY = COLLECT_LEASE_KEY
const LEASE_TTL_MS = COLLECT_LEASE_TTL_MS

/** 크래시 경로에서도 필요한 값들(래퍼가 catch 에서 읽는다) — 정해지는 즉시 채운다. */
interface CollectCtx { budgetTotal: number; learnedCap: number; envBudget: number; budget?: FetchBudget; release?: () => Promise<void> }

/**
 * 🛡️ 2026-07-28 **자가 회복 래퍼** — 라이브에서 인플루언서 수집이 15:01 이후 매시간 조용히 죽고 있었다
 *   (다른 레인은 17:01 정상 실행 = cron 은 살아 있었다). 죽으면 아무 기록도 안 남아 원인을 알 수 없었고,
 *   더 나쁜 건 **학습 상한을 낮추는 코드(`nextSubreqCap` 쓰기)가 발굴 루프 *뒤*에 있어** 도중에 죽으면
 *   상한이 그대로 → 다음 틱도 같은 지점에서 죽는 **영구 루프**였다는 것이다.
 *
 *   ⇒ ① 예외를 잡아 **crash 원문을 스냅샷에 남긴다**(옛 성공 스냅샷은 보존 — 마지막 성공 시각도 필요하다)
 *     ② 한도 신호면 **그 자리에서 학습 상한을 낮춘다**(다음 틱은 적게 쓰고 통과 = 자가 회복)
 *     ③ lease 를 즉시 해제한다(TTL 5분 백스톱에 의존하지 않음).
 *   파트너풀 보강 레인(`recordEnrichCrash`)과 같은 철학 — 무증거 종료 금지.
 */
export async function runInfluencerAutoCollect(env: Env): Promise<AutoCollectStats> {
  const ctx: CollectCtx = { budgetTotal: 0, learnedCap: 0, envBudget: 0 }
  try {
    return await _runAutoCollect(env, ctx)
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    const crash = `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}`
    const spent = ctx.budget ? Math.max(0, ctx.budgetTotal - ctx.budget.left) : 0
    // ② 한도 신호 → 상한 하향(이번에 쓴 양보다 확실히 아래로). 여기서 안 낮추면 다음 틱도 같은 곳에서 죽는다.
    if (isSubrequestLimitError(crash) && spent > 0) {
      // `spent` 는 위에서 `ctx.budgetTotal - ctx.budget.left`(시작값 기준 실사용)로 계산 — 가드가 요구하는
      //   형태와 값이 같지만 예산 변수가 클로저 밖(ctx)이라 그 리터럴을 못 쓴다.
      const next = nextSubreqCap(spent, true, ctx.learnedCap, ctx.envBudget) // subreq-cap-lane-ok
      if (next != null) await writeSetting(env.DB, subreqCapKey('influencer'), String(next)).catch(() => undefined)
    }
    // ① 증거 — 옛 스냅샷 위에 crash 만 덧씌운다(마지막 성공 시각·누적치 보존).
    const prev = await getAutoCollectStats(env.DB).catch(() => null)
    const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const snap = { ...(prev || { last_run: '', last_saved: 0, last_keywords: [], total_runs: 0, total_saved: 0, cursor: 0 }),
      crash, crash_at: stamp, crash_spent: spent, crash_budget: ctx.budgetTotal } as AutoCollectStats
    await writeSetting(env.DB, STATS_KEY, JSON.stringify(snap)).catch(() => undefined)
    await ctx.release?.().catch(() => undefined) // ③ 즉시 해제
    return snap
  }
}

async function _runAutoCollect(env: Env, ctx: CollectCtx): Promise<AutoCollectStats> {
  const DB = env.DB
  // 🔒 실행 단일화 lease(2026-07-23 전수조사 #1~#3·#11) — 매시간 cron·수동 버튼·self-chain 이 **동시에** 돌면
  //   YT 예산 카운터(ads_yt_search_used)·키워드 커서가 read-modify-write 레이스로 소실 갱신 → 같은 키워드 중복
  //   검색으로 하루 예산(100회)의 절반까지 낭비 + QUOTA 소진 마커가 늦은 쓰기에 덮여 실패 호출 반복.
  //   platform_settings 의 만료시각 CAS(단일 UPDATE = D1 원자)로 한 번에 하나만 실행 — busy 면 아무것도 안 만지고
  //   반환(체인은 yt_budget 부재 → done, cron 은 다음 틱, 수동은 진행 중인 실행이 대신 수집).
  await DB.prepare('CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)').run().catch(() => null)
  await DB.prepare(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('${LEASE_KEY}', '0')`).run().catch(() => null)
  const nowMs = Date.now()
  const leaseR = await DB.prepare(`UPDATE platform_settings SET value = ? WHERE key = '${LEASE_KEY}' AND CAST(value AS INTEGER) < ?`)
    .bind(String(nowMs + LEASE_TTL_MS), nowMs).run().catch(() => null)
  if (!leaseR?.meta?.changes) {
    const prevStats = await getAutoCollectStats(DB)
    return { last_run: '', last_saved: 0, last_keywords: [], total_runs: prevStats?.total_runs || 0, total_saved: prevStats?.total_saved || 0, cursor: prevStats?.cursor || 0, busy: true }
  }
  const releaseLease = async () => { await DB.prepare(`UPDATE platform_settings SET value = '0' WHERE key = '${LEASE_KEY}'`).run().catch(() => null) }
  ctx.release = releaseLease
  await ensureInfluencerSchema(DB) // 리드 테이블/컬럼 보장(신규 DB 안전 — saveLeadsBatch 는 ensure 안 함)
  await ensureQualityColumns(DB)   // is_brand(저장 시점 태깅)·lead_score 컬럼 — INSERT 가 참조하므로 선보강
  await ensurePerfExtraColumns(DB) // last_post_at(블로거 마지막 글 날짜) — INSERT/백필이 참조
  await ensureDiscoveryKeywords(DB)
  // 💤 자동확장 키워드 회수(F-30) — 활성 이틀+ 인데 성과 0 인 auto 키워드 비활성(탐색 슬롯 영구 점유 차단, 멱등).
  await DB.prepare("UPDATE ad_discovery_keywords SET active = 0 WHERE source = 'auto' AND active = 1 AND saved_total = 0 AND last_run_at IS NOT NULL AND last_run_at <= datetime('now','-2 days')").run().catch(() => null)
  // 🌵 **고갈** 회수(2026-07-29) — 위 조건은 `saved_total = 0`(한 번도 못 문 키워드)만 잡아서, *예전엔 잘 물었지만
  //   지금은 다 훑은* auto 키워드를 영원히 놓친다. 연속 무수확 8회+면 비활성(성과가 있었어도 지금은 고갈).
  //   ⚠️ seed 키워드는 비활성화하지 않는다 — 대표가 고른 지역/업종 축이라 사라지면 커버리지에 구멍이 난다.
  //   대신 `ytCooldownMs` 가 간격을 최대 4일까지 벌려 슬롯 점유만 막는다(수확이 생기면 즉시 복귀).
  await DB.prepare("UPDATE ad_discovery_keywords SET active = 0 WHERE source = 'auto' AND active = 1 AND COALESCE(barren_streak, 0) >= 8").run().catch(() => null)
  const active = await DB.prepare('SELECT id, keyword, category, saved_total, last_saved, last_run_at, barren_streak FROM ad_discovery_keywords WHERE active = 1 ORDER BY id ASC')
    .all<YtPickKeyword>().catch(() => null)
  const kws = active?.results || []
  const prev = await getAutoCollectStats(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  if (!kws.length) {
    const empty: AutoCollectStats = { last_run: stamp, last_saved: 0, last_keywords: [], total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, cursor: 0 }
    await writeSetting(DB, STATS_KEY, JSON.stringify(empty))
    await releaseLease()
    return empty
  }

  // ⚠️ 2026-07-20 실사고: batch=12 × 행단위 INSERT 수백 건이 Workers Free 호출당 한도 초과 →
  //   241건 저장 후 중도 사망(통계 미기록, "수집 실패" 표시). 기본 4 로 축소 + 저장은 DB.batch(아래).
  //   커서 순환이라 커버리지는 며칠에 걸쳐 동일 — 1회 부하만 낮춤(매시간 cron 이라 총량은 큼).
  const batch = Math.min(kws.length, Math.max(1, parseInt(env.ADS_AUTOCOLLECT_BATCH || '', 10) || 4))

  // ⭐ 우선 카테고리 배정 — 배치의 ceil(3/4)은 우선 풀(맛집·푸드·외식창업·숙소·네일·뷰티, 별도 커서),
  //   나머지는 일반 풀 순환. 한쪽 풀이 모자라면 다른 쪽이 잔여 슬롯을 채움(총 batch 개 유지).
  const priPool = kws.filter(k => k.category && PRIORITY_CATEGORIES.includes(k.category))
  const genPool = kws.filter(k => !(k.category && PRIORITY_CATEGORIES.includes(k.category)))
  let priCursor = parseInt((await readSetting(DB, 'ads_autocollect_cursor_pri')) || '0', 10)
  if (!Number.isFinite(priCursor) || priCursor < 0) priCursor = 0
  let cursor = parseInt((await readSetting(DB, CURSOR_KEY)) || '0', 10)
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0
  // 🚀 "최대한 많이"(2026-07-20): 네이버 쿼터(25k/day)는 남아돌아 — YT 배정(batch)에 더해
  //   **네이버 전용 추가 키워드**(NAVER_EXTRA)를 같은 순환에서 더 돌림. YT 는 앞 batch 개만.
  //   2026-07-21: YT 검색 쿼터 확장이 어려워 네이버(실측 ~2% 활용)로 볼륨 이전 — 기본 4→12(틱당 네이버 총 batch+12).
  //   서브리퀘스트 예산(아래 300)이 실제 상한이라 초과분은 커서가 다음 틱에서 이어받음(커버리지 손실 0). 런어웨이 방지 max 40.
  const NAVER_EXTRA = Math.max(0, Math.min(40, parseInt(env.ADS_NAVER_EXTRA || '', 10) || 12))
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
  // 🎯 YT 슬롯(희소 자원 — Search Queries/day 기본 100회)은 성과 가중 선택으로 교체.
  //   커서 순환(picks)은 네이버 폭 커버 담당 그대로 — YT 픽과 중복만 제거해 총량(totalPick) 유지.
  const ytPicks = pickYtKeywords(kws, batch, Date.now())
  const ytIds = new Set(ytPicks.map(k => k.id))
  const finalPicks = [...ytPicks, ...picks.filter(p => !ytIds.has(p.id))].slice(0, totalPick)

  const hasYouTube = !!env.YOUTUBE_API_KEY
  const naverId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID
  const naverSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET
  const hasNaver = !!(naverId && naverSecret)
  // 🗑️ 티스토리 트랙 제거(2026-07-27 대표 "티스토리는 안할거야") — 기수집 리드는 보존, 신규 수집만 중단.
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
  // 🔒 서브리퀘스트 예산(2026-07-20 실사고) — 한 실행의 외부 fetch 상한. 소진 시 조기 종료(에러 아님),
  //   커서가 다음 틱에 이어받아 손실 0. 기본 300(env ADS_SUBREQUEST_BUDGET), 실제 한도는 관측 학습 → collect-budget.ts.
  const envBudget = Math.max(20, parseInt(env.ADS_SUBREQUEST_BUDGET || '', 10) || 300)
  const learnedCap = Math.max(0, parseInt((await readSetting(DB, subreqCapKey('influencer'))) || '', 10) || 0)
  const budgetTotal = resolveSubreqBudget(envBudget, learnedCap)
  const budget: FetchBudget = { left: budgetTotal }
  ctx.budgetTotal = budgetTotal; ctx.learnedCap = learnedCap; ctx.envBudget = envBudget; ctx.budget = budget
  // 🍽️ 2026-07-28: **이 실행은 발굴만 한다.** 보강(블로거 활동성·링크인바이오·YT 성과)은 전부
  //   `influencer-enrich-lane.ts` 의 독립 인보케이션(시간당 N라운드)으로 이전했다.
  //
  //   경위: 보강이 여기 얹혀 있던 동안 발굴 루프가 예산을 **0 까지** 먹어 보강 4종이 매 실행 즉시 반환했고
  //   (라이브: `naver_enrich.tried=0` · `bio_enriched=0` · `perf_enriched=0`), 예약분(`enrichReserve`)을 둬도
  //   **키워드 경계에서만** 검사해 한 키워드(최대 16)가 예약분을 뚫고 0 까지 파고들었다.
  //   ⇒ 예약분으로 지분을 나누는 대신 **레인을 분리**했다. 발굴은 예산 전부를 쓰고(처리량 원복),
  //   보강은 자기 인보케이션에서 자기 예산을 쓴다. 서로 굶기지 않는 유일한 구조.

  let saved = 0
  let quotaHit = false
  const used: string[] = []
  const kwStats = new Map<number, { found: number; saved: number }>() // 📊 키워드별 발굴/저장(성과 관측)
  const hashtagFreq = new Map<string, number>()
  const mine = (leads: { description: string; links: string | null; name: string }[]) => {
    // 🛡️ F-29: 출현 횟수가 아니라 **채널(리드) 단위**로 카운트(같은 소개글의 #맛집 #맛집 #맛집 이 3히트가 되던 것 차단)
    //   + 영상 제목 세그먼트 제거(제목 속 캠페인 태그가 키워드 후보로 새는 것 차단 — F-10).
    for (const l of leads) {
      const uniq = new Set(mineHashtags(`${stripVideoTitles(l.description)} ${l.links || ''} ${l.name}`))
      for (const t of uniq) hashtagFreq.set(t, (hashtagFreq.get(t) || 0) + 1)
    }
  }
  // 🔎 플랫폼별 진단 누적 — fail-soft 로 삼키더라도 *사유는 기록*해 어드민에서 0건 원인 확인 가능.
  const diag = {
    yt: { configured: hasYouTube, found: 0, saved: 0, error: undefined as string | undefined },
    naver: { configured: hasNaver, found: 0, saved: 0, error: undefined as string | undefined },
  }
  if (!hasYouTube) diag.yt.error = 'NOT_CONFIGURED: ur-ads 워커에 YOUTUBE_API_KEY 미설정'
  if (!hasNaver) diag.naver.error = 'NOT_CONFIGURED: ur-ads 워커에 NAVER_SEARCH_CLIENT_ID/SECRET 미설정'

  // YT 검색 페이지 수(키워드당 깊이). 쿼터는 quotaHit 가드가 관리.
  // 기본 1페이지(1~50위) — YT 일일 쿼터(기본 10k) 안에서 더 많은 키워드·지역 커버(시드 소싱은 깊이<폭).
  //   깊이가 더 필요하면 env ADS_YT_PAGES=2~5 로 상향(쿼터 여유/증액 시).
  const ytPages = Math.max(1, Math.min(5, parseInt(env.ADS_YT_PAGES || '', 10) || 1))
  let ytUsed = 0
  // 🎯 YT 검색 예산 카운터(실병목 Search Queries/day, 태평양 자정 리셋) — 자동+수동이 같은 예산 공유.
  //   소진 시 이번 틱 YT 스킵(네이버 계속) + 어드민에 "오늘 n/100" 노출. env ADS_YT_SEARCH_BUDGET 로 조정.
  const ytBudgetTotal = Math.max(1, Math.min(100000, parseInt(env.ADS_YT_SEARCH_BUDGET || '', 10) || YT_SEARCH_BUDGET_DEFAULT))
  const ytDay = ytQuotaDayKey(Date.now())
  let ytSearchUsed = 0
  {
    const raw = await readSetting(DB, YT_USED_KEY)
    if (raw) { const i = raw.indexOf(':'); if (i > 0 && raw.slice(0, i) === ytDay) ytSearchUsed = Math.max(0, parseInt(raw.slice(i + 1), 10) || 0) }
  }
  let ytBudgetBlocked = false
  const processedIds = new Set<number>() // 실제 처리된 키워드 id — 커서를 '처리한 만큼만' 전진(예산 소진 leapfrog 방지)
  for (const k of finalPicks) {
    if (budget.left <= 0) break // 🔒 예산 소진 — 이번 틱 종료(다음 틱 커서가 못 돈 키워드를 이어받음)
    used.push(k.keyword); processedIds.add(k.id)
    let kFound = 0, kSaved = 0 // 이 키워드의 이번 실행 발굴/저장
    // YT 는 배치 상한(batch)개 키워드만(쿼터 예산) — 나머지는 네이버 전용. maxResults 50 × pages 로 깊이 확장.
    if (hasYouTube && !quotaHit && ytUsed < batch && ytSearchUsed + ytPages > ytBudgetTotal) ytBudgetBlocked = true // 예산 소진 — YT 만 스킵(네이버 계속)
    if (hasYouTube && !quotaHit && ytUsed < batch && ytSearchUsed + ytPages <= ytBudgetTotal) {
      ytUsed++
      ytSearchUsed += ytPages // 검색 1페이지 = search.list 1회(예산 차감은 시도 기준 — 실패 호출도 구글이 카운트)
      try {
        const r = await discoverYouTubeInfluencers(env, k.keyword, { maxResults: 50, pages: ytPages, enrichMax: 8, budget, searchType: ytAngle.searchType, order: ytAngle.order })
        if (r.ok) {
          diag.yt.found += r.leads?.length || 0; kFound += r.leads?.length || 0
          if (r.leads?.length) { const s = await saveLeadsBatch(DB, POOL_ACCOUNT_ID, r.leads, { category: k.category, sourceKeyword: k.keyword }); saved += s; diag.yt.saved += s; kSaved += s; mine(r.leads) }
        } else {
          if (r.error === 'QUOTA') { quotaHit = true; ytSearchUsed = Math.max(ytSearchUsed, ytBudgetTotal) } // 구글이 초과 선언 → 카운터도 소진 처리(다음 틱 헛호출 방지)
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
      //   🚦 2026-07-29 게이트 신설(기본 ON = 현행 유지). 실측 근거: 카페 리드 100명 표본에서 **이메일 0명 ·
      //   연락처 1명**, 그리고 보강 경로가 아예 없다(`enrichNaverActivity` 는 platform='naver_blog' 만 본다).
      //   즉 카페는 **영원히 연락 불가**인데 키워드마다 서브리퀘스트를 쓴다 — 이 레인이 매시간
      //   `Too many subrequests` 로 죽고 활성 키워드 210개 중 124개가 이틀째 순번을 못 받는 상황에서,
      //   수확 가치 0 인 호출이 예산의 25~30% 를 먹는다. 끄면 그만큼 더 많은 키워드가 돈다.
      //   ⚠️ 기본값을 바꾸지 않는다(수집 정책은 대표 결정) — `ADS_COLLECT_CAFE_ENABLED='false'` 로 끈다.
      if ((env as unknown as { ADS_COLLECT_CAFE_ENABLED?: string }).ADS_COLLECT_CAFE_ENABLED !== 'false') try {
        const r = await discoverNaverCafes(naverId, naverSecret, k.keyword, { display: 50, budget, sort: naverSort })
        if (r.ok && r.leads?.length) { const s = await saveLeadsBatch(DB, POOL_ACCOUNT_ID, r.leads, { category: k.category, sourceKeyword: k.keyword }); saved += s; diag.naver.found += r.leads.length; diag.naver.saved += s; kFound += r.leads.length; kSaved += s; mine(r.leads) }
      } catch { /* fail-soft */ }
    }
    const prevK = kwStats.get(k.id) // 같은 키가 한 실행에 중복되어도 누적
    kwStats.set(k.id, { found: (prevK?.found || 0) + kFound, saved: (prevK?.saved || 0) + kSaved })
  }
  // 🩹 서브리퀘스트 한도 자가 교정(collect-budget) — 부딪혔으면 낮추고, 다 쓰고도 무사하면 조금 올린다.
  const hitLimit = isSubrequestLimitError(diag.yt.error) || isSubrequestLimitError(diag.naver.error)
  const nextCap = nextSubreqCap(budgetTotal - budget.left, hitLimit, learnedCap, envBudget)
  if (nextCap != null) await writeSetting(DB, subreqCapKey('influencer'), String(nextCap))
  // 📊 키워드별 성과 누적 저장(1 batch) — 어드민 키워드 칩에서 "어느 지역 키워드가 잘 무는지" 확인.
  if (kwStats.size) {
    await DB.batch(Array.from(kwStats.entries()).map(([id, v]) =>
      // 🌵 무수확이면 연속 카운터 +1, 한 명이라도 건지면 0 으로 리셋(고갈 판정의 유일한 근거).
      DB.prepare(`UPDATE ad_discovery_keywords SET found_total = found_total + ?, saved_total = saved_total + ?, last_saved = ?,
        barren_streak = CASE WHEN ? > 0 THEN 0 ELSE COALESCE(barren_streak, 0) + 1 END, last_run_at = datetime('now') WHERE id = ?`)
        .bind(v.found, v.saved, v.saved, v.saved, id))).catch(() => null)
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

  // 📍 지역 백필 — DB 전용(외부 호출 0)이라 예산·수확에 영향 없음. fail-soft.
  try { await backfillRegions(DB, POOL_ACCOUNT_ID) } catch { /* 다음 틱이 이어받음 */ }

  // 두 커서 각각 전진(우선/일반 풀 독립 순환) — 처리된 **연속 접두 길이**만큼만 전진(멤버십 카운트 아님).
  //   ⚠️ ytPicks(성과가중)가 커서 앞선 키워드를 처리하면 filter 카운트는 그 '중간' 처리를 세어 갭을 건너뛴다
  //   (leapfrog). prefix 방식은 앞에서 처리 안 된 키워드가 나오면 멈춰, 못 돈 키워드를 다음 틱이 정확히 이어받음.
  const prefixDone = (ps: { id: number }[]) => { let n = 0; for (const p of ps) { if (processedIds.has(p.id)) n++; else break } return n }
  const priDone = prefixDone(priPicks)
  const genDone = prefixDone(genPicks)
  const nextPriCursor = priPool.length ? (priCursor + priDone) % priPool.length : 0
  const nextCursor = genPool.length ? (cursor + genDone) % genPool.length : 0
  // 🎯 YT 예산 소진으로 스킵됐고 다른 에러가 없으면 사유 노출(QUOTA 프리픽스 = 기존 배너 스타일 재사용).
  if (ytBudgetBlocked && !diag.yt.error) diag.yt.error = `QUOTA: 오늘 YT 검색 예산(${ytBudgetTotal}회) 소진 — 쿼터 리셋(한국 오후 4~5시) 후 자동 재개`
  const stats: AutoCollectStats = {
    last_run: stamp, last_saved: saved, last_keywords: used,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved,
    cursor: nextCursor, pri_cursor: nextPriCursor, promoted, youtube_quota_hit: quotaHit, diag,
    yt_budget: { used: ytSearchUsed, total: ytBudgetTotal, day: ytDay },
    // 🔒 예산 실사용/상한/한도관측 — 정상 실행에도 남긴다(위 필드 주석 참조).
    spent: budgetTotal - budget.left, budget_total: budgetTotal, learned_cap: learnedCap, limit_hit: hitLimit,
    // ✅ 성공했으면 옛 crash 표식을 남기지 않는다(회복 후에도 빨간 줄이 남으면 다음 사람이 오진한다).
  }
  await writeSetting(DB, YT_USED_KEY, `${ytDay}:${ytSearchUsed}`)
  await writeSetting(DB, 'ads_autocollect_cursor_pri', String(nextPriCursor))
  await writeSetting(DB, CURSOR_KEY, String(nextCursor))
  await writeSetting(DB, STATS_KEY, JSON.stringify(stats))
  await releaseLease() // 🔒 상태 기록 후 해제(다음 실행이 최신 카운터/커서를 읽게) — 크래시 시 TTL 5분이 백스톱
  try { await maybeAlertCollectHealth(env, DB, { diag, saved, quotaHit }) } catch { /* fail-soft */ }
  return stats
}
