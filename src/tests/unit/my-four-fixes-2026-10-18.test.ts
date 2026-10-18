/**
 * 🧹 2026-10-18 — 대표 *"이제 가장 이상적이야?"* → 렌더로 찾은 넷 → *"다 해줘"*.
 *
 * ① **'구매완료' → '전체 구매'.** 이 칸은 *지금까지 산 전체*(5 = 남은 3 + 쓴 1 + 만료·환불 1)인데 옆 두 칸과
 *    나란히 서서 "산 뒤 아직 안 쓴 것" 처럼 읽혔고, 맨 위 `이용권 3` 과 어긋나 보였다.
 * ② **'이용권 현황' 이 어느 구역에도 속하지 않았다.** 사장님 화면에선 '내 가게' 판과 '내가 산 것' 제목 사이에
 *    떠 있었다. ⇒ 폰은 '내가 산 것' 제목 아래로. PC 는 '곧 쓸 이용권' 카드가 이미 갖고 있어 또 그리지 않는다.
 * ③ **줄 숫자가 두 규칙으로 섞여 있었다** — '내 교환권 0'·'찜한 상품 0' 은 0 을 적고, 숫자 없는 줄은 비었다.
 *    ⇒ 1 이상일 때만 단다.
 * ④ **맨 아래가 두 정렬이었다** — 고객센터 링크는 왼쪽, 버전·탈퇴는 가운데. ⇒ 전부 왼쪽.
 *
 * ⚠️ 이 파일이 못 보는 것: 실제 픽셀 위치(jsdom 에 레이아웃이 없다 — `visual-preview` 로 그려서 본다) ·
 *   다른 언어 번역의 자연스러움.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readCode } from '../helpers/source-text'

const PAGE = readCode('src/pages/UserProfilePage.tsx')
const SHOP = readCode('src/pages/user-profile/ShoppingGroup.tsx')
const BAR = readCode('src/pages/user-profile/OrderStatusBar.tsx')
const PANE = readCode('src/pages/user-profile/AccountPcPane.tsx')
const CTRL = readCode('src/pages/user-profile/AccountControlsSection.tsx')

function fnBody(src: string, name: string): string {
  const s = src.indexOf(`export function ${name}`)
  expect(s, `${name} 를 못 찾았다 — 앵커가 낡았다`).toBeGreaterThan(-1)
  const e = src.indexOf('\nexport function ', s + 10)
  return src.slice(s, e === -1 ? undefined : e)
}

describe('① 총계는 총계라고 말한다', () => {
  it("이름이 '전체 구매' 다", () => {
    expect(BAR).toContain("defaultValue: '전체 구매' }), key: 'bought'")
    expect(BAR, "'구매완료' 로 돌아가면 위 '이용권 N' 과 어긋나 보인다").not.toContain("defaultValue: '구매완료' }), key: 'bought'")
  })

  it('6개 언어가 같은 뜻으로 옮겨졌다', () => {
    const want: Record<string, string> = { ko: '전체 구매', en: 'Total bought', ja: '購入合計', zh: '累计购买', es: 'Total comprados', fr: 'Total achetés' }
    for (const [lang, v] of Object.entries(want)) {
      const j = JSON.parse(readFileSync(`public/locales/${lang}/translation.json`, 'utf-8'))
      expect(j.voucherStatus?.bought, `${lang} 번역이 옛 값이다 — 코드 기본값만 고치면 번역이 이긴다`).toBe(v)
    }
  })
})

describe('② 이용권 현황은 \'내가 산 것\' 안에 있다', () => {
  it('폰: 제목 바로 아래에서 그린다', () => {
    const title = SHOP.indexOf("defaultValue: '내가 산 것'")
    const bar = SHOP.indexOf('<OrderStatusBar />')
    const rows = SHOP.indexOf('<ListRow')
    expect(bar, '구역 안에 현황 바가 없다').toBeGreaterThan(title)
    expect(bar, '현황 바가 목록 줄 아래로 갔다').toBeLessThan(rows)
    expect(SHOP, '폰에서만 그리는 게이트가 사라졌다').toMatch(/\{statusBar && <div[^>]*><OrderStatusBar \/><\/div>\}/)
  })

  it('페이지에 따로 서지 않는다 — 구역 사이에 떠 있던 자리', () => {
    expect(PAGE).not.toContain('<OrderStatusBar />')
    expect(PAGE).not.toMatch(/^import OrderStatusBar\b/m)
  })

  it('PC 에선 두 번 서지 않는다 — 카드가 이미 갖고 있다', () => {
    expect(PAGE, '폰에서만 켜야 한다(PC 는 곧 쓸 이용권 카드 안에 있다)').toContain('<ShoppingGroup counts={counts} statusBar={!isPc} />')
    expect(PANE).toContain('<OrderStatusBar />')
  })
})

describe('③ 줄 숫자는 1 이상일 때만', () => {
  it("'내 교환권'·'찜한 상품' 은 0 을 적지 않는다", () => {
    expect(SHOP).toContain("count: counts.gifticon || undefined, path: '/my-gifticons'")
    expect(SHOP).toContain("count: counts.wish || undefined, path: '/wishlist'")
  })

  it('반대 방향: 1 이상이면 그대로 단다 — 그 숫자의 유일한 자리다', () => {
    const show = (n: number | null) => n || undefined
    expect(show(0)).toBeUndefined()
    expect(show(null)).toBeUndefined()
    expect(show(4)).toBe(4)
  })
})

describe('④ 맨 아래는 한 정렬', () => {
  it('버전 줄은 가운데가 아니고, 자기 가로 여백도 없다', () => {
    const body = fnBody(CTRL, 'AppVersionSection')
    expect(body).not.toContain('text-center')
    expect(body, '묶음이 이미 px-4 를 준다 — 또 주면 16px 들여쓰인다').not.toMatch(/className="[^"]*\bpx-4\b/)
  })

  it('탈퇴 링크도 가운데가 아니다', () => {
    const body = fnBody(CTRL, 'DeleteAccountLink')
    expect(body).not.toContain('text-center')
    expect(body, '전폭 블록이면 왼쪽 선 밖으로 눌리는 면이 커진다').not.toContain('w-full')
  })

  it('링크 줄은 왼쪽 그대로다(이걸 가운데로 옮기면 버전·탈퇴도 같이 옮길 것)', () => {
    const at = PAGE.indexOf("userProfile.kakaoConsult'")
    expect(at).toBeGreaterThan(-1)
    expect(PAGE.slice(at - 500, at)).not.toContain('justify-center')
  })
})
