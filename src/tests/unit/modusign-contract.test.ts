import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendContractFromTemplate } from '../../worker/utils/modusign-gateway'
import { resetCircuit } from '../../worker/utils/circuit-breaker'

// 🖋️ 모두싸인 전자계약 게이트웨이 동작 검증 (네트워크 목).
describe('sendContractFromTemplate', () => {
  beforeEach(() => { resetCircuit('modusign') }) // 회로 격리(테스트 간 누적 실패 방지)
  afterEach(() => { vi.restoreAllMocks() })

  const baseInput = {
    title: '판매사 거래계약서 - 홍길동',
    participant: { name: '홍길동', value: '01012345678', method: 'KAKAO' as const },
    metadata: { account_type: 'distributor', account_id: 42 },
  }

  it('미설정(API key 없음)이면 발송 안 하고 skipped 반환 (가입 안 막음)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    const res = await sendContractFromTemplate({}, baseInput)
    expect(res).toEqual({ ok: false, skipped: true, reason: 'not_configured' })
    expect(spy).not.toHaveBeenCalled() // 네트워크 호출 0
  })

  it('templateId 없으면(env·input 둘 다) skipped', async () => {
    const res = await sendContractFromTemplate({ MODUSIGN_API_KEY: 'k' }, baseInput)
    expect(res).toMatchObject({ ok: false, skipped: true })
  })

  it('정상 발송 — 올바른 URL·Basic 인증·카카오 payload 전송 + documentId 파싱', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'doc_abc123' }), { status: 200 }),
    )
    const res = await sendContractFromTemplate(
      { MODUSIGN_API_KEY: 'mykey', MODUSIGN_TEMPLATE_ID: 'tmpl_1' },
      baseInput,
    )
    expect(res).toEqual({ ok: true, documentId: 'doc_abc123' })
    expect(spy).toHaveBeenCalledTimes(1)
    const [url, opts] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.modusign.co.kr/documents/request-with-template')
    expect(opts.method).toBe('POST')
    // Basic base64("mykey:")
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Basic ' + btoa('mykey:'))
    const body = JSON.parse(opts.body as string)
    expect(body.templateId).toBe('tmpl_1')
    expect(body.document.participantMappings[0]).toEqual({
      name: '홍길동',
      signingMethod: { type: 'KAKAO', value: '01012345678' },
    })
    // 멱등/역추적 metadata 전달
    expect(body.document.metadatas).toEqual(
      expect.arrayContaining([
        { key: 'account_type', value: 'distributor' },
        { key: 'account_id', value: '42' },
      ]),
    )
  })

  it('응답 documentId 후보키 방어 — { document: { id } } 도 파싱', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ document: { id: 'd_2' } }), { status: 200 }),
    )
    const res = await sendContractFromTemplate({ MODUSIGN_API_KEY: 'k', MODUSIGN_TEMPLATE_ID: 't' }, baseInput)
    expect(res).toEqual({ ok: true, documentId: 'd_2' })
  })

  it('input.templateId 가 env 보다 우선', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'x' }), { status: 200 }))
    await sendContractFromTemplate({ MODUSIGN_API_KEY: 'k', MODUSIGN_TEMPLATE_ID: 'env_tmpl' }, { ...baseInput, templateId: 'override_tmpl' })
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.templateId).toBe('override_tmpl')
  })

  it('4xx 응답이면 error 반환 (throw 안 함)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad', { status: 400 }))
    const res = await sendContractFromTemplate({ MODUSIGN_API_KEY: 'k', MODUSIGN_TEMPLATE_ID: 't' }, baseInput)
    expect(res.ok).toBe(false)
    if (!res.ok && !('skipped' in res && res.skipped)) {
      expect(res.error).toContain('400')
      expect(res.status).toBe(400)
    }
  })

  it('네트워크 실패도 throw 하지 않고 error 객체 반환 (가입 안 막음)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('DNS fail'))
    const res = await sendContractFromTemplate({ MODUSIGN_API_KEY: 'k', MODUSIGN_TEMPLATE_ID: 't' }, baseInput)
    expect(res.ok).toBe(false)
  })

  it('성공 응답에 documentId 없으면 error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
    const res = await sendContractFromTemplate({ MODUSIGN_API_KEY: 'k', MODUSIGN_TEMPLATE_ID: 't' }, baseInput)
    expect(res.ok).toBe(false)
  })
})
