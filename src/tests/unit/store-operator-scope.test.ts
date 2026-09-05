/**
 * 🏪 2026-09-04 — 위임받은 운영자(중개사)의 **권한 범위**. 대표 확정: *"주인만, 단 마스킹해서 보여줌"*.
 *
 * ## 무엇이 문제였나
 * 셀러 토큰은 `seller_id` 하나로 그 매장의 전부를 열었다. 그래서 남의 매장을 대신 운영하는 중개사가
 * 사장님의 **정산계좌를 갈아끼우고** 사업자정보를 고칠 수 있었다 — 그 매장의 돈이 통째로 딴 데로 간다.
 * 화면에도 서버에도 경고가 없었다(권한 자체가 없었으니 위반도 아니었다).
 *
 * ## 판별 근거
 * 토큰의 `operator_user_id` — `/stores/:id/token` 이 **위임으로 들어갈 때만** 심는다.
 * ⚠️ `resolveActorUserId` + `isStoreOwner` 로 판정하면 **안 된다**: 그 헬퍼는 소비자 세션이 없을 때
 * `sellers.linked_user_id`(= *매장 주인*의 id)로 폴백해서, 세션 없는 요청에서 운영자를 주인으로 오판한다.
 *
 * ## 이 테스트가 못 막는 것
 * 소스에 게이트가 **있는지**만 본다 — 런타임에 실제로 403 이 나는지는 staging 확인 몫이다.
 * 새로 생기는 민감 엔드포인트는 여기 목록에 직접 추가해야 한다(자동으로 안 잡힌다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

const ACTOR = codeOnly(readFileSync('src/worker/utils/store-actor.ts', 'utf-8'))
const PROFILE = codeOnly(readFileSync('src/features/seller/api/seller-profile.routes.ts', 'utf-8'))
// 🧱 2026-09-04: 사업자 정보 3핸들러는 `seller-profile/business-info.ts` 로 분리됐다(file-size 래칫).
//    ⚠️ 이 상수를 안 나누면 "낡은 지도"가 된다 — 실제로 분리 직후 이 시험 3건이 빨간불이었다.
const BIZINFO = codeOnly(readFileSync('src/features/seller/api/seller-profile/business-info.ts', 'utf-8'))
const WITHDRAW = codeOnly(readFileSync('src/features/seller/api/seller-withdraw.routes.ts', 'utf-8'))

describe('행위자 판별 — 토큰이 들고 있는 사실만 본다', () => {
  it('`operator_user_id` 로 판정한다', () => {
    expect(ACTOR).toContain('operator_user_id')
    expect(ACTOR).toMatch(/isOwner: operatorUserId === null/)
  })

  it("type !== 'seller' 토큰은 통과 못 한다", () => {
    expect(ACTOR).toMatch(/p\.type !== 'seller'/)
  })

  it('🔴 linked_user_id 폴백을 쓰지 않는다 (운영자가 주인으로 오판되는 경로)', () => {
    // 이 한 줄이 이 모듈의 존재 이유다. 폴백이 들어오는 순간 게이트 전체가 무의미해진다.
    expect(ACTOR).not.toContain('linked_user_id')
    expect(ACTOR).not.toContain('resolveActorUserId')
  })
})

describe('정산 목적지 — 소유자만 바꾼다', () => {
  it('은행 필드 변경에 소유자 게이트가 있다', () => {
    const i = PROFILE.indexOf('const bankChanged =')
    expect(i, 'bankChanged 판정을 못 찾았다').toBeGreaterThan(0)
    const after = PROFILE.slice(i, i + 900)
    expect(after).toMatch(/resolveStoreActor/)
    expect(after).toMatch(/!actor\.isOwner/)
    expect(after).toMatch(/403/)
  })

  it('🔴 소유자 게이트가 PIN 검사보다 앞에 있다', () => {
    // PIN 은 *운영자 자신의* PIN 이라 이 사고를 못 막는다. 권한으로 먼저 끊어야 한다.
    // ⚠️ 파일 전체에서 `isPinVerified` 를 찾으면 **import 줄**(맨 위)에 걸려 늘 실패한다 —
    //    첫 판에 실제로 그랬다. `bankChanged` 이후 구간에서만 본다.
    const from = PROFILE.indexOf('const bankChanged =')
    expect(from).toBeGreaterThan(0)
    const region = PROFILE.slice(from)
    const gate = region.indexOf('actor.isOwner')
    const pin = region.indexOf('isPinVerified(')
    expect(gate, '소유자 게이트가 없다').toBeGreaterThan(0)
    expect(pin, 'PIN 호출을 못 찾았다').toBeGreaterThan(0)
    expect(gate).toBeLessThan(pin)
  })
})

describe('사업자 정보 — 읽기는 마스킹, 쓰기는 소유자만', () => {
  it('쓰기(POST/PUT/PATCH)가 소유자 게이트를 통과해야 한다', () => {
    const i = BIZINFO.indexOf("sellerProfileRoutes.on(['POST', 'PUT', 'PATCH'], '/business-info'")
    expect(i, '쓰기 라우트를 못 찾았다').toBeGreaterThan(0)
    const head = BIZINFO.slice(i, i + 700)
    expect(head).toMatch(/resolveStoreActor/)
    expect(head).toMatch(/403/)
  })

  it('읽기가 운영자에게 마스킹된다', () => {
    expect(BIZINFO).toMatch(/maskBusinessNumber/)
    expect(BIZINFO).toMatch(/masked_for_operator/)
  })

  it('🔴 시드 폴백 경로도 같은 마스킹을 탄다 (행이 없을 때만 새는 구멍)', () => {
    // 실제로 이 분기를 빠뜨리면 "사업자정보 행이 아직 없는 매장"에서만 원본이 샌다 —
    // 흔한 상태(신규 매장)인데 눈에 안 띈다.
    const i = BIZINFO.indexOf('buildBusinessInfoSeed(db, sellerId)')
    expect(i).toBeGreaterThan(0)
    const region = BIZINFO.slice(i, i + 700)
    // ⚠️ `masked_for_operator` 문자열 존재만 보면 **헛돈다** — 판정을 `{ isOwner: true }` 로
    //    하드코딩해도 그 문자열은 남는다(첫 판에 실제로 초록불이었다). 판정 호출까지 본다.
    expect(region, '시드 분기가 행위자를 실제로 판정하지 않는다').toMatch(/resolveStoreActor\s*\(/)
    expect(region).toMatch(/masked_for_operator/)
  })
})

describe('탈퇴 — 소유자만', () => {
  it('위임받은 운영자는 남의 매장을 지울 수 없다', () => {
    const i = WITHDRAW.indexOf("app.post('/account/withdraw'")
    expect(i).toBeGreaterThan(0)
    const head = WITHDRAW.slice(i, i + 900)
    expect(head).toMatch(/resolveStoreActor/)
    expect(head).toMatch(/!actor\.isOwner/)
    expect(head).toMatch(/403/)
  })
})

describe('마스킹 함수', () => {
  it('사업자등록번호는 끝 4자리만 남는다', async () => {
    const { maskBusinessNumber, maskName } = await import('@/worker/utils/store-actor')
    expect(maskBusinessNumber('123-45-67890')).toBe('***-**-*7890')
    expect(maskBusinessNumber('')).toBeNull()
    expect(maskBusinessNumber(null)).toBeNull()
    expect(maskName('정지원')).toBe('정**')
    expect(maskName('김')).toBe('김')
    expect(maskName(null)).toBeNull()
  })
})

describe('운영 매장 요약 — 중개사가 청구 근거를 보는 화면 (대표 확정)', () => {
  const OPS = codeOnly(readFileSync('src/features/seller/api/seller-operators.routes.ts', 'utf-8'))
  // ⚠️ 주석을 벗겨야 한다 — 이 파일의 설명이 스스로 '"내가 만든 매출"이라고 쓰면 거짓말'
  //    이라고 적고 있어서, 원문으로 보면 그 경고 문장에 검사가 걸린다(첫 판에 실제로 빨간불).
  const PAGE = codeOnly(readFileSync('src/pages/SellerOperatingSummaryPage.tsx', 'utf-8'))

  it('엔드포인트가 존재하고 운영 가능 매장으로만 좁힌다', () => {
    const i = OPS.indexOf("app.get('/operating-summary'")
    expect(i, '엔드포인트가 없다').toBeGreaterThan(0)
    const body = OPS.slice(i, i + 3000)
    // 스코프가 이 한 줄이다 — 빠지면 남의 매장 매출이 샌다.
    expect(body).toMatch(/listOperableStores\s*\(/)
    expect(body).toMatch(/resolveActorUserId\s*\(/)
  })

  it('🔴 확정된 주문만 센다 (PENDING 을 매출로 세면 청구 근거가 부풀려진다)', () => {
    const i = OPS.indexOf("app.get('/operating-summary'")
    const body = OPS.slice(i, i + 3000)
    expect(body).toMatch(/status IN \('PAID','DONE'/)
    expect(body).not.toMatch(/'PENDING'/)
  })

  it('위임 매장은 운영 시작 이후 구간을 함께 준다', () => {
    const i = OPS.indexOf("app.get('/operating-summary'")
    const body = OPS.slice(i, i + 3000)
    expect(body).toMatch(/granted_at/)
    expect(body).toMatch(/revenue_since_grant/)
  })

  it('🔴 화면이 "내 성과"라고 말하지 않는다', () => {
    // 운영자별 귀속은 추적하지 않는다. 매장 총액을 내 실적처럼 쓰면 그건 거짓말이다.
    expect(PAGE).toMatch(/매장의 매출/)
    expect(PAGE).not.toMatch(/내가 만든 매출|내 매출/)
  })
})
