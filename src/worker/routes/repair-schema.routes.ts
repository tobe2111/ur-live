/**
 * Schema Repair Routes (admin only)
 *
 * GET /api/_internal/repair-schema
 *
 * 🩹 Self-healing schema repair (idempotent, 재실행 안전)
 * 2026-04-22: D1 migration runner CI/CD 권한 부재 우회용.
 * 모든 ALTER TABLE 은 IF EXISTS / catch 처리 — 이미 있으면 무해 무동작.
 * 운영자가 한 번 호출하면 누락된 컬럼이 자동 추가됨.
 *
 * Migration 버전 추적 — 매 호출 시 _migration_history 에 기록.
 * CI 에서 D1 권한 받으면 정식 migration runner 로 전환하고 이 endpoint 는 deprecate.
 *
 * 🛡️ 2026-04-27: TD-006 Phase E — worker/index.ts 인라인 핸들러 분리.
 */
import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';
import { requireAdmin } from '../middleware/auth';
import { swallow } from '@/shared/utils/swallow';
import { ensureAdminsRoleUnconstrained } from '@/worker/utils/ensure-admins-role';
// 컬럼 ALTER 목록은 데이터라 분리했다 — 이 파일은 *실행 로직*만 갖는다(2026-08-01).
import { COLUMN_REPAIRS, type ColumnRepair } from './repair-schema/column-repairs';
import { ADMIN_REPAIRS } from './repair-schema/admin-tables';
import { INDEX_REPAIRS } from './repair-schema/index-repairs';
// 보조 테이블 정의도 데이터라 분리했다(2026-09-07) — 이 파일은 실행 로직만 갖는다는 위 원칙 그대로.
import { AUX_TABLE_REPAIRS } from './repair-schema/aux-tables';

const repairSchemaRoutes = new Hono<{ Bindings: Env }>();

async function ensureMigrationTrackingTable(DB: D1Database) {
  if (_done_ensureMigrationTrackingTable.has(DB)) return
  _done_ensureMigrationTrackingTable.add(DB)
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS _migration_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details TEXT,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run().catch(swallow('repair-schema:migration-history'));
}

// 🛡️ 2026-05-20: runSchemaRepair 를 standalone export — cron 에서 직접 호출 가능 (자동화).
//   기존: HTTP 핸들러 안에 모든 로직 인라인. cron 이 부르려면 어드민 토큰 필요해 불편.
//   변경: pure async fn 으로 추출 → 핸들러는 thin wrapper, cron 은 직접 invoke.
export type SchemaRepairResult = {
  columns: Array<{ desc: string; status: 'added' | 'exists' | 'error'; error?: string }>
  tables: Array<{ name: string; status: 'ok' | 'error'; error?: string }>
  /** 🛡️ 2026-06-10: D1 결과셋 컬럼 한도(100) 사전 경보 — 85 이상이면 column_warnings 에 표시. */
  column_counts?: Record<string, number>
  column_warnings?: string[]
}

export async function runSchemaRepair(DB: D1Database): Promise<SchemaRepairResult> {
  await ensureMigrationTrackingTable(DB);

  const stmts: ColumnRepair[] = COLUMN_REPAIRS;

  const results: Array<{ desc: string; status: 'added' | 'exists' | 'error'; error?: string }> = [];
  // 🛡️ 2026-06-10 (no such table 8건 fix): 컬럼 ALTER 가 CREATE TABLE(아래 tables 루프)보다 먼저 돌아
  //   fresh 테이블(wholesale_banners 등)의 mall_id ALTER 가 실패하던 순서 버그 → 테이블 생성 후 실행.
  //   requiresTable 가드: 생성 루트가 없는 선택 테이블(라이브 등)은 부재 시 조용히 스킵('exists' 표기).
  const runColumnSteps = async () => {
    let existingTables: Set<string> | null = null;
    try {
      const r = await DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      existingTables = new Set(((r.results || []) as Array<{ name: string }>).map((t) => t.name));
    } catch { /* 조회 실패 시 가드 비활성 — 기존 동작 */ }
    for (const { desc, sql, requiresTable } of stmts) {
      if (requiresTable && existingTables && !existingTables.has(requiresTable)) {
        results.push({ desc, status: 'exists' }); // 미사용 기능 테이블 부재 — 스킵
        continue;
      }
      try {
        await DB.prepare(sql).run();
        results.push({ desc, status: 'added' });
      } catch (e: any) {
        const msg = String(e?.message || e);
        // 🛡️ 2026-06-18 (대표 신고 — 67 오류): 둘 다 비-실패(non-actionable) → 'exists' 로.
        //   · duplicate column / already exists = 이미 있음.
        //   · too many columns on sqlite_altertab_X = 그 테이블(예: sellers)이 SQLite 컬럼 한도 도달 →
        //     ALTER ADD 자체가 불가. 한도 도달 전 추가된 컬럼은 이미 존재(commission_rate 등도 같은 에러),
        //     아직 없는 컬럼은 ALTER 로는 못 넣음(한도) → 어느 쪽이든 이 루프에서 할 수 있는 게 없음.
        if (/duplicate column|already exists|too many columns/i.test(msg)) {
          results.push({ desc, status: 'exists' });
        } else {
          results.push({ desc, status: 'error', error: msg.slice(0, 200) });
        }
      }
    }
  };

  // 부수적: 자주 사용되는 보조 테이블 보장 (static code audit 확장)
  // 🗂️ 보조 테이블(데이터) + 어드민 테이블 + 인덱스를 **여기서 합친다** — 합성은 실행 로직이라
  //   데이터 파일에 두지 않는다(그러면 모듈이 서로를 끌어와 순환이 되고 실행 순서 의미도 흐려진다).
  const tables: Array<{ name: string; sql: string }> = [
    ...AUX_TABLE_REPAIRS,
    ...ADMIN_REPAIRS,
    ...INDEX_REPAIRS, // 📉 읽기 증폭 인덱스 — 근거(실측 행 수)는 그 모듈에
  ];
  const tableResults: Array<{ name: string; status: 'ok' | 'error'; error?: string }> = [];
  for (const { name, sql } of tables) {
    try {
      await DB.prepare(sql).run();
      tableResults.push({ name, status: 'ok' });
    } catch (e: any) {
      const msg = String(e?.message || e);
      // 🛡️ 2026-06-18: 이미 있는 컬럼(duplicate)·한도 도달(too many columns)은 비-실패(이 단계 무동작 가능).
      if (/duplicate column|already exists|too many columns/i.test(msg)) {
        tableResults.push({ name, status: 'ok' });
      } else {
        tableResults.push({ name, status: 'error', error: msg.slice(0, 200) });
      }
    }
  }

  // 🛡️ 2026-06-10: 테이블 보장 후 컬럼/인덱스/백필 실행 (위 runColumnSteps 참조).
  await runColumnSteps();

  // 🛠️ 2026-06-17: admins.role 옛 CHECK(role IN ('admin','super_admin')) 가 제한역할(ops/cs/finance/
  //   viewer/wholesale) 생성을 막아 "새 관리자 추가 500" → 제약 있으면 안전 재빌드(원자 batch, 멱등).
  try {
    const adminsRole = await ensureAdminsRoleUnconstrained(DB);
    results.push({ desc: 'admins.role CHECK 재빌드', status: adminsRole === 'rebuilt' ? 'added' : adminsRole === 'error' ? 'error' : 'exists' });
  } catch (e) {
    results.push({ desc: 'admins.role CHECK 재빌드', status: 'error', error: String(e).slice(0, 200) });
  }

  // 🏭 2026-06-07: operation_guides CHECK 제약 확장 — guide_type 에 'wholesale' 추가.
  //   기존 프로덕션 테이블은 CHECK(guide_type IN ('admin','seller','agency')) 라서
  //   'wholesale' INSERT 가 거부됨. 표(컬럼/sql.text) 검사 후 'wholesale' 가
  //   미포함일 때만 테이블 재생성(rows 보존). 멱등 — 이미 포함이면 no-op.
  //   ※ 위 tables 루프가 fresh DB 에 신규 CHECK 로 테이블을 만들므로, 여기선
  //     이미 존재하는 구버전 테이블만 마이그레이션 대상.
  try {
    const meta = await DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='operation_guides'"
    ).first<{ sql: string }>();
    const ddl = meta?.sql || '';
    // CHECK 절이 있고 'wholesale' 가 빠진 경우에만 재생성.
    if (ddl && /guide_type/i.test(ddl) && /CHECK/i.test(ddl) && !/wholesale/i.test(ddl)) {
      // 외래키 없음(독립 테이블) → 안전하게 rename → 신규 생성 → copy → drop.
      await DB.prepare("ALTER TABLE operation_guides RENAME TO operation_guides_old").run();
      await DB.prepare(`CREATE TABLE operation_guides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guide_type TEXT NOT NULL CHECK(guide_type IN ('admin', 'seller', 'agency', 'wholesale')),
        section_key TEXT NOT NULL,
        section_icon TEXT,
        section_title TEXT NOT NULL,
        section_order INTEGER DEFAULT 0,
        content_md TEXT NOT NULL,
        manually_edited INTEGER DEFAULT 0,
        updated_by INTEGER,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(guide_type, section_key)
      )`).run();
      // manually_edited 는 위 runColumnSteps 의 ALTER 가 old 테이블에 이미 추가함(같은 repair 실행 내 선행) → 보존 copy.
      await DB.prepare(`INSERT INTO operation_guides
        (id, guide_type, section_key, section_icon, section_title, section_order, content_md, manually_edited, updated_by, updated_at)
        SELECT id, guide_type, section_key, section_icon, section_title, section_order, content_md, COALESCE(manually_edited, 0), updated_by, updated_at
        FROM operation_guides_old`).run();
      await DB.prepare("DROP TABLE operation_guides_old").run();
      tableResults.push({ name: 'operation_guides:check-migration', status: 'ok' });
    }
  } catch (e: any) {
    tableResults.push({ name: 'operation_guides:check-migration', status: 'error', error: String(e?.message || e).slice(0, 200) });
  }

  // 🔔 2026-07-01: 알림 기본 테이블 보장(canonical). 이전엔 repair-schema 에 인덱스만 있고
  //   CREATE TABLE 이 없어, 마이그레이션(CI 미작동) 또는 lazy 인라인 생성에만 의존했음(fresh/
  //   repaired DB 에서 push_subscriptions 부재 → 웹푸시 전면 no-op 등의 리스크). 특히
  //   notifications.user_type 을 NOT NULL DEFAULT 'user' 로 통일 — user_type 없이 INSERT 하는
  //   소비자 알림이 조용히 실패하지 않게 함. 모두 IF NOT EXISTS(기존 테이블 불변).
  for (const t of [
    { name: 'notifications', sql: `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        user_type TEXT NOT NULL DEFAULT 'user',
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME
      )` },
    { name: 'user_notifications', sql: `CREATE TABLE IF NOT EXISTS user_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
    { name: 'agency_notifications', sql: `CREATE TABLE IF NOT EXISTS agency_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
    { name: 'push_subscriptions', sql: `CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        user_type TEXT NOT NULL DEFAULT 'user',
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
  ]) {
    try {
      await DB.prepare(t.sql).run();
      tableResults.push({ name: `${t.name}:ensure`, status: 'ok' });
    } catch (e: any) {
      tableResults.push({ name: `${t.name}:ensure`, status: 'error', error: String(e?.message || e).slice(0, 200) });
    }
  }

  // 🏭 2026-06-12: dashboard_notifications CHECK 제약 확장 — recipient_type 에 'supplier' 추가.
  //   기존 프로덕션 테이블은 CHECK(IN ('admin','seller','agency')) 라서 제조사 알림(출금 승인/반려,
  //   신규 도매주문) INSERT 가 무음 실패하던 사고 수정. operation_guides CHECK 마이그레이션과 동일
  //   패턴(rename → 신규 CHECK 로 생성 → copy → drop). 멱등 — 이미 'supplier' 포함이면 no-op.
  try {
    const meta = await DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='dashboard_notifications'"
    ).first<{ sql: string }>();
    const ddl = meta?.sql || '';
    if (ddl && /recipient_type/i.test(ddl) && /CHECK/i.test(ddl) && !/supplier/i.test(ddl)) {
      await DB.prepare("ALTER TABLE dashboard_notifications RENAME TO dashboard_notifications_old").run();
      await DB.prepare(`CREATE TABLE dashboard_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient_type TEXT NOT NULL CHECK (recipient_type IN ('admin', 'seller', 'agency', 'supplier')),
        recipient_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now'))
      )`).run();
      await DB.prepare(`INSERT INTO dashboard_notifications
        (id, recipient_type, recipient_id, type, title, message, link, is_read, created_at)
        SELECT id, recipient_type, recipient_id, type, title, message, link, is_read, created_at
        FROM dashboard_notifications_old`).run();
      await DB.prepare("DROP TABLE dashboard_notifications_old").run();
      await DB.prepare(
        "CREATE INDEX IF NOT EXISTS idx_dash_notif_recipient ON dashboard_notifications(recipient_type, recipient_id, is_read, created_at)"
      ).run();
      tableResults.push({ name: 'dashboard_notifications:check-migration', status: 'ok' });
    }
  } catch (e: any) {
    tableResults.push({ name: 'dashboard_notifications:check-migration', status: 'error', error: String(e?.message || e).slice(0, 200) });
  }

  // 🛡️ 2026-06-10 (교환권 500 사고 — D1 'too many columns in result set' 한도 100):
  //   넓은 테이블의 컬럼 수를 매 실행 보고 + 85 이상이면 경보. 한도 도달 전에 컬럼 다이어트/
  //   사이드테이블 분리를 결정할 수 있게 하는 조기 경보선. star-select 는 CI 가 별도 차단.
  const columnCounts: Record<string, number> = {};
  const columnWarnings: string[] = [];
  for (const tbl of ['products', 'users', 'sellers', 'orders', 'suppliers']) {
    try {
      const row = await DB.prepare(`SELECT COUNT(*) AS c FROM pragma_table_info('${tbl}')`).first<{ c: number }>();
      const cnt = Number(row?.c || 0);
      columnCounts[tbl] = cnt;
      if (cnt >= 85) columnWarnings.push(`⚠️ ${tbl} 컬럼 ${cnt}개 — D1 결과셋 한도(100) 임박. 컬럼 분리(사이드테이블) 검토 필요`);
    } catch { /* 테이블 없으면 skip */ }
  }

  return { columns: results, tables: tableResults, column_counts: columnCounts, column_warnings: columnWarnings };
}

// 🛡️ 2026-06-10 (드리프트 창 제거): 배포 파이프라인용 자동 트리거 — secret 헤더 인증.
//   "코드는 배포됐는데 스키마는 수동 버튼 대기" 가 '없던 에러' 류(no such column 등)의 구조적 원인.
//   REPAIR_SCHEMA_TOKEN(Cloudflare Variables) 미설정 시 403 fail-closed — 기존 admin 경로 불변.
repairSchemaRoutes.post('/api/_internal/repair-schema/auto', async (c) => {
  const expected = (c.env as { REPAIR_SCHEMA_TOKEN?: string }).REPAIR_SCHEMA_TOKEN
  const got = c.req.header('X-Repair-Token') || ''
  if (!expected || got !== expected) return c.json({ success: false, error: 'unauthorized' }, 403)
  const DB = (c.env as { DB?: D1Database }).DB
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500)
  const result = await runSchemaRepair(DB)
  const errs = result.columns.filter((r) => r.status === 'error').length
  return c.json({ success: true, errors: errs, warnings: result.column_warnings || [], counts: result.column_counts || {} })
})

// 🛡️ 2026-06-17 보안 PIN 잠금 복구(무로그인) — REPAIR_SCHEMA_TOKEN 인증. PIN 분실로 로그인 불가 시
//   CF env 토큰으로 해당 계정 PIN 해제(로그인 불가 상태에서도 복구). 해제 후 다음 로그인 시 재설정(must_set_pin).
repairSchemaRoutes.post('/api/_internal/reset-pin-token', async (c) => {
  const expected = (c.env as { REPAIR_SCHEMA_TOKEN?: string }).REPAIR_SCHEMA_TOKEN
  const got = c.req.header('X-Repair-Token') || ''
  if (!expected || got !== expected) return c.json({ success: false, error: 'unauthorized' }, 403)
  const DB = (c.env as { DB?: D1Database }).DB
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500)
  let email = ''
  try { const b = await c.req.json<{ email?: string }>(); email = String(b?.email || '').trim().toLowerCase() } catch { /* query fallback */ }
  if (!email) email = String(c.req.query('email') || '').trim().toLowerCase()
  if (!email) return c.json({ success: false, error: 'email 필요' }, 400)
  const r = await DB.prepare("UPDATE admins SET login_pin_hash = NULL WHERE lower(email) = ?").bind(email).run().catch(() => null)
  return c.json({ success: true, email, reset: r?.meta?.changes ?? 0, message: 'PIN 해제됨 — 다음 로그인 시 재설정' })
})

// 🛡️ 2026-06-17 경량 부트스트랩 — 전체 repair-schema(수백 마이그레이션 → 524 타임아웃) 대신
//   슈퍼 어드민 복구 2줄만 빠르게 실행. admin 토큰만 있으면 호출 가능(내부 경로).
repairSchemaRoutes.get('/api/_internal/bootstrap-super', requireAdmin(), async (c) => {
  const DB = (c.env as { DB: D1Database }).DB;
  const out: { byEmail: number; oldestPromoted?: number } = { byEmail: 0 };
  try {
    const r1 = await DB.prepare("UPDATE admins SET role = 'super_admin' WHERE lower(email) = 'tobe2111@naver.com'").run();
    out.byEmail = r1.meta?.changes ?? 0;
    const hasSuper = await DB.prepare("SELECT COUNT(*) AS c FROM admins WHERE role = 'super_admin'").first<{ c: number }>();
    if ((hasSuper?.c ?? 0) === 0) {
      const r2 = await DB.prepare("UPDATE admins SET role = 'super_admin' WHERE id = (SELECT id FROM admins ORDER BY id ASC LIMIT 1)").run();
      out.oldestPromoted = r2.meta?.changes ?? 0;
    }
    const supers = await DB.prepare("SELECT id, email, name, role FROM admins WHERE role = 'super_admin'").all();
    return c.json({ success: true, ...out, super_admins: supers.results ?? [] });
  } catch (err) {
    return c.json({ success: false, error: '부트스트랩 실패', _debug: String(err).slice(0, 200) }, 500);
  }
});

// 🛡️ 2026-06-17 보안 PIN 잠금 복구 — PIN 분실 시 해당 계정 PIN 해제(재설정 유도). 슈퍼관리자만.
repairSchemaRoutes.get('/api/_internal/reset-pin', requireAdmin(), async (c) => {
  const DB = (c.env as { DB: D1Database }).DB;
  try {
    const caller = ((c as unknown as { get: (k: string) => unknown }).get('user')) as { id?: string | number } | undefined;
    const me = await DB.prepare('SELECT role FROM admins WHERE id = ?').bind(caller?.id).first<{ role: string }>().catch(() => null);
    if (!me || me.role !== 'super_admin') return c.json({ success: false, error: '슈퍼관리자만 가능합니다' }, 403);
    const email = String(c.req.query('email') || '').trim().toLowerCase();
    if (!email) return c.json({ success: false, error: 'email 쿼리 필요' }, 400);
    const r = await DB.prepare("UPDATE admins SET login_pin_hash = NULL WHERE lower(email) = ?").bind(email).run().catch(() => null);
    return c.json({ success: true, email, reset: r?.meta?.changes ?? 0, message: 'PIN 해제됨 — 해당 계정 다음 로그인 시 재설정 필요' });
  } catch (err) {
    return c.json({ success: false, error: 'PIN 해제 실패', _debug: String(err).slice(0, 150) }, 500);
  }
});

// 🚚 2026-06-18 (대표 신고 — 전체 repair-schema 524/67오류): 진단 + 최근 additive 스키마만 빠르게.
//   ① PRAGMA 로 핵심 컬럼 실제 존재 여부 진단(ground truth) ② users 테이블(한도 여유)에 마퀴 컬럼/alias
//   안전 추가 ③ sellers(컬럼 한도 도달)는 ALTER 불가라 '존재 여부만' 보고. 전부 idempotent.
repairSchemaRoutes.get('/api/_internal/repair-schema-quick', requireAdmin(), async (c) => {
  const DB = (c.env as { DB?: D1Database }).DB;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);
  const ran: string[] = [];
  const errors: { step: string; error: string }[] = [];
  const colsOf = async (table: string): Promise<Set<string>> => {
    try {
      const r = await DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
      return new Set((r.results || []).map((x) => x.name));
    } catch { return new Set(); }
  };
  const userCols = await colsOf('users');
  const sellerCols = await colsOf('sellers');
  // 진단 — 기능이 의존하는 컬럼이 실제로 있는지 (ground truth).
  const present = {
    'users.linkshop_headline': userCols.has('linkshop_headline'),
    'users.linkshop_accent': userCols.has('linkshop_accent'),
    'sellers.base_shipping_fee': sellerCols.has('base_shipping_fee'),
    'sellers.free_shipping_threshold': sellerCols.has('free_shipping_threshold'),
    'sellers.shipping_fee': sellerCols.has('shipping_fee'),
    'sellers.banner_url': sellerCols.has('banner_url'),
  };
  const run = async (step: string, sql: string) => {
    try { await DB.prepare(sql).run(); ran.push(step); }
    catch (e) {
      const m = String((e as Error)?.message || '');
      if (/duplicate column|already exists|too many columns/i.test(m)) ran.push(`${step} (skip: ${/too many/i.test(m) ? 'table maxed' : 'exists'})`);
      else errors.push({ step, error: m.slice(0, 160) });
    }
  };
  // users 는 컬럼 한도 여유 — 마퀴 헤드라인/액센트 안전 추가.
  if (!present['users.linkshop_headline']) await run('users.linkshop_headline', 'ALTER TABLE users ADD COLUMN linkshop_headline TEXT');
  if (!present['users.linkshop_accent']) await run('users.linkshop_accent', 'ALTER TABLE users ADD COLUMN linkshop_accent TEXT');
  // 핸들 변경 alias (리다이렉트) + user2→jiwon 1회 백필.
  await run('user_handle_aliases', `CREATE TABLE IF NOT EXISTS user_handle_aliases (
    alias TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')))`);
  await run('backfill user2->jiwon', `INSERT OR IGNORE INTO user_handle_aliases (alias, user_id)
    SELECT 'user2', id FROM users WHERE handle = 'jiwon' LIMIT 1`);
  // sellers 는 한도 도달 가능 — 없을 때만 추가 시도(실패해도 무해, 배송비는 shipping_fee 폴백으로 동작).
  if (!present['sellers.base_shipping_fee']) await run('sellers.base_shipping_fee', 'ALTER TABLE sellers ADD COLUMN base_shipping_fee INTEGER DEFAULT 0');
  if (!present['sellers.free_shipping_threshold']) await run('sellers.free_shipping_threshold', 'ALTER TABLE sellers ADD COLUMN free_shipping_threshold INTEGER');
  return c.json({ success: errors.length === 0, present, ran, errors });
});

// HTTP wrapper — admin auth + JSON response.
repairSchemaRoutes.get('/api/_internal/repair-schema', requireAdmin(), async (c) => {
  const env = c.env as any;
  const DB = env.DB as D1Database;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);
  const result = await runSchemaRepair(DB);
  return c.json({ success: true, ...result });
});

// 🔧 2026-07-13 (데이터 감사 3단계): off-live user_id 이력 backfill (firebase_uid → 숫자 users.id).
//   GET(또는 apply 미지정)=dry-run 카운트만. apply 실행은 POST + body {confirm:true}. 멱등·admin 전용.
//   live(카카오)=대상 0(무동작). user_points 충돌(숫자 잔액행 이미 존재)은 건드리지 않고 conflict 보고.
repairSchemaRoutes.get('/api/_internal/backfill-user-id', requireAdmin(), async (c) => {
  const DB = (c.env as { DB?: D1Database }).DB;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);
  const { backfillUserIdMapping } = await import('../utils/user-id-backfill');
  const result = await backfillUserIdMapping(DB, false); // dry-run
  return c.json({ success: true, dry_run: true, ...result });
});

repairSchemaRoutes.post('/api/_internal/backfill-user-id', requireAdmin(), async (c) => {
  const DB = (c.env as { DB?: D1Database }).DB;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);
  const body = await c.req.json<{ confirm?: boolean }>().catch(() => ({} as { confirm?: boolean }));
  const apply = body.confirm === true;
  const { backfillUserIdMapping } = await import('../utils/user-id-backfill');
  const result = await backfillUserIdMapping(DB, apply);
  return c.json({ success: true, dry_run: !apply, ...result });
});

export { repairSchemaRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureMigrationTrackingTable = new WeakSet<object>()
