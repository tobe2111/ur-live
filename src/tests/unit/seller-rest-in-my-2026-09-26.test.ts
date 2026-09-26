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
import { respondability } from '@/pages/user-profile/seller-section/PartnersSheet'

const SECTION = readCode('src/pages/user-profile/SellerSection.tsx')
const SETTLE = readCode('src/pages/user-profile/seller-section/SettlementsSheet.tsx')
const PARTNERS = readCode('src/pages/user-profile/seller-section/PartnersSheet.tsx')
const MESSAGES = readCode('src/pages/user-profile/seller-section/MessagesSheet.tsx')
const WITHDRAW = readCode('src/pages/user-profile/seller-section/WithdrawSheet.tsx')
const VOUCHER = readCode('src/pages/user-profile/seller-section/VoucherSheet.tsx')
const GROUPS = readCode('src/components/seller/seller-tab-groups.ts')
const NAV = readCode('src/components/seller/seller-nav.ts')
const FLAGS_RAW = readRaw('src/shared/feature-flags.ts')

describe('🔴 브랜드메시지 — 마이에서 보내지 않는다 (등급 C)', () => {
  it('발송·템플릿 쓰기 엔드포인트를 부르지 않는다', () => {
    const code = stripComments(MESSAGES)
    // 조회 둘만 허용. 아래 이름이 들어오는 순간 마이가 문자를 보내는 화면이 된다.
    for (const forbidden of ['alimtalk/send', 'alimtalk/templates', 'credits/charge', 'credits/confirm']) {
      expect(code, `${forbidden} 는 마이에서 부르면 안 된다(발송·결제는 전용 화면)`).not.toContain(forbidden)
    }
    expect(code).toContain("api.get('/api/seller/alimtalk/credits')")
    expect(code).toContain("api.get('/api/seller/alimtalk/logs')")
  })

  it('쓰기 요청 자체가 없다', () => {
    const code = stripComments(MESSAGES)
    expect(code, '조회 전용 시트다 — post/put/delete 가 있으면 설계가 바뀐 것').not.toMatch(/api\.(post|put|patch|delete)\(/)
  })

  it('충전·발송은 전용 화면으로 보낸다', () => {
    expect(stripComments(MESSAGES)).toContain("onOpenPath('/seller/alimtalk')")
  })

  it('잔액을 못 읽었을 때 0 으로 덮지 않는다', () => {
    const code = stripComments(MESSAGES)
    // 모르는 것과 0건은 다르다 — 실패는 실패로 말해야 한다(2026-06-26 룰).
    expect(code).toMatch(/setFailed\(true\)/)
    expect(code, '잔액 초기값이 0 이면 "0건" 이 로딩 중에도 참말처럼 보인다').toContain('useState<number | null>(null)')
  })
})

describe('🤝 소개 파트너 — 화면 조건이 서버 WHERE 와 같다', () => {
  // ⚙️ 여기가 이 파일의 핵심이다. 문자열이 아니라 **함수를 돌려서** 잰다.
  const base = { id: 1, commission_pct: 5 }

  it('상대가 보낸 · 답변 대기 · 인증 불필요 → 답할 수 있다', () => {
    expect(respondability({ ...base, status: 'proposed', proposed_by: 'influencer', requires_content_proof: 0 }))
      .toEqual({ can: true })
  })

  it('이미 진행 중이면 답하지 않는다', () => {
    const r = respondability({ ...base, status: 'active', proposed_by: 'influencer' })
    expect(r.can).toBe(false)
  })

  it('내가 보낸 제안에는 내가 답할 수 없다 — 이유를 말한다', () => {
    const r = respondability({ ...base, status: 'proposed', proposed_by: 'seller' })
    expect(r.can).toBe(false)
    expect(r.can === false && r.why).toMatch(/기다려요/)
  })

  it('콘텐츠 인증이 걸린 제안은 시트에서 수락하지 않는다 — 이유를 말한다', () => {
    const r = respondability({ ...base, status: 'proposed', proposed_by: 'influencer', requires_content_proof: 1 })
    expect(r.can).toBe(false)
    expect(r.can === false && r.why).toMatch(/인증/)
  })

  it('필드가 비어 있어도 터지지 않고 "못 함" 으로 떨어진다', () => {
    expect(respondability({ id: 2 }).can).toBe(false)
    expect(respondability({ id: 3, status: null, proposed_by: null, requires_content_proof: null }).can).toBe(false)
  })

  it('목록은 셀러 마케팅 경로에서 읽고, 쓰기 전에 좌석을 다시 확인한다', () => {
    const code = stripComments(PARTNERS)
    expect(code).toContain("api.get('/api/seller-marketing/deals')")
    expect(code).toMatch(/api\.post\(`\/api\/seller-marketing\/deals\/\$\{id\}\/respond`/)
    expect(code, '§15-3 규칙 ②: 보내기 직전 assertSeat').toContain('assertSeat(sellerId)')
    expect(code, '§15-3 규칙 ①: 좌석이 맞을 때만 조회').toContain('currentSeatId() !== sellerId')
  })
})

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

  it('숙소는 사이드바·탭·마이 셋 모두에서 같은 플래그로 접힌다', () => {
    // 한 곳만 내리면 착지점을 잃거나 두 표면이 갈린다.
    expect(stripComments(NAV)).toMatch(/SELLER_DORMANT_HIDDEN \? \[\] : \[navFromGroup\('\/seller\/stays'\)\]/)
    expect(stripComments(GROUPS)).toMatch(/SELLER_DORMANT_HIDDEN \? \[\] : \[\{[\s\S]{0,400}\/seller\/stays/)
    expect(stripComments(VOUCHER)).toContain('!SELLER_DORMANT_HIDDEN')
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

  it('지운 게 아니라 접은 것 — 숙소 화면·라우트는 남아 있다', () => {
    // 플래그를 false 로 하면 되돌아와야 한다. 파일이 사라지면 되돌릴 수 없다.
    expect(() => readCode('src/pages/user-profile/seller-section/StaysSheet.tsx')).not.toThrow()
    expect(stripComments(VOUCHER), 'StaysSheet 렌더가 통째로 사라지면 복구가 코드 작성이 된다')
      .toContain('<StaysSheet')
  })
})

describe('🔌 배선 — 마이가 세 시트를 실제로 연다', () => {
  it('세 시트가 import 되고 렌더된다', () => {
    const code = stripComments(SECTION)
    for (const [name, tool] of [['PartnersSheet', 'partners'], ['MessagesSheet', 'messages'], ['SettlementsSheet', 'settlements']] as const) {
      expect(code, `${name} import 누락`).toContain(`import ${name} from './seller-section/${name}'`)
      // 🩸 import 만 보면 렌더를 지워도 초록이 된다(이 레포가 반복해 당한 클래스) → JSX 로 앵커.
      expect(code, `${name} 렌더 누락 — import 만 있으면 죽은 코드다`).toContain(`<${name}`)
      expect(code, `tool === '${tool}' 분기 누락`).toContain(`tool === '${tool}'`)
    }
  })

  it('파트너·브랜드메시지는 묶음 줄에서 열린다', () => {
    const code = stripComments(SECTION)
    expect(code).toMatch(/label="소개 파트너"[\s\S]{0,200}openTool\('partners'\)/)
    expect(code).toMatch(/label="브랜드메시지"[\s\S]{0,200}openTool\('messages'\)/)
  })

  it('전체 도구 줄 문구가 실제 목록과 맞다', () => {
    const code = stripComments(SECTION)
    // 알림톡·소개 파트너는 이제 묶음이고, 쿠폰·숙소는 내려갔다 — 없는 메뉴를 예시로 들면 찾으러 간다.
    for (const gone of ['쿠폰 · 알림톡', '소개 파트너 · 숙소']) {
      expect(code, `"전체 도구" 힌트에 낡은 예시가 남았다: ${gone}`).not.toContain(gone)
    }
  })
})
