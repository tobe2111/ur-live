/**
 * 🎛️ **처리량 노브 등기부** — 요금제가 닿아야 할 것과 닿으면 안 될 것 (2026-08-02).
 *
 * ## 왜 등기부인가 — 하나씩 고치는 방식은 끝나지 않는다
 * 같은 날 **같은 결함을 세 번** 만났다: 플랫폼 천장 → 보강 벽시계 → DO 알람·레인 예산.
 * 매번 "이 상수가 요금제를 모른다"였고, 매번 *발견*으로 찾았다. 발견에 의존하면 다음 노브도 놓친다.
 *
 * ⇒ **모든 숫자 노브를 여기 등재**하고, 새 노브가 생기면 CI 가 분류를 요구한다
 *   (`scripts/check-plan-knob-coverage.mjs`). "기억했는가"를 "잊을 수 없다"로 바꾼다.
 *
 * ## 🔴 전부 올리면 안 된다 — 이게 이 파일의 핵심
 * 노브가 무엇에 묶여 있느냐가 다르다:
 *
 * | 종류 | 무엇이 한계인가 | 유료 전환 시 |
 * |---|---|---|
 * | `cf` | **Cloudflare** 서브리퀘스트·CPU·D1 | ✅ 함께 오른다 |
 * | `external` | **외부 API 쿼터**(YouTube 유닛·카카오/네이버 일 한도) | ❌ 고정 — 올리면 **그날 쿼터를 태운다** |
 * | `shape` | 예산이 아니라 **데이터 모양**(어느 tier 를 훑나, 몇 페이지를 보나) | ❌ 고정 — 성능과 무관 |
 *
 * ⚠️ `external` 을 `cf` 로 잘못 분류하면 **유료 전환이 곧 장애**가 된다: Workers 예산은 늘었는데
 *   YouTube 가 403 을 주기 시작하고, 그 레인은 그날 내내 죽는다. 분류는 추측하지 말고
 *   **그 숫자가 무엇을 소비하는지**를 코드에서 확인하고 적을 것.
 */

/** 노브가 무엇에 묶여 있는가. */
export type KnobClass =
  | 'cf'        // Cloudflare 자원(서브리퀘스트·CPU·D1) — 요금제와 함께 오른다
  | 'external'  // 외부 API 쿼터 — 요금제와 무관하며 올리면 해롭다
  | 'shape'     // 예산이 아니라 데이터 모양/의미 — 성능과 무관

export interface PlanKnob {
  /** env 이름(`ADS_` 접두어 포함). */
  env: string
  cls: KnobClass
  /** 왜 이 분류인가 — **이유 없는 등재 금지**(다음 세션이 판단을 못 이어받는다). */
  why: string
}

/**
 * 등기부. **새 숫자 노브를 추가하면 여기 한 줄**을 더해야 CI 가 통과한다.
 *
 * ⚠️ `cf` 로 적었으면 실제로 요금제 인지 리졸버(`envLaneBudget`/`envSubreqCap`/`envEnrichDeadlineMs`
 *   /`resolveInterval`/`resolveRunsPerHour`/`lanesPerTick`)를 **거쳐야** 한다 — 가드가 그것도 본다.
 *   등기만 하고 배선을 안 하면 오늘 세 번 겪은 그 상태(닿지 않는 노브)가 그대로 재현된다.
 */
export const PLAN_KNOBS: readonly PlanKnob[] = [
  // ── Cloudflare 자원 — 요금제와 함께 오른다
  { env: 'ADS_LANES_PER_TICK', cls: 'cf', why: '회차당 레인 수 = 부모 인보케이션 CPU' },
  { env: 'ADS_SUBREQ_PLATFORM_CAP', cls: 'cf', why: '서브리퀘스트 플랫폼 천장' },
  { env: 'ADS_ENRICH_DEADLINE_MS', cls: 'cf', why: '보강 라운드 벽시계 = 부모 수명(CPU)' },
  { env: 'ADS_NARA_CONTRACT_DEADLINE_MS', cls: 'cf', why: '계약 수집 라운드 벽시계 = 부모 수명(CPU)' },
  { env: 'ADS_NARA_CONTRACT_ROWS', cls: 'cf', why: '페이지당 행 수 — 요청 **수**는 그대로고 파싱량만 는다(계약 1건 ~1.9KB). 묶인 것은 CPU' },
  { env: 'ADS_ENRICH_BUDGET', cls: 'cf', why: '보강 레인 서브리퀘스트 예산' },
  { env: 'ADS_COMPANY_SUBREQUEST_BUDGET', cls: 'cf', why: '업체 레인 서브리퀘스트 예산' },
  { env: 'ADS_WEBKR_SUBREQUEST_BUDGET', cls: 'cf', why: '웹문서(홈페이지) 전용 레인 서브리퀘스트 예산' },
  { env: 'ADS_INFLUENCER_ENRICH_BUDGET', cls: 'cf', why: '인플루언서 보강 서브리퀘스트 예산' },
  { env: 'ADS_MAINT_OPS_BUDGET', cls: 'cf', why: '정비 레인 D1 연산 예산' },
  { env: 'ADS_SUBREQUEST_BUDGET', cls: 'cf', why: '인플루언서 수집 서브리퀘스트 예산' },
  { env: 'ADS_LANE_ALARM_INTERVAL_MS', cls: 'cf', why: 'DO 알람 간격 = 인보케이션 빈도' },
  { env: 'ADS_LANE_ALARM_RUNS_PER_HOUR', cls: 'cf', why: 'DO 알람 시간당 인보케이션 상한' },

  // ── 외부 API 쿼터 — 🔴 올리면 그날 쿼터를 태운다
  { env: 'ADS_YT_SEARCH_BUDGET', cls: 'external', why: 'YouTube Data API 유닛(일 10,000) — 올리면 그날 검색이 통째로 막힌다' },
  { env: 'ADS_YT_PERF_UNITS', cls: 'external', why: 'YouTube 유닛(위와 같은 일 쿼터를 나눠 쓴다)' },
  { env: 'ADS_YT_PAGES', cls: 'external', why: '검색 페이지 수 → YouTube 유닛 배수' },
  { env: 'ADS_STORE_KAKAO_BUDGET', cls: 'external', why: '카카오 로컬 일 쿼터(보강 레인과 같은 키를 나눠 쓴다)' },
  { env: 'ADS_KAKAO_SWEEP_CHAIN', cls: 'external', why: '카카오 전화 스윕 체인 깊이 → 같은 일 쿼터 소비' },
  { env: 'ADS_NAVER_EXTRA', cls: 'external', why: '네이버 검색 추가 호출 → 네이버 일 쿼터' },
  { env: 'ADS_COMPANY_BATCH', cls: 'external', why: '회당 키워드 수 → 네이버·카카오 호출 배수' },
  { env: 'ADS_WEBKR_BATCH', cls: 'external', why: '회당 키워드 수 → 네이버 웹문서 호출 배수(키워드당 1~2페이지)' },
  { env: 'ADS_AUTOCOLLECT_BATCH', cls: 'external', why: '회당 키워드 수 → 네이버 검색 호출 배수' },
  { env: 'ADS_STOREINFO_BATCH', cls: 'external', why: '공공 API 회당 배치 → 그쪽 호출 한도' },
  { env: 'ADS_COMPANY_WEB_PAGES', cls: 'external', why: '웹문서 검색 페이지 수 → 네이버 쿼터' },
  { env: 'ADS_LOCALDATA_CHAIN', cls: 'external', why: '인허가 API 체인 깊이 → 공공 API 호출' },
  { env: 'ADS_NARA_CONTRACT_PAGES', cls: 'external', why: '계약정보 회당 페이지 수 = data.go.kr 요청 수 → 포털 일 쿼터(요금제와 무관)' },

  // ── 데이터 모양 — 예산이 아니다
  { env: 'ADS_COMPANY_WEB_TIER_MAX', cls: 'shape', why: '어느 tier 까지 웹 레인을 붙일지 — 대상 범위이지 속도가 아니다' },
  { env: 'ADS_NARA_CONTRACT_DAYS', cls: 'shape', why: '날짜 창 폭 — 무엇을 보는가이지 얼마나 빨리 보는가가 아니다(창이 무시되면 값 자체가 무의미)' },
  { env: 'ADS_MEASURE_SHARE', cls: 'shape', why: '측정/수집 몫 **비율** — 총량은 lanesPerTick 이 정한다' },
  // ⚠️ **이 한 줄은 확신이 낮다 — 다음 세션이 데이터로 결론지어야 한다.**
  //   `shape` 로 둔 근거: 각 조각이 자기 서브리퀘스트 예산을 쓰므로 K 는 총 작업량이 아니라 나누는 방식이다.
  //   `cf` 라는 반론: 조각은 `SELF.fetch` 자식이고 **피호출자 CPU 는 호출자 몫**이라 K 를 올리면
  //     드라이버(→ 나아가 cron 부모)의 CPU 가 곧바로 오른다. `dispatch-budget.ts` 주석도
  //     *"부모가 죽기 시작하면 비율이 아니라 K 를 먼저 내려라"* 라고 적고 있다 — 즉 이미 CF 자원처럼 다룬다.
  //   판정에 필요한 것: 보강의 병목이 CPU 인가 외부 쿼터인가. 08-02 라이브는 **CPU 쪽**을 가리킨다
  //     (`planned=20` 인데 착지 2 · `yt_budget 52/90` 으로 쿼터는 남았다). 그렇다면 유료에서 K 는 올라야 한다.
  //   그런데도 안 바꾼 이유: K 는 **부모 비용을 곱**하므로, 레인 수 학습기(`lane-aimd.ts`)가 라이브에서
  //     안정된 걸 확인하기 전에 같은 축을 둘 다 움직이면 **어느 쪽이 원인인지 못 가린다.**
  //   ⇒ 학습기가 붙은 뒤 `ads_tick_history` 로 한 축씩 판정할 것.
  { env: 'ADS_INFLUENCER_ENRICH_FANOUT', cls: 'shape', why: '조각 수 K — 각 조각이 자기 예산을 쓴다. ⚠️ 다만 자식 CPU 는 호출자 몫이라 cf 로 볼 여지가 있다(위 주석의 미결 항목)' },
  { env: 'ADS_INFLUENCER_ENRICH_ROUNDS', cls: 'shape', why: '계획 라운드 수 — 실제 수행은 벽시계·예산이 정한다(실측: 계획 20 · 도달 2)' },
]

/** 빠른 조회. 가드와 유닛이 함께 쓴다. */
export const knobClass = (env: string): KnobClass | null =>
  PLAN_KNOBS.find(k => k.env === env)?.cls ?? null

/** `cf` 노브 목록 — 가드가 "요금제 리졸버를 거치는가"를 검사할 대상. */
export const cfKnobs = (): string[] => PLAN_KNOBS.filter(k => k.cls === 'cf').map(k => k.env)
