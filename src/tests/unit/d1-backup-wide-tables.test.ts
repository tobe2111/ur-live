/**
 * 🗄️ 주간 D1 백업이 **가장 중요한 테이블 두 개를 조용히 빼먹던** 사고 (2026-08-03)
 *
 * ## 무슨 일이 있었나
 *
 * 첫 백업 회차는 성공처럼 보였다 — 19MB 파일, 하트비트 `ok=true`, 알림 "완료".
 * 그런데 디스코드 원문에는 이 줄이 있었다:
 *
 * ```
 * - dump 실패 테이블 5개: _cf_KV, products, products_fts_config, products_fts_idx, sellers
 * ```
 *
 * **`products` 와 `sellers` 가 빠진 백업이다.** 그걸로 복구하면 상품도 셀러도 없다.
 *
 * ## 원인 — 커서 한 칸이 한도를 넘겼다
 *
 * dump 는 `SELECT rowid, * FROM t` 로 페이징했다. **D1 의 결과 컬럼 한도는 100** 이고
 * `products`·`sellers` 는 **이미 정확히 100컬럼**이다(컬럼 예산제가 존재하는 바로 그 이유).
 * ⇒ `rowid` 한 칸 = 101 = `too many columns in result set` ⇒ 그 두 테이블만 통째로 실패.
 *
 * 프로덕션 실측으로 확인: `SELECT rowid,* FROM products` 🔴 / `SELECT * FROM products` ✅.
 *
 * ## 두 번째 결함 — 관측 채널이 갈렸다
 *
 * 무결성 경고는 **디스코드에만** 갔고 반환값엔 없었다. 하트비트에는 `success=true` 만 남았고,
 * 그것만 본 세션이 **"경고 없음"이라고 대표에게 보고**했다. 침묵을 성공으로 읽은 것이다.
 * 게다가 실패해도 `return {success:false}` 라 `safeCron` 은 `ok:true` 로 기록했다.
 *
 * ## 이 테스트가 **못 막는 것**
 *
 * - 실제로 R2 에 올라간 파일의 내용. 소스 텍스트만 본다.
 * - 100컬럼을 **넘는** 테이블이 새로 생기는 경우 — `SELECT *` 자체가 한도를 넘어 이 수정으로도
 *   못 담는다. 그건 `check-products-column-budget`(예산제)이 앞단에서 막는 몫이다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.join(process.cwd(), 'src/worker/cron/d1-backup.ts')
const CODE = fs.readFileSync(SRC, 'utf8')

/** 주석을 걷어낸 실행 코드 — 사고를 설명한 문장이 판정을 흔들지 않게. */
const EXEC = CODE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .join('\n')

describe('d1-backup — 커서가 컬럼 한도를 먹지 않는다', () => {
  it('백업 소스가 존재한다 (경로가 낡으면 통과가 아니라 실패)', () => {
    expect(fs.existsSync(SRC)).toBe(true)
    expect(EXEC.length).toBeGreaterThan(500)
  })

  it('`SELECT rowid, *` 로 페이징하지 않는다', () => {
    // 이 한 칸이 products/sellers(각 100컬럼)를 백업에서 통째로 날렸다.
    expect(EXEC).not.toMatch(/SELECT\s+rowid\s*,\s*\*/i)
  })

  it('단일 INTEGER PK 를 커서로 쓴다 (컬럼 추가 0칸)', () => {
    expect(EXEC).toMatch(/integerPkOf\s*\(/)
    expect(EXEC).toMatch(/SELECT \* FROM \$\{table\} WHERE \$\{pk\} > \?/)
  })

  it('PK 없는 테이블은 rowid 를 따로 읽는다 (본문 SELECT 는 * 만)', () => {
    // rowid 조회는 1컬럼이라 한도와 무관하고, 본문은 `*` 뿐이라 100 이하로 유지된다.
    expect(EXEC).toMatch(/SELECT rowid AS __rid FROM/)
    expect(EXEC).toMatch(/SELECT \* FROM \$\{table\} WHERE rowid IN/)
  })

  it('rowid 조차 없는 파생/내부 테이블은 에러가 아니라 skip 이다', () => {
    // FTS 그림자(products_fts_idx 등)·_cf_KV — 원본에서 재생성되거나 CF 소유다.
    // 이것들을 '실패'로 세면 진짜 실패(products/sellers)가 소음에 묻힌다.
    expect(EXEC).toMatch(/skippedTables\.push\(table\)/)
  })
})

describe('d1-backup — 실패가 관측 채널 양쪽에 남는다', () => {
  it('복구 대상 테이블이 빠지면 성공으로 반환하지 않는다', () => {
    // ⚠️ `errorTables.length > 0` 문자열은 이 파일에 **두 번** 나온다(무결성 경고용 + 이 게이트).
    //    그래서 문자열 존재만 보면 게이트를 `if (false)` 로 바꿔도 초록이 뜬다 — 실제로 그랬다.
    //    ⇒ throw 를 감싸는 **그 if 의 조건**을 직접 읽는다.
    const throwIdx = EXEC.indexOf('부분 백업 — dump 실패')
    expect(throwIdx, '부분 백업 throw 가 없다').toBeGreaterThan(-1)

    const before = EXEC.slice(0, throwIdx)
    const ifIdx = before.lastIndexOf('if (')
    expect(ifIdx).toBeGreaterThan(-1)
    const condition = before.slice(ifIdx, before.indexOf('{', ifIdx) + 1)
    expect(condition, `throw 를 감싼 조건이 errorTables 를 안 본다: ${condition}`).toContain('errorTables')

    // 부분 백업이라도 업로드는 먼저 — 없는 것보단 낫다.
    const put = EXEC.indexOf('BACKUP_BUCKET.put(')
    expect(put).toBeGreaterThan(-1)
    expect(throwIdx).toBeGreaterThan(put)
  })

  it('catch 가 실패를 삼키지 않고 던진다 (safeCron 이 ok:false 를 남기도록)', () => {
    // `return { success: false }` 로 끝나면 하트비트가 ok=true 로 찍혀 실패가 성공처럼 보인다.
    expect(EXEC).not.toMatch(/return \{ success: false, error: msg \}/)
    expect(EXEC).toMatch(/throw err instanceof Error \? err : new Error\(msg\)/)
  })

  it('반환값이 테이블 수를 실어 하트비트에서 보인다', () => {
    // `success=true key=… size=…` 만으로는 "알맹이가 있었는가"를 판정할 수 없었다.
    expect(EXEC).toMatch(/tables: tableCount/)
  })
})
