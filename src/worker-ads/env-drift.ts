/**
 * 🔌 **설정했는데 아무 일도 안 일어나는 환경변수를 드러낸다** (2026-08-03 실측 후 신설).
 *
 * ## 무엇이 있었나
 * ur-ads 바인딩 42개를 훑다가 **코드가 한 번도 안 읽는 키 4개**를 찾았다:
 *
 * ```
 *   DS_LOCALDATA_BACKFILL_DAYS   ← ADS_ 접두 오타(`A` 가 빠졌다)
 *   ENRICH_BUDGET                ← 실제 키는 ADS_ENRICH_BUDGET
 *   ENRICH_ROUNDS                ← 실제 키는 ADS_COLLECT_ROUNDS / ADS_INFLUENCER_ENRICH_ROUNDS
 *   SHEETS_SYNC_ENABLED          ← 실제 키는 ADS_SHEETS_SYNC_ENABLED
 * ```
 *
 * 넷 다 **오류를 내지 않는다.** 대시보드엔 값이 보이고, 코드는 `undefined` 를 받아 기본값으로 간다.
 * 즉 대표는 "설정했다"고 알고 있는데 **실제로는 기본값으로 돌고 있다** — 이 레포가 반복해서 당한
 * *"실패가 아니라 조용한 부재"* 클래스 그대로다(배포는 초록불이고 아무도 모른다).
 *
 * ## 왜 런타임인가
 * 정답 목록은 **코드**에 있고 실제 설정은 **Cloudflare 대시보드**에 있다. CI 는 대시보드를 못 본다.
 * 두 쪽이 만나는 유일한 자리가 워커 런타임의 `Object.keys(env)` 다.
 *
 * ## 두 방향을 각각 다른 장치가 지킨다
 *   · **코드 → 목록**: `ads-env-drift.test.ts` 가 소스에서 읽는 키가 목록에 다 있는지 본다
 *     (새 노브를 추가하고 목록에 안 넣으면 그 키가 "미사용"으로 **오신고**된다 — 오경보 방지).
 *   · **대시보드 → 목록**: 이 함수가 런타임에 본다.
 *
 * ## ⚠️ 못 하는 것
 * - **고치지 않는다.** 이름이 틀렸는지 그냥 남은 것인지는 사람이 판단한다(지우는 것도 사람이).
 * - 값이 틀린 것(예: 숫자여야 하는데 문자)은 못 본다 — 이름만 본다.
 */

/**
 * ads 워커가 **실제로 읽는** 환경변수 이름 (SSOT).
 * ⚠️ 새 노브를 코드에 추가하면 여기에도 추가할 것 — 안 하면 유닛이 실패한다(그게 목적이다).
 */
export const ADS_ENV_KNOWN: readonly string[] = [
  // ── ⚙️ `ADS_*` 노브·게이트 — **소스 스캔에서 기계로 뽑았다**(손으로 적으면 반드시 빠진다.
  //   첫 시도가 실제로 64개를 빠뜨렸고 유닛이 즉시 잡았다). 갱신: 유닛이 알려 주는 대로 추가.
  'ADS_ACCESS_CODE', 'ADS_AI_DAILY_CAP', 'ADS_ALERT_ALIMTALK_TPL',
  'ADS_AUTOBID_ENABLED', 'ADS_AUTOBID_SHADOW_ENABLED', 'ADS_AUTOCOLLECT_BATCH',
  'ADS_AUTO_COLLECT_ENABLED', 'ADS_AUTO_MAINTENANCE_ENABLED', 'ADS_BANK_INFO',
  'ADS_BILLING_ENFORCED', 'ADS_BIZINFO_ENDPOINT', 'ADS_COLLECT_CAFE_ENABLED',
  'ADS_COLLECT_ROUNDS', 'ADS_COLLECT_TISTORY_DISABLED', 'ADS_COMMERCE_ENABLED',
  'ADS_COMMERCE_ENDPOINT', 'ADS_COMMERCE_OP', 'ADS_COMPANY_BATCH',
  'ADS_COMPANY_COLLECT_ENABLED', 'ADS_COMPANY_REQUIRE_CONTACT', 'ADS_COMPANY_SUBREQUEST_BUDGET',
  'ADS_COMPANY_WEB_PAGES', 'ADS_COMPANY_WEB_TIER_MAX', 'ADS_CONTENT_DAILY_CAP',
  'ADS_DOMAINS', 'ADS_ENRICH_BUDGET', 'ADS_ENRICH_CONCURRENCY',
  'ADS_ENRICH_DEADLINE_MS', 'ADS_ENRICH_DISABLED', 'ADS_ENRICH_NAVER_FLOOR_PCT',
  'ADS_ENRICH_PHONE_CAP', 'ADS_ENRICH_ROUNDS', 'ADS_FRANCHISE_ENABLED',
  'ADS_FRANCHISE_ENDPOINT', 'ADS_FRANCHISE_OP', 'ADS_FRANCHISE_PAGES',
  'ADS_FRANCHISE_YEAR', 'ADS_HIRA_ENABLED', 'ADS_HIRA_ROWS',
  'ADS_IMAGE_PROVIDER', 'ADS_INFLUENCER_ENRICH_BUDGET', 'ADS_INFLUENCER_ENRICH_DISABLED',
  'ADS_INFLUENCER_ENRICH_FANOUT', 'ADS_INFLUENCER_ENRICH_ROUNDS', 'ADS_KAKAO_SWEEP_CAP',
  'ADS_KAKAO_SWEEP_CHAIN', 'ADS_LANE', 'ADS_LANES_PER_TICK',
  'ADS_LANE_ALARM_ENABLED', 'ADS_LANE_ALARM_INTERVAL_MS', 'ADS_LANE_ALARM_RUNS_PER_HOUR',
  'ADS_LOCALDATA_BACKFILL_DAYS', 'ADS_LOCALDATA_BUDGET', 'ADS_LOCALDATA_CHAIN',
  'ADS_LOCALDATA_DEADLINE_MS', 'ADS_LOCALDATA_ENABLED', 'ADS_LOCALDATA_ENDPOINT',
  'ADS_LOCALDATA_ENDPOINTS', 'ADS_LOCALDATA_MAX_PAGES', 'ADS_LOCALDATA_PAGE_SIZE',
  'ADS_LOCALDATA_SERVICE_KEY', 'ADS_LOCALDATA_VARIANT', 'ADS_MAINT_OPS_BUDGET',
  'ADS_MEASURE_SHARE', 'ADS_MEDIA_DAILY_CAP', 'ADS_MEDIA_ENABLED',
  'ADS_NARA_ENDPOINT', 'ADS_NARA_VENDOR_DAYS', 'ADS_NARA_VENDOR_ENABLED',
  'ADS_NARA_VENDOR_ENDPOINT', 'ADS_NARA_VENDOR_OP', 'ADS_NAVER_EXTRA',
  'ADS_NEIS_ENABLED', 'ADS_NEIS_SERVICE', 'ADS_NOTICE_ENABLED',
  'ADS_NPS_ENABLED', 'ADS_ONBOARDING_DISABLED', 'ADS_OUTREACH_PREFILL_BUFFER',
  'ADS_OUTREACH_PREFILL_ENABLED', 'ADS_PLAN', 'ADS_REMINDER_ENABLED',
  'ADS_SHEETS_SYNC_ENABLED', 'ADS_STOREINFO_BATCH', 'ADS_STOREINFO_ENABLED',
  'ADS_STORE_KAKAO_BUDGET', 'ADS_STORE_KAKAO_ENABLED', 'ADS_SUBREQUEST_BUDGET',
  'ADS_SUBREQ_PLATFORM_CAP', 'ADS_TOSS_ENABLED', 'ADS_VIDEO_PROVIDER',
  'ADS_WORK24_ENABLED', 'ADS_WORK24_LIST_URL', 'ADS_WORKER_ENABLED',
  'ADS_YT_PAGES', 'ADS_YT_PERF_UNITS', 'ADS_YT_SEARCH_BUDGET',
  // ── 🔑 외부 키 · 인프라 바인딩(`ADS_` 접두가 아니라 스캔에 안 걸린다 — 여기만 수동)
  'PUBLIC_DATA_SERVICE_KEY', 'NTS_API_KEY', 'NEIS_API_KEY', 'WORK24_API_KEY',
  'KAKAO_REST_API_KEY', 'YOUTUBE_API_KEY', 'ANTHROPIC_API_KEY', 'RESEND_API_KEY',
  'NAVER_SEARCH_CLIENT_ID', 'NAVER_SEARCH_CLIENT_SECRET',
  'NAVER_SEARCHAD_ACCESS_LICENSE', 'NAVER_SEARCHAD_SECRET_KEY', 'NAVER_SEARCHAD_CUSTOMER_ID',
  'GSHEETS_SA_EMAIL', 'GSHEETS_SA_KEY', 'GSHEETS_SHEET_ID',
  'DB', 'SELF', 'CACHE_KV', 'SESSION_KV', 'RATE_LIMIT_KV', 'JWT_SECRET', 'ENVIRONMENT',
  'LANE_ALARM', 'SUPPLY_MAKER_COLLECT_ENABLED', 'BLOG_AI_DRAFTS_ENABLED',
]

const KNOWN = new Set(ADS_ENV_KNOWN)

/**
 * 런타임에 설정돼 있는데 **코드가 안 읽는** 키 목록. 없으면 빈 배열.
 * @param env 워커 env (바인딩 객체)
 * @param limit 관측 문자열이 비대해지지 않게 상한(하트비트 사유줄에 실린다)
 */
export function unknownAdsEnvKeys(env: unknown, limit = 6): string[] {
  if (!env || typeof env !== 'object') return []
  const out: string[] = []
  for (const k of Object.keys(env as Record<string, unknown>)) {
    if (KNOWN.has(k)) continue
    // `__` 로 시작하는 내부 주입값·소문자 키는 우리 노브가 아니다(플랫폼/번들러 소관).
    if (k.startsWith('__') || k !== k.toUpperCase()) continue
    out.push(k)
    if (out.length >= limit) break
  }
  return out.sort()
}

/** 하트비트 `extra` 에 실을 형태. 이상 없으면 **키 자체를 안 넣는다**(평상시 소음 0). */
export function envDriftInfo(env: unknown): { env_unused?: string } {
  const u = unknownAdsEnvKeys(env)
  return u.length ? { env_unused: u.join(',') } : {}
}
