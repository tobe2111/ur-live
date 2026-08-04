/**
 * 🩹 서브리퀘스트 예산 자가 교정 (2026-07-28 라이브 재발 대응).
 *
 *   증상: 수집 진단에 `⚠️ FAILED: 검색 요청 오류: Too many subrequests by single Worker invocation` —
 *   한 인보케이션의 외부 fetch 총량이 플랫폼 한도를 넘어 그 레인의 수확이 통째로 버려진다.
 *   기본 예산 300 은 Workers **Paid(1000)** 기준이라, 실제 한도가 그보다 낮은 환경에서는 매 실행 같은
 *   지점에서 죽는다 — 그런데 **플랜/실제 한도를 코드가 알 방법이 없다**.
 *
 *   ⇒ 관측으로 학습한다. 한도에 부딪히면 '이번에 쓴 양'보다 낮은 값을 남기고 다음 실행부터 그 이하만 쓴다.
 *     반대로 학습 상한을 다 쓰고도 한도 오류가 없으면 조금 올려 본다(과학습·플랜 상향 회복).
 *     수확 총량은 self-chain/매시간 cron 이 이어받아 유지된다 — 한 번에 덜 쓰고 여러 번 도는 것뿐.
 */

import { resolvePlan, type AdsPlan } from '../../../worker-ads/dispatch-budget'

/**
 * 🚦 학습 상한은 **레인마다 따로** 저장한다(2026-07-28 근본수리).
 *
 *   그 전엔 세 레인이 `ads_subreq_cap` **한 키를 같이 읽고 썼다**. 건당 비용이 전혀 다른데
 *   (전화 스윕·인플루언서 = fetch 1 / 보강 = fetch 4~6 + D1 다수) 학습값을 공유하면 서로의 관측을
 *   덮어써 **어느 레인도 자기 진짜 한도를 학습하지 못한다**. 실제로 전화 스윕은 매시간 예산을 다 써서
 *   ×1.25 로 올리고 인플루언서 레인은 한도에 부딪혀 ×0.8 로 내리며 서로를 밀어, 공유값이 29~55 대역에서
 *   맴돌았다. 보강 레인은 그 값을 **읽기만** 하는 피해자였다(자기 env 예산 300 인데 실제 37 로 굶음).
 *
 *   ⇒ 레인별 키로 분리. 이미 도매 레인(`maker-enrich.ts`)이 같은 이유로 자기 키를 쓰고 있었다.
 *   ⚠️ 새 레인을 추가하면 `SubreqLane` 에 이름을 넣어라 — 남의 키를 재사용하면 이 사고가 재발한다.
 */
export type SubreqLane =
  | 'influencer'        // 인플루언서 자동수집 — 건당 fetch 1
  | 'influencer_enrich' // 인플루언서 풀 보강(블로거 활동성·링크인바이오) — 건당 fetch 2 + D1 소수
  | 'company_enrich'    // 파트너풀 연락처 보강 — 건당 fetch 4~6 + D1 다수(가장 비쌈)
  | 'kakao_sweep'       // 카카오 전화 스윕 — 건당 fetch 1
  | 'maintenance'       // 야간 풀 자동 정비 — D1 중심(통합/재추출/재분류) + 일부 재조회 fetch
  | 'store_kakao'       // 무인매장 발굴(카카오 로컬 키워드) — 키워드당 fetch 1 + 저장 batch
  | 'localdata'         // 인허가(지방행정) 매장 후보 — 업종당 fetch 1~6 + 저장 D1(업종 16종 → 가장 폭발적)
  | 'prospect_enrich'    // 매장 후보 연락처 보강 — 건당 크롤 4~6 + D1 다수(회사 풀 보강과 동급으로 비쌈)
/** 레인별 학습 상한 저장 키(platform_settings). */
export const subreqCapKey = (lane: SubreqLane): string => `ads_subreq_cap_${lane}`
/** 이 아래로는 안 내린다 — 수확이 0 이 되면 학습 자체가 무의미. */
export const SUBREQ_CAP_MIN = 25
/**
 * 📈 회복은 **가산**(AIMD) — 2026-07-29 진동 근본수리.
 *
 *   그 전엔 회복이 배율(×1.25)이었는데 백오프(×0.8)의 **정확한 역수**라 완벽한 2주기 진동이 생겼다:
 *     `55 →(한도충돌)→ 44 →(성공)→ 55 →(한도충돌)→ 44 …`
 *   라이브 실측이 정확히 그 상태였다(`learned_cap: 55` · `spent: 55` · `limit_hit: true`).
 *   **2회마다 1회씩 그 회차의 수확을 통째로 버린다** — 발굴은 다 해놓고 저장 직전에 끊기므로
 *   외부 API 쿼터까지 같이 태운다(가장 비싼 실패다).
 *
 *   곱셈 회복은 천장이 어디든 결국 넘어선다. 한도 근처에서 **머무르려면** 증가는 작고 느리게,
 *   감소는 크고 빠르게여야 한다 — TCP 혼잡제어(AIMD)와 같은 이유다.
 *   ⇒ 회복 +2/회차(선형), 백오프 ×0.8(승수) → 실패 1회당 성공 회차가 5~6배로 늘어난다.
 */
const RECOVER_STEP = 2
/** 한도 관측 시 하향 배율(부딪힌 지점보다 확실히 아래로). **확실한 신호**에만 쓴다. */
const BACKOFF_RATIO = 0.8
/**
 * 🪦 '직전 회차 유기' 하향 폭 — **가산**(회복 +2와 같은 축). 이 신호는 오탐이 섞이므로
 *   (lease 반납이 예산 고갈 시 조용히 실패한다) 승수로 깎으면 나선이 된다. `capAfterAbandonedRun` 주석 참조.
 *   회복(+2)보다 크게 잡아 조건이 지속되는 동안은 순감(−2/회차)이 유지되게 한다.
 */
const ABANDON_STEP = 4

/**
 * 📐 **보폭은 레인이 실제로 사는 지점에 비례한다** (2026-08-02 — 유료 자동 확장의 나머지 절반).
 *
 *   천장만 60→900 으로 올리면 학습값은 **+2/회차**로 기어 올라간다 — 시간당 1회차라 900 에 닿는 데
 *   **17일**이다. 대표가 유료로 바꾼 다음 날 아침에 달라진 게 없으면 그건 "자동"이 아니다.
 *
 *   🐛 **첫 판은 천장(`ceiling`)에 비례시켰다가 기존 유닛이 잡았다.** 시뮬레이션이 *천장 300 · 진짜 한도 50*
 *     조합을 돌리는데, 그때 보폭이 10 이 되어 실패율이 30회 중 6 → **10** 으로 올랐다. 천장이 레인의
 *     실제 생활점보다 한참 위일 수 있다는 걸 놓친 것이다 — 그리고 그건 가상의 상황이 아니다:
 *     **`ADS_PLAN=paid` 로 바꿨는데 실제 계정은 아직 무료**면 정확히 그 배치가 된다.
 *   ⇒ 기준을 **학습값(=관측된 생활점)** 으로 바꾼다. 천장이 얼마든 레인이 50 언저리에 살면 보폭은 2 다.
 *     설정이 틀려도 조용히 낭비하지 않는다(**틀린 쪽으로 안전**).
 *
 *   ⚖️ **왜 이게 ×1.25 진동의 재발이 아닌가**: 여기 비율은 `1 + 1/30 ≈ ×1.033` 이다. 2026-07-29 사고는
 *     회복이 백오프(×0.8)의 **정확한 역수**(×1.25)라 2주기로 맞물린 것이었다. ×1.033 은 백오프 1회를
 *     되돌리는 데 ~7회차가 걸려 실패 사이 간격이 그만큼 길다 — 즉 **실패율(듀티비)을 규모와 무관하게
 *     일정하게** 유지한다. 그게 이 비례의 목적이다(무료 55에서 +2 였던 그 비율 그대로).
 *
 *   🔒 **무료에서는 값이 안 변한다** — 생활점 40~60 → `round(55/30)=2` = 기존 `RECOVER_STEP`,
 *     `round(55/15)=4` = 기존 `ABANDON_STEP`. 유닛이 이 항등을 고정한다(무료 회귀 0).
 *
 *   🔑 불변식: **하향 > 회복**(항상 2배). 안 지키면 회차가 계속 죽는 동안에도 상한이 순증해 영영 못 내려온다.
 *
 * @param ceiling  이번 회차의 상한(min(envBudget, platformCap)) — 학습값이 없을 때의 대체 기준
 * @param learnedCap 관측된 생활점. 0/미지정이면 ceiling 을 쓴다.
 */
function scaleBase(ceiling: number, learnedCap?: number): number {
  const live = learnedCap && learnedCap > 0 ? Math.min(learnedCap, ceiling) : ceiling
  return Math.max(1, live)
}
export function recoverStep(ceiling: number, learnedCap?: number): number {
  return Math.max(RECOVER_STEP, Math.round(scaleBase(ceiling, learnedCap) / 30))
}
export function abandonStep(ceiling: number, learnedCap?: number): number {
  return Math.max(ABANDON_STEP, Math.round(scaleBase(ceiling, learnedCap) / 15))
}

/**
 * 응답/에러 메시지에 플랫폼 한도 신호가 있는가.
 *
 * ⚠️ 2026-07-28: `too many subrequests` **하나만** 보던 것을 넓혔다. Cloudflare 는 같은 성격의 초과를
 *   문구가 다른 예외로도 던진다 — 특히 **"Too many API requests by single worker invocation"**(D1 등
 *   바인딩 호출 소진). 좁게 보면 그 경우가 *한도가 아닌 일반 오류*로 분류돼 **학습 상한이 안 내려가고**
 *   매 실행 같은 지점에서 죽는 영구 루프가 된다(라이브에서 실제로 인플루언서 수집이 이 상태였다).
 */
export const isSubrequestLimitError = (msg?: string | null): boolean =>
  /too many (subrequests|api requests)/i.test(String(msg || ''))

/**
 * 🧱 플랫폼 천장 — **학습이 넘을 수 없는 절대 상한** (2026-07-29 신설).
 *
 *   왜 필요한가(관측):
 *     `ads_subreq_cap_influencer=55` · `ads_subreq_cap_kakao_sweep=65` — 이 두 레인은 건당 fetch 1 이라
 *     한도 오류를 **잡을 수 있는 예외로** 만나고, 그래서 50 바로 위에서 오르내리며 수렴했다(천장의 존재 증거).
 *     그런데 `ads_subreq_cap_company_enrich=172` — 천장의 3.4배다. 이 레인만 다른 이유는 하나다:
 *     **부딪히는 방식이 다르다.** 건당 4~6 fetch 라 라운드가 4~9번째 리드에서 끝나는데, 그때 남는 증거가
 *     `partial:true`(마지막 체크포인트)뿐이고 `crash` 도 `limit_hit` 도 없다 — 즉 잡을 예외가 오지 않는다.
 *     ⇒ 회복(×1.25)만 계속 적용되고 하향은 한 번도 안 걸리는 **한 방향 드리프트**. 자기교정 루프가
 *       "실패를 관측할 수 있다"를 전제하는데 이 레인에서 그 전제가 깨져 있었다.
 *
 *   ⇒ 관측에만 의존하지 않는다. **드리프트를 막는 천장**을 코드가 직접 갖는다.
 *
 *   🔢 값을 60 으로 정한 근거(문서 수치가 아니라 **역산**):
 *     회복은 ×1.25 뿐이라 25 에서 시작한 궤적은 25→32→40→50→63→79… 다. **55·65 는 이 궤적에 없다.**
 *     둘 다 백오프(×0.8)로만 나올 수 있는 값이고, 역산하면 각각 **spent≈69·81 에서 한도를 만났다**는 뜻이다.
 *     즉 잘 도는 레인들은 *우리 계수기 기준* 70~80 까지 도달한다 — 문서의 "무료 50" 을 그대로 천장으로 삼으면
 *     (한때 45 로 잡았다) **정상 레인을 30% 깎는다**. 우리 계수기가 실제 서브리퀘스트보다 과다 계상하는
 *     것으로 보인다(배치·조기반환분까지 세는 지점들). ⇒ 관측된 생존선(55~65) 언저리인 60 을 택한다:
 *     드리프트(172)는 3배 가까이 잘라내면서 정상 레인은 거의 건드리지 않는다.
 *
 *   ⚠️ 이 값은 **추정이다**(플랫폼이 알려주지 않는다). 확실한 것은 하나뿐 — *관측 불가 레인의 무한 상승을
 *     막아야 한다*. 레인 학습값이 60 에 붙어 있고 한도 오류가 안 보이면 올려도 되고, 여전히 무증거로 죽으면
 *     내린다. 무배포 조정: `ADS_SUBREQ_PLATFORM_CAP`.
 *
 *   🔧 유료 전환 시: 배포 없이 `ADS_SUBREQ_PLATFORM_CAP` 으로 올린다(예: 900).
 *      ⚠️ 추측으로 올리지 말 것 — 올린 뒤 레인들의 학습값이 다시 그 근처에서 수렴하는지 확인하고 판단한다.
 */
export const SUBREQ_PLATFORM_CAP_DEFAULT = 60

/**
 * 💳 **유료 기본 천장** (2026-08-02 — 대표 "유료 전환 시 자동으로 수집 능력이 올라가면 좋겠네").
 *
 *   그 전엔 이 천장이 **요금제를 몰랐다.** `ADS_PLAN=paid` 로 레인 수는 8→64 로 늘어도
 *   레인당 처리는 60 에 묶인 채라 — **레인 수만 늘고 일은 그대로**였다. 유료로 바꾼 사람이
 *   `ADS_SUBREQ_PLATFORM_CAP` 을 따로 넣어야 한다는 걸 알 방법이 없었고, 그건 "자동"이 아니다.
 *
 *   ⚠️ 900 은 **추정이다** — 문서상 유료 서브리퀘스트 한도(1,000)의 꼬리 여유. 무료의 60 도 같은
 *     성격의 추정이었고(관측 생존선 55~65 역산), 그래서 **전환 후 재측정이 필요하다**:
 *     레인 학습값이 900 근처에서 수렴하면 맞고, 그 아래에서 한도 오류를 계속 보면 내린다.
 */
export const SUBREQ_PLATFORM_CAP_PAID = 900

/** 요금제를 아는 env 조각 — `resolvePlan` 과 같은 모양(플랜 판정은 SSOT 하나만 쓴다). */
export interface SubreqCapEnv { ADS_SUBREQ_PLATFORM_CAP?: string; ADS_PLAN?: string }

/**
 * env 의 플랫폼 천장(없거나 이상값이면 **요금제 기본값**). 상한 900 은 유료 플랜(1,000)의 꼬리 여유.
 * ⚠️ 명시값이 있으면 요금제보다 우선한다 — 요금제는 *기본값만* 정한다.
 */
export function platformSubreqCap(raw?: string | null, plan: AdsPlan = 'free'): number {
  const n = parseInt(String(raw ?? ''), 10)
  if (Number.isFinite(n) && n > 0) return Math.min(900, Math.max(10, n))
  return plan === 'paid' ? SUBREQ_PLATFORM_CAP_PAID : SUBREQ_PLATFORM_CAP_DEFAULT
}

/**
 * 💳 **레인별 env 예산도 요금제를 알아야 한다** (2026-08-02 — 전수 점검에서 찾은 세 번째 구멍).
 *
 *   실제 예산은 `min(envBudget, learnedCap, platformCap)` 이다. 그런데 레인들의 env 기본값은
 *   **12·20·60·80·110·300** 으로 제각각이고 전부 요금제를 모른다. 그래서 유료로 천장을 60→900 으로
 *   올려도 **그 레인은 80 에서 멈춘다** — 천장이 구속하지 않는 조임쇠가 되어 버린다.
 *   플랫폼 천장·보강 벽시계에서 이미 두 번 겪은 것과 **같은 클래스**다: *"노브가 그 값에 닿지 않는다."*
 *
 *   ⇒ 무료 기본값은 그대로 두고, 유료에서만 **천장이 커진 비율만큼** 기본값을 키운다
 *     (60→900 이면 ×15). 그 위는 `learnedCap` 이 관측으로 잡는다 — 즉 숫자를 새로 추측하지 않는다.
 *
 *   🔒 **무료 회귀 0**: `plan==='free'` 면 인자로 받은 기본값을 그대로 반환한다.
 *   ⚠️ 명시 env 는 언제나 우선(요금제는 *기본값만* 정한다 — 이 파일의 다른 두 함수와 같은 규약).
 */
export function envLaneBudget(raw: string | undefined, freeDefault: number, env?: SubreqCapEnv | null): number {
  const n = parseInt(String(raw ?? ''), 10)
  if (Number.isFinite(n) && n > 0) return n
  if (resolvePlan(env) !== 'paid') return freeDefault
  const ratio = SUBREQ_PLATFORM_CAP_PAID / SUBREQ_PLATFORM_CAP_DEFAULT
  return Math.min(SUBREQ_PLATFORM_CAP_PAID, Math.round(freeDefault * ratio))
}

/**
 * 🎚️ **비율로 유도하면 안 되는 축** — 요금제별 값을 *명시*로 받는다 (2026-08-02).
 *
 * ## 왜 `envLaneBudget` 을 못 쓰나
 * 그 함수는 유료 기본값을 **천장 비율(60→900 = ×15)** 로 유도한다. 서브리퀘스트 예산에는 맞는
 * 유도지만, **일감 수와 마감선에는 재앙**이다:
 * ```
 *   NEIS 페이지 3 × 15 = 45      ← 6 으로 올린 날 CPU 한도로 죽었던 레인이다
 *   회차 마감선 12초 × 15 = 180초 ← 유료 CPU 한도(30초)를 여섯 배 넘는다
 * ```
 * 즉 **축마다 상한을 정하는 주체가 다르다.** 예산은 플랫폼 천장이 정하지만, 일감 수는 *그 레인이
 * 한 회차에 태울 수 있는 CPU* 가 정하고, 마감선은 *런타임 CPU 한도* 가 정한다. 비율을 빌려 쓰면
 * 그 차이가 지워진다 — `resolveEnrichDeadlineMs` 가 유료 값을 **명시**(7s→20s)로 둔 것과 같은 이유다.
 *
 * ⚠️ `paid` 는 **추정이다**. 전환 후 하트비트의 성공 최대 ms ↔ 실패 최소 ms 로 재측정할 것.
 * 🔒 무료 회귀 0 — `plan!=='paid'` 면 `free` 를 그대로 돌려준다. 명시 env 는 언제나 우선.
 */
export function envPlanValue(raw: unknown, free: number, paid: number, env?: SubreqCapEnv | null): number {
  const n = parseInt(String(raw ?? ''), 10)
  if (Number.isFinite(n) && n > 0) return n
  return resolvePlan(env) === 'paid' ? paid : free
}

/**
 * 🔌 **레인이 실제로 쓰는 진입점** — env 하나만 주면 요금제까지 반영된다.
 *
 * 예전엔 13개 파일이 전부 천장 함수에 **raw 문자열만**(`env.ADS_SUBREQ_PLATFORM_CAP`) 넘겼다.
 * 그래서 요금제가 이 값에 닿을 길이 아예 없었다 — 새 레인이 같은 실수를 반복하지 않도록 진입점을 하나로 둔다.
 */
export function envSubreqCap(env: SubreqCapEnv | undefined | null): number {
  return platformSubreqCap(env?.ADS_SUBREQ_PLATFORM_CAP, resolvePlan(env))
}

/** 이번 실행에 쓸 예산 — env·학습값·**플랫폼 천장** 중 가장 작은 값. */
export function resolveSubreqBudget(envBudget: number, learnedCap: number, platformCap = SUBREQ_PLATFORM_CAP_DEFAULT): number {
  const learned = learnedCap > 0 ? Math.min(envBudget, learnedCap) : envBudget
  return Math.max(1, Math.min(learned, platformCap))
}

/**
 * 🪦 **말없이 죽은 회차**를 관측해 상한을 내린다 (2026-07-29 — 11:00 라이브 실측).
 *
 *   위 `nextSubreqCap` 의 하향은 `hitLimit`(= 잡을 수 있는 예외)에 걸려 있다. 그런데 이 레인이
 *   실제로 죽는 방식은 예외가 아니다 — **인보케이션째 사라진다.** 그러면:
 *     · `hitLimit=false` 로 남고 → 다음 회차에 상한이 **오히려 +2** 올라가고 → 또 죽는다.
 *     · 마감 쓰기(커서·통계·상한)가 통째로 못 나가니 **죽었다는 사실 자체도 안 남는다.**
 *   실측(11:00): `ads:collect` 는 `started=true` 를 남기고 시작했는데 9분 뒤까지 `run.last_run` 은
 *   09:00:04 그대로였다. `spent 40/40 · learned_cap 44 · limit_hit false` — 자기교정 루프가
 *   "실패를 관측할 수 있다"는 전제 위에 서 있는데, 그 전제가 깨진 자리다(company_enrich 와 같은 병).
 *
 *   ⇒ **부재를 신호로 읽는다.** 정상 종료는 lease 를 `'0'` 으로 반납한다. 말없이 죽으면 반납이 없어
 *   만료된 타임스탬프가 남는다 — 다음 회차가 그 흔적을 보고 "직전 회차는 못 끝냈다"를 확정한다.
 *   추가 쓰기 0(이미 있는 lease 를 읽기만 한다).
 *
 * 🩹 **2026-07-29 재수리 — 하향을 승수에서 가산으로.** 위 "안전한 방향의 오차"라는 판단이 라이브에서 틀렸다.
 *
 *   실측(같은 날 5시간, `limit_hit` 은 **내내 false**):
 *     | 시각 | learned_cap | spent |
 *     |---|---|---|
 *     | 09:00 | 44 | 40/40 |
 *     | 12:00 | 36 | 32/32 |
 *     | 13:00 | 32 | 28/28 |
 *     | 14:00 | **27** | 23/23 |
 *   한도를 한 번도 안 봤는데 5시간에 **−39%**. 내려갈 수 있는 경로는 이 함수뿐이었다.
 *
 *   왜 오탐이 상시가 됐나: lease 반납(`releaseLease`)은 D1 쓰기이고 `.catch(() => null)` 로 감싸여 있다.
 *   즉 **서브리퀘스트가 바닥난 회차에서는 반납이 조용히 실패**한다 — 하필 상한에 닿았을 때 항상 그렇다.
 *   그래서 "유기" 신호가 매 회차 켜졌고, 여기서 −20% 를 곱했다.
 *   ⇒ **불확실한 신호 × 승수 하향 = 나선.** 회복은 +2(가산)라 −20% 를 절대 못 따라잡는다
 *     (44 에서 −8.8 vs +2). 원 주석의 "가산 회복이 도로 올린다"는 그 산술을 안 해 본 것이다.
 *
 *   ⇒ 신호의 신뢰도에 맞춰 **하향도 가산**(−`ABANDON_STEP`)으로 바꾼다. 조건이 지속되면 회차당 순 −2 로
 *   여전히 내려가지만(교정은 유지), 오탐이 상시여도 **바닥까지 자유낙하하지 않는다**.
 *   ⚠️ 진짜 한도 충돌(`hitLimit`)의 하향은 **승수 그대로**다 — 그건 관측이 확실한 신호라 빠르게 물러나는 게 맞다.
 *   ⚠️ 못 보는 것: 죽은 지점이 어디인지는 모른다. "이번엔 덜 쓰자"만 말한다.
 */
export function capAfterAbandonedRun(learnedCap: number, envBudget: number, platformCap = SUBREQ_PLATFORM_CAP_DEFAULT): number {
  const ceiling = Math.min(envBudget, platformCap)
  const base = learnedCap > 0 ? Math.min(learnedCap, ceiling) : ceiling
  return Math.max(Math.min(SUBREQ_CAP_MIN, ceiling), base - abandonStep(ceiling, learnedCap))
}

/**
 * 다음 실행의 상한 — 바꿀 필요가 없으면 null(쓰기 생략).
 *
 * ⚠️ 2026-07-28 데드락 수리: 예전엔 회복 조건에 `exhausted`(= 예산을 0까지 다 씀)를 요구했다.
 *   의도는 "상한을 시험해보지 않았으면 올릴 근거도 없다" 였지만, **예산을 남긴 채 정상 종료하는 레인은
 *   그 조건에 영영 도달하지 못해 상한이 고착**됐다. 실측(보강 레인): 예산 63 중 29만 쓰고 `partial:false`
 *   로 완주 → `exhausted=false` → 상한이 63에 못박힘 → 다음 회차도 63 → 또 남김. 닫힌 고리.
 *   (4차 세션이 레인별 키를 분리하며 "이제 300부터 시작" 이라 적었지만 실현되지 않았던 이유가 이것이다.)
 *
 *   ⇒ 회복 조건을 **"한도 오류를 안 봤다"** 하나로 바꾼다. 상한은 *목표치*가 아니라 *천장*이고, 실제 소비는
 *   할 일의 양이 정한다 — 구속하지 않는 천장을 낮게 유지할 이유가 없다. 너무 높이 올라가면 그 다음 무거운
 *   라운드가 한도 오류를 보고 `hitLimit` 분기로 즉시 되내려온다(그게 이 피드백 루프의 안전판).
 *
 * ⚠️ 2026-07-29: 회복도 **플랫폼 천장을 넘지 않는다**. 넘도록 두면 위 company_enrich 처럼
 *   "부딪혀도 예외가 안 오는" 레인에서 상한이 무한정 올라가고, 그 결과 라운드가 매번 무증거로 죽는다.
 *   (자기교정 루프는 실패를 *관측할 수 있을 때만* 작동한다 — 관측 불가 구간은 천장이 대신 막는다.)
 *
 * @param spent      이번 실행이 실제로 쓴 fetch 수
 * @param hitLimit   이번 실행에서 한도 오류를 관측했나
 * @param platformCap 드리프트 방지 천장(기본 60 — 근거는 위 역산 주석)
 */
export function nextSubreqCap(
  spent: number, hitLimit: boolean, learnedCap: number, envBudget: number,
  platformCap = SUBREQ_PLATFORM_CAP_DEFAULT,
): number | null {
  // 🧱 천장(#837) — 관측 불가 레인의 한 방향 드리프트를 막는다.
  const ceiling = Math.min(envBudget, platformCap)
  if (hitLimit) return Math.max(Math.min(SUBREQ_CAP_MIN, ceiling), Math.min(ceiling, Math.floor(spent * BACKOFF_RATIO)))
  // 이미 천장을 넘게 학습돼 있으면(과거 드리프트분) 천장으로 끌어내린다 — 그대로 두면 영영 안 내려온다.
  if (learnedCap > ceiling) return ceiling
  // 📈 가산 회복 — 배율이면 백오프(×0.8)의 역수와 맞물려 2주기 진동한다(위 RECOVER_STEP 주석의 실사고).
  //   천장(#837)은 *상한*을 막고, 가산은 *천장 아래에서의 진동*을 막는다 — 둘은 다른 실패를 푼다.
  if (learnedCap > 0 && learnedCap < ceiling) return Math.min(ceiling, learnedCap + recoverStep(ceiling, learnedCap))
  return null
}

/**
 * ⏱️ **보강 1라운드 벽시계 상한** — 세 보강 레인(인플루언서·회사·매장 후보)이 **같은 env 를 공유**하는데
 *   기본값은 각자 파일에 **세 벌**로 박혀 있었다. 하나만 고치면 나머지 둘은 조용히 옛 값으로 남는다
 *   (이 레포가 반복해 만난 "같은 규칙, 여러 벌" 클래스 — `KW_DDL` 이 같은 형태였다).
 *
 * 🩸 **기본값 20s → 7s** (2026-08-02 KST 실측): cron 경로에서 **20초 창은 도달 불가능**하다.
 *   부모 인보케이션이 약 **10.5초**에 회수되고 그때 살아 있던 자식이 전부 함께 죽는다
 *   (피호출자는 호출자보다 오래 못 산다 — #874 의 규칙이 여기서 상한으로 나타난다).
 *   두 틱 연속 **성공 최대 8,316 / 8,050ms ↔ 실패 최소 10,505ms · 겹침 0**, 실패는 전부 같은 초에 몰렸다.
 *   그 실패 목록에 `enrich-company`(10,505ms)·`enrich-prospects`(10,513ms)가 **정확히 들어 있다** —
 *   즉 세 레인 모두 같은 이유로 죽고 있었다.
 *
 * ⚠️ **이 값만으로는 부족하다.** 마감은 *항목 사이*에서만 검사되는데 건당 fetch 는 최대 8s라,
 *   6.9초에 시작한 한 건이 14.9초에 끝나면 여전히 절단된다. 건당 타임아웃도 함께 내려야 완결이고,
 *   그건 수집 품질에 직접 닿아(느린 사이트를 놓친다) 실패 분포를 보고 정할 일이다.
 *   그때까지 이 값은 **"항상 죽음" → "대개 산다"** 로 옮기는 것까지만 한다.
 *
 * ⚠️ 상한 10.5초가 플랫폼/플랜에 따라 달라지면 이 기본값도 다시 재야 한다 — 숫자를 믿지 말고
 *   **성공 max ↔ 실패 min 경계**를 다시 측정할 것.
 */
export const ENRICH_DEADLINE_MS_DEFAULT = 7_000

/**
 * 💳 **유료 기본 벽시계** (2026-08-02).
 *
 *   무료의 7초는 *부모 인보케이션이 ≈10.5초에 회수된다*는 실측에서 나온 값이다. 유료에서는 그 벽이
 *   훨씬 멀어지므로 7초를 그대로 두면 **한 라운드가 4~7건에서 스스로 멈춘다** — 천장을 900 으로
 *   올려 놓고도 벽시계가 먼저 끊으면 늘어난 예산을 쓸 수가 없다(세 조임쇠 중 마지막 하나).
 *
 *   ⚠️ 20초는 **추정이다**. 유료 CPU 한도(기본 30s) 아래의 여유를 잡은 것뿐이고, 무료의 7초처럼
 *     *측정으로* 정해야 한다 — 전환 후 `cron-heartbeats` 에서 **성공 최대 ms ↔ 실패 최소 ms 경계**를
 *     다시 재라. 그 방법이 무료에서 10.5초 벽을 찾아낸 방법이다.
 */
export const ENRICH_DEADLINE_MS_PAID = 20_000

/**
 * ⏰ **DO 알람이 모는 레인의 창** (2026-08-03).
 *
 *   위 무료 기본값 7초의 근거는 *"부모 인보케이션이 약 10.5초에 회수되고, 그 순간 살아 있던 자식이 전부
 *   함께 죽는다"* 였다. **알람에는 부모가 없다** — 그 근거가 통째로 사라진 자리다.
 *   증거(같은 알람, 같은 워커): `ads_lane_alarm_last:collect` 가 **28,643ms 완주**(fail_streak 0, 2회차 연속).
 *   ⇒ 7초는 이제 *낡은 지도*다. 20초는 실측으로 확인된 28.6초 안쪽이라 여유가 있다.
 *
 *   ⚠️ 지금 이 레인의 실제 병목은 시간이 아니라 **예산**이다(`spent 44/45` · 4.7초 종료).
 *     그래서 이 값만 올리면 아무것도 안 변한다 — YT 상한을 푸는 수리(`resolveYtPerfCap`)와 짝이어야
 *     앞 레인이 시간을 쓰기 시작하고, 그때 이 창이 의미를 갖는다.
 */
export const ENRICH_DEADLINE_MS_ALARM = 20_000

/**
 * env(`ADS_ENRICH_DEADLINE_MS`) → 유효 상한(ms). 범위 5s~120s 로 클램프, 비숫자·부재는 **요금제 기본값**.
 * ⚠️ 명시값이 요금제보다 우선한다(요금제는 기본값만 정한다 — `platformSubreqCap` 과 같은 규약).
 */
export function resolveEnrichDeadlineMs(raw: unknown, plan: AdsPlan = 'free'): number {
  const fallback = plan === 'paid' ? ENRICH_DEADLINE_MS_PAID : ENRICH_DEADLINE_MS_DEFAULT
  const n = parseInt(String(raw ?? ''), 10)
  return Math.min(120_000, Math.max(5_000, Number.isFinite(n) && n > 0 ? n : fallback))
}

/**
 * ⏱️ 건당 fetch 타임아웃 바닥값 — 남은 창이 이보다 적어도 이만큼은 준다.
 *
 *   왜 바닥이 필요한가: 남은 창이 200ms 라고 200ms 타임아웃을 주면 **정상 응답까지 실패로 각인**된다
 *   (`failed` 가 오르고 다음 순환이 재시도 — 순수 낭비). 호출부의 마감 가드가 이미 "집을지 말지"를
 *   정하므로, 일단 집은 항목에는 최소한의 기회를 준다.
 */
export const FETCH_TIMEOUT_FLOOR_MS = 1_500

/**
 * ⏱️ **지금 새 항목을 집어도 되는가** — 바닥값을 줄 수 있을 때만 true (2026-08-02 신설).
 *
 * 바로 위 상수의 주석은 *"호출부의 마감 가드가 이미 집을지 말지를 정한다"* 를 **전제**한다.
 * 그런데 실제 호출부(`enrichNaverActivity` 워커 루프)는 마감을 *이미 지났을 때만* 멈췄다 —
 * 즉 그 전제가 거짓이었고, 잔여 50ms 에 집은 항목이 바닥값 1.5s 를 받아 마감을 넘겨 실패했다.
 * 실측(08-02 03:00 회차): `tried 9 / failed 3` — **실패 3 = 동시성 3**(워커마다 마지막 1건).
 *
 * ⇒ 전제를 **함수로 만들어** 호출부가 실제로 지키게 한다. 마감이 없으면(무제한) 항상 true.
 */
export function canStartBudgetedItem(deadline: number | undefined, now = Date.now()): boolean {
  if (!deadline) return true
  return deadline - now >= FETCH_TIMEOUT_FLOOR_MS
}

/**
 * ⏱️ 건당 fetch 타임아웃을 **남은 창에서 유도**한다 (2026-08-02).
 *
 *   바로 위 `ENRICH_DEADLINE_MS_DEFAULT` 주석이 "이 값만으로는 부족하다 — 건당 타임아웃도 내려야 하는데
 *   그건 실패 분포를 보고 정할 일" 이라고 남겨둔 자리의 답이다. 그런데 **상수를 내리는 건 틀린 답**이다:
 *   창이 넉넉할 때도 느린 사이트를 똑같이 버려 수집 품질을 근거 없이 깎는다. 유도값은 그럴 필요가 없다 —
 *   창이 6s 남았으면 6s 를 주고, 0.5s 남았으면 어차피 못 쓸 시간을 안 준다. 즉 **창이 이미 강제하는 것
 *   이상으로는 절대 안 깎는다**(그래서 실패 분포라는 근거 없이도 지금 넣을 수 있다).
 *
 *   왜 필요한가: 마감 검사는 *항목 사이*에서만 일어난다. 6.9초에 통과한 항목이 상수 8s 를 다 쓰면
 *   14.9초에 끝나는데 그때 부모(≈10.5s)는 이미 없다 — **그 라운드는 기록조차 안 남는다**
 *   (관측이 관측 대상을 죽이는 자리, #913 과 같은 형태). 유도값이면 최악 종료가 `마감 + 바닥값` 으로
 *   묶인다: 7,000 + 1,500 = 8.5s < 10.5s.
 *
 * ⚠️ 마감이 없으면(수동 트리거·테스트 — 부모 수명에 안 묶인 경로) 종전 상수를 그대로 쓴다.
 * ⚠️ 못 막는 것: fetch 가 끝난 뒤의 본문 파싱·D1 쓰기 시간은 여기 안 들어온다. 그래서 바닥값과
 *   부모 수명 사이에 2s 의 여유를 남겨 뒀다 — 부모 수명이 줄면 이 여유부터 사라진다.
 */
export function budgetedTimeoutMs(deadline: number | undefined, maxMs: number, now = Date.now()): number {
  if (!deadline) return maxMs
  return Math.max(FETCH_TIMEOUT_FLOOR_MS, Math.min(maxMs, deadline - now))
}

/**
 * 🔌 보강 벽시계의 env 진입점 — 요금제까지 반영한다(`envSubreqCap` 과 같은 이유).
 * ⚠️ 새 보강 레인은 `resolveEnrichDeadlineMs(env.ADS_ENRICH_DEADLINE_MS)` 가 아니라 **이걸** 써라.
 *   raw 만 넘기면 요금제가 닿을 길이 없다 — 그게 유료 전환이 반쪽이던 원인이다.
 */
export function envEnrichDeadlineMs(env: { ADS_ENRICH_DEADLINE_MS?: string; ADS_PLAN?: string } | undefined | null): number {
  return resolveEnrichDeadlineMs(env?.ADS_ENRICH_DEADLINE_MS, resolvePlan(env))
}

/**
 * 🧮 **예산이 못 쓸 행은 애초에 안 읽는다** (2026-08-04 — 대표 "유료 전환 전에 더 잘게 쪼개기").
 *
 * ## 왜
 * 카카오 전화 스윕은 `LIMIT 600` 으로 행을 읽고 나서야 예산을 계산했다. 그런데 예산 천장은
 * 무료 플랫폼 캡(기본 60)이라 **아무리 많이 읽어도 시도할 수 있는 행은 ~50개**다. 나머지
 * 550행은 D1 에서 역직렬화만 되고 루프의 `break` 에 걸려 버려진다.
 *
 * 그 역직렬화가 공짜가 아니다. 무료 플랜의 인보케이션 CPU 예산은 벽시계와 **다른 축**이라,
 * I/O 로 19초를 사는 레인이 있는가 하면 **985ms 만에 `Worker exceeded CPU time limit`** 으로
 * 죽는 레인이 있다(08-04 실측: `collect-company` 985ms · `reclassify-company` 1,316ms ·
 * `collect-hira` 6,409ms · `sweep-kakao-chain` 6,640ms). CPU 시간은 벽시계를 넘을 수 없으므로
 * **1초 안에 한도를 넘었다면 그건 대기가 아니라 계산**이다 — 그리고 이 자리의 계산은
 * *쓰지도 않을 행을 읽는 것*이었다.
 *
 * ## 무엇이 바뀌나 (동작은 안 바뀐다)
 * 잘라내는 행은 **원래도 루프가 손대지 않던 꼬리**다(예산 소진 시 `break`, 도장은 시도한 행에만).
 * 선택 순서(tier 오름차순)가 같으므로 **앞에서부터 같은 행을 같은 순서로** 처리한다.
 * 못 읽은 행은 도장이 없어 다음 라운드에 그대로 다시 잡힌다 — 기아 없음.
 *
 * ⚠️ **이게 못 고치는 것**: 행 읽기 말고 다른 데서 CPU 를 태우는 레인. 그건 각자 재야 한다.
 * ⚠️ 유료 전환 시엔 `envSubreqCap` 이 커져 이 상한도 같이 커진다 — 별도 조정 불필요.
 *
 * @param spendable 이번 회차에 실제로 쓸 수 있는 서브리퀘스트(= 예산 − 이미 쓴 몫 − 부기 예약)
 * @param hardCap   호출부의 기존 상한(env/상수). 이 값을 절대 넘지 않는다.
 * @param slack     조회가 예산을 안 먹고 끝나는 경우(캐시·조기반환)를 위한 여유분
 */
export function rowsWorthReading(spendable: number, hardCap: number, slack = 4): number {
  const cap = Math.max(1, Math.floor(hardCap))
  if (!Number.isFinite(spendable)) return cap          // 모르면 종전대로(조용히 줄이지 않는다)
  return Math.max(1, Math.min(cap, Math.floor(spendable) + Math.max(0, Math.floor(slack))))
}

/**
 * 🧭 **소급 재분류의 인보케이션 몫** (2026-08-04 — `ads-cpu-work-cap` 교리를 호출부에 적용).
 *
 * 그 교리는 *"막아야 하는 건 페이지 크기가 아니라 **인보케이션당 총 작업량**"* 이다.
 * 그런데 재분류 호출부는 **시간 상한만** 걸고 있었다(08-03, 무료 1,800ms). 08-04 실측에서
 * 그 레인은 **1,316ms 에 CPU 한도로 죽었다** — *자기 마감선에 닿기도 전에*. 벽시계는 CPU 의
 * 근사일 뿐이고, 대기가 거의 없는 DB-only 루프에서는 **근사가 가장 나쁘게 어긋난다**
 * (외부 호출이 없어 벽시계가 안 흐르는데 정규식은 계속 CPU 를 태운다).
 *
 * ⇒ 시간 대신 **행 총량**으로 묶는다. 무료 1,000행(= 250 × 최대 4패스)이면 행당 정규식 ~20개
 * 기준 2만 회로, 종전 5,000행(10만 회)의 1/5 이다.
 *
 * ✅ **커버리지 손실 0** — 각 패스가 커서를 저장하고 `done:false` 로 남기므로 다음 회차가
 *   그 지점부터 이어받는다. 한 바퀴에 시간이 더 걸릴 뿐 건너뛰는 행은 없다.
 * ⚠️ 시간 상한은 **그대로 둔다**(제거가 아니라 병행). 둘 중 먼저 닿는 쪽이 멈춘다 —
 *   D1 이 느린 회차엔 시간이, 정상 회차엔 행 수가 먼저 닿는다.
 * ⚠️ 못 고치는 것: 행 하나가 비정상적으로 무거운 경우(초장문 본문). 그건 행 수로 안 잡힌다.
 */
export function reclassifyWorkPlan(env: { ADS_PLAN?: string } | undefined | null): {
  rowsPerPass: number; maxRows: number; deadlineMs: number
} {
  return {
    rowsPerPass: envPlanValue(undefined, 250, 1_000, env),
    maxRows: envPlanValue(undefined, 1_000, 5_000, env),
    deadlineMs: envPlanValue(undefined, 1_800, 12_000, env),
  }
}

/**
 * ⏱️ **파트너 수집 회차의 벽시계 마감선** (2026-08-04 — 라이브 실측 후 신설).
 *
 * `ads:collect-company` 가 16:01 KST 에 **`ms=27,410` 으로 "성공"** 했다. 이 레포가 실측으로 세운
 * 사망 기준선은 `CPU_WALL_MS = 26_000`(08-02 사망 3건의 최솟값에서 내림) — **이미 넘긴 값이
 * 성공으로 기록된 것**이라 화면 어디에도 경고가 없다. 이 레인은 예산(요청 수)만 볼 뿐 **회차가
 * 얼마나 오래 도는지는 아무도 안 봤다**: 키워드 12개 × (네이버 지역 + 카카오 3페이지 + 웹 최대 5페이지)
 * + 사이트 크롤 15건이고, fetch 하나당 타임아웃이 12초다. 느린 회차가 겹치면 그대로 벽에 닿는다.
 *
 * ✅ **커버리지 손실 0** — 이 레인의 커서는 *계획한 창 크기*가 아니라 **실제로 돈 키워드 수**만큼만
 *   전진한다(파일 주석이 그 불변식을 2026-08-02 사고로 세워 뒀다). 그래서 일찍 멈추면 남은 키워드는
 *   건너뛰어지는 게 아니라 **다음 회차의 창에 그대로 들어온다.**
 *
 * ⚠️ **이게 못 고치는 것**: 같은 레인의 *다른* 사망 모드 — 08-04 에는 `ms=985` 로도 죽었다.
 *   1초 안에 한도를 넘은 것이니 그건 대기가 아니라 계산이고(리드 수백 건의 파싱·정규식 의심),
 *   **벽시계로는 못 잡는다.** 그건 `rowsWorthReading` 처럼 *양*으로 묶어야 한다 — 다음 작업.
 * ⚠️ 값의 출처: 같은 파일의 카카오 스윕(`SWEEP_RUN_DEADLINE_MS`)과 같은 12s/24s. 근거 없는 새 숫자를
 *   만들지 않았다(둘 다 같은 부모 수명 안에서 도는 같은 클래스의 레인이다).
 */
export function companyRunDeadlineMs(env: { ADS_PLAN?: string } | undefined | null): number {
  return envPlanValue(undefined, 12_000, 24_000, env)
}
