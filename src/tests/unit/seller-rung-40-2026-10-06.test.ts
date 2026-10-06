/**
 * 📏 셀러 대시보드 **40px 눈금** + 정산 패널 **봉투 일치** (2026-10-06)
 *
 * 대표 2026-10-06 "모두 다 해줘" — 결재 `2026-09-28-my-stage2-sheet-teardown.md` §남은 것의
 * **네 줄**(묶음 탭 줄 28 · 전폭 주 버튼 32 · 카드 머리 링크 13~18 · 폼 입력 38)을 이 레포의 눈금
 * **40px**(`.ur-btn-md { height: 2.5rem }`)에 맞춘 것을 고정한다.
 *
 * 🩸 **기법이 자리마다 다른 이유를 함께 고정한다** — 이게 이 시험의 핵심이다.
 *   `.tap-reach`(히트영역만 40px, 레이아웃 불변)는 **조상에 overflow 가 있으면 히트 테스트까지
 *   잘린다**(그 클래스 주석이 2026-10-01 에 경고했다). 실측으로 두 자리가 그 경우였다:
 *     · 묶음 탭 줄 — 직계 부모가 `overflow-x-auto`
 *     · 카드 머리 링크(소개 콘솔) — `DashboardCard` 가 `overflow-hidden`
 *   ⇒ 그 둘은 **박스를 키우고**(`min-h-[40px]`), 문장 속 링크만 `tap-reach` 를 쓴다
 *     (박스를 키우면 문단이 깨지고, 그 자리는 카드 밖이라 잘리지 않는다).
 *   다음 세션이 "통일한다" 며 탭 줄을 `tap-reach` 로 바꾸면 **히트영역이 통째로 죽는다** — 그걸 막는다.
 *
 * 🩸 **이 시험이 못 보는 것(그리고 제가 한 번 속은 것)**: 실제로 40px 로 **렌더되는지**는
 *   문자열로 알 수 없다. 그건 `scripts/visual-preview.mjs --phone-audit` 이 재고,
 *   그 하네스는 **소스가 아니라 `dist/client` 를 띄운다** ⇒ **빌드 없이 측정하면 수정 전 화면을
 *   재는 것**이다. 2026-10-06 에 실제로 그렇게 "숫자가 하나도 안 바뀌었다" 를 한 번 봤다.
 *   측정값(빌드 후):
 *     `/seller/settlements` 작은타깃 18 → 9 · `/seller/store` 24 → 12 · `/seller/orders` 8 → 4
 *   남은 것은 **36px·35px 칩**이라 결재문의 네 줄이 아니다(별건 — 대표 판단 대기).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => readFileSync(p, 'utf8')
const code = (p: string) => stripComments(read(p))

const TABS = 'src/components/seller/SellerGroupTabs.tsx'
const CARD = 'src/components/dashboard/DashboardCard.tsx'
const REFERRAL = 'src/pages/seller-settlements/ReferralEarningsCard.tsx'
const STORE = 'src/pages/SellerStoreInfoPage.tsx'
const SETTLE = 'src/pages/SellerSettlementsPage.tsx'
const BALANCE = 'src/pages/seller-settlements/DealBalanceCard.tsx'
const BIZREG = 'src/pages/seller-settlements/BizRegStatusBanner.tsx'
const PANEL = 'src/pages/seller-settlements/RestaurantSettlementsSection.tsx'
const ROUTE = 'src/features/settlement/api/restaurant-settlement.routes.ts'

describe('① 묶음 탭 줄 — 박스로 40px (tap-reach 금지)', () => {
  it('탭 링크가 min-h-[40px] 로 40px 를 **보장**한다', () => {
    const s = code(TABS)
    expect(s, '탭 링크의 40px 보장이 사라졌다').toContain('min-h-[40px]')
    expect(s, 'py-1.5(=28px) 로 돌아갔다').not.toMatch(/px-3\.5\s+py-1\.5/)
  })

  it('🔴 그 줄에 tap-reach 를 쓰지 않는다 — 부모가 overflow-x-auto 라 히트영역이 잘린다', () => {
    const s = code(TABS)
    expect(s, '전제가 바뀌었다 — 부모의 overflow-x-auto 가 없어졌으면 이 시험을 다시 판단할 것')
      .toContain('overflow-x-auto')
    expect(s, 'overflow 안에서 tap-reach 는 히트 테스트까지 잘린다(넓힌 만큼이 죽는다)')
      .not.toContain('tap-reach')
  })
})

describe('② 전폭 주 버튼 — 자리별로 ur-btn-md(40px)', () => {
  it('정산 계좌 등록 CTA', () => {
    expect(code(SETTLE)).toContain('ur-btn ur-btn-md ur-btn-primary mt-3 w-full sm:w-auto')
  })
  it('딜 잔액 카드의 환급·교환권 두 버튼', () => {
    const s = code(BALANCE)
    expect(s).toContain('ur-btn ur-btn-md ur-btn-secondary flex-1 sm:flex-none')
    expect(s).toContain('ur-btn ur-btn-md ur-btn-primary flex-1 sm:flex-none')
    expect(s, 'ur-btn-sm(32px) 가 남아 있다').not.toContain('ur-btn-sm')
  })
  it('사업자등록증 배너(반려/정상 두 분기 모두)', () => {
    const s = code(BIZREG)
    expect(s).toContain('ur-btn ur-btn-md ur-btn-danger')
    expect(s).toContain('ur-btn ur-btn-md ur-btn-primary')
    expect(s).not.toContain('ur-btn-sm')
  })
  it('매장 지도 열기 CTA', () => {
    expect(code(STORE)).toContain('ur-btn ur-btn-md ur-btn-secondary mt-2')
  })

  it('🧭 칩은 키우지 않는다 — ur-btn-sm 자체는 살아 있어야 한다(일괄 교체 금지)', () => {
    // 결재문 §남은 것: "ur-btn-sm 은 칩에도 쓰여 일괄 교체는 칩까지 키운다 ⇒ 자리별 교체가 필요"
    expect(read('src/index.css'), '눈금 체계에서 sm 단계가 사라졌다').toContain('.ur-btn-sm')
  })
})

describe('③ 카드 머리 링크 — 카드는 박스, 문장은 히트영역', () => {
  it('소개 콘솔 링크가 박스로 40px (DashboardCard 가 overflow-hidden 이라 tap-reach 불가)', () => {
    expect(code(CARD), '전제가 바뀌었다 — DashboardCard 의 overflow-hidden 이 없어졌으면 재판단할 것')
      .toContain('overflow-hidden')
    const s = code(REFERRAL)
    expect(s, '소개 콘솔 링크의 40px 보장이 사라졌다').toMatch(/to="\/u\/me\/earnings"[^>]*min-h-\[40px\]/)
    expect(s, '잘리는 자리에 tap-reach 를 썼다').not.toContain('tap-reach')
  })

  it('🔴 문장 속 사업자 정보 링크에는 tap-reach 를 걸지 않는다 — 걸어 봤고 안 닿았다', () => {
    // 2026-10-06 실측: 걸었더니 하네스가 `reachDead: 1` 로 잡았다(선언한 40px 가 실제로는 안 닿는다 —
    // inline 박스라 ::after 밴드의 중심이 다른 줄에 떨어진다). **선언만 남기면 감사가 이 자리를
    // "정상"으로 세어 더 나쁘다.** 박스를 키우면 각주 문단의 첫 줄이 40px 가 되어 글이 깨진다.
    // ⇒ 13px 유지(WCAG 2.5.8 inline 면제 + 셀러 내비에 같은 목적지가 있다).
    expect(code(STORE), '안 닿는 히트영역을 다시 선언했다 — 하네스 reachDead 로 재확인할 것')
      .not.toMatch(/to="\/seller\/business-info"[^>]*tap-reach/)
  })
})

describe('④ 폼 입력 — 그 화면의 공용 상수로 40px', () => {
  it('INPUT 상수가 min-h-[40px] 를 갖는다', () => {
    const s = code(STORE)
    expect(s, '입력 높이 보장이 사라졌다(38px 로 환원)').toMatch(/const INPUT = '[^']*min-h-\[40px\]/)
  })

  it('입력들이 그 상수를 쓴다 — 한 자리만 고치면 폼 밀도가 갈린다', () => {
    const s = code(STORE)
    const uses = (s.match(/className=\{(?:`\$\{)?INPUT/g) || []).length
    expect(uses, `INPUT 상수를 쓰는 입력이 ${uses}개뿐이다 — 상수를 우회한 입력이 생겼는지 볼 것`)
      .toBeGreaterThanOrEqual(5)
  })
})

describe('🧾 정산 패널 — 서버 봉투와 클라 소비가 같은 키를 쓴다', () => {
  it('서버는 { success, data, pagination } 을 준다', () => {
    const s = code(ROUTE)
    expect(s, '서버 봉투가 바뀌었다 — 그러면 아래 소비 키도 함께 바꿀 것').toMatch(/data:\s*rows/)
  })

  it('클라가 그 키(data)를 읽는다 — items 는 늘 undefined 였다', () => {
    const s = code(PANEL)
    expect(s, '봉투 불일치가 되돌아왔다 — 행이 있어도 빈 상태 문구가 뜬다').toContain('q.data?.data')
    expect(s, 'items 로 되돌아갔다').not.toContain('q.data?.items')
  })

  it('🔴 반대 방향으로 고치지 않았다 — 서버를 items 로 바꾸면 어드민·pagination 계약이 깨진다', () => {
    const s = code(ROUTE)
    expect(s, '서버가 items 로 바뀌었다 — 그 라우트는 어드민도 쓴다').not.toMatch(/items:\s*rows/)
    expect(s, 'pagination 계약이 사라졌다').toContain('pagination')
  })
})
