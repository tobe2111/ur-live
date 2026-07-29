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
import { describePublicDataFailure, describePublicDataBody } from '@/features/marketing/api/public-data-diag'

const resp = (status: number, body: string) =>
  ({ status, text: async () => body }) as unknown as Response

describe('describePublicDataFailure — 원인별 조치 주체', () => {
  it('🔒 서비스명/오퍼레이션 오류는 **코드에서 고칠 것**으로 안내', async () => {
    const msg = await describePublicDataFailure(resp(404,
      '<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>NO_OPENAPI_SERVICE_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>'))
    expect(msg).toContain('NO_OPENAPI_SERVICE_ERROR')
    expect(msg).toContain('코드에서 수정')
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
