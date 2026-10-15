/**
 * 🌏 D1 읽기 복제본 — 캐시해도 되는 공개 읽기만 가까운 복제본에서 읽는다 (2026-10-15).
 *
 * 왜(라이브 실측 2026-10-15):
 *   - 본진 DB(`toss-live-commerce-db`)의 원본이 **미국 동부(ENAM)** 에 있다.
 *   - 한국 손님은 무료 요금제 경로로 **홍콩(HKG)·미국 서부** 데이터센터에 붙는다(실사용 TTFB 표본의 데이터센터).
 *   - 그래서 엣지 캐시에 없는 요청은 쿼리마다 **홍콩 ↔ 미국 동부** 왕복을 탄다. 쿼리 여러 개면 그만큼 곱해진다.
 *   - 읽기 복제본은 이미 켜져 있다(`read_replication: auto`) — 그런데 **세션 API(`withSession`)를 한 번도
 *     부르지 않아서** 모든 읽기가 원본으로 갔다. 켜 놓고 안 쓰는, 에러 없는 부재였다.
 *
 * 무엇을: `withSession('first-unconstrained')` 세션 — 첫 쿼리는 가장 가까운 복제본으로 가고, 쓰기는 원본으로 간다.
 *   세션은 순차 일관성을 지킨다(이 세션에서 쓴 것은 이후 읽기에 반드시 보인다).
 *
 * 어디에만(이게 안전의 핵심): `edge-cache.ts` 가 **응답을 캐시할 요청**에서만 이 래퍼로 바꾼다.
 *   그 응답은 어차피 엣지에 수 분 동안 남는다 — 복제 지연(보통 1초 미만)은 그보다 훨씬 작으므로 손님이 보는
 *   신선도는 1초도 나빠지지 않는다. 로그인 요청(edgeCache 의 우회 경로)·쓰기 요청·결제·정산은 **건드리지 않는다**
 *   (그쪽은 방금 쓴 것을 바로 읽어야 한다 — 원본 그대로).
 *
 * 왜 isolate 하나에 세션 하나인가:
 *   - 이 레포는 `ensureXxx(DB)` 를 **DB 객체로 키를 건 WeakSet** 으로 한 번만 돌린다(167곳). 요청마다 새 래퍼를
 *     만들면 그 기억이 매번 빗나가 요청마다 `CREATE TABLE IF NOT EXISTS` 가 원본(미국)으로 간다 — 고치려던
 *     것보다 더 느려진다. 그래서 원본 DB 하나에 래퍼 하나를 **같은 객체로** 돌려준다.
 *   - 세션은 순수한 상태(북마크) + 바인딩이라 요청을 넘어 써도 된다(workerd 의 D1DatabaseSession 구현 확인).
 *     여러 요청이 같은 세션을 쓰면 일관성은 오히려 강해진다(이 isolate 안에서는 읽기가 뒤로 가지 않는다).
 *
 * 세션 API 가 없으면(테스트의 모의 객체·옛 런타임) 원본을 그대로 돌려준다 — 동작은 종전과 같다.
 */

type AnyFn = (...args: unknown[]) => unknown

const IS_REPLICA = Symbol.for('ur.d1.readReplica')
const replicas = new WeakMap<object, D1Database>()

/** 이 DB 가 이미 읽기 복제본 래퍼인가. */
export function isReadReplicaDb(db: unknown): boolean {
  return !!db && typeof db === 'object' && (db as Record<symbol, unknown>)[IS_REPLICA] === true
}

/**
 * 원본 D1 → 가까운 복제본에서 읽는 래퍼(같은 원본이면 늘 같은 객체).
 * `prepare`·`batch` 만 세션으로 보내고, 나머지(`exec`·`dump`·`withSession`)는 원본에 위임한다 — 세션에는
 * `exec` 이 없어서, 위임하지 않으면 그걸 쓰는 코드가 터진다.
 */
export function readReplicaDb(db: D1Database): D1Database {
  if (!db || typeof db !== 'object') return db
  if (isReadReplicaDb(db)) return db
  if (typeof (db as { withSession?: unknown }).withSession !== 'function') return db
  const hit = replicas.get(db)
  if (hit) return hit

  let session: D1DatabaseSession | null = null
  const sess = (): D1DatabaseSession => {
    if (!session) session = db.withSession('first-unconstrained')
    return session
  }
  const src = db as unknown as Record<string | symbol, unknown>
  const wrapper = new Proxy({} as Record<string | symbol, unknown>, {
    get(_t, prop) {
      if (prop === IS_REPLICA) return true
      if (prop === 'prepare') return (sql: string) => sess().prepare(sql)
      if (prop === 'batch') return (stmts: D1PreparedStatement[]) => sess().batch(stmts)
      const v = src[prop]
      return typeof v === 'function' ? (v as AnyFn).bind(db) : v
    },
    has(_t, prop) {
      return prop === IS_REPLICA || prop in (db as object)
    },
  }) as unknown as D1Database
  replicas.set(db, wrapper)
  return wrapper
}

/**
 * env 의 본진 DB 만 복제본 래퍼로 바꾼 **새 env** 를 돌려준다(원본 env 는 그대로 — 같은 isolate 의 다른 요청과
 * 나눠 쓰는 객체라 고치면 안 된다). DB 가 없거나 세션 API 가 없으면 원본 env 를 그대로 돌려준다.
 */
export function withReadReplicaEnv<E>(env: E): E {
  if (!env || typeof env !== 'object') return env
  const db = (env as { DB?: D1Database }).DB
  if (!db) return env
  const r = readReplicaDb(db)
  if (r === db) return env
  return { ...(env as object), DB: r } as E
}
