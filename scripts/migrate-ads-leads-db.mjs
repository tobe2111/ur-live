#!/usr/bin/env node
/**
 * 📣 유어애즈 발굴 리드 → 전용 D1 **이사 도구** (2026-08-19)
 *
 * ## 왜
 * 수집 리드가 결제와 같은 D1 에 쌓여 494 MB(무료 한도 500 MB의 99%)에 닿았다.
 * 실데이터의 92%가 수집분이고, 최근 7일 증가는 유어애즈 +123,368행 / 그 외 +179행이었다.
 *
 * ## 원칙 — **삭제가 아니라 이사다**
 *   ① 스키마 생성 → ② 행 복사 → ③ 행수·체크섬 대조 → ④ **확인된 뒤에만** 원본 삭제
 * ④ 는 이 스크립트가 기본으로 하지 않는다. `--purge-source --i-verified` 를 둘 다 줘야 한다.
 * ③ 이 한 건이라도 어긋나면 ④ 는 실행 자체를 거부한다.
 *
 * ## 사용
 *   node scripts/migrate-ads-leads-db.mjs --to <새-D1-uuid> --plan      # 무엇을 옮길지만 출력
 *   node scripts/migrate-ads-leads-db.mjs --to <새-D1-uuid> --schema    # ① 스키마만
 *   node scripts/migrate-ads-leads-db.mjs --to <새-D1-uuid> --copy      # ② 복사(재시작 가능)
 *   node scripts/migrate-ads-leads-db.mjs --to <새-D1-uuid> --sync      # ②-b 델타 동기(양방향)
 *   node scripts/migrate-ads-leads-db.mjs --to <새-D1-uuid> --verify    # ③ 대조
 *
 * 자격증명: `CLOUDFLARE_API_TOKEN` · `CLOUDFLARE_ACCOUNT_ID` (환경변수).
 *   ⚠️ 토큰은 **D1 Edit** 권한이 필요하다(기본 세션 토큰은 조회 전용이라 여기서 막힌다).
 *   막히면 그건 버그가 아니라 설계다 — 쓰기는 대표가 의도적으로 열어 줄 때만 돈다.
 */
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d }

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const SRC_DB = opt('from', 'd9530ba6-7a26-4c02-9295-3ce5aef112a3')  // 라이브(현재 통합 DB)
const DST_DB = opt('to')
const CHUNK = Number(opt('chunk', '500'))
/**
 * 한 INSERT 문의 최대 길이(문자).
 *
 * 🧪 실측(2026-08-19): **바이트만의 문제가 아니다.** 2컬럼 테이블은 50 KB 문장이 통과하는데
 *   `ad_influencer_leads`(약 50컬럼)는 80 KB 에서 `SQLITE_TOOBIG` 이 났다 — VALUES 목록 × 컬럼 수가
 *   파스 트리를 키우기 때문이다. 그래서 넉넉히 낮춘 30 KB 를 기본으로 둔다(40 KB 도 통과했다).
 *   ⚠️ 100 KB 는 TOOBIG 이 아니라 **rate-limit(code 971)** 이 먼저 온다 — 크게 잡을 이유가 없다.
 */
const SQL_BUDGET = Number(opt('sql-budget', '30000'))

/** 이사 대상 — 코드 SSOT(`src/shared/ads/leads-db.ts`)에서 읽는다. 두 벌로 적으면 반드시 어긋난다. */
function loadTables() {
  const src = readFileSync(new URL('../src/shared/ads/leads-db.ts', import.meta.url), 'utf8')
  const block = src.slice(src.indexOf('ADS_LEADS_TABLES = ['), src.indexOf('] as const'))
  const t = [...block.matchAll(/'([a-z_][a-z0-9_]*)'/g)].map((m) => m[1])
  if (t.length < 6) throw new Error('SSOT 파싱 실패 — leads-db.ts 형식이 바뀌었다')
  return t
}

async function q(db, sql, params) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${db}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params ? { sql, params } : { sql }),
  })
  const j = await r.json()
  if (!j.success) throw new Error(`D1: ${JSON.stringify(j.errors)?.slice(0, 300)}\n  SQL: ${sql.slice(0, 160)}`)
  return j.result.flatMap((x) => x.results || [])
}

const lit = (v) => {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'boolean') return v ? '1' : '0'
  return `'${String(v).replace(/'/g, "''")}'`
}

async function main() {
  if (!ACCOUNT || !TOKEN) { console.error('❌ CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN 이 필요하다'); process.exit(1) }
  const TABLES = loadTables()

  if (flag('plan') || !DST_DB) {
    console.log('📋 이사 대상 (SSOT: src/shared/ads/leads-db.ts)\n')
    let total = 0
    for (const t of TABLES) {
      const [{ n }] = await q(SRC_DB, `SELECT COUNT(*) n FROM "${t}"`)
      total += n
      console.log(`   ${t.padEnd(24)} ${String(n).padStart(9)}행`)
    }
    console.log(`   ${''.padEnd(24)} ${String(total).padStart(9)}행 합계`)
    if (!DST_DB) console.log('\n대상 DB 를 주면 실제 작업을 한다:  --to <uuid> --schema | --copy | --verify')
    return
  }

  // ── ① 스키마 ────────────────────────────────────────────────────────────
  if (flag('schema')) {
    for (const t of TABLES) {
      const objs = await q(SRC_DB,
        `SELECT type, sql FROM sqlite_master WHERE sql IS NOT NULL AND (name = '${t}' OR tbl_name = '${t}') ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END`)
      for (const o of objs) {
        // IF NOT EXISTS 를 넣어 재실행을 안전하게(이사는 여러 번 돌릴 수 있어야 한다)
        const sql = o.sql
          .replace(/^CREATE TABLE /i, 'CREATE TABLE IF NOT EXISTS ')
          .replace(/^CREATE (UNIQUE )?INDEX /i, (m, u) => `CREATE ${u || ''}INDEX IF NOT EXISTS `)
        await q(DST_DB, sql)
      }
      console.log(`  ✓ ${t} 스키마 ${objs.length}개 객체`)
    }
  }

  // ── ② 복사 (재시작 가능 — 대상의 max(rowid) 부터 이어서) ──────────────────
  if (flag('copy')) {
    for (const t of TABLES) {
      const cols = (await q(SRC_DB, `SELECT name FROM pragma_table_info('${t}')`)).map((c) => c.name)
      const [{ n: srcN }] = await q(SRC_DB, `SELECT COUNT(*) n FROM "${t}"`)
      let after = 0
      try { const [r] = await q(DST_DB, `SELECT COALESCE(MAX(rowid),0) m FROM "${t}"`); after = r.m } catch { /* 빈 테이블 */ }
      let done = 0
      const colList = cols.map((c) => `"${c}"`).join(',')
      for (;;) {
        const rows = await q(SRC_DB,
          `SELECT rowid AS __rid, ${colList} FROM "${t}" WHERE rowid > ${after} ORDER BY rowid LIMIT ${CHUNK}`)
        if (!rows.length) break
        // 🧱 **행 수가 아니라 바이트로 자른다.** ad_influencer_leads 는 행당 ~1 KB 라
        //   400행 INSERT 가 430 KB 가 되고 D1 이 `statement too long (SQLITE_TOOBIG)` 로 거부한다.
        //   (첫 실행이 정확히 여기서 죽었다 — 행 수 기준은 테이블마다 다른 행 폭을 못 본다.)
        let buf = []
        let bytes = 0
        const flush = async () => {
          if (!buf.length) return
          await q(DST_DB, `INSERT OR IGNORE INTO "${t}" (rowid,${colList}) VALUES ${buf.join(',')}`)
          buf = []; bytes = 0
        }
        for (const r of rows) {
          const v = `(${r.__rid},${cols.map((c) => lit(r[c])).join(',')})`
          if (bytes + v.length > SQL_BUDGET) await flush()
          buf.push(v); bytes += v.length + 1
          done++
        }
        await flush()
        after = rows[rows.length - 1].__rid
        process.stdout.write(`\r  ${t}: ${done}/${srcN}   `)
      }
      console.log(`\r  ✓ ${t}: ${done}행 복사 (원본 ${srcN})       `)
    }
  }

  // ── ②-b 동기(sync) — **양방향으로 맞춘다.** 살아 있는 원본은 복사 중에도 변한다 ──────
  //
  //   🩸 왜 필요한가(2026-08-19 실측): 복사 직후 대조가 `원본 122,742 / 사본 122,747` 로 어긋났다.
  //      **사본이 5행 더 많았다** — 정비 레인(`influencer-maintenance`)이 그 사이 저품질 리드를
  //      원본에서 지웠기 때문이다. 단순 복사는 원본의 *삭제*를 따라가지 못한다. 그대로 전환하면
  //      운영자가 지운 리드가 새 DB에서 **되살아난다.**
  //
  //   어떻게: rowid 를 10,000 단위 버킷으로 묶어 양쪽의 (개수, rowid합)을 비교하고 **다른 버킷만**
  //   실제 rowid 목록으로 내려가 좁힌다. 716,000행을 전수 대조하지 않아도 되고, 삭제가 드물수록
  //   빨라진다(버킷 하나만 다르면 그 1만개만 본다).
  if (flag('sync')) {
    const BUCKET = 10000
    for (const t of TABLES) {
      const cols = (await q(SRC_DB, `SELECT name FROM pragma_table_info('${t}')`)).map((c) => c.name)
      const colList = cols.map((c) => `"${c}"`).join(',')
      const bucketSql = `SELECT rowid/${BUCKET} AS b, COUNT(*) n, SUM(rowid) s FROM "${t}" GROUP BY b`
      const [sb, db_] = [await q(SRC_DB, bucketSql), await q(DST_DB, bucketSql)]
      const m = (rows) => new Map(rows.map((r) => [Number(r.b), `${r.n}:${r.s}`]))
      const [ms, md] = [m(sb), m(db_)]
      const diff = [...new Set([...ms.keys(), ...md.keys()])].filter((b) => ms.get(b) !== md.get(b))
      if (!diff.length) { console.log(`  ✓ ${t}: 일치 (버킷 ${ms.size}개)`); continue }
      let added = 0, removed = 0
      for (const b of diff) {
        const lo = b * BUCKET, hi = lo + BUCKET
        const ids = async (db) => new Set((await q(db,
          `SELECT rowid AS r FROM "${t}" WHERE rowid >= ${lo} AND rowid < ${hi}`)).map((x) => Number(x.r)))
        const [si, di] = [await ids(SRC_DB), await ids(DST_DB)]
        const missing = [...si].filter((x) => !di.has(x))
        const extra = [...di].filter((x) => !si.has(x))
        // 원본에 있고 사본에 없는 것 → 채운다
        for (let i = 0; i < missing.length; i += 200) {
          const part = missing.slice(i, i + 200)
          const rows = await q(SRC_DB, `SELECT rowid AS __rid, ${colList} FROM "${t}" WHERE rowid IN (${part.join(',')})`)
          let buf = [], bytes = 0
          const flush = async () => {
            if (!buf.length) return
            await q(DST_DB, `INSERT OR IGNORE INTO "${t}" (rowid,${colList}) VALUES ${buf.join(',')}`)
            buf = []; bytes = 0
          }
          for (const r of rows) {
            const v = `(${r.__rid},${cols.map((c) => lit(r[c])).join(',')})`
            if (bytes + v.length > SQL_BUDGET) await flush()
            buf.push(v); bytes += v.length + 1; added++
          }
          await flush()
        }
        // 사본에만 있는 것 → **지운다**(원본에서 정비 레인이 지운 행이 되살아나면 안 된다)
        for (let i = 0; i < extra.length; i += 400) {
          const part = extra.slice(i, i + 400)
          await q(DST_DB, `DELETE FROM "${t}" WHERE rowid IN (${part.join(',')})`)
          removed += part.length
        }
      }
      console.log(`  ↻ ${t}: 버킷 ${diff.length}개 조정 — 추가 ${added} · 제거 ${removed}`)
    }
  }

  // ── ③ 대조 — 여기서 어긋나면 삭제는 못 한다 ───────────────────────────────
  if (flag('verify') || flag('purge-source')) {
    let ok = true
    for (const t of TABLES) {
      const [a] = await q(SRC_DB, `SELECT COUNT(*) n, COALESCE(SUM(rowid),0) s, COALESCE(MIN(rowid),0) lo, COALESCE(MAX(rowid),0) hi FROM "${t}"`)
      const [b] = await q(DST_DB, `SELECT COUNT(*) n, COALESCE(SUM(rowid),0) s, COALESCE(MIN(rowid),0) lo, COALESCE(MAX(rowid),0) hi FROM "${t}"`)
      const same = a.n === b.n && a.s === b.s && a.lo === b.lo && a.hi === b.hi
      ok &&= same
      console.log(`  ${same ? '✓' : '✗'} ${t.padEnd(24)} 원본 ${a.n} / 사본 ${b.n}${same ? '' : `   ⚠️ 불일치 (rowid합 ${a.s} vs ${b.s})`}`)
    }
    if (!ok) { console.error('\n❌ 대조 실패 — 원본은 그대로 둔다. 다시 --copy 를 돌려라'); process.exit(2) }
    console.log('\n✅ 전 테이블 일치')
  }

  // ── ④ 원본 삭제 — 두 플래그를 다 줘야 한다 ────────────────────────────────
  if (flag('purge-source')) {
    if (!flag('i-verified')) {
      console.error('❌ --purge-source 는 --i-verified 와 함께여야 한다. 되돌릴 수 없다')
      process.exit(3)
    }
    for (const t of TABLES) {
      await q(SRC_DB, `DELETE FROM "${t}"`)
      console.log(`  🗑️  ${t} 원본 비움`)
    }
    console.log('\n⚠️ SQLite 는 행을 지워도 파일이 바로 안 줄어든다 — 하루 뒤 file_size 를 다시 재라.')
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
