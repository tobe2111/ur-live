/**
 * 🔒 2026-10-01 대표 신고 두 건의 불변식
 *   ① "로그아웃을 했는데 로그아웃하라는 UI 로 떠"
 *   ② "이메일 계정 가입 및 로그인도 되게끔 해줘"
 *
 * ── ① 소비자 헤더는 *소비자* 세션으로만 판정한다 ────────────────────────────────
 * 재현(브라우저 실측): `localStorage` 에 `admin_token` **하나만** 두고 홈을 열면
 *   인사말 "유어딜에 오신 걸 환영해요"(손님) + 메뉴는 내 이용권·주문 내역·**로그아웃**.
 *   `isLoggedInSync()` 가 `seller_token`·`admin_token`·`agency_token` 까지 로그인으로 세기 때문이다.
 *   그 함수는 라우트 가드용으로 그게 맞고, **소비자 헤더에 쓰면 안 되는 것**이다
 *   (`hasConsumerSession()` 주석이 이미 그 경계를 적어 뒀다).
 *
 * 그리고 로그아웃 *동작*도 반쪽이었다: 명시적 로그아웃은 2026-07-07 대표 확정으로
 *   `logoutAll()`(전 역할 종료)인데, 08-19 에 생긴 PC 계정 메뉴만 옛 `clearAuthData('user')` 를
 *   쓰고 있었다 — 같은 버그가 **새 문으로** 다시 들어왔다. 둘 다 고쳐야 증상이 사라진다
 *   (신호만 고치면 대시보드 토큰이 남고, 동작만 고치면 다른 탭에서 로그인한 순간 또 틀어진다).
 *
 * ⚠️ 이 시험이 **못 보는 것**: 실제 브라우저에서 메뉴가 어떻게 그려지는지는 안 본다
 *   (소스 배선만 본다). 화면 판정은 `scripts/visual-preview.mjs` + 프로브로 한다.
 *
 * ── ② 가입 폼과 서버가 같은 비밀번호 규칙을 쓴다 ────────────────────────────────
 * 폼은 `length < 8` 하나만 봤고 서버는 10자 + 4종 전부를 요구했다(라이브 실측:
 *   `{"success":false,"error":"비밀번호는 10자 이상이어야 합니다."}`). 폼이 통과시킨 값을
 *   서버가 거절하므로 "가입이 안 된다". 규칙이 두 벌이면 반드시 갈리므로 SSOT 한 곳에서 읽는다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { stripComments } from '../helpers/source-text'
import {
  validatePasswordComplexity,
  passwordRuleChecklist,
  PASSWORD_MIN_LENGTH,
} from '@/shared/password-policy'

const ROOT = process.cwd()
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf-8')
const code = (p: string) => stripComments(read(p))

const NAV = 'src/components/main/DesktopTopNav.tsx'
const MENU = 'src/components/main/AccountMenu.tsx'
const REGISTER = 'src/pages/RegisterPage.tsx'
const LOGIN = 'src/pages/LoginPage.tsx'
const POLICY = 'src/shared/password-policy.ts'
const SERVER_AUTH = 'src/worker/routes/auth.routes.ts'

describe('① 소비자 헤더 = 소비자 세션', () => {
  it('DesktopTopNav 의 loggedIn 은 hasConsumerSession() 에서 온다', () => {
    const s = code(NAV)
    expect(s).toContain('const loggedIn = hasConsumerSession()')
  })

  it('DesktopTopNav 는 isLoggedInSync 를 쓰지 않는다 (대시보드 토큰을 세는 신호)', () => {
    // 주석을 걷어낸 코드에만 적용 — 위 설명 주석의 단어에 걸리면 안 된다.
    expect(code(NAV)).not.toContain('isLoggedInSync')
  })

  it('hasConsumerSession 은 seller/admin/agency 토큰을 세지 않는다', () => {
    const s = code('src/utils/auth.ts')
    const body = s.slice(s.indexOf('export function hasConsumerSession'))
    const fn = body.slice(0, body.indexOf('\n}') + 2)
    expect(fn).not.toContain('seller_token')
    expect(fn).not.toContain('admin_token')
    expect(fn).not.toContain('agency_token')
    // 소비자 신호는 그대로 남아 있어야 한다(없으면 영원히 로그아웃으로 보인다).
    expect(fn).toContain('session_login')
  })
})

describe('① 명시적 로그아웃 = 전 역할 종료', () => {
  it('계정 메뉴의 로그아웃은 logoutAll() 을 쓴다', () => {
    expect(code(MENU)).toContain('logoutAll()')
  })

  it('계정 메뉴가 소비자만 지우는 옛 경로로 돌아가지 않는다', () => {
    expect(code(MENU)).not.toContain("clearAuthData('user')")
  })

  it('마이페이지도 같은 logoutAll 을 쓴다 (두 입구가 다른 로그아웃을 하면 안 된다)', () => {
    expect(code('src/pages/UserProfilePage.tsx')).toContain('logoutAll()')
  })

  it('logoutAll 은 대시보드 토큰까지 지운다', () => {
    const s = code('src/features/auth/login-flow.service.ts')
    const body = s.slice(s.indexOf('export async function logoutAll'))
    expect(body).toContain("clearAuthData('seller')")
    expect(body).toContain("clearAuthData('admin')")
    expect(body).toContain('agency_token')
  })
})

describe('② 비밀번호 규칙 SSOT', () => {
  it('서버는 공유 정책 모듈에서 규칙을 읽는다 (lib/password 재수출 경유)', () => {
    expect(code('src/lib/password.ts')).toContain("from '../shared/password-policy'")
    expect(code(SERVER_AUTH)).toContain('validatePasswordComplexity')
  })

  it('가입 폼도 같은 모듈에서 읽는다', () => {
    const s = code(REGISTER)
    expect(s).toContain("from '@/shared/password-policy'")
    expect(s).toContain('validatePasswordComplexity(formData.password)')
  })

  it('가입 폼에 손으로 적은 길이 검사가 남아 있지 않다', () => {
    // 이 한 줄이 서버와 갈려 "폼은 통과, 서버는 400" 을 만들었다.
    expect(code(REGISTER)).not.toContain('password.length < 8')
  })

  it('정책 모듈은 crypto 를 끌고 오지 않는다 (가입 폼이 브라우저에서 import 한다)', () => {
    // ⚠️ 주석을 걷어낸 **코드**로 본다 — 이 모듈의 머리말이 "crypto 가 없다" 고 설명하고 있어서
    //    원문으로 검사하면 자기 설명에 걸려 빨간불이 난다(첫 판에서 실제로 그랬다).
    const s = code(POLICY)
    expect(s).not.toContain('crypto')
    expect(s).not.toContain('PBKDF2')
    // 🩸 첫 판은 `from '...lib/password'` 만 봤는데, 주입이 **부작용 import**
    //    (`import '../lib/password'` — from 이 없다)로 통과해 버렸다. 끌어오는 방식은 여럿이므로
    //    모듈 **경로 자체**를 앵커한다(동적 import·재수출도 함께 걸린다).
    expect(s).not.toContain('lib/password')
  })

  it('서버가 거절하는 값은 폼도 거절한다 — 같은 함수라 정의상 일치', () => {
    // 실제로 서버가 400 을 준 값(라이브 실측 클래스)
    expect(validatePasswordComplexity('xxxxxxxx').ok).toBe(false)   // 8자
    expect(validatePasswordComplexity('password1').ok).toBe(false)  // 9자·대문자/특수 없음
    expect(validatePasswordComplexity('Password1').ok).toBe(false)  // 특수문자 없음
    expect(validatePasswordComplexity('Passw0rd!x').ok).toBe(true)  // 10자·4종
  })

  it('체크리스트 판정이 제출 검사와 어긋나지 않는다', () => {
    // 모든 칸이 초록인데 제출이 막히면(또는 그 반대면) 사용자가 빠져나올 길이 없다.
    for (const pw of ['Passw0rd!x', 'Aa1!aaaaaa', 'short', 'Password1', 'aaaa1111!!AA']) {
      const allOk = passwordRuleChecklist(pw).every((r) => r.ok)
      const accepted = validatePasswordComplexity(pw).ok
      // 반복 문자 규칙은 체크리스트에 없으므로 '체크리스트 통과'가 '수락'의 필요조건이기만 하면 된다.
      if (accepted) expect(allOk).toBe(true)
    }
  })

  it('최소 길이 상수가 화면 문구와 같은 출처다', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10)
    expect(code(REGISTER)).toContain('minLength={PASSWORD_MIN_LENGTH}')
  })
})

describe('② 서버가 알려준 실패 이유를 화면이 버리지 않는다', () => {
  it('가입 폼은 서버 메시지를 그대로 보여 준다', () => {
    const s = code(REGISTER)
    expect(s).toContain('setError(errMsg')
    // Firebase 는 2026-08-04 에 제거됐다(#804) — 그 코드로 분기하면 영원히 매치되지 않는다.
    expect(s).not.toContain('email-already-in-use')
    expect(s).not.toContain('weak-password')
  })

  it('로그인 폼도 서버 메시지를 보여 준다 (계정 잠금을 "비번 틀림" 으로 뭉개지 않게)', () => {
    const s = code(LOGIN)
    expect(s).toContain("setError(msg || t('auth.invalidCredentials'))")
  })

  it('서버는 계정 존재 여부를 흘리지 않는다 — 미존재·비번오류 문장이 같다', () => {
    const s = code(SERVER_AUTH)
    const login = s.slice(s.indexOf("authRouter.post('/login'"))
    const hits = login.match(/이메일 또는 비밀번호가 올바르지 않습니다/g) || []
    // 미존재 1 + 비번불일치 1 — 둘이 같은 문장이어야 메시지를 그대로 노출해도 안전하다.
    expect(hits.length).toBeGreaterThanOrEqual(2)
  })
})

describe('🧪 이 시험이 헛돌지 않는가', () => {
  it('검사 대상 파일이 실제로 읽혔다', () => {
    for (const p of [NAV, MENU, REGISTER, LOGIN, POLICY, SERVER_AUTH]) {
      expect(read(p).length).toBeGreaterThan(500)
    }
  })
})
