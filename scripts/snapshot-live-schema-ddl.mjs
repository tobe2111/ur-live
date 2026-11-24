#!/usr/bin/env node
/**
 * 🗄️ 2026-11-25 — 라이브 메인 D1 의 **표·인덱스 만드는 문장(DDL)** 을 레포에 사진으로 남긴다.
 *
 * ## 왜
 * `snapshot-live-schema.mjs` 는 이름(표·열)만 찍는다. 그걸로는 "이 INSERT 가 라이브에서 실제로 들어가는가" 를
 * 못 본다 — NOT NULL · UNIQUE · 기본값이 빠져 있기 때문이다. 2026-11-25 실측: 숙박권(먼저 판매) 예약은
 * `stay_bookings.check_in_date` 가 라이브에서 NOT NULL 인데 코드가 NULL 을 넣어 **한 번도 살 수 없었다**(500).
 * 열 이름은 맞으니 이름 가드는 통과했고, 그 흐름을 돌려 본 시험이 없었다.
 * ⇒ 이 사진으로 sqlite 를 세워 **실제 라우트를 끝까지 돌리는 시험**(`stay-full-flow-*.test.ts`)이 쓴다.
 *
 * ## 무엇을 찍나 / 안 찍나
 * 메인 D1 의 표(`CREATE TABLE`)와 인덱스만. 값은 하나도 안 가져온다. FTS 가상 표·그 그림자 표·트리거·뷰·
 * Cloudflare 내부 표는 뺀다(시험이 안 쓰고, 확장 모듈이 없으면 못 만든다).
 *
 *   node scripts/snapshot-live-schema-ddl.mjs      # 자격: CLOUDFLARE_API_TOKEN · CLOUDFLARE_ACCOUNT_ID (D1 Read)
 *
 * 🔒 읽기 전용이다(`sqlite_master` SELECT 하나).
 */
import { writeFileSync } from 'node:fs'

const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
if (!TOKEN || !ACCOUNT) {
  console.error('❌ CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID 가 없다 — CLAUDE.md "Cloudflare API 접근" 절의 취득 절차를 따를 것.')
  process.exit(2)
}
const MAIN = 'd9530ba6-7a26-4c02-9295-3ce5aef112a3'
const OUT = 'src/tests/fixtures/live-main-ddl.json'

const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${MAIN}/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql: "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('table','index') ORDER BY type DESC, name" }),
})
const body = await res.json()
if (!body.success) { console.error('❌ 조회 실패', JSON.stringify(body.errors)); process.exit(1) }
const rows = body.result[0].results
const skip = (n) => /^_cf_|^sqlite_|_fts(_|$)/i.test(n)
const tables = rows.filter((r) => r.type === 'table' && !skip(r.name) && !/^CREATE VIRTUAL TABLE/i.test(r.sql))
const names = new Set(tables.map((t) => t.name))
const indexes = rows.filter((r) => r.type === 'index' && names.has(r.tbl_name))
const squeeze = (sql) => sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim()
const out = {
  _readme: '라이브 메인 D1 의 표·인덱스 DDL(값 없음). 손으로 고치지 말 것 — node scripts/snapshot-live-schema-ddl.mjs 로 다시 찍는다.',
  generatedAt: new Date().toISOString().slice(0, 10),
  tables: tables.map((t) => squeeze(t.sql)),
  indexes: indexes.map((i) => squeeze(i.sql)),
}
writeFileSync(OUT, JSON.stringify(out, null, 0).replace(/","/g, '",\n"') + '\n')
console.log(`✅ ${OUT} — 표 ${out.tables.length}개 · 인덱스 ${out.indexes.length}개`)
