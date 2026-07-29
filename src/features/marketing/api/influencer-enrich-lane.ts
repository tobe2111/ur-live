/**
 * 📝 인플루언서 풀 **보강 전용 레인** (2026-07-28 — 라이브 실측 기반 신설)
 *
 *   ## 왜 별 레인인가 (추측 아님 — 라이브 숫자)
 *   `/api/admin/ads/influencer-pool/stats` 실측: 총 37,414명 중 **연락처 보유 3,308명(8.8%)**,
 *   그중 네이버 블로거(27,864명 = 풀의 74%)는 이메일이 사실상 0(전체 이메일 2,262 중 유튜브가 2,077).
 *   그리고 마지막 수집 스냅샷은 `bio_enriched:0 · perf_enriched:0 · naver_enrich.tried:0` —
 *   **보강 4종이 한 건도 못 돌고 있었다.** 표본 1,000행에서 `perf_checked_at` 이 채워진 행은 **0개**.
 *
 *   원인은 예산 구조다. 보강 레인이 수집(`influencer-auto-collect`)과 **같은 인보케이션**에 얹혀 있어
 *   무료 플랜의 인보케이션당 서브리퀘스트 한도(≈50, D1 포함)를 발굴 루프가 먼저 다 써버린다.
 *   `enrichReserve`(예약분)를 뒀지만 **키워드 경계에서만** 검사해서, 한 키워드가 예약분보다 많이 쓰면
 *   그대로 0 까지 내려갔다(= 예약이 사실상 무효).
 *
 *   ⇒ 파트너풀이 이미 검증한 패턴을 그대로 쓴다: **레인을 독립 인보케이션으로 분리**하고
 *     cron 이 시간당 N라운드 호출(각 라운드 = 새 서브리퀘스트 예산). `enrich-lane.ts`(파트너풀) 형제.
 *
 *   ## 이 레인이 하는 일
 *     ① 📝 네이버 블로거 활동성/프로필 연락처 — RSS + 모바일 홈 (건당 fetch 2). 백로그 27,864.
 *     ② 🔗 링크인바이오(linktr.ee 등) 체인 추출 — 이메일/인스타 (건당 fetch 1).
 *     ③ 📈 유튜브 성과(최근 조회수·롱폼 중앙값·개설일) — 건당 ~1 fetch(= 1 unit).
 *
 *   ③ 을 여기 두는 근거(실측): YT 채널 800개 표본에서 **94% 가 성과 미측정**, 롱폼 중앙값은 **100% 미측정**
 *   → `lead_score` 의 활동성 25점 축이 통째로 0 인 채 순위가 매겨지고 있었다. "발굴 검색과 쿼터를 공유하니
 *   수집에 남겨야 한다"는 처음 판단은 **실측으로 뒤집혔다**: 오늘 검색은 일일 예산 90 중 **22회(2,200 units)**
 *   만 썼고 10,000 units 중 대부분이 남는다. 병목은 쿼터가 아니라 **인보케이션당 서브리퀘스트**였다.
 *   그래서 쿼터는 일일 카운터(`ads_yt_perf_units`)로 따로 막고, 처리량은 라운드로 낸다.
 *
 *   ⚠️ [LEGAL/PIPA] 공개 프로필/RSS 의 공개 연락처만 저장(수집과 동일 기준). 발송은 별도 동의 절차.
 *   ⚠️ 서비스 분리: `ad_influencer_leads` + `platform_settings` 만 접촉(소비자/도매 무관).
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '@/worker/types/env'
import {
  ensureInfluencerSchema, extractContacts, pickBusinessEmail, fetchLinkInBioText, type FetchBudget,
} from './influencer-discovery'
import { enrichNaverActivity, enrichYouTubePerformance, ensurePerfExtraColumns, type NaverEnrichDiag } from './influencer-performance'
import { POOL_ACCOUNT_ID, readSetting, writeSetting, ytQuotaDayKey } from './influencer-auto-collect'
import { subreqCapKey, resolveSubreqBudget, nextSubreqCap, isSubrequestLimitError } from './collect-budget'
// 스냅샷 키는 leaf 모듈(enrich-telemetry)에 둔다 — 어드민 통계가 수집 엔진을 import 하지 않고 읽게.
import { INFLUENCER_ENRICH_SNAPSHOT_KEY } from './enrich-telemetry'

/** 링크인바이오 플랫폼 자체 메일(안내/noreply) — 인플루언서 연락처가 아니라 저장 금지. */
const PLATFORM_EMAIL_RE = /@(linktr\.ee|litt\.ly|inpock\.co\.kr|litelink\.at|taplink\.cc|link\.bio)$/i

export interface InfluencerEnrichSnapshot {
  last_run?: string
  bio: number                 // 🔗 링크인바이오로 연락처를 새로 채운 리드 수
  yt?: number                 // 📈 유튜브 성과(조회수·롱폼중앙값·개설일)를 채운 채널 수
  naver: NaverEnrichDiag      // 📝 블로거 tried/measured/contacts/failed
  /** 📈 유튜브 일일 units — 발굴 검색과 같은 10,000 풀을 나눠 쓰므로 소진 여부가 보여야 한다. */
  yt_units?: { used: number; total: number; day: string }
  spent: number               // 이번 라운드가 실제로 쓴 서브리퀘스트(외부 fetch)
  budget_total: number
  limit_hit: boolean          // 플랫폼 서브리퀘스트 한도 관측(학습 상한 자동 하향)
  deadline_hit: boolean       // 벽시계 상한으로 끊음(예산이 남아도 시간이 인보케이션을 끝낸다)
  elapsed_ms: number
  total_measured?: number     // 누적 — "얼마나 진행됐나"를 라운드 하나가 아니라 전체로 본다
  total_contacts?: number
  crash?: string              // 💥 예외 원문(무증거 종료 방지 — 파트너풀 레인과 같은 철학)
  crash_at?: string
}

/**
 * 한 라운드의 대상 수 배분 — **순수 함수**(유닛테스트로 고정).
 *   블로거 1건 = fetch 2(RSS+홈) · 링크인바이오 1건 = fetch 1. D1(SELECT/batch) 도 서브리퀘스트를
 *   소모하므로 예약 오버헤드 4 를 빼고 나눈다. 실제 중단은 각 함수가 `budget.left` 로 하고,
 *   여기서는 SELECT LIMIT 이 헛되이 커지지 않게만 잡는다.
 */
export function planInfluencerEnrich(budgetTotal: number): { bioMax: number; naverMax: number; ytMax: number } {
  const usable = Math.max(0, budgetTotal - 4)
  const bioMax = Math.max(0, Math.min(6, Math.floor(usable * 0.15)))
  // 📈 YT 는 건당 ~1 fetch 라 싸다 — 전체의 1/3 을 배정해도 블로거 몫이 크게 줄지 않는다.
  const ytMax = Math.max(0, Math.min(20, Math.floor(usable * 0.35)))
  const naverMax = Math.max(0, Math.min(30, Math.floor((usable - bioMax - ytMax) / 2)))
  return { bioMax, naverMax, ytMax }
}

/**
 * 📝 블로거 몫을 **이 시점의 실제 잔여 예산**으로 다시 계산한다.
 *
 *   위 `planInfluencerEnrich` 는 라운드 *시작 전* 배분이라 앞 레인(링크인바이오·YT)이 배정분을
 *   다 안 쓰면 그만큼이 그대로 버려진다. 라이브 실측(2026-07-29)에서 정확히 그랬다:
 *   `bio: 0`(링크인바이오 후보 없음 — 예약 6 통째로 미사용) · `yt: 14` · `naver: 10` →
 *   **`spent: 38 / budget_total: 45`**. 남은 7 은 26,018건짜리 블로거 백로그가 쓸 수 있었던 예산인데
 *   매 라운드 버려지고 있었다. 호출부 주석은 이미 "앞 레인이 남긴 예산 전부를 쓴다"고 약속하고
 *   있었으므로, 이건 새 정책이 아니라 **약속과 구현의 불일치를 메우는 것**이다.
 *
 *   `-1` 은 소비 루프의 중단 조건(`budget.left <= 1`)과 맞춘 것 — 마지막 1은 어차피 못 쓴다.
 *   `/2` 는 블로거 건당 fetch 2(RSS + 모바일 홈). 상한 30 은 `enrichNaverActivity` 의 SELECT LIMIT 과 동일.
 *   ⚠️ 배정은 상한일 뿐 실제 중단은 여전히 `budget.left`/deadline 이 한다 — 과배정해도 초과 지출은 없다.
 */
export function naverRoomFromRemaining(remaining: number, plannedMax: number): number {
  const left = Number.isFinite(remaining) ? remaining : 0
  const planned = Number.isFinite(plannedMax) ? plannedMax : 0
  const affordable = Math.floor(Math.max(0, left - 1) / 2)
  // 계획분보다 줄이지 않는다 — 앞 레인이 예산을 다 썼을 때 기존 동작으로 안전하게 되돌아간다.
  return Math.max(0, Math.min(30, Math.max(planned, affordable)))
}

/** 유튜브 성과 보강의 **일일 units 카운터**(검색과 같은 10,000 풀을 나눠 쓴다). "YYYY-MM-DD:count". */
const YT_PERF_UNITS_KEY = 'ads_yt_perf_units'
/** 기본 일일 상한 — 실측(검색 22회=2,200 units)에 비춰 넉넉하되, 검색이 자기 예산을 다 써도 여유가 남는 값.
 *  검색 예산(`ADS_YT_SEARCH_BUDGET`, 기본 90회=9,000 units)을 크게 올릴 때는 이 값을 함께 낮출 것. */
const YT_PERF_UNITS_DEFAULT = 2000

/** 오늘 남은 perf units — 날짜가 바뀌면 자동으로 0부터(문자열 앞의 날짜가 키). */
async function readPerfUnitsUsed(DB: D1Database, day: string): Promise<number> {
  const raw = await readSetting(DB, YT_PERF_UNITS_KEY)
  if (!raw) return 0
  const i = raw.indexOf(':')
  return i > 0 && raw.slice(0, i) === day ? Math.max(0, parseInt(raw.slice(i + 1), 10) || 0) : 0
}

/**
 * 🔗 링크인바이오 체인 보강 — 프로필 링크가 linktr.ee 류인 리드의 그 페이지를 열어 이메일/인스타를 추출.
 *   (2026-07-28 `influencer-auto-collect` 에서 이 레인으로 이동 — 수집이 아니라 보강이므로.)
 *   `bio_checked_at` 스탬프로 1인 1회(재선택 없음). 못 찾아도 스탬프(허위 재시도 방지).
 */
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
    if (budget.left <= 0 || (budget.deadline && Date.now() >= budget.deadline)) break // 예산/시간 소진 — 스탬프 없이 중단(다음 라운드가 이어받음)
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

const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

/** 이전 스냅샷(누적치 이어받기용). 파싱 실패는 null — 누적이 끊길 뿐 라운드는 정상 진행. */
async function readSnapshot(DB: D1Database): Promise<InfluencerEnrichSnapshot | null> {
  const raw = await readSetting(DB, INFLUENCER_ENRICH_SNAPSHOT_KEY)
  try { return raw ? JSON.parse(raw) as InfluencerEnrichSnapshot : null } catch { return null }
}

/**
 * 📝 보강 1라운드 — cron 이 시간당 N회 호출(각 호출 = 독립 인보케이션 = 새 서브리퀘스트 예산).
 *   실패해도 throw 하지 않는다(호출부는 fail-soft) — 대신 **crash 원문을 스냅샷에 남긴다**.
 *   증거 없는 종료가 진단을 몇 세션씩 잡아먹은 것이 2026-07-28 파트너풀 레인의 교훈이다.
 */
export async function runInfluencerEnrich(env: Env): Promise<InfluencerEnrichSnapshot> {
  const DB = env.DB
  const started = Date.now()
  await ensureInfluencerSchema(DB)   // bio_checked_at · perf_checked_at · recent_posts_30d
  await ensurePerfExtraColumns(DB)   // last_post_at (블로거 마지막 글 날짜)

  const envBudget = Math.min(400, Math.max(10, parseInt(env.ADS_INFLUENCER_ENRICH_BUDGET || '', 10) || 45))
  const learnedCap = Math.max(0, parseInt((await readSetting(DB, subreqCapKey('influencer_enrich'))) || '', 10) || 0)
  const budgetTotal = resolveSubreqBudget(envBudget, learnedCap)
  // ⏱️ 벽시계 가드 — 서브리퀘스트가 남아도 시간이 인보케이션을 끝낸다(블로그 fetch 타임아웃 8s × N).
  //   파트너풀 레인과 같은 env 를 공유(둘 다 "보강 1라운드 상한"이라 의미가 같다).
  const deadlineMs = Math.min(120_000, Math.max(5_000, parseInt(env.ADS_ENRICH_DEADLINE_MS || '', 10) || 20_000))
  const budget: FetchBudget = { left: budgetTotal, deadline: started + deadlineMs }
  const { bioMax, naverMax, ytMax } = planInfluencerEnrich(budgetTotal)
  // 📈 유튜브 성과 — 서브리퀘스트(위 예산)와 **일일 units**(검색과 공유하는 10,000 풀) 둘 다 통과해야 돈다.
  const ytDay = ytQuotaDayKey(started)
  const ytUnitCap = Math.min(9000, Math.max(0, parseInt(env.ADS_YT_PERF_UNITS || '', 10) || YT_PERF_UNITS_DEFAULT))
  const ytUnitsUsed = await readPerfUnitsUsed(DB, ytDay)
  const ytRoom = Math.max(0, ytUnitCap - ytUnitsUsed)

  let bio = 0
  let yt = 0
  let naver: NaverEnrichDiag = { tried: 0, measured: 0, contacts: 0, failed: 0 }
  let limitHit = false
  let crash: string | undefined
  const note = (err: unknown) => {
    const e = err as { name?: string; message?: string } | null
    const msg = `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}`
    if (isSubrequestLimitError(msg)) limitHit = true
    if (!crash) crash = msg
  }
  // 🔗 링크인바이오 먼저(백로그가 작고 건당 1 fetch — 블로거 백로그에 영원히 밀리지 않게).
  try { bio = await enrichPoolFromLinkInBio(DB, budget, bioMax) } catch (err) { note(err) }
  // 📈 유튜브 성과 — 남은 일일 units 안에서만. 소모 units 는 실제 쓴 fetch 수로 계산(list 호출 1회 = 1 unit).
  const beforeYt = budget.left
  if (ytMax > 0 && ytRoom > 0 && env.YOUTUBE_API_KEY) {
    try { yt = await enrichYouTubePerformance(env.YOUTUBE_API_KEY, DB, budget, Math.min(ytMax, ytRoom)) } catch (err) { note(err) }
  }
  const ytUnits = Math.max(0, beforeYt - budget.left)
  if (ytUnits > 0) await writeSetting(DB, YT_PERF_UNITS_KEY, `${ytDay}:${ytUnitsUsed + ytUnits}`).catch(() => undefined)
  // 📝 블로거 — 백로그가 가장 큰 레인(풀의 74%). 앞 레인이 남긴 예산 전부를 쓴다.
  //   ⚠️ 그러려면 정적 배분(naverMax)이 아니라 **이 시점의 잔여**로 다시 계산해야 한다 — 안 그러면
  //   앞 레인이 안 쓴 몫이 매 라운드 버려진다(실측: bio 후보 0 → spent 38/45). `naverRoomFromRemaining` 참조.
  try { naver = await enrichNaverActivity(DB, budget, naverRoomFromRemaining(budget.left, naverMax)) } catch (err) { note(err) }

  const spent = budgetTotal - budget.left
  const deadlineHit = Date.now() >= (budget.deadline || Infinity)
  // 🩹 학습 상한 자가 교정 — **항상 이 지점에 도달한다**(레인 예외를 위에서 삼켰으므로).
  //   파트너풀 레인이 "쓰기가 마지막 단계 뒤에 갇혀 학습을 한 번도 못 하던" 사고를 여기서 반복하지 않는다.
  const cap = nextSubreqCap(budgetTotal - budget.left, limitHit, learnedCap, envBudget)
  if (cap != null) await writeSetting(DB, subreqCapKey('influencer_enrich'), String(cap)).catch(() => undefined)

  const prev = await readSnapshot(DB)
  const snap: InfluencerEnrichSnapshot = {
    last_run: nowStamp(), bio, yt, naver, spent, budget_total: budgetTotal,
    limit_hit: limitHit, deadline_hit: deadlineHit, elapsed_ms: Date.now() - started,
    yt_units: { used: ytUnitsUsed + ytUnits, total: ytUnitCap, day: ytDay },
    total_measured: (prev?.total_measured || 0) + naver.measured + yt,
    total_contacts: (prev?.total_contacts || 0) + naver.contacts + bio,
    ...(crash ? { crash, crash_at: nowStamp() } : {}),
  }
  await writeSetting(DB, INFLUENCER_ENRICH_SNAPSHOT_KEY, JSON.stringify(snap)).catch(() => undefined)
  return snap
}
