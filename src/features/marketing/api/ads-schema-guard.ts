/**
 * 🧱 DDL 1회 실행 보장 (2026-07-28 — 무료 플랜 서브리퀘스트 예산 회수)
 *
 *   **배경(실측)**: `ensureInfluencerSchema` 는 매 인보케이션마다 CREATE TABLE 1 + CREATE INDEX 1 +
 *   ALTER 14 = **16 쿼리**를 던진다(이미 있으면 catch 로 무시). 컬럼이 다 존재하는 지금은 전부 no-op 인데,
 *   Cloudflare 는 **D1 쿼리도 인보케이션 서브리퀘스트 한도에 포함**하므로(#784) 실효 상한 ~29 인 이 계정에선
 *   **예산의 절반 이상을 '아무 일도 안 하는 DDL'이 먹는다**. 정비/수집 레인이 실제 일을 할 여력이 그만큼 줄었다.
 *
 *   ⇒ 실행할 DDL 목록의 **체크섬을 platform_settings 에 남기고, 같으면 통째로 건너뛴다**(1 읽기 ← 16 쓰기).
 *     체크섬이 목록에서 자동 계산되므로 **DDL 을 추가/수정하면 값이 바뀌어 자동으로 다시 실행**된다
 *     (버전 상수를 손으로 올리는 방식과 달리 "올리는 걸 잊어 컬럼이 안 생기는" footgun 이 없다).
 *     조회 실패·미기록 등 어떤 이상에서도 **전체 DDL 실행으로 폴백**한다(보수적).
 */
import type { D1Database } from '@cloudflare/workers-types'

/** DDL 목록의 순서 민감 체크섬(djb2 → 8자리 hex). 목록이 바뀌면 값이 바뀐다. */
export function ddlChecksum(statements: string[]): string {
  let h = 5381
  // ⚠️ 구분자는 **U+0000 그대로** — 바꾸면 체크섬이 전부 바뀌어 모든 DDL 이 한 번씩 재실행된다.
  //   단, 이스케이프(`\u0000`)로 적는다: 예전엔 **생 NUL 바이트**가 박혀 있어 이 파일이 `file(1)` 에
  //   `data` 로 잡혔고, **grep/ripgrep 이 바이너리로 보고 통째로 건너뛰었다** — 즉 레포 전역 검사가
  //   이 파일만 못 봤다(가드가 '있는데 안 도는' 이 레포의 반복 실패형과 같은 결과다).
  const s = statements.join('\u0000')
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(8, '0')
}

/**
 * 같은 DDL 목록이 이미 적용됐으면 건너뛰고, 아니면 전부 실행한 뒤 체크섬을 기록한다.
 * @param key platform_settings 키(테이블별로 분리 — 예: 'ads_ddl_influencer')
 */
export const SETTINGS_DDL =
  'CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'

export async function runDdlOnce(
  DB: D1Database, key: string, statements: string[],
): Promise<{ ran: boolean; gateStuck: boolean }> {
  const sum = ddlChecksum(statements)
  // 🩸 **표를 먼저 만든다** (2026-09-02 실사고). 예전엔 statements *뒤*에 만들었는데, 그 사이의
  //   모든 플래그 조회가 `no such table` 로 실패한다 — 그리고 이 파일이 아니라 **호출부**의
  //   "1회만 도는" 마이그레이션들이 그 플래그로 게이트돼 있어서, 표가 없으면 그것들이 **영원히 다시 돈다.**
  await DB.prepare(SETTINGS_DDL).run().catch(() => null)
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(key)
    .first<{ value: string }>().catch(() => null)
  if (row?.value === sum) return { ran: false, gateStuck: true } // ✅ 최신 — DDL 전부 생략
  for (const sql of statements) await DB.prepare(sql).run().catch(() => null)
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(key, sum).run().catch(() => null)
  // 🔍 **기록이 실제로 남았는지 확인한다.** 남지 않았는데 호출부가 "1회 마이그레이션"을 계속 돌리면
  //   전수 UPDATE/DELETE 가 매 부팅마다 반복된다 — 2026-09-02 에 그래서 계정의 D1 일일 읽기 한도가 소진됐다.
  //   실패는 조용하면 안 된다: 호출부가 이 값을 보고 **비싼 일을 하지 않도록** 알려 준다.
  const back = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(key)
    .first<{ value: string }>().catch(() => null)
  return { ran: true, gateStuck: back?.value === sum }
}
