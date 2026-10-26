/**
 * 🔁 zod 3 → 4 이행 가드 (2026-10-24 · GHSA-mrhx-c7xc-m3w5 해소, 대표 "가장 이상적이라면 진행해줘").
 *
 * zod 4 에서 사라진 것 둘이 우리 코드에 있었다:
 *   ① `z.record(값)` 한 인자 형태 — tsc 가 잡았다(order.routes).
 *   ② `ZodError.errors` — **`as any` 뒤에 숨어 tsc 가 못 봤고 런타임에 TypeError** 가 났을 자리다(validation-schemas).
 * ⇒ ②처럼 타입이 가려진 자리는 문자열로 막는다. 결제 확인(잠금 파일)은 코드 무변경이고, 그 스키마가
 *    zod 4 에서도 같은 판정을 내는지를 **실제로 돌려서** 확인한다.
 * ⚠️ 못 보는 것: 화면이 zod 기본 오류 문구를 그대로 띄우는 자리(문구가 영어로 조금 달라졌다).
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { readCode } from '../helpers/source-text'

const ZOD_FILES = [
  'src/shared/config/env-validator.ts',
  'src/shared/config/env-schema.ts',
  'src/worker/routes/auth.routes.ts',
  'src/worker/routes/order.routes.ts',
  'src/worker/routes/payment.routes.ts',
  'src/lib/validation-schemas.ts',
]

describe('zod 4 이행', () => {
  it('설치된 zod 가 4 다', async () => {
    const pkg = await import('zod/package.json')
    expect(Number(String((pkg as any).version ?? (pkg as any).default?.version).split('.')[0])).toBeGreaterThanOrEqual(4)
  })
  it('ZodError.errors 를 읽는 자리가 없다(zod 4 에서 제거 — 폴백 없이 읽으면 TypeError)', () => {
    for (const f of ZOD_FILES) {
      const src = readCode(f)
      expect(src, f).not.toMatch(/\.error\s*as\s*any\)\.errors\.map/)
      expect(src, f).not.toMatch(/error\.errors\.map/)
    }
  })
  it('z.record 는 키·값 두 인자로만 쓴다', () => {
    for (const f of ZOD_FILES) expect(readCode(f), f).not.toMatch(/z\.record\(z\.\w+\(\)\)/)
  })
  it('결제 확인 스키마(잠금 파일과 같은 규칙)가 zod 4 에서도 같은 판정을 낸다', () => {
    const src = readCode('src/worker/routes/payment.routes.ts')
    expect(src).toContain("orderId: z.string().min(6).max(64).regex(/^[a-zA-Z0-9\\-_]+$/, 'Invalid orderId format')")
    expect(src).toContain('amount: z.number().int().positive()')
    const s = z.object({
      paymentKey: z.string().min(1),
      orderId: z.string().min(6).max(64).regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid orderId format'),
      amount: z.number().int().positive(),
    })
    expect(s.safeParse({ paymentKey: 'pk', orderId: 'GB-3-178896', amount: 31000 }).success).toBe(true)
    for (const bad of [{ amount: 0 }, { amount: -1 }, { amount: 1.5 }, { orderId: 'a<b>cd' }, { orderId: 'abc' }, { paymentKey: '' }]) {
      const r = s.safeParse({ paymentKey: 'pk', orderId: 'GB-3-178896', amount: 31000, ...bad })
      expect(r.success, JSON.stringify(bad)).toBe(false)
      if (!r.success) expect(typeof r.error.flatten).toBe('function')
    }
  })
})
