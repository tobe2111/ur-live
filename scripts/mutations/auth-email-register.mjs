/**
 * 🩸 이메일 가입 500 (2026-09-20) 되돌려-검증 주입. 가드: src/tests/unit/auth-email-register-2026-09-20.test.ts
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일.
 */
const TEST = 'src/tests/unit/auth-email-register-2026-09-20.test.ts'

export default [
  {
    name: '🩸이메일가입 users INSERT 에 TEXT id 를 다시 넣는다 (INTEGER PK → datatype mismatch 500)',
    file: 'src/worker/routes/auth.routes.ts',
    find: "      `INSERT INTO users (email, password_hash, name, phone)\n       VALUES (?, ?, ?, ?)`,\n      [email, passwordHash, name, phone ?? null]",
    replace: "      `INSERT INTO users (id, email, password_hash, name, phone)\n       VALUES (?, ?, ?, ?, ?)`,\n      [String(Date.now()), email, passwordHash, name, phone ?? null]",
    test: TEST,
    why: '라이브 users.id 는 INTEGER AUTOINCREMENT 다. 에러는 catch 가 삼켜 화면엔 "Registration failed" 만 남는다.',
  },
  {
    name: '🩸이메일가입 last_row_id 가 비어도 토큰을 발급한다 (sub 빈 JWT)',
    file: 'src/worker/routes/auth.routes.ts',
    find: "    if (!userId) {\n      return c.json({ success: false, error: 'Registration failed' }, 500);\n    }",
    replace: '    void userId;',
    test: TEST,
    why: 'D1 이 last_row_id 를 안 주는 경로에서 sub="" 세션이 발급되면 누구의 것도 아닌 로그인이 된다.',
  },
  {
    name: '🩸이메일가입 refresh_tokens INSERT 에 TEXT id 를 다시 넣는다 (두 번째 INTEGER PK)',
    file: 'src/worker/routes/auth.routes.ts',
    find: "      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)\n       VALUES (?, ?, datetime('now', '+30 days'))`,\n      [userId, tokenHash]",
    replace: "      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)\n       VALUES (?, ?, ?, datetime('now', '+30 days'))`,\n      [String(Date.now()), userId, tokenHash]",
    test: TEST,
    why: '첫 수정(users 만)을 배포하고도 500 이었다 — users 행은 들어가고 refresh_tokens 에서 죽어 고아 유저가 남는다.',
  },
]
