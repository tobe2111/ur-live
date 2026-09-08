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
const CLOSEOUT = 'src/features/admin/api/admin-payouts/handover-closeout.ts'
const PAYROUTES = 'src/features/admin/api/admin-payouts.routes.ts'
const PAYPAGE = 'src/pages/AdminPayoutsPage.tsx'

describe('🔐 ① 미지급 잔액이 남은 매장은 주인을 못 바꾼다', () => {
  it('가드가 잔액을 실제로 조회한다 — 배정분을 뺀 값으로', () => {
    // 🩸 처음엔 getLedgerReceivable(순수 원장)이었는데, 그러면 **마감을 해도 안 줄어서**
    //   손바뀜이 영원히 막히는 막다른 길이 된다. 배정분을 뺀 값이라야 마감이 문을 연다.
    const g = strip(read(GUARD))
    expect(g, `${GUARD}: 잔액 조회가 없으면 이 가드는 아무것도 안 막는다`)
      .toMatch(/getUnsettledBalance\(DB, `seller:\$\{sellerId\}`\)/)
    expect(g, `${GUARD}: 순수 원장으로 되돌리면 마감해도 안 열린다`)
      .not.toMatch(/getLedgerReceivable\(DB, `seller:/)
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
      .toMatch(/getUnsettledBalance[\s\S]{0,120}\} catch \{[\s\S]{0,160}blocked: true/)
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

describe('🤝 ⑤ 손바뀜 마감 — 이전 주인 몫을 떼어 배정한다', () => {
  // 대표 확정(2026-09-08): "중개사가 한 매장으로 유어딜에서 번 돈이 있으면 그 돈은 승계가
  // 되더라도 일단 중개사에게 정산되어야지. 반대 상황도 마찬가지고."
  it('배정 잔액 공식이 payouts-generate 와 같다 (pending 도 뺀다)', () => {
    const l = strip(read(LEDGER))
    expect(l).toMatch(/export async function getUnsettledBalance/)
    expect(l, `${LEDGER}: pending 을 안 빼면 마감해도 잔액이 그대로라 문이 안 열린다`)
      .toMatch(/getUnsettledBalance[\s\S]{0,600}status IN \('pending','approved','sent'\)/)
  })

  it('getPayablePending 은 건드리지 않았다 (다른 질문에 답하는 함수다)', () => {
    const l = strip(read(LEDGER))
    expect(l, `${LEDGER}: 이쪽까지 pending 을 빼면 셀러 정산 화면의 의미가 바뀐다`)
      .toMatch(/getPayablePending[\s\S]{0,400}status IN \('approved','sent'\)/)
  })

  it('마감이 지금 계좌를 payout 행에 스냅샷한다 — 그래야 이전 주인에게 간다', () => {
    const c = strip(read(CLOSEOUT))
    expect(c).toMatch(/INSERT OR IGNORE INTO payouts/)
    // 🩸 첫 판은 `/seller\.bank_account/` 였는데 **헛돌았다** — 그 이름은 위쪽 NO_ACCOUNT 검사에도
    //   있어서, bind 에서 지워도 초록이 떴다. 주입 검증이 잡았다. ⇒ bind 인자 자리로 앵커를 좁힌다.
    expect(c, `${CLOSEOUT}: 계좌를 행에 안 박으면 주인이 바뀐 뒤 새 주인에게 송금된다`)
      .toMatch(/\.bind\([\s\S]{0,120}seller\.bank_account[\s\S]{0,80}\)\.run\(\)/)
  })

  it('계좌가 없으면 마감하지 않는다', () => {
    // 받는 사람이 없는 마감은 마감이 아니고, 나중에 새 주인 계좌가 채워지면 그쪽으로 간다.
    const c = strip(read(CLOSEOUT))
    expect(c).toMatch(/NO_ACCOUNT/)
  })

  it('최소출금액을 적용하지 않는다 (마감엔 다음 주가 없다)', () => {
    const c = strip(read(CLOSEOUT))
    expect(c, `${CLOSEOUT}: 소액을 건너뛰면 그 돈이 그대로 새 주인에게 간다`)
      .not.toMatch(/COMMISSION_MIN_WITHDRAWAL|MIN_AMOUNT/)
  })

  it('음수 잔액은 마감하지 않고 막는다 (payouts.amount 는 CHECK > 0)', () => {
    const c = strip(read(CLOSEOUT))
    expect(c).toMatch(/NEGATIVE_BALANCE/)
    expect(strip(read(GUARD)), `${GUARD}: 음수를 통과시키면 빚이 새 주인에게 넘어간다`)
      .toMatch(/receivable === 0/)
  })

  it('마감 창구가 finance 권한 + 2FA + 감사로그 뒤에 있다', () => {
    // 돈을 배정하는 창구다 — 일반 어드민 아무나 열면 안 된다.
    const r = strip(read(PAYROUTES))
    expect(r).toMatch(/handover-closeout[\s\S]{0,200}requireAdminRole\('finance'\)/)
    expect(r).toMatch(/handover-closeout[\s\S]{0,200}require2FA\(\)/)
    expect(r).toMatch(/handover-closeout[\s\S]{0,200}auditLog\(/)
  })
})

describe('🔒 ⑥ 마감 행 취소 게이트 + 어드민 화면 (2026-09-08 대표 "모두 해줘")', () => {
  it('마감 행에 kind·payee_user_id 를 박는다', () => {
    const c = strip(read(CLOSEOUT))
    expect(c, `${CLOSEOUT}: 표시가 없으면 취소 게이트가 이 행을 못 알아본다`)
      .toMatch(/'handover_closeout'/)
    expect(c).toMatch(/payee_user_id/)
    expect(c, '자유 문구(admin_memo)를 제어 신호로 쓰면 오타 한 번에 게이트가 풀린다')
      .toMatch(/seller\.linked_user_id/)
  })

  it('취소 라우트가 주인이 바뀌었는지 실제로 조회한다', () => {
    const r = strip(read(PAYROUTES))
    // 🩸 첫 판은 본문 문자열(HANDOVER_CLOSEOUT_RELEASE·SELECT…)만 봤는데 **헛돌았다** —
    //   조건을 `if (false)` 로 바꿔도 그 문자열들은 그대로 남아 초록이 떴다. 주입 검증이 잡았다.
    //   ⇒ **게이트 조건 자체**로 앵커를 옮긴다.
    expect(r, `${PAYROUTES}: 게이트 조건이 사라지면 본문이 남아 있어도 아무도 안 지킨다`)
      .toMatch(/if \(row\.kind === 'handover_closeout'[\s\S]{0,120}row\.payee_user_id[\s\S]{0,120}\{/)
    expect(r, '현재 주인을 안 읽으면 "바뀌었는지" 를 판정할 수 없다')
      .toMatch(/SELECT linked_user_id FROM sellers/)
    expect(r).toMatch(/Number\(now\.linked_user_id\) !== Number\(row\.payee_user_id\)/)
    expect(r).toMatch(/HANDOVER_CLOSEOUT_RELEASE/)
  })

  it('하드 블록이 아니라 명시 확인이다 (막다른 길 금지)', () => {
    // 🩸 이 PR 의 자물쇠가 처음에 정확히 그 실수를 했다 — 막기만 하고 푸는 길이 없었다.
    const r = strip(read(PAYROUTES))
    expect(r, `${PAYROUTES}: confirm_release 가 없으면 금액 오타를 영영 못 고친다`)
      .toMatch(/confirm_release/)
  })

  it('어드민 화면에 마감 창구가 붙어 있다', () => {
    const p = strip(read(PAYPAGE))
    expect(p, `${PAYPAGE}: API 만 있고 화면이 없으면 아무도 못 쓴다`)
      .toMatch(/\/api\/admin\/payouts\/handover-closeout/)
    expect(p, '매장 계정에만 — 소유자가 바뀔 수 있는 건 매장뿐이다')
      .toMatch(/account\.startsWith\('seller:'\)/)
  })

  it('화면이 취소 경고를 받아 한 번 더 확인한다', () => {
    const p = strip(read(PAYPAGE))
    expect(p, `${PAYPAGE}: 경고를 안 받으면 서버가 막아도 사용자는 이유를 모른다`)
      .toMatch(/HANDOVER_CLOSEOUT_RELEASE[\s\S]{0,600}confirm_release: true/)
  })
})
