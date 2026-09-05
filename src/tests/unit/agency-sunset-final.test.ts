/**
 * 🌇 2026-09-04 — 에이전시 **완전 일몰**. 대표 확정:
 *
 *   "그 에이전시는 없애자. 에이전시 대시보드도 안쓸거야.
 *    **더 이상 헷갈리지 말자 다른 세션에서도 그렇고.**"
 *   "에이전시 남은 잔재 다 삭제하고, 중개사가 5% 내에서 가져가는게 아니라
 *    나머지 95%에서 매장이랑 거래를 하는거지. 5%는 중개사 일 때 유어딜의 수수료인거고."
 *
 * ## 왜 테스트로 박는가
 * 이 레포에서 에이전시는 **두 번** 일몰됐다(2026-08-19 축소 · 2026-08-31 커미션 폐지). 그때마다
 * 파일·심볼·라우트가 남았고, 다음 세션은 남은 것을 보고 "아직 쓰는 모델"로 읽었다. 문서로만 적으면
 * 또 그렇게 된다. 그래서 **되살아나는 것 자체를 빨간불로** 만든다.
 *
 * ## 지금 모델 (헷갈리지 말 것)
 *   직접 입점 = 매장이 스스로     → `seller_meta.store_channel='direct'`   → 유어딜 10%
 *   중개(대행) = 중개사가 데려옴  → `store_channel='brokered'` + `seller_operators` → 유어딜 5%
 * 중개사는 **에이전시가 아니라 셀러 대시보드 계정**이고, 보상은 유어딜 5% 안이 아니라
 * **나머지 95%(매장 몫)에서 매장과 직접 거래**해 받는다 — 유어딜 장부에 등장하지 않는다.
 *
 * ## 이 테스트가 못 막는 것
 * - 이름만 바꿔 같은 개념을 다시 만드는 것(예: `partner_agencies`). 문자열 가드의 한계다.
 * - DB 에 남은 `agencies` 4행. 읽는 코드가 없으니 무해하지만, 행 자체는 남아 있다.
 * - 라이브 배선(HTMLRewriter·크론 실제 발화)은 소스만 봐선 판정 못 한다.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

const WORKER = codeOnly(readFileSync('src/worker/index.ts', 'utf-8'))
const APP = codeOnly(readFileSync('src/App.tsx', 'utf-8'))

describe('에이전시 — 파일이 되살아나지 않는다', () => {
  it('features/agency 디렉터리가 없다', () => {
    expect(existsSync('src/features/agency')).toBe(false)
  })

  it('에이전시 크론 파일이 하나도 없다', () => {
    const left = readdirSync('src/worker/cron').filter(f => f.startsWith('agency-'))
    expect(left, `남은 크론: ${left.join(', ')}`).toEqual([])
  })

  it('에이전시 전용 페이지·레이아웃이 없다', () => {
    const pages = readdirSync('src/pages').filter(f => /^(Agency|AdminAgency)/.test(f))
    expect(pages, `남은 페이지: ${pages.join(', ')}`).toEqual([])
    expect(existsSync('src/components/AgencyLayout.tsx')).toBe(false)
    expect(existsSync('src/routes/agency.routes.tsx')).toBe(false)
  })

  it('에이전시 적립/역전 모듈이 없다', () => {
    expect(existsSync('src/worker/utils/agency-store-intro-commission.ts')).toBe(false)
    expect(existsSync('src/lib/agency-shared.ts')).toBe(false)
  })
})

describe('에이전시 — 배선이 되살아나지 않는다', () => {
  it('워커가 /api/agency 를 마운트하지 않는다', () => {
    // ⚠️ 문자열 'agency' 전체 금지가 아니다 — 로그아웃 쿠키 정리(`ur_agency_session` 삭제)는
    //    **남아야 한다**(옛 세션을 실제로 죽이는 코드). 마운트 형태로만 본다.
    expect(WORKER).not.toMatch(/app\.route\(\s*'\/api\/agency/)
    expect(WORKER).not.toMatch(/adminApp\.route\(\s*'\/agenc/)
  })

  it('앱이 /agency 라우트를 그리지 않는다', () => {
    expect(APP).not.toMatch(/path="\/agency/)
    expect(APP).not.toMatch(/path="\/terms\/agency"/)
    expect(APP).not.toContain('AgencyRoutes')
  })

  it('환불 역전도 부르지 않는다 (적립이 없으면 역전할 것도 없다)', () => {
    for (const f of ['src/worker/utils/order-refund.ts', 'src/features/returns/api/returns.routes.ts']) {
      const src = codeOnly(readFileSync(f, 'utf-8'))
      expect(src, `${f}`).not.toMatch(/reverseAgencyStoreIntroOnRefund\s*\(/)
    }
  })

  it('예산 요청에도 그 축을 올리지 않는다', () => {
    // 🗺️ 2026-09-05: `agency-intro-retired.test.ts` 가 보던 것이다. 그 파일은 "환불 역전은 남는다"가
    //   일몰과 정반대라 삭제했고(위 '환불 역전도 부르지 않는다' 가 정본), 나머지 불변식은 여기로 옮겼다.
    //   요청만 올리고 적립을 안 하면 예산을 잡아만 두고 다른 축 몫이 사라진다 — 가장 조용한 손실이다.
    const orders = codeOnly(readFileSync('src/worker/utils/order-commissions.ts', 'utf-8'))
    expect(orders).not.toContain('computeAgencyStoreIntroRequest')
    expect(orders).not.toContain("key: 'agency_intro'")
  })

  it('공구 결제 두 경로(딜·카드)가 그 축을 부르지 않는다', () => {
    const gb = codeOnly(readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf-8'))
    expect(gb).not.toContain("only: ['agency_intro']")
  })

  it('어드민 설정으로도 되살릴 수 없다', () => {
    const settings = codeOnly(readFileSync('src/worker/utils/platform-settings-validation.ts', 'utf-8'))
    expect(settings).not.toContain("'agency_intro'")
  })

  it("커미션 축 타입에 'agency_intro' 가 없다", () => {
    const orders = codeOnly(readFileSync('src/worker/utils/order-commissions.ts', 'utf-8'))
    const m = orders.match(/export type CommissionAxis = ([^\n]+)/)
    expect(m, 'CommissionAxis 선언을 찾지 못했다').toBeTruthy()
    expect(m![1]).not.toContain('agency_intro')
    expect(orders).not.toContain('creditAgencyStoreIntroCommission')
  })

  it('수수료 리졸버에 에이전시 컨텍스트를 공급하지 않는다', () => {
    // fee-resolver 의 agency 필드/불변식은 일부러 남겼다(머니 SSOT 합계 검증을 안 건드리려고).
    // 대신 **공급을 끊어** 슬라이스가 구조적으로 0 이다. 그 차단이 이 줄이다.
    const rec = codeOnly(readFileSync('src/worker/utils/fee-breakdown-record.ts', 'utf-8'))
    expect(rec).toMatch(/const agency: AgencyContext \| null = null/)
    expect(rec).not.toContain('FROM agencies')
  })
})

describe('② 매장을 에이전시에 붙일 수 있는 문이 없다 (2026-09-05 잔재 2차)', () => {
  // 🩸 1차 일몰은 **읽는 쪽**(대시보드·커미션·크론)을 지웠는데 **쓰는 쪽**이 살아 있었다.
  //   그 문 셋으로 들어오면 `introduced_by_agency_id` 가 채워지고, 그 값이 요금(직접 10% /
  //   중개 5%)까지 갈랐다 — 정작 그걸 읽어 돈을 주던 코드는 이미 없었는데도.
  it('가입 라우트가 agencies 를 조회하지 않는다', () => {
    const src = codeOnly(readFileSync('src/features/seller/api/seller-registration.routes.ts', 'utf-8'))
    expect(src).not.toMatch(/FROM agencies/)
    expect(src).not.toMatch(/introduced_by_agency_id/)
  })

  it('영입 사전등록(prospects)이 agencies 를 조회하지 않는다', () => {
    const src = codeOnly(readFileSync('src/features/seller-prospects/api/seller-prospects.routes.ts', 'utf-8'))
    expect(src).not.toMatch(/FROM agencies/)
    // 초대 링크에 `?agency=` 를 동봉하던 자리 — 받아 줄 입력칸도 함께 없어졌다.
    expect(src).not.toMatch(/qs\.set\('agency'/)
  })

  it('대외 소개서에서 에이전시 덱이 사라졌다', () => {
    // 🩸 이 덱은 **없는 서비스를 파는 자료**였다 — 자랑하던 코드(에이전시 대시보드·정산·캐스팅·
    //   PK·부스트)가 전부 삭제된 뒤에도 남아 있었고, 소개서 생성기는 그 덱의 숫자를 계속 뽑으려다
    //   "[추출실패—수동확인]" 을 내고 있었다. 대표가 사업계획서 C-2 에서 지적한 것과 같은 클래스다.
    expect(existsSync('docs/proposals/agency-brief.md')).toBe(false)
    const gen = codeOnly(readFileSync('scripts/generate-proposal-refs.mjs', 'utf-8'))
    expect(gen, '생성기에 agency 도메인이 남으면 없는 덱의 숫자를 다시 뽑는다').not.toMatch(/'agency'/)
  })

  it('어드민 에이전시 재배정 라우트가 없다', () => {
    const src = codeOnly(readFileSync('src/features/admin/api/admin-sellers.routes.ts', 'utf-8'))
    expect(src).not.toMatch(/reassign-agency/)
    const spec = codeOnly(readFileSync('src/features/admin/api/admin-sellers/reassign-introducer.ts', 'utf-8'))
    expect(spec).not.toMatch(/existsTable: 'agencies'/)
  })
})

describe('일몰이 삼키면 안 되는 것들', () => {
  it('소비자 친구초대(referral)는 그대로 산다', () => {
    // 에이전시 초대코드가 같은 `/api/invite` 에 얹혀 있었다 — 지울 때 이쪽까지 지우면
    // 마이페이지의 '내 추천 링크'(GET /api/invite/my)가 통째로 죽는다.
    expect(WORKER).toMatch(/app\.route\('\/api\/invite', inviteRewardRoutes\)/)
  })

  it('중개의 새 실체 — seller_operators 라우트가 살아 있다', () => {
    expect(existsSync('src/features/seller/api/seller-operators.routes.ts')).toBe(true)
    expect(WORKER).toMatch(/app\.route\('\/api\/seller', sellerOperatorsRoutes\)/)
  })
})
