import type { D1Database } from '@cloudflare/workers-types'

/**
 * ⚙️ platform_settings 읽기/쓰기 헬퍼 — `influencer-auto-collect.ts` 에서 분리(2026-07-29, 600줄 래칫).
 *   낱개(readSetting/writeSetting)와 **배치**(readSettings/writeSettings)를 함께 둔다. 배치가 필요한 이유는
 *   D1 호출도 인보케이션 예산을 쓰기 때문이다 — 커서·예산·쿼터를 낱개로 읽으면 읽기에만 5회를 쓴다.
 *   ⚠️ 기존 import 경로(`influencer-auto-collect`)는 재수출로 유지 — 여러 레인이 이미 그 경로를 쓴다.
 */

export async function readSetting(DB: D1Database, key: string): Promise<string | null> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(key).first<{ value: string }>().catch(() => null)
  const v = row?.value
  return v === undefined || v === null || v === '' ? null : String(v)
}
/**
 * 🧮 여러 설정을 **1 서브리퀘스트로** 읽는다 (2026-07-29).
 *   D1 호출은 인보케이션당 서브리퀘스트 한도(무료 50)에 포함된다(#784). 이 레인은 커서·예산·쿼터를
 *   낱개 `readSetting` 으로 읽어 **읽기에만 4~5개**를 썼고, 그만큼 발굴 fetch 여력이 줄었다.
 */
export async function readSettings(DB: D1Database, keys: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {}
  for (const k of keys) out[k] = null
  if (!keys.length) return out
  const ph = keys.map(() => '?').join(',')
  const rows = (await DB.prepare(`SELECT key, value FROM platform_settings WHERE key IN (${ph})`)
    .bind(...keys).all<{ key: string; value: string }>().catch(() => null))?.results || []
  for (const r of rows) out[r.key] = r.value === undefined || r.value === null || r.value === '' ? null : String(r.value)
  return out
}
export async function writeSetting(DB: D1Database, key: string, value: string): Promise<void> {
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(key, value).run().catch(() => null)
}
/** 🧮 여러 설정을 1 batch(=1 서브리퀘스트)로 저장 — 위 `readSettings` 와 같은 이유. */
export async function writeSettings(DB: D1Database, kv: [string, string][]): Promise<void> {
  if (!kv.length) return
  await DB.batch(kv.map(([k, v]) =>
    DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(k, v))).catch(() => null)
}
