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

describe('① 에이전시 사업 진입 CTA 제거', () => {
  const SRC = read('src/pages/user-profile/RoleCtaGrid.tsx')

  it('소비자 마이페이지에 에이전시 모집 CTA 가 없다', () => {
    expect(SRC).not.toContain("roleCta.agencyBiz")
    expect(SRC).not.toContain('/agency/register/business')
  })

  /**
   * 🌇 2026-09-04 **방향이 뒤집혔다.** 09-02 에는 "이미 에이전시인 사람의 대시보드 바로가기는 남긴다"
   * 가 맞았다(그 문이 없으면 갇히니까). 지금은 대시보드 자체가 사라졌으므로, 바로가기가 남아 있으면
   * **없는 화면으로 보내는 죽은 링크**가 된다. 그래서 같은 자리를 반대로 잠근다.
   */
  it('에이전시 대시보드 바로가기도 사라졌다 (대시보드 자체가 없다)', () => {
    expect(SRC).not.toContain('roleCta.agencyDash')
    expect(SRC).not.toContain("to: '/agency'")
  })
})

// 🧹 2026-10-19 — 그 바(배송 5단계 → 이용권 현황)는 통째로 걷혔다(맨 위 숫자 줄과 겹쳤다).
//   돌아오지 않는가는 `my-cache-owner-and-status-height-2026-10-18.test.tsx` ② 가 지킨다.

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
  /**
   * 🩸 **재조준 2026-10-11** — 프로필 편집이 `AccountControlsSection`(모달)에서 A-2 시트
   * (`profile-edit/ProfileEditSheet.tsx`)로 옮겨갔다. 불변식 넷은 그대로이고 앵커만 옮긴다.
   * ⚠️ 하나는 **모양이 바뀌었다**: 종전엔 라벨 뒤에 빨간 `*` 를 달았는데, 줄 목록에는 라벨 뒤에
   *   별을 붙일 자리가 없다 ⇒ 같은 일(없다는 사실을 미리 또렷이 알림)을 **빈 값을 빨갛게 적는 것**
   *   으로 한다(`EditRow` 의 `required`). 지키려는 것은 `*` 라는 글자가 아니라 그 경고다.
   */
  const SRC = read('src/pages/user-profile/profile-edit/ProfileEditSheet.tsx')
  const ROW = read('src/pages/user-profile/profile-edit/EditRow.tsx')

  it('빈 값을 막는다', () => {
    expect(SRC).toContain('accountSettings.phoneRequired')
    expect(SRC).toMatch(/if \(!v\) \{ toast\.error\(t\('accountSettings\.phoneRequired'/)
  })

  it('형식까지 본다 — 빈칸만 막으면 "010" 한 글자로도 통과한다', () => {
    expect(SRC).toContain('accountSettings.phoneInvalid')
    expect(SRC).toMatch(/\^01\[016789\]/)
  })

  it('없으면 **빨갛게** 말한다 (종전 라벨의 빨간 `*` 자리)', () => {
    // 전화번호 줄이 required 로 표시돼 있고, EditRow 가 그때 빨간 글자를 쓴다 — 둘이 쌍이다.
    const i = SRC.indexOf('accountSettings.editPhone')
    expect(i, '전화번호 줄을 못 찾았다').toBeGreaterThan(-1)
    expect(SRC.slice(i, i + 300)).toMatch(/\brequired\b/)
    expect(ROW, 'required 인데 색이 회색이면 아무 경고도 아니다').toMatch(/required \?[^:]*text-red-500/)
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
    // 🔁 2026-10-18 재조준: 폰의 현황 바가 '내가 산 것'(`ShoppingGroup`) **안**으로 들어갔다 — 그 구역보다
    //   위면 현황 바보다도 위다. 불변식(계산대가 손님 블록보다 위)은 그대로다.
    const shopping = SRC.indexOf('<ShoppingGroup')
    expect(scan).toBeGreaterThan(-1)
    expect(SRC, '현황 바가 페이지에 따로 서면 두 번 그려진다(ShoppingGroup 안에 있다)').not.toContain('<OrderStatusBar />')
    expect(scan, '현황 바·쇼핑 그룹보다 아래면 여전히 스크롤해야 한다').toBeLessThan(shopping)
  })

  /**
   * 🔁 2026-09-30 재조준 — 앵커(`<EarningsGroup>`)가 사라졌다(대표 *"수익 추천은 지금은 아예
   * 마이에서 안보여도 될 것 같아"*). **지키려던 것은 그대로다**: 계산대가 *접혀서 안 보이는 자리*에
   * 있으면 안 된다. 이제 마이에 접이식 자체가 없다(설정도 09-30 에 펼쳐졌다) — 그걸 직접 잰다.
   */
  it('접혀서 안 보이는 자리에 있지 않다 — 마이에 접이식이 없다', () => {
    const scan = SRC.indexOf("navigate('/store/scan')")
    expect(scan).toBeGreaterThan(-1)
    expect(SRC, '수익 구역이 되살아났다면 계산대가 그 안으로 들어갔는지 다시 볼 것').not.toContain('<EarningsGroup>')
    for (const f of ['SettingsGroup', 'RoleCtaGrid']) {
      const src = read(`src/pages/user-profile/${f}.tsx`)
      expect(src, `${f} 이 다시 접힌다 — 그 안의 것은 한 번 더 눌러야 보인다`).not.toContain('<FoldRow')
    }
  })

  it('셀러 계정에서만 뜬다', () => {
    const i = SRC.indexOf("navigate('/store/scan')")
    expect(SRC.slice(Math.max(0, i - 400), i)).toContain("localStorage.getItem('seller_token')")
  })
})
