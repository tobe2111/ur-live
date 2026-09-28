/**
 * 🧰 모두 마이에서 (2026-09-26, 설계 §20) — 대표: *"모두 마이에서 하도록"*
 *
 * 셀러 화면은 65개다. 전부 시트로 복제하지 않는다 — 두 벌이 갈리는 순간 한쪽에만 고쳐진 화면이 생긴다.
 * 대신 **마이가 출발점이자 도착점**이 되게 한다. 이 파일이 지키는 것은 그 세 가지 고리다:
 *
 *   ① 목록을 손으로 적지 않는다 — 대시보드와 **같은 색인**을 읽는다(안 그러면 도구가 늘 때 한쪽을 잊는다)
 *   ② 나갈 때 **귀환 표시**를 달고, 그 띠는 레이아웃 **한 곳**에만 있다(65개 중 안 붙인 페이지가 생기지 않게)
 *   ③ 도구 목록은 **좌석을 따라간다** — 종류를 localStorage 가 아니라 토큰에서 읽는다
 *
 * ## 못 막는 것
 * - 실제로 그 화면이 폰에서 열리는지(jsdom 은 레이아웃이 없다).
 * - 65개 각 화면이 마이에서 온 사람에게 말이 되는지 — 그건 사람이 봐야 한다.
 * - 뒤로가기가 진짜 시트를 닫는지(히스토리는 실제 브라우저에서만 판정된다). 배선만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'

const TOOLS = readCode('src/pages/user-profile/seller-section/AllToolsSheet.tsx')
const SECTION = readCode('src/pages/user-profile/SellerSection.tsx')
const LAYOUT = readCode('src/components/SellerLayout.tsx')
const BAR = readCode('src/components/seller/BackToMyBar.tsx')
const RETURN = readCode('src/lib/seller-return.ts')
const SEAT = readCode('src/lib/seller-seat.ts')
const NAVMODEL = readCode('src/components/seller-layout/useSellerNavModel.ts')
const SHEET = readCode('src/pages/user-profile/seller-section/Sheet.tsx')

describe('① 도구 목록을 손으로 적지 않는다', () => {
  it('마이의 전체 도구가 대시보드와 같은 색인을 읽는다', () => {
    const code = stripComments(TOOLS)
    expect(code, '목록을 여기서 따로 적으면 도구가 늘 때 한쪽을 반드시 잊는다')
      .toContain('useSellerNavModel()')
    expect(code).toMatch(/commandItems/)
  })

  it('경로를 손으로 박아 두지 않는다', () => {
    const code = stripComments(TOOLS)
    // `/seller/...` 리터럴이 있으면 그건 색인 밖의 두 번째 목록이 자라고 있다는 뜻이다.
    const hardcoded = code.match(/'\/seller\/[a-z-]+/g) || []
    expect(hardcoded, `손으로 박은 경로: ${hardcoded.join(', ')}`).toHaveLength(0)
  })

  it('전체 도구가 마이 안에서 열린다 (대시보드로 나가지 않는다)', () => {
    const code = stripComments(SECTION)
    expect(code, "종전엔 enterSeat('/seller') 로 곧장 나갔다 — 그러면 마이가 경유지가 된다")
      .toMatch(/openTool\('tools'\)/)
    expect(code).toContain('<AllToolsSheet')
  })
})

describe('② 나갔다가 돌아온다', () => {
  it('마이에서 내보낼 때 귀환 표시를 붙인다', () => {
    const code = stripComments(SECTION)
    expect(code, '표시가 없으면 일이 끝나는 화면에서 마이로 오는 길이 없다')
      .toMatch(/location\.assign\(withMyReturn\(/)
  })

  it('귀환 띠는 레이아웃 한 곳에만 있다', () => {
    expect(stripComments(LAYOUT), '페이지마다 붙이면 안 붙인 페이지가 생긴다').toContain('<BackToMyBar />')
    // 개별 셀러 페이지가 각자 붙이기 시작하면 그 순간 규약이 갈린다.
    const pages = readCode('src/pages/SellerMorePage.tsx')
    expect(stripComments(pages)).not.toContain('BackToMyBar')
  })

  it('띠는 세션 기록으로 판정한다 — URL 파라미터만으로는 부족하다', () => {
    const bar = stripComments(BAR)
    expect(bar).toContain('noteMyReturn(')
    expect(bar).toContain('shouldOfferMyReturn()')
    // 대시보드 안에서 한 번만 이동해도 `?from=my` 는 떨어져 나간다.
    expect(stripComments(RETURN)).toContain('sessionStorage')
  })

  it('마이에 도착하면 흔적을 지운다', () => {
    expect(stripComments(SECTION), '안 지우면 다음 대시보드 방문에도 띠가 남는다')
      .toMatch(/clearMyReturn\(\)/)
    expect(stripComments(BAR), '띠를 눌러 돌아갈 때도 지운다').toMatch(/clearMyReturn\(\)/)
  })

  it('탭 수명이다 — localStorage 에 적지 않는다', () => {
    expect(stripComments(RETURN), '어제 들어간 흔적이 오늘 띠로 뜨면 안 된다')
      .not.toContain('localStorage')
  })
})

describe('③ 도구 목록이 좌석을 따라간다', () => {
  it('매장 종류를 토큰에서 읽는다', () => {
    const code = stripComments(NAVMODEL)
    expect(code, 'localStorage.seller_type 은 좌석 전환을 안 따라간다 — A 의 메뉴를 B 에서 보게 된다')
      .toMatch(/currentSeatType\(\)\s*\|\|/)
  })

  it('좌석 토큰 디코드가 한 벌이다', () => {
    const code = stripComments(SEAT)
    // 두 벌이 되면 claim 을 하나 더 읽을 때마다 세 벌, 네 벌이 된다.
    const decodes = code.match(/atob\(/g) || []
    expect(decodes, `디코드가 ${decodes.length}곳 — readSeatClaims 하나여야 한다`).toHaveLength(1)
    expect(code).toContain('export function readSeatClaims')
    expect(code).toContain('export function currentSeatType')
  })

  it('종류는 표시가 아니라 필터에 쓰이므로 폴백이 있다', () => {
    // 토큰이 없거나 옛 토큰이면 null 이다 — 그때 메뉴가 통째로 비면 안 된다.
    expect(stripComments(NAVMODEL)).toMatch(/\|\|\s*'influencer'/)
  })
})

describe('시트는 뒤로가기로 닫힌다', () => {
  it('열릴 때 히스토리 한 칸을 쌓고 popstate 에서 닫는다', () => {
    const code = stripComments(SHEET)
    expect(code, '안 쌓으면 뒤로가기가 시트가 아니라 마이를 통째로 닫는다').toContain('history.pushState')
    expect(code).toContain("'popstate'")
  })

  it('X·배경으로 닫으면 쌓아 둔 칸을 도로 뺀다', () => {
    const code = stripComments(SHEET)
    expect(code, '안 빼면 그 뒤 뒤로가기를 한 번 먹는다').toMatch(/if \(!popped\)[\s\S]{0,80}history\.back\(\)/)
  })
})

// ── §20-5 온보딩 셋 ───────────────────────────────────────────────────────
const PIN = readCode('src/pages/user-profile/seller-section/PinSheet.tsx')
const BANK = readCode('src/pages/user-profile/seller-section/BankSheet.tsx')
const WITHDRAW = readCode('src/pages/user-profile/seller-section/WithdrawSheet.tsx')

describe('🔑🏦 출금이 막히면 그 자리에서 푼다 (§20-5)', () => {
  // ⚠️ "전체 도구 ›" 자체는 이제 **마이 안 시트**를 가리킨다(§20-1) — 그 문구가 있다고 나가는 게 아니다.
  //   막아야 하는 것은 **PIN·계좌**가 여전히 딴 데로 보내는 것뿐이다. 사업자등록증은 의도적으로
  //   진입으로 남겼다(사진 업로드 + OCR — §19-1 등록 폼과 같은 무게).
  it('PIN·계좌는 시트 밖으로 보내지 않는다', () => {
    const code = stripComments(WITHDRAW)
    expect(code, 'PIN 안내가 아직 다른 화면을 가리킨다').not.toMatch(/PIN[^\n]*전체 도구/)
    expect(code, '계좌 안내가 아직 다른 화면을 가리킨다').not.toMatch(/계좌[^\n]*전체 도구/)
    expect(code).toMatch(/onFixPin\?\.\(\)|onFixPin\(\)/)
    expect(code).toMatch(/onFixBank/)
  })

  it('사업자등록증만 진입으로 남는다 (의도적 — 업로드+OCR)', () => {
    const code = stripComments(WITHDRAW)
    expect(code).toMatch(/BUSINESS_REGISTRATION_REQUIRED:[^\n]*전체 도구/)
  })

  it('PIN 412 는 문구만 띄우지 않고 시트를 연다', () => {
    expect(stripComments(WITHDRAW)).toMatch(/PIN_REQUIRED' && onFixPin/)
    // 🔑 2026-09-26: PIN 을 요구하는 쪽이 둘이 됐다(출금·계좌). 돌아갈 곳이 갈리므로
    //   `pinReturn` 을 함께 세운다 — 세우지 않으면 계좌를 넣다 푼 사람이 출금에 떨어진다.
    expect(stripComments(SECTION), '출금이 PIN 시트를 안 연다')
      .toMatch(/onFixPin=\{\(\) => \{ setPinReturn\('withdraw'\); setTool\('pin'\) \}\}/)
  })

  /**
   * 🔴 2026-09-26 수리 — **계좌 변경도 412 를 준다.** `PUT /api/seller/profile` 은 계좌 필드가
   * 섞이면 PIN 을 요구하는데(`seller-profile.routes`), 처음 만든 `BankSheet` 에 그 분기가 없어
   * *"계좌 변경은 PIN 인증이 필요합니다"* 문장만 뜨고 **풀 방법이 없었다** — 출금이 막혀 계좌를
   * 넣으러 온 사장님이 거기서 다시 막혔다(대시보드로 나가야 했다). 돌아갈 곳도 출금이 아니라
   * **계좌**여야 한다 — 아니면 계좌를 저장도 못 한 채 출금 화면에 떨어진다.
   */
  it('🔑 계좌 412 도 그 자리에서 풀고, 계좌로 되돌아온다', () => {
    expect(stripComments(BANK), '계좌 시트가 412 를 안 받으면 막다른 길이다').toMatch(/PIN_REQUIRED' && onFixPin/)
    expect(stripComments(SECTION)).toMatch(/onFixPin=\{\(\) => \{ setPinReturn\('bank'\); setTool\('pin'\) \}\}/)
  })

  // 🩸 이 시험은 처음에 헛돌았다. `<PinSheet[\s\S]{0,160}onDone=…` 로 썼더니 그 160자가 **다음 줄의
  //   `<BankSheet>` 까지 건너가** 거기 있는 onDone 에 매치됐다 — PinSheet 에서 onDone 을 통째로
  //   지워도 초록이었다(주입 러너가 잡았다). ⇒ 태그가 쓰인 **그 줄 안에서만** 본다.
  it('풀고 나면 요구한 시트로 되돌아온다', () => {
    const code = stripComments(SECTION)
    const lines = code.split('\n')
    // 🔑 PIN 은 **요구한 쪽**으로 돌아간다 — 한 곳으로 고정하면 계좌를 넣다 푼 사람이 출금에 떨어진다.
    const pin = lines.find((l) => l.includes('<PinSheet'))
    expect(pin, '<PinSheet 렌더 줄을 못 찾았다').toBeTruthy()
    expect(pin, 'PIN 이 요구한 시트로 안 돌아온다').toContain("onDone={() => setTool(pinReturn)}")
    // 계좌를 저장하면 원래 하려던 출금으로 이어진다(그 흐름 때문에 계좌를 넣은 것이다).
    const bankAt = code.indexOf('<BankSheet')
    expect(bankAt, '<BankSheet 를 못 찾았다').toBeGreaterThan(0)
    expect(code.slice(bankAt, bankAt + 240), '계좌 저장 뒤 출금으로 안 이어진다').toContain("onDone={() => setTool('withdraw')}")
  })

  it('PIN 은 거는 것과 확인하는 것이 둘 다 있다', () => {
    const code = stripComments(PIN)
    expect(code).toContain("api.post('/api/seller/set-pin'")
    // 확인까지 해야 쿠키가 나오고 출금이 통과한다.
    expect(code, 'set 만 하면 쿠키가 없어 출금이 또 412 를 받는다').toContain("api.post('/api/seller/verify-pin'")
  })

  it('비밀번호 필요 여부를 한국어 문장으로 판정하지 않는다', () => {
    const code = stripComments(PIN)
    expect(code).toContain("=== 'PASSWORD_REQUIRED'")
    expect(code, '문구를 다듬는 순간 깨진다').not.toContain('현재 비밀번호를 입력해주세요')
    // 서버가 그 코드를 실제로 준다.
    expect(stripComments(readCode('src/features/seller/api/seller-pin.routes.ts')))
      .toContain("code: 'PASSWORD_REQUIRED'")
  })

  it('계좌 시트는 좌석을 안 따라가는 localStorage 를 쓰지 않는다', () => {
    const code = stripComments(BANK)
    // 대시보드 폼은 저장 후 seller_bank_name 등을 적는다 — 그 키는 좌석 전환을 안 따라간다(§19-3).
    for (const k of ['seller_bank_name', 'seller_account_number', 'seller_account_holder']) {
      expect(code, `${k} 를 적으면 가게를 옮긴 뒤 남의 계좌가 남는다`).not.toContain(k)
    }
    expect(code).toContain("api.put('/api/seller/profile'")
  })

  it('두 시트 모두 보내기 직전 좌석을 확인한다', () => {
    for (const [name, code] of [['pin', PIN], ['bank', BANK]] as const) {
      expect(stripComments(code), name).toMatch(/assertSeat\(sellerId\)/)
      expect(stripComments(code), name).toMatch(/SeatMismatchError/)
    }
  })
})

// ── §20-6 대시보드로 보내는 문 ────────────────────────────────────────────
describe('🏠 대시보드를 쓸 필요 없게 — 보내는 문을 막는다 (§20-6)', () => {
  it('알림톡 첫 접촉이 대시보드가 아니라 마이로 착륙한다', () => {
    const code = stripComments(readCode('src/pages/SellerWaitingPage.tsx'))
    // 이 화면은 사장님의 첫 접촉이다(알림톡 "내 매장 관리하기"). 여기서 배우는 것이 그의 기본값이 된다.
    expect(code, "여기서 /seller 로 보내면 '내 가게는 대시보드에 있다' 를 가르친다")
      .toMatch(/navigate\(MY_PATH, \{ replace: true \}\)/)
    // ⚠️ 조건이 안전장치다 — switch-to-seller 성공 = 소비자 세션 있음 = 마이가 열린다.
    expect(code).toMatch(/if \(entered\) \{/)
  })

  it('매장을 막 얻은 사람도 마이로 간다', () => {
    expect(stripComments(readCode('src/pages/StoreClaimPage.tsx')))
      .toMatch(/navigate\(MY_PATH, \{ replace: true \}\)/)
  })

  it('소비자 화면에서 대시보드로 나갈 때는 귀환 표시를 단다', () => {
    for (const f of ['src/pages/GroupBuyDetailPage.tsx', 'src/pages/MyStorePage.tsx']) {
      const code = stripComments(readCode(f))
      const bare = code.match(/navigate\('\/seller[^']*'\)/g) || []
      expect(bare, `${f} 에 표시 없는 대시보드 이동: ${bare.join(', ')}`).toHaveLength(0)
      expect(code, f).toContain('withMyReturn(')
    }
  })

  it('MY_PATH 를 손으로 적지 않는다', () => {
    // 마이 주소가 바뀌면 한 곳만 고쳐야 한다.
    for (const f of ['src/pages/SellerWaitingPage.tsx', 'src/pages/StoreClaimPage.tsx']) {
      expect(stripComments(readCode(f)), f).not.toContain("'/user/profile'")
    }
  })
})
