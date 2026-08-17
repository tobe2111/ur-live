import { YT_SEARCH_BUDGET_DEFAULT, ytQuotaDayKey, YT_USED_KEY } from './influencer-yt-quota'

/**
 * 📏 **한 회차를 얼마나 넓게 돌 것인가** — 폭 정책 전용 모듈(순수, DB·fetch 없음).
 *
 *   `influencer-keyword-rotation.ts` 에서 분리 (2026-08-12, 600줄 래칫). 이 관심사는 그 자체로 하나다 —
 *   폭은 예산·YT 쿼터·측정 처리량이라는 **레포 밖 사실**에 묶여 있어서, 배분(누구에게 주나)과는
 *   바뀌는 이유가 다르다. 호환을 위해 원 모듈이 이 심볼들을 그대로 재수출한다.
 */

/**
 * 🧊 **회차당 키워드 상한 — "폭 동결"** (2026-08-04, 대표 승인 "①만 진행").
 *
 * ## 왜 남은 예산으로 키워드를 더 돌리지 않는가
 * 위 `NAVER_COLLECT_ENRICH_MAX` 축소로 키워드당 비용이 ~10.4 → ~6 이 된다. 그대로 두면 루프가
 * **자동으로 회차당 5개 → 9개**를 돌아 커버리지가 1.8배가 된다. 매력적으로 들리지만 **지금 하면 손해다**:
 * ```
 *   블로그  유입 3,895/일  vs  측정 4,184/일   →  여유 +289 (백로그 19,963 → 69일)
 *   폭을 1.8배로 넓히면 유입 ~7,000/일  →  백로그가 **매일 +2,800 으로 증가 반전**
 * ```
 * 새 행은 이메일 1.3% 이고 그걸 25% 로 만드는 것이 측정인데, **측정이 병목**이다.
 * ⇒ 폭을 넓히면 행 수만 늘고 **발송 가능 리드는 거의 안 는다.** 지금 병목은 수집이 아니다.
 *
 * ## 🔓 6 → 9 (2026-08-11 — 대표 승인 "폭 9로 올려")
 * 위 해제 조건("측정 처리량이 올라간 뒤")이 **숫자로 충족**된 뒤의 승인이다:
 * ```
 *   측정 8,018/일(샤딩 2배 실측, 이후 4배 확대) > 유입 5,045/일 · 백로그 감소 중 · blocked 0
 *   §16 판정: 신규 키워드 79개 전원 saved≥10(평균 119) — 수율은 문제가 아니었고,
 *   경보 원문 "예산 37/56 · 키워드 6/16 처리" = 예산 19를 남기고 폭 상한에서 정지 — 폭이 캡이었다
 * ```
 * 9 = 동결 당시 주석이 "자동 확대되면 도달했을 값"으로 지목한 그 수(회수된 enrichMax 예산의 자연 폭).
 * ⚠️ 네이버 검색 호출 ~50% 증가 — **하루 뒤 `ads_naver_crawl_block.blocked` 0 유지 + 발굴량 상승을
 *   판정**하고, 차단이 뜨면 즉시 6 으로 되돌린다(이 상수 하나가 롤백 전부다).
 * ⚠️ 추가 상향(9 초과)은 다시 대표 판단 사항이다 — 테스트가 9 를 상한으로 잠근다.
 */
export const COLLECT_KEYWORDS_PER_ROUND = 9

/**
 * 회차당 키워드 상한 — env(`ADS_COLLECT_KEYWORD_CAP`)로 재배포 없이 조정 가능(1~40).
 * ⚠️ 파라미터가 `unknown` 인 이유: 워커 `Env` 타입에 이 키가 선언돼 있지 않아 좁은 구조 타입으로 받으면
 *   **TS2559**("공통 속성이 없다")가 난다. `alarmEnabled(env: unknown)` 과 같은 형태로 맞춘다.
 */
export function keywordsPerRoundCap(env: unknown): number {
  const raw = parseInt(String((env as { ADS_COLLECT_KEYWORD_CAP?: string } | undefined)?.ADS_COLLECT_KEYWORD_CAP ?? ''), 10)
  return Number.isFinite(raw) && raw > 0 ? Math.min(40, raw) : COLLECT_KEYWORDS_PER_ROUND
}

/**
 * 🌙 **YT 쿼터 소진 회차의 폭** — 유휴 예산을 네이버 전용으로 회수 (2026-08-12 대표 승인 "응 해").
 *
 * ## 왜 다른 값이 필요한가 (라이브 실측 2026-08-12 06:00 회차)
 * ```
 *   picks {planned 9, processed 9}   spent 29 / budget_total 56    ← 예산 27 유휴
 *   diag.yt.error "QUOTA: 오늘 YT 검색 예산(90회) 소진"   yt_calls 전부 0
 * ```
 * YT 검색 쿼터(일 90회)는 하루의 이른 시간에 소진되고, **그 뒤의 회차는 네이버 전용**이다.
 * 키워드당 비용이 YT 동반 회차의 3분의 1(실측 29/9 ≈ 3.2)이라 같은 예산으로 훨씬 넓게 돌 수 있는데,
 * 폭 9 에서 멈춰 **예산 절반을 남기고 끝났다.** 즉 이 시간대의 캡은 예산이 아니라 폭이었다.
 *
 * ## 규칙 — 이 값은 목표가 아니라 **런어웨이 방지 뚜껑**이다
 * 실제 상한은 여전히 서브리퀘스트 예산(`budget.left <= 0` 이 루프를 끊는다)과 계획 폭(`planRoundWidth`)이다.
 * 이 상수는 그 둘이 모두 커졌을 때의 안전 뚜껑일 뿐이다 — 예산 56 / 키워드당 ~3.2 ≈ 17.
 *
 * ⚠️ **YT 가 살아 있는 회차는 무접촉**(`COLLECT_KEYWORDS_PER_ROUND` = 9). 그 회차는 지금도 예산이
 *   캡이라(실측 56/56) 폭을 올려도 아무것도 안 늘고, 올리면 YT 쿼터만 더 빨리 태운다.
 * ⚠️ 해제 근거(2026-08-12 실측): 측정 22,764/일 > 유입 6,434/일(3.5배 여유) · 미측정 백로그 6,262 중
 *   4,011 은 끈 트랙(카페·티스토리·YT)이라 실제 백로그는 ~8시간분 · `blocked 0` · 네이버 쿼터 0.3%.
 *   ⇒ 폭 동결의 원래 사유("측정이 병목")가 **더 이상 사실이 아니다**.
 * ⚠️ 차단이 뜨면(`ads_naver_crawl_block.blocked > 0`) 이 상수를 9 로 되돌리는 것이 롤백 전부다.
 */
export const COLLECT_KEYWORDS_PER_ROUND_NAVER_ONLY = 18

/** YT 쿼터 소진 회차의 상한 — env(`ADS_COLLECT_KEYWORD_CAP_NAVER_ONLY`)로 재배포 없이 조정(1~40). */
export function naverOnlyRoundCap(env: unknown): number {
  const raw = parseInt(String((env as { ADS_COLLECT_KEYWORD_CAP_NAVER_ONLY?: string } | undefined)?.ADS_COLLECT_KEYWORD_CAP_NAVER_ONLY ?? ''), 10)
  if (Number.isFinite(raw) && raw > 0) return Math.min(40, raw)
  // 좁은 쪽으로는 절대 안 간다 — 네이버 전용 회차가 YT 동반 회차보다 좁으면 이 수리의 의미가 없다.
  return Math.max(COLLECT_KEYWORDS_PER_ROUND, COLLECT_KEYWORDS_PER_ROUND_NAVER_ONLY)
}

/**
 * 🌙 **이 회차가 네이버 전용인가** — YT 검색을 한 번도 못 하는 회차(쿼터/예산 소진 또는 키 미설정).
 *
 *   순수 판정으로 뺀 이유: 이 한 줄이 회차의 폭과 계획 이력 선택을 **동시에** 가른다. 호출부에
 *   인라인으로 두면 조건이 조용히 갈라지고(예: 폭은 넓혔는데 계획 이력은 섞은 채) 둘 다 틀린다.
 */
export function isNaverOnlyRound(r: {
  hasYouTube: boolean
  /** 오늘 이미 쓴 YT 검색 호출 수 */ ytSearchUsed: number
  /** 이 회차가 키워드당 쓸 검색 페이지 수 */ ytPages: number
  /** 오늘의 YT 검색 예산 */ ytBudgetTotal: number
}): boolean {
  if (!r.hasYouTube) return true
  const used = Number(r.ytSearchUsed) || 0
  const pages = Math.max(1, Number(r.ytPages) || 1)
  const total = Number(r.ytBudgetTotal) || 0
  return used + pages > total
}

/**
 * 🌙 **YT 예산 상태 파싱** — 회차 형상(YT 동반/네이버 전용)을 정하려면 **배분보다 먼저** 알아야 한다.
 *
 *   `env`/`settings` 만 읽는 순수 파싱이고, 회차 폭 정책의 입력이라 이 모듈이 제자리다
 *   (`influencer-auto-collect` 를 얇게 유지 — 600줄 래칫).
 *   ⚠️ 반환 `searchUsed` 는 **오늘 분만** 센다 — 저장 형식이 `"YYYY-MM-DD:n"` 이라 날짜가 다르면 0.
 *     그 날짜 비교를 빼면 어제 소진량이 오늘로 넘어와 YT 를 하루 더 굶긴다.
 */
export function readYtBudgetState(
  env: { YOUTUBE_API_KEY?: string; ADS_YT_PAGES?: string; ADS_YT_SEARCH_BUDGET?: string },
  settings: Record<string, string | null | undefined>,
): { hasYouTube: boolean; pages: number; budgetTotal: number; day: string; searchUsed: number } {
  const hasYouTube = !!env.YOUTUBE_API_KEY
  // 기본 1페이지(1~50위) — 쿼터 안에서 깊이보다 폭(키워드·지역 커버). env ADS_YT_PAGES=2~5 로 상향.
  const pages = Math.max(1, Math.min(5, parseInt(env.ADS_YT_PAGES || '', 10) || 1))
  // 실병목은 Search Queries/day(태평양 자정 리셋) — 자동+수동이 같은 예산을 공유한다.
  const budgetTotal = Math.max(1, Math.min(100000, parseInt(env.ADS_YT_SEARCH_BUDGET || '', 10) || YT_SEARCH_BUDGET_DEFAULT))
  const day = ytQuotaDayKey(Date.now())
  let searchUsed = 0
  const raw = settings[YT_USED_KEY]
  if (raw) { const i = raw.indexOf(':'); if (i > 0 && raw.slice(0, i) === day) searchUsed = Math.max(0, parseInt(raw.slice(i + 1), 10) || 0) }
  return { hasYouTube, pages, budgetTotal, day, searchUsed }
}
