import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'
import { isFullBleedPcPath } from '@/shared/pc-fullbleed'

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
  // 🔧 2026-09-28 재조준(대표 확정 **c2 + e3**): 편집 진입이 [유어샵 편집] 블루 버튼 → **[관리] 아웃라인
  //   알약 + `/u/me/manage` 이동**으로 바뀌었다. 지키려던 것은 그대로다 —
  //   "주인/방문자 차이는 버튼 **한 자리**". 그 한 자리가 이제 `관리` 다.
  //   그리고 c2 는 헤더에 **블루 면을 두지 않는다**(파랑은 할인율과 주 버튼 몫).
  it('헤더의 주인 전용 자리는 [관리] 하나뿐이고 헤더에 블루 면이 없다', () => {
    const src = codeOnly(read(HEADER))
    expect(src.match(/\{canEdit && \(/g) || []).toHaveLength(1)
    expect(src).toMatch(/<Link to="\/u\/me\/manage"/)
    expect(src).not.toContain('bg-brand')
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

describe('유어샵 안3 — 카테고리 칩(지도 B안과 같은 그림)', () => {
  it('칩은 지도 칩 SSOT(MAP_VOUCHER_DEFS)를 쓰고, 선택은 블루 면 · 비선택은 흰 알약', () => {
    const src = read(CHIPS)
    expect(src).toContain("from '@/pages/restaurant-map/voucher-types'")
    expect(src).toMatch(/on \? 'bg-brand text-white' : 'bg-white dark:bg-\[#1D1F29\][^']*shadow-lift'/)
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
