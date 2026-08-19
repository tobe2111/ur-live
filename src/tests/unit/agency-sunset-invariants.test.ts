import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * 🌇 에이전시 대시보드 일몰 — 불변식 가드 (2026-08-19)
 *
 * 배경: 에이전시 대시보드를 39 라우트 → 16 으로 줄이고 신규 가입을 닫았다. 이 축소가 조용히
 *   되돌아가거나(다음 세션이 "왜 nav 가 비지?" 하며 복원) **반쪽만** 되돌아가는 것을 막는다.
 *   반쪽 롤백이 진짜 위험이다 — 화면만 살아나고 서버가 403 이면 사용자가 폼을 다 채운 뒤 막히고,
 *   서버만 열리면 화면 없이 API 로 계정이 생긴다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**(과신 금지):
 *   - 라이브 DB 상태(에이전시가 실제로 몇 개인지)는 안 본다. 레포 안의 사실만 검사한다.
 *   - 언마운트된 API 가 런타임에 정말 404 인지는 Workers 런타임에서만 판정된다(배포 후 curl).
 *   - `AGENCY_DASHBOARD_SUNSET = false` 로 되돌리는 **의도된 롤백**은 막지 않는다(막으면 안 된다).
 *     그 경우 가입 관련 검사는 스스로 건너뛴다.
 */

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

const flags = read('src/shared/feature-flags.ts')
const routes = read('src/routes/agency.routes.tsx')
const layout = read('src/components/AgencyLayout.tsx')
const app = read('src/App.tsx')
const workerIndex = read('src/worker/index.ts')
const agencyApi = read('src/features/agency/api/agency.routes.ts')
const sunsetApi = read('src/features/agency/api/agency-sunset.ts')

const sunsetOn = /export const AGENCY_DASHBOARD_SUNSET = true/.test(flags)

describe('🌇 에이전시 일몰 — 신규 가입 차단은 클라+서버 한 쌍', () => {
  it('플래그가 SSOT 에 선언돼 있다', () => {
    expect(flags).toMatch(/export const AGENCY_DASHBOARD_SUNSET = (true|false)/)
  })

  it.skipIf(!sunsetOn)('서버가 최종 게이트다 — 두 가입 엔드포인트 모두 게이트를 통과해야 한다', () => {
    // 클라만 막으면 직접 POST 로 우회된다. 핸들러 **본문**에 게이트가 있어야 한다
    // (파일 어딘가에 상수 이름이 보이는 것만으로는 통과시키지 않는다 — 주석에도 이름은 남으므로).
    for (const ep of ["'/register'", "'/register-from-user'"]) {
      const at = agencyApi.indexOf(`app.post(${ep}`)
      expect(at, `${ep} 핸들러를 못 찾음`).toBeGreaterThan(-1)
      const body = agencyApi.slice(at, at + 900)
      expect(body, `${ep} 에 서버측 일몰 게이트가 없다`).toMatch(
        /const closed = agencySignupClosed\(c\); if \(closed\) return closed/
      )
    }
  })

  it.skipIf(!sunsetOn)('게이트 응답은 403 + AGENCY_SIGNUP_CLOSED (문구는 한 곳에서만)', () => {
    expect(sunsetApi).toMatch(/export function agencySignupClosed/)
    expect(sunsetApi).toMatch(/if \(!AGENCY_DASHBOARD_SUNSET\) return null/)
    expect(sunsetApi).toMatch(/code: 'AGENCY_SIGNUP_CLOSED'/)
    expect(sunsetApi).toMatch(/\}, 403\)/)
  })

  it.skipIf(!sunsetOn)('화면도 함께 막힌다 — 가입 라우트가 일몰 안내로 분기', () => {
    expect(routes).toMatch(/AGENCY_DASHBOARD_SUNSET \? AgencySunsetPage : AgencyRegisterPage/)
    expect(routes).toMatch(/AGENCY_DASHBOARD_SUNSET \? AgencySunsetPage : AgencyRegisterBusinessPage/)
  })

  it.skipIf(!sunsetOn)('가입 라우트를 404 로 죽이지 않았다 — 이미 링크가 나가 있다', () => {
    expect(routes).toMatch(/path="\/agency\/register"/)
    expect(routes).toMatch(/path="\/agency\/register\/business"/)
  })

  it('기존 계정의 로그인은 막지 않는다 — 일몰 ≠ 축출', () => {
    expect(routes).toMatch(/path="\/agency\/login"/)
    expect(agencyApi).not.toMatch(/app\.post\('\/login'[\s\S]{0,400}agencySignupClosed/)
  })
})

describe('🌇 에이전시 일몰 — 살아남는 축(관계·정산·승계)은 유지', () => {
  // 이 셋이 남는 이유: 매장 승계를 "계정 양도"가 아니라 "관계 변경"으로 풀기 위한 뼈대다.
  // 설계: docs/design/store-operator-model.md
  const survivors = [
    ['/agency/delegations', '위임 — 누가 이 매장을 운영하는가'],
    ['/agency/introduced-stores', '영입 — 관계가 끊겨도 남는 보상 근거'],
    ['/agency/transfers', '승계 — 매장 본인 동의(TD-016)'],
    ['/agency/settlements', '정산 — 남은 채무'],
  ] as const

  for (const [path, why] of survivors) {
    it(`${path} 라우트가 남아 있다 (${why})`, () => {
      expect(routes).toMatch(new RegExp(`path="${path}"`))
    })
  }

  it('위임 API 는 계속 마운트돼 있다', () => {
    expect(workerIndex).toMatch(/^app\.route\('\/api\/agency\/delegation', agencyDelegationRoutes\);/m)
  })
})

describe('🌇 에이전시 일몰 — 축소가 지켜지는가', () => {
  it('라우트가 20개를 넘지 않는다 (일몰 전 39)', () => {
    const count = (routes.match(/path="/g) || []).length
    expect(count).toBeLessThanOrEqual(20)
    expect(count, '라우트가 0이면 파일이 비어버린 것 — 통과가 아니라 실패다').toBeGreaterThan(5)
  })

  it('nav 링크가 전부 실제 라우트를 가리킨다 (죽은 링크 0)', () => {
    // 일몰 전에 이미 `/agency/streams`·`/agency/pending` 같은 죽은 nav 가 있었다.
    // 화면을 지우면서 nav 를 안 지우면 그 부채가 다시 쌓인다.
    const navPaths = [...layout.matchAll(/path: '(\/agency[^']*)'/g)].map((m) => m[1])
    expect(navPaths.length, 'nav 항목 0 = 파싱이 깨진 것(측정 대상 0은 통과가 아니다)').toBeGreaterThan(3)
    const dead = navPaths.filter(
      (p) => !routes.includes(`path="${p}"`) && !app.includes(`path="${p}"`)
    )
    expect(dead, `nav 가 존재하지 않는 라우트를 가리킨다: ${dead.join(', ')}`).toEqual([])
  })

  it('삭제한 화면의 API 는 언마운트돼 있다', () => {
    const unmounted = [
      'agencyCampaignsRoutes', 'agencyIncentivesRoutes', 'agencyMessagesRoutes',
      'agencyCouponsRoutes', 'agencyMembersRoutes', 'agencyCalendarRoutes',
      'agencyKpiRoutes', 'agencyMatchSuggestionsRoutes', 'agencyStaysRoutes', 'agencyOpsRoutes',
    ]
    for (const sym of unmounted) {
      // 주석 처리된 마운트는 허용(롤백 안내). 살아있는 `app.route(` 줄만 위반.
      const live = workerIndex
        .split('\n')
        .filter((l) => l.includes(sym) && /^\s*app\.route\(/.test(l))
      expect(live, `${sym} 가 다시 마운트됐다`).toEqual([])
    }
  })
})

describe('🌇 에이전시 일몰 — 머니/공개 경로는 절대 같이 죽지 않는다', () => {
  // 언마운트하면서 파일까지 지우면 여기가 깨진다. 실제로 그럴 뻔했다.
  it('agency-incentives 는 computeCommission 을 계속 export (머니 경로가 import 한다)', () => {
    const incentives = read('src/features/agency/api/agency-incentives.routes.ts')
    expect(incentives).toMatch(/export function computeCommission/)
    for (const consumer of [
      'src/worker/utils/order-commissions.ts',
      'src/worker/utils/commission-budget.ts',
    ]) {
      expect(read(consumer)).toMatch(/computeCommission/)
    }
  })

  it('공개 초대코드 라우터는 살아 있다 (셀러 가입이 쓴다)', () => {
    expect(workerIndex).toMatch(/^app\.route\('\/api\/invite', inviteCodePublicRoutes\);/m)
    expect(read('src/features/seller/api/seller-registration.routes.ts')).toMatch(/consumeInviteCode/)
  })

  it('셀러측 promote-boosts 라우터는 살아 있다', () => {
    expect(workerIndex).toMatch(/^app\.route\('\/api\/seller\/promote-boosts', promoteBoostsSellerRoutes\);/m)
  })
})
