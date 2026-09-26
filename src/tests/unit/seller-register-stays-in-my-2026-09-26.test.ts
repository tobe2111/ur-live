/**
 * 🎟️🏨 이용권 등록 · 숙소를 마이 안에서 (2026-09-26, 설계 §21 후속)
 *   대표: *"이용권 등록, 숙소까지 해줘 쿠폰은 앞으로 필요없을 것 같은데? 확인해줘"*
 *
 * ## 이 시험이 지키는 단 하나
 * **등록 폼을 복제하지 않는다.** 위저드는 3단계에 지도·사진·임시저장까지 얹힌 495줄이다.
 * 시트용으로 다시 만들면 **반드시 한쪽만 고쳐지고**, 그때부터 두 화면이 서로 다른 상품을 만든다
 * — 에러는 안 난다. 그래서 "같은 파일을 연다" 를 기계가 지킨다.
 *
 * ## 못 막는 것
 *   - 시트 안에서 지도·사진 업로드가 실제로 동작하는지(z-index·파일 입력) — 브라우저가 판정한다.
 *   - 라이트 섬 안 대비 — `check-dark-contrast`(브라우저 워크플로)가 본다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, readRaw, stripComments } from '../helpers/source-text'

const WIZARD = readCode('src/pages/SellerMealVoucherNewPage.tsx')
const LAYOUT = readCode('src/components/SellerLayout.tsx')
const NEWSHEET = readCode('src/pages/user-profile/seller-section/VoucherNewSheet.tsx')
const STAYS = readCode('src/pages/user-profile/seller-section/StaysSheet.tsx')
const VOUCHERS = readCode('src/pages/user-profile/seller-section/VoucherSheet.tsx')
const NAV = readCode('src/components/seller/seller-nav.ts')
const FLAGS = readCode('src/shared/feature-flags.ts')
// ⚠️ `readCode` 는 **주석을 지운다** — 근거는 주석에 적혀 있으므로 그 검사만 원문을 읽는다.
const FLAGS_RAW = readRaw('src/shared/feature-flags.ts')
const ROUTES = readCode('src/routes/seller.routes.tsx')

describe('0. 검사 대상이 실재한다', () => {
  it('소스가 모두 충분한 길이로 읽힌다', () => {
    // ⚠️ `readCode` 는 주석을 지운 **코드 길이**다. `VoucherNewSheet` 는 설명이 길고 코드가 짧은
    //   것이 정상이다(자기 폼이 없다는 뜻) — 그래서 바가 낮다. 0 이면 경로가 낡은 것이다.
    for (const [n, c, min] of [['wizard', WIZARD, 8000], ['layout', LAYOUT, 4000], ['newSheet', NEWSHEET, 400], ['stays', STAYS, 2500]] as const) {
      expect(c.length, `${n}: 소스를 못 읽었다 — 앵커부터 고칠 것`).toBeGreaterThan(min)
    }
  })
})

describe('1. 🎟️ 등록 — 복제하지 않고 **같은 파일**을 연다', () => {
  it('시트가 대시보드 위저드를 그대로 렌더한다', () => {
    const code = stripComments(NEWSHEET)
    expect(code, '위저드를 안 부르면 시트가 자기 폼을 갖게 된다').toMatch(/import\('@\/pages\/SellerMealVoucherNewPage'\)/)
    expect(code).toMatch(/<VoucherWizard\s+embedded/)
  })

  it('🔴 시트가 자기 입력 칸을 만들지 않는다', () => {
    const code = stripComments(NEWSHEET)
    for (const tag of ['<input', '<textarea', '<select', 'useState(']) {
      expect(code, `${tag} 가 있으면 폼이 두 벌로 갈리기 시작한 것이다`).not.toContain(tag)
    }
  })

  it('무겁게 한 번에 받지 않는다 — 누를 때 받는다', () => {
    // 지도 SDK·업로드까지 딸린 화면이라 정적 import 면 마이 청크가 그만큼 커진다.
    expect(stripComments(NEWSHEET)).toMatch(/lazy\(\(\) => import\(/)
    expect(stripComments(NEWSHEET)).toContain('<Suspense')
  })

  it('🏝️ 라이트 섬은 **클래스**다 — 주석은 런타임에 아무 일도 안 한다', () => {
    // 이 페이지들은 대시보드 규칙상 `dark:` 가 금지돼 있다. 마이는 다크를 지원한다.
    // 2026-09-03 지도 검색창이 주석만 달고 클래스가 없어 흰 배경 위 흰 글자가 됐다.
    expect(stripComments(NEWSHEET), 'light-island 클래스가 없으면 다크에서 글자가 안 보인다').toMatch(/className="[^"]*\blight-island\b/)
  })
})

describe('2. 🪟 껍데기만 벗는다 — 폼 계약은 불변', () => {
  it('`bare` 조기 반환이 **모든 훅 뒤**에 있다', () => {
    const code = stripComments(LAYOUT)
    const at = code.indexOf('if (bare) return')
    expect(at, 'bare 분기가 없다').toBeGreaterThan(0)
    // 훅이 그 뒤에 있으면 조건부 훅이 되어 React 가 깨진다.
    const after = code.slice(at)
    for (const hook of ['useState(', 'useEffect(', 'useTokenAutoRefresh(', 'useSellerNavModel(']) {
      expect(after, `${hook} 이 조기 반환 뒤에 있다 — 조건부 훅이다`).not.toContain(hook)
    }
  })

  it('도매 전용 리다이렉트보다 **먼저** 반환한다', () => {
    const code = stripComments(LAYOUT)
    expect(code.indexOf('if (bare) return')).toBeLessThan(code.indexOf('if (wholesaleOnly) return null'))
  })

  it('🔴 제출 계약이 `embedded` 에 안 닿는다', () => {
    const code = stripComments(WIZARD)
    const at = code.indexOf('async function handleSubmit(')
    expect(at, 'handleSubmit 을 못 찾았다 — 앵커가 낡았다').toBeGreaterThan(0)
    const end = code.indexOf('\n  }', code.indexOf("api.post('/api/seller/products'"))
    const body = code.slice(at, end > at ? end : at + 3000)
    expect(body, '제출 payload 는 시트 여부와 무관해야 한다').not.toContain('embedded')
    expect(code, '제출 엔드포인트가 바뀌었다').toContain("api.post('/api/seller/products'")
  })

  it('시트 안에서는 라우팅하지 않는다 — 마이가 통째로 사라진다', () => {
    const code = stripComments(WIZARD)
    // 완료·취소가 `navigate` 로 나가면 시트를 닫는 게 아니라 마이를 떠난다.
    for (const m of [/if \(embedded\) \{ onCreated\?\.\(createdId\); return \}/, /if \(embedded\) \{ onClose\?\.\(\); return \}/]) {
      expect(code, `시트 분기 누락: ${m}`).toMatch(m)
    }
    expect(code, '시트에서 로그인 리다이렉트를 타면 작성 중인 내용이 날아간다').toMatch(/if \(!embedded\) \{ redirectToLogin/)
  })
})

describe('3. 🏨 숙소 — 목록은 시트, 달력은 전체화면', () => {
  it('🪑 좌석이 안 맞으면 부르지 않는다', () => {
    expect(stripComments(STAYS)).toMatch(/if \(currentSeatId\(\) !== sellerId\)/)
  })

  it('읽기만 한다 — 시트에서 숙소를 고치지 않는다', () => {
    const code = stripComments(STAYS)
    expect(code, '쓰기가 생기면 assertSeat 이 함께 와야 한다').not.toMatch(/api\.(put|post|patch|delete)\(/)
  })

  it('달력·객실은 시트에서 그리지 않고 내보낸다', () => {
    const code = stripComments(STAYS)
    expect(code).toMatch(/onOpen\(`\/seller\/stays\/\$\{s\.id\}`\)/)
    expect(code, '달력을 시트 폭에 그리면 날짜 칸이 손가락보다 작아진다').not.toMatch(/calendar|달력 그리기/i)
  })

  it('빈 목록을 "고장" 으로 읽히게 두지 않는다', () => {
    // 라이브에서 셀러 소유 숙소는 0개다(2026-09-26 실측) — 대부분 이 화면을 본다.
    expect(stripComments(STAYS)).toContain('아직 등록한 숙소가 없어요')
  })

  it('이용권 묶음에서 열린다 — 별도 최상위 줄을 만들지 않는다', () => {
    const code = stripComments(VOUCHERS)
    expect(code).toContain('<StaysSheet')
    expect(code).toContain('onOpenPath')
  })
})

describe('4. 🎫 쿠폰 — 메뉴에서 내리되 되돌릴 수 있게', () => {
  it('nav 에서 플래그로 가린다', () => {
    expect(stripComments(FLAGS)).toMatch(/export const SELLER_COUPONS_HIDDEN = true/)
    expect(stripComments(NAV)).toMatch(/SELLER_COUPONS_HIDDEN \? \[\] : \[navFromGroup\('\/seller\/coupons'\)\]/)
  })

  it('🔴 라우트·페이지는 **지우지 않는다** — 되돌릴 수 있어야 한다', () => {
    // 판단 근거는 "지금 안 쓴다"(셀러 생성 0건)이지 "영원히 틀렸다" 가 아니다.
    // 🩸 처음엔 `toContain('/seller/coupons')` 로 썼는데 `/seller/coupons-removed` 도 그걸 **포함**해
    //   경로를 바꿔도 초록이었다(주입 러너가 잡았다) — 닫는 따옴표까지 앵커한다.
    expect(stripComments(ROUTES), '라우트를 지우면 플래그를 false 로 해도 안 돌아온다')
      .toMatch(/path="\/seller\/coupons"/)
  })

  it('실측 근거가 플래그 옆에 적혀 있다', () => {
    // 숫자 없이 숨기면 다음 세션이 왜 숨겼는지 모르고 되살린다.
    const at = FLAGS_RAW.indexOf('export const SELLER_COUPONS_HIDDEN')
    expect(at, '플래그 선언을 못 찾았다').toBeGreaterThan(0)
    const doc = FLAGS_RAW.slice(Math.max(0, at - 2600), at)
    expect(doc, '근거(셀러 생성 0건)가 선언 위에 없다').toMatch(/셀러가 만든 쿠폰은 0건/)
    expect(doc, '되돌리는 법이 없다').toMatch(/false/)
  })
})
