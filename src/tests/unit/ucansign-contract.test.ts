import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendContractFromTemplate, _resetTokenCache } from '../../worker/utils/ucansign-gateway'
import { resetCircuit } from '../../worker/utils/circuit-breaker'

// 🖋️ 유캔싸인 전자계약 게이트웨이 동작 검증 (2단계 토큰 + 템플릿 발송, 네트워크 목).
describe('ucansign sendContractFromTemplate', () => {
  beforeEach(() => { resetCircuit('ucansign'); _resetTokenCache() })
  afterEach(() => { vi.restoreAllMocks() })

  const input = {
    documentName: '유통스타트 판매사 거래계약서 - (주)홍길동상사',
    participant: { name: '홍길동', value: '010-1234-5678', method: 'kakao' as const },
    customValues: { customValue1: 'distributor', customValue2: '42', customValue3: 'distributor_agreement' },
  }

  function mockTwoStep(documentId: unknown = 'doc_9', tokenResp?: object, sendResp?: object) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.endsWith('/openapi/user/token')) {
        return new Response(JSON.stringify(tokenResp ?? { code: 0, result: { accessToken: 'tok_abc' } }), { status: 200 })
      }
      if (u.includes('/openapi/templates/')) {
        return new Response(JSON.stringify(sendResp ?? { code: 0, result: { documentId } }), { status: 200 })
      }
      return new Response('{}', { status: 404 })
    })
  }

  it('미설정(API key 없음)이면 발송 안 하고 skipped (가입 안 막음)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const res = await sendContractFromTemplate({}, input)
    expect(res).toEqual({ ok: false, skipped: true, reason: 'not_configured' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('templateId 없으면 skipped', async () => {
    const res = await sendContractFromTemplate({ UCANSIGN_API_KEY: 'k' }, input)
    expect(res).toMatchObject({ ok: false, skipped: true })
  })

  it('정상 발송 — 토큰 발급 → Bearer 로 템플릿 발송 → documentId 반환', async () => {
    const spy = mockTwoStep('doc_9')
    const res = await sendContractFromTemplate({ UCANSIGN_API_KEY: 'mykey', UCANSIGN_TEMPLATE_ID: 'tmpl_1' }, input)
    expect(res).toEqual({ ok: true, documentId: 'doc_9' })

    // 1) 토큰 요청 — apiKey 전달
    const tokenCall = spy.mock.calls.find((c) => String(c[0]).endsWith('/openapi/user/token'))!
    expect(tokenCall).toBeTruthy()
    expect(JSON.parse((tokenCall[1] as RequestInit).body as string)).toEqual({ apiKey: 'mykey' })

    // 2) 템플릿 발송 — URL 에 templateId, Bearer 토큰, 카카오 payload(휴대폰 하이픈 제거), customValue
    const sendCall = spy.mock.calls.find((c) => String(c[0]).includes('/openapi/templates/'))!
    expect(String(sendCall[0])).toBe('https://app.ucansign.com/openapi/templates/tmpl_1')
    const opts = sendCall[1] as RequestInit
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer tok_abc')
    const body = JSON.parse(opts.body as string)
    expect(body.documentName).toContain('판매사 거래계약서')
    expect(body.participants[0]).toEqual({
      name: '홍길동',
      signingMethodType: 'kakao',
      signingContactInfo: '01012345678', // 하이픈 제거
      signingOrder: 1,
    })
    expect(body.customValue1).toBe('distributor')
    expect(body.customValue2).toBe('42')
    expect(body.customValue3).toBe('distributor_agreement')
  })

  it('숫자형 documentId 도 문자열로 정규화', async () => {
    mockTwoStep(123456)
    const res = await sendContractFromTemplate({ UCANSIGN_API_KEY: 'k', UCANSIGN_TEMPLATE_ID: 't' }, input)
    expect(res).toEqual({ ok: true, documentId: '123456' })
  })

  it('test 모드(UCANSIGN_TEST_MODE)면 x-ucansign-test 헤더 추가', async () => {
    const spy = mockTwoStep('d')
    await sendContractFromTemplate({ UCANSIGN_API_KEY: 'k', UCANSIGN_TEMPLATE_ID: 't', UCANSIGN_TEST_MODE: 'true' }, input)
    const sendCall = spy.mock.calls.find((c) => String(c[0]).includes('/openapi/templates/'))!
    expect((sendCall[1] as RequestInit).headers as Record<string, string>).toMatchObject({ 'x-ucansign-test': 'true' })
  })

  it('email 방식이면 연락처를 하이픈 제거 없이 그대로 전송', async () => {
    const spy = mockTwoStep('d')
    await sendContractFromTemplate(
      { UCANSIGN_API_KEY: 'k', UCANSIGN_TEMPLATE_ID: 't' },
      { documentName: 'x', participant: { name: 'A', value: 'a@b.com', method: 'email' } },
    )
    const body = JSON.parse((spy.mock.calls.find((c) => String(c[0]).includes('/templates/'))![1] as RequestInit).body as string)
    expect(body.participants[0].signingMethodType).toBe('email')
    expect(body.participants[0].signingContactInfo).toBe('a@b.com')
  })

  it('토큰 발급 실패(code!=0)면 error (throw 안 함)', async () => {
    mockTwoStep('d', { code: 11007, msg: '유효하지 않은 API KEY' })
    const res = await sendContractFromTemplate({ UCANSIGN_API_KEY: 'bad', UCANSIGN_TEMPLATE_ID: 't' }, input)
    expect(res.ok).toBe(false)
  })

  it('발송 실패(code!=0, 예: 포인트 부족)면 code 포함 error', async () => {
    mockTwoStep('d', undefined, { code: 1039, msg: '포인트가 부족합니다' })
    const res = await sendContractFromTemplate({ UCANSIGN_API_KEY: 'k', UCANSIGN_TEMPLATE_ID: 't' }, input)
    expect(res.ok).toBe(false)
    if (!res.ok && !('skipped' in res && res.skipped)) expect(res.code).toBe(1039)
  })

  it('네트워크 실패도 throw 하지 않고 error 반환', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('DNS fail'))
    const res = await sendContractFromTemplate({ UCANSIGN_API_KEY: 'k', UCANSIGN_TEMPLATE_ID: 't' }, input)
    expect(res.ok).toBe(false)
  })
})
