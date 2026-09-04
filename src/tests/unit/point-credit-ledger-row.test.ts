/**
 * 💸 2026-08-01 — **적립했는데 거래 기록이 없는 유저**가 생기던 자리.
 *
 * `creditFreePoints` 는 ① 잔액 upsert ② `point_transactions` INSERT 를 **따로** 한다.
 * ②가 실패해도 `catch {}` 로 삼키고 `true` 를 돌려줬다 → 잔액만 늘고 원장 행이 없다.
 * 라이브 실측으로 정확히 그 모양인 유저 3명을 확인했다(각 3,000·3,000·100딜, 거래합 0).
 * 정합 검사 cron 이 매일 잡아냈지만 원인을 못 찾던 이유가 이 catch 였다.
 *
 * 원인: 확장 컬럼(`points_amount`·`balance_after`·`order_id`·`free_delta`)이 base CREATE 에 없고
 * repair-schema 에도 `free_delta` 만 있었다 → 컬럼이 없는 배포 창에서 INSERT 가 통째로 실패.
 *
 * 그래서 **최소 컬럼 폴백**을 넣었다. 이 테스트는 그 폴백이 실제로 도는지 고정한다.
 *
 * ⚠️ 못 막는 것: 테이블 자체가 없으면 폴백도 실패한다(그건 repair-schema 소관). 그리고 이미
 *    어긋난 3명의 잔액은 **고치지 않는다** — 머니 교정은 사람이 판단할 일이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

const SRC = readFileSync('src/worker/utils/point-buckets.ts', 'utf8')
// repair-schema 는 2026-08-01 에 *데이터*(컬럼 ALTER 목록)와 *로직*(라우트)으로 갈렸다.
// 검사는 둘을 합쳐서 본다 — 한쪽만 읽으면 파일이 갈리는 순간 조용히 통과해 버린다.
const REPAIR =
  readFileSync('src/worker/routes/repair-schema.routes.ts', 'utf8') +
  readFileSync('src/worker/routes/repair-schema/column-repairs.ts', 'utf8')

describe('creditFreePoints — 잔액만 늘고 원장 행이 없는 사태 방지', () => {
  it('원장 INSERT 실패를 그냥 삼키지 않는다 (빈 catch 금지)', () => {
    // 예전 코드: `} catch { /* audit fail-soft */ }` — 이게 3명을 만들었다.
    expect(SRC.includes('catch { /* audit fail-soft */ }'),
      '빈 catch 가 되살아났다 — 적립만 되고 기록이 사라진다').toBe(false)
  })

  it('실패 시 최소 컬럼으로 다시 INSERT 한다 (SSOT 헬퍼 위임도 인정)', () => {
    // 폴백이 4곳에 복붙되던 것을 `recordPointTxMinimal`(point-ledger SSOT)로 모았다.
    // 호출부는 위임만 하면 되고, **실제 INSERT 는 SSOT 에 있어야** 한다(아래 테스트가 그걸 본다).
    const inlineOrDelegate = /INSERT INTO point_transactions \(user_id, type, amount, description\)|recordPointTxMinimal\s*\(/
    expect(inlineOrDelegate.test(SRC), '최소 컬럼 폴백도, SSOT 위임도 없다').toBe(true)
  })

  it('SSOT(`recordPointTxMinimal`)가 실제로 최소 컬럼 INSERT 를 한다', () => {
    // 위임만 하고 SSOT 가 비어 있으면 전부 무의미해진다 — 위임 검사와 짝이다.
    const ledger = readFileSync('src/worker/utils/point-ledger.ts', 'utf8')
    expect(ledger, 'recordPointTxMinimal 이 없다').toContain('export async function recordPointTxMinimal')
    expect(ledger, 'SSOT 에 최소 컬럼 INSERT 가 없다')
      .toContain('INSERT INTO point_transactions (user_id, type, amount, description)')
  })

  it('기록 SSOT `recordPointTransaction` 도 실패를 그냥 삼키지 않는다', () => {
    // 이 함수가 `catch { return false }` 로 끝나던 것이 같은 사고의 상류였다.
    const ledger = readFileSync('src/worker/utils/point-ledger.ts', 'utf8')
    const tail = ledger.slice(ledger.indexOf('export async function recordPointTransaction'))
    expect(tail.slice(0, 1600), 'catch 에서 폴백 없이 false 만 돌려준다').toContain('recordPointTxMinimal(')
  })

  it('폴백이 base CREATE 가 보장하는 컬럼만 쓴다 (그래야 항상 성공한다)', () => {
    const create = /CREATE TABLE IF NOT EXISTS point_transactions \(([\s\S]*?)\)` \}/.exec(REPAIR)
    expect(create, 'repair-schema 에 point_transactions CREATE 가 없다').not.toBeNull()
    const cols = create![1]
    for (const c of ['user_id', 'type', 'amount', 'description']) {
      expect(cols.includes(c), `base CREATE 에 ${c} 가 없다 — 폴백이 실패할 수 있다`).toBe(true)
    }
  })

  it('전체 INSERT 가 쓰는 확장 컬럼이 전부 repair-schema 에 등록돼 있다', () => {
    // 등록이 빠지면 컬럼이 없는 환경에서 매번 폴백으로 떨어진다(= 정보 손실).
    for (const c of ['points_amount', 'balance_after', 'order_id', 'free_delta']) {
      expect(REPAIR.includes(`ADD COLUMN ${c}`), `point_transactions.${c} 가 repair-schema 에 없다`).toBe(true)
    }
  })
})

describe('공구 추천 보너스 — 원장 행이 곧 중복 방지 키다 (2026-08-02)', () => {
  // 2026-08-02: 라우트 인라인 블록을 `referral-bonus.ts` 로 추출했다.
  // ⚠️ 처음엔 라우트 파일에서 앵커 문자열로 블록을 잘라 봤는데, 추출하자 앵커가 사라져
  //    "블록을 못 찾았다"로 **터졌다** — 조용히 통과하지 않게 만들어 둔 게 실제로 값을 했다.
  const SRC_RB = readFileSync('src/features/group-buy/api/referral-bonus.ts', 'utf8')
  const ROUTES = readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf8')

  it('원장 INSERT 가 실패하면 최소 컬럼으로 다시 쓴다', () => {
    // 여기가 단순 불일치보다 나쁜 이유: 중복 방지가 **이 행이 남았는지로** 판정한다.
    // 행이 없으면 같은 (추천인, 참여자) 조합이 매번 다시 보상받는다 = 반복 지급.
    expect(SRC_RB, '폴백이 없다').toContain('recordPointTxMinimal(')
    const tx = SRC_RB.slice(SRC_RB.indexOf('async function recordBonusTx'))
    expect(tx.slice(0, 900), '확장 컬럼 INSERT 의 catch 에 폴백이 없다').toContain('recordPointTxMinimal(')
  })

  it('폴백이 description 을 그대로 쓴다 (중복 방지가 LIKE 로 읽는다)', () => {
    // 중복 방지: `description LIKE '%' || 'from:REF' || '%'`. 문구를 바꾸면 dedup 이 못 찾는다.
    expect(SRC_RB, '폴백이 호출부가 준 desc 를 안 넘긴다')
      .toMatch(/recordPointTxMinimal\(DB, uid, 'referral_bonus', bonus, desc\)/)
    expect(SRC_RB, 'inviteeDesc 에 from: 마커가 없다 — dedup 키가 깨진다')
      .toMatch(/inviteeDesc\s*=\s*`[^`]*from:\$\{refUserId\}/)
  })

  it('중복 방지가 여전히 point_transactions 를 읽는다 (전제 확인)', () => {
    // 이 전제가 바뀌면(예: 별도 테이블로 이동) 위 두 검사의 이유가 사라진다 — 그때 같이 고칠 것.
    expect(SRC_RB).toMatch(/SELECT 1 FROM point_transactions[\s\S]{0,200}?referral_bonus/)
  })

  it('라우트가 이 모듈을 실제로 호출한다 (고아 모듈 방지)', () => {
    expect(ROUTES, '추출해 놓고 호출을 안 하면 보너스가 통째로 사라진다')
      .toContain('grantGroupBuyReferralBonus(')
  })

  it('추출 후 라우트에 옛 인라인 적립이 남아 있지 않다 (이중 지급 방지)', () => {
    expect(ROUTES.includes("swallow('group-buy:referral-bonus:referrer-balance')"),
      '인라인 블록이 남아 있다 — 모듈과 함께 두 번 지급된다').toBe(false)
  })
})

describe('원장 불일치 조사 경로 — 데이터가 없으면 아무도 못 고친다', () => {
  it('cron 이 상세를 DB 에 남긴다 (예전엔 콘솔로만 가서 몇 주간 조사 불가였다)', () => {
    const cron = readFileSync('src/worker/cron/ledger-integrity-check.ts', 'utf8')
    expect(cron).toContain('INSERT INTO frontend_errors (message, stack,')
  })

  it('cron 과 조회 API 가 같은 SQL 모듈을 쓴다 (두 벌이면 갈라진다)', () => {
    const cron = readFileSync('src/worker/cron/ledger-integrity-check.ts', 'utf8')
    const api = readFileSync('src/features/admin/api/admin-misc.routes.ts', 'utf8')
    expect(cron).toContain('ledger-integrity-checks')
    expect(api).toContain('ledger-integrity-checks')
  })
})

describe('신규 가입 보너스 — 지급 경로 제거 (2026-08-31 대표 "3000원 주는거 없어져야 해")', () => {
  /**
   * 2026-08-01 에는 금액을 어드민 설정값으로 옮겨 **0(=중단)** 으로 뒀다. 그런데 그건
   * **꺼둔 것이지 없앤 것이 아니었다** — 어드민 칸에 숫자를 넣으면 배포 없이 되살아난다.
   * 대표가 두 번 같은 뜻을 밝혀(08-01 "너무 세다" → 08-31 "없어져야 해") 경로 자체를 걷어냈다.
   *
   * ⚠️ 못 막는 것: 다른 이름으로 같은 지급을 새로 만드는 경우. 그건 사람이 리뷰에서 본다.
   */
  it('🔴 소비자 가입 보너스 지급 모듈이 존재하지 않는다', () => {
    expect(existsSync('src/worker/utils/signup-bonus.ts'),
      '지급 모듈이 되살아났다 — 되살리려면 대표 지시가 있어야 한다').toBe(false)
  })

  it('🔴 카카오 가입 경로가 그 지급을 부르지 않는다', () => {
    const routes = readFileSync('src/features/auth/api/kakao.routes.ts', 'utf8')
    expect(routes.length, '카카오 라우트를 못 읽었다 — 이 시험이 헛돈다').toBeGreaterThan(1000)
    expect(routes, 'grantSignupBonus 호출이 되살아났다').not.toMatch(/grantSignupBonus\s*\(/)
    expect(routes, "`?bonus=` 부착이 되살아났다").not.toMatch(/searchParams\.set\(\s*'bonus'/)
  })

  it('🌇 에이전시 매장영입 signup_bonus(₩30,000)도 함께 사라졌다', () => {
    // 2026-08-31 에는 "이름만 같은 다른 제도라 남긴다"가 맞았다. 2026-09-04 대표 확정으로
    // 에이전시 자체가 일몰이라 그 모듈을 통째로 지웠다(지급 이력 0행).
    expect(existsSync('src/worker/utils/agency-store-intro-commission.ts')).toBe(false)
  })

  it('모달의 보너스 카드는 조건부라 지급이 없으면 안 뜬다', () => {
    const modal = readFileSync('src/components/onboarding/WelcomeOnboardingModal.tsx', 'utf8')
    expect(modal, '모달이 bonusAmount > 0 조건부가 아니다').toContain('bonusAmount > 0')
  })
})
