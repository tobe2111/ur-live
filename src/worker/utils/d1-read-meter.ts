/**
 * 📏 **D1 읽기 계량기** — "이 작업이 D1 행을 몇 개 읽었나"를 작업 단위로 센다 (2026-09-02 신설).
 *
 * ## 왜
 * 2026-09-01 23:55 KST, 계정이 D1 무료 **일일 읽기 한도(500만 행)** 에 닿아 유어딜 소비자 API 가
 * 통째로 500 이 됐다(CF code 7500). 8/27 실측이 하루 6.19억 행이었고 그날 두 쿼리를 고쳤지만,
 * **그 뒤 아무도 재지 않았다.** 그리고 잴 수단이 Cloudflare 분석 API(DB 단위 총량)뿐이라
 * "어느 cron 이, 어느 레인이" 는 끝내 못 가렸다. 한도는 DB 가 아니라 **계정** 단위라 유어애즈를
 * 아무리 분리해도 유어딜 몫이 깎인다 — 그래서 **작업별** 숫자가 필요하다.
 *
 * ## 무엇을
 * `env.DB`(와 ADS_DB/ADS_COMPANY_DB) 를 얇게 감싸, D1 이 결과마다 돌려주는 `meta.rows_read` /
 * `meta.rows_written` 을 **호출자가 지정한 계량기(ReadMeter)** 에 더한다. 계량기는 cron 작업 하나,
 * 레인 인보케이션 하나 같은 "책임 단위"다. 값은 하트비트(`cron_hb:*`)에 `rr/rw/q/qu` 로 실린다.
 *
 * ## 한계 (과신 금지 — 아래 둘은 **못 센다**)
 * - `first()` / `raw()` / `exec()` 는 D1 이 meta 를 안 준다. **횟수만** `qu`(unmetered) 로 센다.
 *   `first()` 를 `all()` 로 바꿔 세는 방법은 일부러 안 썼다 — 무제한 SELECT 에 `first()` 를 쓴 쿼리가
 *   37만 행을 통째로 실어 와 워커를 죽일 수 있다(계량이 기능을 위협하면 안 된다). `qu` 가 큰 작업은
 *   그 쿼리를 `all()` 로 바꾸거나 정적으로 본다.
 * - 작업이 `ctx.waitUntil` 로 뒤에 남긴 읽기는 하트비트가 이미 써진 뒤라 안 잡힌다.
 *
 * ## 안전
 * - 래퍼는 **던지지 않는다**(계량 실패 = 값 누락일 뿐, 쿼리는 그대로 간다).
 * - D1 의 `batch()` 는 같은 DB 의 원본 statement 를 요구한다 → RAW 심볼로 풀어서 넘긴다
 *   (`shared/ads/leads-db.ts` 의 라우터가 같은 방식이고, 그 위에 이 래퍼를 겹쳐도 서로 풀린다).
 * - 두 번 감싸지 않는다(멱등) — 한 번 감싼 DB 는 표식을 갖는다.
 * - 프록시가 아니라 명시 위임 — `this` 바인딩이 어긋나면 조용히 깨진다(leads-db 의 교훈).
 */

export interface ReadMeter {
  /** 읽은 행(`meta.rows_read` 합) */
  rr: number
  /** 쓴 행(`meta.rows_written` 합) */
  rw: number
  /** meta 를 받은 쿼리 수(`all`/`run`/`batch` 의 statement 수) */
  q: number
  /** meta 없이 지나간 쿼리 수(`first`/`raw`/`exec`) — 이 값이 크면 rr 은 **하한**이다 */
  qu: number
}

export const newMeter = (): ReadMeter => ({ rr: 0, rw: 0, q: 0, qu: 0 })

/** 호출 시점의 계량기를 돌려준다. 없으면(undefined) 그 쿼리는 세지 않는다. */
export type MeterSink = () => ReadMeter | undefined

const RAW = Symbol.for('ur.d1meter.raw')
const METERED = Symbol.for('ur.d1meter.metered')
const ENV_METER = Symbol.for('ur.d1meter.envMeter')

type AnyFn = (...a: unknown[]) => unknown
type Meta = { rows_read?: unknown; rows_written?: unknown } | null | undefined

function addMeta(sink: MeterSink, meta: Meta, count = 1): void {
  try {
    const m = sink()
    if (!m) return
    m.q += count
    const rr = Number((meta as { rows_read?: unknown } | null)?.rows_read)
    const rw = Number((meta as { rows_written?: unknown } | null)?.rows_written)
    if (Number.isFinite(rr)) m.rr += rr
    if (Number.isFinite(rw)) m.rw += rw
  } catch { /* 계량 실패는 삼킨다 */ }
}

function addUnmetered(sink: MeterSink): void {
  try { const m = sink(); if (m) m.qu += 1 } catch { /* 삼킨다 */ }
}

function wrapStatement(stmt: Record<string, unknown>, sink: MeterSink): Record<string | symbol, unknown> {
  const call = (name: string) => (stmt[name] as AnyFn | undefined)
  return {
    [RAW]: stmt,
    bind: (...args: unknown[]) => wrapStatement((stmt.bind as AnyFn).apply(stmt, args) as Record<string, unknown>, sink),
    all: async (...args: unknown[]) => {
      const r = await (call('all') as AnyFn).apply(stmt, args) as { meta?: Meta }
      addMeta(sink, r?.meta)
      return r
    },
    run: async (...args: unknown[]) => {
      const r = await (call('run') as AnyFn).apply(stmt, args) as { meta?: Meta }
      addMeta(sink, r?.meta)
      return r
    },
    first: async (...args: unknown[]) => {
      addUnmetered(sink)
      return (call('first') as AnyFn).apply(stmt, args)
    },
    raw: async (...args: unknown[]) => {
      addUnmetered(sink)
      return (call('raw') as AnyFn).apply(stmt, args)
    },
  }
}

/** 이 DB 가 이미 계량 래퍼인가. */
export function isMeteredD1(db: unknown): boolean {
  return !!db && typeof db === 'object' && (db as Record<symbol, unknown>)[METERED] === true
}

/**
 * D1 하나를 계량 래퍼로 감싼다. `prepare`/`batch`/`exec`/`withSession` 만 가로채고 나머지는 원본에 위임.
 * 이미 감싼 것이면 그대로 돌려준다(멱등).
 */
export function meterD1<T extends object>(db: T, sink: MeterSink): T {
  if (!db || typeof (db as { prepare?: unknown }).prepare !== 'function' || isMeteredD1(db)) return db
  const src = db as unknown as Record<string, unknown>
  const wrapped: Record<string | symbol, unknown> = {
    [METERED]: true,
    prepare(sql: string) {
      return wrapStatement((src.prepare as AnyFn).call(src, sql) as Record<string, unknown>, sink)
    },
    async batch(stmts: unknown[]) {
      const raw = (stmts || []).map((s) => (s as Record<symbol, unknown>)?.[RAW] ?? s)
      const rs = await (src.batch as AnyFn).call(src, raw) as Array<{ meta?: Meta }> | undefined
      if (Array.isArray(rs)) for (const r of rs) addMeta(sink, r?.meta)
      return rs
    },
    async exec(sql: string) {
      addUnmetered(sink)
      return (src.exec as AnyFn).call(src, sql)
    },
  }
  // 세션 API 가 있으면 세션도 같은 계량기로 감싼다(없는 런타임/모의 객체면 생략).
  if (typeof src.withSession === 'function') {
    wrapped.withSession = (...args: unknown[]) => meterD1((src.withSession as AnyFn).apply(src, args) as object, sink)
  }
  // 그 밖의 속성(dump 등)은 원본에 위임 — 새 API 가 생겨도 조용히 깨지지 않게.
  return new Proxy(wrapped, {
    get(target, prop) {
      if (prop in target) return target[prop as string | symbol]
      const v = src[prop as string]
      return typeof v === 'function' ? (v as AnyFn).bind(src) : v
    },
  }) as unknown as T
}

/**
 * env 의 D1 바인딩(DB / ADS_DB / ADS_COMPANY_DB)을 전부 계량 래퍼로 바꾼 **새 env** 를 돌려준다.
 * 원본 env 는 건드리지 않는다. `meter` 를 주면 그 인보케이션 전용 계량기로 고정되고(`readEnvMeter` 로 회수),
 * `sink` 를 주면 매 쿼리마다 호출해 그때의 계량기를 찾는다(cron 워커의 작업별 AsyncLocalStorage 용).
 */
export function withMeteredEnv<E extends object>(env: E, target: ReadMeter | MeterSink): E {
  if (!env || typeof env !== 'object') return env
  const sink: MeterSink = typeof target === 'function' ? target : () => target
  const copy: Record<string | symbol, unknown> = { ...(env as Record<string, unknown>) }
  for (const k of ['DB', 'ADS_DB', 'ADS_COMPANY_DB'] as const) {
    const v = copy[k]
    if (v && typeof (v as { prepare?: unknown }).prepare === 'function') copy[k] = meterD1(v as object, sink)
  }
  if (typeof target !== 'function') copy[ENV_METER] = target
  return copy as E
}

/** `withMeteredEnv(env, meter)` 로 고정한 계량기를 돌려준다(없으면 undefined). */
export function readEnvMeter(env: unknown): ReadMeter | undefined {
  const m = (env as Record<symbol, unknown> | null)?.[ENV_METER]
  return m && typeof m === 'object' ? (m as ReadMeter) : undefined
}

/** 하트비트 페이로드에 실을 모양 — 전부 0 이면 빈 객체(옛 행과 구분되게 rr 은 0 이어도 남긴다). */
export function meterFields(m: ReadMeter | undefined): { rr?: number; rw?: number; q?: number; qu?: number } {
  if (!m) return {}
  const out: { rr?: number; rw?: number; q?: number; qu?: number } = { rr: Math.max(0, Math.round(m.rr)) }
  if (m.rw > 0) out.rw = Math.round(m.rw)
  if (m.q > 0) out.q = Math.round(m.q)
  if (m.qu > 0) out.qu = Math.round(m.qu)
  return out
}
