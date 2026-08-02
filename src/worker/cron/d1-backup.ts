import { logInfo, logError } from '../utils/logger'
/**
 * D1 → R2 자동 백업
 *
 * 🛡️ 2026-04-22: TECHNICAL_DEBT.md TD-001 해결.
 *   매주 일요일 20:00 UTC (KST 월요일 05:00) 에 D1 의 모든 테이블을 SQL dump → R2 저장.
 *
 * 활성화 조건:
 * 1. wrangler.toml 에 R2 binding 추가:
 *      [[r2_buckets]]
 *      binding = "BACKUP_BUCKET"
 *      bucket_name = "ur-live-backups"
 * 2. wrangler.toml [triggers] crons 에 "0 20 * * 0" 추가
 * 3. src/worker/index.ts scheduled() 에 본 함수 호출 추가
 *
 * R2 lifecycle: 30일 후 자동 삭제 (Cloudflare Dashboard 에서 설정)
 *
 * 백업 형식:
 *   backups/d1-YYYY-MM-DD.sql  (gzip 압축 안 함 — R2 호환성 우선)
 */

import type { Env } from '../types/env';

interface BackupEnv extends Env {
  BACKUP_BUCKET?: R2Bucket;
}

interface R2Bucket {
  put(key: string, body: string | ArrayBuffer | ReadableStream, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  // 🫀 2026-07-05: 업로드 후 존재/크기 검증용 (Workers R2 binding 표준 메서드 — 미지원 환경 대비 optional)
  head?(key: string): Promise<{ size: number } | null>;
}

// 🫀 2026-07-05: dump 무결성 메타 — "백업이 돌긴 했는데 알맹이가 빈" 상태를 잡기 위함.
//   백업은 복구 검증 전까지 '있다고 믿는 것'에 불과 — 최소한 테이블 수/에러/크기는 기계가 본다.
interface DumpResult {
  sql: string;
  tableCount: number;
  errorTables: string[];
  /** 복구 대상이 아니라 **의도적으로** 건너뛴 테이블(내부/파생) — 에러가 아니다. */
  skippedTables: string[];
}

/**
 * 📄 **페이징 커서 컬럼 고르기 — 이게 2026-08-03 사고의 핵심이다.**
 *
 * 예전 코드는 `SELECT rowid, * FROM t` 로 페이징했다. 그런데 **D1 은 결과 컬럼 100개가 한도**이고
 * `products`·`sellers` 는 **이미 정확히 100컬럼**이다 ⇒ `rowid` 한 칸을 더하는 순간 101개가 되어
 * `too many columns in result set` 으로 **그 두 테이블만 dump 에서 통째로 빠졌다.**
 *
 * 하필 빠진 것이 상품과 셀러였다. 백업 파일은 19MB 로 멀쩡해 보였고 알림도 "완료"였다.
 *
 * ⇒ **커서를 위해 컬럼을 추가하지 않는다.** 단일 INTEGER PK(=rowid 별칭)가 있으면 그 컬럼으로
 *   페이징하면 된다 — 그 값은 어차피 `*` 안에 들어 있다(추가 0칸).
 */
async function integerPkOf(DB: D1Database, table: string): Promise<string | null> {
  try {
    const { results } = await DB.prepare('SELECT name, type, pk FROM pragma_table_info(?)')
      .bind(table).all<{ name: string; type: string; pk: number }>()
    const pks = (results || []).filter((r) => Number(r.pk) > 0)
    if (pks.length !== 1) return null                    // 복합 PK 는 커서로 못 씀
    if (!/INT/i.test(String(pks[0].type || ''))) return null
    return String(pks[0].name)
  } catch {
    return null
  }
}

/**
 * 모든 테이블 dump → SQL INSERT 문으로 변환
 */
async function dumpDatabase(DB: D1Database): Promise<DumpResult> {
  const lines: string[] = [];
  lines.push(`-- D1 Backup: ${new Date().toISOString()}`);
  lines.push(`-- Database: ur-live D1`);
  lines.push('');
  lines.push('PRAGMA foreign_keys = OFF;');
  lines.push('BEGIN TRANSACTION;');
  lines.push('');

  // 테이블 목록 조회
  const tablesResult = await DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all<{ name: string }>();
  const tables = (tablesResult.results || []).map((r) => r.name);
  const errorTables: string[] = [];
  const skippedTables: string[] = [];

  for (const table of tables) {
    try {
      // 스키마 추출
      const schema = await DB.prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?"
      ).bind(table).first<{ sql: string }>();
      if (schema?.sql) {
        lines.push(`-- Table: ${table}`);
        lines.push(`DROP TABLE IF EXISTS ${table};`);
        lines.push(`${schema.sql};`);
        lines.push('');
      }

      // cursor-based pagination — OFFSET 풀스캔 대신 커서. **커서용 컬럼을 추가하지 않는다**(위 주석).
      const BATCH_SIZE = 500;
      const pk = await integerPkOf(DB, table);

      /** 한 행 → INSERT 문. */
      const toInsert = (row: Record<string, unknown>) => {
        const cols = Object.keys(row);
        const vals = Object.values(row).map((v) => {
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return String(v);
          if (typeof v === 'boolean') return v ? '1' : '0';
          const escaped = String(v).replace(/'/g, "''");
          return `'${escaped}'`;
        });
        return `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
      };

      if (pk) {
        // ✅ 일반 경로 — PK 가 곧 커서다. `*` 안에 이미 들어 있어 컬럼이 늘지 않는다.
        let cursor: number | string = 0;
        for (;;) {
          const rows = await DB.prepare(
            `SELECT * FROM ${table} WHERE ${pk} > ? ORDER BY ${pk} LIMIT ${BATCH_SIZE}`
          ).bind(cursor).all<Record<string, unknown>>();
          const results = rows.results || [];
          if (results.length === 0) break;
          for (const row of results) {
            lines.push(toInsert(row));
            cursor = row[pk] as number | string;
          }
          if (results.length < BATCH_SIZE) break;
        }
      } else {
        // 🔁 PK 가 없는 테이블 — rowid 를 **따로** 읽어(1컬럼) 그 묶음으로 본문을 가져온다.
        //   왕복이 2배지만 `*` 의 컬럼 수를 건드리지 않는다. FTS 그림자·CF 내부 테이블은
        //   rowid 자체가 없어 여기서 예외가 나는데, 그건 **복구 대상이 아니므로 skip**(에러 아님).
        let lastRowId = 0;
        for (;;) {
          let ids: number[];
          try {
            const idRows = await DB.prepare(
              `SELECT rowid AS __rid FROM ${table} WHERE rowid > ? ORDER BY rowid LIMIT ${BATCH_SIZE}`
            ).bind(lastRowId).all<{ __rid: number }>();
            ids = (idRows.results || []).map((r) => Number(r.__rid));
          } catch {
            // rowid 없음 = 가상/그림자/내부 테이블. 원본에서 재생성되거나 CF 소유다.
            skippedTables.push(table);
            lines.push(`-- SKIPPED (rowid 없음 — 파생/내부 테이블): ${table}`);
            break;
          }
          if (ids.length === 0) break;
          const rows = await DB.prepare(
            `SELECT * FROM ${table} WHERE rowid IN (${ids.map(() => '?').join(',')}) ORDER BY rowid`
          ).bind(...ids).all<Record<string, unknown>>();
          for (const row of rows.results || []) lines.push(toInsert(row));
          lastRowId = ids[ids.length - 1];
          if (ids.length < BATCH_SIZE) break;
        }
      }
      lines.push('');
    } catch (err) {
      logError(`[Backup] Table ${table} dump failed`, { error: String(err) });
      lines.push(`-- ERROR dumping table ${table}: ${(err as Error).message}`);
      errorTables.push(table);
    }
  }

  lines.push('COMMIT;');
  lines.push('PRAGMA foreign_keys = ON;');
  return { sql: lines.join('\n'), tableCount: tables.length, errorTables, skippedTables };
}

/**
 * 백업 실행 + R2 업로드
 */
export async function handleD1Backup(env: BackupEnv): Promise<{ success: boolean; key?: string; size?: number; error?: string; tables?: number; skipped?: number }> {
  const DB = env.DB;
  if (!DB) {
    return { success: false, error: 'DB binding missing' };
  }
  if (!env.BACKUP_BUCKET) {
    // 🏁 2026-06-12 (인프라 감사 🔴): 조용한 skip → throw — safeCron 이 logError+Discord 로 알림.
    //   미바인딩이면 주간 백업 0건인데 아무도 모르는 상태였음 (Time Travel 30일 초과 보존 0).
    throw new Error('[D1 Backup] BACKUP_BUCKET R2 binding not configured — 주간 백업 미동작 (Dashboard 바인딩 필요)');
  }

  try {
    logInfo('[D1 Backup] Starting dump...');
    const { sql: dump, tableCount, errorTables, skippedTables } = await dumpDatabase(DB);
    const size = new TextEncoder().encode(dump).length;

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `backups/d1-${date}.sql`;

    await env.BACKUP_BUCKET.put(key, dump, {
      httpMetadata: { contentType: 'application/sql' },
    });

    // 🫀 2026-07-05: 백업 무결성 검증 — "성공 알림이 왔는데 실제론 빈/깨진 백업" 차단.
    //   ① dump 자체: 실패 테이블 0건 + 테이블 수 하한 + 크기 하한 (프로덕션 DB 는 100+ 테이블).
    //   ② 업로드: R2 head 로 존재 + 크기 일치 재확인 (head 미지원 바인딩이면 skip).
    const integrityWarns: string[] = [];
    if (errorTables.length > 0) integrityWarns.push(`dump 실패 테이블 ${errorTables.length}개: ${errorTables.slice(0, 5).join(', ')}${errorTables.length > 5 ? '…' : ''}`);
    if (tableCount < 30) integrityWarns.push(`테이블 수 비정상: ${tableCount}개 (프로덕션 기준 하한 30)`);
    if (size < 256 * 1024) integrityWarns.push(`dump 크기 비정상: ${(size / 1024).toFixed(1)} KB (하한 256 KB)`);
    try {
      if (typeof env.BACKUP_BUCKET.head === 'function') {
        const head = await env.BACKUP_BUCKET.head(key);
        if (!head) integrityWarns.push('업로드 검증 실패: R2 head 에서 객체 미발견');
        else if (head.size !== size) integrityWarns.push(`업로드 크기 불일치: dump ${size}B vs R2 ${head.size}B`);
      }
    } catch { /* head 검증 자체 실패는 무결성 판정에 안 섞음 (put 성공이 1차 신호) */ }

    logInfo(`[D1 Backup] ✅ Saved ${key} (${(size / 1024).toFixed(1)} KB, ${tableCount} tables${integrityWarns.length ? `, ⚠️ ${integrityWarns.length} warns` : ''})`);

    // Discord 알림 (있으면) — 무결성 경고가 있으면 warn 등급으로 승격 + 상세 포함.
    const webhook = env.DISCORD_WEBHOOK_URL;
    if (webhook) {
      try {
        const { sendDiscordAlert } = await import('../utils/discord-alert');
        if (integrityWarns.length > 0) {
          await sendDiscordAlert(
            webhook,
            '⚠️ D1 백업 완료 — 무결성 경고',
            `Key: ${key}\nSize: ${(size / 1024).toFixed(1)} KB\nTables: ${tableCount}\n\n경고:\n${integrityWarns.map((w) => `- ${w}`).join('\n')}\n\n복구 리허설 절차: docs/BACKUP_RESTORE.md`,
            'warn'
          );
        } else {
          await sendDiscordAlert(
            webhook,
            '✅ D1 백업 완료',
            `Key: ${key}\nSize: ${(size / 1024).toFixed(1)} KB\nTables: ${tableCount} (무결성 검증 통과)`,
            'info'
          );
        }
      } catch {}
    }

    /**
     * 🐺 **2026-08-03: 경고를 반환값에 실어 하트비트까지 보낸다.**
     *
     * 이전엔 무결성 경고가 **디스코드에만** 갔고 반환값은 `{success:true, key, size}` 뿐이었다.
     * 그래서 하트비트에는 `success=true key=… size=…` 만 남았고, 그걸 본 세션이
     * **"경고 없음"으로 보고**했다 — 실제로는 `products`·`sellers` 가 빠진 백업이었는데도.
     * 침묵을 성공으로 읽은 것이고, 이 레포가 반복해 만난 바로 그 클래스다.
     *
     * ⇒ 관측 채널이 둘이면 **둘 다** 같은 사실을 실어야 한다. 한쪽만 보고 판정하게 두지 않는다.
     */
    if (errorTables.length > 0) {
      // 🔴 복구 대상 테이블이 빠졌으면 이건 성공이 아니다. 부분 백업은 이미 올렸으니(없는 것보단 낫다)
      //    업로드 뒤에 던져서 safeCron 이 ok:false + cron_failures + 🚨 알림까지 남기게 한다.
      throw new Error(
        `[D1 Backup] 부분 백업 — dump 실패 ${errorTables.length}개: ${errorTables.join(', ')} ` +
        `(업로드됨: ${key}, ${(size / 1024).toFixed(1)} KB, 테이블 ${tableCount})`
      );
    }
    return { success: true, key, size, tables: tableCount, skipped: skippedTables.length };
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    logError('[D1 Backup] Failed:', { error: String(msg) });

    // Discord 실패 알림
    const webhook = env.DISCORD_WEBHOOK_URL;
    if (webhook) {
      try {
        const { sendDiscordAlert } = await import('../utils/discord-alert');
        await sendDiscordAlert(
          webhook,
          '🚨 D1 백업 실패',
          `Error: ${msg.slice(0, 1500)}`,
          'error'
        );
      } catch {}
    }

    /**
     * 🔊 **2026-08-03: 실패를 밖으로 던진다 (이전엔 `return {success:false}`).**
     *
     * `safeCron` 은 **예외가 나야** `ok:false` 를 남기고 `cron_failures` 에 기록한다.
     * 그냥 반환하면 하트비트에 `ok=true` 로 찍혀 **실패한 백업이 성공처럼 보인다** —
     * 이 파일 맨 위 `BACKUP_BUCKET` 미바인딩이 2026-06-12 에 throw 로 바뀐 것과 같은 이유다.
     * (부분 백업 파일은 위에서 이미 R2 에 올렸다 — 없는 것보단 낫다.)
     */
    throw err instanceof Error ? err : new Error(msg);
  }
}
