import { describe, it, expect } from 'vitest'
import {
  DEFAULT_MALL_ID,
  normHost,
  loadMallByHost,
  loadMallBySlug,
  mallIdByHost,
  resolveMallId,
  registrationMallId,
  invalidateMallCache,
  type WholesaleMall,
} from '@/features/supply/api/wholesale-malls'

/**
 * 🏬 2026-06-09 도매몰 멀티-몰 테넌시 리졸버 — INVARIANT 고정.
 *
 * 핵심 불변식:
 *   1. 기본 몰(id=1) 단일 호스트 환경 → 모든 resolver 가 1 반환 (byte-identical).
 *   2. normHost — www./포트/대소문자 정규화 → lookup 정확.
 *   3. resolveMallId 우선순위(2026-06-18 host-first): ?mall=slug > host > fallback-1.
 *      → "몰 = 도메인" — 게스트/로그인 무관하게 도메인이 몰 결정(account-first flip-flop 제거).
 *   4. 알 수 없는 호스트 → fallback DEFAULT_MALL_ID(1).
 *   5. registrationMallId — 계정 토큰 무시, ?mall=slug > host > 1.
 *
 * stateful mock D1: 행별 wholesale_malls 조회 + sellers/suppliers mall_id 행 반환.
 * JWT mock: hono/jwt.verify 는 vi.mock 으로 교체(실제 서명 X).
 */

// ── Mock D1 factory ────────────────────────────────────────────────────────────
type MallRow = Omit<WholesaleMall, 'brand_name' | 'brand_color' | 'logo_url' | 'deposit_account' | 'commission_rate' | 'categories_json'> & {
  brand_name?: string | null
  brand_color?: string | null
  logo_url?: string | null
  deposit_account?: string | null
  commission_rate?: number | null
  categories_json?: string | null
}

function makeDB(malls: MallRow[], accountMallId?: { kind: 'seller' | 'supplier'; mallId: number }) {
  const db = {
    prepare(sql: string) {
      const make = (args: unknown[]) => ({
        run: async () => ({ meta: { changes: 1 } }),
        first: async <T = unknown>(): Promise<T | null> => {
          // sellers.mall_id or suppliers.mall_id lookup
          if (sql.includes('FROM sellers WHERE id') && accountMallId?.kind === 'seller') {
            return { mall_id: accountMallId.mallId } as T
          }
          if (sql.includes('FROM suppliers WHERE id') && accountMallId?.kind === 'supplier') {
            return { mall_id: accountMallId.mallId } as T
          }
          // wholesale_malls LIMIT 1 — existence check for ensureMallSchema seed guard
          if (sql.includes('SELECT id FROM wholesale_malls LIMIT 1')) {
            return (malls.length > 0 ? { id: malls[0].id } : null) as T
          }
          return null as T
        },
        all: async <T = unknown>(): Promise<{ results: T[] }> => {
          if (sql.includes('FROM wholesale_malls')) {
            // Map stored MallRow to full WholesaleMall shape
            return { results: malls.map((m) => ({
              id: m.id,
              slug: m.slug,
              name: m.name,
              host: m.host ?? null,
              brand_name: m.brand_name ?? null,
              brand_color: m.brand_color ?? null,
              logo_url: m.logo_url ?? null,
              deposit_account: m.deposit_account ?? null,
              commission_rate: m.commission_rate ?? null,
              categories_json: m.categories_json ?? null,
              active: m.active,
              created_at: m.created_at ?? null,
            })) as T[] }
          }
          return { results: [] }
        },
      })
      return { ...make([]), bind: (...args: unknown[]) => make(args) }
    },
  }
  // Invalidate the per-isolate WeakMap cache so each test starts fresh
  invalidateMallCache(db as never)
  return db as never
}

// Default mall row (id=1, slug='default', host='utongstart.com')
const defaultMall: MallRow = {
  id: 1, slug: 'default', name: '유통스타트', host: 'utongstart.com', active: 1,
}

// ── normHost — pure, no DB ────────────────────────────────────────────────────
describe('normHost — 호스트 정규화', () => {
  it('www. 제거', () => {
    expect(normHost('www.utongstart.com')).toBe('utongstart.com')
  })

  it('대문자 → 소문자', () => {
    expect(normHost('UTongStart.COM')).toBe('utongstart.com')
  })

  it('포트 제거', () => {
    expect(normHost('utongstart.com:3000')).toBe('utongstart.com')
  })

  it('www. + 포트 동시', () => {
    expect(normHost('www.Foo.COM:8080')).toBe('foo.com')
  })

  it('null/undefined/빈문자 → 빈문자', () => {
    expect(normHost(null)).toBe('')
    expect(normHost(undefined)).toBe('')
    expect(normHost('')).toBe('')
  })
})

// ── DEFAULT_MALL_ID 상수 ───────────────────────────────────────────────────────
describe('DEFAULT_MALL_ID', () => {
  it('항상 1 (기본 몰)', () => {
    expect(DEFAULT_MALL_ID).toBe(1)
  })
})

// ── loadMallByHost ─────────────────────────────────────────────────────────────
describe('loadMallByHost — host → 몰 (fallback 1)', () => {
  it('알려진 호스트 → 해당 몰 반환', async () => {
    const db = makeDB([defaultMall])
    const m = await loadMallByHost(db, 'utongstart.com')
    expect(m?.id).toBe(1)
    expect(m?.slug).toBe('default')
  })

  it('www. prefix 있는 호스트도 정규화 후 매칭', async () => {
    const db = makeDB([defaultMall])
    const m = await loadMallByHost(db, 'www.utongstart.com')
    expect(m?.id).toBe(1)
  })

  it('대소문자 무시 매칭', async () => {
    const db = makeDB([defaultMall])
    const m = await loadMallByHost(db, 'UTongStart.COM')
    expect(m?.id).toBe(1)
  })

  it('알 수 없는 호스트 → fallback id=1 (DEFAULT_MALL_ID)', async () => {
    const db = makeDB([defaultMall])
    const m = await loadMallByHost(db, 'unknown-host.example.com')
    expect(m?.id).toBe(DEFAULT_MALL_ID)
  })

  it('null/undefined 호스트 → fallback 1', async () => {
    const db = makeDB([defaultMall])
    expect((await loadMallByHost(db, null))?.id).toBe(1)
    expect((await loadMallByHost(db, undefined))?.id).toBe(1)
  })

  it('다중 몰 환경: 두 번째 몰 호스트 → 두 번째 몰', async () => {
    const foodMall: MallRow = { id: 2, slug: 'food', name: '식품몰', host: 'food.utongstart.com', active: 1 }
    const db = makeDB([defaultMall, foodMall])
    const m = await loadMallByHost(db, 'food.utongstart.com')
    expect(m?.id).toBe(2)
    expect(m?.slug).toBe('food')
  })

  it('쉼표 구분 다중 호스트 — 각각 매칭', async () => {
    const multiHost: MallRow = { id: 3, slug: 'multi', name: '멀티', host: 'a.example.com,b.example.com', active: 1 }
    const db = makeDB([defaultMall, multiHost])
    expect((await loadMallByHost(db, 'a.example.com'))?.id).toBe(3)
    expect((await loadMallByHost(db, 'b.example.com'))?.id).toBe(3)
  })

  it('active=0 인 몰은 host lookup 에서 제외 (inactive 몰)', async () => {
    const inactiveMall: MallRow = { id: 4, slug: 'inactive', name: '비활성', host: 'inactive.example.com', active: 0 }
    const db = makeDB([defaultMall, inactiveMall])
    // inactive 몰 호스트로 요청 → 기본 몰(1)로 fallback
    const m = await loadMallByHost(db, 'inactive.example.com')
    expect(m?.id).toBe(DEFAULT_MALL_ID)
  })
})

// ── mallIdByHost ───────────────────────────────────────────────────────────────
describe('mallIdByHost — host → mall_id (fallback 1)', () => {
  it('기본 몰 호스트 → 1', async () => {
    const db = makeDB([defaultMall])
    expect(await mallIdByHost(db, 'utongstart.com')).toBe(1)
  })

  it('알 수 없는 호스트 → 1', async () => {
    const db = makeDB([defaultMall])
    expect(await mallIdByHost(db, 'nope.com')).toBe(1)
  })

  it('빈 몰 테이블(seed 없음) → DEFAULT_MALL_ID(1)', async () => {
    // 몰 행 없으면 byId.get(1) = undefined → m?.id undefined → DEFAULT_MALL_ID(1)
    const db = makeDB([])
    expect(await mallIdByHost(db, 'anything.com')).toBe(DEFAULT_MALL_ID)
  })
})

// ── loadMallBySlug ─────────────────────────────────────────────────────────────
describe('loadMallBySlug', () => {
  it('존재하는 slug → 해당 몰', async () => {
    const db = makeDB([defaultMall])
    const m = await loadMallBySlug(db, 'default')
    expect(m?.id).toBe(1)
  })

  it('존재하지 않는 slug → null', async () => {
    const db = makeDB([defaultMall])
    expect(await loadMallBySlug(db, 'nonexistent')).toBeNull()
  })
})

// ── resolveMallId 우선순위 ─────────────────────────────────────────────────────
// resolveMallId 는 context(DB + req.url/header/query) 를 받음.
// 2026-06-18 host-first 전환 이후 Authorization 토큰은 더 이상 mall 결정에 쓰이지 않음
// (도메인이 몰을 결정). 따라서 토큰이 있어도 host 가 우선임을 검증 — JWT mock 불필요.

function makeCtx(opts: {
  db: D1Database
  url?: string
  hostHeader?: string
  mallQuery?: string
  authHeader?: string
}): Parameters<typeof resolveMallId>[0] {
  return {
    env: { DB: opts.db, JWT_SECRET: 'test-secret' },
    req: {
      url: opts.url ?? 'http://utongstart.com/api/wholesale/products',
      header: (k: string) => {
        if (k === 'Authorization') return opts.authHeader
        if (k === 'Host') return opts.hostHeader
        return undefined
      },
      query: (k: string) => {
        if (k === 'mall') return opts.mallQuery
        return undefined
      },
    },
  }
}

describe('resolveMallId — 우선순위 + fallback', () => {
  it('토큰 없음 + ?mall 없음 + 기본몰 호스트 → 1', async () => {
    const db = makeDB([defaultMall])
    const id = await resolveMallId(makeCtx({ db, url: 'http://utongstart.com/' }))
    expect(id).toBe(1)
  })

  it('토큰 없음 + ?mall=default → slug 로 1 반환', async () => {
    const db = makeDB([defaultMall])
    const id = await resolveMallId(makeCtx({ db, url: 'http://localhost/', mallQuery: 'default' }))
    expect(id).toBe(1)
  })

  it('?mall=food → 두 번째 몰 id=2', async () => {
    const foodMall: MallRow = { id: 2, slug: 'food', name: '식품몰', host: 'food.utongstart.com', active: 1 }
    const db = makeDB([defaultMall, foodMall])
    const id = await resolveMallId(makeCtx({ db, url: 'http://localhost/', mallQuery: 'food' }))
    expect(id).toBe(2)
  })

  it('?mall 없음 + 두 번째 몰 호스트 → 2 (host 기반 해석)', async () => {
    const foodMall: MallRow = { id: 2, slug: 'food', name: '식품몰', host: 'food.utongstart.com', active: 1 }
    const db = makeDB([defaultMall, foodMall])
    const id = await resolveMallId(makeCtx({ db, url: 'http://food.utongstart.com/' }))
    expect(id).toBe(2)
  })

  it('알 수 없는 호스트 + mall 없음 → fallback 1', async () => {
    const db = makeDB([defaultMall])
    const id = await resolveMallId(makeCtx({ db, url: 'http://unknown.example.com/' }))
    expect(id).toBe(1)
  })

  it('?mall=nonexistent (slug 없음) → host fallback(utongstart.com → 1)', async () => {
    const db = makeDB([defaultMall])
    const id = await resolveMallId(makeCtx({ db, url: 'http://utongstart.com/', mallQuery: 'nonexistent' }))
    expect(id).toBe(1)
  })

  it('URL parse 실패 시 Host 헤더로 fallback', async () => {
    const db = makeDB([defaultMall])
    const id = await resolveMallId(makeCtx({ db, url: 'not-a-valid-url', hostHeader: 'utongstart.com' }))
    expect(id).toBe(1)
  })

  // ── 🏬 2026-06-18 host-first ("몰=도메인=계정") — flip-flop 방지 계약 ──
  it('host-first: 계정 토큰(다른 몰 소속)이 있어도 host 가 우선', async () => {
    const foodMall: MallRow = { id: 2, slug: 'food', name: '식품몰', host: 'food.utongstart.com', active: 1 }
    // 계정은 mall 2(식품) 소속이지만 기본몰 호스트로 요청 → host 우선 → 1 (계정 무시).
    const db = makeDB([defaultMall, foodMall], { kind: 'seller', mallId: 2 })
    const id = await resolveMallId(makeCtx({ db, url: 'http://utongstart.com/', authHeader: 'Bearer dummy' }))
    expect(id).toBe(1)
  })

  it('host-first: 같은 호스트면 게스트와 로그인(계정 다른 몰)이 동일 몰 — 일관성', async () => {
    const foodMall: MallRow = { id: 2, slug: 'food', name: '식품몰', host: 'food.utongstart.com', active: 1 }
    const guest = await resolveMallId(makeCtx({
      db: makeDB([defaultMall, foodMall]),
      url: 'http://food.utongstart.com/',
    }))
    const loggedIn = await resolveMallId(makeCtx({
      db: makeDB([defaultMall, foodMall], { kind: 'seller', mallId: 1 }),
      url: 'http://food.utongstart.com/',
      authHeader: 'Bearer dummy',
    }))
    expect(guest).toBe(2)
    expect(loggedIn).toBe(2) // 계정 몰(1) 무시, host(food→2) 우선 → 게스트와 동일
  })

  it('host-first: supplier 토큰(다른 몰)도 host 우선', async () => {
    const foodMall: MallRow = { id: 2, slug: 'food', name: '식품몰', host: 'food.utongstart.com', active: 1 }
    const db = makeDB([defaultMall, foodMall], { kind: 'supplier', mallId: 2 })
    const id = await resolveMallId(makeCtx({ db, url: 'http://utongstart.com/', authHeader: 'Bearer dummy' }))
    expect(id).toBe(1)
  })
})

// ── registrationMallId — 계정 토큰 무시 ──────────────────────────────────────
describe('registrationMallId — 신규 가입 몰 결정 (계정 토큰 무시)', () => {
  it('?mall=food → 2', async () => {
    const foodMall: MallRow = { id: 2, slug: 'food', name: '식품몰', host: 'food.utongstart.com', active: 1 }
    const db = makeDB([defaultMall, foodMall])
    const id = await registrationMallId(makeCtx({ db, url: 'http://localhost/', mallQuery: 'food' }))
    expect(id).toBe(2)
  })

  it('?mall 없음 + 기본 호스트 → 1', async () => {
    const db = makeDB([defaultMall])
    const id = await registrationMallId(makeCtx({ db, url: 'http://utongstart.com/' }))
    expect(id).toBe(1)
  })

  it('알 수 없는 호스트 → 1', async () => {
    const db = makeDB([defaultMall])
    const id = await registrationMallId(makeCtx({ db, url: 'http://nope.example.com/' }))
    expect(id).toBe(1)
  })

  it('단일 몰 환경(id=1 만) → 모든 경우 1 반환 (byte-identical invariant)', async () => {
    // 여러 호스트, 여러 slug 시도 — 단일 몰이면 항상 1.
    const db = makeDB([defaultMall])
    for (const host of ['localhost', 'staging.example.com', '']) {
      const id = await registrationMallId(makeCtx({ db, url: `http://${host}/` }))
      expect(id).toBe(1)
    }
  })
})
