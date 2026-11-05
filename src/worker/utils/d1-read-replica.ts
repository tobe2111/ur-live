/**
 * 🌏 D1 읽기 복제본 — 손님 공개 읽기 전용 (2026-10-15 대표 결재 *"응 켜고 코드 작업 진행해줘"*,
 *   결재 파일 `docs/decisions/2026-10-15-d1-read-replication.md`).
 *
 * 왜: 유어딜 DB 는 미국 동부(ENAM) 한 곳이다. 한국 콜로에서 캐시가 빈 요청은 질의마다 태평양을 왕복한다.
 *   읽기 복제를 켜면 Cloudflare 가 가까운 지역에 읽기 전용 사본을 두는데, **세션 API 로 물어야만** 사본으로 간다
 *   (`env.DB` 를 그대로 쓰면 켜도 원본으로 간다). 이 파일이 그 세션을 여는 단 한 곳이다.
 *
 * 🔒 쓰는 곳은 **로그인 없이 보는 목록·편성 읽기**뿐이다. 결제·정산·환불·재고·딜·주문·어드민·셀러는
 *   절대 이 함수를 쓰지 않는다 — 사본은 원본보다 잠깐 늦을 수 있어서, 방금 쓴 값을 바로 읽어야 하는
 *   경로에서 옛 값을 보게 된다. 가드 `d1-read-replica-2026-10-15.test.ts` 가 허용 파일 목록을 고정한다.
 *
 * 세션 안의 쓰기(DDL·시드)는 Cloudflare 가 알아서 원본으로 보낸다 — 같은 세션 안에서는 방금 쓴 값을 읽는다
 *   (순차 일관성). 복제가 **꺼져 있으면** 세션도 원본으로 간다 = 지금과 같다(코드를 먼저 배포해도 무해).
 */

/** 세션이 원본을 기억하게 붙이는 표식 — isolate 메모(WeakSet)가 요청마다 새 세션을 "처음 보는 DB" 로 오해하지 않게. */
const PRIMARY = Symbol.for('ur.d1.primary')

type WithSession = D1Database & { withSession?: (constraint?: string) => unknown }

/**
 * 공개 읽기용 DB. 세션 API 가 없으면(로컬·시험·옛 런타임) 원본을 그대로 돌려준다.
 * 'first-unconstrained' — 첫 질의를 가장 가까운 사본이 받는다(원본을 거치지 않는다).
 */
export function publicReadDb(db: D1Database): D1Database {
  const fn = (db as WithSession | undefined)?.withSession // DB 바인딩이 없는 환경(시험 스텁)에서도 원본(=undefined) 그대로
  if (typeof fn !== 'function') return db
  try {
    const s = fn.call(db, 'first-unconstrained') as D1Database & { [PRIMARY]?: D1Database }
    if (!s || typeof (s as { prepare?: unknown }).prepare !== 'function') return db
    s[PRIMARY] = (db as D1Database & { [PRIMARY]?: D1Database })[PRIMARY] ?? db
    return s
  } catch {
    return db
  }
}

/**
 * isolate 메모의 키 — 세션이면 그 원본, 아니면 자기 자신.
 * 🩸 이걸 안 쓰면 요청마다 새 세션이 생겨 "테이블 확인 완료" 같은 메모가 매번 빗나가고, 아끼려던 왕복을
 *   DDL 로 다시 낸다(이 레포의 2% 프로파일러 래퍼가 같은 모양이다).
 */
export function dbKey(db: D1Database): D1Database {
  return (db as (D1Database & { [PRIMARY]?: D1Database }) | undefined)?.[PRIMARY] ?? db
}

/**
 * 🔎 이 질의를 누가 받았나 — 복제를 켜 놓고 **실제로 사본에서 읽는지**는 응답 메타로만 알 수 있다
 *   (켜기만 하고 안 쓰는 상태와 구분이 안 된다). D1 결과의 `meta.served_by_primary` / `served_by_region`.
 *   원본이면 `primary:<지역>`, 사본이면 `replica:<지역>`, 메타가 없으면(로컬·옛 런타임) null.
 */
export function d1ServedLabel(res: unknown): string | null {
  const m = (res as { meta?: { served_by_primary?: boolean; served_by_region?: string } } | null)?.meta
  if (!m || (m.served_by_primary === undefined && !m.served_by_region)) return null
  const region = typeof m.served_by_region === 'string' ? m.served_by_region.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16) : ''
  return `${m.served_by_primary ? 'primary' : 'replica'}${region ? `:${region}` : ''}`
}

/* ────────────────────────────────────────────────────────────────────────────
 * 👤 2026-11-03 로그인 손님 읽기도 사본으로 — 대표 *"1,3,4 다 해줘"*(1 = 로그인 화면도 한국 근처 사본).
 *
 * 사본의 유일한 위험은 "방금 내가 바꾼 것이 안 보인다" 다. 그래서 **이 브라우저가 무언가를 바꾼 직후**
 * (`/api/*` 의 GET·HEAD 아닌 요청이 성공한 뒤) 짧은 쿠키를 붙이고, 그 쿠키가 살아 있는 동안은 원본에서 읽는다.
 * 다른 사람이 바꾼 것(사장님이 사용처리 등)은 사본이 보통 1초 안에 따라온다.
 * 🔒 돈 화면(딜 잔액·주문·결제·정산·사장님 매출)은 이 함수도 쓰지 않는다 — 계속 원본(가드가 허용 파일을 고정).
 * ──────────────────────────────────────────────────────────────────────────── */
export const D1_FRESH_COOKIE = 'ur_d1_fresh'
/** 쓰기 뒤 원본에서 읽는 시간(초). 사본 지연(보통 1초 미만)보다 넉넉히. */
export const D1_FRESH_SECONDS = 30

/** 이 브라우저가 방금 무언가를 바꿨나(쿠키). */
export function hasRecentWrite(cookieHeader: string | null | undefined): boolean {
  return !!cookieHeader && /(?:^|;\s*)ur_d1_fresh=1(?:\s*;|$)/.test(cookieHeader)
}

/** 쓰기 성공 응답에 붙이는 쿠키 한 줄. */
export function recentWriteCookie(): string {
  return `${D1_FRESH_COOKIE}=1; Path=/; Max-Age=${D1_FRESH_SECONDS}; SameSite=Lax; Secure; HttpOnly`
}

/** 로그인 손님의 읽기용 DB — 방금 쓴 브라우저면 원본, 아니면 사본(세션 API 없으면 원본). */
export function userReadDb(db: D1Database, cookieHeader: string | null | undefined): D1Database {
  return hasRecentWrite(cookieHeader) ? db : publicReadDb(db)
}

type MiniCtx = { req: { method: string }; res: Response }
/** `/api/*` 미들웨어 — GET·HEAD 아닌 요청이 성공(<400)하면 쿠키를 붙인다. 응답 헤더가 잠겨 있으면 조용히 건너뛴다. */
export function recentWriteMarker() {
  return async (c: MiniCtx, next: () => Promise<void>) => {
    await next()
    const m = c.req.method
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return
    if (!c.res || c.res.status >= 400) return
    try { c.res.headers.append('Set-Cookie', recentWriteCookie()) } catch { /* 잠긴 헤더 — 건너뜀 */ }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 🧱 2026-11-05 표가 이미 있는지 **읽기로** 확인 — 사본 세션 안에 DDL 을 끼우지 않으려고.
 *   `CREATE TABLE IF NOT EXISTS`·`ALTER … ADD COLUMN` 은 이미 있어도 **쓰기**라 사본이 못 받고 미국 원본까지 간다
 *   (한국에서 한 문장 ≈0.2초). 손님 읽기 경로의 `ensureXxx` 가 isolate 마다 그걸 2~6번 보냈다.
 *   이 확인은 `sqlite_master` 와 `LIMIT 0` 읽기뿐이라 가까운 사본이 답한다. 하나라도 없으면 false →
 *   호출부가 종전대로 DDL 을 돈다(새 DB·옛 스키마는 지금과 똑같이 고쳐진다). 확인이 실패해도 false(안전한 쪽).
 * ──────────────────────────────────────────────────────────────────────────── */
export async function schemaPresent(
  DB: D1Database,
  want: { tables?: string[]; indexes?: string[]; columns?: Array<{ table: string; cols: string[] }> },
): Promise<boolean> {
  // 확인은 **언제나 가까운 사본**에서 — 표·칸이 있는지는 사본 지연(1초 미만)에 영향받지 않는다
  //   (새로 생기는 표는 배포 전에 이미 생긴다). 원본(env.DB)을 받아도 여기서 세션을 연다 — 호출부가
  //   돈 경로여도 그 경로의 **데이터** 읽기는 원본 그대로이고, 이 함수는 스키마만 본다.
  const near = publicReadDb(DB)
  try {
    const names = [...(want.tables || []), ...(want.indexes || [])]
    const checks: Promise<boolean>[] = []
    if (names.length) {
      checks.push(near.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN (${names.map(() => '?').join(',')})`) // d1-bind-ok: 호출부가 상수로 적은 표·색인 이름 몇 개(≤6)뿐
        .bind(...names).first<{ n: number }>().then((r) => Number(r?.n) === names.length))
    }
    for (const c of want.columns || []) {
      if (!/^\w+$/.test(c.table) || !c.cols.every((x) => /^\w+$/.test(x))) return false
      checks.push(near.prepare(`SELECT ${c.cols.join(', ')} FROM ${c.table} LIMIT 0`).all().then(() => true, () => false))
    }
    if (checks.length === 0) return false
    return (await Promise.all(checks)).every(Boolean)
  } catch {
    return false
  }
}
