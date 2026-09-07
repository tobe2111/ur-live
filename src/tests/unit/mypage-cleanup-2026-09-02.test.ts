/**
 * 🧹 마이페이지 정리 (2026-09-02 대표 지시 6건)
 *
 * *"마이페이지에 에이전시 사업 탭은 없어야 해. 주문현황도 배송 형태는 아니고, 이용권 현황에 맞게
 *   변경해야지. /my-orders 주문내역 페이지 지금 잘못됐어. 앱 정보는 맨 밑에 넣어줘. 프로필 수정에서
 *   전화번호 입력은 필수로 둬줘. 디지털 보관함도 필요없고. 매장 계산대는 셀러 계정이라면 위에 있어야하지 않을까"*
 *
 * ⚠️ **못 막는 것**: 실제 렌더 순서·눈으로 본 위치. 여기서는 소스의 배선만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')

/**
 * 주석을 걷어낸 **코드만** 본다. 설명 주석에 '배송준비' 같은 단어가 남아 있는 것은 정상이고
 * (왜 걷어냈는지를 적어 둔 자리다) 그걸 위반으로 세면 안 된다.
 * ⚠️ 과다 제거 방지: 걷어낸 뒤에도 `expectMarker` 가 남아 있는지 확인한다 —
 *   주석 안의 `/*` 하나가 실제 코드를 통째로 삼키는 사고를 이 레포가 이미 겪었다.
 */
function codeOnly(src: string, expectMarker: string): string {
  const out = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  if (!out.includes(expectMarker)) throw new Error(`주석 제거가 코드를 삼켰다 — '${expectMarker}' 가 사라졌다`)
  return out
}

describe('① 에이전시 사업 진입 CTA 제거', () => {
  const SRC = read('src/pages/user-profile/RoleCtaGrid.tsx')

  it('소비자 마이페이지에 에이전시 모집 CTA 가 없다', () => {
    expect(SRC).not.toContain("roleCta.agencyBiz")
    expect(SRC).not.toContain('/agency/register/business')
  })

  /**
   * ⚠️ 이건 **지우면 안 되는 것**이다. 이미 에이전시인 사람이 자기 대시보드로 가는 유일한 문이라,
   * "에이전시 관련 항목" 을 싸잡아 지우면 그 사람들이 갇힌다.
   */
  it('이미 에이전시인 사람의 대시보드 바로가기는 남아 있다', () => {
    expect(SRC).toContain("roleCta.agencyDash")
    expect(SRC).toContain("to: '/agency'")
  })
})

describe('② 주문 현황 → 이용권 현황 (배송 5단계 폐기)', () => {
  const SRC = read('src/pages/user-profile/OrderStatusBar.tsx')

  /**
   * 이 바는 쇼핑몰의 배송 5단계였다. 유어딜은 배송이 없어 세 칸이 **영원히 0** 이었고,
   * `hasAnyOrder` 가 "0이면 숨긴다" 로 그 사실을 가리고 있었다.
   */
  it('배송 단계 칩이 없다', () => {
    const code = codeOnly(SRC, 'export default function OrderStatusBar')
    for (const k of ['배송준비', '배송중', '배송완료', 'preparing', 'shipping', 'delivered']) {
      expect(code, `${k} 이 남아 있으면 이용권 사용자에게 영원히 0인 칸이 보인다`).not.toContain(k)
    }
  })

  it('이용권 생애 4단계다', () => {
    for (const k of ['bought', 'usable', 'used', 'gone']) expect(SRC).toContain(`key: '${k}'`)
    expect(SRC).toContain('voucherStatus.sectionTitle')
  })

  it('지갑과 같은 훅에서 센다 — 두 화면이 갈릴 수 없다', () => {
    const code = codeOnly(SRC, 'export default function OrderStatusBar')
    expect(code).toContain('useMyVouchers')
    expect(code, '주문(orders)이 아니라 이용권(vouchers)이 사람이 세는 단위다').not.toContain('useMyOrders')
  })

  /**
   * 🩸 처음엔 `String(v.expires_at).replace(' ','T') + 'Z'` 를 손으로 붙였다. 그러면 **이미 'Z' 가
   * 붙어 온 값**(KT-알파 병합 경로 등)이 `...ZZ` → `Date.parse` NaN → `NaN < now` 가 **false** 라
   * **만료된 이용권이 조용히 '사용가능' 으로** 세어진다. 실행으로 확인했다(naive OK / ISO-Z NaN).
   * ⇒ 레포 SSOT `parseUTCDate` 만 쓴다 — 두 형태를 모두 받는다(`check-utc-date-parse` 가 요구하는 규약).
   */
  it('만료 판정이 날짜 SSOT 를 쓴다 (손수 조립 금지)', () => {
    const code = codeOnly(SRC, 'export default function OrderStatusBar')
    expect(code).toContain('parseUTCDate(v.expires_at)')
    expect(code, "손으로 + 'Z' 를 붙이면 ISO-Z 값에서 NaN 이 나 만료를 못 잡는다")
      .not.toMatch(/replace\(' ', 'T'\) \+ 'Z'/)
  })

  it('SSOT 가 두 형태를 실제로 같은 시각으로 읽는다', async () => {
    const { parseUTCDate } = await import('@/utils/date')
    expect(parseUTCDate('2026-01-01 00:00:00').toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(parseUTCDate('2026-01-01T00:00:00Z').toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('③ /my-orders 배송 칩이 배송 주문이 있을 때만', () => {
  const SRC = read('src/pages/MyOrdersPage.tsx')

  it('배송 칩이 조건부다', () => {
    expect(SRC).toContain('hasShippingOrders')
    expect(SRC).toMatch(/\.\.\.\(hasShippingOrders \? \[/)
  })

  it('취소·환불 칩이 생겼다 — 이용권/교환권에 실제로 있는 상태다', () => {
    expect(SRC).toContain("key: 'cancelled'")
    expect(SRC).toContain("match: ['CANCELLED', 'REFUNDED', 'FAILED']")
  })

  /** 쇼핑을 다시 열면 그 화면이 그대로 필요하다 — 지운 게 아니라 조건부다. */
  it('배송 필터 자체는 보존됐다', () => {
    for (const k of ['PREPARING', 'SHIPPING', 'DELIVERED']) expect(SRC).toContain(k)
  })
})

describe('④ 앱 정보는 페이지 맨 밑', () => {
  const SRC = read('src/pages/UserProfilePage.tsx')

  it('설정 그룹 밖, 약관/FAQ footer 안에 있다', () => {
    const settingsEnd = SRC.indexOf('</SettingsGroup>')
    const appVer = SRC.lastIndexOf('<AppVersionSection />')
    expect(settingsEnd).toBeGreaterThan(-1)
    expect(appVer, '설정 그룹 안에 있으면 그룹을 열어야만 보인다').toBeGreaterThan(settingsEnd)
  })

  it('한 번만 렌더된다 (이동인데 복제가 되면 두 번 보인다)', () => {
    expect((SRC.match(/<AppVersionSection \/>/g) || []).length).toBe(1)
  })
})

describe('⑤ 프로필 수정 — 전화번호 필수', () => {
  const SRC = read('src/pages/user-profile/AccountControlsSection.tsx')

  /**
   * 교환권은 **MMS 로 그 번호에 발송**되고 이용권 안내도 알림톡으로 간다.
   * 결제 순간의 `PHONE_REQUIRED` 는 계산대 앞에서야 알게 되는 벽이라, 프로필에서 미리 받는다.
   */
  it('빈 값을 막는다', () => {
    expect(SRC).toContain('accountSettings.phoneRequired')
    expect(SRC).toMatch(/if \(!phone\) \{ toast\.error/)
  })

  it('형식까지 본다 — 빈칸만 막으면 "010" 한 글자로도 통과한다', () => {
    expect(SRC).toContain('accountSettings.phoneInvalid')
    expect(SRC).toMatch(/\^01\[016789\]/)
  })

  it('라벨에 필수 표시(*)가 있다', () => {
    const i = SRC.indexOf('accountSettings.editPhone')
    expect(SRC.slice(i, i + 200)).toContain('text-red-500')
  })

  it('6개 언어에 문구가 있다', () => {
    for (const L of ['ko', 'en', 'ja', 'zh', 'es', 'fr']) {
      const j = JSON.parse(read(`public/locales/${L}/translation.json`))
      expect(j.accountSettings?.phoneRequired, `${L} phoneRequired 누락`).toBeTruthy()
      expect(j.voucherStatus?.sectionTitle, `${L} voucherStatus 누락`).toBeTruthy()
    }
  })
})

describe('⑥ 디지털 보관함 진입로 제거 (모바일·PC 둘 다)', () => {
  it('마이 메뉴에 없다', () => {
    for (const f of ['src/pages/user-profile/ShoppingGroup.tsx', 'src/pages/user-profile/AccountPcPane.tsx']) {
      expect(read(f), `${f} 에 남아 있다`).not.toContain('shopping.digitalLibrary')
    }
  })

  /** 라우트와 페이지는 남긴다 — 과거 구매자가 링크로는 닿아야 하고, 되살릴 때 한 줄이면 된다. */
  it('라우트는 살아 있다 (기능 삭제가 아니라 진입로 정리)', () => {
    expect(read('src/App.tsx')).toContain('MyDigitalLibraryPage')
  })
})

describe('⑦ 매장 계산대는 셀러 계정이면 위에', () => {
  const SRC = read('src/pages/UserProfilePage.tsx')

  /** 손님 앞에서 QR 을 찍는, 하루에 가장 많이 누르는 버튼인데 로그아웃·탈퇴 바로 위에 있었다. */
  it('이용권 현황·쇼핑 그룹보다 위에 있다', () => {
    const scan = SRC.indexOf("navigate('/store/scan')")
    const statusBar = SRC.indexOf('<OrderStatusBar />')
    const shopping = SRC.indexOf('<ShoppingGroup')
    expect(scan).toBeGreaterThan(-1)
    expect(scan, '현황 바보다 아래면 여전히 스크롤해야 한다').toBeLessThan(statusBar)
    expect(scan).toBeLessThan(shopping)
  })

  it('수익 그룹(접이식) 안에 들어가 있지 않다 — 접혀 있으면 안 보인다', () => {
    const scan = SRC.indexOf("navigate('/store/scan')")
    const groupOpen = SRC.indexOf('<EarningsGroup>')
    expect(scan).toBeLessThan(groupOpen)
  })

  it('셀러 계정에서만 뜬다', () => {
    const i = SRC.indexOf("navigate('/store/scan')")
    expect(SRC.slice(Math.max(0, i - 400), i)).toContain("localStorage.getItem('seller_token')")
  })
})
