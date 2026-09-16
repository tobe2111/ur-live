/**
 * 📝 인플루언서 풀 **보강 전용 레인** (2026-07-28 — 라이브 실측 기반 신설)
 *
 *   ## 왜 별 레인인가 (추측 아님 — 라이브 숫자)
 *   `/api/admin/ads/influencer-pool/stats` 실측: 총 37,414명 중 **연락처 보유 3,308명(8.8%)**,
 *   그중 네이버 블로거(27,864명 = 풀의 74%)는 이메일이 사실상 0(전체 이메일 2,262 중 유튜브가 2,077).
 *   그리고 마지막 수집 스냅샷은 `bio_enriched:0 · perf_enriched:0 · naver_enrich.tried:0` —
 *   **보강 4종이 한 건도 못 돌고 있었다.** 표본 1,000행에서 `perf_checked_at` 이 채워진 행은 **0개**.
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
import { enrichNaverActivity, enrichYouTubePerformance, ensurePerfExtraColumns, type NaverEnrichDiag, type EnrichSlice } from './influencer-performance'
import { enrichTistoryActivity, tistoryRoom, type TistoryEnrichDiag } from './influencer-tistory-performance'
import { POOL_ACCOUNT_ID, readSetting, writeSetting, ytQuotaDayKey } from './influencer-auto-collect'
import { subreqCapKey, resolveSubreqBudget, nextSubreqCap, isSubrequestLimitError, envSubreqCap, envEnrichDeadlineMs, envLaneBudget, ENRICH_DEADLINE_MS_ALARM } from './collect-budget'
// 스냅샷 키는 leaf 모듈(enrich-telemetry)에 둔다 — 어드민 통계가 수집 엔진을 import 하지 않고 읽게.
import { INFLUENCER_ENRICH_SNAPSHOT_KEY } from './enrich-telemetry'
import { shouldFallbackToFront } from './enrich-capacity'
// 🔗 링크인바이오 보강은 파일 크기 래칫(600줄)로 분리 — 로직은 이동뿐, 호출부 계약 유지를 위해 재수출한다.
import { enrichPoolFromLinkInBio } from './influencer-bio-enrich'
export { enrichPoolFromLinkInBio }


/** 🔗 한 체인(정각 1회 = 라운드 N개)의 합계. 라운드 하나가 아니라 **그 시간에 실제로 일어난 일**. */
export interface EnrichChainRollup {
  rounds: number            // 스냅샷을 쓴 라운드 수. `depth + 1` 보다 작으면 중간 라운드가 죽은 것이다.
  /**
   * 🧱 드라이버가 **계획한** 라운드 수(기본 12). `rounds` 와의 격차가 곧 **체인 수명 천장**이다.
   *
   *   2026-07-29 실측: 계획 12 · 도달 `depth 2`(라운드 3) — 13:00:0x 시작 → 13:01:36 마지막 기록,
   *   즉 이 레인이 정각마다 실제로 확보하는 벽시계는 **~90초**뿐이다. 그동안 여러 세션이
   *   "라운드를 12로 늘렸다"를 처리량 근거로 삼았는데, **9라운드는 한 번도 존재한 적이 없다.**
   *   ⇒ 라운드 상한(`ADS_INFLUENCER_ENRICH_ROUNDS`)이나 라운드 창(`ADS_ENRICH_DEADLINE_MS`)을
   *     키우는 처방은 이 격차가 메워진 뒤에야 의미가 있다. 창을 키우면 라운드가 **줄어든다**.
   */
  rounds_planned?: number
  max_depth: number
  bio: number
  yt: number
  naver_selected: number    // 고른 수 ↔ 잰 수의 간격이 곧 "시간에 잘렸다"는 증거다
  naver_tried: number
  naver_measured: number
  naver_contacts: number
  deadline_hits: number     // 몇 라운드가 벽시계로 끊겼나(예산 소진과 구분)
  spent: number
  started_at?: string
}

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
  /**
   * 🔢 이 라운드의 self-chain 깊이 — **체인이 이어졌는지를 밖에서 보는 유일한 창**(2026-07-29).
   *
   *   원래 하트비트(`ads:enrich-influencer-driver`)에 실었는데 **보이지 않았다**: 같은 이름에 부모(`kick`)와
   *   자식(드라이버)이 둘 다 쓰고, 부모는 자식 응답 *뒤에* 쓰므로 **항상 부모가 마지막 writer** 다
   *   (실측 12:00: `result: null` — 내가 실은 `{planned, depth, chained}` 가 통째로 덮였다).
   *   ⇒ 이름을 다투지 않는 곳(이 스냅샷)에 싣는다. 어차피 라운드마다 쓰는 값이라 **추가 쓰기 0**.
   */
  depth?: number
  /**
   * 🔗 **이 체인(=이번 정각) 전체의 합** — 스냅샷이 *마지막 라운드만* 남기던 사각지대를 메운다.
   *
   *   2026-07-29 실측: `depth: 2 · naver { selected: 12, tried: 0 }`. 체인은 최소 3라운드(0·1·2)를
   *   돌았는데 **보이는 건 마지막 한 장뿐**이라, 앞 라운드가 블로거를 쟀는지 못 쟀는지 알 방법이 없었다.
   *   그런데 오늘 #880(블로거 시간 바닥) 판정을 **이 한 장으로 세 번** 했다 — 한 번은 그 오독으로
   *   단계 순서를 통째로 뒤집는 커밋까지 썼다가 되돌렸다.
   *
   *   ⚠️ 이 값이 **못 보는 것**: 라운드가 스냅샷 쓰기 전에 죽으면 안 세어진다. 그래서 `rounds` 가
   *   `depth + 1` 보다 작으면 그 자체가 신호다(중간 라운드 사망). 같은 이유로 이 값을 신뢰하려면
   *   `rounds` 를 먼저 볼 것 — 합만 보면 죽은 라운드를 '0을 낸 라운드'와 구분 못 한다.
   */
  chain?: EnrichChainRollup
  /** 🔀 이번 회차의 선두('naver' | 'front') — 다음 회차 교대의 유일한 근거(알람엔 depth 가 없다). */
  led?: string
  fell_back?: true            // ♻️ 여력 자동배치 발동 — 블로그가 말라 링크인바이오가 남은 예산을 가져갔다
  /** 📗 티스토리 보강 결과 — 이 환경은 tistory.com 이 프록시 차단이라 **라이브 diag 가 유일한 판정 근거**다. */
  tistory?: TistoryEnrichDiag
  /** 📈 이 회차가 실제로 측정한 YT 채널 수 — units 대비 효율을 밖에서 계산하기 위한 값. */
  yt_rows?: number
  elapsed_ms: number
  total_measured?: number     // 누적 — "얼마나 진행됐나"를 라운드 하나가 아니라 전체로 본다
  total_contacts?: number
  total_emails?: number       // 📧 그중 이메일만 누적(아웃리치 가능 리드의 실제 증가율)
  crash?: string              // 💥 예외 원문(무증거 종료 방지 — 파트너풀 레인과 같은 철학)
  crash_at?: string
}

/**
 * 한 라운드의 대상 수 배분 — **순수 함수**(유닛테스트로 고정).
 *   블로거 1건 = fetch 2(RSS+홈) · 링크인바이오 1건 = fetch 1. D1(SELECT/batch) 도 서브리퀘스트를
 *   소모하므로 예약 오버헤드 4 를 빼고 나눈다. 실제 중단은 각 함수가 `budget.left` 로 하고,
 *   여기서는 SELECT LIMIT 이 헛되이 커지지 않게만 잡는다.
 */
/** 📐 예산 배분 정책(순수) — SSOT 는 `influencer-enrich-plan.ts`. 재수출이라 기존 import 경로는 그대로. */
export { planInfluencerEnrich, naverRoomFromRemaining, naverRoomWithYtReserve } from './influencer-enrich-plan'
import { planInfluencerEnrich, naverRoomWithYtReserve } from './influencer-enrich-plan'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

/** 📗 티스토리 몫 — 정책·근거는 `influencer-tistory-performance.ts`(SSOT). 여기선 재수출만. */
export { TISTORY_ROOM, tistoryRoom } from './influencer-tistory-performance'


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
/**
 * 🔄 **직전 회차에 뒷 레인이 굶었나** — 선두 교대의 폴백 신호(순수).
 *
 *   판정선은 `selected > 0 && tried === 0` 이다. "큐가 비었다"(selected 0)와 명확히 다르다 —
 *   **고를 사람은 있었는데 한 명도 못 쟀다**는 뜻이고, 그 회차는 SELECT 비용만 쓰고 통째로 버려진 것이다.
 *   라이브에서 정확히 이 값이 반복해 찍혔다(`selected 12~13 · tried 0`).
 *
 *   ⚠️ `deadline_hit` 을 조건에 넣지 않는다 — 창을 다 쓰는 건 정상이고(예산을 남기지 않았다는 뜻),
 *   문제는 *뒷 레인이 한 명도 못 받은 것*이다. 두 개를 섞으면 정상 회차까지 뒤집는다.
 *   ⚠️ 스냅샷이 없거나 깨졌으면 `false` — 첫 배포·유실에서 기존 순서를 유지한다.
 */
export function starvedLastRound(prev: { naver?: { selected?: number; tried?: number } } | null | undefined): boolean {
  const n = prev?.naver
  if (!n) return false
  return (n.selected || 0) > 0 && (n.tried || 0) === 0
}

/**
 * 🔀 **이번 회차는 누가 먼저 도나** — 선두 교대(순수).
 *
 * ## 무엇이 고장이었나 (2026-08-03 실측)
 * 원래 조건은 `depth % 2 === 1 || starvedLastRound(prev)` 였다. 그런데 **DO 알람으로 옮긴 뒤 `depth` 는
 * 항상 0** 이다(체인이 아니라 알람이 5분마다 라운드 하나씩 돌린다 — `chain.rounds: 1, max_depth: 0`).
 * `0 % 2 === 1` 은 영원히 거짓이므로 **결정적 교대가 한 번도 발화하지 않는다.**
 * 위 docblock 이 *"둘은 서로를 보완한다"* 고 적어 둔 그 짝이 **한쪽 죽은 채로** 돌고 있었다.
 *
 * 지금은 앞 레인(bio·yt)이 0을 내고 있어 블로거가 다 가져가므로 무해했다. 그러나 **YT 상한을 풀면
 * (`resolveYtPerfCap`) yt 가 예산을 먼저 먹어 블로거가 굶는다** — 그 수리와 이 수리는 한 몸이다.
 *
 * ## 규칙 — 깊이 대신 **직전 선두**를 보고 번갈아 간다
 * 알람이든 체인이든 스냅샷은 매 라운드 쓰이므로, 직전 선두를 기억하면 교대가 성립한다.
 *   · 직전이 블로거였으면 이번엔 앞 레인 · 아니면 블로거
 *   · 직전에 블로거가 굶었으면(위 함수) **무조건** 블로거 선두(자기교정이 교대를 이긴다)
 *
 * ⚠️ 스냅샷이 없으면(첫 배포·유실) 블로거 선두로 시작한다 — 백로그가 가장 큰 레인이라 손해가 적다.
 */
export function pickNaverFirst(prev: { led?: string; naver?: { selected?: number; tried?: number } } | null | undefined): boolean {
  if (starvedLastRound(prev)) return true
  return prev?.led !== 'naver'
}

/**
 * 🔀 **병합 메모(2026-07-29)**: 이 브랜치도 같은 12:00 실측(`selected 13 · tried 0 · spent 18/45 ·
 *   deadline_hit`)에서 독립적으로 같은 수리를 했다(`sliceDeadline`, bio 25%/yt 50% 고정 분할).
 *   **main 판을 채택하고 이쪽을 버린다** — 같은 것을 두 벌 두면 조용히 갈라지고, main 판이 더 낫다:
 *   고정 분할이 아니라 **바닥(floor)** 이라 앞 레인이 일찍 끝나면 남은 시간이 그대로 블로거에게 가고,
 *   `ADS_ENRICH_NAVER_FLOOR_PCT` 로 조정까지 된다.
 * ⏱️ **앞 레인(링크인바이오 + 유튜브)에 씌우는 사전 마감** — 블로거 레인의 시간 바닥을 보장한다.
 *
 *   왜 필요한가 (2026-07-29 라이브 실측, 배포가 없던 12:00 회차):
 *     `yt: 14 · naver { selected: 13, tried: 0 } · spent: 18/45 · deadline_hit: true · elapsed 23.4s`
 *   **예산이 27 이나 남았는데 시간이 먼저 끝났다.** 세 단계가 순차이고 마감을 하나로 공유하니,
 *   맨 뒤에 선 블로거 레인은 앞 레인이 느린 회차에 **선택만 하고 한 명도 못 재고 반환**한다
 *   (`selected 13 · tried 0` 이 정확히 그 모양 — SELECT 비용만 쓰고 13명을 통째로 버렸다).
 *   같은 날 10:00 회차는 elapsed 16.0s 라 블로거가 13명을 다 쟀다 — 즉 **유튜브 지연에 따라
 *   동전 던지기**가 되고 있었고, 하필 미측정 백로그의 88%(26,694명)가 블로거 쪽이다.
 *
 *   ⚠️ 예산(`budget.left`) 배분으로는 못 고친다 — 이번 회차의 병목은 예산이 아니라 **벽시계**였다.
 *   `naverRoomFromRemaining`(위)이 남은 예산을 넘겨주도록 이미 고쳐 놨는데도 0 명이 나온 이유가 이것이다.
 *
 *   설계: 고정 분할이 아니라 **바닥(floor)** 이다. 앞 레인은 창의 (100−floor)% 까지 쓸 수 있고,
 *   일찍 끝나면 남은 시간은 그대로 블로거가 가져간다(복원 후 원래 마감으로 돌아가므로).
 *   즉 앞 레인은 **블로거를 통째로 굶길 때만** 손해를 본다.
 */
/**
 * 📐 블로거 시간 바닥의 **기본 비율** — 2026-07-29 16:00 A/B 실측으로 40 → 70.
 *
 * 인접한 두 깨끗한 회차(배포 겹침 없음)가 앞 단계 몫의 대가를 그대로 보여줬다:
 * ```
 *   15:00 블로거 선두 : yt  0 · naver{선택 22, 측정 22} · spent 44/45 · elapsed  8.3s
 *   16:00 유튜브 선두 : yt 14 · naver{선택 18, 측정  6} · spent 19/45 · elapsed 22.0s
 * ```
 * 유튜브 14채널을 얻는 대가로 **블로거 12명이 선택만 되고 버려졌고**(선택 18 · 시도 6),
 * 예산은 26이나 남은 채 시간이 끝났다. 백로그 비율이 이 배분을 정당화하지 않는다 —
 * 블로거 미측정 **27,324**(계속 증가) vs 유튜브는 그 1/4 수준이고 대부분 이미 규모 값을 갖고 있다.
 * 게다가 측정의 값어치도 다르다: 블로거 측정은 **이메일 수율 50~59%**(실측)를 내고,
 * 유튜브 측정은 대개 이미 있는 구독자/조회수를 갱신한다.
 *
 * ⚠️ 이 값이 **못 고치는 것**: `elapsed` 가 창을 넘는 것(16:00 은 22.0s). 사전 마감은
 *    *"언제까지 새 일을 시작하나"* 만 정하고 진행 중인 fetch 는 못 끊는다(최대 8s 초과).
 *    그래서 라운드 수(체인 수명 ~30s 에 종속)는 이 값으로 안 늘어난다 — 그건 창 크기
 *    (`ADS_ENRICH_DEADLINE_MS`)의 문제이고 별도 판단이다.
 *
 * ⚠️ 환경변수가 이미 설정돼 있으면 이 기본값은 안 쓰인다(env 우선). 실제 적용 여부는
 *    다음 회차의 `naver.tried` 증가로 확인할 것.
 */
export const NAVER_FLOOR_PCT_DEFAULT = 70

export function frontStageDeadline(started: number, deadlineMs: number, naverFloorPct: number): number {
  const pct = Math.min(80, Math.max(10, Number.isFinite(naverFloorPct) ? naverFloorPct : NAVER_FLOOR_PCT_DEFAULT))
  const window = Math.max(0, Number.isFinite(deadlineMs) ? deadlineMs : 0)
  return started + Math.floor((window * (100 - pct)) / 100)
}

/**
 * 🔗 체인 합산 — **순수 함수**(유닛으로 고정).
 *
 *   `depth === 0` 은 새 체인의 시작이라 **리셋**한다. 이어 붙이면 어제 회차가 오늘 합계에 섞여
 *   "이번 정각에 무슨 일이 있었나"를 다시 못 보게 된다(그게 애초에 이 값을 만든 이유다).
 *
 *   ⚠️ 앞 체인의 잔재를 물려받지 않으려고 **prev 의 chain 을 depth 0 에서는 아예 안 읽는다.**
 *      이전 체인이 중간에 죽어 `rounds` 가 3에 멈춰 있어도 새 정각은 1부터 센다.
 */
export function rollupChain(
  prev: EnrichChainRollup | undefined,
  depth: number,
  round: { bio: number; yt: number; naver: NaverEnrichDiag; spent: number; deadlineHit: boolean; at: string; roundsPlanned?: number },
): EnrichChainRollup {
  const d = Number.isFinite(depth) && depth > 0 ? Math.floor(depth) : 0
  const base: EnrichChainRollup = d === 0 || !prev
    ? { rounds: 0, max_depth: 0, bio: 0, yt: 0, naver_selected: 0, naver_tried: 0, naver_measured: 0, naver_contacts: 0, deadline_hits: 0, spent: 0, started_at: round.at }
    : prev
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
  const planned = Number.isFinite(round.roundsPlanned) && (round.roundsPlanned as number) > 0
    ? Math.floor(round.roundsPlanned as number)
    : base.rounds_planned   // 로컬 호출(계획 미전달)이 앞 라운드의 계획을 지우지 않게
  return {
    rounds: n(base.rounds) + 1,
    ...(planned ? { rounds_planned: planned } : {}),
    max_depth: Math.max(n(base.max_depth), d),
    bio: n(base.bio) + n(round.bio),
    yt: n(base.yt) + n(round.yt),
    naver_selected: n(base.naver_selected) + n(round.naver.selected),
    naver_tried: n(base.naver_tried) + n(round.naver.tried),
    naver_measured: n(base.naver_measured) + n(round.naver.measured),
    naver_contacts: n(base.naver_contacts) + n(round.naver.contacts),
    deadline_hits: n(base.deadline_hits) + (round.deadlineHit ? 1 : 0),
    spent: n(base.spent) + n(round.spent),
    started_at: base.started_at || round.at,
  }
}



/** 유튜브 성과 보강의 **일일 units 카운터**(검색과 같은 10,000 풀을 나눠 쓴다). "YYYY-MM-DD:count". */
const YT_PERF_UNITS_KEY = 'ads_yt_perf_units'
/** 기본 일일 상한 — 실측(검색 22회=2,200 units)에 비춰 넉넉하되, 검색이 자기 예산을 다 써도 여유가 남는 값.
 *  검색 예산(`ADS_YT_SEARCH_BUDGET`, 기본 90회=9,000 units)을 크게 올릴 때는 이 값을 함께 낮출 것.
 *  ⚠️ 이제 이 값은 **바닥**이다 — 실사용이 적으면 아래 `resolveYtPerfCap` 이 남는 쿼터를 얹어 준다. */
const YT_PERF_UNITS_DEFAULT = 2000

/** 유튜브 일일 쿼터(프로젝트 기본). 검색과 성과가 **같은 풀**을 나눠 쓴다. */
export const YT_DAILY_QUOTA_UNITS = 10_000
/** 검색에게 항상 남겨 두는 몫(units). 30회 분량 — 실측 사용량 22회를 넉넉히 덮는다. */
export const YT_SEARCH_FLOOR_UNITS = 3_000
/** search.list 1회 비용(units). */
export const YT_SEARCH_UNIT_COST = 100

/**
 * 📈 **성과 측정의 일일 상한 — 검색이 안 쓴 몫을 넘겨받는다** (2026-08-03 라이브 실측).
 *
 * ## 무엇이 문제였나
 * ```
 *   유튜브 쿼터 10,000/일
 *     검색  배정 9,000(90회)  ·  실사용 2,200(22회)   ← 6,800 유휴
 *     성과  배정 2,000        ·  실사용 2,003         ← 소진 → 그날 남은 시간 측정 0
 *     총 사용 4,200 (42%)
 * ```
 * 위 상수 주석은 *"검색 예산을 크게 **올릴** 때는 이 값을 낮출 것"* 이라고 한 방향만 대비했다.
 * **반대(검색이 배정을 안 쓰는 경우)** 는 안 봤고, 실제로 그쪽이 일어났다 — 키워드 쿨다운·고갈 억제가
 * 검색을 하루 22회로 눌러 두기 때문이다. 그 사이 **수율이 가장 높은 축**(YT 45.2% vs 블로그 28.6%)이 멎었다.
 *
 * ## 규칙
 * `상한 = clamp(총쿼터 − max(검색실사용, 검색바닥), 기본값, 총쿼터 − 검색바닥)`
 *   · **검색 바닥을 항상 지킨다** — 성과가 아무리 굶주려도 검색이 못 도는 일은 없다.
 *   · 검색이 많이 쓴 날은 상한이 **자동으로 줄어든다**(같은 풀이므로).
 *   · **기본값(2,000) 밑으로는 안 내려간다** — 오늘보다 나빠지는 경우를 구조적으로 막는다.
 *     🩸 단, **남은 쿼터를 넘을 수는 없다**(2026-08-03 대표 질문 *"무료 한도 안에서 쓰고 있는 게 맞나"* 로 발견).
 *     이 바닥을 무조건 보장하면 `검색 9,000 + 성과 2,000 = 11,000 > 10,000` 이 성립한다 — 검색 배정이
 *     90회(9,000)라 **설정상 도달 가능한 조합**이다(실사용 2~28회라 오늘의 위험은 아니지만 구조는 남는다).
 *     ⇒ 바닥도 `min(기본값, 총쿼터 − 검색실사용)` 으로 깎는다. 남은 게 0이면 성과도 0이다.
 *     초과의 대가는 청구서가 아니라 **403 quotaExceeded** 다 — 돈이 아니라 그날 측정이 멎는 게 손해다.
 *
 * ⚠️ 이 함수가 **못 보는 것**: 성과가 하루 앞부분에 상한을 다 써 버리면 검색이 바닥(3,000)만 갖는다.
 *   실측 22회(2,200)면 여유가 있지만, 검색 키워드를 크게 늘리면 `YT_SEARCH_FLOOR_UNITS` 를 함께 올릴 것.
 * ⚠️ 명시 env(`ADS_YT_PERF_UNITS`)가 있으면 그 값이 이긴다(수동 개입이 자동보다 우선 — 레포 규약).
 */
export function resolveYtPerfCap(searchUsedUnits: number, envRaw?: unknown): number {
  const explicit = parseInt(String(envRaw ?? ''), 10)
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(9000, explicit)
  const used = Number.isFinite(searchUsedUnits) ? Math.max(0, Math.floor(searchUsedUnits)) : 0
  const reserved = Math.max(used, YT_SEARCH_FLOOR_UNITS)
  const ceiling = YT_DAILY_QUOTA_UNITS - YT_SEARCH_FLOOR_UNITS
  // 🚧 바닥도 **실제 남은 쿼터**를 못 넘는다 — 검색이 이미 8,000+ 를 썼는데 2,000 을 보장하면 총합이 10,000 을 넘는다.
  const floor = Math.min(YT_PERF_UNITS_DEFAULT, Math.max(0, YT_DAILY_QUOTA_UNITS - used))
  return Math.min(ceiling, Math.max(floor, YT_DAILY_QUOTA_UNITS - reserved))
}

/**
 * 🔎 오늘 **검색**이 몇 회 돌았나 — 수집 레인이 쓰는 `ads_yt_search_used`("YYYY-MM-DD:count", PT 기준일).
 *   성과 상한을 검색 실사용에 맞춰 정하기 위해 읽는다(같은 10,000 풀을 나눠 쓰므로).
 *   ⚠️ 값이 없거나 날짜가 다르면 0 — 그러면 성과가 최대치를 받는다(검색이 아직 안 돈 날의 정상 동작).
 */
async function readYtSearchCalls(DB: D1Database, day: string): Promise<number> {
  const raw = await readSetting(DB, 'ads_yt_search_used')
  if (!raw) return 0
  const i = raw.indexOf(':')
  return i > 0 && raw.slice(0, i) === day ? Math.max(0, parseInt(raw.slice(i + 1), 10) || 0) : 0
}

/** 오늘 남은 perf units — 날짜가 바뀌면 자동으로 0부터(문자열 앞의 날짜가 키). */
async function readPerfUnitsUsed(DB: D1Database, day: string): Promise<number> {
  const raw = await readSetting(DB, YT_PERF_UNITS_KEY)
  if (!raw) return 0
  const i = raw.indexOf(':')
  return i > 0 && raw.slice(0, i) === day ? Math.max(0, parseInt(raw.slice(i + 1), 10) || 0) : 0
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
/**
 * @param slice 여러 자식이 **동시에** 돌 때 각자 맡을 조각(`id % k = i`). 없거나 `k<=1` 이면 기존 동작.
 *   근거는 `sliceClause`(influencer-performance) 주석 — 이 큐는 선점이 아니라 정렬+LIMIT 이라
 *   조각 없이 병렬로 돌리면 같은 사람을 여러 자식이 중복 측정한다.
 */
export async function runInfluencerEnrich(
  env: Env, depth = 0, roundsPlanned?: number, slice?: EnrichSlice | null,
  /**
   * 🧭 호출자가 이 라운드의 성격을 알려 준다. 지금은 창(deadline)만 갈린다 —
   *   cron 은 부모 수명(10.5초)에 묶이지만 **알람은 자기 인보케이션**이라 더 오래 산다(위 상수 주석).
   */
  opts?: {
    driver?: 'cron' | 'alarm'
    /**
     * 📗 **네이버/티스토리만 돈다**(링크인바이오·유튜브 건너뜀) — 측정 샤딩용 (2026-08-09, 대표 승인).
     *
     * `slice` 는 네이버·티스토리 조회에만 들어간다 — `enrichYouTubePerformance` 는 `slice` 를 안 받는다.
     * 그래서 샤드를 그냥 늘리면 **YT 만 샤드마다 통째로 반복**되어 이미 초과인 일 쿼터를 배로 태운다.
     * ⇒ 샤드 0 만 앞 레인(bio+YT)을 맡고 **샤드 1+ 는 네이버만** 돈다(백로그의 98%가 네이버다).
     * 근거·실측·샤드 수 조정법은 SSOT: `worker-ads/lane-alarm-runners.ts` `ENRICH_SHARDS`.
     *
     * ⚠️ YT 에 `slice` 를 배선하면 이 스위치는 필요 없어진다(그땐 YT 도 갈라져 총 호출량 불변).
     */
    naverOnly?: boolean
  },
): Promise<InfluencerEnrichSnapshot> {
  const DB = adsLeadsDb(env)
  const started = Date.now()
  await ensureInfluencerSchema(DB)   // bio_checked_at · perf_checked_at · recent_posts_30d
  await ensurePerfExtraColumns(DB)   // last_post_at (블로거 마지막 글 날짜)

  const envBudget = Math.min(900, Math.max(10, envLaneBudget(env.ADS_INFLUENCER_ENRICH_BUDGET, 45, env)))
  const learnedCap = Math.max(0, parseInt((await readSetting(DB, subreqCapKey('influencer_enrich'))) || '', 10) || 0)
  // 🧱 플랫폼 천장 — 학습 상한이 이 값을 넘지 못한다(기본 60, 근거·조정법은 collect-budget 주석).
  const pcap = envSubreqCap(env)
  const budgetTotal = resolveSubreqBudget(envBudget, learnedCap, pcap)
  /**
   * ⏱️ 벽시계 가드 — 서브리퀘스트가 남아도 시간이 인보케이션을 끝낸다.
   *   파트너풀 레인과 같은 env 를 공유(둘 다 "보강 1라운드 상한"이라 의미가 같다).
   *
   * 🩸 **기본값 20s → 7s** (2026-08-02 KST 실측). cron 경로에서 **20초 창은 도달 불가능**했다:
   *   부모 인보케이션이 약 **10.5초**에 회수되고, 그 순간 살아 있던 자식이 전부 함께 죽는다
   *   (피호출자는 호출자보다 오래 못 산다 — #874 의 규칙이 여기서 상한으로 나타난다).
   *
   *   두 틱 연속 **성공 최대 8,316ms / 8,050ms ↔ 실패 최소 10,505ms · 겹침 0**, 실패는 전부 같은 초에 몰림.
   *   이 레인의 마지막 기록도 `elapsed 21,899ms · deadline_hit true` — 창을 다 쓰고 죽은 모양 그대로다.
   *   그래서 `enrich_lane.last_run` 이 며칠째 멈춰 있었다(스냅샷 쓰기 전에 죽으니 기록이 안 남는다).
   *   ⚠️ 수동 트리거(어드민 요청 경로)에서는 13.1초·17.2초로 **멀쩡히 돌았다** — 부모 cron 수명에 안 묶이기
   *     때문이다. "레인이 멀쩡한데 cron 에서만 죽는" 비대칭의 정체가 이것이다.
   *
   * ⚠️ **이 값만으로는 부족하다.** 마감은 *항목 사이*에서만 검사되는데 블로그 fetch 는 건당 최대 8s라,
   *   6.9초에 시작한 한 건이 14.9초에 끝나면 여전히 절단된다. 건당 타임아웃(8s)도 함께 내려야 완결인데,
   *   그건 수집 품질에 직접 닿아(느린 블로그를 놓친다) `naver.failed` 분포를 보고 정할 일이다 — 아직 안 했다.
   *   그때까지 이 값은 **"항상 죽음" → "대개 산다"** 로 옮기는 것까지만 한다.
   *
   * ⚠️ env 로 언제든 되돌린다(`ADS_ENRICH_DEADLINE_MS`). 상한 10.5초가 플랫폼/플랜에 따라 달라지면
   *   이 기본값도 다시 재야 한다 — 숫자를 믿지 말고 **성공 max ↔ 실패 min 경계**를 다시 측정할 것.
   */
  // ⏱️ 명시 env 가 있으면 그게 이긴다(레포 규약). 없을 때만 드라이버별 기본값이 갈린다.
  const deadlineMs = (env as unknown as { ADS_ENRICH_DEADLINE_MS?: string }).ADS_ENRICH_DEADLINE_MS
    ? envEnrichDeadlineMs(env)
    : (opts?.driver === 'alarm' ? ENRICH_DEADLINE_MS_ALARM : envEnrichDeadlineMs(env))
  const budget: FetchBudget = { left: budgetTotal, deadline: started + deadlineMs }
  const { bioMax, naverMax, ytMax } = planInfluencerEnrich(budgetTotal)
  // 📈 유튜브 성과 — 서브리퀘스트(위 예산)와 **일일 units**(검색과 공유하는 10,000 풀) 둘 다 통과해야 돈다.
  const ytDay = ytQuotaDayKey(started)
  // 📈 상한은 **고정이 아니라 검색 실사용의 나머지**다(위 `resolveYtPerfCap` 의 실측 근거).
  //   검색 카운터는 회차 수라 units 로 환산해서 넘긴다(search.list 1회 = 100 units).
  const ytSearchCalls = await readYtSearchCalls(DB, ytDay)
  const ytUnitCap = resolveYtPerfCap(ytSearchCalls * YT_SEARCH_UNIT_COST, env.ADS_YT_PERF_UNITS)
  const ytUnitsUsed = await readPerfUnitsUsed(DB, ytDay)
  const ytRoom = Math.max(0, ytUnitCap - ytUnitsUsed)

  let bio = 0
  let yt = 0
  let naver: NaverEnrichDiag = { tried: 0, measured: 0, contacts: 0, failed: 0, emails: 0 }
  let tistory: TistoryEnrichDiag = { tried: 0, measured: 0, contacts: 0, failed: 0, emails: 0 }
  let limitHit = false
  let crash: string | undefined
  const note = (err: unknown) => {
    const e = err as { name?: string; message?: string } | null
    const msg = `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}`
    if (isSubrequestLimitError(msg)) limitHit = true
    if (!crash) crash = msg
  }
  const naverFloorPct = parseInt((env as unknown as { ADS_ENRICH_NAVER_FLOOR_PCT?: string }).ADS_ENRICH_NAVER_FLOOR_PCT || '', 10) || NAVER_FLOOR_PCT_DEFAULT
  /**
   * 🔁 **라운드마다 선두를 교대한다** — 사전 마감만으로는 부족했다(2026-07-29 13:00 실측).
   *
   *   `frontStageDeadline`(앞 레인에 60% 상한)을 넣은 뒤에도 결과는 그대로였다:
   *     `naver { selected: 12, tried: 0 } · deadline_hit: true · elapsed 20.8s · spent 19/45`
   *   이유는 그 함수의 docblock 이 이미 경고한 그것이다 — **중단은 건 사이에서만** 일어난다.
   *   YT 한 건이 마감 직전(11.9s)에 시작해 타임아웃(~9s)을 물면 20.8s 에 끝나고, 블로거 창은 사라진다.
   *   상한을 더 낮춰도 같은 일이 벌어진다(한 건이 창보다 길 수 있으므로 **상한으로는 못 막는 종류**다).
   *
   *   ⇒ 자원을 나누는 대신 **순서를 돌린다.** 홀수 라운드는 블로거가 먼저 — 마감을 통째로 쓰고,
   *     앞 레인이 남은 시간을 가져간다. 체인이 depth 2+ 로 도는 것이 확인됐으니(같은 틱 `depth: 2`)
   *     틱마다 블로거 선두 라운드가 최소 한 번은 온다.
   *
   *   오늘 네 번째로 만난 같은 병이다 — **줄을 세우면 꼬리가 굶는다.** 앞선 세 번(예산·시계·순번)은
   *   '몫을 보장'해서 풀었는데, 여기서는 몫이 원자적이지 않아 실패했다. 그럴 땐 **자리를 바꾸는 것**이 답이다.
   */
  // 📖 직전 회차 스냅샷 — **선두 결정과 누적 합계 둘 다** 쓴다(읽기 1회, 추가 비용 0).
  //   예전엔 마지막에만 읽었는데, 선두 결정이 이 값을 필요로 해서 앞으로 옮겼다.
  const prev = await readSnapshot(DB)
  // ⚠️ `ytUnits` 는 **바깥 스코프**여야 한다 — 아래 스냅샷의 `yt_units` 가 읽는다.
  //   선두 교대를 넣으며 헬퍼 안에 가뒀다가 타입 에러가 났다(CI 가 잡음, npm 403 으로 로컬 tsc 미실행).
  let ytUnits = 0; let fellBack = false   // ♻️ fellBack = 여력 자동배치 발동(스냅샷 `fell_back`)
  //   🩹 2026-07-29 보강 — `depth % 2` **하나로는 발화 못 하는 회차**가 있다. 위 주석은 "체인이 depth 2+ 로
  //   도는 것이 확인됐다"를 전제하는데, 배포(13:38) 이후 14:00 틱 실측은 **`depth: 0`** 이었다
  //   (`naver { selected 12, tried 0 }` 그대로). 체인이 한 라운드에서 끊기면 depth 는 영원히 0 이고,
  //   `0 % 2 === 1` 은 항상 거짓이라 **교대가 한 번도 안 일어난다.** 전제가 깨지면 처방도 같이 죽는 형태다.
  //   ⇒ 직전 회차가 실제로 굶었으면(`selected > 0 && tried === 0`) 깊이와 무관하게 선두를 넘긴다.
  //   둘은 서로를 보완한다: 체인이 정상이면 결정적 교대가 반반을 보장하고, 끊겨도 자기교정이 받는다.
  const naverFirst = pickNaverFirst(prev)   // 🔀 깊이가 아니라 직전 선두로 교대(위 docblock — 알람은 depth 가 항상 0)
  /** 📈 이 회차 YT 가 쓸 예정인 서브리퀘스트(행당 1 + 배치콜 1). 블로거 선두 회차의 예약분으로 쓴다. */
  const ytPlanned = (ytMax > 0 && ytRoom > 0 && env.YOUTUBE_API_KEY) ? Math.min(ytMax, ytRoom) + 1 : 0
  const runNaver = async (ytReserve = 0): Promise<void> => {
    /**
     * 📗 **티스토리 — 기본 0(접힘)**. 2026-08-03 에 신설했다가 **다음 날 실측으로 접었다**:
     *   측정 397 → 이메일 12(3.0%) vs 네이버 26.7% · 유튜브 40.6%. 근거 전문은 `TISTORY_ROOM` docblock.
     *   ⚠️ 호출 자체는 남긴다 — `room 0` 이면 안 돌고, `ADS_TISTORY_ROOM` 으로 즉시 되살아난다.
     */
    const tisRoom = tistoryRoom(env)
    if (tisRoom > 0) {
      try { tistory = await enrichTistoryActivity(DB, budget, tisRoom, slice, env) } catch (err) { note(err) }
    }
    // 📝 블로거 — 백로그가 가장 큰 레인(풀의 74%). 이 시점의 **실제 잔여**로 몫을 다시 계산한다.
    try { naver = await enrichNaverActivity(DB, budget, naverRoomWithYtReserve(budget.left, naverMax, ytReserve), slice, env) } catch (err) { note(err) }
  }
  const runFront = async (): Promise<void> => {
    // 🔗 링크인바이오(건당 1 fetch) → 📈 유튜브 성과(남은 일일 units 안에서만).
    try { bio = await enrichPoolFromLinkInBio(DB, budget, bioMax) } catch (err) { note(err) }
    const beforeYt = budget.left
    if (ytMax > 0 && ytRoom > 0 && env.YOUTUBE_API_KEY) {
      try { yt = await enrichYouTubePerformance(env.YOUTUBE_API_KEY, DB, budget, Math.min(ytMax, ytRoom)) } catch (err) { note(err) }
    }
    ytUnits = Math.max(0, beforeYt - budget.left)
    if (ytUnits > 0) await writeSetting(DB, YT_PERF_UNITS_KEY, `${ytDay}:${ytUnitsUsed + ytUnits}`).catch(() => undefined)
  }

  // 📗 **네이버 전용 샤드** — 앞 레인(bio+YT)을 통째로 건너뛴다(위 `naverOnly` docblock).
  //   예약분 0: 이 회차엔 YT 가 없으므로 블로거가 창을 전부 쓴다.
  if (opts?.naverOnly) {
    await runNaver(0)
    // ♻️ 여력 자동배치 — 블로그가 마르면 남은 예산을 링크인바이오가 가져간다(근거는 `shouldFallbackToFront`).
    if (shouldFallbackToFront({ selected: naver?.selected, budgetLeft: budget.left })) {
      fellBack = true
      try { bio = await enrichPoolFromLinkInBio(DB, budget, bioMax) } catch (err) { note(err) }
    }
  } else if (naverFirst) {
    // 📌 YT 예약분을 떼고 준다 — 안 그러면 이 회차 YT 는 0행이다(위 `naverRoomWithYtReserve` docblock).
    await runNaver(ytPlanned) // 마감 전체를 블로거가 쓴다
    await runFront()          // 남은 시간은 앞 레인이
  } else {
    // 짝수 라운드는 종전대로 — 앞 레인에 사전 마감을 씌워 블로거 시간 바닥을 보장한다.
    budget.deadline = frontStageDeadline(started, deadlineMs, naverFloorPct)
    await runFront()
    budget.deadline = started + deadlineMs // ⏱️ 사전 마감 해제 — 남은 창 전부를 블로거가 쓴다.
    await runNaver()
  }

  const spent = budgetTotal - budget.left
  const deadlineHit = Date.now() >= (budget.deadline || Infinity)
  // 🩹 학습 상한 자가 교정 — **항상 이 지점에 도달한다**(레인 예외를 위에서 삼켰으므로).
  //   파트너풀 레인이 "쓰기가 마지막 단계 뒤에 갇혀 학습을 한 번도 못 하던" 사고를 여기서 반복하지 않는다.
  const cap = nextSubreqCap(budgetTotal - budget.left, limitHit, learnedCap, envBudget, pcap)
  if (cap != null) await writeSetting(DB, subreqCapKey('influencer_enrich'), String(cap)).catch(() => undefined)

  // 📖 prev 는 위(선두 결정 지점)에서 이미 읽었다 — 여기서 다시 읽지 않는다(읽기 1회 유지).
  const stamp = nowStamp()
  const snap: InfluencerEnrichSnapshot = {
    last_run: stamp, bio, yt, naver, spent, budget_total: budgetTotal, depth,
    // 🔀 이번 회차의 선두 — 다음 회차가 이걸 보고 번갈아 간다(`pickNaverFirst`). 알람엔 depth 가 없다.
    led: naverFirst ? 'naver' : 'front',
    ...(fellBack ? { fell_back: true as const } : {}),
    // 📗 티스토리 — 이 환경에선 tistory.com 이 프록시 차단이라 **라이브 diag 가 유일한 판정 근거**다.
    //   measured 가 계속 0 → RSS 경로가 틀림 · contacts/emails 가 계속 0 → 홈에 연락처가 없음(경로를 접을 것).
    tistory,
    // 📈 YT 실제 처리 행수 — units 대비 효율(콜/행)을 밖에서 볼 수 있어야 한다.
    //   실측에서 19콜/행이 나왔는데 코드상 2~3콜이라, 이 값 없이는 원인을 못 가린다.
    yt_rows: yt,
    // 🔗 이번 정각 전체의 합 — 마지막 라운드 한 장으로 판정하던 오독을 끝낸다(위 `chain` 주석의 실측 근거).
    chain: rollupChain(prev?.chain, depth, { bio, yt, naver, spent, deadlineHit, at: stamp, roundsPlanned }),
    limit_hit: limitHit, deadline_hit: deadlineHit, elapsed_ms: Date.now() - started,
    yt_units: { used: ytUnitsUsed + ytUnits, total: ytUnitCap, day: ytDay },
    total_measured: (prev?.total_measured || 0) + naver.measured + yt + tistory.measured,
    total_contacts: (prev?.total_contacts || 0) + naver.contacts + bio + tistory.contacts,
    // 📧 누적 이메일 — 측정 스프린트가 '쓸 수 있는' 리드를 만드는지 판정하는 값(연락처 누적과 나란히 본다).
    total_emails: (prev?.total_emails || 0) + (naver.emails || 0),
    ...(crash ? { crash, crash_at: nowStamp() } : {}),
  }
  await writeSetting(DB, INFLUENCER_ENRICH_SNAPSHOT_KEY, JSON.stringify(snap)).catch(() => undefined)
  return snap
}
