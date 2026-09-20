#!/usr/bin/env node
/**
 * 🧨 **없는 컬럼을 가리키는 외래키 금지** (2026-09-19)
 *
 * ## 왜 이 가드가 있나 — 실제로 결제가 통째로 멎었다
 * `payments` 와 `tax_invoices` 가 `REFERENCES orders(order_no)` 로 선언돼 있었다.
 * **`orders.order_no` 라는 컬럼은 없다** — 진짜 이름은 `order_number` 다.
 *
 * SQLite 는 부모 컬럼이 없거나 UNIQUE 가 아닌 외래키를 *malformed* 로 보고,
 * **부모든 자식이든** 그 테이블에 DML 이 닿으면 `foreign key mismatch` 를 던진다.
 * D1 은 외래키를 켜 둔다(라이브 실측 `PRAGMA foreign_keys = 1`).
 *
 * ⇒ `INSERT INTO orders ... RETURNING id` 와 `DELETE FROM orders` 가 **전부 실패**했다.
 *   두 결제 경로가 실패를 삼키고 자동 환불해서 로그도 안 남았다(라이브 실측:
 *   `orders` 마지막 행 2026-06-26 · `vouchers` 전체 1행). 토스에는 승인만 찍혔다.
 *
 * 🔑 **핵심은 "CREATE TABLE 은 성공한다"** 는 것이다 — SQLite 는 만들 때 부모를 검사하지 않는다.
 *   그래서 오타가 배포까지 그대로 간다. 사람 눈이 아니라 기계가 봐야 하는 이유다.
 *
 * ## 어떻게 검사하나
 * 정규식으로 SQL 을 파싱하지 않는다(그 길은 이 레포가 이미 여러 번 틀렸다).
 * 레포 안의 `CREATE TABLE` 을 **진짜 SQLite 에 넣고** `PRAGMA foreign_key_list` /
 * `pragma_table_info` 로 묻는다 — 런타임과 같은 판정자를 쓴다.
 *
 * ## ⚠️ 이 가드가 못 보는 것
 *   - **라이브 DB 의 드리프트.** 레포에 없는 DDL 이 라이브에 있으면 여기선 안 보인다.
 *     그건 `ensureOrdersForeignKeysSane`(정비 레인)이 맡는다.
 *   - 부모 테이블이 이 레포 DDL 에 아예 없는 경우는 **경고만** 한다(선택 테이블일 수 있다).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { createRequire } from 'node:module'

const require_ = createRequire(import.meta.url)
let DatabaseSync
try { ({ DatabaseSync } = require_('node:sqlite')) } catch {
  console.log('⏭️  node:sqlite 없음 — 이 런타임에선 건너뜀')
  process.exit(0)
}

const ROOT = process.cwd()
const EXEMPT = /foreign-key-sanity-ok/i

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    // 🧪 테스트는 **일부러 깨진 스키마**를 픽스처로 만든다(이 가드의 재현 테스트가 그렇다).
    //   운영 DDL 은 tests 아래에 살지 않으므로 스캔 대상이 아니다.
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'tests') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (['.sql', '.ts'].includes(extname(p))) out.push(p)
  }
  return out
}

/** 파일에서 CREATE TABLE 문만 뽑는다 (괄호 균형으로 끝을 찾는다 — 정규식으로는 중첩을 못 센다). */
function extractCreateTables(text) {
  const out = []
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([A-Za-z0-9_]+)["'`]?\s*\(/gi
  let m
  while ((m = re.exec(text))) {
    let depth = 1
    let i = re.lastIndex
    while (i < text.length && depth > 0) {
      const ch = text[i]
      if (ch === '(') depth++
      else if (ch === ')') depth--
      i++
    }
    if (depth !== 0) continue
    let sql = text.slice(m.index, i)
    // TS 템플릿 리터럴 안의 ${...} 보간은 SQLite 가 못 읽는다 → 그 문장은 건너뛴다.
    if (sql.includes('${')) continue
    out.push({ table: m[1], sql })
  }
  return out
}

const files = walk(join(ROOT, 'migrations')).concat(walk(join(ROOT, 'src')))
const db = new DatabaseSync(':memory:')
const origin = new Map()
let created = 0

for (const f of files) {
  let text
  try { text = readFileSync(f, 'utf8') } catch { continue }
  if (EXEMPT.test(text)) continue
  for (const { table, sql } of extractCreateTables(text)) {
    try {
      try { db.exec(`DROP TABLE IF EXISTS "${table}"`) } catch { /* ignore */ }
      db.exec(sql.replace(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?/i, 'CREATE TABLE '))
      origin.set(table, f.replace(ROOT + '/', ''))
      created++
    } catch { /* 이 런타임이 못 읽는 DDL — 건너뛴다 */ }
  }
}

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name)
const bad = []
let fkChecked = 0

for (const t of tables) {
  let fks = []
  try { fks = db.prepare(`PRAGMA foreign_key_list("${t}")`).all() } catch { continue }
  for (const fk of fks) {
    if (fk.to === null) continue           // 부모 PK 참조 — 정상
    fkChecked++
    const parent = fk.table
    if (!tables.includes(parent)) continue // 부모가 레포 DDL 에 없음 — 판정 불가(위 주석)
    const pcols = db.prepare(`SELECT name, pk FROM pragma_table_info('${parent}')`).all()
    const names = pcols.map(c => c.name)
    if (!names.includes(fk.to)) {
      bad.push({ t, parent, to: fk.to, why: `부모 컬럼 "${fk.to}" 가 ${parent} 에 없다`, hint: names.filter(n => n.startsWith(String(fk.to).slice(0, 5))).join(', ') })
      continue
    }
    let uniq = pcols.find(c => c.name === fk.to)?.pk === 1
    if (!uniq) {
      for (const ix of db.prepare(`PRAGMA index_list("${parent}")`).all()) {
        if (!ix.unique) continue
        const cols = db.prepare(`PRAGMA index_info("${ix.name}")`).all().map(c => c.name)
        if (cols.length === 1 && cols[0] === fk.to) { uniq = true; break }
      }
    }
    if (!uniq) bad.push({ t, parent, to: fk.to, why: `부모 컬럼 "${parent}.${fk.to}" 에 UNIQUE 가 없다`, hint: '' })
  }
}

// 🛡️ 0건 검사는 "통과"가 아니라 "고장"이다 — 이 레포가 반복해 당한 클래스.
if (created < 50 || fkChecked < 10) {
  console.error(`❌ 검사 대상이 비정상적으로 적다 (테이블 ${created}, 외래키 ${fkChecked}) — 수집 경로가 깨졌다.`)
  process.exit(1)
}

if (bad.length) {
  console.error(`❌ 없는/UNIQUE 아닌 컬럼을 가리키는 외래키 ${bad.length}건 — SQLite 가 그 테이블의 DML 을 전부 거부한다:\n`)
  for (const b of bad) {
    console.error(`   ${b.t} → ${b.parent}(${b.to})`)
    console.error(`     ${b.why}${b.hint ? ` (혹시 이건가: ${b.hint})` : ''}`)
    console.error(`     정의: ${origin.get(b.t) || '?'}`)
  }
  console.error('\n   예외가 정말 필요하면 파일에 `foreign-key-sanity-ok` 주석.')
  process.exit(1)
}

console.log(`✅ 외래키 정합 OK (테이블 ${created}, 명시 부모컬럼 외래키 ${fkChecked}건)`)
