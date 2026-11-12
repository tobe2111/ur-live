/**
 * 🔗 계정이 기억하는 마지막 소개 링크 — 다른 기기에서 산 결제도 소개 성과로 (2026-11-12 대표 *"모두 확인해봐 계속 진행"*)
 *
 * 지키는 것:
 *   ① 24시간 · 마지막 링크(더 늦은 시각만 덮어쓴다) · 자기 링크·미래 시각·깨진 값은 저장 안 함
 *   ② 결제 때 계정 기록이 있으면 그것이 이긴다(기기 무관 마지막 링크) — 없으면 종전 출처(본문→헤더→쿠키)
 *   ③ 결제 네 곳(딜 /join · 카드 /confirm-toss · 장바구니 시작·확정)이 모두 계정 기록을 본다
 *   ④ 손님 브라우저가 링크를 저장할 때 · 로그인했을 때 계정에 보낸다
 * ⚠️ 못 보는 것: 실결제(staging) · 로그인 없이 두 기기를 쓰는 손님(계정이 없어 이을 수 없다 — 설계상 한계)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import { recordAccountRef, readAccountRef, preferAccountRef, clampTouchAt } from '@/worker/utils/account-ref'

function makeD1() {
  const db = new DatabaseSync(':memory:')
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      first: async () => db.prepare(sql).get(...(args as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  return { prepare: (s: string) => wrap(s) } as unknown as D1Database
}
const H = 3600_000
const NOW = Date.parse('2026-11-12T03:00:00Z')

describe('① 저장 규칙', () => {
  it('마지막 링크가 이긴다 — 더 이른 시각은 덮어쓰지 못한다', async () => {
    const DB = makeD1()
    expect(await recordAccountRef(DB, '5', '700', NOW - 3 * H, NOW)).toBe(true)
    expect(await recordAccountRef(DB, '5', '800', NOW - 1 * H, NOW)).toBe(true)
    expect(await recordAccountRef(DB, '5', '900', NOW - 2 * H, NOW)).toBe(false) // 폰에서 더 일찍 눌렀던 것 — 늦은 PC 링크를 못 이긴다
    expect(await readAccountRef(DB, '5', NOW)).toBe('800')
  })
  it('24시간이 지나면 없다 · 자기 링크·깨진 값은 저장 안 함 · 미래 시각은 지금으로', async () => {
    const DB = makeD1()
    await recordAccountRef(DB, '5', '700', NOW - 2 * H, NOW)
    expect(await readAccountRef(DB, '5', NOW + 21 * H)).toBe('700') // 들어온 지 23시간
    expect(await readAccountRef(DB, '5', NOW + 23 * H)).toBe('') // 들어온 지 25시간
    expect(await recordAccountRef(DB, '5', '5', NOW, NOW)).toBe(false)
    expect(await recordAccountRef(DB, '5', 'seller:9', NOW, NOW)).toBe(false)
    expect(await recordAccountRef(DB, '6', '700', NOW - 25 * H, NOW)).toBe(false)
    expect(clampTouchAt(NOW + 10 * H, NOW)).toBe('2026-11-12 03:00:00')
  })
})

describe('② 결제 때', () => {
  it('계정 기록이 있으면 그것, 없으면 종전 출처', async () => {
    const DB = makeD1()
    expect(await preferAccountRef(DB, '5', '111')).toBe('111')
    await recordAccountRef(DB, '5', '700', Date.now() - H)
    expect(await preferAccountRef(DB, '5', '111')).toBe('700')
    expect(await preferAccountRef(DB, '5', '')).toBe('700')
    expect(await preferAccountRef(DB, null, '111')).toBe('111')
  })
})

describe('③④ 배선', () => {
  it('결제 네 곳이 계정 기록을 먼저 본다', () => {
    const gb = readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf8')
    expect(gb.match(/const refRaw = await preferAccountRef\(DB, userId, pickGbRefSource\(/g)?.length).toBe(2)
    const cart = readFileSync('src/features/group-buy/api/cart-checkout.routes.ts', 'utf8')
    expect(cart.match(/normalizeRef\(DB, await preferAccountRef\(DB, userId, pickGbRefSource\(/g)?.length).toBe(2)
  })
  it('브라우저가 링크를 저장할 때 · 로그인했을 때 계정에 보낸다 · 서버 입구는 로그인 필수', () => {
    const t = readFileSync('src/utils/affiliate-track.ts', 'utf8')
    expect(t).toMatch(/writeAffiliateRef\(ref\)[^\n]*\n\s*syncAccountRef\(\)/)
    expect(t).toMatch(/if \(!loggedIn\) return\n\s*syncAccountRef\(\)/)
    expect(t).toContain("api.post('/api/acquisition/ref-touch', { ref: cur.ref, at: cur.at })")
    expect(readFileSync('src/worker/routes/acquisition.routes.ts', 'utf8')).toMatch(/post\('\/ref-touch', rateLimit\([^)]*\), requireUser\(\)/)
  })
})
