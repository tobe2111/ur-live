/**
 * 🧩 마이에 남은 셋(정산 명세 · 소개 파트너 · 브랜드메시지) + 안 쓰는 메뉴 정리
 *   (2026-09-26 대표 *"나머지도 다 해줘. 그리고 뺄 것들 빼자"*)
 *
 * ## 이 파일이 막는 제일 큰 사고
 * 🔴 **마이에서 알림톡을 보내 버리는 것.** 발송은 등급 C(승인 전 실행 금지)이고, 잘못 보낸
 * 문자는 회수가 안 된다. 시트가 조회만 하도록 **엔드포인트 이름으로** 막는다.
 * 🔴 **협업 수락 버튼이 서버 조건과 어긋나는 것.** 서버 `/deals/:id/respond` 는 셋이 전부
 * 맞을 때만 받는다(status·proposed_by·requires_content_proof). 화면이 느슨하면 눌러도
 * 404 가 나고 사장님은 이유를 모른다 — 그래서 판정 함수를 **실제로 실행해** 잰다.
 *
 * ## 뺀 것과 안 뺀 것을 함께 고정한다
 * 숙소·체험 캠페인·후기 인증은 실측 0이라 내렸다. **리뷰는 내리지 않았다** — 같은 0이라도
 * 원인이 "셀러 상품이 아직 1개" 라서다. 그 구분이 다음 세션에 지워지지 않게 양방향으로 박는다.
 *
 * ## 못 막는 것
 * - 서버가 실제로 그 조건으로 거르는지(그건 라우트의 WHERE 이고, 여기서는 화면만 본다).
 * - 시트가 브라우저에서 실제로 열리는지(jsdom 은 레이아웃이 없다).
 * - 플래그를 false 로 되돌렸을 때의 화면(그때는 종전 경로라 기존 테스트가 본다).
 */
import { describe, it, expect } from 'vitest'
import { readCode, readRaw, stripComments } from '../helpers/source-text'
import { canOpenInSheet } from '@/pages/user-profile/seller-section/tool-pages'

const SECTION = readCode('src/pages/user-profile/SellerSection.tsx')
const SETTLE = readCode('src/pages/user-profile/seller-section/SettlementsSheet.tsx')
const WITHDRAW = readCode('src/pages/user-profile/seller-section/WithdrawSheet.tsx')
const GROUPS = readCode('src/components/seller/seller-tab-groups.ts')
const NAV = readCode('src/components/seller/seller-nav.ts')
const FLAGS_RAW = readRaw('src/shared/feature-flags.ts')

/**
 * 🔴 **브랜드메시지 — 마이의 *손수 코드*가 보내지 않는다 (등급 C)**
 *
 * 🧹 **2026-10-01 철거로 판정 대상이 바뀌었다 — 풀지 않고 재조준했다.**
 *   종전 대상은 `MessagesSheet`(조회 전용 손수 시트)였고, 그 시트가 내려갔다.
 *   ⚠️ 그래서 *발송 화면에 마이에서 닿는가* 는 **달라졌다**: 이제 `/seller/alimtalk` 가
 *   `ToolPageSheet` 로 마이 안에서 열린다(= 발송이 마이에서 가능하다).
 *   그건 회귀가 아니라 **대표가 지시한 방향**이다 —
 *   *"드물게 하는 일도 일단 마이로 하고, 대시보드는 쓸 필요없게끔 하자"*(2026-09-26).
 *
 *   지키려던 것은 *"마이가 문자 보내는 화면이 되지 않는다"* 가 아니라
 *   **"우리가 마이에 발송·결제 UI 를 또 만들지 않는다"** 였다(두 벌이 되면 한쪽만 고쳐진다).
 *   ⇒ 판정을 **마이의 손수 코드 전부**(판매 구역 + 남은 시트)로 옮긴다. 발송은 그 화면 자신의 일이다.
 */
describe('🔴 브랜드메시지 — 마이의 손수 코드가 보내지 않는다 (등급 C)', () => {
  /** 마이가 **직접 쓴** 판매 코드. 대시보드 화면(ToolPageSheet 가 그대로 렌더)은 여기 없다. */
  const HANDWRITTEN = ['SellerSection.tsx', 'seller-section/WithdrawSheet.tsx',
    'seller-section/BankSheet.tsx', 'seller-section/PinSheet.tsx',
    'seller-section/SettlementsSheet.tsx', 'seller-section/AllToolsSheet.tsx',
  ].map((f) => [f, readCode(`src/pages/user-profile/${f}`)] as const)

  it('발송·템플릿·충전 엔드포인트를 부르지 않는다', () => {
    expect(HANDWRITTEN.length, '대상 0건 — 목록이 낡아 검사가 헛돌고 있다').toBeGreaterThanOrEqual(6)
    for (const [name, raw] of HANDWRITTEN) {
      const code = stripComments(raw)
      for (const forbidden of ['alimtalk/send', 'alimtalk/templates', 'credits/charge', 'credits/confirm']) {
        expect(code, `${name}: ${forbidden} 는 마이가 직접 부르면 안 된다(그 화면의 일이다)`)
          .not.toContain(forbidden)
      }
    }
  })
})

/**
 * 🧹 **2026-10-01 철거 — 여기 있던 `🤝 소개 파트너` 묶음(6건)을 내렸다.**
 *   그 검사들의 대상은 `PartnersSheet` 가 export 한 `respondability` — **그 시트 안에서
 *   바로 수락할 수 있는 제안인가** 를 가르는 규칙이었다. 시트가 없어졌으니 그 규칙도 없다.
 *   제안 응답은 이제 `/seller/influencer-deals` 대시보드 화면이 맡는다(원본이고, 자기 조건을 갖는다).
 *   ⚠️ 그 화면의 조건이 서버 WHERE 와 같은지는 **이 파일의 일이 아니다** — 그 화면의 시험이 볼 일이다.
 */

describe('🧾 지난 정산 — 조회 전용이고 금액을 지어내지 않는다', () => {
  it('서버 목록을 그대로 읽는다', () => {
    const code = stripComments(SETTLE)
    expect(code).toMatch(/api\.get\(`\/api\/seller\/settlements\?limit=/)
    expect(code).toContain('currentSeatId() !== sellerId')
  })

  it('쓰기가 없다 — 정산 행을 화면이 바꾸지 않는다', () => {
    expect(stripComments(SETTLE), '취소·수정은 어드민 지급 센터의 일이다')
      .not.toMatch(/api\.(post|put|patch|delete)\(/)
  })

  it('금액을 화면에서 다시 계산하지 않는다', () => {
    const code = stripComments(SETTLE)
    // 서버가 준 값을 formatNumber 로 찍기만 한다. 곱셈·뺄셈이 보이면 두 화면이 갈리기 시작한다.
    expect(code).toContain('formatNumber(r.settlement_amount)')
    expect(code, '수수료를 화면이 빼면 대시보드와 다른 숫자가 나온다').not.toMatch(/settlement_amount\s*[-*/]/)
    expect(code).not.toMatch(/total_sales\s*[-*]\s*/)
  })

  it('0행일 때 빈 목록이 아니라 무슨 일인지 말한다', () => {
    const code = stripComments(SETTLE)
    expect(code).toContain('아직 정산 내역이 없어요')
    expect(code, '실패와 0건은 다르게 말해야 한다').toContain('불러오지 못했어요')
  })

  it('출금 시트에서만 열린다 (닫으면 출금으로 돌아온다)', () => {
    const code = stripComments(SECTION)
    expect(code).toMatch(/tool === 'settlements' &&[\s\S]{0,200}onClose=\{\(\) => setTool\('withdraw'\)\}/)
    expect(stripComments(WITHDRAW), '출금 시트가 문을 갖고 있어야 도달한다').toContain('onHistory')
  })
})

describe('🧹 뺄 것 — 실측 0 인 메뉴만, 그리고 되돌릴 수 있게', () => {
  it('플래그가 하나이고 근거(실측)가 파일에 적혀 있다', () => {
    expect(FLAGS_RAW).toMatch(/export const SELLER_DORMANT_HIDDEN = true/)
    // 다음 세션이 "왜 내렸지?" 를 코드에서 바로 읽을 수 있어야 한다.
    expect(FLAGS_RAW).toMatch(/stay_bookings/)
    expect(FLAGS_RAW).toMatch(/experience_campaigns/)
    expect(FLAGS_RAW).toMatch(/kakao_review_submissions/)
  })

  it('숙소는 사이드바·탭 **둘 다**에서 같은 플래그로 접힌다', () => {
    // 한 곳만 내리면 착지점을 잃거나 두 표면이 갈린다.
    // 🧹 2026-10-01 철거: 셋째 표면(마이의 `VoucherSheet` 안 숙소 줄)이 내려갔다 — 그 시트가 없다.
    //   ⇒ 플래그가 가리는 표면은 **둘**이고, 둘 다 보는 것이 지금의 불변식이다.
    expect(stripComments(NAV)).toMatch(/SELLER_DORMANT_HIDDEN \? \[\] : \[navFromGroup\('\/seller\/stays'\)\]/)
    expect(stripComments(GROUPS)).toMatch(/SELLER_DORMANT_HIDDEN \? \[\] : \[\{[\s\S]{0,400}\/seller\/stays/)
  })

  it('체험 캠페인·후기 인증 탭이 같은 플래그 뒤에 있다', () => {
    const code = stripComments(GROUPS)
    for (const path of ['/seller/experience-campaigns', '/seller/review-verifications']) {
      const at = code.indexOf(path)
      expect(at, `${path} 앵커가 낡았다`).toBeGreaterThan(0)
      // 그 경로가 게이트 안에 있는지 — 같은 줄에서 판정한다(주변 200자 검색은 이웃에 걸려 헛돈다).
      const line = code.slice(code.lastIndexOf('\n', at) + 1, code.indexOf('\n', at))
      expect(line, `${path} 가 게이트 밖이면 여전히 노출된다`).toContain('SELLER_DORMANT_HIDDEN')
    }
  })

  it('🔴 리뷰는 내리지 않았다 — 같은 0이라도 뜻이 다르다', () => {
    const code = stripComments(GROUPS)
    const at = code.indexOf("'/seller/reviews'")
    expect(at, '리뷰 탭이 사라졌다 — 실측 근거 없이 내린 것이면 되돌릴 것').toBeGreaterThan(0)
    const line = code.slice(code.lastIndexOf('\n', at) + 1, code.indexOf('\n', at))
    expect(line, '리뷰 0건의 원인은 셀러 상품이 1개뿐이라서다(기능이 죽은 게 아니다)')
      .not.toContain('SELLER_DORMANT_HIDDEN')
  })

  it('지운 게 아니라 접은 것 — 숙소 **라우트·페이지**는 남아 있다', () => {
    // 플래그를 false 로 하면 되돌아와야 한다. 파일이 사라지면 되돌릴 수 없다.
    // 🧹 2026-10-01 철거: 마이의 `StaysSheet`(대시보드 숙소 목록의 폰용 **사본**)는 지웠다.
    //   보존 약속의 진짜 대상은 **원본**이다 — 라우트·페이지·API. 그 셋이 있으면 플래그 하나로 돌아온다.
    //   ⚠️ 사본을 되살릴 일은 없다: 플래그를 켜면 나브가 `/seller/stays` 를 보여 주고
    //      전체 도구가 그 화면을 시트로 연다(`canOpenInSheet`).
    const routes = readCode('src/routes/seller.routes.tsx')
    expect(routes, '숙소 라우트가 사라졌다 — 플래그를 켜도 돌아올 곳이 없다').toContain('/seller/stays')
    expect(() => readCode('src/pages/SellerStaysPage.tsx')).not.toThrow()
    expect(canOpenInSheet('/seller/stays'), '플래그를 켜도 마이에서 못 열면 반쪽 복구다').toBe(true)
  })
})

describe('🔌 배선 — 마이가 남은 시트를 실제로 연다', () => {
  it('남은 시트가 import 되고 렌더된다', () => {
    // 🧹 2026-10-01 철거: 셋 중 둘(`PartnersSheet`·`MessagesSheet`)이 내려갔다. 판정은 그대로 —
    //   **import 만 있고 렌더가 없으면 죽은 코드다**(이 레포가 반복해 당한 클래스).
    const code = stripComments(SECTION)
    for (const [name, tool] of [['SettlementsSheet', 'settlements']] as const) {
      // 🔁 2026-09-26 재조준: 시트가 전부 `lazy` 로 바뀌어 정적 import 줄이 사라졌다.
      //   지키는 것은 그대로다 — **이 파일이 그 시트를 실제로 가져온다**(형태만 dynamic).
      expect(code, `${name} 로딩 누락`).toContain(`lazy(() => import('./seller-section/${name}'))`)
      // 🩸 import 만 보면 렌더를 지워도 초록이 된다(이 레포가 반복해 당한 클래스) → JSX 로 앵커.
      expect(code, `${name} 렌더 누락 — import 만 있으면 죽은 코드다`).toContain(`<${name}`)
      expect(code, `tool === '${tool}' 분기 누락`).toContain(`tool === '${tool}'`)
    }
  })

  /**
   * 🎯 2026-09-30 재조준 — 바로가기 줄에서 **전체 도구**로 옮겼다(대표 확정 ⑥).
   * 지키는 것은 그대로다: *이 둘에 마이에서 닿을 수 있다*. 닿는 길이 표 → 시트로 바뀌었을 뿐이라
   * 표의 두 주소와 **시트 렌더** 둘 다 본다(표만 보면 시트가 없어도 통과한다).
   */
  it('파트너·브랜드메시지에 전체 도구로 닿는다', () => {
    // 🧹 2026-10-01 철거: 닿는 길이 **표 → 대시보드 화면**으로 바뀌었다(손수 시트가 없다).
    //   지키는 것은 그대로다 — *이 둘에 마이에서 닿을 수 있다.*
    const code = stripComments(SECTION)
    for (const path of ['/seller/influencer-deals', '/seller/alimtalk']) {
      expect(canOpenInSheet(path), `${path} 를 시트로 못 연다 — 마이에서 닿을 길이 없다`).toBe(true)
    }
    // 열 수 있다고 선언만 하고 배선이 없으면 아무 일도 안 난다.
    expect(code, '전체 도구가 고른 화면을 시트로 안 연다').toMatch(/if \(inSheet\) \{ setPage\(/)
    expect(code).toMatch(/tool === 'page'/)
  })

  it('전체 도구 줄이 메뉴 이름을 나열하지 않는다 (나열하면 반드시 낡는다)', () => {
    const code = stripComments(SECTION)
    // 🔁 2026-09-26 재조준: 종전엔 "낡은 예시 두 개가 없는가" 만 봤다. 그 판정은 **다음 예시가
    //   낡는 것**을 못 막는다 — 실제로 두 번 낡았고 두 번 다 사람이 손으로 고쳤다.
    //   이제 불변식은 더 강하다: 그 줄에 예시를 **아예 적지 않는다**.
    // 🩸 2026-09-26 3차: 종전엔 **'전체 도구' 가 들어간 한 줄**만 봤다. 구조 시안 A 로 그 줄이
    //   `label="전체 도구"` 가 되고 문구는 **다음 줄(`hint=`)** 로 옮겨가자, 예시를 다시 넣어도
    //   검사가 통과했다(되돌려-검증이 잡았다). ⇒ 줄이 아니라 **그 블록**을 본다.
    const at = code.indexOf('label="전체 도구"')
    expect(at, '"전체 도구" 줄을 못 찾았다 — 검사가 헛돌고 있다').toBeGreaterThan(0)
    const block = code.slice(at, at + 260)
    expect(block, '예시를 나열하면 메뉴가 바뀔 때마다 어긋난다').not.toContain('·')
    for (const gone of ['쿠폰', '알림톡', '숙소', '사업자등록증', '운영자']) {
      expect(block, `"전체 도구" 블록에 메뉴 이름(${gone})이 박혀 있다`).not.toContain(gone)
    }
  })
})
