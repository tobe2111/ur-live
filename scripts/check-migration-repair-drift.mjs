#!/usr/bin/env node
/**
 * 🛡️ 2026-06-17 (1인 운영 안전망 — 대표 요청): 마이그레이션 ↔ repair-schema drift 검사.
 *
 * 배경: 프로덕션 D1 은 마이그레이션 CI 권한이 없어 `migrations/*.sql` 가 자동 적용되지 않는다.
 *   실제로 스키마를 prod 에 반영하는 건 `src/worker/routes/repair-schema.routes.ts`(cron 자동 실행).
 *   → 누군가 `.sql` 마이그레이션만 쓰고 repair-schema 에 반영을 잊으면, 그 컬럼/테이블은
 *     prod 에 영원히 안 생겨 런타임 'no such column' 에러가 난다. (1인 운영의 조용한 사고원)
 *
 * 설계: 전체 히스토리 스캔은 노이즈가 큼(repair-schema 는 전체 미러가 아님). 그래서 **이번 커밋에
 *   STAGED 된 마이그레이션** 만 보고, 그 안의 ADD COLUMN / CREATE TABLE 가 현재 repair-schema 에
 *   반영돼 있는지(또는 repair-schema 도 같이 staged 됐는지) 확인한다 — check-guide-sync 와 동일 패턴.
 *
 * warn-only (기본 exit 0). 차단하려면 STRICT_MIGRATION_DRIFT=1.
 * 사용: node scripts/check-migration-repair-drift.mjs
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const REPAIR_REL = 'src/worker/routes/repair-schema.routes.ts';
const STRICT = process.env.STRICT_MIGRATION_DRIFT === '1';

function sh(cmd) { try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }); } catch { return ''; } }
function read(p) { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return ''; } }

// staged 된 파일 목록 (added/modified)
const staged = sh('git diff --cached --name-only --diff-filter=AM')
  .split('\n').map((s) => s.trim()).filter(Boolean);

const stagedMigrations = staged.filter((f) => /^migrations\/.*\.sql$/.test(f));
if (stagedMigrations.length === 0) {
  // 커밋에 마이그레이션 없음 → 검사 불필요 (조용히 통과)
  process.exit(0);
}

const repairStaged = staged.includes(REPAIR_REL);
const repairText = read(REPAIR_REL);

const addColRe = /ALTER\s+TABLE\s+[`"']?(\w+)[`"']?\s+ADD\s+COLUMN\s+[`"']?(\w+)[`"']?/gi;
const createTblRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?/gi;

const missing = []; // {file, kind, name}

for (const f of stagedMigrations) {
  // staged 버전 내용 (인덱스에 올라간 그대로)
  const sql = sh(`git show :${f}`) || read(f);
  let m;
  addColRe.lastIndex = 0;
  while ((m = addColRe.exec(sql))) {
    const col = m[2];
    if (!new RegExp(`\\b${col}\\b`).test(repairText)) missing.push({ file: f, kind: 'ADD COLUMN', name: `${m[1]}.${col}` });
  }
  createTblRe.lastIndex = 0;
  while ((m = createTblRe.exec(sql))) {
    const table = m[1];
    if (table.startsWith('sqlite_') || table.startsWith('_temp')) continue;
    if (!new RegExp(`\\b${table}\\b`).test(repairText)) missing.push({ file: f, kind: 'CREATE TABLE', name: table });
  }
}

if (missing.length === 0) {
  console.log(`[migration-drift] ✅ staged 마이그레이션 ${stagedMigrations.length}개 — repair-schema 반영 OK`);
  process.exit(0);
}

console.log(`\n[migration-drift] ⚠️  이번 커밋의 마이그레이션 변경이 repair-schema 에 안 보입니다.`);
console.log(`   프로덕션 D1 은 .sql 자동적용이 안 됩니다 → ${REPAIR_REL} 에 같이 반영해야 prod 에 생깁니다.\n`);
for (const x of missing) console.log(`    - [${x.kind}] ${x.name}   (${x.file})`);
if (!repairStaged) console.log(`\n   ※ 이번 커밋에 ${REPAIR_REL} 변경이 없습니다. 반영을 잊지 않았는지 확인하세요.`);
console.log(`\n   ※ 휴리스틱(이름 매칭) — 이미 반영됐거나 의도적 제외면 무시 가능.`);
console.log(`   ※ ${STRICT ? '[STRICT] 차단됨' : 'warn-only (배포 차단 안 함). 차단: STRICT_MIGRATION_DRIFT=1'}`);
process.exit(STRICT ? 1 : 0);
