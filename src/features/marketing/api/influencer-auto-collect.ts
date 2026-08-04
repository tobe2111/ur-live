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
// 💾 저장(필터·2패스 upsert·백필)은 `influencer-save.ts` 로 분리(600줄 캡) — 호출부 호환 위해 재수출.
export { MIN_YT_SUBSCRIBERS } from './influencer-save'
import { saveLeadsBatch } from './influencer-save'
import { discoverYouTubeInfluencers, discoverNaverBloggers, discoverNaverCafes, discoverTistoryBloggers, ensureInfluencerSchema, stripVideoTitles, type FetchBudget } from './influencer-discovery'
import { ensureQualityColumns } from './influencer-quality'
import { ensurePerfExtraColumns, type NaverEnrichDiag } from './influencer-performance'
import { COLLECT_LEASE_KEY, COLLECT_LEASE_TTL_MS, acquireLeaseDetect } from './collect-lease'
import { subreqCapKey, isSubrequestLimitError, resolveSubreqBudget, nextSubreqCap, envSubreqCap, capAfterAbandonedRun, envLaneBudget } from './collect-budget'
import { makeAlreadyContacted } from './influencer-known-contacts'
import { maybeAlertCollectHealth } from './collect-health-alert'

/** 공용 풀 계정 id — 실제 ad_accounts.id 는 1부터라 0 은 시스템 풀 전용 센티넬(충돌 없음). */
export const POOL_ACCOUNT_ID = 0

// 🌱 자동확장 상한/승격 자리 계산은 `influencer-keyword-rotation.ts` SSOT(아래 재수출) — 이 브랜치도
//   같은 버그(seed 가 auto 를 밀어냄)를 독립적으로 고쳤으나 순수함수+관측을 갖춘 main 판을 채택했다.
export { AUTO_PROMOTE_HITS } from './influencer-keyword-promote' // 호출부 호환 재수출
import { promoteHashtagKeywords } from './influencer-keyword-promote'
// 🪦 은퇴 축 — 접은 카테고리의 키워드가 수집 슬롯을 계속 먹지 않게(선언은 그 파일 한 곳).
import { RETIRED_CATEGORIES } from './influencer-classify'

// ⭐ 우선 카테고리(대표 2026-07-20 "맛집·숙소·네일·뷰티 최우선") — 유어딜 연관(동네딜·매장·외식/자영업 결,
//   홍석천·이원일 류). 매 배치의 3/4 를 이 풀에 배정(별도 커서 순환), 나머지 1/4 이 전체 일반 순환.
//   SSOT 는 `influencer-keyword-rotation.ts`(선택 점수도 이 목록을 쓴다) — 두 벌로 두면 조용히 갈라진다.
export { PRIORITY_CATEGORIES } from './influencer-keyword-rotation'
import { PRIORITY_CATEGORIES, FOCUS_CATEGORIES, planKeywordSplit, interleavePicks, isUnjudgedRound, mergeKeywordPicks, NAVER_COLLECT_ENRICH_MAX, keywordsPerRoundCap } from './influencer-keyword-rotation'

// 🌱 시드 키워드(데이터)는 `influencer-seed-keywords.ts`, 그 시드를 테이블에 넣는 일은
//   `influencer-keyword-store.ts` — 이 파일은 **둘 다 직접 안 만진다**(아래 재수출만).

// 📊 결과 타입은 `influencer-collect-types.ts` 로 분리(600줄 캡) — 호출부 호환 위해 재수출.
export type { DiscoveryKeyword, AutoCollectStats } from './influencer-collect-types'
import type { AutoCollectStats, DiscoveryKeyword } from './influencer-collect-types'

const CURSOR_KEY = 'ads_autocollect_cursor'
/**
 * 🎯 집중 축(마케팅대행사) 커서 — **읽기와 쓰기가 같은 문자열을 봐야 한다**.
 *   2026-08-03 라이브 실측: 이 키를 리터럴로 두 곳(읽기·통계)에 흩어 놨더니 **쓰기가 아예 없었고**
 *   읽기는 배치 목록에 없어 항상 `undefined` 였다 → 커서 영구 0 → 대행사 키워드 18개 중 앞 4개만
 *   무한 반복(뒤 14개는 `found_total = 0`, `last_run_at = null`). 상수로 묶어 갈라지지 않게 한다.
 */
const FOCUS_CURSOR_KEY = 'ads_autocollect_cursor_focus'
const STATS_KEY = 'ads_autocollect_stats'



// 🔗 링크인바이오 백필(enrichPoolFromLinkInBio) · 📝 블로거 활동성 보강은 2026-07-28 에
//   `influencer-enrich-lane.ts`(보강 전용 레인)로 이동했다 — 수집 인보케이션의 서브리퀘스트를
//   발굴이 먼저 다 써서 **한 건도 못 돌던 것**이 라이브 실측으로 확인됐기 때문(그 파일 헤더 참조).

// ⚙️ 설정 읽기/쓰기(배치 포함)는 `influencer-settings.ts` — 기존 import 경로 호환 위해 재수출.
export { readSetting, readSettings, writeSetting, writeSettings } from './influencer-settings'
import { readSetting, readSettings, writeSetting, writeSettings } from './influencer-settings'
import { NAVER_USED_KEY, kstDayKey, parseNaverUsed, takeNaverCalls, NAVER_DAILY_QUOTA_CALLS } from './naver-api-usage'

// 🗂️ 키워드 테이블의 수명주기(스키마·시드·목록·추가/토글)는 `influencer-keyword-store.ts` — 호출부 호환 재수출.
//   ⚠️ 2026-08-04: 그 분리(2026-07-29)가 **병합으로 되돌아와** 두 파일에 byte-동일한 정의가 둘 있었고,
//     추출본은 아무도 import 하지 않는 죽은 코드였다. 한쪽만 고치면 `runDdlOnce` 체크섬이 매 인보케이션
//     엇갈려 **DDL+시드 200문장이 영원히 재실행**된다(그 재실행을 없애려던 최적화가 통째로 뒤집힌다).
export { ensureDiscoveryKeywords, listDiscoveryKeywords, addDiscoveryKeyword, setKeywordActive } from './influencer-keyword-store'
import { ensureDiscoveryKeywords } from './influencer-keyword-store'

export async function getAutoCollectStats(DB: D1Database): Promise<AutoCollectStats | null> {
  const raw = await readSetting(DB, STATS_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as AutoCollectStats } catch { return null }
}

// 🏷️ 해시태그 후보 추출 → `influencer-hashtag-mine.ts` 로 분리(600줄 래칫). 순수 로직이라 이 파일에 있을 이유가 없다.

// ── 🎯 YT 슬롯 선택 · 🌱 키워드 승격 자리 → `influencer-keyword-rotation.ts`(600줄 래칫으로 분리).
//   기존 import 경로 호환을 위해 그대로 재수출한다(테스트·호출부 무변경).
export { pickYtKeywords, ytCooldownMs, BARREN_COOLDOWN_STEP_MS, BARREN_COOLDOWN_MAX_MS, type YtPickKeyword, MAX_AUTO_KEYWORDS, autoPromotionRoom } from './influencer-keyword-rotation'
import { pickYtKeywords, type YtPickKeyword } from './influencer-keyword-rotation'
import { mineHashtags } from './influencer-hashtag-mine'

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
      const next = nextSubreqCap(spent, true, ctx.learnedCap, ctx.envBudget, envSubreqCap(env)) // subreq-cap-lane-ok
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
  // 🪦 획득 + **직전 회차 유기 판정**은 `acquireLeaseDetect`(collect-lease SSOT) — 죽은 회차가 남기는
  //   유일한 흔적(반납 안 된 lease)을 읽는다. 처방은 `capAfterAbandonedRun` docblock 참조.
  const { acquired, abandoned: abandonedPrev } = await acquireLeaseDetect(DB, LEASE_KEY, LEASE_TTL_MS)
  if (!acquired) {
    const prevStats = await getAutoCollectStats(DB)
    return { last_run: '', last_saved: 0, last_keywords: [], total_runs: prevStats?.total_runs || 0, total_saved: prevStats?.total_saved || 0, cursor: prevStats?.cursor || 0, busy: true }
  }
  const releaseLease = async () => { await DB.prepare(`UPDATE platform_settings SET value = '0' WHERE key = '${LEASE_KEY}'`).run().catch(() => null) }
  ctx.release = releaseLease
  await ensureInfluencerSchema(DB) // 리드 테이블/컬럼 보장(신규 DB 안전 — saveLeadsBatch 는 ensure 안 함)
  await ensureQualityColumns(DB)   // is_brand(저장 시점 태깅)·lead_score 컬럼 — INSERT 가 참조하므로 선보강
  await ensurePerfExtraColumns(DB) // last_post_at(블로거 마지막 글 날짜) — INSERT/백필이 참조
  await ensureDiscoveryKeywords(DB)
  // 💤 자동확장 키워드 회수 2종 — 1 batch(=1 서브리퀘스트)로 묶는다(2026-07-29 예산 절약).
  await DB.batch([
    // (F-30) 활성 이틀+ 인데 성과 0 인 auto 키워드 비활성(탐색 슬롯 영구 점유 차단, 멱등).
    DB.prepare("UPDATE ad_discovery_keywords SET active = 0 WHERE source = 'auto' AND active = 1 AND saved_total = 0 AND last_run_at IS NOT NULL AND last_run_at <= datetime('now','-2 days')"),
    // 🌵 **고갈** 회수(2026-07-29) — 위 조건은 `saved_total = 0`(한 번도 못 문 키워드)만 잡아서, *예전엔 잘 물었지만
    //   지금은 다 훑은* auto 키워드를 영원히 놓친다. 연속 무수확 8회+면 비활성(성과가 있었어도 지금은 고갈).
    //   ⚠️ seed 키워드는 비활성화하지 않는다 — 대표가 고른 지역/업종 축이라 사라지면 커버리지에 구멍이 난다.
    //   대신 `ytCooldownMs` 가 간격을 최대 4일까지 벌려 슬롯 점유만 막는다(수확이 생기면 즉시 복귀).
    DB.prepare("UPDATE ad_discovery_keywords SET active = 0 WHERE source = 'auto' AND active = 1 AND COALESCE(barren_streak, 0) >= 8"),
  ]).catch(() => null)
  const active = await DB.prepare('SELECT id, keyword, category, source, saved_total, last_saved, last_run_at, barren_streak, found_total FROM ad_discovery_keywords WHERE active = 1 ORDER BY id ASC')
    .all<YtPickKeyword>().catch(() => null)
  /**
   * 🪦 은퇴 축 키워드는 **슬롯을 안 먹는다**(2026-08-03). 축을 접었는데 그 키워드가 계속 돌면
   *   희소한 회차(시간당 1회 · 16픽)를 죽은 축에 낭비한다. 선언은 `RETIRED_CATEGORIES` 한 곳.
   *   ⚠️ 행을 지우거나 `active=0` 으로 쓰지 않는다 — 되돌릴 때 다시 켜야 하고, 성과 이력(found/saved)도
   *   보존해야 한다. **선택에서만 빼는** 것이 가역적이다.
   */
  const kws = (active?.results || []).filter(k => !k.category || !RETIRED_CATEGORIES.has(k.category))
  // 🧮 이 실행이 쓰는 설정을 **한 번에** 읽는다(2026-07-29) — 통계·커서3·학습상한·YT카운터를 낱개로 읽으면
  //   읽기에만 5 서브리퀘스트, 그만큼 발굴 fetch 가 줄어든다(D1 도 한도에 포함, #784).
  //   ⚠️ **여기 없는 키를 `settings[...]` 로 읽으면 값이 아니라 `undefined` 가 온다** — 에러가 아니라
  //   기본값으로 조용히 떨어진다. 집중 축 커서가 정확히 그래서 항상 0 이었다(#930 → 2026-08-03 수리).
  //   새 키를 읽기 전에 이 배열에 넣을 것. `ads-keyword-focus-split` 이 기계로 대조한다.
  const SETTING_KEYS = [STATS_KEY, FOCUS_CURSOR_KEY, 'ads_autocollect_cursor_pri', CURSOR_KEY, subreqCapKey('influencer'), YT_USED_KEY, NAVER_USED_KEY]
  const settings = await readSettings(DB, SETTING_KEYS)
  let prev: AutoCollectStats | null = null
  try { prev = settings[STATS_KEY] ? JSON.parse(settings[STATS_KEY] as string) as AutoCollectStats : null } catch { prev = null }
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
  // 🎯 집중 축(마케팅대행사) 전용 풀 — 우선/일반보다 **앞에서** 뗀다. 근거는 `FOCUS_CATEGORIES` 주석.
  //   ⚠️ 세 풀은 서로 배타여야 한다 — 겹치면 같은 키워드가 한 배치에 두 번 들어간다.
  const inFocus = (k: { category: string | null }) => !!k.category && FOCUS_CATEGORIES.includes(k.category)
  const focusPool = kws.filter(inFocus)
  const priPool = kws.filter(k => !inFocus(k) && k.category && PRIORITY_CATEGORIES.includes(k.category))
  const genPool = kws.filter(k => !inFocus(k) && !(k.category && PRIORITY_CATEGORIES.includes(k.category)))
  let priCursor = parseInt(settings['ads_autocollect_cursor_pri'] || '0', 10)
  if (!Number.isFinite(priCursor) || priCursor < 0) priCursor = 0
  let focusCursor = parseInt(settings[FOCUS_CURSOR_KEY] || '0', 10)
  if (!Number.isFinite(focusCursor) || focusCursor < 0) focusCursor = 0
  let cursor = parseInt(settings[CURSOR_KEY] || '0', 10)
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0
  // 🚀 "최대한 많이"(2026-07-20): 네이버 쿼터(25k/day)는 남아돌아 — YT 배정(batch)에 더해
  //   **네이버 전용 추가 키워드**(NAVER_EXTRA)를 같은 순환에서 더 돌림. YT 는 앞 batch 개만.
  //   2026-07-21: YT 검색 쿼터 확장이 어려워 네이버(실측 ~2% 활용)로 볼륨 이전 — 기본 4→12(틱당 네이버 총 batch+12).
  //   서브리퀘스트 예산(아래 300)이 실제 상한이라 초과분은 커서가 다음 틱에서 이어받음(커버리지 손실 0). 런어웨이 방지 max 40.
  const NAVER_EXTRA = Math.max(0, Math.min(40, parseInt(env.ADS_NAVER_EXTRA || '', 10) || 12))
  const totalPick = batch + NAVER_EXTRA
  // 🎯 [집중 · 우선 · 일반] 3분할 — 배분 규칙은 순수함수 SSOT(`planKeywordSplit`).
  //   집중 축이 비면(고갈로 자동 비활성) 그 몫이 **자동으로** 우선/일반에 돌아간다 — 그게 이 설계의 핵심이다.
  const { nFocus, nPri, nGen } = planKeywordSplit(totalPick, focusPool.length, priPool.length, genPool.length)
  const focusPicks: { id: number; keyword: string; category: string | null }[] = []
  const priPicks: { id: number; keyword: string; category: string | null }[] = []
  const genPicks: { id: number; keyword: string; category: string | null }[] = []
  for (let i = 0; i < nFocus; i++) focusPicks.push(focusPool[(focusCursor + i) % focusPool.length])
  for (let i = 0; i < nPri; i++) priPicks.push(priPool[(priCursor + i) % priPool.length])
  for (let i = 0; i < nGen; i++) genPicks.push(genPool[(cursor + i) % genPool.length])
  // 🔀 세 풀 라운드로빈 — 몫은 planKeywordSplit 그대로, 순서만 공평하게(근거·실측은 함수 docblock).
  const picks = mergeKeywordPicks(focusPicks, priPicks, genPicks)
  // 🎯 YT 슬롯(희소 자원 — Search Queries/day 기본 100회)은 성과 가중 선택으로 교체.
  //   커서 순환(picks)은 네이버 폭 커버 담당 그대로 — YT 픽과 중복만 제거해 총량(totalPick) 유지.
  const ytPicks = pickYtKeywords(kws, batch, Date.now())
  const ytIds = new Set(ytPicks.map(k => k.id))
  // 🔀 번갈아 배치 — 꼬리의 커서 픽이 영영 안 돌던 것(실측 `from_cursor: 0`). 근거는 `interleavePicks` docblock.
  const finalPicks = interleavePicks(ytPicks, picks.filter(p => !ytIds.has(p.id)), totalPick)

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
  const envBudget = Math.max(20, envLaneBudget(env.ADS_SUBREQUEST_BUDGET, 300, env))
  // 🔀 병합: 읽기는 이 브랜치의 배치(readSettings — 낱개 5회 → 1회), 천장은 main(#837).
  const storedCap = Math.max(0, parseInt(settings[subreqCapKey('influencer')] || '', 10) || 0)
  // 🪦 직전 회차가 lease 를 반납 못 하고 죽었으면 **이번 회차부터 즉시** 덜 쓴다(다음 회차가 아니라).
  //   죽은 회차는 상한을 못 낮추므로, 낮추는 일은 살아남은 쪽이 대신 해야 한다.
  const learnedCap = abandonedPrev ? capAfterAbandonedRun(storedCap, envBudget, envSubreqCap(env)) : storedCap
  // 🧱 플랫폼 천장 — 학습 상한이 이 값을 넘지 못한다(기본 60, 근거·조정법은 collect-budget 주석).
  const pcap = envSubreqCap(env)
  /**
   * 🧾 **마감 기록용 예산 예약**(2026-07-29) — 이 레인이 자기가 한 일을 기록하지 못하던 근본 원인.
   *   증거(라이브 08:00): 블로거 **163명을 실제로 저장**했는데 `run.last_run` 은 05:00 에 멈춰 있고
   *   `ads:collect` 하트비트도 없었다. 저장은 루프 안(예산 안)이고 **마감 기록은 예산을 다 쓴 뒤**인데,
   *   커서·통계·키워드성과·학습상한은 전부 D1 쓰기 = 서브리퀘스트다. `spent === budget_total`(실측 55/55)
   *   인 회차는 마감이 **구조적으로 실패**한다. ⚠️ 관측만의 문제가 아니다 — 커서가 안 밀려 다음 회차가
   *   같은 키워드를 다시 돌고, 학습상한도 영영 갱신되지 않는다("안 돌았다"가 아니라 "못 남겼다"였다).
   *   마감 쓰기: 학습상한 1 · 키워드성과 batch 1 · 커서/통계 batch 1 · 경보 조회 1 → 4 를 뗀다.
   */
  const BOOKKEEPING_RESERVE = 4
  const budgetTotal = Math.max(5, resolveSubreqBudget(envBudget, learnedCap, pcap) - BOOKKEEPING_RESERVE)
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
  const starvedIds = new Set<number>() // 🌵 예산 고갈/한도 오류로 '공정한 시도'가 못 된 키워드(무판정 대상)
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
  const hasKakao = !!(env as unknown as { KAKAO_REST_API_KEY?: string }).KAKAO_REST_API_KEY
  const diag = {
    yt: { configured: hasYouTube, found: 0, saved: 0, error: undefined as string | undefined },
    naver: { configured: hasNaver, found: 0, saved: 0, error: undefined as string | undefined },
    tistory: { configured: hasKakao, found: 0, saved: 0, error: undefined as string | undefined },
    // 🏘️ 카페는 블로그와 **따로** 센다 — 합산돼 있으면 "카페를 끌 가치가 있나"를 숫자로 답할 수 없다
    //   (라이브 표본 200건: 연락 가능 2건). 판정 근거는 `influencer-collect-types` 의 docblock.
    cafe: { found: 0, saved: 0 },
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
    const raw = settings[YT_USED_KEY]
    if (raw) { const i = raw.indexOf(':'); if (i > 0 && raw.slice(0, i) === ytDay) ytSearchUsed = Math.max(0, parseInt(raw.slice(i + 1), 10) || 0) }
  }
  let ytBudgetBlocked = false
  /**
   * 🧾 **소스별 서브리퀘스트 실사용 계측** (2026-08-04 — 커버리지 경보 후속).
   *
   *   회차가 `planned 16 → processed 5`(예산 56 소진)인데 **어디에 쓰이는지 아무도 몰랐다.**
   *   가장 유력한 용의자는 발굴 시점 `enrichMax`(YT 8 · 네이버 5 = 키워드당 최대 13)인데,
   *   그건 지금 **별도 보강 레인이 하는 일과 겹친다**(수집=폭, 보강=깊이). 다만 수집 시점 보강이
   *   "수집과 동시에 이메일을 얻는" 경로이기도 해서 **추측으로 줄이면 수집 품질이 조용히 나빠진다.**
   *   ⇒ 줄이기 전에 **재는 것**이 먼저다. 이 값들이 다음 판단의 근거다.
   *   ⚠️ 이건 계측일 뿐 아무 동작도 안 바꾼다(추가 왕복 0 — 이미 있는 `budget.left` 를 읽기만).
   */
  const spendBy = { yt: 0, naver: 0, cafe: 0, tistory: 0, save: 0 }
  const processedIds = new Set<number>() // 실제 처리된 키워드 id — 커서를 '처리한 만큼만' 전진(예산 소진 leapfrog 방지)
  const roundCap = keywordsPerRoundCap(env)
  let fromYt = 0, fromCursor = 0 // 🎯 처리된 픽의 출처 — 커서픽이 실제로 도달되는지 보이게(위 `picks` 주석)
  // 💸 재조우 보강 스킵 훅 — 왜/예산회계는 `influencer-known-contacts.ts` docblock 이 SSOT.
  const alreadyContacted = makeAlreadyContacted(DB, POOL_ACCOUNT_ID, budget)

  for (const k of finalPicks) {
    if (budget.left <= 0) break // 🔒 예산 소진 — 이번 틱 종료(다음 틱 커서가 못 돈 키워드를 이어받음)
    // 🧊 폭 동결(2026-08-04) — 위 enrichMax 축소로 남은 예산이 **자동으로 키워드 수를 늘리는 것**을 막는다.
    //   왜 막는가는 `COLLECT_KEYWORDS_PER_ROUND` docblock(측정이 병목인데 폭을 넓히면 백로그만 는다).
    if (processedIds.size >= roundCap) break
    used.push(k.keyword); processedIds.add(k.id)
    if (ytIds.has(k.id)) fromYt++; else fromCursor++
    let kFound = 0, kSaved = 0 // 이 키워드의 이번 실행 발굴/저장
    // 🌵 **검색이 한 번이라도 성공했나** — 무판정 판정의 핵심 신호(`isUnjudgedRound`).
    //   예산은 멀쩡한데 YT 쿼터 소진 + 네이버 실패로 **아무것도 물어보지 못한** 회차가 있다.
    //   그걸 '무수확'으로 적으면 잘 되는 키워드를 스스로 은퇴시킨다(아래 주석의 자기강화 루프).
    let kSearched = 0
    // YT 는 배치 상한(batch)개 키워드만(쿼터 예산) — 나머지는 네이버 전용. maxResults 50 × pages 로 깊이 확장.
    // 🎯 YT 슬롯은 **성과가중 픽에만**(멤버십) — 위치 기반이면 배치 순서가 쿼터 배분까지 바꾼다(위 docblock).
    const ytSlot = ytIds.has(k.id) && ytUsed < batch
    if (hasYouTube && !quotaHit && ytSlot && ytSearchUsed + ytPages > ytBudgetTotal) ytBudgetBlocked = true // 예산 소진 — YT 만 스킵(네이버 계속)
    if (hasYouTube && !quotaHit && ytSlot && ytSearchUsed + ytPages <= ytBudgetTotal) {
      ytUsed++
      ytSearchUsed += ytPages // 검색 1페이지 = search.list 1회(예산 차감은 시도 기준 — 실패 호출도 구글이 카운트)
      try {
        const _b0 = budget.left
        const r = await discoverYouTubeInfluencers(env, k.keyword, { maxResults: 50, pages: ytPages, enrichMax: 8, budget, searchType: ytAngle.searchType, order: ytAngle.order, alreadyContacted })
        spendBy.yt += Math.max(0, _b0 - budget.left)
        if (r.ok) {
          kSearched++
          diag.yt.found += r.leads?.length || 0; kFound += r.leads?.length || 0
          if (r.leads?.length) { { const _s0 = budget.left; const s = await saveLeadsBatch(DB, POOL_ACCOUNT_ID, r.leads, { category: k.category, sourceKeyword: k.keyword }); saved += s; diag.yt.saved += s; kSaved += s; mine(r.leads); spendBy.save += Math.max(0, _s0 - budget.left) } }
        } else {
          if (r.error === 'QUOTA') { quotaHit = true; ytSearchUsed = Math.max(ytSearchUsed, ytBudgetTotal) } // 구글이 초과 선언 → 카운터도 소진 처리(다음 틱 헛호출 방지)
          if (!diag.yt.error) diag.yt.error = `${r.error}${r.message ? `: ${r.message}` : ''}`
        }
      } catch (e) { if (!diag.yt.error) diag.yt.error = `THROW: ${(e as Error)?.message || 'unknown'}` }
    }
    if (hasNaver) {
      try {
        const _b0 = budget.left
        const r = await discoverNaverBloggers(naverId, naverSecret, k.keyword, { display: 100, enrichMax: NAVER_COLLECT_ENRICH_MAX, budget, sort: naverSort, alreadyContacted })
        spendBy.naver += Math.max(0, _b0 - budget.left)
        if (r.ok) {
          kSearched++
          diag.naver.found += r.leads?.length || 0; kFound += r.leads?.length || 0
          if (r.leads?.length) { { const _s0 = budget.left; const s = await saveLeadsBatch(DB, POOL_ACCOUNT_ID, r.leads, { category: k.category, sourceKeyword: k.keyword }); saved += s; diag.naver.saved += s; kSaved += s; mine(r.leads); spendBy.save += Math.max(0, _s0 - budget.left) } }
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
        const _b0 = budget.left
        const r = await discoverNaverCafes(naverId, naverSecret, k.keyword, { display: 50, budget, sort: naverSort })
        spendBy.cafe += Math.max(0, _b0 - budget.left)
        if (r.ok) { kSearched++; if (r.leads?.length) { { const _s0 = budget.left; const s = await saveLeadsBatch(DB, POOL_ACCOUNT_ID, r.leads, { category: k.category, sourceKeyword: k.keyword }); saved += s; diag.cafe.found += r.leads.length; diag.cafe.saved += s; kFound += r.leads.length; kSaved += s; mine(r.leads); spendBy.save += Math.max(0, _s0 - budget.left) } } }
      } catch { /* fail-soft */ }
    }
    /**
     * 🆕 티스토리 — **만들어 놓고 부르는 줄이 없던 소스**(2026-07-29 배선).
     *   `discoverTistoryBloggers` 는 완성돼 있고 `diag.tistory` 타입도 발송 큐의 `tistory` 항목도 이미
     *   배선돼 있는데 **호출자가 0** 이라 풀에 tistory 리드가 **0건**이었다. 에러가 아니라 부재라 아무도 몰랐다
     *   (CLAUDE.md 의 '제조사 수집 cron 누락'과 같은 클래스).
     *
     *   왜 지금 넣나 — 이 레인에서 **가장 싼 소스인데 연락 경로가 있다**:
     *     · 비용 **키워드당 1 서브리퀘스트**(검색 1회로 끝, 연락처는 스니펫에서 추출).
     *       네이버 블로그는 1 + 최대 10(홈/RSS 보강), 카페는 1인데 **연락 경로가 없다**.
     *     · 쿼터는 카카오 Daum 검색(무료 3만/일)이라 희소자원인 YT 검색(90/일)과 **경쟁하지 않는다**.
     *     · 풀의 82%가 네이버 블로그라 소스 편중이 심하다 — 다변화 자체가 값이다.
     *
     *   ⚠️ 기본 ON + 킬스위치(`ADS_COLLECT_TISTORY_DISABLED='true'`). '켜야 도는 구조'로 두면
     *   "켠 줄 알았는데 안 돌던" 사고를 반복한다 — 지금 tistory 가 0건인 것이 정확히 그 결과다.
     */
    if (hasKakao && (env as unknown as { ADS_COLLECT_TISTORY_DISABLED?: string }).ADS_COLLECT_TISTORY_DISABLED !== 'true') try {
      const _b0 = budget.left
      const r = await discoverTistoryBloggers((env as unknown as { KAKAO_REST_API_KEY?: string }).KAKAO_REST_API_KEY, k.keyword, { size: 50, budget, sort: naverSort === 'date' ? 'recency' : 'accuracy' })
      spendBy.tistory += Math.max(0, _b0 - budget.left)
      if (r.ok) {
        kSearched++
        diag.tistory.found += r.leads?.length || 0; kFound += r.leads?.length || 0
        if (r.leads?.length) { { const _s0 = budget.left; const s = await saveLeadsBatch(DB, POOL_ACCOUNT_ID, r.leads, { category: k.category, sourceKeyword: k.keyword }); saved += s; diag.tistory.saved += s; kSaved += s; mine(r.leads); spendBy.save += Math.max(0, _s0 - budget.left) } }
      } else if (!diag.tistory.error) diag.tistory.error = `${r.error}${r.message ? `: ${r.message}` : ''}`
    } catch (e) { if (!diag.tistory.error) diag.tistory.error = `THROW: ${(e as Error)?.message || 'unknown'}` }
    // 🌵 **공정한 시도였나** — 예산이 이 키워드 도중에 바닥났거나 한도 오류를 봤으면 '무수확'이 아니라 '굶은'
    //   것이다. 루프는 키워드 *시작 전*에만 예산을 보므로, 남은 예산 1로 시작한 키워드도 모든 fetch 를
    //   시도하고 전부 실패한다 → kFound 0 → 아래 UPDATE 가 barren_streak 를 올린다.
    //   그 결과가 가볍지 않다: 점수에서 streak×25 를 깎고(`pickYtKeywords`), 쿨다운을 최대 4일까지 벌리고,
    //   auto 키워드는 8회면 **비활성**된다. 게다가 굶는 자리는 픽 목록의 꼬리로 **결정적**이라 특정 키워드가
    //   반복해서 맞는다 — 예산 부족이 키워드 품질로 오기록되는 자기강화 루프다.
    //   ⇒ 굶은 회차는 발굴/저장 누적만 반영하고 streak·last_saved·last_run_at 은 건드리지 않는다(= 무판정).
    //   ⚠️ 2026-07-29: 여기 조건이 `isUnjudgedRound`(순수함수 + 유닛 6개)와 **갈라져 있었다** —
    //   함수는 있는데 프로덕션에서 아무도 안 불러, 정작 라이브에선 옛 조건이 돌았다("가드가 있는데 안 돎").
    //   옛 조건이 못 잡던 것: **검색이 한 번도 성공 못 한 회차**(YT 쿼터 소진 + 네이버 실패). 그때 예산은
    //   멀쩡하다 — 우리가 굶은 게 아니라 *안 물어본* 것이라, 예산 기준만으론 안 걸린다.
    //   라이브 실측: 활성 210개 중 62개가 `found_total = 0` 인데 그 안에 `먹방`·`홈카페`·`뷰티 유튜버`가
    //   있었다. 한국에서 가장 많이 검색되는 축이 진짜로 0 일 리 없다.
    const starved = isUnjudgedRound({ budgetLeft: budget.left, searchedOk: kSearched, ytError: diag.yt.error, naverError: diag.naver.error })
    if (starved) starvedIds.add(k.id); else starvedIds.delete(k.id) // 같은 실행에 재등장하면 마지막 판정이 유효
    const prevK = kwStats.get(k.id) // 같은 키가 한 실행에 중복되어도 누적
    kwStats.set(k.id, { found: (prevK?.found || 0) + kFound, saved: (prevK?.saved || 0) + kSaved })
  }
  // 🩹 서브리퀘스트 한도 자가 교정(collect-budget) — 부딪혔으면 낮추고, 다 쓰고도 무사하면 조금 올린다.
  const hitLimit = isSubrequestLimitError(diag.yt.error) || isSubrequestLimitError(diag.naver.error)
  const nextCap = nextSubreqCap(budgetTotal - budget.left, hitLimit, learnedCap, envBudget, pcap)
  // 🧯 마감 기록은 **낱개로 fail-soft** — 하나가 실패하면 뒤의 커서·통계·리스해제까지 통째로 날아간다.
  //   ⬇️ 2026-07-29 재수리: 학습상한 쓰기를 **아래 커서/통계 batch 에 합쳤다**(별도 write 1개 제거).
  //   이유: 10:00 틱이 리드 52건을 저장하고도 커서·스탬프를 못 남겼다. 이 인보케이션의 실제 서브리퀘스트는
  //   `budget.left` 가 세는 발굴 fetch 만이 아니라 D1 18개 + 라우트레벨까지인데, 그 초과분이 **전부 꼬리에**
  //   몰려 있다. 꼬리를 1개 줄이면 그만큼 커서 전진이 살아남는다(커서가 안 밀리면 다음 회차가 같은 키워드를
  //   다시 돈다 — 관측이 아니라 진행의 문제다). D1 batch 는 N문장이 1 서브리퀘스트다.
  // 📊 키워드별 성과 누적 저장(1 batch) — 어드민 키워드 칩에서 "어느 지역 키워드가 잘 무는지" 확인.
  if (kwStats.size) {
    await DB.batch(Array.from(kwStats.entries()).map(([id, v]) => starvedIds.has(id)
      // 🌵 굶은 회차 — 수확만 누적하고 **판정은 보류**(streak/last_saved/last_run_at 불변).
      //   last_run_at 을 안 건드리는 것이 핵심이다: 순번을 못 받았으니 여전히 '실행 대기'로 남아야 한다.
      ? DB.prepare('UPDATE ad_discovery_keywords SET found_total = found_total + ?, saved_total = saved_total + ? WHERE id = ?')
        .bind(v.found, v.saved, id)
      // 🌵 무수확이면 연속 카운터 +1, 한 명이라도 건지면 0 으로 리셋(고갈 판정의 유일한 근거).
      : DB.prepare(`UPDATE ad_discovery_keywords SET found_total = found_total + ?, saved_total = saved_total + ?, last_saved = ?,
        barren_streak = CASE WHEN ? > 0 THEN 0 ELSE COALESCE(barren_streak, 0) + 1 END, last_run_at = datetime('now') WHERE id = ?`)
        .bind(v.found, v.saved, v.saved, v.saved, id))).catch(() => null)
  }

  // ③ 해시태그 자동확장 — 승격 로직은 `influencer-keyword-promote.ts`(600줄 래칫 분리).
  //   적합성 게이트(2026-07-29 대표 승인)도 그 안에 있다 — 승격을 결정하는 자리와 같은 파일이라야
  //   "게이트를 우회하는 두 번째 승격 경로"가 생기지 않는다.
  const { promoted, kwAuto } = await promoteHashtagKeywords(DB, hashtagFreq)

  // 두 커서 각각 전진(우선/일반 풀 독립 순환) — 처리된 **연속 접두 길이**만큼만 전진(멤버십 카운트 아님).
  //   ⚠️ ytPicks(성과가중)가 커서 앞선 키워드를 처리하면 filter 카운트는 그 '중간' 처리를 세어 갭을 건너뛴다
  //   (leapfrog). prefix 방식은 앞에서 처리 안 된 키워드가 나오면 멈춰, 못 돈 키워드를 다음 틱이 정확히 이어받음.
  const prefixDone = (ps: { id: number }[]) => { let n = 0; for (const p of ps) { if (processedIds.has(p.id)) n++; else break } return n }
  const priDone = prefixDone(priPicks)
  const genDone = prefixDone(genPicks)
  const nextPriCursor = priPool.length ? (priCursor + priDone) % priPool.length : 0
  //   🎯 집중 축도 **처리된 접두**만큼만 민다(2026-08-03). 예전엔 `+ nFocus`(계획한 수)였는데,
  //   예산은 보통 픽 4개를 다 못 돌아 안 돈 키워드를 건너뛰었다 — 위 leapfrog 와 같은 병이다.
  const focusDone = prefixDone(focusPicks)
  const nextFocusCursor = focusPool.length ? (focusCursor + focusDone) % focusPool.length : 0
  const nextCursor = genPool.length ? (cursor + genDone) % genPool.length : 0
  // 🎯 YT 예산 소진으로 스킵됐고 다른 에러가 없으면 사유 노출(QUOTA 프리픽스 = 기존 배너 스타일 재사용).
  if (ytBudgetBlocked && !diag.yt.error) diag.yt.error = `QUOTA: 오늘 YT 검색 예산(${ytBudgetTotal}회) 소진 — 쿼터 리셋(한국 오후 4~5시) 후 자동 재개`
  // 📟 네이버 오픈API 일일 사용량 — **아래 batch 에 얹어 서브리퀘스트 추가 0**(읽기는 SETTING_KEYS 에 이미 포함).
  //   콜마다 D1 을 쓰면 네이버 콜 1회가 서브리퀘스트 2회가 되어 레인 예산을 반토막 낸다.
  //   ⚠️ `takeNaverCalls()` 는 **가져가며 비우므로 회차당 정확히 한 번** 불러야 한다(두 번 부르면 뒤가 0).
  const naverDay = kstDayKey(Date.now())
  const naverCalls = parseNaverUsed(settings[NAVER_USED_KEY], naverDay) + takeNaverCalls()
  const stats: AutoCollectStats = {
    last_run: stamp, last_saved: saved, last_keywords: used,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved,
    cursor: nextCursor, pri_cursor: nextPriCursor, focus_cursor: nextFocusCursor, focus_n: nFocus, promoted, kw_unjudged: starvedIds.size, ...(kwAuto ? { kw_auto: kwAuto } : {}), youtube_quota_hit: quotaHit, diag,
    picks: { planned: finalPicks.length, processed: processedIds.size, from_yt: fromYt, from_cursor: fromCursor },
    yt_budget: { used: ytSearchUsed, total: ytBudgetTotal, day: ytDay },
    // 🧾 소스별 서브리퀘스트 실사용 — `processed 5 / planned 16` 의 범인을 **재서** 찾기 위한 값(위 spendBy 주석).
    //   해석: 합이 spent 에 근접하면 그 소스가 병목. 특히 yt/naver 가 크면 발굴 시점 enrichMax(8/5)가 원인이고,
    //   그건 별도 보강 레인과 겹치는 일이라 줄일 여지가 있다(줄이기 전에 이 숫자를 볼 것).
    spend_by: spendBy,
    // 📟 네이버 오픈API 일일 사용량(KST 기준일). **자동 레인만 세므로 실사용의 하한**이다 —
    //   어드민 온디맨드 도구(keyword-tools/rank-tracker/competitor-tracker)는 계측 밖(naver-api-usage.ts 주석).
    naver_api: { used: naverCalls, total: NAVER_DAILY_QUOTA_CALLS, day: naverDay },
    // 🔒 예산 실사용/상한/한도관측 — 정상 실행에도 남긴다(위 필드 주석 참조).
    spent: budgetTotal - budget.left, budget_total: budgetTotal, learned_cap: learnedCap, limit_hit: hitLimit,
    // 🕳️ `limit_hit` 과 **다른 값**이다 — 근거·함정은 타입 정의(`AutoCollectStats.budget_exhausted`) 참조.
    budget_exhausted: budget.left <= 0,
    // ✅ 성공했으면 옛 crash 표식을 남기지 않는다(회복 후에도 빨간 줄이 남으면 다음 사람이 오진한다).
  }
  // 🧮 커서·카운터·통계를 1 batch 로 저장(2026-07-29) — 낱개 4 write = 4 서브리퀘스트였다.
  await writeSettings(DB, [
    [YT_USED_KEY, `${ytDay}:${ytSearchUsed}`],
    [NAVER_USED_KEY, `${naverDay}:${naverCalls}`],
    // 🎯 집중 축 커서 — 이 줄이 없어서 대행사 키워드 18개 중 앞 4개만 무한 반복했다(2026-08-03 수리).
    //   통계 JSON 에 `focus_cursor` 를 넣는 것만으론 **다음 회차가 안 읽는다**(읽기는 이 키를 본다).
    [FOCUS_CURSOR_KEY, String(nextFocusCursor)],
    ['ads_autocollect_cursor_pri', String(nextPriCursor)],
    [CURSOR_KEY, String(nextCursor)],
    [STATS_KEY, JSON.stringify(stats)],
    // 🩹 학습 상한도 같은 batch 로(위 주석) — 자가교정 상태와 커서는 같은 회차의 결과라 운명을 함께해도 된다.
    ...(nextCap != null ? [[subreqCapKey('influencer'), String(nextCap)] as [string, string]] : []),
  ]).catch(() => undefined) // 🧯 위와 동일 — 실패해도 리스 해제까지는 간다(TTL 5분 백스톱에 기대지 않게)
  // 📍 지역 백필은 **정비의 `reextract` 단계**로 옮겼다(2026-07-29) — `sweepRegions` 주석에 실측 근거.
  //   요지: 여기(수집 꼬리)는 발굴이 예산을 다 쓴 자리라 회차당 400행이 한계였고, 그 속도로는
  //   미판정 37,075건에 약 3.9일이 걸렸다. 정비 쪽은 fresh 인보케이션이라 한 회차에 수천 행을 돈다.
  //   ⚠️ 여기서 다시 부르지 말 것 — 두 벌로 두면 조용히 갈라진다.
  await releaseLease() // 🔒 상태 기록 후 해제(다음 실행이 최신 카운터/커서를 읽게) — 크래시 시 TTL 5분이 백스톱
  try { await maybeAlertCollectHealth(env, DB, {
    diag, saved, quotaHit, // 🔢 아래 숫자가 없어서 '정체' 경보를 받고도 확인처가 false 라 정상으로 보였다
    spent: stats.spent, budget_total: stats.budget_total, budget_exhausted: stats.budget_exhausted, picks: stats.picks,
  }) } catch { /* fail-soft */ }
  return stats
}
