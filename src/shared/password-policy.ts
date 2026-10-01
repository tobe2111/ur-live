/**
 * 🔐 비밀번호 정책 SSOT — 서버와 가입 폼이 **같은 규칙**을 읽는다.
 *
 * 🩸 왜 떼어냈나 (2026-10-01 대표 신고 "이메일 가입 및 로그인도 되게끔 해줘"):
 *   규칙이 두 벌이었다. 서버(`/api/auth/register`)는 **10자 + 대/소/숫자/특수 4종 전부**를 요구하는데
 *   가입 폼(`RegisterPage`)은 `password.length < 8` **하나만** 봤다. 그래서 `password1` 같은 값이
 *   폼을 통과해 전송되고, 서버가 처음 보는 규칙으로 400 을 돌려줬다. 사용자 입장에선
 *   **"폼이 괜찮다고 해 놓고 가입이 안 되는"** 화면이다 — 게다가 폼 어디에도 규칙이 안 적혀 있어
 *   무엇을 고쳐야 할지 알 수 없었다(실측: 서버 `비밀번호는 10자 이상이어야 합니다.`).
 *
 * ⚠️ 규칙을 바꿀 땐 **이 파일만** 고친다. `src/lib/password.ts` 는 이걸 재수출할 뿐이고
 *   (서버 import 경로 전부 그대로), 가입 폼은 여기서 직접 읽는다.
 *
 * 🪶 **crypto 가 없는 순수 모듈이다** — 가입 폼이 `lib/password.ts`(PBKDF2 해싱)를 통째로 import 하면
 *   쓰지도 않는 해시 코드가 브라우저 번들에 실린다. 정책만 떼어 두면 폼은 이 작은 파일만 가져간다.
 */

/** 신규 가입(strict) / 어드민 추가(relaxed) 최소 길이 */
export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MIN_LENGTH_RELAXED = 8
export const PASSWORD_MAX_LENGTH = 128

/** 특수문자 집합 — 서버·클라가 같은 글자를 특수문자로 센다. */
const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/

/**
 * 비밀번호 복잡도 검증 — 신규 가입/비번 변경 시에만 적용.
 * 기존 사용자의 로그인은 차단하지 않는다.
 *
 * 조건 (기본/strict — 신규 사용자 가입):
 *  - 10 <= length <= 128
 *  - 대문자 1+ / 소문자 1+ / 숫자 1+ / 특수문자 1+ 모두 포함
 *
 * relaxed (2026-06-17 대표 요청 — 새 관리자 추가 전용 완화):
 *  - 8 <= length <= 128
 *  - 영문/숫자/특수문자 4종 중 2종 이상 포함 (대문자 필수 X) → 예: "1q2w3e4r$#@!" 허용
 *  (어드민 계정 생성 경로만 relaxed 사용. 일반 사용자 가입은 strict 유지.)
 */
export function validatePasswordComplexity(
  password: string,
  opts?: { relaxed?: boolean },
): { ok: true } | { ok: false; error: string } {
  if (typeof password !== 'string') {
    return { ok: false, error: '비밀번호가 올바르지 않습니다.' }
  }
  const relaxed = !!opts?.relaxed
  const minLen = relaxed ? PASSWORD_MIN_LENGTH_RELAXED : PASSWORD_MIN_LENGTH
  if (password.length < minLen) {
    return { ok: false, error: `비밀번호는 ${minLen}자 이상이어야 합니다.` }
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하여야 합니다.` }
  }
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNum = /[0-9]/.test(password)
  // 🛡️ 2026-04-22: 특수문자 필수 (이전엔 대/소/숫자 3 class 만 요구)
  const hasSpecial = SPECIAL_RE.test(password)
  const classes = [hasUpper, hasLower, hasNum, hasSpecial].filter(Boolean).length
  if (relaxed) {
    // 완화: 4종 중 2종 이상이면 통과 (대문자 강제 X).
    if (classes < 2) {
      return { ok: false, error: '비밀번호는 영문·숫자·특수문자 중 2종류 이상 포함해야 합니다.' }
    }
  } else if (!hasUpper || !hasLower || !hasNum || !hasSpecial) {
    return {
      ok: false,
      error: '비밀번호는 대문자, 소문자, 숫자, 특수문자를 모두 포함해야 합니다.',
    }
  }
  // 반복 패턴 방어 (예: "Abc123abc123" 같은 뻔한 조합)
  if (/(.)\1{3,}/.test(password)) {
    return { ok: false, error: '같은 문자 4회 이상 반복 불가.' }
  }
  return { ok: true }
}

/**
 * 가입 폼이 **입력하기 전에** 보여 주는 규칙 체크리스트.
 *
 * 🔑 통과 여부를 규칙별로 돌려주는 이유: "비밀번호가 조건에 안 맞습니다" 한 줄은 무엇을 고쳐야
 *   할지 안 알려 준다. 네 칸 중 어디가 빨간지 보여야 사용자가 한 번에 통과한다.
 *   ⚠️ 판정은 `validatePasswordComplexity` 와 **같은 조건식**을 쓴다 — 여기만 고치면 갈린다.
 */
export type PasswordRule = { label: string; ok: boolean }

export function passwordRuleChecklist(password: string): PasswordRule[] {
  const p = typeof password === 'string' ? password : ''
  return [
    { label: `${PASSWORD_MIN_LENGTH}자 이상`, ok: p.length >= PASSWORD_MIN_LENGTH && p.length <= PASSWORD_MAX_LENGTH },
    { label: '대문자 포함', ok: /[A-Z]/.test(p) },
    { label: '소문자 포함', ok: /[a-z]/.test(p) },
    { label: '숫자 포함', ok: /[0-9]/.test(p) },
    { label: '특수문자 포함', ok: SPECIAL_RE.test(p) },
  ]
}
