import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'
import { isFullBleedPcPath } from '@/shared/pc-fullbleed'

/**
 * INK 스케일(= tailwind `text-gray-*`)의 실제 hex 를 **뽑아** 쓴다.
 * 손으로 박으면 팔레트가 옮겨질 때마다(2026-09-30 이 그랬다) 시험도 같이 고쳐야 하고,
 * 그러면 시험이 "대비가 충분한가" 대신 "옛 값인가" 를 묻게 된다.
 */
function ink(step: number): string {
  const tw = codeOnly(readFileSync('tailwind.config.js', 'utf-8'))
  const m = tw.match(new RegExp(`\\b${step}:\\s*'(#[0-9A-Fa-f]{6})'`))
  expect(m, `INK.${step} 를 tailwind.config.js 에서 못 찾았다 — 스케일 모양이 바뀌었다`).not.toBeNull()
  return (m as RegExpMatchArray)[1]
}

/**
 * 🎫 2026-09-02 (대표 확정) 유어샵 **안3**(모바일 — 왼정렬 헤더 + 반반 버튼 + 카테고리 칩) +
 * **안P1**(PC — 좌 300px 프로필 고정 + 우 3열 진열대) 계약.
 *
 * 대표 지적 둘이 이 테스트의 뼈대다:
 *   ① "편집하기 UI 가 번잡하다" → 주인 상단 안내 띠 삭제, 편집 진입은 헤더 블루 버튼 하나.
 *   ② "그냥 방문자는 안보이면 되잖아" → 방문자는 편집 버튼이 **없을 뿐**, 팔로우 같은 대체 버튼 금지.
 *
 * ⚠️ 이 테스트가 못 막는 것: 렌더된 픽셀(칩이 실제로 지도 칩과 같은 그림인지)은 `visual-preview` 로 눈으로 본다.
 */
const read = (f: string) => readFileSync(f, 'utf-8')
const PAGE = 'src/pages/CuratorPage.tsx'
const HEADER = 'src/pages/curator-page/CuratorHeader.tsx'
const SELLER = 'src/pages/SellerPublicPage.tsx'
const CHIPS = 'src/pages/curator-page/PinCategoryChips.tsx'
const ROW = 'src/pages/curator-page/PinRow.tsx'
const LAYOUT = 'src/components/MobileAppLayout.tsx'
const CSS = 'src/index.css'

describe('유어샵 안3 — 주인 띠 삭제 · 버튼 한 자리', () => {
  it('CuratorPage 에 주인 상단 안내 띠("ownerViewBar")가 없다', () => {
    expect(codeOnly(read(PAGE))).not.toContain('curator.ownerViewBar')
  })
  // 🔧 2026-09-28 재조준(e3): 종전엔 "주인도 **방문자 화면으로 시작**한다"를 `useState(true)` + `ownerView`
  //   조합으로 고정했다. e3 는 그 토글 자체를 없앴다 — 주인 화면이라는 것이 **존재하지 않는다**.
  //   ⇒ 같은 의도를 더 강하게: 두 페이지 어디에도 편집 모드 상태가 없어야 한다.
  it('두 유어샵 모두 "주인 화면"이라는 상태가 없다(손님 화면 하나뿐)', () => {
    for (const f of [PAGE, SELLER]) {
      const src = codeOnly(read(f))
      expect(src, f).not.toContain('ownerModeNotice')
      expect(src, f).not.toContain('previewBanner')
      expect(src, f).not.toMatch(/\bownerView\b/)
      expect(src, f).not.toMatch(/\bpreviewAsVisitor\b/)
    }
  })
  // 🔧 2026-09-28 재조준(대표 확정 **c2 + e3**): 편집 진입이 [유어샵 편집] 블루 버튼 → `[관리]`
  //   + `/u/me/manage` 이동으로 바뀌었다. 지키려던 것 —
  //   "주인/방문자 차이는 버튼 **한 자리**". 그 한 자리가 `관리` 다.
  //
  // 🔀 2026-10-07 재조준 (대표 *"여기 관리, 공유 버튼이 촌스럽네.."* → 시안 셋 중 **안 C 확정**).
  //   ⚠️ **이 줄은 09-28 의 한 조항을 뒤집는다**: 그때는 *"헤더에 블루 면을 두지 않는다"* 였고
  //   `관리` 가 테두리 친 알약이었다. 그런데 390px 렌더로 보니 그 처방이 만든 결과가
  //   **한 줄에 모양 2종 · 높이 2종**(36px 민 원 ↔ 31px 테두리 알약)이었고, 더 나쁘게는
  //   c2 가 *"그 한 자리"* 라고 못 박은 `관리` 가 **누구나 보는 `공유` 와 같은 무게**로 서 있었다.
  //   대표가 세 시안(A 한 덩어리 / B 아이콘만 / C 위계)을 보고 **C** 를 골랐다 —
  //   채운 면을 `관리` 하나에만 준다. 🎫 규칙 ②(강조색 하나, 자리 셋)는 그대로이고,
  //   **헤더의 유일한 색 면이 주인 전용 자리**라는 점에서 c2 의 의도는 오히려 또렷해진다.
  //   ⇒ 불변식을 "블루 면 0" → **"채운 면은 정확히 하나이고 그것이 `관리`"** 로 옮긴다.
  it('헤더의 주인 전용 자리는 [관리] 하나뿐이고, 채운 면은 그 하나뿐이다', () => {
    const src = codeOnly(read(HEADER))
    expect(src.match(/\{canEdit && \(/g) || []).toHaveLength(1)
    expect(src).toMatch(/<Link to="\/u\/me\/manage"/)
    // 채운 면은 `관리` 버튼 상수 한 곳에서만 나온다 — 다른 자리에 색 면이 생기면 빨간불.
    expect((src.match(/bg-brand/g) || []), '헤더의 브랜드 면').toHaveLength(1)
    expect(src, '그 한 곳은 관리 버튼 상수').toMatch(/const manageBtnCls = '[^']*bg-brand text-white/)
    expect(src, '관리 버튼이 그 상수를 쓴다').toMatch(/<Link to="\/u\/me\/manage" className=\{manageBtnCls\}/)
    // 공유는 방문자에게도 보인다 — 손님이 친구에게 넘기는 것이 유어샵의 확산 경로다.
    expect(src).toMatch(/onClick=\{onCopyLink\}/)
  })
  it('방문자에게 팔로우 버튼을 주지 않는다(대표: "그냥 방문자는 안보이면 되잖아")', () => {
    expect(codeOnly(read(HEADER))).not.toMatch(/팔로우|follow/i)
  })
  it('두 페이지 모두 헤더에 canEdit 을 넘긴다(소유권 신호는 그대로 prop)', () => {
    for (const f of [PAGE, SELLER]) {
      const src = read(f)
      expect(src, f).toMatch(/<CuratorHeader[\s\S]*?canEdit=\{isOwner\}/)
    }
    // 🔴 헤더가 스스로 소유권을 판정하면 안 된다(check-linkshop-ownership ③ 과 같은 불변식).
    expect(codeOnly(read(HEADER))).not.toContain('seller_token')
  })
  // 🔧 2026-09-28 재조준(9차 대표 확정 — "정 이라고 적혀있는 프로필 이미지 부분 없애는게 좋을 것 같아"):
  //   배너 히어로 금지는 그대로. **아바타 요구는 뒤집혔다** — 라이브 대부분이 프로필 사진이 없어
  //   그 자리는 사실상 항상 이니셜 원이었다(사람이 *없다*는 걸 보여주는 자리). ⇒ 금지로 전환.
  it('헤더는 배너 히어로도 아바타도 그리지 않는다', () => {
    const src = codeOnly(read(HEADER))
    expect(src).not.toMatch(/aspect-\[16\/9\]/)
    expect(src).not.toContain('uploadBanner')
    expect(src).not.toMatch(/w-14 h-14 rounded-full/)
    expect(src).not.toContain('profile_image.startsWith')
  })
})

describe('유어샵 안3 — 카테고리 분류 줄', () => {
  /*
   * 🩸 2026-09-30 재조준 (대표 한 톤 확정 — *"아예 모두 똑같이 배경색을 카드 색상이랑 같게 한다면???"*
   *   → 시안 확인 후 *"일단 이 형태가 낫고"*). 종전 단언은 **알약의 껍질**을 박고 있었다
   *   (`on ? 'bg-brand text-white' : 'bg-white … shadow-lift'`). 알약은 *자기 배경*으로 존재를
   *   주장하는 부품이라, 페이지·카드·칩이 한 톤이 되면 흰 알약이 흰 바탕 위에 그림자로만 뜬다.
   *   ⇒ 밑줄 탭으로 바뀌었고, 지켜야 할 것은 껍질이 아니라 셋이다:
   *     ① 분류 정의는 지도와 **같은 SSOT** (유어샵만 다른 이름·순서를 갖지 않는다)
   *     ② 활성 표시는 **브랜드 하나** (2026-09-02 표면 규칙 ② "강조색 하나")
   *     ③ **개수를 적는다** — 대표가 *"각 이용권마다 숫자도 달아줘"* 로 직접 요청한 항목이다.
   *   ⚠️ 느슨해진 게 아니라 판정 대상이 바뀐 것이다. 알약 껍질의 부활은 아래에서 따로 막는다.
   */
  it('분류 정의는 지도 칩과 같은 SSOT 를 쓴다', () => {
    expect(read(CHIPS)).toContain("from '@/pages/restaurant-map/voucher-types'")
  })

  it('활성 표시는 브랜드 하나 — 밑줄, 그리고 개수가 붙는다', () => {
    const src = codeOnly(read(CHIPS))
    expect(src, '활성은 브랜드 밑줄').toMatch(/border-b-2[\s\S]{0,120}border-brand/)
    expect(src, '비활성은 선을 숨긴다(자리는 남긴다 — 글자가 안 밀리게)').toContain('border-transparent')
    expect(src, '개수(대표 요청)를 그린다').toMatch(/\{n\}/)
  })

  /**
   * 🩸 2026-09-30 신설 — **CI 의 `contrast` 가 내 코드를 잡은 뒤** 만든 가드.
   *   개수를 `text-gray-300 dark:text-gray-600` 으로 썼더니 다크 카드(#1D1F29) 위 **2.15:1**,
   *   그리고 아무도 안 보고 있던 라이트는 더 나빴다(흰 바탕 위 **1.50:1**).
   *   개수는 대표가 직접 요청한 **정보**라 장식으로 칠하면 안 된다.
   *
   *   🔑 문자열이 아니라 **비율을 계산해서** 고정한다 — 팔레트가 또 옮겨져도(2026-09-30 이 그랬다)
   *      이 시험은 따라온다. 반대로 hex 를 박아 두면 팔레트를 고칠 때마다 시험도 고쳐야 하고,
   *      그러면 시험이 "짝이 맞는가" 대신 "옛 값인가" 를 묻게 된다(같은 날 배운 것).
   *   ⚠️ 못 보는 것: 실제 렌더(조상 배경이 정말 카드인지)는 `check-dark-contrast` 워크플로가 본다.
   */
  it('비활성 탭의 개수가 읽힌다 — 라이트·다크 둘 다 3:1 이상', () => {
    const src = codeOnly(read(CHIPS))
    const m = src.match(/text-\[12px\] tabular-nums \$\{on \? '[^']+' : '([^']+)'\}/)
    expect(m, '비활성 개수의 색 클래스를 못 찾았다 — 마크업이 바뀌었으면 이 시험도 재조준할 것').not.toBeNull()
    const cls = (m as RegExpMatchArray)[1]
    const light = cls.match(/(?:^|\s)text-gray-(\d+)/)
    const dark = cls.match(/dark:text-gray-(\d+)/)
    expect(light, '라이트 회색 단계가 없다').not.toBeNull()
    expect(dark, '다크 회색 단계가 없다').not.toBeNull()

    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)]
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
    }
    const onWhite = ratio(ink(Number(light![1])), '#FFFFFF')
    const onCard = ratio(ink(Number(dark![1])), '#1D1F29')   // --surface 다크
    expect(onWhite, `라이트에서 개수가 ${onWhite.toFixed(2)}:1 — 안 읽힌다`).toBeGreaterThanOrEqual(3)
    expect(onCard, `다크에서 개수가 ${onCard.toFixed(2)}:1 — 안 읽힌다`).toBeGreaterThanOrEqual(3)
  })

  it('🔴 알약 껍질이 돌아오지 않았다 — 한 톤에서 판·그림자는 아무것도 안 나눈다', () => {
    const src = codeOnly(read(CHIPS))
    expect(src, '흰 알약 + 들림 복귀').not.toContain('shadow-lift')
    expect(src, '알약 모서리 복귀').not.toContain('rounded-full')
  })
  // 🔧 2026-09-28 재조준(대표 확정 s3): 종전엔 `CHIPS_MIN_PINS = 7` 미만이면 안 그렸다.
  //   그 게이트는 **한 번도 열린 적이 없다** — 라이브 유어샵은 3곳·최다 5개다. 칩이 존재하지 않는
  //   기능이었으므로 게이트를 없앴고, 시험도 새 계약("비었을 때만 안 그린다")으로 옮긴다.
  //   ⚠️ 느슨해진 게 아니라 **판정 대상이 바뀐 것**이다 — 죽은 상수를 살려 두는 단언은 지웠다.
  it('칩은 핀이 하나라도 있으면 그리고, 0 이면 안 그린다', () => {
    const src = codeOnly(read(CHIPS))
    expect(src, '죽은 최소개수 상수가 되살아나지 않았다').not.toContain('CHIPS_MIN_PINS')
    expect(src).toMatch(/if \(pins\.length === 0\) return null/)
  })
  it('CuratorPage 가 칩을 조건 없이 배선한다(게이트는 부품이 한 곳에서만 판정)', () => {
    const src = codeOnly(read(PAGE))
    expect(src).toMatch(/<PinCategoryChips pins=\{pins\} value=\{cat\} onChange=\{setCat\} \/>/)
    // 호출부가 개수를 또 판정하면 두 게이트가 언젠가 갈린다.
    expect(src).not.toMatch(/pins\.length[^\n]*&&\s*<PinCategoryChips/)
    // 칩 선택이 실제로 목록을 거른다(배선만 있고 안 걸러지는 것을 막는다).
    expect(src).toMatch(/cat === 'all' \? homePins : homePins\.filter\(p => pinCategory\(p\) === cat\)/)
  })
  /*
   * 🔧 재조준 두 번째. ① 2026-09-28(s3): 배지가 `CuratorPage` 인라인 카드 → `PinRow` 로 **이사**.
   *   ② 2026-09-29(대표 *"세련된 느낌이 없다"*): 순번이 **사진 밖**(`DealRow` 의 `leading` 슬롯)으로
   *   나갔다. 그래서 "흰 원 + 잉크 숫자" 계약은 **녹았다** — 흰 원은 *어떤 사진 위에서도 읽히게*
   *   하려던 장치였고, 사진 위가 아니면 존재 이유가 없다(2026-08-31 대표 *"할인율이 사진 안으로
   *   들어가면 안돼"* 와 같은 판단).
   *   ⇒ 계약을 풀지 않고 **남은 것으로** 옮긴다: 순번은 지울 수 없고(SNS 에서 "N번 사세요" 로
   *     부르는 주소다) 숫자 폭이 고정이어야 한다(`1`·`10` 이 나란히 서면 칸이 흔들린다).
   *   자리·크기 계약은 `ushop-console-refresh-2026-09-29.test.ts` ② 가 본다 — 여기서 또 보지 않는다.
   */
  it('순번은 남아 있고 숫자 폭이 고정이다 (사진 위 흰 원이 아니다)', () => {
    const src = codeOnly(read(ROW))
    expect(src, '순번 렌더').toContain('{order}')
    expect(src, '숫자 폭 고정').toMatch(/tabular-nums/)
    expect(src, '사진 위 흰 원 배지 0개').not.toMatch(/rounded-full bg-white/)
  })
})

describe('유어샵 안P1 — PC 2단', () => {
  it('유어샵 한 세그먼트만 액자를 벗는다(도구 화면 /u/me/* 는 액자 유지)', () => {
    expect(isFullBleedPcPath('/u/jiwon1228')).toBe(true)
    expect(isFullBleedPcPath('/profile/tori')).toBe(true)
    expect(isFullBleedPcPath('/s/tori')).toBe(true)
    expect(isFullBleedPcPath('/u/me/add')).toBe(false)
    expect(isFullBleedPcPath('/u/me/earnings')).toBe(false)
    expect(isFullBleedPcPath('/u/jiwon1228/p/101')).toBe(false)
    expect(isFullBleedPcPath('/user/profile')).toBe(true) // 종전 등재 경로는 그대로
  })
  it('거터 레일(LinkshopVisitorRails)은 삭제됐고 레이아웃이 더는 렌더하지 않는다', () => {
    expect(existsSync('src/components/LinkshopVisitorRails.tsx')).toBe(false)
    expect(codeOnly(read(LAYOUT))).not.toContain('LinkshopVisitorRails')
  })
  it('두 페이지가 같은 2단 틀(.ur-ushop-pc / side / main)을 쓰고 QR 은 프로필 열에 있다', () => {
    for (const f of [PAGE, SELLER]) {
      const src = codeOnly(read(f))
      expect(src, f).toMatch(/className="ur-ushop-pc"[\s\S]*?className="ur-ushop-side"[\s\S]*?<CuratorHeader[\s\S]*?<UShopQrCard \/>[\s\S]*?className="ur-ushop-main"/)
    }
  })
  it('index.css — 좌 300px 고정 + 우 칸(카드 3열 · 줄 목록 2열), lg+ 에서만', () => {
    const css = read(CSS)
    const i = css.indexOf('.ur-ushop-pc {')
    expect(i).toBeGreaterThan(-1)
    const block = css.slice(css.lastIndexOf('@media (min-width: 1024px)', i), i + 2200)
    expect(block).toContain('grid-template-columns: 300px minmax(0, 1fr)')
    expect(block).toMatch(/\.ur-ushop-side \{ position: sticky/)
    expect(block).toMatch(/\.ur-ushop-main \.grid-cols-2 \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
    /**
     * 🛍️ 2026-09-30 (대표 확정 **안 A**) — 줄 목록(s3)은 **2열**.
     * 위 3열은 *카드* 격자(`grid-cols-2`)용이고 줄에는 안 맞는다: 우 칸이 796px 라 그대로 늘리면
     * 64px 썸네일 하나에 **오른쪽 절반이 빈 칸**이 된다(2026-09-28 실측 `out/visual/ushop-pc.png`).
     * 2열이면 줄당 ~378px = 폰 폭과 거의 같아 줄 형식을 한 글자도 안 바꾸고 놓인다.
     */
    expect(block, '줄 목록 2열 규칙이 없다 — 우 칸 796px 에 줄이 통째로 늘어난다').toMatch(
      /\.ur-ushop-main \.ur-ushop-rows \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
    )
  })
  it('🛍️ 줄 목록이 그 2열 규칙을 실제로 받는다 (그리드 + 전용 클래스)', () => {
    const src = codeOnly(read(PAGE))
    const m = src.match(/className="[^"]*\bur-ushop-rows\b[^"]*"/)
    expect(m, 'CuratorPage 의 핀 목록에 `ur-ushop-rows` 가 없다 — CSS 규칙이 아무것도 안 잡는다').toBeTruthy()
    // 컨테이너가 그리드가 아니면 `grid-template-columns` 는 무시된다(1열 그대로).
    expect(m![0], '`grid` 가 없으면 열 규칙이 적용되지 않는다').toMatch(/\bgrid\b/)
    // `space-y-*` 와 그리드를 같이 쓰면 열마다 2번째 줄부터 위 여백이 겹친다.
    expect(m![0], 'space-y-* 와 grid 를 같이 쓰면 열 안 간격이 두 배가 된다').not.toMatch(/space-y-/)
    // 그 컨테이너가 `<PinRow`(줄 목록) 를 감싸는 자리인가 — 다른 그리드에 클래스를 붙여도 통과하면 헛돈다.
    const at = src.indexOf(m![0])
    expect(src.slice(at, at + 400), '`ur-ushop-rows` 가 감싸는 것이 PinRow 가 아니다').toContain('<PinRow')
    /**
     * ⚠️ tailwind `lg:grid-cols-2` 로 하면 **액자가 남는 표면에서 되돌아간다** —
     * `index.css` 의 `.app-framed .lg\:grid-cols-2` 가 1열로 덮는다(`/profile`·`/s`).
     */
    expect(m![0], 'lg:grid-cols-2 는 액자 1열 오버라이드에 먹힌다 — 전용 클래스를 쓸 것').not.toMatch(/lg:grid-cols-/)
  })
})
