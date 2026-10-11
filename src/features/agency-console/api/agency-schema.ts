/**
 * 🏢 에이전시 계정 — 테이블 (2026-10-11 대표 확정 `docs/decisions/2026-10-11-agency-model-email-only.md`)
 *
 * 대표: *"애초에 에이전시 계정을 이메일로만 가입하게끔 하는건?"* → *"안 A로 하자."*
 *
 * ## 왜 새 테이블인가 (옛 `agencies` 를 다시 쓰지 않는 이유)
 * 옛 `agencies`·`agency_members` 는 2026-09-04 일몰된 모델의 테이블이다. 그걸 읽는 잔재 코드가
 * 아직 여러 곳에 있다(카카오 로그인의 에이전시 토큰 발급, 정산 계좌 조회, 2FA). 같은 테이블에 새
 * 에이전시를 쓰면 그 잔재가 **새 계정을 옛 모델로 해석**한다. 이름을 갈라 두면 둘이 섞일 길이 없다.
 *
 * ## 신원은 소비자 `users` 와 완전히 분리한다
 * 에이전시 직원은 카카오 소비자 계정이 아니다. 개인 돈(소개비)과 에이전시 몫이 처음부터 다른 계정에
 * 쌓이게 하려고 정한 구조다(대표 결정). 그래서 직원은 `users` 행을 만들지 않고 여기 `agency_staff` 에만 산다.
 */

const _ensured = new WeakSet<object>()

export async function ensureAgencyConsoleTables(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS agency_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'business',
      business_number TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS agency_staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'staff',
      is_owner INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      tokens_valid_after INTEGER NOT NULL DEFAULT 0,
      invited_by_staff_id INTEGER,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_staff_email ON agency_staff(LOWER(email))'),
    DB.prepare('CREATE INDEX IF NOT EXISTS idx_agency_staff_agency ON agency_staff(agency_id, status)'),
    DB.prepare(`CREATE TABLE IF NOT EXISTS agency_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_tokens_hash ON agency_tokens(token_hash)'),
    DB.prepare('CREATE INDEX IF NOT EXISTS idx_agency_tokens_staff ON agency_tokens(staff_id, kind)'),
    // 🏪 2단계 — 매장이 에이전시에 운영을 맡긴 기록. 사람(직원)이 아니라 **에이전시**에 붙는다.
    //   행은 지우지 않는다(누가 언제 맡기고 끊었는지가 분쟁 증거) — status 로만 닫는다.
    DB.prepare(`CREATE TABLE IF NOT EXISTS agency_store_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_by_user_id INTEGER,
      decided_by_staff_id INTEGER,
      ended_by TEXT,
      ended_by_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      accepted_at TEXT,
      ended_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    // 한 매장은 한 번에 한 에이전시에만 맡긴다(요청 중 포함) — 몫·책임이 둘로 갈리지 않게.
    DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_store_links_open ON agency_store_links(seller_id) WHERE status IN ('pending','active')"),
    DB.prepare('CREATE INDEX IF NOT EXISTS idx_agency_store_links_agency ON agency_store_links(agency_id, status)'),
    // 🔗 에이전시가 사장님께 보내는 **매장 초대 링크** — 사장님이 누르고 [맡기기] 한 번이면 바로 운영 시작.
    //   ⚠️ 토큰을 해시하지 않고 그대로 둔다: 이 링크는 들고 있는 사람에게 아무 권한도 주지 않는다(자기 매장을
    //   이 에이전시에 *맡길* 수 있을 뿐이고, 그것도 그 매장 주인이 로그인해야 한다). 대신 관리자가 언제든 다시 복사할 수 있다.
    DB.prepare(`CREATE TABLE IF NOT EXISTS agency_store_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      created_by_staff_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      use_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_store_invites_token ON agency_store_invites(token)'),
    DB.prepare('CREATE INDEX IF NOT EXISTS idx_agency_store_invites_agency ON agency_store_invites(agency_id, revoked_at)'),
    // 📝 에이전시 직원이 맡은 매장에서 바꾼 것 — 사장님이 운영자 관리에서 읽는다(누가·언제·무엇).
    //   요청 본문은 남기지 않는다(개인정보·용량). 경로와 사람이 읽는 한 줄 이름만.
    DB.prepare(`CREATE TABLE IF NOT EXISTS agency_store_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      agency_id INTEGER NOT NULL,
      staff_id INTEGER NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    DB.prepare('CREATE INDEX IF NOT EXISTS idx_agency_store_activity_store ON agency_store_activity(seller_id, id)'),
  ])
  // 🏛️ 사업자 진위확인 결과(국세청 상태 문자열 · 'unverified'). 이미 만들어진 테이블에 붙이는 열이라 ALTER 로 —
  //   batch 안에 두면 '이미 있음' 오류가 위 생성문까지 되돌린다. 실패(=이미 있음)는 조용히 넘어간다.
  try { await DB.prepare('ALTER TABLE agency_accounts ADD COLUMN business_status TEXT').run() } catch { /* 이미 있음 */ }
  _ensured.add(DB)
}

export type AgencyKind = 'business' | 'individual'
/** pending = 대표 이메일 인증 전 · active · suspended(어드민) */
export type AgencyStatus = 'pending' | 'active' | 'suspended'
/** pending = 가입 인증 전 · invited = 초대 수락 전 · active · removed(내보냄) */
export type StaffStatus = 'pending' | 'invited' | 'active' | 'removed'
/** admin = 정산·직원·조건 관리 · staff = 매장 운영만 */
export type StaffRole = 'admin' | 'staff'
export type AgencyTokenKind = 'verify' | 'invite' | 'reset'
/** pending = 사장님이 맡김 요청 · active = 에이전시가 수락 · declined = 에이전시가 거절 · ended = 누군가 끊음 */
export type AgencyStoreLinkStatus = 'pending' | 'active' | 'declined' | 'ended'

/** 토큰 유효 시간 — 인증 메일 24시간 · 초대 7일 · 비밀번호 재설정 1시간 */
export const AGENCY_TOKEN_TTL_HOURS: Record<AgencyTokenKind, number> = { verify: 24, invite: 24 * 7, reset: 1 }

/** 매장 초대 링크 수명 — 영업 한 바퀴(한 달)를 덮되, 잊힌 링크가 영원히 살지 않게. */
export const AGENCY_STORE_INVITE_DAYS = 30

export const AGENCY_NAME_MAX = 60
export const STAFF_NAME_MAX = 40
