/**
 * 🩺 **비-JSON 응답 진단** — 계약 (2026-07-29 라이브 실측 후 신설).
 *
 *   왜: 통신판매 레인이 멈췄는데 화면의 진단이 `"비JSON 응답"` **한 마디뿐**이었다.
 *   그 한 마디로는 ⓐ 일일 쿼터 초과 ⓑ 서비스키 미등록 ⓒ 요청 형태 문제가 **전혀 갈리지 않는다** —
 *   처방이 각각 다른데(기다린다 / 대표가 등록한다 / 코드를 고친다) 어느 것도 고를 수 없었다.
 *
 *   원인은 `raw.slice(160)` 을 **태그 제거보다 먼저** 한 것이다. data.go.kr 오류 XML 은 선언부와
 *   래퍼 태그만으로 그 길이를 넘겨서, 남는 텍스트가 반토막이 되거나 통째로 빈 문자열이 된다.
 *
 *   ⚠️ 이 시험이 못 막는 것: 실제 응답이 정말 빈 본문일 때는 여전히 원인을 못 알려준다
 *   (그래서 바이트 수를 남긴다 — '빈 응답'과 '태그만 있는 응답'은 처방이 다르다).
 */
import { describe, it, expect } from 'vitest'
import { describeNonJson } from '@/features/marketing/api/commerce-notify-collect'

const XML_ERR = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><OpenAPI_ServiceResponse>'
  + '<cmmMsgHeader><errMsg>SERVICE ERROR</errMsg>'
  + '<returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg>'
  + '<returnReasonCode>22</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>'

describe('describeNonJson', () => {
  it('🔒 오류 코드를 **끝까지** 보여준다 — 잘린 코드로는 원인을 못 고른다', () => {
    const out = describeNonJson(XML_ERR)
    expect(out).toContain('LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR') // 반토막이면 실패
    expect(out).toContain('22')
  })

  it('키 미등록도 그대로 — 처방이 다른 두 경우가 구분된다', () => {
    const out = describeNonJson(XML_ERR.replace('LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR', 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR'))
    expect(out).toContain('SERVICE_KEY_IS_NOT_REGISTERED_ERROR')
  })

  it('긴 태그 선언이 앞을 채워도 텍스트를 잃지 않는다(자르기는 태그 제거 **뒤**에)', () => {
    const padded = `<root ${'x'.repeat(300)}="1"><msg>QUOTA_EXCEEDED</msg></root>`
    expect(describeNonJson(padded)).toBe('QUOTA_EXCEEDED')
  })

  it('본문이 비면 바이트 수를 남긴다 — "빈 응답"과 "태그만 있는 응답"은 처방이 다르다', () => {
    expect(describeNonJson('')).toBe('비JSON 응답(본문 0B)')
    expect(describeNonJson('<a></a>')).toBe('비JSON 응답(본문 7B)')
  })

  it('🔐 본문에 서비스키가 echo 돼도 가린다 — 이 문자열은 어드민 화면·인계로 흘러간다', () => {
    const out = describeNonJson('<msg>bad request: /api?serviceKey=SECRETKEYVALUE123&pageNo=1</msg>')
    expect(out).not.toContain('SECRETKEYVALUE123')
    expect(out).toContain('serviceKey=***')
  })

  it('길면 자르되 기본 200자까지는 남긴다', () => {
    expect(describeNonJson(`<m>${'가'.repeat(500)}</m>`)).toHaveLength(200)
  })
})
