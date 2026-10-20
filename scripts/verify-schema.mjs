#!/usr/bin/env node
/**
 * Schema Verification Tool
 *
 * 정적 분석 (D1 연결 안 함):
 *   1. migrations/*.sql 의 모든 CREATE TABLE / ALTER TABLE 파싱
 *   2. src/shared/db/production-schema.ts 의 인터페이스 추출
 *   3. 누락 / 불일치 / 신규 컬럼 비교
 *   4. JSON 또는 표 형태 출력
 *
 * D1 연결 검증 (옵션):
 *   --d1-check  →  현재 D1 의 sqlite_master 와 비교 (wrangler 필요)
 *
 * 사용:
 *   node scripts/verify-schema.mjs                # 표 출력
 *   node scripts/verify-schema.mjs --json         # JSON
 *   node scripts/verify-schema.mjs --table=orders # 특정 테이블만
 *
 * 작성일: 2026-04-26 (V1)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const filterTable = args.find(a => a.startsWith('--table='))?.split('=')[1];

// ── 1. migrations 파싱 ──────────────────────────────
const migrationsDir = path.join(root, 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql') && /^\d{4}_/.test(f))
  .sort();

// table_name → { columns: [{name, type, nullable, default}], from_migration: '0XXX_...' }
const expectedTables = new Map();

const CREATE_RE = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(\w+)\s*\(([\s\S]*?)\)\s*(?:WITHOUT\s+ROWID)?\s*;/gi;
const ALTER_ADD_RE = /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)\s+([\w()]+)(?:\s+([^;]+))?;/gi;

function parseColumnDefs(body) {
  // body 는 CREATE TABLE 의 ( ) 안 — 콤마로 분리하되 () 는 한 단위로
  const cols = [];
  let depth = 0;
  let buf = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      cols.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) cols.push(buf.trim());

  // 각 col 라인 파싱
  return cols
    .map(c => c.replace(/\s+/g, ' ').trim())
    .filter(c =>
      // 제약/인덱스 라인 제거 (PRIMARY KEY 컬럼 정의는 단일 토큰이므로 통과)
      !/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)\s/i.test(c)
    )
    .map(line => {
      const m = line.match(/^(\w+)\s+([A-Za-z()]+)(?:\s+(.*))?$/);
      if (!m) return null;
      const [, name, type, rest = ''] = m;
      return {
        name,
        type: type.toUpperCase(),
        nullable: !/NOT\s+NULL/i.test(rest),
        default: (rest.match(/DEFAULT\s+([^,\s]+(?:\s*\([^)]*\))?)/i) || [])[1] ?? null,
        primaryKey: /PRIMARY\s+KEY/i.test(rest),
      };
    })
    .filter(Boolean);
}

for (const file of migrationFiles) {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

  // CREATE TABLE
  for (const m of content.matchAll(CREATE_RE)) {
    const [, table, body] = m;
    if (!expectedTables.has(table)) {
      expectedTables.set(table, { columns: [], from_migration: file, alters: [] });
    }
    const cols = parseColumnDefs(body);
    const t = expectedTables.get(table);
    // CREATE 가 여러 번 나오면 (IF NOT EXISTS) 첫 번째만 권위 있음
    if (t.columns.length === 0) {
      t.columns = cols;
    }
  }

  // ALTER TABLE ADD COLUMN
  for (const m of content.matchAll(ALTER_ADD_RE)) {
    const [, table, col, type, rest = ''] = m;
    if (!expectedTables.has(table)) {
      expectedTables.set(table, { columns: [], from_migration: file, alters: [] });
    }
    const t = expectedTables.get(table);
    t.columns.push({
      name: col,
      type: type.toUpperCase(),
      nullable: !/NOT\s+NULL/i.test(rest),
      default: (rest.match(/DEFAULT\s+([^,\s]+(?:\s*\([^)]*\))?)/i) || [])[1] ?? null,
      primaryKey: false,
      from_alter: file,
    });
    t.alters.push({ migration: file, column: col });
  }
}

// ── 2. production-schema.ts 파싱 ────────────────────
const schemaPath = path.join(root, 'src/shared/db/production-schema.ts');
const schemaText = fs.readFileSync(schemaPath, 'utf-8');

// export interface OrdersTable { ... } 패턴
const INTERFACE_RE = /export\s+interface\s+(\w+Table)\s*\{([\s\S]*?)^\}/gm;
const documentedTables = new Map();

// 인터페이스명 → 테이블명 (Table 접미사 제거 + snake_case)
// OrdersTable → orders, OrderRefundHistoryTable → order_refund_history
const guessTableName = (iface) => {
  const stripped = iface.replace(/Table$/, '');  // Orders / OrderRefundHistory
  // snake_case 변환
  return stripped.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
};

for (const m of schemaText.matchAll(INTERFACE_RE)) {
  const [, ifaceName, body] = m;
  // 주석 형태로 명시된 테이블명 찾기 (예: "// 테이블: orders")
  const tableHint = (body.match(/\/\/\s*(?:테이블|Table):\s*(\w+)/i) || [])[1];
  const tableName = tableHint || guessTableName(ifaceName);

  const cols = body.split('\n')
    .map(l => l.replace(/\/\/.*$/, '').trim())
    .filter(l => l && /^\w+\??\s*:/.test(l))
    .map(l => {
      const m = l.match(/^(\w+)(\?)?\s*:\s*([^;]+);?/);
      if (!m) return null;
      const [, name, optional, type] = m;
      return { name, type: type.trim(), nullable: !!optional || /\|\s*null/.test(type) };
    })
    .filter(Boolean);

  documentedTables.set(tableName, { interface: ifaceName, columns: cols });
}

// ── 3. 비교 ──────────────────────────────────────
function diffTables() {
  const allTables = new Set([...expectedTables.keys(), ...documentedTables.keys()]);
  const result = [];

  for (const tbl of allTables) {
    if (filterTable && tbl !== filterTable) continue;

    const fromMigration = expectedTables.get(tbl);
    const fromDoc = documentedTables.get(tbl);

    if (!fromMigration && fromDoc) {
      result.push({
        table: tbl,
        status: 'missing_migration',
        message: `production-schema.ts 에는 있지만 migrations 에서 CREATE TABLE 없음`,
        documented_columns: fromDoc.columns.length,
      });
      continue;
    }
    if (fromMigration && !fromDoc) {
      result.push({
        table: tbl,
        status: 'undocumented',
        message: `migrations 에는 있지만 production-schema.ts 에 인터페이스 없음`,
        from_migration: fromMigration.from_migration,
        migration_columns: fromMigration.columns.length,
        column_names: fromMigration.columns.map(c => c.name),
      });
      continue;
    }

    // 둘 다 있음 — 컬럼 비교
    const migCols = new Set(fromMigration.columns.map(c => c.name));
    const docCols = new Set(fromDoc.columns.map(c => c.name));
    const onlyInMig = [...migCols].filter(c => !docCols.has(c));
    const onlyInDoc = [...docCols].filter(c => !migCols.has(c));

    if (onlyInMig.length === 0 && onlyInDoc.length === 0) {
      result.push({
        table: tbl,
        status: 'aligned',
        column_count: migCols.size,
      });
    } else {
      result.push({
        table: tbl,
        status: 'drift',
        only_in_migration: onlyInMig,
        only_in_doc: onlyInDoc,
        migration_count: migCols.size,
        doc_count: docCols.size,
      });
    }
  }

  return result;
}

const results = diffTables();
const summary = {
  total_migration_tables: expectedTables.size,
  total_documented_tables: documentedTables.size,
  aligned: results.filter(r => r.status === 'aligned').length,
  drift: results.filter(r => r.status === 'drift').length,
  undocumented: results.filter(r => r.status === 'undocumented').length,
  missing_migration: results.filter(r => r.status === 'missing_migration').length,
};

if (jsonMode) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    migrations_scanned: migrationFiles.length,
    summary,
    tables: results,
  }, null, 2));
} else {
  console.log('\n📋 Schema Verification\n');
  console.log(`Migrations scanned:     ${migrationFiles.length}`);
  console.log(`Migration tables:       ${summary.total_migration_tables}`);
  console.log(`Documented (TS) tables: ${summary.total_documented_tables}`);
  console.log('');
  console.log(`✅ aligned:           ${summary.aligned}`);
  console.log(`⚠️  drift:            ${summary.drift}`);
  console.log(`📝 undocumented:      ${summary.undocumented}  (migrations 에만 있음)`);
  console.log(`❌ missing migration: ${summary.missing_migration}  (TS 에만 있음)`);

  console.log('\n' + '─'.repeat(80));

  for (const r of results) {
    if (r.status === 'aligned' && !filterTable) continue;

    const icon = { aligned: '✅', drift: '⚠️ ', undocumented: '📝', missing_migration: '❌' }[r.status];
    console.log(`\n${icon} ${r.table}`);

    if (r.status === 'drift') {
      if (r.only_in_migration?.length) {
        console.log(`   migrations 에만: ${r.only_in_migration.join(', ')}`);
      }
      if (r.only_in_doc?.length) {
        console.log(`   TS 에만:        ${r.only_in_doc.join(', ')}`);
      }
    } else if (r.status === 'undocumented') {
      console.log(`   from: ${r.from_migration}`);
      console.log(`   columns (${r.migration_columns}): ${r.column_names?.slice(0, 6).join(', ')}${(r.column_names?.length || 0) > 6 ? '...' : ''}`);
    } else if (r.status === 'missing_migration') {
      console.log(`   ⚠️  ${r.message}`);
    }
  }

  console.log('\n💡 사용 팁:');
  console.log('   - drift: production-schema.ts 와 migrations 동기화 필요');
  console.log('   - undocumented: TS 인터페이스 추가 권장 (대부분 신규 테이블)');
  console.log('   - missing_migration: 누락된 CREATE TABLE 마이그레이션 추가 필요 (또는 인터페이스 삭제)');
  console.log('\n옵션:');
  console.log('   --json        — JSON 출력');
  console.log('   --table=NAME  — 특정 테이블만');
}

// 종료 코드: drift 또는 missing_migration 있으면 1
if (summary.drift > 0 || summary.missing_migration > 0) {
  process.exit(1);
}
