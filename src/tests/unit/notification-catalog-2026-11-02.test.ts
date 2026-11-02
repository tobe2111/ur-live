/**
 * 🔔 알림 카탈로그 — 2026-11-02 대표 *"알림창들 너무 TMI … 유저 가입, 에이전시 가입 이런 중요한 것들은
 * 알람이 하나도 안 오고 있어. 교환권 교환, 이용권 구입 등. 가장 이상적이고 영구적이며 체계적으로"*.
 *
 * 실측(2026-11-02 라이브): 어드민 알림 427건 = 크론 실패 177 · 일일 요약 83 · 정합 61 · 서버 오류 35 …
 * **가입·구매 0건.** 유저 알림함엔 `주문 상태: PREPARING` · `(대표 지시 — 본인 계정 10만딜 추가)` 가 떴다.
 *
 * 이 시험이 지키는 것:
 *   ① 코드에 있는 **모든** 어드민 알림 종류가 카탈로그에 등록돼 있다(새 종류 = 칸을 정해야 머지된다)
 *   ② 핵심 사건 다섯(유저 가입·에이전시 가입·입점 신청·이용권 구매·교환권 교환)이 업무 칸이고, 실제로 그 자리에서 보낸다
 *   ③ 시스템 소음(크론·요약·성능)은 업무 칸에 안 든다 → 종의 빨간 숫자를 안 키운다
 *   ④ 유저·사장님 화면은 다듬은 말을 쓴다 — 라이브에 실제로 쌓인 행으로 확인
 *   ⑤ 숨김 종류는 목록과 미읽음 숫자 **둘 다**에서 빠진다(하나만 빠지면 '안 지워지는 유령 뱃지')
 *
 * ⚠️ **못 보는 것**: 문구가 *좋은지*(그건 사람이 본다) · 동적으로 조립한 type 문자열 ·
 *    `notifyUser` 류로 쓰는 유저 알림의 종류 전수(종류가 30개+이고 대부분 화면에서 다듬어지므로 쓰는 쪽은 강제하지 않는다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  ADMIN_NOTIF_GROUP, ADMIN_SYSTEM_TYPES, adminNotifGroup, HIDDEN_FOR_USER, HIDDEN_FOR_SELLER,
  presentNotification, typeNotInSql, NOTIF_MESSAGE_MAX,
} from '@/shared/notification-catalog'

const read = (p: string) => readFileSync(p, 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) { if (f !== 'tests' && f !== 'node_modules') walk(p, out) }
    else if (/\.ts$/.test(f) && !/\.test\.ts$/.test(f)) out.push(p)
  }
  return out
}

describe('① 어드민 알림 종류는 전부 카탈로그에 있다', () => {
  const files = walk('src')
  const found = new Map<string, string>()
  for (const f of files) {
    const s = read(f)
    // createDashboardNotification(DB, 'admin', null, 'type', …) — 줄바꿈이 끼어도 잡는다
    for (const m of s.matchAll(/createDashboardNotification\(\s*[\w.]+\s*,\s*'admin'\s*,\s*null\s*,\s*'([a-z_]+)'/g)) found.set(m[1]!, f)
    // notifyAdminEvent / scheduleAdminEvent({ type: 'x' })
    for (const m of s.matchAll(/(?:notify|schedule)AdminEvent\([^)]*?type:\s*'([a-z_]+)'/gs)) found.set(m[1]!, f)
  }

  it('스캔이 실제로 무언가를 찾았다(헛도는 검사 방지)', () => {
    expect(found.size).toBeGreaterThan(20)
  })

  it('미등록 종류 0', () => {
    const missing = [...found.entries()].filter(([t]) => !(t in ADMIN_NOTIF_GROUP)).map(([t, f]) => `${t} (${f})`)
    expect(missing, `notification-catalog.ts ADMIN_NOTIF_GROUP 에 칸(business/system)을 정해 등록할 것`).toEqual([])
  })
})

describe('② 핵심 사건 다섯은 업무 칸이고, 그 자리에서 실제로 보낸다', () => {
  const KEY = ['user_signup', 'agency_signup', 'store_registered', 'voucher_purchased', 'gifticon_purchased']
  it('다섯 다 business', () => {
    for (const t of KEY) expect(adminNotifGroup(t), t).toBe('business')
  })

  const WIRES: [string, RegExp][] = [
    ['src/features/auth/api/kakao.routes.ts', /type:\s*'user_signup'/],
    ['src/features/agency-console/api/agency-auth.routes.ts', /type:\s*'agency_signup'/],
    ['src/features/agency-console/api/agency-kakao.routes.ts', /type:\s*'agency_signup'/],
    ['src/features/seller/api/store-signup-extras.ts', /type:\s*'store_registered'/],
    ['src/features/group-buy/api/cart-checkout.routes.ts', /type:\s*'voucher_purchased'/],
  ]
  for (const [f, re] of WIRES) it(`${f} 가 보낸다`, () => expect(read(f)).toMatch(re))

  it('이용권 결제 두 경로(딜 /join · 카드 확정)가 모두 교환권/이용권을 갈라 보낸다', () => {
    const s = read('src/features/group-buy/api/group-buy.routes.ts')
    expect((s.match(/gift \? 'gifticon_purchased' : 'voucher_purchased'/g) || []).length).toBe(2)
  })

  it('유저 가입 알림은 응답 뒤에 보낸다(로그인 지연 0)', () => {
    const s = read('src/features/auth/api/kakao.routes.ts')
    expect(s).toMatch(/scheduleAdminEvent\(c, c\.env\.DB, \{ type: 'user_signup'/)
  })

  it('교환권 딜 결제 알림이 무엇을 샀는지 말한다', () => {
    const s = read('src/features/points/api/points.routes.ts')
    expect(s).not.toMatch(/'deal_payment', '딜 결제', `\$\{Number\(authoritativeTotal/)
    expect(s).toMatch(/'deal_payment', '교환권 교환 · 딜 결제'/)
  })
})

describe('③ 시스템 소음은 업무 칸이 아니다', () => {
  it.each(['cron_failure', 'ops_daily_digest', 'weekly_metrics', 'weekly_cohort_report', 'perf_slo', 'server_error', 'ledger_mismatch'])(
    '%s → system', (t) => expect(ADMIN_SYSTEM_TYPES).toContain(t))

  it('종 API 가 업무를 기본으로, 시스템은 따로 센다', () => {
    const s = read('src/features/notifications/api/dashboard-notifications.routes.ts')
    expect(s).toMatch(/: 'business';/)
    expect(s).toMatch(/AND type NOT IN \(\$\{systemIn\}\)/)
    expect(s).toMatch(/system_unread: systemUnread/)
  })

  it('종 화면이 두 칸을 그린다', () => {
    const s = read('src/components/DashboardNotificationBell.tsx')
    expect(s).toMatch(/\['business', '업무'/)
    expect(s).toMatch(/\['system', '시스템'/)
  })
})

describe('④ 유저·사장님 화면은 다듬은 말 — 라이브에 쌓인 실제 행', () => {
  const cases: [string, string, string | null, (r: ReturnType<typeof presentNotification>) => void][] = [
    ['order_status', '주문 상태: PREPARING', '주문번호: GB-3-1789611467065', (r) => {
      expect(r.title).toBe('주문이 준비 중이에요'); expect(r.message).toBeNull()
    }],
    ['admin_gift', '🎁 딜 선물 도착!', '100,000딜을 선물받으셨어요. (대표 지시 — 본인 계정 10만딜 추가 (2026-10-07))', (r) => {
      expect(r.title).toBe('딜 선물이 도착했어요'); expect(r.message).toBe('100,000딜이 들어왔어요')
    }],
    ['store_approved', '🏪 내 매장 승인 완료', '매장이 승인됐어요. 이용권이 메인에 노출돼요 — 정산 계좌를 등록하면 판매 대금이 지급됩니다', (r) => {
      expect(r.title).toBe('매장이 승인됐어요'); expect(r.message).not.toMatch(/정산/)
    }],
    ['voucher_issued', '🎟️ 식사 이용권이 발급됐어요', '홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트 ×1 — 보관함에서 확인하세요', (r) => {
      expect(r.title).toBe('식사 이용권이 발급됐어요'); expect(r.message).toBe('홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트 ×1')
    }],
    ['voucher_sold', '🎟️ 이용권 판매(카드)', '홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트 ×1 — ₩7,500', (r) => {
      expect(r.title).toBe('이용권이 팔렸어요')
    }],
  ]
  for (const [type, title, message, check] of cases) it(type, () => check(presentNotification({ type, title, message })))

  it('어떤 행이든 이모지 0 · 설명은 한 줄 길이', () => {
    const r = presentNotification({ type: 'whatever', title: '✨🎉 새 소식', message: '가'.repeat(200) })
    expect(r.title).toBe('새 소식')
    expect(r.message!.length).toBeLessThanOrEqual(NOTIF_MESSAGE_MAX)
  })

  it('어드민 선물 알림은 사유(어드민 메모)를 손님에게 쓰지 않는다', () => {
    const s = read('src/features/admin/api/admin-users.routes.ts')
    expect(s).not.toMatch(/딜을 선물받으셨어요\. \(\$\{reason\}\)/)
  })
})

describe('⑤ 숨김은 목록과 미읽음 숫자 둘 다에서', () => {
  it('숨김 목록 내용', () => {
    expect(HIDDEN_FOR_USER).toContain('seller_re_engage')
    expect(HIDDEN_FOR_SELLER).toContain('tier_change')
  })
  it('SQL 조각이 안전하다(꼴이 아닌 값은 던진다)', () => {
    expect(typeNotInSql(['a_b'])).toBe(" AND type NOT IN ('a_b')")
    expect(() => typeNotInSql(["x') OR 1=1 --"])).toThrow()
  })
  it('유저 목록 2곳 + 미읽음 숫자가 같은 숨김을 쓴다', () => {
    const social = read('src/features/social/api/social.routes.ts')
    expect((social.match(/typeNotInSql\(HIDDEN_FOR_USER\)/g) || []).length).toBe(2)
    expect(social).toMatch(/\.map\(presentRow\)/)
    const notif = read('src/features/notifications/api/notifications.routes.ts')
    expect((notif.match(/typeNotInSql\(HIDDEN_FOR_USER\)/g) || []).length).toBe(4) // 숫자 2 + 목록 2
  })
  it('사장님 알림함(마이)과 종이 같은 숨김을 쓴다', () => {
    expect(read('src/features/seller/api/seller-store-notifications.ts')).toMatch(/typeNotInSql\(HIDDEN_FOR_SELLER\)/)
    expect(read('src/features/notifications/api/dashboard-notifications.routes.ts')).toMatch(/typeNotInSql\(HIDDEN_FOR_SELLER\)/)
  })
})
