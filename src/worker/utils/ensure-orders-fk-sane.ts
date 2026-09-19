/**
 * 🧨 **주문이 하나도 안 만들어지던 진짜 이유** — 죽은 테이블의 깨진 외래키 (2026-09-19)
 *
 * 대표 신고: *"결제가 안됐대"* · *"정작 토스페이먼츠에서는 결제가 찍혀있어"*.
 *
 * ## 무슨 일이 있었나
 * `payments` 와 `tax_invoices` 가 이렇게 선언돼 있다:
 *
 * ```sql
 * FOREIGN KEY (order_id) REFERENCES orders(order_no)   -- migrations/0034
 * FOREIGN KEY (order_no) REFERENCES orders(order_no)   -- migrations/0012
 * ```
 *
 * **`orders.order_no` 라는 컬럼은 없다.** 진짜 이름은 `order_number` 다.
 *
 * SQLite 는 부모 컬럼이 없거나 UNIQUE 가 아닌 외래키를 *malformed* 로 보고,
 * **자식이든 부모든 그 테이블에 DML 이 닿는 순간** `foreign key mismatch` 를 던진다.
 * D1 은 외래키를 켜 둔다(라이브 실측 `PRAGMA foreign_keys = 1`).
 *
 * ⇒ **`INSERT INTO orders` 가 전부 실패한다.** 이용권 딜 결제도, 카드 결제도, 쇼핑도.
 *
 * ## 왜 아무도 몰랐나
 * 두 경로 모두 실패를 **삼키고 자동 환불**한다 — 사용자에겐 "일시적인 오류", 로그는
 * `console.error` 뿐이라 아무 데도 안 남는다. 라이브 실측: `orders` 마지막 행 2026-06-26,
 * `vouchers` **전체 1행**(2026-05-24), 그 사이 딜 차감→환불 왕복만 쌓였다.
 * 그리고 토스는 승인을 마쳤으므로 **대표 화면엔 결제가 찍힌다.**
 *
 * ## 이 모듈이 하는 일
 * 그 두 테이블을 **지금 스키마 그대로 다시 만들되** 부모 컬럼만 `order_number` 로 고친다.
 * 컬럼을 손으로 재구성하지 않는다 — `sqlite_master.sql` 원문을 그대로 쓰고 참조 한 군데만
 * 바꾼다(재구성하면 기본값·제약이 조용히 달라진다).
 *
 * ## ⚠️ 이 모듈이 하지 않는 것
 *   - **테이블을 지우지 않는다.** 두 테이블 다 코드 참조 0·행 0 이지만, 지우는 건 이 수리의
 *     범위가 아니다(되돌릴 수 없다).
 *   - 행을 버리지 않는다. 복사가 실패하면 batch 가 통째로 롤백되고 원본이 그대로 남는다.
 *   - 다른 깨진 외래키를 찾아다니지 않는다 — 그건 가드(`check-foreign-key-sanity`)의 일이다.
 */
import type { D1Database } from '@cloudflare/workers-types'

/** 부모 컬럼이 실재하지 않아 DML 을 막는, 알려진 깨진 참조. */
const BAD_PARENT_REF = /REFERENCES\s+"?orders"?\s*\(\s*"?order_no"?\s*\)/gi
const GOOD_PARENT_REF = 'REFERENCES orders(order_number)'

const done = new WeakSet<object>()

export interface OrdersFkRepairResult {
  /** 고친 테이블 이름들. 빈 배열이면 고칠 게 없었다(정상). */
  repaired: string[]
  /** 고쳐야 하는데 실패한 테이블 — 이게 비어 있지 않으면 결제는 여전히 막혀 있다. */
  failed: string[]
}

/**
 * `orders` 에 DML 을 막는 깨진 외래키를 찾아 고친다. 멱등 · fail-soft · isolate 당 1회.
 *
 * @param force 메모이즈를 무시하고 다시 검사한다(정비 라우트용).
 */
export async function ensureOrdersForeignKeysSane(
  DB: D1Database,
  force = false,
): Promise<OrdersFkRepairResult> {
  const out: OrdersFkRepairResult = { repaired: [], failed: [] }
  if (!force && done.has(DB as unknown as object)) return out
  done.add(DB as unknown as object)

  try {
    // 깨진 참조를 **DDL 원문으로** 찾는다. PRAGMA 로 찾으려면 테이블 327개를 전부 훑어야 한다.
    const { results } = await DB.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql LIKE '%order_no%'",
    ).all<{ name: string; sql: string }>()

    for (const row of results || []) {
      if (!row?.sql || !row.name) continue
      BAD_PARENT_REF.lastIndex = 0
      if (!BAD_PARENT_REF.test(row.sql)) continue

      const tmp = `${row.name}__fkfix`
      BAD_PARENT_REF.lastIndex = 0
      // 테이블 이름만 임시로 바꾸고 참조를 고친다. 컬럼 정의는 한 글자도 안 건드린다.
      const createTmp = row.sql
        .replace(/^\s*CREATE\s+TABLE\s+"?[A-Za-z0-9_]+"?/i, `CREATE TABLE "${tmp}"`)
        .replace(BAD_PARENT_REF, GOOD_PARENT_REF)

      // 인덱스도 같이 살린다 — 재생성 안 하면 조용히 사라진다.
      const idx = await DB.prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL",
      ).bind(row.name).all<{ sql: string }>()

      const cols = await DB.prepare(`SELECT name FROM pragma_table_info('${row.name}')`)
        .all<{ name: string }>()
      const colList = (cols.results || []).map((c) => `"${c.name}"`).join(', ')
      if (!colList) { out.failed.push(row.name); continue }

      try {
        await DB.batch([
          DB.prepare(`DROP TABLE IF EXISTS "${tmp}"`),
          DB.prepare(createTmp),
          DB.prepare(`INSERT INTO "${tmp}" (${colList}) SELECT ${colList} FROM "${row.name}"`),
          DB.prepare(`DROP TABLE "${row.name}"`),
          DB.prepare(`ALTER TABLE "${tmp}" RENAME TO "${row.name}"`),
          ...(idx.results || []).map((i) => DB.prepare(i.sql.replace(/^CREATE\s+(UNIQUE\s+)?INDEX\s+/i, (m) => `${m}IF NOT EXISTS `))),
        ])
        out.repaired.push(row.name)
      } catch (err) {
        // batch 는 원자적이라 실패해도 원본은 그대로다.
        console.error(`[ensureOrdersForeignKeysSane] ${row.name} 재빌드 실패:`, String(err).slice(0, 300))
        out.failed.push(row.name)
      }
    }
  } catch (err) {
    console.error('[ensureOrdersForeignKeysSane] 검사 실패:', String(err).slice(0, 300))
  }
  return out
}
