#!/usr/bin/env node
/**
 * 🗄️ 2026-11-02 — 라이브 D1 의 **실제** 테이블·컬럼을 레포에 사진으로 남긴다.
 *
 * ## 왜 필요한가 (대표 — *"왜 망가지는거야? 안망가지게 할 수 없어?"*)
 *
 * 컬럼 가드(`check-sql-column-exists.mjs`)는 **마이그레이션·repair-schema 에 적힌 CREATE TABLE 을 전부 합쳐**
 * "그 컬럼이 어딘가에 정의돼 있는가" 를 봤다. 그런데 이 레포엔 **같은 테이블의 정의가 서로 다르게 여러 벌**
 * 있다(D1 마이그레이션이 CI 에서 안 돌아 라이브와 레포가 갈라진다 — TECHNICAL_DEBT 🔴). 실측:
 * `search_logs` 는 0111 이 `query`·`result_count`, 0273·repair-schema 가 `search_query`·`results_count` 로
 * 정의했고, 라이브는 **앞쪽**이었다. 가드는 둘을 합쳐 봤으니 틀린 쪽으로 쓴 코드도 통과했다 →
 * INSERT 가 몇 달 동안 매번 실패했고 catch 가 삼켜 **검색 기록이 0행**이었다.
 *
 * ⇒ "어딘가에 적혀 있다" 가 아니라 **"라이브에 실제로 있다"** 를 기준으로 삼아야 한다. 이 스크립트가
 *   그 기준을 만든다: 라이브 D1 세 개(메인·ads 리드·ads 업체)의 `pragma_table_info` 를 떠서
 *   `src/shared/db/live-schema.snapshot.json` 에 쓴다. 가드는 이 파일에 **있는 테이블**에 대해서는
 *   이 파일만 믿는다.
 *
 * ## 언제 돌리나
 *   - 라이브에 테이블/컬럼을 더한 뒤(repair-schema 실행 후) — 안 돌리면 새 컬럼을 쓰는 코드가 가드에 걸린다.
 *     그게 의도다: "라이브에 정말 들어갔는가" 를 사람이 한 번 확인하게 만든다.
 *   - 자격: `CLOUDFLARE_API_TOKEN` · `CLOUDFLARE_ACCOUNT_ID` (CLAUDE.md "Cloudflare API 접근" 절 — D1 Read).
 *
 *   node scripts/snapshot-live-schema.mjs
 *   node scripts/snapshot-live-schema.mjs --check   # 쓰지 않고 사진과 라이브를 비교만 — 다르면 exit 1
 *
 * 🔁 `--check` 는 `live-contracts.yml` 이 **매주** 돌린다(2026-11-02 대표 *"모두 다 해줘"*). 사진은 사람이
 *   다시 찍어야 갱신되는데, 안 찍으면 조용히 낡는다 — 라이브에서 컬럼이 빠졌는데 사진엔 남아 있으면
 *   그 컬럼을 쓰는 코드가 가드를 통과해 버린다(가드가 지키는 척). 그 낡음을 기계가 매주 잡는다.
 *
 * 🔒 읽기 전용이다(`pragma_table_info` SELECT 하나). 값은 하나도 안 가져오고 이름만 가져온다.
 */
import { writeFileSync, readFileSync } from 'node:fs'

const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
if (!TOKEN || !ACCOUNT) {
  console.error('❌ CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID 가 없다 — CLAUDE.md "Cloudflare API 접근" 절의 취득 절차를 따를 것.')
  process.exit(2)
}

// 라이브 D1 셋 (wrangler.toml · wrangler-ads.toml 의 database_id). 이름으로 고르지 않는다(CLAUDE.md).
const DBS = {
  main: 'd9530ba6-7a26-4c02-9295-3ce5aef112a3',
  ads_leads: 'd4630482-b97e-4e96-bb96-abde4ef8cc95',
  ads_company: '0e9a8f82-32fb-4584-878c-cdaec6c0aff0',
}

// `_cf_*`(Cloudflare 내부)·`sqlite_*` 는 pragma 권한이 없고(SQLITE_AUTH), FTS 그림자 테이블은 코드가 안 쓴다.
const SQL = `SELECT m.name AS t, p.name AS c FROM sqlite_master m JOIN pragma_table_info(m.name) p
  WHERE m.type = 'table' AND m.name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND m.name NOT LIKE 'sqlite_%'
    AND m.name NOT LIKE '%\\_fts%' ESCAPE '\\'
  ORDER BY m.name, p.cid`

async function columnsOf(uuid) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${uuid}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: SQL }),
  })
  const body = await res.json()
  if (!body.success) throw new Error(`D1 ${uuid}: ${JSON.stringify(body.errors)}`)
  /** @type {Record<string, string[]>} */
  const out = {}
  for (const { t, c } of body.result[0].results) (out[t] ||= []).push(c)
  return out
}

const tables = {}
for (const [name, uuid] of Object.entries(DBS)) {
  const cols = await columnsOf(uuid)
  // 🩸 0 이면 저장하지 않는다 — 권한·쿼리 오류로 빈 사진을 찍으면 가드가 "테이블 없음" 으로 오판하는 대신
  //   "사진에 없는 테이블 = 옛 기준" 으로 조용히 물러난다(그건 지키는 척이다).
  //   하한은 DB 마다 다르다(실측 2026-11-02: 메인 382 · ads 리드 6 · ads 업체 2).
  const min = name === 'main' ? 100 : 1
  if (Object.keys(cols).length < min) throw new Error(`D1 ${name}: 테이블이 ${Object.keys(cols).length}개뿐 — 사진이 비었다`)
  for (const [t, cs] of Object.entries(cols)) {
    // 같은 이름이 여러 DB 에 있으면 합친다(ads 리드는 메인에 옛 사본이 있다 — 어느 쪽 코드가 쓰든 통과해야 한다).
    tables[t] = [...new Set([...(tables[t] || []), ...cs])]
  }
  console.log(`  ${name}: 테이블 ${Object.keys(cols).length}개`)
}

const sorted = Object.fromEntries(Object.keys(tables).sort().map((t) => [t, tables[t].join(',')]))
const file = 'src/shared/db/live-schema.snapshot.json'

if (process.argv.includes('--check')) {
  const saved = JSON.parse(readFileSync(file, 'utf8')).tables
  const lines = []
  const cols = (v) => new Set(String(v || '').split(',').filter(Boolean))
  for (const t of new Set([...Object.keys(saved), ...Object.keys(sorted)])) {
    const was = cols(saved[t]); const now = cols(sorted[t])
    if (!saved[t]) { lines.push(`  + 표 ${t} (라이브에 새로 생김 — 사진에 없음)`); continue }
    if (!sorted[t]) { lines.push(`  🔴 표 ${t} (사진엔 있는데 라이브에 없음 — 그 표를 쓰는 코드가 가드를 통과해 버린다)`); continue }
    for (const c of was) if (!now.has(c)) lines.push(`  🔴 ${t}.${c} (사진엔 있는데 라이브에 없음)`)
    for (const c of now) if (!was.has(c)) lines.push(`  + ${t}.${c} (라이브에 새로 생김)`)
  }
  if (lines.length) {
    console.error(`❌ 라이브 컬럼 사진이 낡았다 (${lines.length}건 — 사진 ${saved && Object.keys(saved).length}표 · 라이브 ${Object.keys(sorted).length}표):`)
    console.error(lines.join('\n'))
    console.error('\n   → 세션에서 `node scripts/snapshot-live-schema.mjs` 로 다시 찍고, `node scripts/check-sql-column-exists.mjs -s` 를 돌려 커밋할 것.')
    process.exit(1)
  }
  console.log(`✅ 라이브 컬럼 사진 최신 — ${Object.keys(sorted).length}표 일치`)
  process.exit(0)
}
writeFileSync(file, JSON.stringify({
  _readme: '라이브 D1 의 실제 테이블·컬럼(이름만). 손으로 고치지 말 것 — node scripts/snapshot-live-schema.mjs 로 다시 찍는다.',
  generatedAt: new Date().toISOString().slice(0, 10),
  tables: sorted,
}, null, 1) + '\n')
console.log(`✅ ${file} — 테이블 ${Object.keys(sorted).length}개`)
