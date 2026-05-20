/**
 * Unit Tests — parseJsonBody helper.
 *
 * Hono `c.req.json<T>()` 가 fail 시 throw → 호출처가 `.catch(() => ({}))` 하면
 * TS 가 `T | {}` 로 추론해 모든 필드 접근 시 TS2339. 본 헬퍼는 항상 `T` 로 단언.
 */

import { describe, it, expect } from 'vitest'
import { parseJsonBody } from '@/shared/utils/parse-json-body'

type SampleBody = {
  name?: string
  count?: number
  active?: boolean
}

const makeCtx = <T>(impl: () => Promise<T> | T) => ({
  req: { json: impl as <U>() => Promise<U> },
})

describe('parseJsonBody', () => {
  it('정상 JSON 반환', async () => {
    const body = await parseJsonBody<SampleBody>(
      makeCtx(async () => ({ name: 'hi', count: 3 })),
    )
    expect(body.name).toBe('hi')
    expect(body.count).toBe(3)
  })

  it('throw 시 빈 객체 (T) 반환', async () => {
    const body = await parseJsonBody<SampleBody>(
      makeCtx(async () => { throw new Error('parse error') }),
    )
    expect(body).toEqual({})
    // T 로 단언되므로 destructure 가능 — 컴파일 에러 없음을 검증.
    const { name, count, active } = body
    expect(name).toBeUndefined()
    expect(count).toBeUndefined()
    expect(active).toBeUndefined()
  })

  it('빈 본문 — 빈 객체 그대로', async () => {
    const body = await parseJsonBody<SampleBody>(makeCtx(async () => ({})))
    expect(body).toEqual({})
  })

  it('서버 측 동기 throw 도 catch', async () => {
    const body = await parseJsonBody<SampleBody>(
      makeCtx(() => { throw new Error('sync throw') }),
    )
    expect(body).toEqual({})
  })
})
