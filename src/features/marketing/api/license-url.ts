/**
 * 🔬 인허가 API 요청 형태(변종) SSOT + 자가 진단 프로브 — 2026-07-29.
 *
 *   **왜 필요한가**: 인허가 레인의 예산 문제를 고치고 나니(스키마 비용 회수 → spent 20/40) 남은 벽은
 *   상대편이었다 — `API: HTTP 500 — Unexpected errors`, `found: 0`. 500 은 본문에 원인 코드가 없어
 *   `public-data-diag` 의 코드 매핑으로도 "무엇이 틀렸는지"를 알 수 없다.
 *
 *   ⚠️ 그리고 이 환경은 `apis.data.go.kr` 로 나가는 CONNECT 가 프록시에서 막혀 있어 **직접 호출로
 *   확인할 방법이 없다.** 그렇다고 URL 을 추측으로 바꾸는 건 CLAUDE.md 개발 룰 #1 위반이고, 실제로
 *   이 레포에서 반복 실패한 방식이다(추측 fix → 다음 세션이 또 추측).
 *
 *   ⇒ **추측하지 않고 라이브가 판정하게 한다.** 요청 형태를 후보 몇 개로 명시하고, 실패했을 때
 *   후보를 한 번씩 찔러 **어느 것이 200+행을 주는지 라이브에서 확인**한 뒤 그 답을 DB 에 적어 둔다.
 *   다음 실행부터는 곧장 그 형태로 간다(무배포 자가 치유). 시도 이력은 `diag.probe` 로 남겨,
 *   "왜 이 형태를 쓰는가"가 증거와 함께 화면에 보이게 한다.
 *
 *   비용: 프로브는 **실패했을 때만·쿨다운(기본 6h) 안에서 1회**, 후보 수만큼의 요청(현재 4)만 쓴다.
 */

/** 요청 형태 후보. **한 후보는 한 가지만 다르게** 한다 — 그래야 결과가 원인을 지목한다. */
export interface LicenseUrlVariant {
  id: string
  /** 페이지 번호 파라미터명 */
  pageParam: string
  /** 페이지 크기 파라미터명 */
  sizeParam: string
  /** 이 후보가 쓰는 기본 페이지 크기 */
  size: number
  /** 응답 형식 파라미터(포털/기관마다 `type`·`resultType` 이 갈린다) */
  format: Record<string, string>
  /** 변동일 필터(lastModTsBgn/End) 사용 여부 */
  dateFilter: boolean
  /** 이 후보가 무엇을 시험하는가 — 진단 화면에 그대로 노출된다 */
  why: string
}

/**
 * 후보 목록. **첫 번째가 현행**이고, 나머지는 500 의 원인으로 실제로 가능성 있는 것들이다.
 * 순서 = 시도 순서(가장 가능성 높은 것부터). 새 후보를 넣을 땐 반드시 *한 가지만* 바꿔라.
 */
export const LICENSE_VARIANTS: LicenseUrlVariant[] = [
  // ✅ 2026-08-03 라이브 실측으로 **확정**. 게이트웨이 응답 봉투가 자기가 받은 값을 되돌려 준다:
  //    `{"numOfRows":1,"pageNo":2,"totalCount":70469}` ⇒ 이 서비스가 실제로 읽는 페이징 키가 이 둘이다.
  //    (`pageIndex`/`pageSize` 는 같이 보내도 **조용히 무시**된다 — 그래서 아래 v1~v3 는 200 을 받고도
  //     영원히 1페이지만 긁는 함정이었다. 200 이라고 전진하는 게 아니다.)
  { id: 'v4', pageParam: 'pageNo', sizeParam: 'numOfRows', size: 100, format: { type: 'json' }, dateFilter: true, why: 'data.go.kr 표준 페이징(pageNo/numOfRows) — 응답 봉투가 echo 하는 것으로 확정(2026-08-03)' },
  { id: 'v1', pageParam: 'pageIndex', sizeParam: 'pageSize', size: 500, format: { type: 'json', resultType: 'json' }, dateFilter: true, why: '구 localdata 규약(2026-07-22 스펙) — 폐쇄 전 원천의 것' },
  { id: 'v2', pageParam: 'pageIndex', sizeParam: 'pageSize', size: 100, format: { type: 'json', resultType: 'json' }, dateFilter: true, why: '페이지 크기 상한 의심 — 500 → 100' },
  { id: 'v3', pageParam: 'pageIndex', sizeParam: 'pageSize', size: 100, format: { resultType: 'json' }, dateFilter: true, why: '형식 파라미터 중복 의심 — type 제거' },
  { id: 'v5', pageParam: 'pageIndex', sizeParam: 'pageSize', size: 100, format: { type: 'json', resultType: 'json' }, dateFilter: false, why: '변동일 필터가 원인인지 — 날짜 파라미터 제거' },
]

/**
 * 🔑 **오퍼레이션 세그먼트** — 이게 빠져서 인허가 레인 전체가 죽어 있었다 (2026-08-03 실측 확정).
 *
 *   레인은 `…/1741000/general_restaurants` 로 요청했고 게이트웨이는 `NO_OPENAPI_SERVICE_ERROR`(code 12)로
 *   답했다. 그 코드는 *"주소가 지금 안 맞는다"* 까지만 말하고 **폐기인지 오타인지는 구분하지 못한다** —
 *   그래서 이전 세션(나)이 *"서비스 폐기 확정"* 이라고 인계에 적었다. **틀렸다.**
 *
 *   실제로는 **경로 끝에 오퍼레이션 한 칸이 빠져 있었다**:
 *   ```
 *     …/1741000/general_restaurants        → 400 · code 12
 *     …/1741000/general_restaurants/info   → 200 · totalCount 有 · 실제 행
 *   ```
 *   같은 기관(1741000) 형제 서비스 전부 동일하다(휴게음식점·미용업·숙박업·약국 실측 확인).
 *
 *   ⚠️ **env 로 덮을 수 있게 둔다** — 기관이 오퍼레이션명을 바꾸면 배포 없이 고쳐야 한다.
 *     빈 문자열을 주면 오퍼레이션 없이(옛 형태로) 나간다.
 */
export const LICENSE_OPERATION = 'info'

/** env 오퍼레이션 정규화 — 슬래시·공백을 떼고 경로 문자만 남긴다. 미설정이면 기본값. */
export function resolveLicenseOperation(raw: string | undefined | null): string {
  if (raw == null) return LICENSE_OPERATION
  const t = String(raw).trim().replace(/^\/+|\/+$/g, '')
  if (!t) return ''                                  // 명시적 빈 값 = 오퍼레이션 없이(옛 형태)
  return /^[A-Za-z0-9._~-]+$/.test(t) ? t : LICENSE_OPERATION
}

export const DEFAULT_VARIANT_ID = LICENSE_VARIANTS[0].id

export function findVariant(id: string | null | undefined): LicenseUrlVariant {
  return LICENSE_VARIANTS.find(v => v.id === String(id || '')) || LICENSE_VARIANTS[0]
}

/**
 * 페이지 크기 결정 — env(`ADS_LOCALDATA_PAGE_SIZE`)가 있으면 그 값, 없으면 후보 기본값.
 * **무배포 조정 레버**: 500 이 문제라는 게 라이브에서 확인되면 배포 없이 내릴 수 있어야 한다.
 */
export function resolveLicensePageSize(raw: string | undefined | null, variant: LicenseUrlVariant): number {
  const n = parseInt(String(raw || ''), 10)
  if (Number.isFinite(n) && n > 0) return Math.min(1000, Math.max(1, n))
  return variant.size
}

/**
 * 요청 URL 조립(SSOT — 일일/백필/프로브 공용). `keyParam` 은 **이미 인코딩된** 서비스키 문자열.
 * @param operation 경로 끝 오퍼레이션(기본 `info` — 위 `LICENSE_OPERATION` 참조). 빈 문자열이면 붙이지 않는다.
 */
export function buildLicenseUrl(opts: {
  base: string; endpoint: string; keyParam: string; day: string; page: number
  variant: LicenseUrlVariant; size: number; operation?: string
}): string {
  const { base, endpoint, keyParam, day, page, variant, size } = opts
  const op = opts.operation === undefined ? LICENSE_OPERATION : opts.operation
  const path = op ? `${endpoint}/${op}` : endpoint
  const parts = [`serviceKey=${keyParam}`, `${variant.pageParam}=${page}`, `${variant.sizeParam}=${size}`]
  for (const [k, v] of Object.entries(variant.format)) parts.push(`${k}=${v}`)
  if (variant.dateFilter) parts.push(`lastModTsBgn=${day}`, `lastModTsEnd=${day}`)
  return `${base}/${path}?${parts.join('&')}`
}

/**
 * 🔐 서비스키 가리기 — 진단에 URL 을 남기려면 **반드시** 통과시킨다.
 *   이 레포는 public 이고 진단 스냅샷은 어드민 화면·핸드오프 문서로 흘러간다.
 *   키가 한 번이라도 그 경로에 실리면 회수 불가다(= 회전밖에 답이 없다).
 */
export function redactServiceKey(url: string): string {
  return String(url || '').replace(/([?&](?:serviceKey|authKey|ServiceKey)=)[^&]*/gi, '$1***')
}

/** 프로브 1회 결과. */
export interface ProbeAttempt { id: string; ok: boolean; rows: number; msg?: string }

/** DB(`ads_localdata_variant`)에 저장되는 상태 — 어느 형태를 왜 쓰는지 + 언제 확인했는지. */
export interface VariantState {
  id: string; probed_at?: number; attempts?: ProbeAttempt[]
  /** 이 상태를 만들 때의 규칙 버전. 다르면 **믿지 않는다**(아래 `LICENSE_STATE_VERSION`). */
  v?: number
}

/**
 * 🧊 **저장된 판정의 유효기간** — 라이브가 즉시 드러낸 구멍의 수리 (2026-08-03).
 *
 *   `/info` 를 고쳐 배포한 직후 라이브를 봤더니 DB 에 이렇게 남아 있었다:
 *   ```json
 *     ads_localdata_variant = {"id":"v1", "probed_at":…, "attempts":[…code 12 전부 실패…]}
 *   ```
 *   **주소가 틀렸던 시절에 내려진 판정**이다. 그때는 무엇을 찔러도 실패했으니 이 값은 정보가 아니라
 *   *잔해*다. 그런데 기본값을 v4 로 올린 것만으로는 이게 안 지워진다 — 저장된 값이 항상 이긴다.
 *
 *   더 나쁜 건 **스스로 못 빠져나온다**는 점이다. 프로브는 *실패했을 때만* 도는데, 경로가 고쳐진 지금
 *   v1 도 200 을 받는다(그 서비스는 `pageIndex`/`pageSize` 를 **조용히 무시**할 뿐이다). 즉:
 *   실패가 없다 → 프로브가 안 돈다 → **영원히 v1** → 매 회차 같은 페이지만 긁는다.
 *   에러도 경고도 없다. 이 레포가 "조용한 전진 0"이라 부르는 바로 그 모양이다.
 *
 *   ⇒ 규칙이 바뀌면 **옛 판정을 무효로** 한다(이 레포의 `*_RULES_VERSION` 관용구와 같은 철학).
 *   ⚠️ **요청 형태·경로에 영향을 주는 변경을 하면 이 값을 +1** 하라. 안 올리면 라이브는 옛 답을 계속 쓴다.
 *     v1(2026-08-03) = 오퍼레이션 `/info` 도입 + 기본 후보 v4 승격.
 */
export const LICENSE_STATE_VERSION = 1

/**
 * 저장된 판정을 **쓸 수 있는가** — 버전이 다르면 `null`(= 저장된 적 없음처럼 취급 → 기본값 + 재프로브).
 * @returns 그대로 쓸 수 있으면 상태, 낡았으면 null
 */
export function usableVariantState(state: VariantState | null | undefined): VariantState | null {
  if (!state || !state.id) return null
  return Number(state.v || 0) === LICENSE_STATE_VERSION ? state : null
}

/** 프로브 재시도 쿨다운(기본 6h) — 실패가 상대편 일시 장애일 때 매 라운드 4발씩 쏘지 않게. */
export const PROBE_COOLDOWN_MS = 6 * 3_600_000

export function shouldProbe(state: VariantState | null | undefined, nowMs: number, cooldownMs = PROBE_COOLDOWN_MS): boolean {
  const at = Number(state?.probed_at)
  if (!Number.isFinite(at) || at <= 0) return true
  return nowMs - at >= cooldownMs
}

/**
 * 후보들을 한 번씩 찔러 **행을 주는 형태**를 찾는다. 판정은 라이브가 한다(우리가 추측하지 않는다).
 *
 *   @param fetchPage 주입 — 테스트에서 네트워크 없이 검증하기 위함(그리고 예산 차감은 호출부 책임).
 *   @param skip      이미 이번 실행에서 실패한 형태(다시 쏘지 않는다).
 *   @returns winner  행을 준 형태의 id. 아무도 못 주면 null(= 형태 문제가 아니다 → 키·활용신청 쪽).
 */
export async function probeLicenseVariants(opts: {
  base: string; endpoint: string; keyParam: string; day: string
  sizeOverride?: string | null
  /** 경로 끝 오퍼레이션. 미지정이면 기본(`info`) — 레인과 같은 주소를 찔러야 판정이 의미 있다. */
  operation?: string
  skip?: string[]
  fetchPage: (url: string) => Promise<{ ok: boolean; rows: number; msg?: string }>
  canSpend?: () => boolean
}): Promise<{ winner: string | null; attempts: ProbeAttempt[] }> {
  const attempts: ProbeAttempt[] = []
  const skip = new Set(opts.skip || [])
  for (const v of LICENSE_VARIANTS) {
    if (skip.has(v.id)) continue
    if (opts.canSpend && !opts.canSpend()) break
    const url = buildLicenseUrl({
      base: opts.base, endpoint: opts.endpoint, keyParam: opts.keyParam, day: opts.day, page: 1,
      variant: v, size: resolveLicensePageSize(opts.sizeOverride, v), operation: opts.operation,
    })
    const r = await opts.fetchPage(url).catch(() => ({ ok: false, rows: 0, msg: '프로브 예외' }))
    attempts.push({ id: v.id, ok: !!r.ok, rows: r.rows | 0, msg: r.msg ? String(r.msg).slice(0, 120) : undefined })
    // ✅ '행이 왔다' 만 승리로 친다. 200 인데 0행은 **그날 변동이 없어서**일 수도 있어 판정 근거가 못 된다.
    if (r.ok && r.rows > 0) return { winner: v.id, attempts }
  }
  return { winner: null, attempts }
}
