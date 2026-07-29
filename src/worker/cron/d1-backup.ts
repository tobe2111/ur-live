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

      // cursor-based pagination — OFFSET 풀스캔 대신 rowid > lastRowId
      const BATCH_SIZE = 500;
      let lastRowId = 0;
      while (true) {
        const rows = await DB.prepare(
          `SELECT rowid, * FROM ${table} WHERE rowid > ? ORDER BY rowid LIMIT ${BATCH_SIZE}`
        ).bind(lastRowId).all();
        const results = rows.results || [];
        if (results.length === 0) break;

        for (const row of results) {
          const { rowid: _rowid, ...data } = row as Record<string, unknown>;
          const cols = Object.keys(data);
          const vals = Object.values(data).map((v) => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number') return String(v);
            if (typeof v === 'boolean') return v ? '1' : '0';
            const escaped = String(v).replace(/'/g, "''");
            return `'${escaped}'`;
          });
          lines.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
          lastRowId = Number(_rowid);
        }

        if (results.length < BATCH_SIZE) break;
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
  return { sql: lines.join('\n'), tableCount: tables.length, errorTables };
}

/**
 * 백업 실행 + R2 업로드
 */
export async function handleD1Backup(env: BackupEnv): Promise<{ success: boolean; key?: string; size?: number; error?: string }> {
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
    const { sql: dump, tableCount, errorTables } = await dumpDatabase(DB);
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

    return { success: true, key, size };
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

    return { success: false, error: msg };
  }
}
