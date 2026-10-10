/**
 * 🔑 2026-10-10 — 카카오 로그인 왕복 둘을 줄인 변경의 가드 (대표 "남은 비효율 둘 해결해줘").
 *
 * 무엇을 고쳤나 (라이브 7일 실측이 근거):
 *   ① 착지 화면이 `session/establish` 왕복을 **첫 렌더 앞에서** 기다렸다. 그 기다림은 iOS 가
 *      cross-site 302 쿠키를 유실하는 것을 고치려고 만든 것인데(2026-06-20), 실측상 establish
 *      성공 6건이 **전부 비-iOS** 였다 — 쿠키를 이미 받은 브라우저가 전부 그 비용을 치렀다.
 *      ⇒ 콜백이 같은 응답에 `HttpOnly` 없는 표식을 심고, 앱은 그게 보이면 안 기다린다.
 *   ② 기존 회원 로그인이 D1 을 [조회 → 갱신 → 재조회] **직렬 3왕복**으로 돌았다(ms_db 평균 423ms).
 *      ⇒ 갱신을 `WHERE kakao_id` 로 걸어 조회 의존을 끊고 batch 한 번으로.
 *
 * ⚠️ 이 시험이 **못 보는 것**:
 *   - 실제로 몇 ms 빨라졌는지 (라이브 `/api/_internal/kakao-login-diag` 의 ms_db·establish 행이 판정)
 *   - 브라우저가 정말 표식과 세션 쿠키를 **같이** 남기는지 (속성이 같은지만 본다 — 실측은 라이브 로그인)
 *   - iOS 경로 (7일간 iOS 로그인 0건 — 판정할 데이터 자체가 없다)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { stripComments } from '../helpers/source-text'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

const probeSrc = readFileSync('src/shared/session-persist-probe.ts', 'utf-8')
const kakaoSrc = readFileSync('src/features/auth/api/kakao.routes.ts', 'utf-8')
const mainSrc = readFileSync('src/main.tsx', 'utf-8')
const svcSrc = readFileSync('src/features/auth/services/KakaoAuthService.ts', 'utf-8')
const fastSrc = readFileSync('src/features/auth/services/kakao-upsert-fast.ts', 'utf-8')
const sessionSrc = readFileSync('src/worker/utils/session.ts', 'utf-8')

const kakaoCode = stripComments(kakaoSrc)
const mainCode = stripComments(mainSrc)
const svcCode = stripComments(svcSrc)
const fastCode = stripComments(fastSrc)

describe('① 표식 쿠키 — 302 가 심은 쿠키가 남았는지 앱이 알 수 있다', () => {
  it('①-1 표식에 HttpOnly 가 없다 (있으면 앱이 못 읽어 최적화가 조용히 죽는다)', () => {
    const line = probeSrc.match(/return `\$\{SESSION_PERSIST_PROBE\}=1;[^`]*`/)?.[0]
    expect(line, '표식 Set-Cookie 조립부를 못 찾음').toBeTruthy()
    expect(line!).not.toMatch(/HttpOnly/i)
  })

  it('①-2 나머지 속성은 소비자 세션 쿠키와 같다 (하나만 남는 브라우저가 있으면 판정이 거짓이 된다)', () => {
    // 세션 쿠키(type='user')의 속성을 **소스에서 읽어** 대조한다 — 손으로 적으면 둘이 갈린다.
    expect(sessionSrc).toContain("const sameSite = type === 'user' ? 'Lax' : 'Strict';")
    expect(sessionSrc).toContain('HttpOnly; Secure; SameSite=${sameSite}; Path=/')
    const line = probeSrc.match(/return `\$\{SESSION_PERSIST_PROBE\}=1;[^`]*`/)![0]
    expect(line).toContain('Secure')
    expect(line).toContain('SameSite=Lax')
    expect(line).toContain('Path=/')
  })

  it('①-3 콜백이 세션 쿠키와 같은 응답에 표식을 append 한다', () => {
    expect(kakaoCode).toContain("c.header('Set-Cookie', sessionCookie, { append: true });")
    expect(kakaoCode).toContain("c.header('Set-Cookie', sessionPersistProbeCookie(), { append: true });")
    const a = kakaoCode.indexOf("c.header('Set-Cookie', sessionCookie, { append: true });")
    const b = kakaoCode.indexOf("c.header('Set-Cookie', sessionPersistProbeCookie(), { append: true });")
    expect(b).toBeGreaterThan(a)   // 세션 쿠키 발급 성공 뒤에만 심는다
  })

  it('①-4 이름 판정은 정확일치다 (부분일치면 거짓 양성 → iOS 가 안 기다린다)', async () => {
    const { hasSessionPersistProbe, SESSION_PERSIST_PROBE } =
      await import('../../shared/session-persist-probe')
    expect(hasSessionPersistProbe(`${SESSION_PERSIST_PROBE}=1`)).toBe(true)
    expect(hasSessionPersistProbe(`a=1; ${SESSION_PERSIST_PROBE}=1; b=2`)).toBe(true)
    expect(hasSessionPersistProbe(`x_${SESSION_PERSIST_PROBE}=1`)).toBe(false)
    expect(hasSessionPersistProbe(`${SESSION_PERSIST_PROBE}_x=1`)).toBe(false)
    expect(hasSessionPersistProbe(`other=${SESSION_PERSIST_PROBE}`)).toBe(false)
    expect(hasSessionPersistProbe('')).toBe(false)
    expect(hasSessionPersistProbe(null)).toBe(false)
  })

  it('①-5 서버는 이 쿠키를 권한 판정에 쓰지 않는다 (인증 신호가 아니다)', () => {
    // 서버 코드(worker·features api)에서 표식 **이름을 읽는** 곳이 0 이어야 한다.
    //   심는 것(sessionPersistProbeCookie 호출)은 허용, 읽는 것(hasSessionPersistProbe)은 금지.
    const serverFiles = [kakaoSrc, readFileSync('src/worker/utils/session.ts', 'utf-8')]
    for (const f of serverFiles) expect(stripComments(f)).not.toContain('hasSessionPersistProbe')
  })

  it('①-6 표식 경로엔 재시도·reload 를 배선하지 않는다 (쿠키가 있는데 reload 하면 그게 회귀다)', () => {
    const i = mainCode.indexOf('if (ticket && hasSessionPersistProbe(document.cookie))')
    expect(i, '표식 분기를 못 찾음').toBeGreaterThan(-1)
    const j = mainCode.indexOf('} else if (ticket) {', i)
    expect(j).toBeGreaterThan(i)
    const fast = mainCode.slice(i, j)
    expect(fast).not.toContain('location.reload')
    expect(fast).not.toContain('retryEstablishOnce')
    expect(fast).not.toContain('await fetch')     // 렌더를 막지 않는다 — 이게 이 변경의 전부다
    expect(fast).toContain("void fetch('/api/auth/session/establish'")
  })

  it('①-7 iOS 차단 경로는 그대로 남아 있다 (2026-06-20 처방 무접촉)', () => {
    expect(mainCode).toContain('} else if (ticket) {')
    const i = mainCode.indexOf('} else if (ticket) {')
    const tail = mainCode.slice(i)
    expect(tail).toContain("await fetch('/api/auth/session/establish'")
    expect(tail).toContain('ctrl.abort()')
    expect(tail).toMatch(/setTimeout\(\s*\(\)\s*=>\s*ctrl\.abort\(\),\s*4000\s*\)/)
    expect(tail).toContain('window.location.reload()')
    expect(tail).toContain('retryEstablishOnce')
  })
})

describe('② D1 왕복 — 기존 회원은 한 batch 로', () => {
  /** SET 절에서 갱신하는 컬럼 이름만 뽑는다. */
  function setColumns(update: string): string[] {
    // ⚠️ `SET ` **뒤**부터 자른다 — 'SET' 를 포함해 자르면 첫 컬럼(name)이 조용히 빠진다.
    //   첫 판에서 실제로 그랬고, 두 UPDATE 가 **똑같이** 빠져서 비교(a==b)는 통과했다.
    //   기대값을 손으로 적어 둔 단언이 그걸 잡았다 — 비교만 두면 둘 다 틀려도 초록이다.
    const set = update.slice(update.indexOf('SET ') + 4, update.indexOf('WHERE'))
    return [...set.matchAll(/(?:^|,)\s*([a-z_]+)\s*=/g)].map(m => m[1]).sort()
  }
  function updateStatements(src: string): string[] {
    return [...src.matchAll(/UPDATE users\s+SET[\s\S]*?WHERE[^`]*/g)].map(m => m[0])
  }

  it('②-1 batch 로 [갱신, 조회] 를 한 왕복에 담는다', () => {
    // 🔀 2026-10-10: SQL 은 `kakao-upsert-fast.ts` 로 추출됐다(잠금 파일이 600줄 한도를 넘어서).
    //   호출부 배선은 ②-3 이 본다.
    expect(fastCode).toContain('await db.batch([')
    const i = fastCode.indexOf('await db.batch([')
    const blk = fastCode.slice(i, fastCode.indexOf(']);', i))
    expect(blk).toMatch(/UPDATE users[\s\S]*WHERE kakao_id = \?/)   // 조회에 의존하지 않는다
    expect(blk).toMatch(/SELECT id, kakao_id, name, email, profile_image, created_at/)
    expect(blk.indexOf('UPDATE')).toBeLessThan(blk.indexOf('SELECT'))  // 갱신 후 조회 = 갱신된 행
  })

  it('②-2 batch 안 갱신과 직렬 갱신이 같은 컬럼을 쓴다 (갈리면 로그인마다 다른 값이 쓰이는데 에러가 안 난다)', () => {
    // 🔀 batch 쪽은 추출 모듈, 직렬 폴백은 잠금 파일에 있다 — **둘을 합쳐** 정확히 둘이어야 한다.
    const ups = [...updateStatements(fastCode), ...updateStatements(svcCode)].filter(u => /last_login_at/.test(u))
    expect(ups.length, 'last_login_at 을 쓰는 UPDATE 가 둘이어야 한다(batch + 직렬 폴백)').toBe(2)
    const [a, b] = ups.map(setColumns)
    expect(a).toEqual(b)
    expect(a).toEqual(['email', 'email_verified', 'last_login_at', 'name', 'phone', 'profile_image', 'updated_at'])
  })

  it('②-3 batch 가 실패하면 종전 직렬 경로를 그대로 탄다 (레거시 스키마 무회귀)', () => {
    expect(fastCode).toContain('return { ok: false, row: null };')   // 모듈이 실패를 숨기지 않는다
    expect(svcCode).toContain('await fastUpsertExistingKakaoUser(this.db, kakaoUser, normalizeKakaoPhone(kakaoUser.phoneNumber))')
    expect(svcCode).toContain('if (!fastOk) try {')
    // 폴백 계단 3단이 보존돼 있다: 전체 UPDATE → 최소 UPDATE → updated_at 만
    expect(svcCode).toContain("UPDATE users SET updated_at = datetime('now') WHERE id = ?")
    const serial = svcCode.match(/if \(!fastOk\) try \{/g) || []
    expect(serial.length, '선행 조회와 갱신 둘 다 폴백 게이트를 가진다').toBe(2)
  })

  it('②-4 신규 회원은 재조회를 건너뛰지 않는다 (INSERT·handle 갱신이 그 사이에 돈다)', () => {
    expect(svcCode).toContain('let user: User | null = (fastOk && fastRow) ? fastRow : null;')
    // fastRow 는 기존 회원일 때만 non-null → 신규는 아래 조회로 내려간다
    expect(svcCode).toContain('if (!user) try {')
  })

  it('②-5 잠긴 계약(same-email 셀러 자동연결)이 그대로다', () => {
    expect(svcCode).toContain('UPDATE sellers SET linked_user_id = ?, updated_at')
    expect(svcCode).toContain('(linked_user_id IS NULL OR linked_user_id = 0)')
    expect(svcCode).toContain('AND (SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER(?)')
    expect(svcCode).toContain("if (user.email && kakaoUser.emailVerified === true)")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ③ **SQL 을 실제로 돌린다.** 위 ②는 문자열 검사라 "이 SQL 이 맞게 동작하는가" 를 증명하지 못한다.
//    이 레포가 값을 치르고 배운 것: 테스트 초록 ≠ 옳음(2026-09-03). 그래서 소스에서 두 문장을
//    **그대로 뽑아** node:sqlite 에 넣고 돌린다 — 손으로 다시 적으면 그 순간 두 벌이 갈린다.
//    ⚠️ node:sqlite ≠ D1: batch 의 트랜잭션·네트워크 특성은 재현 못 한다. 여기서 재는 것은
//       **SQL 의 의미**(몇 행이 맞는가 · 갱신 후 조회가 무엇을 보는가)뿐이다.
// ─────────────────────────────────────────────────────────────────────────────
describe('③ batch 의 두 문장을 실제 SQLite 에 돌린다', () => {
  /** 소스의 batch 블록에서 UPDATE·SELECT 문장을 그대로 뽑는다. */
  function batchStatements(): { update: string; select: string } {
    const i = fastCode.indexOf('await db.batch([')
    const blk = fastCode.slice(i, fastCode.indexOf(']);', i))
    const sqls = [...blk.matchAll(/`([\s\S]*?)`/g)].map(m => m[1].trim())
    const update = sqls.find(q => q.startsWith('UPDATE'))!
    const select = sqls.find(q => q.startsWith('SELECT'))!
    expect(update, 'batch 에서 UPDATE 를 못 뽑음').toBeTruthy()
    expect(select, 'batch 에서 SELECT 를 못 뽑음').toBeTruthy()
    return { update, select }
  }

  function seed() {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, kakao_id TEXT, name TEXT, email TEXT,
      profile_image TEXT, phone TEXT, email_verified INTEGER,
      created_at TEXT DEFAULT '2026-01-01 00:00:00', updated_at TEXT, last_login_at TEXT
    )`)
    db.exec(`CREATE UNIQUE INDEX idx_users_kakao_id_unique ON users(kakao_id) WHERE kakao_id IS NOT NULL`)
    return db
  }

  // 라이브 콜백이 넘기는 순서 그대로: name, email, profileImage, phone, email_verified, kakao_id
  const BIND = ['새이름', 'new@x.com', 'https://k.kakaocdn.net/new.jpg', '01012345678', 1, 'K1']

  it('③-1 기존 회원: 한 행만 갱신되고, 같은 batch 의 조회가 **갱신된** 행을 돌려준다', () => {
    const db = seed()
    const { update, select } = batchStatements()
    db.prepare(`INSERT INTO users (kakao_id,name,email,profile_image,phone) VALUES
      ('K1','옛이름','old@x.com','https://k.kakaocdn.net/old.jpg',NULL),
      ('K2','남',    'other@x.com',NULL,NULL)`).run()

    const r = db.prepare(update).run(...BIND)
    expect(r.changes, 'UNIQUE 인덱스가 있으니 정확히 한 행').toBe(1)

    const row = db.prepare(select).get('K1') as Record<string, unknown>
    expect(row.name).toBe('새이름')                                  // 갱신 후 값이 보인다
    expect(row.email).toBe('new@x.com')
    expect(row.profile_image).toBe('https://k.kakaocdn.net/new.jpg') // 카카오 CDN 사진은 동기화
    // ⚠️ 조회가 돌려주는 컬럼은 6개(id·kakao_id·name·email·profile_image·created_at)뿐이다 —
    //   last_login_at·phone·email_verified 는 **쓰기만** 하고 안 읽는다(세션 쿠키가 안 쓴다).
    //   첫 판에서 이걸 모르고 row.last_login_at 을 단언해 빨간불이 났다 — 코드가 아니라 시험의 오류였다.
    expect(Object.keys(row).sort()).toEqual(['created_at', 'email', 'id', 'kakao_id', 'name', 'profile_image'])
    const wrote = db.prepare('SELECT last_login_at, phone, email_verified FROM users WHERE kakao_id=?').get('K1') as any
    expect(wrote.last_login_at).toBeTruthy()
    expect(wrote.phone).toBe('01012345678')
    expect(wrote.email_verified).toBe(1)
    // 남의 행은 안 건드린다
    expect((db.prepare('SELECT name FROM users WHERE kakao_id=?').get('K2') as any).name).toBe('남')
  })

  it('③-2 커스텀 업로드 사진은 보존된다 (2026-06-11 사고 — 매 로그인마다 증발했다)', () => {
    const db = seed()
    const { update, select } = batchStatements()
    db.prepare(`INSERT INTO users (kakao_id,name,profile_image) VALUES ('K1','옛','/api/media/mine.jpg')`).run()
    db.prepare(update).run(...BIND)
    expect((db.prepare(select).get('K1') as any).profile_image).toBe('/api/media/mine.jpg')
  })

  it('③-3 이메일·전화는 덮어쓰지 않는다 (COALESCE 보존)', () => {
    const db = seed()
    const { update, select } = batchStatements()
    db.prepare(`INSERT INTO users (kakao_id,name,email,phone) VALUES ('K1','옛','keep@x.com','01099998888')`).run()
    db.prepare(update).run('새이름', null, null, '01012345678', 1, 'K1')  // 카카오가 이메일 동의 철회
    const row = db.prepare(select).get('K1') as any
    expect(row.email).toBe('keep@x.com')      // 철회해도 기존 이메일 유지
    const kept = db.prepare('SELECT phone FROM users WHERE kakao_id=?').get('K1') as any
    expect(kept.phone).toBe('01099998888')    // 사용자가 고친 번호 보존(조회 목록 밖이라 테이블에서 본다)
  })

  it('③-4 신규 회원: 갱신이 0행이고 조회가 비어 INSERT 경로로 떨어진다', () => {
    const db = seed()
    const { update, select } = batchStatements()
    db.prepare(`INSERT INTO users (kakao_id,name) VALUES ('K9','남')`).run()
    expect(db.prepare(update).run(...BIND).changes).toBe(0)
    expect(db.prepare(select).get('K1')).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ④ **왕복을 센다.** 문자열도 SQL 도 "몇 번 네트워크를 타는가" 는 말해 주지 않는다.
//    가짜 D1 을 끼워 진짜 upsertUser 를 돌리고 호출 수를 센다 — 이 변경의 목적이 바로 그 수다.
// ─────────────────────────────────────────────────────────────────────────────
describe('④ 기존 회원 로그인의 D1 왕복 수', () => {
  type Call = { sql: string; kind: 'batch' | 'single' }

  function fakeD1(row: Record<string, unknown> | null) {
    const calls: Call[] = []
    const stmt = (sql: string) => ({
      sql,
      bind: (..._a: unknown[]) => ({
        sql,
        first: async () => { calls.push({ sql, kind: 'single' }); return row },
        run: async () => { calls.push({ sql, kind: 'single' }); return { meta: { changes: 1 } } },
        all: async () => { calls.push({ sql, kind: 'single' }); return { results: row ? [row] : [] } },
      }),
      // bind 없이 바로 run 하는 자리(인덱스 생성 등)
      run: async () => { calls.push({ sql, kind: 'single' }); return { meta: { changes: 0 } } },
    })
    const db = {
      prepare: (sql: string) => stmt(sql),
      batch: async (sts: Array<{ sql: string }>) => {
        calls.push({ sql: sts.map(s => s.sql).join(' ;; '), kind: 'batch' })
        return sts.map(s => ({ results: /^\s*SELECT/.test(s.sql) ? (row ? [row] : []) : [] }))
      },
    }
    return { db, calls }
  }

  const KAKAO = {
    kakaoId: 'K1', name: '정지원', email: 'a@x.com',
    profileImage: 'https://k.kakaocdn.net/a.jpg', phoneNumber: null,
    emailVerified: true,
  }

  it('④-1 이메일 인증 보유 기존 회원 = **2왕복** (batch 1 + 셀러 자동연결 1). 종전은 4왕복이었다', async () => {
    const { KakaoAuthService } = await import('../../features/auth/services/KakaoAuthService')
    const row = { id: 3, kakao_id: 'K1', name: '정지원', email: 'a@x.com', profile_image: null, created_at: '2026-01-01 00:00:00' }
    const { db, calls } = fakeD1(row)
    const svc = new KakaoAuthService(db as never, 'rest-key')
    const user = await svc.upsertUser(KAKAO as never)

    expect(user.id).toBe(3)
    expect(user.isNewUser).toBe(false)
    expect(calls.length, calls.map(c => `${c.kind}:${c.sql.trim().slice(0, 40)}`).join('\n')).toBe(2)
    expect(calls[0].kind).toBe('batch')
    expect(calls[0].sql).toMatch(/UPDATE users[\s\S]*;;[\s\S]*SELECT id, kakao_id/)   // 갱신 → 조회 한 묶음
    expect(calls[1].sql).toMatch(/UPDATE sellers SET linked_user_id/)                 // 잠긴 자동연결(보존)
    // 🔒 이 변경의 핵심: 선행 조회도, 최종 재조회도 **없다**
    expect(calls.filter(c => c.kind === 'single' && /SELECT id, kakao_id/.test(c.sql))).toHaveLength(0)
  })

  it('④-2 이메일 미인증 기존 회원 = **1왕복** (자동연결이 안 돈다)', async () => {
    const { KakaoAuthService } = await import('../../features/auth/services/KakaoAuthService')
    const row = { id: 4, kakao_id: 'K1', name: '정지원', email: 'a@x.com', profile_image: null, created_at: '2026-01-01 00:00:00' }
    const { db, calls } = fakeD1(row)
    const svc = new KakaoAuthService(db as never, 'rest-key')
    await svc.upsertUser({ ...KAKAO, emailVerified: false } as never)
    expect(calls.length).toBe(1)
    expect(calls[0].kind).toBe('batch')
  })

  it('④-3 신규 회원은 왕복 수가 늘지 않는다 (batch 가 선행 조회 자리를 그대로 차지한다)', async () => {
    const { KakaoAuthService } = await import('../../features/auth/services/KakaoAuthService')
    // 조회가 늘 null → upsertUser 는 INSERT 경로로 가고 "INSERT 후 찾기" 도 null 이라 throw 한다.
    //   여기서 재는 것은 **throw 전까지의 왕복 수**: batch(1) + 이메일 선점검사(1) + 인덱스(1) + INSERT(1) + 찾기(1).
    //   핵심은 batch 가 **추가** 왕복이 아니라 종전 선행 조회를 대체한다는 것이다.
    const { db, calls } = fakeD1(null)
    const svc = new KakaoAuthService(db as never, 'rest-key')
    await expect(svc.upsertUser(KAKAO as never)).rejects.toThrow()
    expect(calls[0].kind).toBe('batch')
    expect(calls.filter(c => c.kind === 'batch')).toHaveLength(1)
    // 선행 조회(SELECT id, kakao_id …)가 단건으로 또 돌지 않는다 — batch 가 그 역할을 했다
    expect(calls.filter(c => c.kind === 'single' && /SELECT id, kakao_id, name/.test(c.sql))).toHaveLength(0)
  })
})
