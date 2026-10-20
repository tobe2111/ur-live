/**
 * 🩺 공공데이터포털(data.go.kr) 실패 진단 SSOT — 2026-07-28.
 *
 *   **왜 필요한가**: 수집 레인 5개(프랜차이즈·나라장터·고용24·국세청·인허가)가 오래 0건인데,
 *   상태줄에 남는 건 `HTTP 404` · `HTTP 503` 뿐이었다. data.go.kr 은 실패해도 **본문에 원인 코드**를
 *   담아 보내는데(`NO_OPENAPI_SERVICE_ERROR` 등) 호출부가 `res.ok` 만 보고 **본문을 버렸다**.
 *   그래서 "내가 URL 을 틀렸나 / 대표가 활용신청을 안 했나"를 몇 주째 구분하지 못했다.
 *
 *   ⚠️ 이 판단은 **추측으로 대신할 수 없다**(CLAUDE.md 개발 룰 #1). 특히 이 개발 환경은
 *   `apis.data.go.kr` 로 나가는 CONNECT 가 프록시에서 막혀 있어 **직접 호출로 확인할 방법이 없다.**
 *   ⇒ 라이브 워커가 받은 본문을 그대로 계측에 남기는 것이 유일한 ground truth 다.
 *
 *   비용 0 — 이미 받은 응답을 읽기만 한다(추가 요청 없음).
 */

/** data.go.kr 표준 에러코드 → **누가 무엇을 해야 하는지**. 이 매핑이 이 모듈의 존재 이유다. */
const CODE_HINT: Record<string, string> = {
  // ⚠️ 2026-08-03 대조군 실측으로 문구를 **강화**했다. 이전 문구("URL/오퍼레이션명이 틀렸거나 폐기됨")는
  //   사실이었지만, 내가 그걸 읽고도 "폐기 확정"으로 좁혀 인계 문서에 그렇게 적었다(#985).
  //   두 가능성을 나열만 하면 읽는 사람이 자기 가설에 맞는 쪽을 고른다 ⇒ **오추론을 명시적으로 막는다.**
  //   실측 대조군: 살아 있는 `1130000/MllBs_2Service`(같은 키로 200·264만건) 도
  //     · 오퍼레이션을 틀리면(`/getNoSuchOperation`) → code 12
  //     · base 만 주면(`/MllBs_2Service`)         → code 12
  //   즉 **이 코드는 "폐기"와 "경로가 안 맞음"을 원리적으로 구분하지 못한다.**
  NO_OPENAPI_SERVICE_ERROR:
    '이 **주소 자체가 게이트웨이에 없다**(폐기됐거나 경로가 틀렸다) — 둘은 이 코드로 구분되지 않는다' +
    '(실측: 살아있는 서비스도 오퍼레이션을 틀리면 같은 code 12). ' +
    '🔑 단, **활용신청 문제는 아니다** — 미신청은 code 30(403)으로 따로 온다(2026-08-03 대조군 실측). ' +
    '⇒ 포털 상세페이지의 **"미리보기" 실제 호출 URL**과 대조할 것 → 맞으면 엔드포인트 env 로 무배포 교체',
  SERVICE_KEY_IS_NOT_REGISTERED_ERROR: '이 서비스에 **활용신청이 안 된 키** → data.go.kr 에서 해당 API 활용신청 필요(대표)',
  SERVICE_ACCESS_DENIED_ERROR: '활용신청이 **승인 대기/거절** 상태 → data.go.kr 마이페이지 확인(대표)',
  DEADLINE_HAS_EXPIRED_ERROR: '활용 **기간 만료** → data.go.kr 에서 연장 신청(대표)',
  LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR: '일일 트래픽 초과 → 호출량을 줄이거나 증량 신청',
  INVALID_REQUEST_PARAMETER_ERROR: '요청 파라미터가 규격과 다름 → 코드에서 수정',
  HTTP_ERROR: '포털 게이트웨이 오류(일시적일 수 있음) → 재시도 후에도 지속되면 서비스 상태 확인',
  UNKNOWN_ERROR: '포털 내부 오류 → 시간을 두고 재시도',
}

/** 본문에서 표준 에러코드를 찾는다(JSON·XML 양쪽 — 포털이 형식을 섞어 준다). */
function findCode(body: string): string | null {
  for (const code of Object.keys(CODE_HINT)) if (body.includes(code)) return code
  // returnReasonCode(숫자) 만 주는 변종 — 대표적인 것만 옮긴다.
  const num = body.match(/returnReasonCode["'>\s:]+(\d{2,3})/i)?.[1]
  if (num === '30') return 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR'
  if (num === '31') return 'DEADLINE_HAS_EXPIRED_ERROR'
  if (num === '22') return 'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR'
  if (num === '12' || num === 'notFound') return 'NO_OPENAPI_SERVICE_ERROR'
  return null
}

/**
 * 실패 응답을 **행동 가능한 한 줄**로. 호출부는 이걸 그대로 `diag.error` 에 넣으면 된다.
 *   `res` 가 null 이면 네트워크 단계 실패(호출부가 준 `netMsg` 를 그대로 쓴다).
 *
 * @example  `HTTP 404 · NO_OPENAPI_SERVICE_ERROR — 서비스 URL/오퍼레이션명이 틀렸거나 폐기됨 …`
 */
export async function describePublicDataFailure(res: Response | null, netMsg = '네트워크 오류'): Promise<string> {
  if (!res) return netMsg
  // 본문은 실패 원인의 유일한 단서다 — 절대 버리지 않는다(이 모듈이 생긴 이유).
  const body = (await res.text().catch(() => '')) || ''
  const flat = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const code = findCode(body)
  const head = `HTTP ${res.status}`
  if (code) return `${head} · ${code} — ${CODE_HINT[code]}`
  if (!flat) return `${head} (본문 없음)`
  return `${head} — ${flat.slice(0, 180)}`
}

/**
 * 🔑 서비스키 정규화 — **인코딩 키가 들어와도 이중 인코딩되지 않게** (2026-07-28).
 *
 *   data.go.kr 은 같은 키를 **인코딩(`%2B`·`%2F`·`%3D`)** 과 **디코딩(`+`·`/`·`=`)** 두 벌로 준다.
 *   포털 화면도 *"Encoding/Decoding 된 인증키를 적용하면서 구동되는 키를 사용하라"* 고만 안내한다.
 *   호출부는 `encodeURIComponent(key)` 를 하므로 **인코딩 키가 저장돼 있으면 두 번 인코딩되어 인증 실패**한다.
 *
 *   ⚠️ 그런데 Cloudflare 시크릿은 **쓰기 전용**이라 어느 쪽이 저장돼 있는지 **볼 수가 없다.**
 *   ⇒ 알아낼 필요가 없게 만든다: 들어온 값을 한 번 디코드해 본 뒤 **항상 한 번만** 인코딩한다.
 *   - 디코딩 키(`+/=`, `%` 없음)  → decode 는 no-op → 기존과 동일
 *   - 인코딩 키(`%2B` 등)         → 원문으로 되돌린 뒤 한 번 인코딩 → 정상
 *   어느 쪽을 넣든 같은 결과가 되므로 이 실패 클래스가 **구조적으로 사라진다.**
 */
export function serviceKeyParam(raw: string | undefined | null): string {
  const k = String(raw || '')
  if (!k) return ''
  let base = k
  if (/%[0-9A-Fa-f]{2}/.test(k)) {
    // 퍼센트 시퀀스가 있으면 인코딩 키일 가능성 — 디코드해 본다(깨지면 원문 유지).
    try { base = decodeURIComponent(k) } catch { base = k }
  }
  return encodeURIComponent(base)
}

/**
 * 🕳️ **'값 없음'을 문자열로 주는 것** — data.go.kr 공통 습성 (2026-07-29 실측으로 확인).
 *
 *   통신판매 원부 실응답: `telno: "N/A"` · `rnAddr: "N/A"` · `domnCn: "N/A"` · `crno: "N/A"`.
 *   문제는 `"N/A"` 가 **JS 에서 truthy** 라는 것이다. 별칭 폴백(`g(it,'rnAddr','lctnAddr')`)이
 *   앞 필드에서 `"N/A"` 를 받아 **진짜 값이 있는 뒤 필드를 건너뛴다.**
 *
 *   라이브 실측 결과(표본 1,000): **온라인판매 리드의 31.7% 가 `address = "N/A"`** 였고
 *   그 전부가 `region = null` 이었다. 그런데 같은 행의 지번주소(`lctnAddr`)엔 실제 주소가 있었다 —
 *   **정보가 있는데 버린 것**이다. 게다가 카카오 전화 스윕은 `address != ''` 로 거르므로
 *   `"N/A"` 가 통과해 **존재하지 않는 주소로 조회**를 날렸다(실측 47건 시도 0건 발견).
 *
 *   ⇒ 판정은 한 곳에서. 새 공공데이터 레인은 필드 추출 시 이걸 통과시켜라.
 */
const NO_VALUE = new Set(['n/a', 'na', 'n.a.', '-', '--', '없음', '해당없음', '미상', '알수없음', 'null', 'undefined', '.'])

/** '값 없음'인가 — 공백/빈 문자열 + 포털이 쓰는 자리표시자 문자열. */
export function isNoValue(raw: unknown): boolean {
  const s = String(raw ?? '').trim().toLowerCase()
  return !s || NO_VALUE.has(s)
}

/** 200 이지만 본문이 에러인 경우(포털은 200 + 에러코드를 자주 준다). 에러면 설명, 아니면 null. */
export function describePublicDataBody(body: string): string | null {
  const code = findCode(body)
  return code ? `${code} — ${CODE_HINT[code]}` : null
}

// ── 🩹 하드 실패 백오프 (2026-07-29) ────────────────────────────────────────────────
//
//   실측: `franchise` 13회 · `nara` 10회 연속 **HTTP 404 "API not found"** — 저장 0. `work24` 는
//   "개인회원은 사용할 수 없는 OPEN-API입니다" 를 9회. 이것들은 **재시도로 낫는 실패가 아니다**
//   (엔드포인트가 틀렸거나 활용신청/회원등급이 필요하다 = 사람이 고쳐야 하는 것). 그런데 두 시간마다
//   같은 요청을 8페이지씩 다시 쐈다.
//
//   왜 이게 단순 낭비가 아닌가: 서브리퀘스트는 **인보케이션당 45~50 이 천장**이라는 게 같은 날 확정됐다.
//   고칠 수 없는 레인이 매 라운드 예산을 먼저 먹으면, 잘 도는 레인(수집·보강)이 그만큼 굶는다.
//   ⇒ 하드 실패는 **지수 백오프로 물러나되 주기적으로 한 번씩 찔러본다** — 대표가 활용신청을 마치면
//     코드 배포 없이 스스로 살아나야 하기 때문이다(영구 차단이면 그 자체가 또 다른 무증거 정지가 된다).

/**
 * 사람이 고쳐야 낫는 실패인가(재시도 무의미). 5xx·타임아웃·네트워크는 **아니다**(일시적일 수 있다).
 *
 *   ⚠️ 순서가 중요하다: 설정 오류 문구를 **먼저** 본다. data.go.kr 은 키 미등록 같은 설정 오류를
 *   **HTTP 5xx 로도** 내려주기 때문에, HTTP 코드로 먼저 갈라내면 그 경우를 '일시 장애'로 오분류해
 *   영원히 재시도하게 된다(지금 고치려는 바로 그 낭비).
 */
export function isHardConfigFailure(msg?: string | null): boolean {
  const m = String(msg || '')
  if (!m) return false
  if (/API not found|등록되지\s*않은|활용\s*신청|개인회원|사용할 수 없는|권한|DENIED|SERVICE[_ ]KEY|인증키|미등록|NOT[_ ]REGISTERED/i.test(m)) return true
  return /HTTP 4\d\d/i.test(m) // 4xx = 우리 요청이 틀렸다(경로·파라미터). 5xx·네트워크는 상대 사정이라 재시도.
}

/** 레인 건강 상태 — 각 레인의 stats 블롭에 함께 저장된다(추가 테이블 0). */
export interface LaneHealth { fail_streak?: number; first_failed_at?: string; next_probe_at?: number; last_error?: string }

/** 연속 실패 이 횟수까지는 평소대로 재시도(일시 장애를 성급히 백오프하지 않는다). */
export const HARD_FAIL_GRACE = 3
/** 백오프 상한 — 하루에 한 번은 반드시 찔러본다(대표가 고쳤는데 영영 안 도는 일이 없게). */
export const HARD_FAIL_MAX_BACKOFF_MS = 24 * 3_600_000

/** 이번 라운드를 건너뛸까. `next_probe_at` 이 미래면 skip — 그 외엔 항상 실행. */
export function laneShouldSkip(health: LaneHealth | null | undefined, nowMs: number): boolean {
  const at = Number(health?.next_probe_at)
  return Number.isFinite(at) && at > nowMs
}

/**
 * 실행 결과로 건강 상태를 갱신한다.
 * @param msg 실패 메시지(성공이면 null/undefined) — **성공하면 즉시 초기화**(자가 치유).
 */
export function updateLaneHealth(prev: LaneHealth | null | undefined, msg: string | null | undefined, nowMs: number): LaneHealth {
  if (!msg) return {} // 성공 — 스트릭·백오프 전부 해제
  const streak = Math.max(0, Number(prev?.fail_streak) || 0) + 1
  const out: LaneHealth = {
    fail_streak: streak,
    first_failed_at: prev?.first_failed_at || new Date(nowMs).toISOString().slice(0, 19).replace('T', ' '),
    last_error: String(msg).slice(0, 200),
  }
  if (isHardConfigFailure(msg) && streak > HARD_FAIL_GRACE) {
    // 2h → 4h → 8h … 24h 상한. 소프트 실패(5xx·네트워크)엔 백오프를 걸지 않는다.
    const step = Math.min(HARD_FAIL_MAX_BACKOFF_MS, 2 * 3_600_000 * 2 ** (streak - HARD_FAIL_GRACE - 1))
    out.next_probe_at = nowMs + step
  }
  return out
}

/** 상태줄 문구 — "왜 지금 안 도는가"를 대표가 읽을 수 있게(추측 대신 사실 + 다음 시도 시각). */
export function laneHealthNote(health: LaneHealth | null | undefined, nowMs: number): string | null {
  const streak = Number(health?.fail_streak) || 0
  if (streak <= 0) return null
  const skip = laneShouldSkip(health, nowMs)
  const mins = skip ? Math.ceil(((health?.next_probe_at as number) - nowMs) / 60_000) : 0
  return `${streak}회 연속 실패${health?.first_failed_at ? `(${health.first_failed_at}부터)` : ''}` +
    (skip ? ` — 재시도 대기 중(약 ${mins}분 후 재시도). 설정(엔드포인트·활용신청·회원등급) 확인 필요` : '')
}
