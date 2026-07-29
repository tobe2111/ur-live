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
/** 회복 시 상향 배율(과학습 되돌리기). */
const RECOVER_RATIO = 1.25
/** 한도 관측 시 하향 배율(부딪힌 지점보다 확실히 아래로). */
const BACKOFF_RATIO = 0.8

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
  const ceiling = Math.min(envBudget, platformCap)
  if (hitLimit) return Math.max(Math.min(SUBREQ_CAP_MIN, ceiling), Math.min(ceiling, Math.floor(spent * BACKOFF_RATIO)))
  // 이미 천장을 넘게 학습돼 있으면(과거 드리프트분) 천장으로 끌어내린다 — 그대로 두면 영영 안 내려온다.
  if (learnedCap > ceiling) return ceiling
  if (learnedCap > 0 && learnedCap < ceiling) return Math.min(ceiling, Math.ceil(learnedCap * RECOVER_RATIO))
  return null
}
