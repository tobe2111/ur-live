/**
 * 🛠️ 2026-06-17 (사용자 신고 — "새 관리자 추가 시 500"): admins.role 의 옛 CHECK 제약 자가치유.
 *
 *   원인: 초기 스키마(migration 0003)가 `role TEXT CHECK(role IN ('admin','super_admin'))` 로
 *     생성 → 2026-06-16 RBAC 도입으로 추가된 제한역할(ops/cs/finance/viewer/wholesale)을
 *     INSERT/UPDATE 하면 CHECK 위반 → SQLite throw → 500. (CURRENT_WORK 가 경고했던 케이스.)
 *
 *   SQLite 는 CHECK 를 in-place 로 못 바꿈 → 테이블 안전 재빌드가 유일한 방법.
 *   - PRAGMA table_info 로 현재 컬럼을 그대로 보존(컬럼 drift 안전: status/deleted_at/totp_secret 등).
 *   - role 컬럼만 CHECK 없이 재정의.
 *   - DROP/RENAME/INDEX 를 D1 batch(원자 트랜잭션)로 → 중간 실패 시 전체 롤백(데이터 손실 0).
 *   - 멱등: 재빌드 후 CHECK 가 없어지면 다음 호출은 즉시 skip. isolate 당 1회만 검사(WeakSet).
 */

const ensured = new WeakSet<object>()

interface ColInfo {
  cid: number
  name: string
  type: string | null
  notnull: number
  dflt_value: string | null
  pk: number
}

export async function ensureAdminsRoleUnconstrained(DB: D1Database): Promise<'rebuilt' | 'ok' | 'error'> {
  if (ensured.has(DB as unknown as object)) return 'ok'
  try {
    const row = await DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='admins'"
    ).first<{ sql: string }>()
    ensured.add(DB as unknown as object)
    if (!row?.sql) return 'ok'

    // role 컬럼에 IN(...) CHECK 가 걸려 있으면(=옛 제약) 재빌드 대상.
    const hasRoleCheck = /CHECK\s*\(\s*"?role"?\s+IN/i.test(row.sql)
    if (!hasRoleCheck) return 'ok'

    const info = await DB.prepare("PRAGMA table_info('admins')").all<ColInfo>()
    const cols = info.results || []
    if (cols.length === 0) return 'ok'

    const colDefs = cols.map((col) => {
      const parts: string[] = [`"${col.name}"`, col.type || 'TEXT']
      if (col.pk === 1 && /INT/i.test(col.type || '')) {
        parts.push('PRIMARY KEY AUTOINCREMENT')
      } else if (col.notnull === 1) {
        parts.push('NOT NULL')
      }
      if (col.dflt_value !== null && col.dflt_value !== undefined) {
        parts.push(`DEFAULT ${col.dflt_value}`)
      }
      // role 만 CHECK 제거 — 위 분기에서 CHECK 를 애초에 다시 붙이지 않으므로 자동으로 빠짐.
      return parts.join(' ')
    })
    const colList = cols.map((col) => `"${col.name}"`).join(', ')

    await DB.batch([
      DB.prepare('DROP TABLE IF EXISTS admins_rebuild'),
      DB.prepare(`CREATE TABLE admins_rebuild (${colDefs.join(', ')})`),
      DB.prepare(`INSERT INTO admins_rebuild (${colList}) SELECT ${colList} FROM admins`),
      DB.prepare('DROP TABLE admins'),
      DB.prepare('ALTER TABLE admins_rebuild RENAME TO admins'),
      DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_email_unique ON admins(email)'),
      DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_username_unique ON admins(username)'),
    ])
    console.info('[ensureAdminsRoleUnconstrained] admins.role CHECK 제약 제거 — 안전 재빌드 완료')
    return 'rebuilt'
  } catch (err) {
    // 재빌드 실패해도(원자 batch → 데이터 불변) 원래 INSERT 가 시도되며 동일 500 으로 귀결.
    console.error('[ensureAdminsRoleUnconstrained] rebuild failed:', String(err).slice(0, 200))
    return 'error'
  }
}
