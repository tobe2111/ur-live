#!/usr/bin/env node
/**
 * 🛡️ Firebase 토큰을 인증 수단으로 수용 금지 (2026-07-28 신설)
 *
 * 배경 — Firebase 서비스계정 개인키가 `archive/` 문서에 **3개월간 public 노출**됐다(#798).
 *   그 키만 있으면 공격 경로가 성립했다:
 *     ① 개인키로 커스텀 토큰 발급 → ② Firebase 공개 REST 로 정식 ID 토큰 교환
 *     (여기 필요한 웹 API 키는 원래 공개값) → ③ 우리 API 에 Bearer 로 제출
 *     → ④ requireAuth 가 Google 공개키로 검증 통과 → **임의 uid 로 로그인**
 *   키를 폐기해도 *수용 경로*가 남아 있으면 같은 클래스가 재발한다(새 키가 또 유출되면 끝).
 *   그래서 키 폐기와 **별개로** 문 자체를 닫았고, 이 가드가 다시 열리는 것을 막는다.
 *
 * 사실 관계 — KR 은 카카오 세션 전용(`ur_session`), 셀러/어드민은 JWT.
 *   구글 로그인은 GLOBAL 전용 UI(`LoginPage` 의 `!isKR` 분기)이고 GLOBAL 은 미런칭·폐기(#804).
 *   즉 이 경로는 **실사용자가 0** 인 채로 공격면만 제공하고 있었다(대표 확인 완료).
 *
 * 되살려야 한다면(글로벌 재개 등): 새 서비스계정 키 발급 + 아래 3규칙을 의도적으로 되돌리고
 *   이 가드도 함께 갱신할 것. "가드만 우회" 는 금지 — 그게 이 사고의 재발 경로다.
 */
import { readFileSync, existsSync } from 'node:fs'

const ALLOW_MARK = 'firebase-auth-ok'
let fail = 0
const err = (m) => { console.error(`   ❌ ${m}`); fail++ }

/**
 * 주석 줄을 제거해 '실제 코드'만 남긴다 — 주석 속 언급은 위반이 아니다.
 * ⚠️ 블록주석을 정규식(`/\*[\s\S]*?\*\/`)으로 지우면 안 된다: 문자열 리터럴 안의 `/*`
 *   (예: Accept 헤더 `* /*`)와 잘못 짝지어져 **실제 코드까지 삼킨다**.
 *   실제로 이 가드 첫 구현이 그래서 index.ts 의 마운트 줄을 못 잡았다(2026-07-28 자체 테스트로 발견).
 *   → 줄 단위로 '주석으로 시작하는 줄'만 버린다. 판정 대상이 한 줄짜리 호출/마운트라 충분하다.
 */
function stripComments(src) {
  return src.split('\n')
    .filter(l => {
      const t = l.trim()
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'))
    })
    .join('\n')
}

function read(p) {
  if (!existsSync(p)) return null
  return readFileSync(p, 'utf8')
}

// ── R1. 인증 미들웨어가 Firebase 토큰을 검증/수용하지 않을 것 ──────────────────
const AUTH = 'src/worker/middleware/auth.ts'
const authSrc = read(AUTH)
if (authSrc && !authSrc.includes(ALLOW_MARK)) {
  const code = stripComments(authSrc)
  if (/verifyFirebase(Token|IdToken)\s*\(/.test(code)) {
    err(`${AUTH} — requireAuth/optionalAuth 가 Firebase 토큰을 수용한다. 유출된 서비스계정 키로 임의 uid 로그인이 가능해진다.`)
  }
}

// ── R2. 토큰 발급 엔드포인트가 Firebase 토큰을 소유권 증명으로 받지 않을 것 ────
const TOKEN_ROUTES = 'src/worker/routes/auth-token.routes.ts'
const trSrc = read(TOKEN_ROUTES)
if (trSrc && !trSrc.includes(ALLOW_MARK)) {
  if (/verifyFirebase(Token|IdToken)\s*\(/.test(stripComments(trSrc))) {
    err(`${TOKEN_ROUTES} — Firebase ID token 으로 uid 소유권을 인정한다. 그 uid 의 토큰을 탈취당한다.`)
  }
}

// ── R3. 구글/Firebase 로그인 라우트가 마운트되지 않을 것 ──────────────────────
const INDEX = 'src/worker/index.ts'
const idxSrc = read(INDEX)
if (idxSrc && !idxSrc.includes(ALLOW_MARK)) {
  const code = stripComments(idxSrc)
  if (/app\.route\(\s*['"][^'"]*['"]\s*,\s*googleRoutes\s*\)/.test(code)) {
    err(`${INDEX} — googleRoutes 가 마운트돼 있다. 이 라우트는 Firebase ID token 을 받아 우리 계정을 발급한다.`)
  }
}

if (fail) {
  console.error(`\n  🔧 의도적으로 되살리는 경우에만: 해당 파일에 '${ALLOW_MARK}' 주석을 넣고,`)
  console.error(`     새 서비스계정 키 발급 + docs/AUDIT_INVARIANTS.md 갱신을 함께 할 것.\n`)
  process.exit(1)
}
console.log('✅ Firebase 토큰 인증 수용 경로 없음 (KR=카카오 세션 / 셀러·어드민=JWT)')
