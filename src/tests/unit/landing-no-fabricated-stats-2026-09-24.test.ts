/**
 * 📉 **대외 랜딩에 지어낸 실적 수치를 두지 않는다** — 2026-09-24.
 *
 * ## 무엇이 있었나 (실측)
 * `/introduce` 가 이렇게 적고 있었다:
 *   `240만+ 누적 사용자` · `38만+ 누적 거래 건수` · `4,200+ 입점 셀러` · `4.8★ App Store 평점`
 * 같은 날 어드민 실측은 **유저 23명 · 셀러 11곳(활성 9) · 주문 최근 id 89** 였다.
 * 네 개 전부 하드코딩된 거짓이고, 입점 제안·투자 자리에 그대로 쓰이면 표시광고법 문제다.
 *
 * ## 왜 "더 정확한 숫자"로 안 바꿨나
 * 바꿀 값이 없다. 공개 피드 `total` 은 358이지만 **표본 100건 중 94건이 데모**
 * (`demo-deal-*`)이고 셀러가 붙은 건 1건이었다. 358 도 사실상 거짓이 된다.
 * ⇒ 남긴 숫자는 **코드가 보증하는 약속**뿐이다(자동환불·0원·간편결제).
 *
 * ## 이 시험이 **못 하는 것**
 * "이 숫자가 참인가"를 판정하지 못한다. 문자열 모양만 본다 — 새로운 실적 주장을
 * 다른 표현으로 쓰면(예: "회원 수 1위") 통과한다. 그건 사람이 봐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { stripComments } from '../helpers/source-text'

const SRC = resolve(__dirname, '../..')

/** 대외(비로그인 방문자가 보는) 랜딩. 라우트는 `src/App.tsx` 기준. */
const LANDINGS = [
  'pages/IntroducePage.tsx',
  'pages/AboutServicePage.tsx',
  'pages/AboutPage.tsx',
  'pages/PartnersPage.tsx',
  'pages/CreatorsPage.tsx',
  'pages/InfluencerLandingPage.tsx',
]

/**
 * 실적 주장 패턴. 값이 아니라 **모양**을 막는다 —
 * `240만+` 류 · `4,200+` 류 · 앱 평점 · "누적 <사용자|거래|회원|다운로드>".
 * ⚠️ 가격·할인·수수료는 실적 주장이 아니라서 대상이 아니다(`5%`, `9,900원` 등 통과).
 */
const CLAIMS: Array<[RegExp, string]> = [
  [/\d+\s*만\s*\+/, '“N만+” 형태의 누적 실적 수치'],
  [/\d{1,3},\d{3}\s*\+/, '“N,NNN+” 형태의 누적 실적 수치'],
  [/App\s*Store\s*평점|평점\s*\d\.\d\s*★|\d\.\d★/i, '앱스토어 평점 주장'],
  [/누적\s*(사용자|거래|회원|다운로드|이용자)/, '“누적 …” 실적 주장'],
]

describe('대외 랜딩에 지어낸 실적 수치가 없다 (2026-09-24)', () => {
  const present = LANDINGS.filter(f => existsSync(resolve(SRC, f)))

  it('검사 대상이 있다 — 0건이면 통과가 아니라 고장이다', () => {
    // 파일이 이름을 바꾸면 이 시험이 조용히 아무것도 안 보게 된다(이 레포가 반복해 당한 클래스).
    expect(present.length, `랜딩 파일을 못 찾았다: ${LANDINGS.filter(f => !present.includes(f)).join(', ')}`).toBeGreaterThanOrEqual(5)
    expect(present).toContain('pages/IntroducePage.tsx')
  })

  it.each(LANDINGS.filter(f => existsSync(resolve(SRC, f))))('%s — 실적 주장 0', (f) => {
    // 주석 속 설명(위 헤더처럼 "240만+ 이라고 적혀 있었다")은 위반이 아니다.
    const code = stripComments(readFileSync(resolve(SRC, f), 'utf-8'))
    const hits = CLAIMS.filter(([re]) => re.test(code)).map(([, why]) => why)
    expect(hits, `${f} 에 ${hits.join(' / ')} 가 남아 있다`).toEqual([])
  })

  it('지우기만 한 게 아니라 코드가 보증하는 약속으로 대체돼 있다', () => {
    const code = stripComments(readFileSync(resolve(SRC, 'pages/IntroducePage.tsx'), 'utf-8'))
    // 자동환불은 `daily-lane.ts` 의 handleExpiredVoucherRefunds 가 실제로 돌린다(그래서 말해도 된다).
    expect(code).toContain('미사용 시 자동환불')
    expect(code).toContain('가입·이용료')
  })

  it('그 약속이 실제로 구현돼 있다 — 문구만 남고 기능이 사라지면 그것도 거짓말이다', () => {
    const lane = readFileSync(resolve(SRC, 'worker/cron/daily-lane.ts'), 'utf-8')
    // 🩸 첫 판은 `toContain('handleExpiredVoucherRefunds')` 였는데 **import 줄 때문에**
    //    호출을 통째로 지워도 초록이었다(주입 3번이 잡았다). 호출 형태로 앵커한다.
    expect(lane).toMatch(/handleExpiredVoucherRefunds\(env\)/)
  })
})
