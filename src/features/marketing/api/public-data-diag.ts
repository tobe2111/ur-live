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
  NO_OPENAPI_SERVICE_ERROR: '서비스 URL/오퍼레이션명이 틀렸거나 폐기됨 → 코드에서 수정(엔드포인트 env 로 무배포 교체 가능)',
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

/** 200 이지만 본문이 에러인 경우(포털은 200 + 에러코드를 자주 준다). 에러면 설명, 아니면 null. */
export function describePublicDataBody(body: string): string | null {
  const code = findCode(body)
  return code ? `${code} — ${CODE_HINT[code]}` : null
}
