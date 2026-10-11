/**
 * 📅 이용권 만료일 → 카카오톡 캘린더 (2026-10-11 대표 "1,2,4 해줄래" 중 2번)
 *
 * 지키는 것
 *  ① 일정 날짜 = `expires_at − 1초` 의 KST 날짜, 오전 10시(01:00Z) 30분짜리
 *  ② 알림은 아직 안 지난 것만, 최대 2개
 *  ③ 만료됐거나 만료 직전이면 일정을 안 만든다(null)
 *  ④ 라우트: 게이트 · 소유권(user_id) · unused 만 · kek 전달 · 401 대신 403
 *  ⑤ 동의 콜백: state 에서 돌아갈 경로를 꺼낸다(종전엔 늘 '/') · 남긴 할 일을 실행한다
 *
 * ⚠️ 못 막는 것: 카카오가 이 요청 모양을 실제로 받는지(이 컨테이너는 kapi.kakao.com 실호출 불가).
 *   게이트를 켠 뒤 대표 계정으로 한 번 넣어 보는 것이 유일한 판정이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildVoucherExpiryEvent, isKakaoConsentError, parseUtcMs } from '@/features/kakao-social/voucher-calendar'
import { consentReturnPath } from '@/pages/KakaoConsentCallbackPage'
import { stripComments } from '../helpers/source-text'

const NOW = Date.parse('2026-10-11T03:00:00Z') // 12:00 KST

describe('① 일정 날짜와 시각', () => {
  it('UTC-naive 23:59:59 KST 만료 → 그 날 10:00 KST', () => {
    const ev = buildVoucherExpiryEvent({ productName: '돈가스', expiresAt: '2026-11-10 14:59:59' }, NOW)!
    expect(ev.time.start_at).toBe('2026-11-10T01:00:00Z')
    expect(ev.time.end_at).toBe('2026-11-10T01:30:00Z')
    expect(ev.time.time_zone).toBe('Asia/Seoul')
  })
  it('KST 자정(전날 15:00Z) 만료는 "전날까지" — 1초를 빼서 전날 날짜', () => {
    const ev = buildVoucherExpiryEvent({ productName: 'x', expiresAt: '2026-11-10 15:00:00' }, NOW)!
    expect(ev.time.start_at).toBe('2026-11-10T01:00:00Z')
  })
  it('ISO(Z) 도 같은 규약', () => {
    expect(parseUtcMs('2026-11-10T14:59:59Z')).toBe(parseUtcMs('2026-11-10 14:59:59'))
  })
  it('오늘 만료인데 10시가 지났으면 지금 이후 5분 단위로', () => {
    const ev = buildVoucherExpiryEvent({ productName: 'x', expiresAt: '2026-10-11 14:59:59' }, NOW)!
    const start = Date.parse(ev.time.start_at)
    expect(start).toBeGreaterThan(NOW)
    expect(start % (5 * 60_000)).toBe(0)
  })
})

describe('② 알림', () => {
  it('멀리 있으면 3일 전·하루 전', () => {
    const ev = buildVoucherExpiryEvent({ productName: 'x', expiresAt: '2026-11-10 14:59:59' }, NOW)!
    expect(ev.reminders).toEqual([4320, 1440])
  })
  it('지난 알림은 빼고 남은 것만', () => {
    const ev = buildVoucherExpiryEvent({ productName: 'x', expiresAt: '2026-10-12 14:59:59' }, NOW)!
    expect(ev.reminders).toEqual([1440, 60].filter((m) => Date.parse(ev.time.start_at) - m * 60_000 > NOW))
    expect(ev.reminders!.length).toBeLessThanOrEqual(2)
  })
})

describe('③ 만들지 않는 경우', () => {
  it('만료 지남 / 만료일 없음 / 만료 직전', () => {
    expect(buildVoucherExpiryEvent({ productName: 'x', expiresAt: '2026-10-10 00:00:00' }, NOW)).toBeNull()
    expect(buildVoucherExpiryEvent({ productName: 'x', expiresAt: null }, NOW)).toBeNull()
    expect(buildVoucherExpiryEvent({ productName: 'x', expiresAt: '2026-10-11 03:05:00' }, NOW)).toBeNull()
  })
  it('제목 50자 · 매장 위치', () => {
    const ev = buildVoucherExpiryEvent({
      productName: '가'.repeat(80), storeName: '돈가스집', address: '전주시 어딘가', lat: 35.8, lng: 127.1,
      expiresAt: '2026-11-10 14:59:59',
    }, NOW)!
    expect(Array.from(ev.title).length).toBeLessThanOrEqual(50)
    expect(ev.location).toEqual({ name: '돈가스집', address: '전주시 어딘가', latitude: 35.8, longitude: 127.1 })
  })
  it('권한 오류 판정 — 다른 오류로 동의 화면을 반복시키지 않는다', () => {
    expect(isKakaoConsentError({ code: -402, msg: 'insufficient scopes.' })).toBe(true)
    expect(isKakaoConsentError({ code: -401 })).toBe(true)
    expect(isKakaoConsentError({ code: -2, msg: 'invalid parameter' })).toBe(false)
    expect(isKakaoConsentError(null)).toBe(false)
  })
})

describe('④ 라우트 배선', () => {
  const src = stripComments(readFileSync('src/features/kakao-social/api/kakao-social.routes.ts', 'utf8'))
  const block = src.slice(src.indexOf("'/calendar/voucher',"), src.indexOf("'/calendar/ics/:streamId'"))
  it('게이트 · 소유권 · unused · kek · 403', () => {
    expect(block).toContain("KAKAO_TALK_CALENDAR_ENABLED !== 'true'")
    expect(block).toMatch(/WHERE v\.code = \? AND v\.user_id IN \(\?, \?\)/)
    expect(block).toContain("v.status !== 'unused'")
    expect(block).toMatch(/c\.env\.DATA_ENCRYPTION_KEY,\s*\)/)
    expect(block).toContain("'KAKAO_SCOPE_REQUIRED', required_scope: 'talk_calendar' }, 403)")
  })
  it('공개 가용성 엔드포인트가 같은 게이트를 읽는다', () => {
    expect(src).toMatch(/'\/calendar\/voucher\/available'[\s\S]{0,200}KAKAO_TALK_CALENDAR_ENABLED === 'true'/)
  })
})

describe('⑤ 동의 콜백', () => {
  it('state 의 base64 경로로 돌아간다', () => {
    expect(consentReturnPath('uuid-123:' + btoa('/my-vouchers'))).toBe('/my-vouchers')
    expect(consentReturnPath(null)).toBe('/')
    expect(consentReturnPath('uuid-only')).toBe('/')
    expect(consentReturnPath('u:' + btoa('https://evil.example'))).toBe('/')
  })
  it('성공하면 남긴 할 일을 실행한다 · 버튼은 지갑 모달에 있다', () => {
    const page = stripComments(readFileSync('src/pages/KakaoConsentCallbackPage.tsx', 'utf8'))
    expect(page).toContain('await runPendingKakaoAction()')
    const modal = stripComments(readFileSync('src/pages/my-vouchers/QRModal.tsx', 'utf8'))
    expect(modal).toContain('<TalkCalendarButton code={voucher.code} />')
  })
})
