/**
 * 🩺 공공데이터 실패 진단 — **누가 고칠 문제인지**를 응답이 말하게 한다 (2026-07-28).
 *
 *   수집 레인 5개가 오래 0건인데 상태줄엔 `HTTP 404` 뿐이었다. data.go.kr 은 실패해도 본문에 원인
 *   코드를 담아 주는데 호출부가 **본문을 버렸다**. 그래서 "내가 URL 을 틀렸나 / 대표가 활용신청을
 *   안 했나" 를 구분 못 했다 — 조치 주체가 정반대인데도.
 *   ⚠️ 이 개발 환경은 `apis.data.go.kr` CONNECT 가 막혀 **직접 호출로 확인할 수 없다.** 라이브가 받은
 *   본문이 유일한 ground truth 이고, 이 매핑이 그걸 행동으로 옮긴다.
 */
import { describe, it, expect } from 'vitest'
import { describePublicDataFailure, describePublicDataBody, serviceKeyParam } from '@/features/marketing/api/public-data-diag'

const resp = (status: number, body: string) =>
  ({ status, text: async () => body }) as unknown as Response

describe('describePublicDataFailure — 원인별 조치 주체', () => {
  it('🔒 서비스명/오퍼레이션 오류는 **코드에서 고칠 것**으로 안내', async () => {
    const msg = await describePublicDataFailure(resp(404,
      '<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>NO_OPENAPI_SERVICE_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>'))
    expect(msg).toContain('NO_OPENAPI_SERVICE_ERROR')
    // ⚠️ 2026-08-03: 원래 `'코드에서 수정'` 리터럴이었다. 대조군 실측 후 문구가 바뀌면서 깨졌는데,
    //   **지켜야 할 것은 리터럴이 아니라 조치 주체**다 — "이건 우리가 고칠 일이고 대표 활용신청 건이 아니다".
    //   그래서 그 의미로 고쳐 잡는다(아래 미신청-키 시험과 짝: 그쪽은 '대표'가 나와야 한다).
    expect(msg, '우리 쪽 조치(엔드포인트 교체)라는 것이 드러나야 한다').toMatch(/엔드포인트|요청주소/)
    // ⚠️ 문구가 *"활용신청 문제는 아니다"* 라고 **명시적으로 부정**하게 됐다(2026-08-03). 그러니
    //   `활용신청` 단어 유무로 보면 안 되고, **대표에게 시키는 문구**(code 30 의 '활용신청 필요(대표)')가
    //   섞였는지로 봐야 한다 — 지켜야 할 것은 단어가 아니라 **조치 주체**다.
    expect(msg, '경로 오류를 대표 활용신청 건으로 오인시키면 안 된다').not.toMatch(/활용신청 필요/)
  })

  it('🔒 미신청 키는 **대표가 활용신청**으로 안내 (코드로는 못 고친다)', async () => {
    const msg = await describePublicDataFailure(resp(401, '{"returnAuthMsg":"SERVICE_KEY_IS_NOT_REGISTERED_ERROR"}'))
    expect(msg).toContain('활용신청')
    expect(msg).toContain('대표')
  })

  it('승인 대기·기간 만료·트래픽 초과를 각각 구분한다', async () => {
    expect(await describePublicDataFailure(resp(403, 'SERVICE_ACCESS_DENIED_ERROR'))).toContain('승인')
    expect(await describePublicDataFailure(resp(403, 'DEADLINE_HAS_EXPIRED_ERROR'))).toContain('만료')
    expect(await describePublicDataFailure(resp(429, 'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR'))).toContain('트래픽')
  })

  it('숫자 returnReasonCode 변종도 해석한다(포털이 형식을 섞어 준다)', async () => {
    expect(await describePublicDataFailure(resp(400, '<returnReasonCode>30</returnReasonCode>'))).toContain('활용신청')
    expect(await describePublicDataFailure(resp(400, '<returnReasonCode>31</returnReasonCode>'))).toContain('만료')
  })

  it('🔒 코드가 없어도 본문을 남긴다 — `HTTP 404` 만 남기던 것이 사고의 원인이었다', async () => {
    const msg = await describePublicDataFailure(resp(404, '<html><body>Not Found: bad path</body></html>'))
    expect(msg).toContain('404')
    expect(msg).toContain('Not Found: bad path')
  })

  it('본문이 비면 그 사실을 명시한다(빈 문자열로 뭉개지 않는다)', async () => {
    expect(await describePublicDataFailure(resp(502, ''))).toBe('HTTP 502 (본문 없음)')
  })

  it('네트워크 단계 실패는 호출부 메시지를 그대로 쓴다', async () => {
    expect(await describePublicDataFailure(null, '⛔ 요청한도 도달')).toBe('⛔ 요청한도 도달')
  })

  it('200 인데 본문이 에러인 경우도 잡는다(포털은 200+에러를 자주 준다)', () => {
    expect(describePublicDataBody('{"returnAuthMsg":"SERVICE_ACCESS_DENIED_ERROR"}')).toContain('승인')
    expect(describePublicDataBody('{"response":{"body":{"items":[]}}}')).toBeNull() // 정상 빈 결과는 에러 아님
  })
})

describe('serviceKeyParam — 인코딩/디코딩 키 어느 쪽이 와도 같은 결과', () => {
  // data.go.kr 은 같은 키를 두 벌로 준다. Cloudflare 시크릿은 **쓰기 전용**이라 어느 쪽이 들어있는지
  //   볼 수 없다 → 알아낼 필요가 없게 만든다. 이 동치가 그 계약이다.
  const DECODED = 'abc+de/fg=='            // 디코딩 키 형태
  const ENCODED = encodeURIComponent(DECODED) // 인코딩 키 형태(%2B %2F %3D)

  it('🔒 두 형태가 **같은 쿼리 파라미터**로 수렴한다(이중 인코딩 없음)', () => {
    expect(serviceKeyParam(DECODED)).toBe(serviceKeyParam(ENCODED))
  })

  it('결과는 한 번만 인코딩된 값 — 서버가 원문으로 되돌릴 수 있다', () => {
    expect(decodeURIComponent(serviceKeyParam(ENCODED))).toBe(DECODED)
    expect(decodeURIComponent(serviceKeyParam(DECODED))).toBe(DECODED)
  })

  it('멱등 — 이미 정규화된 값을 다시 넣어도 같다', () => {
    const once = serviceKeyParam(ENCODED)
    expect(serviceKeyParam(once)).toBe(once)
  })

  it('퍼센트가 깨져 있어도 던지지 않는다(원문 유지 → 최소한 예전 동작)', () => {
    expect(() => serviceKeyParam('bad%ZZkey')).not.toThrow()
    expect(serviceKeyParam('bad%ZZkey')).toBe(encodeURIComponent('bad%ZZkey'))
  })

  it('빈값은 빈 문자열', () => {
    expect(serviceKeyParam(undefined)).toBe('')
    expect(serviceKeyParam(null)).toBe('')
  })
})

/**
 * 🚫 **오추론 방지 — `NO_OPENAPI_SERVICE_ERROR` 를 "폐기 확정"으로 읽으면 안 된다** (2026-08-03 대조군 실측).
 *
 * ## 무엇이 있었나
 * 공정위 가맹 레인이 code 12 를 받는 것을 보고 나는 **"서비스 폐기 확정"** 이라고 인계 문서에 적었다(#985).
 * 근거는 *"같은 키로 같은 기관(1130000)의 commerce 는 200 이니 권한이 아니라 서비스가 없는 것"* 이었다.
 * 그 추론의 **앞부분은 맞고 뒷부분이 틀렸다** — 대조군을 찔러 보니:
 *
 * ```
 *   1130000/MllBs_2Service                      → code 12   ← 살아있는 서비스(200·264만건)의 base 만
 *   1130000/MllBs_2Service/getNoSuchOperation   → code 12   ← 살아있는 서비스 + 없는 오퍼레이션
 *   1130000/FftcBrandRlsInfo2_Service/getBrandList → code 12
 * ```
 *
 * **셋이 구분되지 않는다.** 이 코드는 "경로가 지금 안 맞는다"까지만 말하고, 그 이유가 폐기인지 오타인지는
 * **원리적으로 모른다.** 힌트 문구는 원래도 두 가능성을 다 적고 있었지만, 나열만 하면 읽는 사람이
 * **자기 가설에 맞는 쪽을 고른다** — 실제로 내가 그랬다.
 *
 * ## 이 시험이 지키는 것
 * 힌트가 **오추론을 명시적으로 막는 문장**을 갖고 있을 것. 두 단어를 나열하는 것으론 부족하다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * 사람이 힌트를 안 읽는 것. 그리고 다른 코드(30/31 등)의 문구 품질은 여기서 안 본다.
 */
describe('🚫 code 12 를 "폐기 확정"으로 좁히지 못하게 한다', () => {
  const hint = () => describePublicDataBody(JSON.stringify({
    OpenAPI_ServiceResponse: { cmmMsgHeader: { errMsg: 'NO_OPENAPI_SERVICE_ERROR', returnReasonCode: '12' } },
  })) || ''

  it('🔒 code 12 를 힌트로 번역한다(번역 자체가 없으면 나머지가 무의미)', () => {
    expect(hint()).toContain('NO_OPENAPI_SERVICE_ERROR')
  })

  it('🔒 **구분할 수 없다는 사실**이 문구에 있다 — 두 가능성 나열만으로는 부족하다', () => {
    const h = hint()
    expect(h, '"구분되지 않는다"는 경고가 없으면 읽는 사람이 자기 가설로 좁힌다(실제로 그랬다)').toMatch(/구분할 수 없|구분되지 않/)
    expect(h, '대조군 실측 근거가 같이 있어야 경고를 믿는다').toMatch(/살아있는 서비스도/)
  })

  it('🔒 다음 행동이 함께 있다 — 경고만 있고 할 일이 없으면 무시된다', () => {
    expect(hint(), '무엇과 대조해야 하는지가 있어야 다음 세션이 움직인다').toMatch(/미리보기|요청주소/)
  })

  /**
   * 🔑 **2026-08-03 대조군으로 하나 더 좁혔다** — 이 코드는 "활용신청 안 됨"과도 헷갈리기 쉬운데,
   *   게이트웨이는 그 둘을 **구분해서** 답한다:
   *   ```
   *     1741000/StanReginCd/getStanReginCdList  → HTTP 403 · code 30  (미신청)
   *     1741000/general_restaurants/*           → HTTP 400 · code 12  (주소 없음)
   *   ```
   *   즉 code 12 를 보고 *"대표가 활용신청을 안 했나"* 로 갈 필요가 없다 — 그건 30 으로 온다.
   *   ⚠️ 이걸 안 적어 두면 다음 세션이 **대표에게 헛일을 시킨다**(신청 확인 왕복).
   */
  it('🔒 code 12 를 "활용신청 문제"로 오인하지 않게 한다 — 그건 code 30 으로 온다', () => {
    const h = hint()
    expect(h, '미신청은 30 이라는 사실이 문구에 있어야 헛된 신청 확인 왕복이 안 생긴다').toMatch(/code 30/)
    expect(h).toMatch(/활용신청 문제는 아니다/)
  })
})
