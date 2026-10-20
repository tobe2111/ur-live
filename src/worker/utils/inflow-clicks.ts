/**
 * 📡 2026-07-13 (데이터 감사 2단계 — 대표 승인): 인플루언서/큐레이터 유입 "클릭" 이벤트.
 *
 * 배경: `?ref=<users.id>` / `?aff=` 링크 클릭은 지금까지 브라우저 localStorage/쿠키에만 살고,
 *   서버 행은 **구매 시점에만** 생겼음(전환 안 하면 유입 영구 유실). acquisition_landings 는
 *   익명 + `src` 자유문자열이라 인플루언서 식별 불가. → 완결고리(유입→방문→결제→재방문)의
 *   '유입' 노드가 클릭 시점에 안 남았음.
 *
 * 설계(acquisition 모델 미러, 별도 테이블 — 두 시스템 격리):
 *  - 클릭 시점 익명 이벤트: (anon_id=클라 UUID, ref_id=인플루언서 users.id, campaign, path).
 *  - UNIQUE(anon_id, ref_id) + INSERT OR IGNORE → (방문자, 인플루언서) first-touch 엣지 1행(write 예산 보호).
 *  - 로그인/가입 후 bind: user_id 를 채워 익명 클릭을 실제 유저에 귀속(전환 안 해도 유입 보존).
 *  - ref_id 는 코드 전역 규약대로 users.id 문자열(String(referrer_id)).
 */
const _ensuredInflow = new WeakSet<object>()
export async function ensureInflowClicksTable(DB: D1Database) {
  if (_ensuredInflow.has(DB)) return
  _ensuredInflow.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS inflow_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anon_id TEXT NOT NULL,
      ref_id TEXT NOT NULL,
      ref_type TEXT,
      campaign TEXT,
      landing_path TEXT,
      user_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`).run()
    // (방문자, 인플루언서) first-touch 유일 — 재클릭은 no-op(INSERT OR IGNORE).
    await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_inflow_anon_ref ON inflow_clicks(anon_id, ref_id)').run()
    // 인플루언서별 유입 집계 / 유저 귀속 조인.
    await DB.prepare('CREATE INDEX IF NOT EXISTS idx_inflow_ref ON inflow_clicks(ref_id, created_at DESC)').run()
    await DB.prepare('CREATE INDEX IF NOT EXISTS idx_inflow_user ON inflow_clicks(user_id)').run()
  } catch { /* ignore */ }
}

/** anon_id 형식 검증(클라 생성 UUID). 8~64자 영숫자/하이픈. */
export function isValidAnonId(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v)
}

/** ref_id 검증 — users.id 숫자 문자열(코드 전역 규약, affiliate-track 과 동일 1~12자리). */
export function normalizeRefId(v: unknown): string | null {
  const s = String(v ?? '')
  return /^\d{1,12}$/.test(s) ? s : null
}

/** 클릭 이벤트 기록(익명·멱등·best-effort). 반환: 신규 기록 여부. */
export async function recordInflowClick(
  DB: D1Database,
  input: { anonId: string; refId: string; refType?: string | null; campaign?: string | null; path?: string | null },
): Promise<boolean> {
  try {
    await ensureInflowClicksTable(DB)
    const r = await DB.prepare(
      `INSERT OR IGNORE INTO inflow_clicks (anon_id, ref_id, ref_type, campaign, landing_path)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      input.anonId, input.refId,
      input.refType ? String(input.refType).slice(0, 20) : null,
      input.campaign ? String(input.campaign).slice(0, 40) : null,
      input.path ? String(input.path).slice(0, 200) : null,
    ).run()
    return (r?.meta?.changes ?? 0) > 0
  } catch {
    return false
  }
}

/** 로그인/가입 후 익명 클릭을 유저에 귀속(멱등). 반환: 귀속된 행 수. */
export async function bindInflowClicksToUser(
  DB: D1Database,
  anonId: string,
  userId: string | number,
): Promise<number> {
  try {
    await ensureInflowClicksTable(DB)
    const r = await DB.prepare(
      'UPDATE inflow_clicks SET user_id = ? WHERE anon_id = ? AND user_id IS NULL',
    ).bind(String(userId), anonId).run()
    return r?.meta?.changes ?? 0
  } catch {
    return 0
  }
}
