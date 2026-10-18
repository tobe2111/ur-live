/**
 * 🔢 이용권 코드 6자리 숫자 (2026-10-12 대표 *"6자리로 줄이고 숫자로만."*)
 *
 * 지키는 것:
 *   ① 겹치지 않는 번호만 발급한다 — DB 에 있는 번호는 다시 뽑고, 한 묶음 안에서도 겹치지 않는다
 *      (종전엔 "호출하는 쪽이 다시 시도한다" 고 적어 두고 그런 코드가 없었다 — 8자리에선 안 겹쳐서 몰랐다)
 *   ② 발급 경로 넷이 전부 그 함수를 쓴다(하나라도 옛 방식이면 결제 확정 뒤 저장이 실패할 수 있다)
 *   ③ 조회는 '없는 번호' 만 센다 — 요청 수를 세면 손님 QR 화면(5초 조회)이 깨진다
 *   ④ 사용은 같은 매장 확인코드로 틀린 시도를 센다 — 다른 매장 번호를 맞힌 것(403)도 센다
 *
 * ⚠️ 못 보는 것: 실제 대입 속도·한도가 적절한지(라이브 로그 `voucher_use_logs` 로 봐야 한다).
 */
import { describe, it, expect } from 'vitest'
import { generateUniqueVoucherCodes } from '@/features/group-buy/api/helpers'
import { readCode } from '../helpers/source-text'

function fakeDB(taken: Set<string>) {
  const asked: string[][] = []
  const DB = {
    prepare: (_sql: string) => ({
      bind: (...args: string[]) => ({
        all: async () => { asked.push(args); return { results: args.filter((a) => taken.has(a)).map((code) => ({ code })) } },
      }),
    }),
  }
  return { DB: DB as unknown as D1Database, asked }
}

describe('① 겹치지 않는 번호만', () => {
  it('묶음 n 개 — 전부 6자리 · 서로 다름', async () => {
    const { DB } = fakeDB(new Set())
    const codes = await generateUniqueVoucherCodes(DB, 50)
    expect(codes).toHaveLength(50)
    expect(new Set(codes).size).toBe(50)
    for (const c of codes) expect(c).toMatch(/^\d{6}$/)
  })

  it('DB 에 있는 번호는 버리고 다시 뽑는다', async () => {
    const taken = new Set<string>()
    let first = true
    const DB = {
      prepare: () => ({
        bind: (...args: string[]) => ({
          all: async () => {
            // 첫 조회에서는 받은 번호를 전부 '이미 있음' 으로 돌려준다
            if (first) { first = false; for (const a of args) taken.add(a); return { results: args.map((code) => ({ code })) } }
            return { results: args.filter((a) => taken.has(a)).map((code) => ({ code })) }
          },
        }),
      }),
    } as unknown as D1Database
    const codes = await generateUniqueVoucherCodes(DB, 3)
    expect(codes).toHaveLength(3)
    for (const c of codes) expect(taken.has(c)).toBe(false)
  })

  it('계속 다 차 있으면 조용히 겹친 번호를 내지 않고 예외', async () => {
    const DB = {
      prepare: () => ({ bind: (...args: string[]) => ({ all: async () => ({ results: args.map((code) => ({ code })) }) }) }),
    } as unknown as D1Database
    await expect(generateUniqueVoucherCodes(DB, 2)).rejects.toThrow(/exhausted/)
  })
})

describe('② 발급 경로가 전부 겹침 검사 함수를 쓴다', () => {
  it.each([
    ['src/features/group-buy/api/group-buy.routes.ts', 2],
    ['src/features/group-buy/api/cart-checkout.routes.ts', 1],
  ])('%s — 묶음 함수 %i곳', (f, n) => {
    const src = readCode(f)
    expect((src.match(/await generateUniqueVoucherCodes\(DB, /g) || []).length).toBe(n)
    expect(src).not.toMatch(/Array\.from\(\{ length: [^}]+\}, \(\) => generateUniqueVoucherCode\(DB\)\)/)
  })
  it('선물 받기(코드 재발급)·체험단도 DB 확인 함수', () => {
    expect(readCode('src/features/group-buy/api/voucher-gift.routes.ts')).toMatch(/const nextCode = await generateUniqueVoucherCode\(DB\)/)
    expect(readCode('src/features/group-buy/api/experience-campaign.routes.ts')).toMatch(/await generateUniqueVoucherCode\(DB\)/)
  })
  it('생성 함수를 직접 부르는 발급 경로가 없다', () => {
    for (const f of ['group-buy.routes', 'cart-checkout.routes', 'voucher-gift.routes', 'experience-campaign.routes'])
      expect(readCode(`src/features/group-buy/api/${f}.ts`)).not.toMatch(/\bgenerateVoucherCode\(\)/)
  })
})

describe('③ 조회는 없는 번호만 센다', () => {
  const src = readCode('src/features/group-buy/api/group-buy-public.routes.ts')
  const h = src.slice(src.indexOf("router.get('/verify/:code'"), src.indexOf("router.get('/verify/:code'") + 2500)
  it('잠금 확인이 DB 조회보다 먼저', () => {
    expect(h.indexOf('if (await lookupLocked(c, DB))')).toBeGreaterThan(-1)
    expect(h.indexOf('if (await lookupLocked(c, DB))')).toBeLessThan(h.indexOf('FROM vouchers v'))
  })
  it('없는 번호일 때만 센다', () => {
    expect(h).toMatch(/if \(!voucher\) \{\s*await recordLookupMiss\(c, DB\)/)
    expect((h.match(/recordLookupMiss\(/g) || []).length).toBe(1)
  })
  it('요청 수 미들웨어(rateLimit)를 이 주소에 걸지 않는다 — 손님 QR 화면이 5초마다 부른다', () => {
    expect(src).not.toMatch(/router\.get\(\s*'\/verify\/:code',\s*rateLimit/)
  })
})

describe('④ 사용은 같은 확인코드의 틀린 시도를 센다', () => {
  const src = readCode('src/features/group-buy/api/group-buy-voucher.routes.ts')
  const h = src.slice(src.indexOf("'/:code/use',"), src.indexOf("'/:code/use-by-seller'"))
  it('잠금 확인이 사용 처리보다 먼저', () => {
    const lock = h.indexOf('if (await codeGuard.useSecretLocked(DB, pin, guardSalt))')
    expect(lock).toBeGreaterThan(-1)
    expect(lock).toBeLessThan(h.indexOf('redeemByCounterSecret(DB, code, pin')) // 2026-10-18 형제 지점 인자가 붙어도 같은 호출
  })
  it('다른 매장 번호(403)와 없는 번호·틀린 비밀 모두 센다', () => {
    expect(h).toMatch(/if \(guard\) \{\s*await codeGuard\.recordUseFail\(DB, pin, guardSalt\)/)
    expect(h).toMatch(/failReason === 'not_found' \|\| failReason === 'pin_mismatch'\)\) \{\s*await codeGuard\.recordUseFail/)
  })
  it('확인코드는 원문이 아니라 해시로 센다', () => {
    const g = readCode('src/worker/utils/voucher-code-guard.ts')
    expect(g).toMatch(/const key = `secret:\$\{await hashSecret\(secret, salt\)\}`/)
    expect(g).not.toMatch(/`secret:\$\{secret\}`/)
  })
})
