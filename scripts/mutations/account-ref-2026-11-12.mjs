/** 🧬 주입 — 계정이 기억하는 마지막 소개 링크 (2026-11-12) · 가드: src/tests/unit/account-ref-2026-11-12.test.ts */
const T = 'src/tests/unit/account-ref-2026-11-12.test.ts'
const F = 'src/worker/utils/account-ref.ts'
export default [
  { name: 'acctref: 더 이른 링크가 늦은 링크를 덮는다', file: F,
    find: ' WHERE excluded.at >= user_ref_touch.at', replace: '', test: T,
    why: '폰에서 먼저 누른 링크가 PC 에서 나중에 누른 링크를 이겨 "마지막 링크 우선" 이 깨진다.' },
  { name: 'acctref: 24시간이 지나도 성과가 붙는다', file: F,
    find: '`SELECT ref_id FROM user_ref_touch WHERE user_id = ? AND at >= ? LIMIT 1`', replace: '`SELECT ref_id FROM user_ref_touch WHERE user_id = ? AND ? IS NOT NULL LIMIT 1`', test: T,
    why: '며칠 전 링크가 오늘 결제의 성과를 가져간다(브라우저 24시간 규칙과 갈린다).' },
  { name: 'acctref: 자기 링크를 계정에 남긴다', file: F,
    find: " || ref === String(userId)) return false", replace: ') return false', test: T,
    why: '자기 링크로 자기 성과를 만든다(결제 경로가 한 번 더 막지만 기록이 틀린다).' },
  { name: 'acctref: 카드 결제가 계정 기록을 안 본다', file: 'src/features/group-buy/api/group-buy.routes.ts',
    find: "  const refRaw = await preferAccountRef(DB, userId, pickGbRefSource(body.ref, c.req.header('X-Affiliate-Ref'), getCookie(c, 'affiliate_ref'))) // 🔗 /join 과 같은 출처",
    replace: "  const refRaw = pickGbRefSource(body.ref, c.req.header('X-Affiliate-Ref'), getCookie(c, 'affiliate_ref')) // 🔗 /join 과 같은 출처",
    test: T, why: '폰에서 링크를 누르고 PC 에서 카드로 산 결제가 다시 무귀속이 된다.' },
  { name: 'acctref: 로그인해도 계정에 안 보낸다', file: 'src/utils/affiliate-track.ts',
    find: '    if (!loggedIn) return\n    syncAccountRef()', replace: '    if (!loggedIn) return', test: T,
    why: '로그인 전에 누른 링크가 계정에 안 남아 다른 기기 결제에서 빠진다.' },
  { name: 'acctref: 숙소 예약이 계정 기록을 안 본다', file: 'src/features/group-buy/api/stay-referral.ts',
    find: "  const id = acc || (raw == null ? '' : String(raw).trim())", replace: "  const id = raw == null ? '' : String(raw).trim()", test: T,
    why: '폰에서 링크를 누르고 PC 에서 숙소를 예약하면 소개 성과가 빠진다(이용권과 숙소가 다르게 동작).' },
]
