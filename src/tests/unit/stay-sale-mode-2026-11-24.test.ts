import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveStaySale, cleanStayUseNote, sellsStayVoucher, STAY_SALE_MODES, STAY_VALIDITY_OPTIONS, STAY_USE_NOTE_MAX } from '@/shared/stay-sale-mode'
import { stayStepError, emptyRoom } from '@/pages/seller-meal-voucher/booking-mode'
import { emptyVoucherForm } from '@/pages/seller-meal-voucher/voucher-form'
import { smsHref, telDigits, stayVoucherExpired } from '@/pages/my-stays/StayVoucherContact'
import { expiredVoucherSelectSql, expiredVoucherClaimSql } from '@/worker/cron/expired-voucher-refund-sql'
import { stayCancelRefundRate } from '@/features/group-buy/api/stay-cancel-amount'

/**
 * 🏨 숙박 이용권 '먼저 판매' 기본 — 결재 `docs/decisions/archive/2026-11-24-stay-voucher-buy-first.md` (대표 "추천대로 진행").
 *
 * 고정하는 것:
 *   Q1 등록 화면의 기본값은 먼저 판매이고, 서버가 더는 `date` 로 덮어쓰지 않는다.
 *   Q3 먼저 판매(`voucher`·`both`)는 유효기간 3·6·12개월이 없으면 화면·서버 둘 다 막는다.
 *   Q5 이용 안내는 `house_rules` 로 저장돼 구매 전 화면(먼저 판매 상자)에 보인다.
 *   Q2 구매 뒤 화면에 매장 전화·문자 버튼이 붙는다(번호가 있을 때).
 *   Q4 기간이 지난 숙소 이용권은 **환불하지 않고 이용 처리한다**(2026-11-25 대표가 Q4-1 '자동 환불' 을 바꿨다).
 *      만료 환불은 숙소를 전부 빼고, `cron/stay-no-show.ts` 가 닫는다 — 상세 판정은 `stay-no-show-2026-11-25.test.ts`.
 * 못 막는 것: 실결제 흐름(구매 → 사용 처리 → 취소 환불 → 만료 환불) — staging 에서 본다(S-STAYFIRST).
 */
const okRoom = { ...emptyRoom(), name: '오션뷰', price_weekday: 80000, price_weekend: 120000 }

describe('판매 방식 판정 (화면·서버 공용)', () => {
  it('선택지: 먼저 판매가 맨 앞, 유효기간은 90·180·365일', () => {
    expect(STAY_SALE_MODES[0].value).toBe('voucher')
    expect(STAY_VALIDITY_OPTIONS.map((o) => o.days)).toEqual([90, 180, 365])
  })
  it('먼저 판매는 유효기간이 선택지 밖이면 막는다', () => {
    expect(resolveStaySale({ sale_mode: 'voucher' }).ok).toBe(false)
    expect(resolveStaySale({ sale_mode: 'voucher', voucher_validity_days: 100 }).ok).toBe(false)
    expect(resolveStaySale({ sale_mode: 'both', voucher_validity_days: 0 }).ok).toBe(false)
    expect(resolveStaySale({ sale_mode: 'voucher', voucher_validity_days: 90 })).toEqual({ ok: true, sale_mode: 'voucher', voucher_validity_days: 90 })
    expect(resolveStaySale({ sale_mode: 'both', voucher_validity_days: '365' })).toEqual({ ok: true, sale_mode: 'both', voucher_validity_days: 365 })
  })
  it('날짜 지정은 유효기간 없이 통과하고, 모르는 값·빈 값은 날짜 지정(옛 화면 호환)', () => {
    expect(resolveStaySale({ sale_mode: 'date' })).toEqual({ ok: true, sale_mode: 'date', voucher_validity_days: 180 })
    expect(resolveStaySale({})).toMatchObject({ ok: true, sale_mode: 'date' })
    expect(resolveStaySale({ sale_mode: 'free' })).toMatchObject({ ok: true, sale_mode: 'date' })
    expect(sellsStayVoucher('date')).toBe(false)
    expect(sellsStayVoucher('both')).toBe(true)
  })
  it('이용 안내는 공백을 떼고 길이를 자른다', () => {
    expect(cleanStayUseNote('  설 연휴 불가  ')).toBe('설 연휴 불가')
    expect(cleanStayUseNote('   ')).toBeNull()
    expect(cleanStayUseNote(123)).toBeNull()
    expect(cleanStayUseNote('가'.repeat(500))?.length).toBe(STAY_USE_NOTE_MAX)
  })
})

describe('등록 화면', () => {
  it('새 폼의 기본은 먼저 판매이고 유효기간은 아직 안 고른 상태(0)', () => {
    const f = emptyVoucherForm()
    expect(f.stay_sale_mode).toBe('voucher')
    expect(f.stay_validity_days).toBe(0)
  })
  it('[다음] 판정: 객실 → 유효기간 순으로 막는다', () => {
    expect(stayStepError({ stay_rooms: [emptyRoom()], stay_sale_mode: 'voucher', stay_validity_days: 90 })).toMatch(/이름/)
    expect(stayStepError({ stay_rooms: [okRoom], stay_sale_mode: 'voucher', stay_validity_days: 0 })).toMatch(/유효기간/)
    expect(stayStepError({ stay_rooms: [okRoom], stay_sale_mode: 'voucher', stay_validity_days: 180 })).toBeNull()
    expect(stayStepError({ stay_rooms: [okRoom], stay_sale_mode: 'date', stay_validity_days: 0 })).toBeNull()
  })
  it('등록 요청이 판매 방식·유효기간·이용 안내를 실어 보낸다', () => {
    const s = readFileSync('src/pages/seller-meal-voucher/booking-submit.ts', 'utf8')
    expect(s).toMatch(/sale_mode: form\.stay_sale_mode, voucher_validity_days: form\.stay_validity_days, house_rules: form\.stay_use_note/)
  })
})

describe('서버 배선', () => {
  const s = readFileSync('src/features/seller/api/seller-stays.routes.ts', 'utf8')
  it('등록 경로가 판매 방식을 date 로 덮어쓰지 않고 판정 결과를 저장한다', () => {
    const i = s.indexOf("sellerStaysRoutes.post('/stays/:productId/info'")
    const block = s.slice(i, s.indexOf('// ─── 4. stay_info 수정'))
    expect(block).not.toMatch(/sale_mode: 'date'/)
    expect(block).toMatch(/const sale = resolveStaySale\(body\)/)
    expect(block).toMatch(/if \(!sale\.ok\) return c\.json\(\{ success: false, error: sale\.error \}, 400\)/)
    expect(block).toMatch(/sale_mode: sale\.sale_mode, voucher_validity_days: sale\.voucher_validity_days/)
  })
  it('수정 경로도 같은 판정을 쓴다', () => {
    const block = s.slice(s.indexOf('// ─── 4. stay_info 수정'), s.indexOf('// ─── 4. stay_info 수정') + 1600)
    expect(block).toMatch(/if \(body\.sale_mode !== undefined\) \{\s+const sale = resolveStaySale\(body\)/)
  })
})

describe('손님 화면', () => {
  it('구매 전: 먼저 판매 상자에 이용 안내가 보인다', () => {
    const s = readFileSync('src/pages/StayDetailPage.tsx', 'utf8')
    expect(s).toMatch(/\{stay\.house_rules && <p[^>]*>이용 안내: \{stay\.house_rules\}<\/p>\}/)
  })
  it('구매 뒤: 내 숙소 예약이 매장 번호를 받아 연락 버튼을 그린다', () => {
    expect(readFileSync('src/features/group-buy/api/stays-public.routes.ts', 'utf8')).toMatch(/p\.restaurant_phone as store_phone/)
    expect(readFileSync('src/pages/MyStaysPage.tsx', 'utf8')).toMatch(/<StayVoucherContact phone=\{b\.store_phone\}/)
  })
  it('전화·문자 주소', () => {
    expect(telDigits('02-333-5325')).toBe('023335325')
    expect(telDigits(null)).toBe('')
    const href = smsHref('01012345678', '바다펜션', 'AB12')
    expect(href.startsWith('sms:01012345678?&body=')).toBe(true)
    expect(decodeURIComponent(href)).toContain('이용권 코드 AB12')
    expect(decodeURIComponent(smsHref('01012345678', '바다펜션', null))).not.toContain('이용권 코드')
  })
})

describe('Q4 기간이 지난 숙소 이용권 — 환불이 아니라 이용 처리(결재 Q4-1 을 2026-11-25 대표가 바꿨다)', () => {
  const unify = readFileSync('src/features/group-buy/api/stay-voucher-unify.ts', 'utf8')
  it('먼저 판매 이용권의 만료 시각은 예약의 voucher_expires_at 그대로다', () => {
    expect(unify).toMatch(/if \(b\.sale_mode === 'voucher'\) return b\.voucher_expires_at \|\| null/)
    expect(unify).toMatch(/INSERT OR IGNORE INTO vouchers \(order_id, product_id, user_id, code, expires_at,[^)]*stay_booking_id\)/)
    expect(unify).toMatch(/codes\[i\], stayVoucherExpiresAt\(b\),/)
  })
  it('만료 환불 조회·선점 SQL 은 숙소 이용권을 전부 뺀다 — 숙소는 기간이 지나면 환불이 아니라 이용 처리(2026-11-25 대표)', () => {
    for (const sql of [expiredVoucherSelectSql(true), expiredVoucherSelectSql(false), expiredVoucherClaimSql(true), expiredVoucherClaimSql(false)]) {
      expect(sql).toMatch(/stay_booking_id IS NULL/)
    }
  })
  it('사장님 수동 [사용 처리] 가 묶인 이용권도 사용 처리한다(안 하면 지갑에 사용 가능으로 남는다)', () => {
    const s = readFileSync('src/features/seller/api/seller-stays.routes.ts', 'utf8')
    const i = s.indexOf("'voucher 사용 — 실제 체크인-체크아웃'")
    expect(i).toBeGreaterThan(0)
    expect(s.slice(i, i + 700)).toMatch(/settleStayVoucherAfterManual\(c\.env\.DB, \{ bookingId, sellerId/)
  })
  it('만료 뒤 셀프 취소는 0원이다', () => {
    // 2026-11-25: 계산이 stay-cancel-amount.ts 로 옮겨졌다 — 글자 대신 함수를 직접 부른다.
    const now = Date.parse('2026-11-25T00:00:00Z')
    expect(stayCancelRefundRate({ sale_mode: 'voucher', voucher_expires_at: '2026-11-24 14:59:59' }, 'standard', NaN, now)).toBe(0)
    expect(stayCancelRefundRate({ sale_mode: 'voucher', voucher_expires_at: '2026-11-26 14:59:59' }, 'standard', NaN, now)).toBe(1)
    expect(stayCancelRefundRate({ sale_mode: 'voucher', voucher_expires_at: '2026-11-26 14:59:59', voucher_used_at: '2026-11-24 01:00:00' }, 'standard', NaN, now)).toBe(0)
    expect(readFileSync('src/features/group-buy/api/stays-public.routes.ts', 'utf8')).toMatch(/const refundRate = sca\.stayCancelRefundRate\(booking, policy, hoursUntil\)/)
  })
  it('만료된 이용권에는 연락 버튼을 그리지 않는다', () => {
    const now = Date.parse('2026-11-25T00:00:00Z')
    expect(stayVoucherExpired('2026-11-24 14:59:59', now)).toBe(true)
    expect(stayVoucherExpired('2026-11-25 14:59:59', now)).toBe(false)
    expect(stayVoucherExpired(null, now)).toBe(false)
    expect(readFileSync('src/pages/MyStaysPage.tsx', 'utf8')).toMatch(/!stayVoucherExpired\(b\.voucher_expires_at\) && <StayVoucherContact/)
  })
})
