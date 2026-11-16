/**
 * 📭 2026-11-16 — 배달될 수 없는 자리표시 주소(.invalid 등)로 메일을 보내지 않는다.
 *   라이브 실측: email_failures 실패 3건이 전부 `kakao-N@kakao.agency.urdeal.invalid`(카카오 에이전시 직원 자리표시)였고,
 *   재시도 cron 이 30분마다 다시 집어 끝나지 않았다.
 * ⚠️ 못 보는 것: 실제 발송 경로(SENS·Resend) 응답 · 다른 자리표시 규칙(`@store.invalid` 외 새 도메인을 만들면 여기 추가).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isUndeliverableAddress, sendSystemEmail } from '@/lib/system-email'
import { kakaoStaffEmail } from '@/shared/agency-kakao'

describe('배달될 수 없는 주소', () => {
  it('카카오 에이전시 자리표시 주소는 배달 불가로 판정한다', () => {
    expect(isUndeliverableAddress(kakaoStaffEmail(40))).toBe(true)
    expect(isUndeliverableAddress('a@store.invalid')).toBe(true)
    expect(isUndeliverableAddress('x@foo.test')).toBe(true)
  })
  it('진짜 주소는 막지 않는다', () => {
    expect(isUndeliverableAddress('someone@gmail.com')).toBe(false)
    expect(isUndeliverableAddress('ceo@invalid-corp.co.kr')).toBe(false)
    expect(isUndeliverableAddress(null)).toBe(false)
  })
  it('sendSystemEmail 은 보낼 수단이 있어도 그 주소엔 안 보낸다(실패 큐에도 안 넣는다)', async () => {
    const env = { RESEND_API_KEY: 'x', DB: { prepare: () => { throw new Error('DB 를 건드리면 안 된다') } } }
    const r = await sendSystemEmail(env, kakaoStaffEmail(3), { subject: 's', html: 'h' })
    expect(r).toMatchObject({ success: false, skipped: true, undeliverable: true })
  })
  it('재시도 cron 은 배달 불가 행을 닫는다(영원히 재시도하지 않는다)', () => {
    const src = readFileSync('src/worker/cron/retry-notifications.ts', 'utf8')
    expect(src).toMatch(/result\.undeliverable\)[\s\S]{0,300}resolved = 1/)
  })
})
