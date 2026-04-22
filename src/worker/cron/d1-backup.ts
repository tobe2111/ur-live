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
}

/**
 * 모든 테이블 dump → SQL INSERT 문으로 변환
 */
async function dumpDatabase(DB: D1Database): Promise<string> {
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

      // 데이터 dump (큰 테이블은 batch)
      const BATCH_SIZE = 500;
      let offset = 0;
      while (true) {
        const rows = await DB.prepare(`SELECT * FROM ${table} LIMIT ${BATCH_SIZE} OFFSET ${offset}`).all();
        const results = rows.results || [];
        if (results.length === 0) break;

        for (const row of results) {
          const cols = Object.keys(row);
          const vals = Object.values(row).map((v) => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number') return String(v);
            if (typeof v === 'boolean') return v ? '1' : '0';
            // SQLite escape: ' → ''
            const escaped = String(v).replace(/'/g, "''");
            return `'${escaped}'`;
          });
          lines.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
        }

        if (results.length < BATCH_SIZE) break;
        offset += BATCH_SIZE;
      }
      lines.push('');
    } catch (err) {
      console.error(`[Backup] Table ${table} dump failed:`, err);
      lines.push(`-- ERROR dumping table ${table}: ${(err as Error).message}`);
    }
  }

  lines.push('COMMIT;');
  lines.push('PRAGMA foreign_keys = ON;');
  return lines.join('\n');
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
    console.warn('[D1 Backup] BACKUP_BUCKET R2 binding not configured — skipping backup');
    return { success: false, error: 'BACKUP_BUCKET not configured' };
  }

  try {
    console.log('[D1 Backup] Starting dump...');
    const dump = await dumpDatabase(DB);
    const size = new TextEncoder().encode(dump).length;

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `backups/d1-${date}.sql`;

    await env.BACKUP_BUCKET.put(key, dump, {
      httpMetadata: { contentType: 'application/sql' },
    });

    console.log(`[D1 Backup] ✅ Saved ${key} (${(size / 1024).toFixed(1)} KB)`);

    // Discord 알림 (있으면)
    const webhook = env.DISCORD_WEBHOOK_URL;
    if (webhook) {
      try {
        const { sendDiscordAlert } = await import('../utils/discord-alert');
        await sendDiscordAlert(
          webhook,
          '✅ D1 백업 완료',
          `Key: ${key}\nSize: ${(size / 1024).toFixed(1)} KB`,
          'info'
        );
      } catch {}
    }

    return { success: true, key, size };
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    console.error('[D1 Backup] Failed:', msg);

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
