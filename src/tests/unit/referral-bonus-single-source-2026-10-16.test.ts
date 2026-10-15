/**
 * 💸 2026-10-16 — **0.5% 공구 추천 보너스를 주는 경로는 없다.** 그리고 그 보너스의 진실은
 * `platform_settings.user_referral_bonus_pct` **한 곳**이다.
 *
 * ## 왜 생겼나 (라이브 실측 — 제가 대표께 두 번 틀리게 보고한 뒤 코드를 끝까지 따라가서 찾았다)
 *
 * 전날(2026-10-15) 결재 *"0.5% 레퍼럴은 아예 없어"* 로 **화면이 약속하던 자리 여섯**을 지웠다(PR #1861).
 * 그때 서버 레일은 *"비율이 0 이라 아무 일도 안 한다"* 고 보고하고 남겼는데 — **그 보고가 틀렸다.**
 * 경로가 둘이었고 하나는 0 이 아니었다:
 *
 * | | 자리 | 비율 출처 | 상태 |
 * |---|---|---|---|
 * | **A** | `group-buy.routes` `rates.user_referral_bonus_pct` · `commission-rates.calcSplit` · `helpers.applyGroupBuyReferral` | 어드민 `platform_settings`(라이브 **0**) | 꺼짐 |
 * | **B** | `group-buy.routes` → `referral-bonus.ts` `grantGroupBuyReferralBonus` | **`COMMISSION_DEFAULTS.REFERRAL_BONUS_BOTHSIDES_PCT` 0.5 상수** | **켜짐** |
 *
 * B 는 `platform_settings` 를 **쳐다보지도 않았다.** 그래서 2026-08-23 "심플 모델" 로 설정을 0 으로
 * 내린 뒤에도 B 는 계속 0.5% 였다. `refRaw` 는 `X-Affiliate-Ref` 헤더이고 `lib/api.ts` 가 저장된
 * 소개 ref 를 **모든 요청에 자동 첨부**하므로, 소개 링크로 들어온 사람이 **딜로** 공구에 참여하면
 * 추천인·구매자 양쪽에 결제액의 0.5% 가 딜로 지급됐을 것이다.
 *
 * 🔑 **안 터진 이유는 정책이 아니라 트래픽이다** — 라이브 `point_transactions` 의
 * `type='referral_bonus'` 가 **0행**이었다(소개 ref 를 달고 딜로 참여한 주문이 아직 없다). 지뢰였다.
 *
 * ⇒ 대표 **"0.5%는 안주는거야"** 로 B 를 통째로 지웠다(호출·모듈·상수·어드민 정책표 행·제안서 행).
 *   경로가 A 하나로 모이면 **어드민에서 0 이면 정말로 0** 이다.
 *
 * ## 🔴 반대 방향이 더 위험하다 — 이 시험의 절반은 그쪽이다
 *
 * "0.5% 를 없앤다" 를 넓게 읽어 **A 까지 지우면** 어드민 스위치 자체가 사라져, 나중에 대표가
 * 보너스를 켜고 싶어도 켤 자리가 없어진다(그리고 그 삭제는 에러를 안 낸다). 그리고
 * **매장이 건 소개비**(`seller_influencer_deals` — 대표 *"소개비는 매장 사장님이 설정했다면
 * 매장에서 부담하는거"*)는 **전혀 다른 레일**인데 이름이 비슷해 같이 지워지기 쉽다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 *
 * - 어드민에서 `user_referral_bonus_pct` 를 다시 0.5 로 올리는 것 — 그건 대표 판단이고, 그때는
 *   A 경로가 **정상적으로** 지급한다(그게 스위치의 존재 이유다). 다만 화면 문구를 **새로** 써야 한다.
 * - 라이브에서 실제로 한 푼도 안 나가는지 — `point_transactions` 조회만이 판정한다(현재 0행).
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { readCode } from '@/tests/helpers/source-text'

const ROUTES = 'src/features/group-buy/api/group-buy.routes.ts'
const RATES = 'src/features/group-buy/api/commission-rates.ts'
const HELPERS = 'src/features/group-buy/api/helpers.ts'

/** src 전수 — 주석을 걷어낸 실행되는 코드만. */
function walkSrc(): Array<{ path: string; code: string }> {
  const out: Array<{ path: string; code: string }> = []
  const skip = new Set(['node_modules', 'dist', '.git'])
  const rec = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) { rec(p); continue }
      if (!/\.(ts|tsx)$/.test(name)) continue
      if (p.includes(`src${'/'}tests${'/'}`)) continue // 시험 자신은 이 설명을 인용한다
      out.push({ path: p, code: readCode(p) })
    }
  }
  rec('src')
  return out
}

describe('① 0.5% 를 상수로 지급하던 경로가 없다', () => {
  const files = walkSrc()

  it('측정 대상이 비어 있지 않다 (0건이면 통과가 아니라 고장)', () => {
    expect(files.length, 'src 를 한 파일도 못 읽었다 — 아래 검사가 전부 헛돈다').toBeGreaterThan(500)
  })

  it('지급 모듈 파일이 없다', () => {
    expect(existsSync('src/features/group-buy/api/referral-bonus.ts'),
      'referral-bonus.ts 가 되살아났다 — 그 모듈이 0.5% 상수 지급의 몸통이었다').toBe(false)
  })

  it('`grantGroupBuyReferralBonus` 를 부르는 코드가 0건이다', () => {
    const hits = files.filter((f) => f.code.includes('grantGroupBuyReferralBonus'))
    expect(hits.map((f) => f.path), '호출이 되살아났다').toEqual([])
  })

  it('`REFERRAL_BONUS_BOTHSIDES_PCT` 를 읽는 코드가 0건이다', () => {
    // 상수를 지웠으므로 선언도 참조도 없어야 한다. 되살리면 "아무도 안 주는 숫자" 를
    // 어드민 정책표·제안서가 다시 광고한다 — 전날 닫은 그 거짓 약속이다.
    const hits = files.filter((f) => f.code.includes('REFERRAL_BONUS_BOTHSIDES_PCT'))
    expect(hits.map((f) => f.path), '0.5 상수가 되살아났다').toEqual([])
  })

  it('어드민 정책표가 그 숫자를 광고하지 않는다', () => {
    expect(readCode('src/pages/admin-policy/policy-rows.ts')).not.toContain('REFERRAL_BONUS_BOTHSIDES_PCT')
  })

  it('제안서 생성기가 그 행을 만들지 않는다', () => {
    const gen = readFileSync('scripts/generate-proposal-refs.mjs', 'utf8')
    expect(gen).not.toContain('REFERRAL_BONUS_BOTHSIDES_PCT')
  })
})

describe('② 반대 방향 — 설정값 경로(A)는 남아 있다', () => {
  it('공구 참여가 `user_referral_bonus_pct` 를 읽어 보너스를 계산한다', () => {
    // 이 줄을 지우면 어드민 스위치가 사라진다 — 켤 자리가 없어지고 에러도 안 난다.
    expect(readCode(ROUTES), '라우트가 설정값을 안 읽는다')
      .toMatch(/rates\.user_referral_bonus_pct/)
    expect(readCode(RATES), 'calcSplit 이 설정값을 안 읽는다')
      .toMatch(/rates\.user_referral_bonus_pct/)
    expect(readCode(HELPERS), 'applyGroupBuyReferral 이 설정값을 안 읽는다')
      .toMatch(/rates\.user_referral_bonus_pct/)
  })

  it('0 이면 지급하지 않는 게이트가 있다 (설정이 진실이 되는 자리)', () => {
    expect(readCode(ROUTES)).toMatch(/if\s*\(\s*userBonusAmount\s*>\s*0\s*\)/)
    expect(readCode(HELPERS)).toMatch(/if\s*\(\s*userBonusAmount\s*>\s*0\s*\)/)
  })

  it('금액이 설정값에서 그대로 나온다 (바닥을 깔지 않는다)', () => {
    // 🩸 주입이 잡아 준 눈먼 자리: 위 `> 0` 게이트만 보면 `Math.max(1, …)` 로 **바닥을 1 로 깔아도**
    //    통과한다 — 설정이 0 인데 1딜씩 나가고, 그건 B 를 지운 이유와 똑같은 사고다.
    for (const f of [ROUTES, HELPERS]) {
      const line = readCode(f).split('\n').find((l) => l.includes('const userBonusAmount ='))
      expect(line, `${f}: userBonusAmount 계산 줄을 못 찾았다`).toBeTruthy()
      expect(line!, `${f}: 설정값에서 floor 로 바로 안 나온다`).toMatch(/Math\.floor\([^)]*user_referral_bonus_pct/)
      expect(line!, `${f}: 바닥을 깔고 있다 — 설정 0 이 더는 0 이 아니다`).not.toContain('Math.max')
    }
  })

  it('설정 키가 어드민에서 읽히는 목록에 남아 있다', () => {
    // 🩸 주입이 잡아 준 눈먼 자리: 이 파일엔 `user_referral_bonus_pct` 가 네 군데(타입·DEFAULTS·
    //    KEY_MAP·조회목록) 있어서 **조회 목록에서만 빼도** 단순 `toContain` 은 통과했다.
    //    그러면 어드민 값이 안 내려와 DEFAULTS(0)로 조용히 떨어진다 — 켜도 안 켜진다.
    const sel = readCode(RATES).match(/SELECT key, value FROM platform_settings WHERE key IN \(([\s\S]*?)\)/)
    expect(sel, '조회 목록을 못 찾았다 — 이 검사가 헛돈다').toBeTruthy()
    expect(sel![1], '조회 목록에서 키가 빠졌다').toContain("'user_referral_bonus_pct'")
  })
})

describe('③ 반대 방향 — 매장이 건 소개비는 다른 레일이다 (안 건드렸다)', () => {
  it('매장 제안 커미션 조회가 살아 있다', () => {
    // 대표 2026-10-16: "소개비는 매장 사장님이 설정했다면 매장에서 부담하는거."
    // 이름이 비슷해 0.5% 정리에 휩쓸리기 쉽다 — 지우면 매장이 건 소개 몫이 통째로 사라진다.
    // 🩸 주입이 잡아 준 눈먼 자리: `toContain('seller_influencer_deals')` 는 테이블명을
    //    `seller_influencer_deals_REMOVED` 로 **망가뜨려도 통과**한다(부분문자열이라서).
    //    `_` 는 단어 문자라 `\b` 가 그 뒤에 안 붙는다 — FROM 절 모양으로 앵커한다.
    expect(readCode(HELPERS), '매장 제안 커미션 조회가 사라졌다')
      .toMatch(/FROM seller_influencer_deals\b/)
  })

  it('상품별 소개비 설정(referral_commission_rate)을 읽는 자리가 살아 있다', () => {
    expect(readCode('src/worker/utils/affiliate-credit.ts')).toContain('referral_commission_rate')
  })
})
