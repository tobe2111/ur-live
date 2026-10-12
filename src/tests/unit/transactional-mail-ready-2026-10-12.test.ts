/**
 * 📮 거래성 메일 '보낼 수 있나' 판정 — Resend 키 **또는** SENS 메일 (2026-10-12 배포 후 실측)
 *
 * 🩸 #1728 배포 뒤 `/api/version` 을 보니 유어딜(ur-live)엔 `RESEND_API_KEY` 가 **없었다**. 그런데 호출부 여럿이
 *   발송 전에 그 키만 보고 건너뛰어서, SENS 메일(NCP_MAIL_SENDER)을 설정해도 이용권 영수증·셀러 비밀번호 찾기·
 *   에이전시 초대/가입·셀러 일일 리포트가 **한 통도 안 나갔다**(에러 없음). 판정을 `transactionalMailReady` 하나로 모은다.
 *
 * ⚠️ 못 보는 것: SENS 가 실제로 받아 주는지(urdeal.kr 도메인 인증·SPF/DKIM) — 라이브 발송으로만 판정.
 *   유어애즈(marketing/·worker-ads/)의 Resend 판정은 **일부러 안 바꿨다**(그 워커엔 NCP_MAIL_SENDER 를 두지 않는다 — 콜드메일 차단 안전판).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { transactionalMailReady } from '@/lib/ncp-sens-mail'
import { agencyMailReady } from '@/features/agency-console/api/agency-auth.routes'
import { stripComments } from '../helpers/source-text'

const SENS = { NCP_ACCESS_KEY: 'a', NCP_SECRET_KEY: 's', NCP_MAIL_SENDER: 'no-reply@urdeal.kr', NCP_SENS_MAIL_SERVICE_ID: 'ncp:mail:kr:1:main' }

describe('판정', () => {
  it('Resend 키 또는 SENS 메일 셋 중 하나만 있어도 보낸다', () => {
    expect(transactionalMailReady({ RESEND_API_KEY: 'k' })).toBe(true)
    expect(transactionalMailReady(SENS)).toBe(true)
    expect(transactionalMailReady({ ...SENS, NCP_MAIL_SENDER: '' })).toBe(false)
    expect(transactionalMailReady({})).toBe(false)
    expect(transactionalMailReady(null)).toBe(false)
  })
  it('에이전시 메일도 SENS 만으로 준비됨', () => {
    expect(agencyMailReady(SENS as never)).toBe(true)
    expect(agencyMailReady({ RESEND_API_KEY: 'k', RESEND_FROM: 'a@b.c' })).toBe(true)
    expect(agencyMailReady({ RESEND_API_KEY: 'k' })).toBe(false) // 종전 규칙 유지(발신 주소 없는 Resend 는 계정 주인에게만 간다)
  })
})

describe('호출부가 Resend 키만 보고 건너뛰지 않는다', () => {
  const code = (p: string) => stripComments(readFileSync(p, 'utf8'))
  const SITES: Array<[string, RegExp]> = [
    ['src/lib/system-email.ts', /if \(!transactionalMailReady\(env\)\) return \{ success: false, skipped: true \}/],
    ['src/features/group-buy/api/group-buy.routes.ts', /if \(userEmail && transactionalMailReady\(c\.env\)\)/],
    ['src/features/auth/api/seller.routes.ts', /if \(transactionalMailReady\(c\.env\)\)/],
    ['src/worker/cron/seller-daily-report.ts', /if \(!transactionalMailReady\(env\)\)/],
    ['src/worker/cron/channel-watchdog.ts', /email: transactionalMailReady\(env\)/],
  ]
  for (const [f, re] of SITES) it(f, () => expect(code(f)).toMatch(re))
  it('위 파일들에 "RESEND_API_KEY 없으면 건너뛰기" 모양이 남지 않았다', () => {
    for (const [f] of SITES) {
      const c = code(f)
      expect(c, f).not.toMatch(/if \(!(?:apiKey|resendKey|RESEND_API_KEY)\)\s*(?:\{|return)/)
      expect(c, f).not.toMatch(/&& \(c\.env as [^)]*\)\.RESEND_API_KEY\)/)
    }
  })
  it('셀러 일일 리포트가 Resend 를 직접 부르지 않고 공용 발송을 쓴다(SENS 경로)', () => {
    const c = code('src/worker/cron/seller-daily-report.ts')
    expect(c).not.toMatch(/api\.resend\.com/)
    expect(c).toMatch(/await sendEmail\(/)
  })
})
