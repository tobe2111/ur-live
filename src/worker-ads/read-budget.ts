/**
 * 📉 **유어애즈 일일 읽기 예산 — 스스로 멈추는 차단기** (2026-09-02, D1 계정 일일 읽기 한도 사고 후속).
 *
 * ## 왜
 * D1 무료 읽기 한도(하루 500만 행)는 **계정 단위**다. 유어애즈 레인 하나가 폭주하면(9/2 실측: "1회 마이그레이션"이
 * 부팅마다 다시 돌아 12시간에 1억 1,500만 행) 유어딜 소비자 API 가 통째로 500 이 된다. 대표 우선순위는
 * *"유어딜이 가장 중요해. 유어애즈는 문제가 있더라도."* — 그러니 유어애즈는 **자기 몫을 넘기면 스스로 멈춰야**
 * 한다. 사람이 대시보드에서 끄는 것(`ADS_LANES_PAUSED`)은 사고가 난 **뒤**의 일이고, 이 차단기는 사고 **전**에 선다.
 *
 * ## 어떻게
 * · 원장은 **DO 인스턴스 하나**(`AdsLaneDurableObject` 의 `idFromName('read-budget')`). 레인은 회차가 끝날 때
 *   자기 계량기(`d1-read-meter`)의 `rr` 를 `/budget?rr=N` 으로 보내고, 게이트는 `/budget` 으로 상태를 읽는다.
 *   D1 을 안 거친다 — 예산 원장이 예산을 먹으면 안 된다.
 * · 하루 경계는 **UTC 자정**(= 09:00 KST) — Cloudflare 가 한도를 되돌리는 시각과 같아야 "오늘 얼마 썼나"가 맞다.
 * · 넘으면 그 날 **남은 시간 동안** 일시정지와 같은 동작(cron kick 은 등록만 · 알람은 체인만 잇고 안 돌림 ·
 *   사람 대면 두 레인은 면제). 자정이 지나면 다시 돈다. 학습 상태(runs/failStreak/runHistory)는 무접촉.
 * · 기본 150만 행(무료 한도의 30%). 유료 전환 뒤엔 "장애 방지"가 아니라 **비용 상한**이 된다 — 그때 값을 올린다.
 *   `0` 이면 끈다(무제한). ⚠️ 원장을 못 읽으면 **넘은 것으로** 본다(fail-closed) — 모르는 채 읽는 쪽이 유어딜에 더 위험하다.
 *
 * ## 못 막는 것
 * · 레인 **밖**의 읽기(서비스몰 API 요청, 부팅 마이그레이션처럼 `ensure*` 가 첫 요청에서 도는 것). 후자가 9/2 의
 *   원인이었고 그건 #1302 가 따로 막았다. 이 차단기는 **레인 회차**가 보고하는 것만 센다.
 * · 이미 시작한 회차 — 게이트는 회차 **앞**에서만 본다. 한 회차가 예산을 통째로 먹으면 그 회차는 끝까지 간다.
 *
 * 🔻 롤백: `ADS_DAILY_READ_BUDGET=0`(끔) 또는 이 모듈 호출부 3곳 제거. 원장 DO 는 남아도 무해(알람 없음).
 */
export const READ_BUDGET_ENV = 'ADS_DAILY_READ_BUDGET'
export const DEFAULT_DAILY_READ_BUDGET = 1_500_000

/**
 * ✍️ **쓰기 예산** (2026-09-02 추가 — 대표 *"$5 에서 더 추가 비용이 발생되어선 안돼"*).
 *
 * ## 왜 읽기만으로는 부족한가 (같은 날 실측)
 * 요금을 실제로 터뜨릴 뻔한 축은 읽기가 아니라 **쓰기**였다:
 * ```
 *   09-02 00~13시  업체 DB 쓴 행 시간당 210만~780만   ← "1회 마이그레이션" 무한 반복
 *   월 환산 4.8억 행 · 유료 포함분 5,000만/월 → 9.5배 초과 ≈ 월 $427
 *   09-02 13시 #1302 배포 → 14시 이후 0 · 0 · 14,969   (200배 감소)
 * ```
 * 읽기 차단기는 이걸 **못 막는다** — 그 UPDATE 들은 읽기도 많았지만, 읽기 한도를 넘기 전에
 * 쓰기 요금이 먼저 붙는 구간이 있다(포함분 비율이 읽기 250억 vs 쓰기 5,000만 = 500배 차이).
 *
 * ## 기본값 근거 — 150만 → **120만** (2026-09-03 대표 승인 "응 그렇게 하자")
 *
 * ✅ **먼저: 이 차단기는 라이브에서 실제로 돈다.** 유료 전환 첫날(9/2 UTC 날) 시간별 누적이
 * 정확히 예산에서 멈췄다 — 추측이 아니라 실측이다:
 * ```
 *   05시 KST  누적 1,511,523  ← 150만 돌파
 *   06시      누적 1,627,367
 *   07·08시   +0  +0          ← 레인 정지
 *   09시 KST(=UTC 자정)        ← 리셋 후 재개
 * ```
 * 계량기 정확도도 같은 시간대 Cloudflare 분석과 맞춰 확인했다:
 * **쓰기 원장 147,064 vs 실측 132,495(111% — 넉넉히 셈) · 읽기 95%.** 안전한 방향으로 틀린다.
 *
 * ## 왜 150만이 아니라 120만인가 — **본진 몫을 안 빼고 있었다**
 * 포함분은 **계정 단위**인데 150만은 유어애즈만 보고 잡은 값이다. 유어딜 본진이 하루 약 10만 행을
 * 쓰므로(9/3 실측 시간당 4,062) 실제 월 합계는:
 * ```
 *   유어애즈 150만×30 = 4,500만  +  본진 10만×30 = 300만  =  4,800만 / 5,000만 = 96%   ← 여유 4%
 *   유어애즈 120만×30 = 3,600만  +  본진        300만  =  3,900만 / 5,000만 = 78%   ← 여유 22%
 * ```
 * 대표 지시 *"유료요금제 용량을 넘어선 안돼"* 에 4% 여유는 얇다 — 본진 트래픽은 사용자가 늘면 커지고,
 * 그때 넘는 것은 **유어애즈가 아니라 계정**이다. 맞교환은 유어애즈 처리량 약 20% 감소(레인이 하루
 * 3~4시간 일찍 멈춘다)이고, 대표에게 그 대가를 밝히고 승인받았다.
 *
 * ⚠️ **폭주 방어력은 그대로다** — 시간당 300만짜리 폭주는 120만이든 150만이면 어차피 30분 안에 걸린다.
 * 이 값이 정하는 것은 "정상 수집을 하루 몇 시간 돌리나"지 "폭주를 막나"가 아니다.
 * `0` 이면 끈다(무제한).
 */
export const WRITE_BUDGET_ENV = 'ADS_DAILY_WRITE_BUDGET'
export const DEFAULT_DAILY_WRITE_BUDGET = 1_200_000
/** 원장 DO 인스턴스 이름 — 레인 이름과 겹치면 안 된다(`lane-alarm-runners` 등록부에 없어야 `alarm()` 이 무시한다). */
export const READ_BUDGET_DO = 'read-budget'
/** 하트비트 이름(`ads:` 접두는 adsBeat 가 붙인다). */
export const READ_BUDGET_BEAT = 'read-budget'
export const READ_BUDGET_PATH = '/budget'

export interface ReadBudgetState {
  day: string; used: number; written?: number
  /** 🗓️ 월 누적 쓴 행 — 요금이 월 단위라 일 단위만으로는 못 지킨다(아래 `monthlyDerivedWriteBudget`). */
  month?: string; writtenMonth?: number
  /** 🧾 오늘 레인별 사용량 — "누가 썼나"가 없으면 넘쳤을 때 전 레인을 끄는 수밖에 없다(아래 헤더). */
  lanes?: Record<string, LaneSpend>
}

/**
 * 레인 하나의 원장 한 줄. `r`/`w`/`n`/`cut` 은 **오늘 것**(날이 바뀌면 0), `base` 만 날을 넘어 남는다 —
 * 그게 "이 레인의 평소치"라는 학습값이기 때문이다(일일 계수가 아니다).
 */
export interface LaneSpend {
  /** 오늘 읽은 행 */ r: number
  /** 오늘 쓴 행 */ w: number
  /** 오늘 보고한 회차 수 */ n: number
  /** 회차당 쓴 행의 EMA — **폭주로 판정된 회차는 안 섞는다**(폭주가 자기 기준선을 올려 다음 폭주를 정상으로 만든다). */
  base?: number
  /** 이 레인이 폭주로 잘린 날(UTC). 오늘과 같으면 오늘은 안 돈다. */ cut?: string
  /** 잘린 이유 — 하트비트에 그대로 싣는다(왜 멈췄는지 못 보면 끄는 것과 같다). */ cutWhy?: RunawayVerdict
}
export interface ReadBudgetView extends ReadBudgetState {
  budget: number; over: boolean; unknown?: boolean
  /** 쓰기 쪽 — 원장은 하나이고 축만 둘이다(경계·DO·게이트를 두 벌 만들 이유가 없다). */
  written: number; writeBudget: number; writeOver: boolean
  /** 🗓️ 월 상태 — 화면에 안 보이면 "왜 오늘 예산이 이 값인지"를 아무도 못 설명한다. */
  writtenMonth?: number; monthLeft?: number; daysLeft?: number
  /**
   * 🧾 레인 귀속 — **기본 응답은 작게** 유지한다(이 뷰는 레인 인보케이션마다 읽힌다).
   * `cutLanes` 는 게이트가 쓰고, `top` 은 하트비트가 쓴다. 전체 표는 `?full=1` 일 때만 실린다.
   */
  cutLanes?: string[]
  top?: Array<{ lane: string; w: number; r: number; n: number }>
  lanes?: Record<string, LaneSpend>
}

/* ────────────────────────────────────────────────────────────────────────────
 * 🧾 레인 귀속 + 폭주 레인만 자르기 (2026-09-15, 대표 *"관리도 안되고"*)
 *
 * ## 왜
 * 그때까지 원장은 **계정 합계 하나**였고 보고에 레인 이름이 없었다(`reportReadUsage(env, rr, rw)`).
 * 결과가 둘이었다:
 *   ① 넘치면 `budgetBlocked` 가 **전 레인**을 세운다 — 범인이 하나여도 34개가 같이 멈춘다.
 *   ② 넘친 뒤에도 **누가 넘겼는지 아무도 모른다** — 원장에 이름이 안 남으니 사후에도 못 찾는다.
 * 그래서 9/2 폭주 때 할 수 있는 처방이 "정상 수집까지 1/50 로 조이기" 뿐이었다. 정상과 폭주를
 * 구분할 줄 모르는 차단기는 정상을 조이는 것 말고 할 줄 아는 게 없다.
 *
 * ## 임계값은 **실측에서 왔다** (2026-09-15 라이브 하트비트 67레인, 회차당 쓴 행)
 * ```
 *   collect-neis 28,814 · collect-commerce 12,078 · collect 4,937 · collect-company 3,779
 *   collect-store-kakao 2,934 · collect-hira 1,504 · … · 나머지 1,000 미만
 *                                     ↑ 정상 회차 최대 28,814
 *   9/2 폭주:  쿼리 **하나**가 10만~15만 행 · 시간당 350만
 * ```
 * ⇒ 두 분포가 3.4배 떨어져 있다. 그 사이에 선을 긋는다.
 * ⚠️ **예산에 비례시키지 않는다.** 처음엔 `하루예산 × 0.5` 로 잡았는데 그러면 예산이 클수록(=위험이
 *   클수록) 임계가 **느슨해지고**, 9월 스로틀(3만) 같은 작은 예산에선 1.5만이 되어 **정상 회차
 *   (28,814)가 폭주로 잘린다.** 이 값은 "건강한 회차가 어떻게 생겼나"의 성질이지 예산의 성질이 아니다.
 *
 * ## 못 막는 것 (기존 차단기와 같은 한계)
 * · **첫 폭주 회차는 끝까지 간다** — 판정은 회차가 *보고한 뒤*에 난다. 줄이는 것은 "13시간 × 전 레인"
 *   → "1회차 × 그 레인"이지 0 이 아니다.
 * · 레인 **밖**의 쓰기(서비스몰 API 요청)는 여전히 안 세진다. 부팅 마이그레이션은 레인 인보케이션
 *   안에서 돌아 그 회차의 계량기에 잡힌다 — 9/2 가 그랬다.
 * ────────────────────────────────────────────────────────────────────────── */

/** 원장이 기억하는 레인 수 상한 — DO 저장이 무한히 자라지 않게(현재 라이브 67). 넘으면 오늘 적게 쓴 순으로 버린다. */
export const LANE_LEDGER_MAX = 96
/** 한 회차가 이만큼 쓰면 **무조건** 폭주. 실측 정상 최대 28,814 의 3.4배. */
export const RUNAWAY_ROUND_WRITES = 100_000
/** 배수 규칙의 하한 — 관측된 어떤 정상 회차(최대 28,814)보다 커야 오탐이 안 난다. */
export const RUNAWAY_REL_FLOOR = 50_000
/** 배수 규칙 — 자기 평소치의 이 배를 넘으면 폭주. */
export const RUNAWAY_REL_MULTIPLE = 8
/** 평소치 EMA 의 새 값 가중치. 낮을수록 천천히 배운다(= 한 번의 큰 회차로 기준선이 안 흔들린다). */
export const RUNAWAY_BASELINE_ALPHA = 0.3

/** 폭주 판정 결과 — 빈 문자열이면 정상. */
export type RunawayVerdict = '' | 'abs' | 'rel'

/**
 * 이 회차가 폭주인가. **순수 함수** — 상태를 안 건드려야 시험이 경계를 고정할 수 있다.
 *
 * ⚠️ `baseline` 이 없으면(그 레인의 첫 회차) `rel` 은 **절대 발화하지 않는다**. 0 에서 시작한 레인이
 *   처음 일하는 순간을 폭주로 잡으면, 새 레인은 태어나자마자 잘린다.
 */
export function runawayRound(rw: number, baseline?: number): RunawayVerdict {
  if (!Number.isFinite(rw) || rw <= 0) return ''
  if (rw >= RUNAWAY_ROUND_WRITES) return 'abs'
  if (rw < RUNAWAY_REL_FLOOR) return ''
  if (!baseline || !(baseline > 0)) return ''
  return rw >= baseline * RUNAWAY_REL_MULTIPLE ? 'rel' : ''
}

/**
 * 원장 키로 쓸 레인 이름. 세 형태가 들어온다 — 하트비트(`ads:collect`) · 경로(`/__ads/collect`) ·
 * 쿼리 변종(`reclassify-company?passes=5`). **셋을 한 이름으로 모은다**, 안 그러면 같은 레인이
 * 원장에 세 줄로 남아 귀속이 무의미해진다(`lane-cadence.baseLaneName`·`lane-domains.laneKey` 와 같은 규약).
 */
export function laneLedgerKey(raw: unknown): string {
  let n = String(raw ?? '').trim()
  if (n.startsWith('ads:')) n = n.slice(4)
  n = n.replace(/^\/__ads\//, '').replace(/^\//, '')
  n = (n.split('?')[0] ?? '').trim()
  n = n.replace(/[^A-Za-z0-9._:-]/g, '')
  return n ? n.slice(0, 40) : 'unknown'
}

/** Cloudflare 가 일일 한도를 되돌리는 경계 = UTC 자정. */
export function utcDay(nowMs: number): string { return new Date(nowMs).toISOString().slice(0, 10) }

/** env 값 → 예산(행). 없거나 못 읽으면 기본값, 0 이하는 0(= 끔). */
export function resolveReadBudget(env: unknown): number {
  return resolveBudget(env, READ_BUDGET_ENV, DEFAULT_DAILY_READ_BUDGET)
}

/**
 * 🚨 **2026년 9월 한시 스로틀 — 10/1 UTC 에 스스로 풀린다.**
 *
 * 9/2 하루에 **4,554만 행**을 쓴 폭주(업체 DB 전면 재기록)가 월 포함분 5,000만을 통째로 먹었다.
 * 그래서 9월 남은 기간은 **누가 쓰든 전부 과금 구간**이다 — 유어딜 본진의 하루 4.5만 행도 포함이다
 * (포함분은 DB 가 아니라 **계정** 단위다). 대표 지시 2026-09-07: *"이번 달은 과금 안 되게"*.
 *
 * 실측 기반 선택지(9/7 21:00 KST 기준, 남은 23.5일):
 * ```
 *   유어애즈 쓰기/일        9월 총 초과      금액
 *              0           2,350,952      $2.35   ← 바닥(본진 몫, 못 멈춘다)
 *         30,000           3,055,952      $3.06   ← 채택
 *      1,200,000          30,550,952     $30.55   ← 그대로 뒀을 때
 * ```
 * 잃는 것이 거의 없어 채택했다 — 제휴 제안 발송은 "한참 뒤"(대표 확정)이고 **백로그는 썩지 않는다**.
 * 6개월 뒤에 측정해도 그때의 현재 활동을 재는 것이라 결과가 같다(CLAUDE.md 유어애즈 절).
 *
 * ⚠️ **`0` 을 쓰면 안 된다** — 아래 `resolveBudget` 에서 0 은 "끔"(**무제한**)이다. 정반대가 된다.
 * ⚠️ **날짜로 스스로 풀리게 한 이유**: 되돌리는 것을 잊어 수집이 영영 묶이는 사고를 막기 위해서다.
 *   이 레포가 반복해 만난 *"실패가 아니라 조용한 부재"* 를 여기서 만들지 않는다.
 * ⚠️ env `ADS_DAILY_WRITE_BUDGET` 를 명시하면 **그 값이 이긴다** — 대표가 언제든 되돌릴 수 있다.
 *
 * 🔭 **근본 처방은 따로다**(이번 범위 밖): 이 예산은 *일일* 상한이라 **월 포함분이 이미 소진됐는지를
 *   모른다**. 그래서 폭주가 월초에 한도를 태워도 남은 날들이 태연히 과금 구간으로 걸어 들어간다.
 *   월 인식 예산이 있었다면 이번 $29 는 애초에 안 생겼다.
 */
export const SEPT_2026_WRITE_THROTTLE = 30_000
export const SEPT_2026_THROTTLE_UNTIL_MS = Date.parse('2026-10-01T00:00:00Z')

/** 쓰기 예산 — 읽기와 **같은 규약**(빈값/이상값이면 기본값, 0 이하면 끔) + 위 한시 스로틀. */
export function resolveWriteBudget(env: unknown, nowMs: number = Date.now()): number {
  const raw = (env as Record<string, unknown> | undefined)?.[WRITE_BUDGET_ENV]
  const explicit = raw !== undefined && raw !== null && String(raw).trim() !== ''
  if (explicit) return resolveBudget(env, WRITE_BUDGET_ENV, DEFAULT_DAILY_WRITE_BUDGET)
  return nowMs < SEPT_2026_THROTTLE_UNTIL_MS ? SEPT_2026_WRITE_THROTTLE : DEFAULT_DAILY_WRITE_BUDGET
}

/**
 * 🗓️ **① 월에서 역산하는 일일 쓰기 예산** — 대표 지시 2026-09-08 *"$0 으로 가야해"*.
 *
 * ## 왜 일일 상한만으로는 안 되는가
 * 요금은 **월** 단위(포함 5,000만 행)인데 차단기는 **일** 단위였다. 그 둘 사이엔 중간이 없다:
 * 너무 조이면 쓸 수 있는 용량을 버리고, 너무 풀면 월을 터뜨린다. 그리고 폭주가 월초에 한도를
 * 태워도 **남은 날들이 그 사실을 모른 채** 태연히 과금 구간으로 걸어 들어간다 — 2026-09-02 가
 * 정확히 그랬다(하루 4,554만 행 → 그 달 내내 초과).
 *
 * ## 계산
 * ```
 *   남은 몫   = 포함분 − 유어딜 예약분 − 이번 달 유어애즈 누적
 *   오늘 예산 = 남은 몫 ÷ 남은 일수(오늘 포함)
 * ```
 * **스스로 균형을 잡는다** — 적게 쓴 날이 있으면 남은 날이 그만큼 더 쓰고, 많이 쓴 날이 있으면
 * 남은 날이 조여진다. 월을 터뜨리는 것도, 용량을 남기는 것도 구조적으로 안 된다.
 *
 * ⚠️ **유어딜 몫을 먼저 뗀다** — 포함분은 DB 가 아니라 **계정** 단위다. 본진(하루 4.5만 행 실측)이
 *   쓰는 만큼을 빼지 않으면 유어애즈가 그 몫까지 먹고 본진 쓰기가 과금으로 넘어간다.
 * ⚠️ **절대 0 을 돌려주지 않는다** — 이 파일에서 0 은 "끔"(**무제한**)이라 정반대가 된다.
 *   월 몫이 이미 소진됐어도 바닥값(`MONTH_SPENT_FLOOR`)을 돌려준다.
 * ⚠️ 원장은 **유어애즈 자신의 쓰기만** 센다(레인이 보고한 값). 본진 실적은 안 보이므로 예약분은
 *   상수다 — 본진이 커지면 이 값을 다시 재서 올려야 한다.
 */
export const MONTHLY_WRITE_ALLOWANCE = 50_000_000
/** 유어딜 본진 월 예약분 — 실측 하루 4.5만 행 × 31일에 여유를 얹었다(2026-09 측정). */
export const URDEAL_MONTHLY_RESERVE = 1_500_000
/** 월 몫이 다 떨어졌을 때의 바닥값. **0 이면 안 된다**(0 = 끔 = 무제한). */
export const MONTH_SPENT_FLOOR = 30_000

/** UTC 기준 이번 달 남은 일수(오늘 포함). 요금 경계가 UTC 월이라 그 달력을 쓴다. */
export function utcDaysLeftInMonth(nowMs: number): number {
  const d = new Date(nowMs)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  return Math.max(1, last - d.getUTCDate() + 1)
}

/** UTC 월 키(`2026-10`) — 요금 경계와 같은 달력. */
export function utcMonth(nowMs: number): string { return new Date(nowMs).toISOString().slice(0, 7) }

export function monthlyDerivedWriteBudget(
  writtenMonth: number, nowMs: number,
  allowance: number = MONTHLY_WRITE_ALLOWANCE, reserve: number = URDEAL_MONTHLY_RESERVE,
): number {
  const spent = Number.isFinite(writtenMonth) && writtenMonth > 0 ? writtenMonth : 0
  const left = allowance - reserve - spent
  if (!(left > 0)) return MONTH_SPENT_FLOOR
  return Math.max(MONTH_SPENT_FLOOR, Math.floor(left / utcDaysLeftInMonth(nowMs)))
}

/**
 * 🕐 **② 하루 예산을 시간에 걸쳐 편다(페이싱)** — 대표 관측 *"유료인데 오히려 불안정하다"* 의 직접 해법.
 *
 * 종전엔 하루치를 **다 쓸 때까지 전속력으로 달리다 절벽처럼 멈췄다**. 2026-09-07 실측:
 * ```
 *   12시간에 하루치 소진  →  나머지 12시간 수집 0        (같은 총량, 절반은 죽은 시간)
 * ```
 * 시간이 지난 만큼만 쓰게 하면 같은 총량이 **하루 내내 고르게** 나간다. 레인이 서지 않으므로
 * 창 밖에서 죽는 레인도 없다(2026-09-04 B2B 붕괴가 그 모양이었다).
 *
 * ⚠️ **따라잡기를 허용한다** — 허용치가 누적(`(시간+1)/24`)이라, 앞 시간에 덜 썼으면 그만큼
 *   지금 더 쓸 수 있다. 안 그러면 조용한 시간대가 그대로 손실이 된다.
 * ⚠️ 마지막 시간(23시)엔 허용치가 하루치와 같아진다 — 일일 상한과 정확히 일치한다.
 */
export function pacedWriteOver(state: ReadBudgetState | null | undefined, dayBudget: number, nowMs: number): boolean {
  if (!(dayBudget > 0) || !state || state.day !== utcDay(nowMs)) return false
  const hour = new Date(nowMs).getUTCHours()
  const allowed = Math.ceil((dayBudget * (hour + 1)) / 24)
  return (state.written || 0) >= allowed
}

/**
 * 오늘의 실효 쓰기 예산. 우선순위: **env 명시 > 9월 한시 스로틀 > 월 역산**.
 * env 가 이기는 이유는 대표가 코드 배포 없이 되돌릴 손잡이를 남기기 위해서다.
 */
export function effectiveWriteBudget(env: unknown, state: ReadBudgetState | null | undefined, nowMs: number): number {
  const raw = (env as Record<string, unknown> | undefined)?.[WRITE_BUDGET_ENV]
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    return resolveBudget(env, WRITE_BUDGET_ENV, DEFAULT_DAILY_WRITE_BUDGET)
  }
  const sameMonth = state && state.month === utcMonth(nowMs)
  const derived = monthlyDerivedWriteBudget(sameMonth ? state.writtenMonth || 0 : 0, nowMs)
  // 9월 한시 스로틀은 **천장**으로 남는다 — 그 달 원장엔 9/2 폭주 이력이 없어 역산이 과대평가한다.
  return nowMs < SEPT_2026_THROTTLE_UNTIL_MS ? Math.min(SEPT_2026_WRITE_THROTTLE, derived) : derived
}

function resolveBudget(env: unknown, key: string, fallback: number): number {
  const raw = (env as Record<string, unknown> | undefined)?.[key]
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback
  const n = Math.floor(Number(String(raw).trim()))
  if (!Number.isFinite(n)) return fallback
  return n > 0 ? n : 0
}

/**
 * 날이 바뀌었을 때 레인 표를 넘긴다 — **오늘 계수(r/w/n)와 `cut` 은 버리고 `base` 만 남긴다.**
 * `cut` 을 남기면 하루 차단이 영구 차단이 되고, `base` 를 버리면 매일 아침 모든 레인이
 * "기준선 없음"이라 배수 규칙이 하루치씩 눈을 감는다.
 */
function rolloverLanes(lanes: Record<string, LaneSpend> | undefined): Record<string, LaneSpend> {
  const out: Record<string, LaneSpend> = {}
  for (const [k, v] of Object.entries(lanes || {})) {
    if (v?.base && v.base > 0) out[k] = { r: 0, w: 0, n: 0, base: v.base }
  }
  return out
}

/** 표가 상한을 넘으면 **오늘 적게 쓴 순**으로 버린다 — 잘린 레인과 큰 손은 반드시 남는다. */
function capLanes(lanes: Record<string, LaneSpend>, day: string): Record<string, LaneSpend> {
  const keys = Object.keys(lanes)
  if (keys.length <= LANE_LEDGER_MAX) return lanes
  const keep = keys
    .sort((a, b) => {
      const ca = lanes[a]?.cut === day ? 1 : 0, cb = lanes[b]?.cut === day ? 1 : 0
      if (ca !== cb) return cb - ca                                  // 잘린 레인 우선 보존
      return (lanes[b]?.w || 0) - (lanes[a]?.w || 0)
    })
    .slice(0, LANE_LEDGER_MAX)
  const out: Record<string, LaneSpend> = {}
  for (const k of keep) out[k] = lanes[k]!
  return out
}

/**
 * 원장에 회차 읽기량을 더한다 — 날이 바뀌었으면 0 에서 다시. 음수·NaN 은 0 으로.
 *
 * @param lane 보고한 레인 이름(없으면 귀속만 건너뛴다 — 합계는 그대로 센다).
 * @param verdict 이 회차의 폭주 판정. `''` 이 아니면 그 레인을 오늘 자르고 **기준선은 안 갱신한다.**
 */
export function applyRead(
  prev: ReadBudgetState | null | undefined, rr: number, nowMs: number, rw = 0,
  lane?: string, verdict: RunawayVerdict = '',
): ReadBudgetState {
  const day = utcDay(nowMs)
  const pos = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)
  const same = prev && prev.day === day
  const month = utcMonth(nowMs)
  const sameMonth = prev && prev.month === month
  // 🧾 날이 같으면 이어서, 바뀌었으면 기준선만 안고 0 에서.
  const lanes = same ? { ...(prev.lanes || {}) } : rolloverLanes(prev?.lanes)
  const key = lane === undefined ? '' : laneLedgerKey(lane)
  if (key) {
    const cur = lanes[key] || { r: 0, w: 0, n: 0 }
    const w = pos(rw)
    lanes[key] = {
      r: cur.r + pos(rr), w: cur.w + w, n: cur.n + 1,
      // 📏 평소치는 **정상 회차로만** 배운다. 폭주를 섞으면 기준선이 폭주 쪽으로 끌려가
      //    다음 폭주가 "평소와 비슷함"이 된다(차단기가 스스로를 무디게 만드는 형태).
      base: verdict
        ? cur.base
        : cur.base && cur.base > 0
          ? Math.max(1, Math.round(cur.base * (1 - RUNAWAY_BASELINE_ALPHA) + w * RUNAWAY_BASELINE_ALPHA))
          : w || cur.base,
      ...(verdict ? { cut: day, cutWhy: verdict } : cur.cut === day ? { cut: cur.cut, cutWhy: cur.cutWhy } : {}),
    }
  }
  return {
    day,
    used: (same ? prev.used : 0) + pos(rr),
    written: (same ? prev.written || 0 : 0) + pos(rw),
    // 🗓️ 달이 바뀌면 0 에서 다시 — 포함분이 UTC 월 경계에서 리셋되기 때문이다.
    month,
    writtenMonth: (sameMonth ? prev.writtenMonth || 0 : 0) + pos(rw),
    lanes: capLanes(lanes, day),
  }
}

/** 이 레인이 오늘 폭주로 잘렸는가 — 게이트의 단일 판정. 이름 정규화는 양쪽 모두 통과해야 한다. */
export function laneCut(v: ReadBudgetView | null | undefined, lane: string): boolean {
  if (!v || !lane) return false
  return (v.cutLanes || []).includes(laneLedgerKey(lane))
}

/** 오늘 잘린 레인 이름들(원장 상태에서). */
export function cutLaneNames(state: ReadBudgetState | null | undefined, nowMs: number): string[] {
  const day = utcDay(nowMs)
  if (!state || state.day !== day) return []
  return Object.entries(state.lanes || {}).filter(([, v]) => v?.cut === day).map(([k]) => k).sort()
}

/** 오늘 많이 쓴 레인 상위 N — "누가 썼나"를 하트비트 한 줄로 보이게 하는 값. */
export function topLaneSpend(state: ReadBudgetState | null | undefined, n = 3): Array<{ lane: string; w: number; r: number; n: number }> {
  return Object.entries(state?.lanes || {})
    .map(([lane, v]) => ({ lane, w: v?.w || 0, r: v?.r || 0, n: v?.n || 0 }))
    .filter(x => x.w > 0 || x.r > 0)
    .sort((a, b) => b.w - a.w || b.r - a.r)
    .slice(0, Math.max(0, n))
}

export function budgetOver(state: ReadBudgetState | null | undefined, budget: number, nowMs: number): boolean {
  if (!(budget > 0) || !state) return false
  return state.day === utcDay(nowMs) && state.used >= budget
}

/** 쓰기 초과 판정 — 읽기와 같은 모양(날이 바뀌면 자동 해제). */
export function writeBudgetOver(state: ReadBudgetState | null | undefined, budget: number, nowMs: number): boolean {
  if (!(budget > 0) || !state) return false
  return state.day === utcDay(nowMs) && (state.written || 0) >= budget
}

interface StorageLike { get<T>(key: string): Promise<T | undefined>; put(key: string, value: unknown): Promise<void> }
export const READ_BUDGET_STORAGE_KEY = 'readBudget'

/**
 * 원장 DO 의 `/budget` 처리 — 순수하게 떼어 둔 것은 테스트 때문이다(`cloudflare:workers` 의 DO 클래스는 vitest 에서
 * 못 올린다). `?rr=N` 이 있으면 더하고, 없으면 읽기만. 응답은 언제나 현재 상태.
 */
export async function handleBudgetRequest(url: URL, storage: StorageLike, env: unknown, nowMs = Date.now()): Promise<ReadBudgetView> {
  const budget = resolveReadBudget(env)
  const prev = (await storage.get<ReadBudgetState>(READ_BUDGET_STORAGE_KEY)) ?? null
  const rr = Number(url.searchParams.get('rr') || 0)
  const rw = Number(url.searchParams.get('rw') || 0)
  // ⚠️ 둘 중 **하나라도** 보고되면 원장을 갱신한다. `rr>0` 만 보던 예전 조건을 그대로 두면
  //   읽기 없이 쓰기만 한 회차(전수 UPDATE 가 정확히 그렇다)가 **한 행도 안 세진다.**
  const reported = rr > 0 || rw > 0
  // 🧾 누가 보고했나. 없으면(옛 호출부·수동 조회) 귀속만 건너뛰고 합계는 종전과 **byte-동일**하게 센다.
  const laneRaw = url.searchParams.get('lane')
  const laneKeyed = laneRaw ? laneLedgerKey(laneRaw) : ''
  // 🚨 판정은 **이번 회차를 섞기 전** 기준선으로 한다 — 섞은 뒤에 재면 폭주가 자기 기준선을 올려
  //    스스로를 정상으로 만든다(차단기가 자기 눈을 가리는 형태).
  const verdict: RunawayVerdict = laneKeyed ? runawayRound(rw, prev?.lanes?.[laneKeyed]?.base) : ''
  const next = reported
    ? applyRead(prev, rr, nowMs, rw, laneKeyed || undefined, verdict)
    : (prev && prev.day === utcDay(nowMs) ? prev : { day: utcDay(nowMs), used: 0, written: 0 })
  if (reported) await storage.put(READ_BUDGET_STORAGE_KEY, next)
  // 🗓️ 예산은 **갱신된 상태로** 계산한다 — 이 회차의 쓰기까지 반영해야 다음 판정이 정확하다.
  const writeBudget = effectiveWriteBudget(env, next, nowMs)
  const writtenMonth = next.writtenMonth || 0
  // ⚠️ `lanes`(전체 표)는 **스프레드에서 뺀다** — 안 빼면 레인 인보케이션마다 96줄짜리 표가 실려 온다.
  //    아래에서 `?full=1` 일 때만 다시 넣는다.
  const { lanes: _allLanes, ...totals } = next
  return {
    ...totals, written: next.written || 0,
    budget, over: budgetOver(next, budget, nowMs),
    writeBudget,
    // ⚠️ 일일 상한과 페이싱 **둘 다** 본다. 페이싱만 두면 23시엔 하루치가 통째로 열린다.
    writeOver: writeBudgetOver(next, writeBudget, nowMs) || pacedWriteOver(next, writeBudget, nowMs),
    writtenMonth,
    monthLeft: Math.max(0, MONTHLY_WRITE_ALLOWANCE - URDEAL_MONTHLY_RESERVE - writtenMonth),
    daysLeft: utcDaysLeftInMonth(nowMs),
    // 🧾 기본 응답은 작게 — 이 뷰는 레인 인보케이션마다 읽힌다. 전체 표는 물어볼 때만.
    cutLanes: cutLaneNames(next, nowMs),
    top: topLaneSpend(next),
    ...(url.searchParams.get('full') === '1' ? { lanes: next.lanes || {} } : {}),
  }
}

type NsEnv = { ADS_LANE?: DurableObjectNamespace } | undefined
function ledger(env: unknown): DurableObjectStub | null {
  const ns = (env as NsEnv)?.ADS_LANE
  return ns ? ns.get(ns.idFromName(READ_BUDGET_DO)) : null
}

/**
 * 게이트가 부른다 — 오늘 얼마나 썼고 넘었는가. ⚠️ **원장을 못 읽으면 넘은 것으로**(`unknown: true`) — 예산 원장이
 * 죽었을 때 "모르니까 돈다"는 9/2 의 유어딜을 다시 만드는 쪽이다. 예산이 0(끔)이면 원장을 묻지도 않는다.
 */
export async function readBudgetState(env: unknown): Promise<ReadBudgetView> {
  const budget = resolveReadBudget(env)
  const writeBudget = resolveWriteBudget(env)
  const day = utcDay(Date.now())
  // 🧾 `cutLanes: []` 를 기본에 둔다 — 없으면 게이트가 "모르는 상태"와 "안 잘림"을 못 가른다.
  const idle = { day, used: 0, written: 0, budget, writeBudget, cutLanes: [] as string[] }
  // 둘 다 꺼져 있을 때만 원장을 안 묻는다 — 한쪽만 켜도 원장이 필요하다.
  if (budget <= 0 && writeBudget <= 0) return { ...idle, over: false, writeOver: false }
  const stub = ledger(env)
  if (!stub) return { ...idle, over: true, writeOver: true, unknown: true }
  try {
    const res = await stub.fetch(`https://ur-ads${READ_BUDGET_PATH}`)
    const body = (await res.json()) as ReadBudgetView
    return {
      day: body.day, used: Number(body.used) || 0, written: Number(body.written) || 0,
      budget, over: !!body.over,
      // 🗓️ 쓰기 예산은 **원장이 계산한 값**을 쓴다 — 월 누적을 아는 쪽은 원장뿐이다.
      //   못 읽으면 env/기본값으로 폴백(화면이 비는 것보다 낫다).
      writeBudget: Number(body.writeBudget) || writeBudget, writeOver: !!body.writeOver,
      writtenMonth: Number(body.writtenMonth) || 0,
      monthLeft: Number(body.monthLeft) || 0, daysLeft: Number(body.daysLeft) || 0,
      // 🧾 레인 귀속 — 원장이 준 것만 신뢰한다(못 읽으면 아래 catch 가 빈 배열로 준다).
      cutLanes: Array.isArray(body.cutLanes) ? body.cutLanes.map(String) : [],
      top: Array.isArray(body.top) ? body.top : [],
    }
  } catch {
    return { ...idle, over: true, writeOver: true, unknown: true }
  }
}

/**
 * 회차가 끝나며 부른다 — 자기 읽기량을 원장에 더한다. 실패해도 조용히(관측이 레인을 죽이면 안 된다).
 *
 * @param lane 보고하는 레인 이름. **반드시 넘긴다** — 이게 빠지면 그 레인의 사용량이 합계에만 섞여
 *   "누가 썼나"에서 영영 사라지고, 폭주해도 자기만 잘리는 대신 전 레인이 멈춘다(2026-09-15 이전 상태).
 */
export async function reportReadUsage(env: unknown, rr: number | undefined, rw?: number | undefined, lane?: string): Promise<void> {
  const r = rr && rr > 0 ? Math.floor(rr) : 0
  const w = rw && rw > 0 ? Math.floor(rw) : 0
  if (r === 0 && w === 0) return
  if (resolveReadBudget(env) <= 0 && resolveWriteBudget(env) <= 0) return
  const stub = ledger(env)
  if (!stub) return
  const q = lane ? `&lane=${encodeURIComponent(laneLedgerKey(lane))}` : ''
  try { await stub.fetch(`https://ur-ads${READ_BUDGET_PATH}?rr=${r}&rw=${w}${q}`, { method: 'POST' }) } catch { /* 원장 실패는 삼킨다 */ }
}

/** 하트비트에 싣는 요약 — 숫자·불리언만(summarizeResult 가 `k=v` 로 편다). */
export function budgetBeatFields(v: ReadBudgetView): Record<string, number | boolean | string> {
  const cut = v.cutLanes || []
  const top = (v.top || []).map(t => `${t.lane}:${t.w}`).join(',')
  return {
    used: v.used, budget: v.budget, over: v.over,
    written: v.written, wbudget: v.writeBudget, wover: v.writeOver,
    // 🧾 "누가 썼나" · "누가 잘렸나" — 이 두 줄이 없으면 넘쳤을 때 할 수 있는 게 전 레인 정지뿐이다.
    ...(top ? { top } : {}),
    ...(cut.length ? { cut: cut.join(','), cutn: cut.length } : {}),
    // 🗓️ 월 상태 — 이게 없으면 "왜 오늘 예산이 이 값인가"를 아무도 설명 못 한다.
    ...(v.writtenMonth !== undefined ? { wmonth: v.writtenMonth, mleft: v.monthLeft || 0, dleft: v.daysLeft || 0 } : {}),
    ...(v.unknown ? { unknown: true } : {}),
  }
}

/** 게이트의 단일 판정 — 어느 축이든 넘으면 멈춘다. */
export function budgetBlocked(v: ReadBudgetView): boolean { return v.over || v.writeOver }
