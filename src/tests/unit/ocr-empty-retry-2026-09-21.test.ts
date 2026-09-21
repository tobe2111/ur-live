/**
 * 🔁 OCR 빈 응답 1회 재시도 — `worker/utils/ocr-license.ts` (2026-09-21).
 *
 * S-OCR 라이브 실측(합성 등록증, 세 번째 사진): 같은 이미지에 5회 호출해 **2회가 완전한 빈 응답**이었다.
 * 예외도 산문도 아닌 빈 문자열이라 `unreadable` 로 끝났고, 어드민은 같은 버튼을 다시 눌러야 했다.
 *
 * 이 시험이 **못 막는** 것: 두 번 다 비는 경우(그때는 정직하게 unreadable), 모델이 글자를 틀리게 읽는 것.
 */
import { describe, it, expect } from 'vitest'
import { ocrDocument, OCR_EMPTY_RETRIES } from '@/worker/utils/ocr-license'

const JSON_OK = '{"biz_name":"[테스트] 클로드분식","address":"전북특별자치도 전주시 덕진구 가리내10길 10","owner_name":"김테스트","biz_number":"999-99-99991","permit_date":"2024-03-02"}'

function fakeAi(responses: Array<string | Error>) {
  const calls: number[] = []
  return {
    calls,
    ai: {
      run: async () => {
        calls.push(1)
        const next = responses.shift()
        if (next instanceof Error) throw next
        return { response: next ?? '' }
      },
    } as unknown as Parameters<typeof ocrDocument>[0],
  }
}

describe('ocrDocument — 빈 응답 재시도', () => {
  it('첫 응답이 비면 한 번 더 묻고, 두 번째 답으로 읽는다', async () => {
    const f = fakeAi(['', JSON_OK])
    const r = await ocrDocument(f.ai, new Uint8Array([1, 2, 3]), 'business_registration')
    expect(f.calls.length).toBe(2)
    expect(r.ok).toBe(true)
    expect(r.bizName).toBe('[테스트] 클로드분식')
    expect(r.fill).toBe(1)
  })

  it('정상 응답이면 한 번만 부른다 (재시도가 비용을 두 배로 만들지 않는다)', async () => {
    const f = fakeAi([JSON_OK, JSON_OK])
    await ocrDocument(f.ai, new Uint8Array([1]), 'business_registration')
    expect(f.calls.length).toBe(1)
  })

  it('두 번 다 비면 정직하게 unreadable — 시도 횟수를 말한다', async () => {
    const f = fakeAi(['', ''])
    const r = await ocrDocument(f.ai, new Uint8Array([1]), 'business_registration')
    expect(f.calls.length).toBe(OCR_EMPTY_RETRIES + 1)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('빈 응답')
    expect(r.message).toContain(`${OCR_EMPTY_RETRIES + 1}회`)
  })

  it('예외(쿼터·5016 라이선스)는 재시도하지 않는다 — 같은 답이 돌아오고 비용만 든다', async () => {
    const f = fakeAi([new Error('5016: agree first'), JSON_OK])
    const r = await ocrDocument(f.ai, new Uint8Array([1]), 'business_registration')
    expect(f.calls.length).toBe(1)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('읽기 실패')
  })

  it('🧵 JSON 을 문자열로 한 번 더 감싼 응답(이스케이프된 따옴표)도 읽는다 — 2026-09-21 실측 8회 중 1회', async () => {
    const wrapped = JSON.stringify('{\n    "biz_name": "[테스트] 클로드분식",\n    "address": "전북특별자치도 전주시 덕진구 가리내 10길 10",\n    "owner_name": "김테스트",\n    "biz_number": "999-99-99991",\n    "permit_date": "2024년 03월 02일"\n}')  // 라이브 raw 와 같은 모양(JSON.stringify 한 겹)
    const f = fakeAi([wrapped])
    const r = await ocrDocument(f.ai, new Uint8Array([1]), 'business_registration')
    expect(r.ok).toBe(true)
    expect(r.bizName).toBe('[테스트] 클로드분식')
    expect(r.bizNumber).toBe('9999999991')
    expect(r.fill).toBe(1)
  })

  it('🙅 JSON 없는 산문("정보가 없습니다") 도 빈 응답처럼 한 번 더 묻는다 — 2026-09-21 실측', async () => {
    const f = fakeAi(['현재 제공할 수 있는 정보는 없습니다.', JSON_OK])
    const r = await ocrDocument(f.ai, new Uint8Array([1]), 'business_registration')
    expect(f.calls.length).toBe(2)
    expect(r.ok).toBe(true)
    expect(r.bizName).toBe('[테스트] 클로드분식')
  })

  it('🔀 등록번호 칸에 개업일이 들어오면 제자리로 옮긴다 — 2026-09-21 실측 5회 중 2회', async () => {
    const f = fakeAi(['{"biz_name":"[테스트] 클로드분식","address":"전북특별자치도 전주시 덕진구 가리내10길 10","owner_name":"김테스트","biz_number":"2024년 03월 02일","permit_date":null}'])
    const r = await ocrDocument(f.ai, new Uint8Array([1]), 'business_registration')
    expect(r.bizNumber).toBeNull()
    expect(r.permitDate).toBe('20240302')
    // 진짜 등록번호는 그대로 — 휴리스틱이 정상 값을 건드리지 않는다
    const g = fakeAi([JSON_OK])
    const q = await ocrDocument(g.ai, new Uint8Array([1]), 'business_registration')
    expect(q.bizNumber).toBe('9999999991')
    expect(q.permitDate).toBe('20240302')
  })

  it('🪞 프롬프트 자리표시자를 베낀 값("상호(법인명)")은 읽은 것이 아니다 — 2026-09-21 실측', async () => {
    const f = fakeAi(['{"biz_name":"상호(법인명)","address":"전북특별자치도 전주시 덕진구 가리내10길 10","owner_name":"대표자 성명","biz_number":"999-99-99991","permit_date":"2024-03-02"}'])
    const r = await ocrDocument(f.ai, new Uint8Array([1]), 'business_registration')
    expect(r.bizName).toBeNull()
    expect(r.ownerName).toBeNull()
    expect(r.address).toBe('전북특별자치도 전주시 덕진구 가리내10길 10')
    expect(r.fill).toBe(0.5)
  })

  it('재시도 횟수는 1 — 더 올리면 뉴런 예산이 조용히 배로 나간다', () => {
    expect(OCR_EMPTY_RETRIES).toBe(1)
  })
})
