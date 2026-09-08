/**
 * 💰 매장 손바뀜 · 귀속 시점 — 회귀 가드 (2026-09-07)
 *
 * 대표: *"매장 가져오는 것에선 돈까지 귀속이 되면 안되지, 귀속되는 시점부터 계산해서
 * 성과 수익이 계산되어야 하지 않을까?"*
 *
 * 여기서 지키는 넷은 전부 **에러 없이 조용히 틀리는** 클래스다 — 화면도 로그도 정상이고,
 * 돈만 엉뚱한 데로 간다. 그래서 사람 눈이 아니라 가드가 유일한 방어다.
 *
 * ⚠️ 이 파일이 **못 막는 것**: 실제 D1 동작·실제 송금·승계 기능 자체(아직 없다).
 *   배선과 규칙만 본다. 판정은 staging.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')
/** 블록 주석을 **먼저 통째로** 지운다 — 줄 단위로 지우면 가운데 줄이 남아 헛도는 판정이 된다. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const GUARD = 'src/worker/utils/store-handover-guard.ts'
const ADMIN = 'src/features/admin/api/admin-sellers.routes.ts'
const KAKAO = 'src/features/seller/api/seller-kakao-link.routes.ts'
const LEDGER = 'src/worker/utils/ledger.ts'
const GB = 'src/features/group-buy/api/group-buy.routes.ts'
const PAYOUT = 'src/worker/cron/payouts-generate.ts'
const SCOPE = 'src/worker/utils/settlement-scope.ts'
const PAYOUTS = 'src/features/seller/api/seller-settlements/payouts.ts'
const REASSIGN = 'src/features/admin/api/admin-sellers/reassign-introducer.ts'

describe('🔐 ① 미지급 잔액이 남은 매장은 주인을 못 바꾼다', () => {
  it('가드가 잔액을 실제로 조회한다', () => {
    const g = strip(read(GUARD))
    expect(g, `${GUARD}: 잔액 조회가 없으면 이 가드는 아무것도 안 막는다`)
      .toMatch(/getLedgerReceivable\(DB, `seller:\$\{sellerId\}`\)/)
  })

  it('최초 연결·같은 사람은 막지 않는다 (손바뀜이 아니다)', () => {
    const g = strip(read(GUARD))
    expect(g).toMatch(/if \(!prevUserId \|\| Number\(prevUserId\) === Number\(nextUserId\)\)/)
  })

  it('조회 실패는 fail-closed 다 — 모르면 막는다', () => {
    // 돈이 걸린 판단에서 "모르겠으면 통과" 는 오지급으로 직행한다.
    const g = strip(read(GUARD))
    // 🩸 첫 판에서 이 단언은 `/catch \{[\s\S]{0,200}blocked: true/` 였는데 **헛돌았다** —
    //   이 파일엔 catch 가 둘이고(매장 조회·잔액 조회), 앞의 것이 먼저 매치돼 뒤쪽을 통째로 열어도
    //   초록이었다. 주입 검증이 그걸 잡았다. ⇒ **잔액 조회 catch 로 앵커를 좁힌다.**
    expect(g, `${GUARD}: 잔액 조회 catch 에서 통과시키면 D1 장애 때 손바뀜이 그대로 열린다`)
      .toMatch(/getLedgerReceivable[\s\S]{0,120}\} catch \{[\s\S]{0,160}blocked: true/)
  })

  it('손바뀜 경로 3곳에 전부 배선돼 있다', () => {
    // 한 곳만 열려 있으면 그 문으로 다 나간다.
    expect(strip(read(ADMIN)), `${ADMIN}: 어드민 링크 경로에 가드가 없다`).toMatch(/checkStoreHandover\(/)
    const k = strip(read(KAKAO))
    expect(k.match(/checkStoreHandover\(/g)?.length, `${KAKAO}: 두 경로(최초 연동·재연결) 모두 필요하다`)
      .toBeGreaterThanOrEqual(2)
  })
})

describe('🏷️ ② 판매자 없는 상품이 seller:null 로 적립되지 않는다', () => {
  it('계정 이름 SSOT 가 null 을 platform:revenue 로 보낸다', () => {
    const l = strip(read(LEDGER))
    expect(l).toMatch(/export function sellerLedgerAccount/)
    expect(l, `${LEDGER}: null 이 seller: 로 새면 유령 계정이 다시 생긴다`)
      .toMatch(/Number\.isFinite\(id\) && id > 0 \? `seller:\$\{id\}` : 'platform:revenue'/)
  })

  it('공구 적립·차감이 그 SSOT 를 쓴다 (raw 보간 0)', () => {
    const g = strip(read(GB))
    expect(g, `${GB}: seller:\${product.seller_id} 가 되살아났다 — seller_id 는 nullable 이다`)
      .not.toMatch(/`seller:\$\{product\.seller_id\}`/)
    expect(g).toMatch(/sellerLedgerAccount\(product\.seller_id\)/)
  })

  it('payout 이 숫자 아닌 계정 id 를 거른다 (두 번째 방어선)', () => {
    // 'seller:null' 은 id='null'(truthy 문자열)이라 기존 `if (!id) continue` 를 통과했다.
    const p = strip(read(PAYOUT))
    expect(p, `${PAYOUT}: 계좌 없는 유령 payout 이 다시 만들어진다`).toMatch(/\/\^\\d\+\$\/\.test\(id\)/)
  })
})

describe('👥 ③ 운영자는 합류 전 정산을 보지 않는다', () => {
  it('소유자/운영자를 실제로 가른다', () => {
    const s = strip(read(SCOPE))
    expect(s, `${SCOPE}: owner 게이트가 사라지면 위임받은 사람에게 이전 주인의 정산이 열린다`)
      .toMatch(/resolveStoreActor\(/)
    expect(s).toMatch(/actor\.isOwner/)
  })

  it('자를 기준이 granted_at 이다', () => {
    expect(strip(read(SCOPE))).toMatch(/SELECT granted_at FROM seller_operators/)
  })

  it('관계를 못 찾으면 가장 좁게 자른다 (모르면 안 보여 준다)', () => {
    const s = strip(read(SCOPE))
    expect(s, `${SCOPE}: 조회 실패 시 전체가 열리면 게이트가 없는 것과 같다`)
      .toMatch(/const DENY_ALL = '9999-12-31'/)
    expect(s).toMatch(/g\?\.granted_at \|\| DENY_ALL/)
  })

  it('payouts 조회가 그 기준을 실제로 쓴다', () => {
    // 계산만 하고 WHERE 에 안 넣으면 종전과 똑같다.
    const p = strip(read(PAYOUTS))
    expect(p).toMatch(/resolveSettlementScope\(/)
    expect(p).toMatch(/AND \(\? IS NULL OR created_at >= \?\)/)
  })
})

describe('⏳ ④ 영입자 시점 처리', () => {
  it('새 영입자를 붙이면 옛 만료일을 지운다', () => {
    // isStoreIntroExpired 는 referral_bonus_until 이 있으면 그것만 보고 introduced_at 을 무시한다.
    // 안 지우면 새 영입자에게 **이전 영입자의 만료일**이 적용된다.
    const r = strip(read(REASSIGN))
    expect(r, `${REASSIGN}: referral_bonus_until 을 안 지우면 새 영입자 창이 안 열린다`)
      .toMatch(/introduced_at = datetime\('now'\), referral_bonus_until = NULL/)
  })

  it('영입자를 비울 때는 introduced_at 을 건드리지 않는다', () => {
    // 영입자가 없어졌는데 "방금 영입됐다" 고 적으면 거짓이고 다음 귀속의 기준이 오염된다.
    const r = strip(read(REASSIGN))
    expect(r).toMatch(/newId != null\s*\n?\s*\? `, introduced_at/)
  })

  it('이용권 사용 레일이 결제 레일과 같은 만료 규칙을 쓴다', () => {
    // 종전엔 referral_bonus_until 만 봤고 NULL 이면 **무기한**이었다 — 같은 영입 관계인데
    // 레일마다 기간이 달랐다.
    const l = strip(read(LEDGER))
    expect(l, `${LEDGER}: 사용 레일이 다시 무기한이 된다`).toMatch(/isStoreIntroExpired\(seller, introMonths\)/)
  })
})
