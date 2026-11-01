import { describe, it, expect, beforeAll } from 'vitest'
import { readCode } from '../helpers/source-text'
// node:sqlite 는 vite 가 번들 못 하므로 계산된 specifier + @vite-ignore 로 런타임 동적 로드.
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { sectionsRoutes } from '@/features/sections/api/sections.routes'
import { resolveSectionProducts, takeUnclaimed } from '@/features/sections/api/section-rules'
import { SECTION_SEED_VERSION } from '@/features/sections/api/section-seed'
import { stripComments } from '@/tests/helpers/source-text'

/**
 * ⚡ 2026-10-15 대표 *"여전히 그리고 첫 접속 시 2~3배 다른 사이트에 비해 느려. 이런 이용권은 어떠세요? 도 너무 늦게 떠"*
 *
 * ## 무엇이었나 (실측)
 * - D1 은 **미국 동부(ENAM), 읽기 복제 꺼짐**(CF API `running_in_region`). 한국 콜로의 워커가 묻는 질의
 *   하나가 태평양 왕복 ~170ms 다.
 * - 홈 HTML 은 `/api/sections` 를 SSR 시드로 **기다린다**(위치 쿠키가 있으면 격자별 키라 예열·KV 가 없다).
 * - 그 핸들러는 캐시가 비면 질의를 **한 줄로** 기다렸다: [DDL 6 → 시드 버전 → 섹션 → 수동 → 규칙 1 → 규칙 2
 *   … → 배너]. 새 isolate 면 **17왕복**(이 테스트 실측) ≈ 2.9초로 SSR 타임아웃(2000ms)을 넘겨 **시드가 빠지고**, 그러면 서버
 *   첫 화면이 섹션을 못 그려 "이런 이용권은 어떠세요?" 가 JS 부팅 뒤에야 떴다. 넘기지 않아도 그 시간만큼
 *   HTML 첫 바이트가 늦었다.
 *
 * ## 이 테스트가 실제로 재는 것
 * 질의마다 50ms 를 거는 진짜 SQLite 위에서 **진짜 라우트**를 부르고, 걸린 시간을 왕복 수로 환산한다.
 * 문자열 검사로는 "await 가 루프 안에 있다" 같은 직렬화를 못 잡는다 — 시간은 거짓말을 안 한다.
 * 그리고 동시에 물어도 **결과가 직렬과 같은지**를 진짜 질의로 대조한다(빨라졌는데 목록이 틀리면 개악이다).
 *
 * ⚠️ **못 보는 것**: 라이브 왕복 시간(콜로·D1 위치) · 엣지 캐시가 있을 때(그땐 이 핸들러가 안 돈다) ·
 *   워커가 이 응답을 기다리는 쪽(`ssr-payload.ts`, 잠금 파일 — 무접촉).
 */
const RTT = 50

function makeDb(opts: { delay?: number } = {}) {
  const db = new DatabaseSync(':memory:')
  let queries = 0
  const log: string[] = []
  const delay = opts.delay ?? 0
  const sleep = () => (delay ? new Promise((r) => setTimeout(r, delay)) : Promise.resolve())
  const wrap = (sql: string) => {
    let args: unknown[] = []
    log.push(sql)
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { queries++; await sleep(); const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      first: async () => { queries++; await sleep(); const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => { queries++; await sleep(); return { results: db.prepare(sql).all(...(args as never[])) } },
    }
    return api
  }
  const exec = (sql: string) => db.prepare(sql).run()
  exec(`CREATE TABLE products (
    id INTEGER PRIMARY KEY, name TEXT, price INTEGER, original_price INTEGER,
    image_url TEXT, category TEXT, discount_rate INTEGER, sold_count INTEGER,
    dominant_color TEXT, avg_rating REAL, review_count INTEGER, view_count INTEGER,
    deal_only INTEGER, restaurant_name TEXT, restaurant_address TEXT, slug TEXT,
    restaurant_lat REAL, restaurant_lng REAL,
    images TEXT, is_active INTEGER, group_buy_status TEXT, created_at TEXT,
    seller_id INTEGER, is_supply_product INTEGER, supply_source_id INTEGER, mall_id INTEGER)`)
  exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, status TEXT)`)
  exec(`CREATE TABLE seller_meta (seller_id INTEGER, key TEXT, value TEXT)`)
  exec(`CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`)
  exec(`INSERT INTO platform_settings (key, value) VALUES ('home_sections_seed_version', '${SECTION_SEED_VERSION}')`)
  exec(`CREATE TABLE homepage_sections (id INTEGER PRIMARY KEY, title TEXT, subtitle TEXT, sort_order INTEGER,
    is_active INTEGER DEFAULT 1, layout TEXT, created_at TEXT, updated_at TEXT,
    source TEXT, source_value TEXT, limit_count INTEGER, more_href TEXT)`)
  exec(`CREATE TABLE section_products (id INTEGER PRIMARY KEY, section_id INTEGER, product_id INTEGER, sort_order INTEGER)`)
  exec(`CREATE TABLE banners (id INTEGER PRIMARY KEY, title TEXT, image_url TEXT, video_url TEXT, link_url TEXT,
    description TEXT, banner_slot TEXT, display_order INTEGER, start_date TEXT, end_date TEXT, is_active INTEGER, created_at TEXT)`)
  // 라이브 편성 모양: 인기 · 숙소 · 식사 — 숙소가 인기 상위를 독점해 배제가 실제로 일한다.
  exec(`INSERT INTO homepage_sections (id,title,sort_order,source,source_value,limit_count) VALUES
    (1,'이런 이용권은 어떠세요?',1,'popular',NULL,4),
    (2,'주말에 떠나는 숙소',2,'category','stay_voucher',4),
    (3,'든든한 한 끼',3,'category','meal_voucher',4)`)
  const ins = db.prepare(`INSERT INTO products (id,name,price,original_price,image_url,category,discount_rate,sold_count,
    review_count,view_count,deal_only,restaurant_name,slug,restaurant_lat,restaurant_lng,is_active,group_buy_status,created_at,
    seller_id,is_supply_product,mall_id) VALUES (?,?,1000,2000,'x',?,50,?,?,?,0,'가게',?,?,?,1,'active',?,NULL,0,1)`)
  // 동률(같은 판매량·같은 날짜)을 일부러 섞는다 — 정렬이 결정적이지 않으면 동시 질의가 직렬과 갈린다.
  for (let i = 1; i <= 30; i++) {
    const cat = i % 3 === 0 ? 'meal_voucher' : i % 3 === 1 ? 'stay_voucher' : 'beauty_voucher'
    ins.run(...([i, `상품${i}`, cat, (i * 7) % 11, i % 4, i % 5, `p-${i}`, 37 + (i % 7) * 0.01, 127 + (i % 5) * 0.01,
      `2026-09-${String(1 + (i % 4)).padStart(2, '0')}`] as never[]))
  }
  return { DB: { prepare: (sql: string) => wrap(sql) } as unknown as D1Database, count: () => queries, log }
}

beforeAll(() => {
  // 엣지 캐시는 비어 있다고 둔다 — 콜드 콜로가 이 핸들러를 직접 부르는 경우가 재려는 대상이다.
  ;(globalThis as unknown as { caches: unknown }).caches = {
    default: { match: async () => undefined, put: async () => {} },
  }
})

async function timed(env: { DB: D1Database }, path: string) {
  const t = Date.now()
  const res = await sectionsRoutes.request(path, {}, env as never, { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as never)
  const body = await res.json() as { data: Array<{ id: number; products: Array<{ id: number }> }> }
  return { ms: Date.now() - t, body }
}

describe('홈 섹션 — 캐시가 빈 요청이 질의를 차례로 기다리지 않는다', () => {
  it('새 isolate 첫 요청: 5왕복 이하 (실측 종전 17 → 지금 4)', async () => {
    const { DB } = makeDb({ delay: RTT })
    const { ms, body } = await timed({ DB }, '/?near=37.02,127.02')
    expect(body.data.length, '편성이 안 나오면 시간을 재는 의미가 없다').toBe(3)
    expect(Math.round(ms / RTT), `걸린 시간 ${ms}ms`).toBeLessThanOrEqual(5)
  })

  it('같은 isolate 두 번째(다른 격자 — L1 miss): 3왕복 이하 (실측 종전 6 → 지금 2)', async () => {
    const { DB } = makeDb({ delay: RTT })
    await timed({ DB }, '/?near=37.04,127.04')
    const { ms } = await timed({ DB }, '/?near=37.06,127.00')
    expect(Math.round(ms / RTT), `걸린 시간 ${ms}ms`).toBeLessThanOrEqual(3)
  })

  it('시드 버전은 isolate 당 한 번만 묻는다', async () => {
    const { DB, log } = makeDb()
    await timed({ DB }, '/?near=37.08,127.02')
    const before = log.filter((q) => q.includes('platform_settings') && !q.includes('popular_weight') && !/IN \(/.test(q)).length
    await timed({ DB }, '/?near=37.10,127.04')
    const after = log.filter((q) => q.includes('platform_settings') && !q.includes('popular_weight') && !/IN \(/.test(q)).length
    expect(before, '첫 요청에서 버전을 한 번은 물어야 한다(측정이 헛돌지 않게)').toBeGreaterThan(0)
    expect(after - before).toBe(0)
  })

  it('라우트 응답이 직렬로 물었을 때와 같은 목록이다 (빨라지면서 결과가 바뀌지 않았다)', async () => {
    const { DB } = makeDb()
    const env = { DB } as never
    const near = { lat: 37.02, lng: 127.02 }
    const specs = [
      { source: 'popular' as const, limit: 4 },
      { source: 'category' as const, sourceValue: 'stay_voucher', limit: 4 },
      { source: 'category' as const, sourceValue: 'meal_voucher', limit: 4 },
    ]
    const used: number[] = []
    const want: number[][] = []
    for (const s of specs) {
      const ids = (await resolveSectionProducts(env, { ...s, excludeIds: [...used], near })).map((r) => r.id as number)
      want.push(ids); used.push(...ids)
    }
    const { body } = await timed({ DB }, '/?near=37.02,127.02')
    const got = body.data.map((sec) => sec.products.map((p) => p.id))
    expect(want.flat().length, '픽스처가 줄을 못 채우면 대조가 무의미하다').toBeGreaterThanOrEqual(10)
    expect(got).toEqual(want)
  })

  it('DDL 은 정상 경로에서 안 돈다 — 테이블이 있으면 CREATE/ALTER 를 묻지 않는다', async () => {
    const src = stripComments(readFileSync('src/features/sections/api/sections.routes.ts', 'utf-8'))
    const get = src.slice(src.indexOf("sectionsRoutes.get('/'"), src.indexOf("sectionsRoutes.get('/admin'"))
    // ensureTables 는 섹션 SELECT 가 **실패했을 때**(catch 안)에서만 부른다.
    const calls = [...get.matchAll(/await ensureTables\(DB\)/g)].map((m) => m.index!)
    expect(calls.length).toBe(1)
    const catchAt = get.lastIndexOf('.catch(async', calls[0])
    expect(catchAt, 'ensureTables 가 catch 밖(정상 경로)에 있다').toBeGreaterThan(-1)
  })
})

describe('동시에 물어도 결과는 직렬과 같다', () => {
  const specs = [
    { source: 'popular' as const, limit: 4 },
    { source: 'category' as const, sourceValue: 'stay_voucher', limit: 4 },
    { source: 'category' as const, sourceValue: 'meal_voucher', limit: 3 },
    { source: 'newest' as const, limit: 5 },
  ]
  for (const near of [null, { lat: 37.02, lng: 127.02 }]) {
    it(`규칙 섹션 4줄${near ? ' · 위치 정렬' : ''} — 줄마다 같은 id, 같은 순서`, async () => {
      const { DB } = makeDb()
      const env = { DB } as never
      // 직렬(종전): 위에서 쓴 것을 빼고 묻는다.
      const serial: number[][] = []
      const used: number[] = []
      for (const s of specs) {
        const rows = await resolveSectionProducts(env, { ...s, excludeIds: [...used], near })
        serial.push(rows.map((r) => r.id as number))
        used.push(...serial[serial.length - 1])
      }
      // 동시(지금): 위 줄들 몫만큼 더 받고 나중에 뺀다.
      let ahead = 0
      const pending = specs.map((s) => { const p = resolveSectionProducts(env, { ...s, excludeIds: [], near, overfetch: ahead }); ahead += s.limit; return p })
      const claimed = new Set<number>()
      const parallel: number[][] = []
      for (let i = 0; i < specs.length; i++) {
        const rows = takeUnclaimed(await pending[i], claimed, specs[i].limit).map((r) => r.id as number)
        rows.forEach((id) => claimed.add(id))
        parallel.push(rows)
      }
      expect(serial.flat().length, '픽스처가 줄을 못 채우면 대조가 무의미하다').toBeGreaterThan(10)
      expect(parallel).toEqual(serial)
    })
  }

  it('overfetch 가 없으면 동시 질의는 아래 줄을 덜 채운다 (이 대조가 헛돌지 않는다는 증거)', async () => {
    const { DB } = makeDb()
    const env = { DB } as never
    const top = await resolveSectionProducts(env, { source: 'popular', limit: 10 })
    const raw = await resolveSectionProducts(env, { source: 'category', sourceValue: 'stay_voucher', limit: 4 })
    const taken = takeUnclaimed(raw, new Set(top.map((r) => r.id as number)), 4)
    expect(taken.length).toBeLessThan(4)
  })
})

/**
 * 🌏 2026-10-15 결재(D1 읽기 복제 — 대표 *"응 켜고 코드 작업 진행해줘"*). 켜도 **세션 API 로 물어야만** 사본으로 간다.
 *   ① 이 라우트의 질의가 전부 세션으로 가는가 ② 요청마다 새 세션이어도 isolate 메모가 안 빗나가는가
 *   ③ 세션 API 가 없으면 원본 그대로인가 ④ 머니 경로가 이 함수를 안 쓰는가.
 * ⚠️ 못 보는 것: Cloudflare 가 실제로 한국 근처 사본으로 보내는지(라이브만 안다) · 사본 지연의 실제 크기.
 */
describe('D1 읽기 복제 — 공개 편성 읽기만 사본으로', () => {
  function replicated() {
    const base = makeDb()
    let primaryCalls = 0, sessionCalls = 0, sessions = 0
    const DB = {
      prepare: (sql: string) => { primaryCalls++; return base.DB.prepare(sql) },
      // 요청마다 **새 세션 객체** — 진짜 런타임과 같다(메모가 세션을 키로 쓰면 매번 빗나간다).
      withSession: () => { sessions++; return { prepare: (sql: string) => { sessionCalls++; return base.DB.prepare(sql) } } },
    } as unknown as D1Database
    return { DB, log: base.log, stats: () => ({ primaryCalls, sessionCalls, sessions }) }
  }

  it('라우트의 질의가 전부 세션(사본)으로 간다 — 원본 직행 0', async () => {
    const r = replicated()
    await timed({ DB: r.DB }, '/?near=37.12,127.02')
    const s = r.stats()
    expect(s.sessions, '세션을 열지 않았다 — 복제를 켜도 원본으로 간다').toBeGreaterThan(0)
    expect(s.sessionCalls).toBeGreaterThan(3)
    expect(s.primaryCalls).toBe(0)
  })

  it('요청마다 새 세션이어도 메모가 유지된다 — 두 번째 요청에 DDL·시드 버전·PRAGMA 재질의 0', async () => {
    const r = replicated()
    await timed({ DB: r.DB }, '/?near=37.14,127.02')
    const before = r.log.length
    await timed({ DB: r.DB }, '/?near=37.16,127.04')
    const second = r.log.slice(before)
    expect(second.filter((q) => /^\s*(CREATE|ALTER|PRAGMA)/i.test(q))).toEqual([])
    expect(second.filter((q) => q.includes('platform_settings') && !q.includes('popular_weight') && !/IN \(/.test(q))).toEqual([])
  })

  it('세션 API 가 없으면 원본 그대로 (로컬·옛 런타임 무회귀)', async () => {
    const { publicReadDb, dbKey } = await import('@/worker/utils/d1-read-replica')
    const plain = { prepare: () => null } as unknown as D1Database
    expect(publicReadDb(plain)).toBe(plain)
    expect(dbKey(plain)).toBe(plain)
    const primary = { prepare: () => null, withSession: () => ({ prepare: () => null }) } as unknown as D1Database
    const s = publicReadDb(primary)
    expect(s).not.toBe(primary)
    expect(dbKey(s)).toBe(primary)
    // DB 바인딩이 없는 환경(라우트 시험 스텁)에서 던지면 그 라우트 시험 전부가 500 이 된다
    expect(publicReadDb(undefined as unknown as D1Database)).toBeUndefined()
    expect(dbKey(undefined as unknown as D1Database)).toBeUndefined()
  })

  it('누가 답했는지 X-D1-Served 로 내보낸다 — 켜기만 하고 안 쓰는 상태와 구분', async () => {
    const base = makeDb()
    const withMeta = (sql: string) => {
      const q = base.DB.prepare(sql) as unknown as { bind: (...a: unknown[]) => unknown; all: () => Promise<{ results: unknown[] }> }
      const all = q.all.bind(q)
      q.all = async () => ({ ...(await all()), meta: { served_by_primary: false, served_by_region: 'APAC' } })
      return q
    }
    const DB = { prepare: base.DB.prepare, withSession: () => ({ prepare: withMeta }) } as unknown as D1Database
    const res = await sectionsRoutes.request('/?near=37.18,127.06', {}, { DB } as never, { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as never)
    expect(res.headers.get('X-D1-Served')).toBe('replica:APAC')
  })

  it('d1ServedLabel — 원본/사본/메타 없음 · 지역 문자열은 안전한 글자만', async () => {
    const { d1ServedLabel } = await import('@/worker/utils/d1-read-replica')
    expect(d1ServedLabel({ meta: { served_by_primary: true, served_by_region: 'ENAM' } })).toBe('primary:ENAM')
    expect(d1ServedLabel({ meta: { served_by_primary: false, served_by_region: 'APAC' } })).toBe('replica:APAC')
    expect(d1ServedLabel({ results: [] })).toBeNull()
    expect(d1ServedLabel({ meta: { served_by_primary: false, served_by_region: 'A\r\nX: y' } })).toBe('replica:AXy')
  })

  it('2단계 유어샵 — 사본은 익명 방문에만(주인은 편집 직후 옛 값을 보면 안 된다)', () => {
    const src = readFileSync('src/worker/routes/curator.routes.ts', 'utf-8')
    const lines = src.split('\n').filter((l) => l.includes('publicReadDb(c.env.DB)'))
    expect(lines.length, '유어샵 공개 조회가 사본을 안 쓴다').toBe(1)
    expect(lines[0]).toMatch(/getAuthUserId\(c\) == null \? publicReadDb\(c\.env\.DB\) : c\.env\.DB/)
  })

  it('2단계 블로그 — 발행 글 읽기만 사본, 조회수 쓰기·관리 경로는 원본', () => {
    const src = readFileSync('src/features/blog/api/blog.routes.ts', 'utf-8')
    const cut = src.indexOf("app.post('/public/:slug/view'")
    expect(cut).toBeGreaterThan(0)
    const before = src.slice(0, cut), after = src.slice(cut)
    expect((before.match(/publicReadDb\(c\.env\.DB\)/g) ?? []).length).toBe(2)
    expect(after).not.toMatch(/publicReadDb\(/)
  })

  it('2단계 — 유어샵이 거치는 isolate 메모도 원본 기준(dbKey)', () => {
    for (const f of ['src/worker/utils/ushop-sales.ts', 'src/worker/utils/affiliate-program.ts', 'src/worker/utils/seller-operators.ts',
      'src/worker/utils/product-supply-meta.ts', 'src/worker/utils/seller-meta.ts', 'src/features/group-buy/api/helpers.ts']) {
      const src = readFileSync(f, 'utf-8')
      expect(src, `${f}: 세션마다 메모가 빗나가 DDL·설정 조회가 요청마다 다시 돈다`).not.toMatch(/\.(has|get|add|set|delete)\(DB\b/)
    }
  })

  it('3단계 이용권 — 공개 GET 다섯만 사본, 로그인·사용처리 경로는 원본', () => {
    const src = readCode('src/features/group-buy/api/group-buy-public.routes.ts') // 주석 제거본 — 설명 속 'UPDATE' 오탐 방지
    const handlers = src.split(/\n  router\./)
    const using = handlers.filter((h) => h.includes('publicReadDb(c.env.DB)')).map((h) => h.slice(0, h.indexOf(',')))
    expect(using.sort()).toEqual(["get('/live-ticker'", "get('/products'", "get('/products/:id'", "get('/products/:id/participants'", "get('/products/map-clusters'"].sort())
    for (const h of handlers.filter((x) => x.includes('publicReadDb(c.env.DB)'))) {
      expect(h, '사본 핸들러에서 쓰기').not.toMatch(/\b(INSERT|UPDATE|DELETE)\b|\.run\(\)/)
      expect(h.slice(0, 200), '사본 핸들러는 로그인 없는 공개 경로여야').not.toMatch(/requireAuth|requireAdmin/)
    }
    expect(src).toMatch(/ensureTables\(c\.env\.DB\)/)
  })

  it('홈페이지 위젯 — GET 만 · 쓰기 0 · 로그인 없음', () => {
    const src = readCode('src/worker/routes/embed.routes.ts')
    expect(src).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b|\.run\(\)/)
    expect(src).not.toMatch(/embedRoutes\.(post|put|patch|delete)\(/)
    expect(src).not.toMatch(/requireAuth|requireAdmin|parseSessionCookie/)
  })

  it('publicReadDb 는 허용된 공개 읽기 파일에서만 쓴다 — 머니·관리 경로 금지', () => {
    const ALLOWED = new Set([
      'src/features/sections/api/sections.routes.ts',
      'src/worker/routes/curator.routes.ts', // 2단계 — 익명 방문만(아래 시험)
      'src/features/blog/api/blog.routes.ts', // 2단계 — 발행 글 읽기만(아래 시험)
      'src/features/group-buy/api/group-buy-public.routes.ts', // 3단계 — 공개 목록·상세 GET 만(아래 시험)
      'src/worker/routes/embed.routes.ts', // 🧩 2026-10-31 홈페이지 위젯 — 공개 GET 만, 쓰기 0(아래 시험). 엣지 캐시 5분이라 사본 지연은 묻힌다
    ])
    const hits = execSync(`grep -rlE "publicReadDb\\(" src --include=*.ts --include=*.tsx`, { encoding: 'utf-8' })
      .split('\n').filter(Boolean).filter((f) => !f.includes('/tests/') && !f.endsWith('d1-read-replica.ts'))
    expect(hits.length, '쓰는 곳이 0 이면 복제를 켜도 아무 효과가 없다').toBeGreaterThan(0)
    for (const f of hits) expect(ALLOWED.has(f), `${f} 는 허용 목록 밖 — 사본 지연을 견디는 공개 읽기인지 판단 후 목록에 추가`).toBe(true)
  })
})
