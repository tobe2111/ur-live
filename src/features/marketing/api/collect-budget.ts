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

/** env 의 플랫폼 천장(없거나 이상값이면 기본값). 상한 900 은 유료 플랜(1,000)의 꼬리 여유. */
export function platformSubreqCap(raw?: string | null): number {
  const n = parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? Math.min(900, Math.max(10, n)) : SUBREQ_PLATFORM_CAP_DEFAULT
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
  return Math.max(Math.min(SUBREQ_CAP_MIN, ceiling), base - ABANDON_STEP)
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
  if (learnedCap > 0 && learnedCap < ceiling) return Math.min(ceiling, learnedCap + RECOVER_STEP)
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

/** env(`ADS_ENRICH_DEADLINE_MS`) → 유효 상한(ms). 범위 5s~120s 로 클램프, 비숫자·부재는 기본값. */
export function resolveEnrichDeadlineMs(raw: unknown): number {
  const n = parseInt(String(raw ?? ''), 10)
  return Math.min(120_000, Math.max(5_000, Number.isFinite(n) && n > 0 ? n : ENRICH_DEADLINE_MS_DEFAULT))
}
