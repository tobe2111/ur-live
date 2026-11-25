/**
 * 🧪 로컬 시험 환경 (2026-11-25 대표 *"시험 환경에서 숙박 결제 및 사용 완료와 정산까지의 흐름을 … 모두 돌려줘"*)
 *
 * 실제 라우트·cron 코드를 **라이브와 같은 구조의 sqlite** 위에서 돌린다. 가짜인 것은 카드사(Toss) 하나다 —
 * `api.tosspayments.com` 으로 나가는 fetch 를 가로채 승인·취소를 흉내 내고 무엇을 요청했는지 기록한다.
 * 별도 시험 서버(staging)가 없어서 생긴 자리다. 못 보는 것: 진짜 카드사의 응답 · 브라우저 화면 · Cloudflare 런타임.
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { sign } from 'hono/jwt'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
export type Raw = InstanceType<typeof DatabaseSync>

export const SECRET = 'local-test-jwt-secret'

const conv = (a: unknown[]) => a.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v)) as never[]

/** node:sqlite → D1 모양. */
export function d1(db: Raw): D1Database {
  const stmt = (sql: string, args: unknown[] = []) => {
    const s = {
      bind: (...a: unknown[]) => stmt(sql, a),
      first: async <T,>(col?: string) => {
        const r = db.prepare(sql).get(...conv(args)) as Record<string, unknown> | undefined
        if (r === undefined) return null
        return (col ? r[col] : r) as T
      },
      all: async <T,>() => ({ results: db.prepare(sql).all(...conv(args)) as T[], success: true, meta: {} }),
      run: async () => {
        const r = db.prepare(sql).run(...conv(args))
        return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
      },
      raw: async () => (db.prepare(sql).all(...conv(args)) as Record<string, unknown>[]).map((r) => Object.values(r)),
    }
    return s
  }
  return {
    prepare: (sql: string) => stmt(sql),
    // 진짜 D1 의 batch 는 전부 아니면 전무다 — 하나가 실패하면 앞 문장도 되돌린다(2026-11-25: 종전 도우미는 앞 문장을 남겼다).
    batch: async (list: Array<{ run: () => Promise<unknown> }>) => {
      const out = []
      db.exec('BEGIN')
      try { for (const s of list) out.push(await s.run()); db.exec('COMMIT') } catch (e) { db.exec('ROLLBACK'); throw e }
      return out
    },
    exec: async (sql: string) => { db.exec(sql); return { count: 1, duration: 0 } },
    withSession: () => d1(db),
  } as unknown as D1Database
}

/**
 * 라이브 메인 D1 과 **같은 구조**의 빈 sqlite 를 메모리에 세운다.
 * 구조는 `src/tests/fixtures/live-main-ddl.json`(라이브 실측 · `node scripts/snapshot-live-schema-ddl.mjs`)에서 온다.
 * NOT NULL · UNIQUE · 기본값이 라이브 그대로라, 열 이름만 보는 가드가 못 잡는 INSERT 실패를 여기서 잡는다.
 */
export function openLiveSchema(): Raw {
  const ddl = JSON.parse(readFileSync('src/tests/fixtures/live-main-ddl.json', 'utf8')) as { tables: string[]; indexes: string[] }
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = OFF')
  for (const sql of [...ddl.tables, ...ddl.indexes]) db.exec(sql)
  return db
}

/** NOT NULL 인데 기본값이 없는 열을 타입에 맞는 값으로 채워 넣는다. */
export function insert(db: Raw, table: string, values: Record<string, unknown>): number {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; type: string; notnull: number; dflt_value: unknown; pk: number }>
  const row: Record<string, unknown> = { ...values }
  for (const c of cols) {
    if (c.name in row) continue
    if (c.notnull && c.dflt_value === null && !c.pk) row[c.name] = /INT|REAL|NUM/i.test(c.type) ? 0 : `test-${c.name}`
  }
  const known = new Set(cols.map((c) => c.name))
  for (const k of Object.keys(row)) if (!known.has(k)) throw new Error(`${table}: 없는 열 ${k}`)
  const keys = Object.keys(row)
  const r = db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...conv(keys.map((k) => row[k])))
  return Number(r.lastInsertRowid)
}

export const q = <T = Record<string, unknown>>(db: Raw, sql: string, ...args: unknown[]) => db.prepare(sql).all(...conv(args)) as T[]
export const q1 = <T = Record<string, unknown>>(db: Raw, sql: string, ...args: unknown[]) => (db.prepare(sql).get(...conv(args)) as T | undefined) ?? null

const now = () => Math.floor(Date.now() / 1000)
export const userToken = (userId: number) => sign({ sub: String(userId), user_id: userId, type: 'user', iat: now(), exp: now() + 3600 }, SECRET)
export const sellerToken = (sellerId: number, extra: Record<string, unknown> = {}) =>
  sign({ type: 'seller', seller_id: sellerId, sub: String(sellerId), iat: now(), exp: now() + 3600, ...extra }, SECRET)

/** waitUntil 에 맡긴 일을 모아 두었다가 요청 뒤에 끝까지 기다린다(원장 기록이 여기서 돈다). */
export function makeCtx() {
  const pending: Promise<unknown>[] = []
  return {
    ctx: { waitUntil: (p: Promise<unknown>) => { pending.push(Promise.resolve(p).catch(() => undefined)) }, passThroughOnException: () => undefined } as unknown as ExecutionContext,
    drain: async () => { while (pending.length) await pending.shift() },
  }
}

export interface TossCall { kind: 'confirm' | 'cancel'; paymentKey: string; amount: number | null; body: Record<string, unknown> }

/** 가짜 카드사. 승인은 늘 성공, 취소는 금액을 기록한다. 그 밖의 바깥 호출은 빈 200. */
export function stubOutbound(): { toss: TossCall[]; other: string[]; restore: () => void } {
  const toss: TossCall[] = []
  const other: string[] = []
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    let body: Record<string, unknown> = {}
    try { body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {} } catch { /* 폼 인코딩 본문(기프티콘 발송사) */ }
    if (url === 'https://api.tosspayments.com/v1/payments/confirm') {
      toss.push({ kind: 'confirm', paymentKey: String(body.paymentKey), amount: Number(body.amount), body })
      return new Response(JSON.stringify({ paymentKey: body.paymentKey, orderId: body.orderId, status: 'DONE', totalAmount: body.amount, method: '카드', approvedAt: new Date().toISOString() }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    const m = /^https:\/\/api\.tosspayments\.com\/v1\/payments\/([^/]+)\/cancel$/.exec(url)
    if (m) {
      toss.push({ kind: 'cancel', paymentKey: decodeURIComponent(m[1]), amount: body.cancelAmount === undefined ? null : Number(body.cancelAmount), body })
      return new Response(JSON.stringify({ paymentKey: m[1], status: 'CANCELED', cancels: [{ cancelAmount: body.cancelAmount ?? 0 }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    other.push(url)
    // 기프티콘 발송사(KT Alpha) — 늘 성공으로 답한다(주문번호·PIN 을 돌려준다).
    if (url.includes('bizapi.giftishow.com')) {
      return new Response(JSON.stringify({ code: '0000', message: 'OK', result: { code: '0000', message: 'OK', result: { orderNo: `KT${other.length}`, pinNo: '1234567890' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  return { toss, other, restore: () => { globalThis.fetch = orig } }
}

/** 판정을 모은다 — 하나가 틀려도 끝까지 돌려 전부 보고한다. */
export function makeReport(flushTo?: string) {
  const lines: string[] = []
  const fails: string[] = []
  return {
    lines, fails,
    // 단계마다 파일에 흘려 둔다 — 중간에 예외로 끊겨도 거기까지의 기록이 남는다.
    section: (t: string) => { lines.push('', `## ${t}`); if (flushTo) writeFileSync(flushTo, lines.join('\n') + '\n') },
    note: (t: string) => { lines.push(`- ${t}`) },
    check: (name: string, ok: boolean, detail = '') => {
      lines.push(`- ${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
      if (!ok) fails.push(`${name}${detail ? ` — ${detail}` : ''}`)
    },
  }
}
