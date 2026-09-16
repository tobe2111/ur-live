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
const LAYOUT = 'src/components/MobileAppLayout.tsx'
const CSS = 'src/index.css'

describe('유어샵 안3 — 주인 띠 삭제 · 버튼 한 자리', () => {
  it('CuratorPage 에 주인 상단 안내 띠("ownerViewBar")가 없다', () => {
    expect(codeOnly(read(PAGE))).not.toContain('curator.ownerViewBar')
  })
  it('SellerPublicPage 도 잉크 안내 띠·미리보기 띠가 없고 주인은 방문자 화면으로 시작한다', () => {
    const src = codeOnly(read(SELLER))
    expect(src).not.toContain('ownerModeNotice')
    expect(src).not.toContain('previewBanner')
    expect(src).toMatch(/useState\(true\)\s*\n\s*const ownerView = isOwner && !previewAsVisitor/)
  })
  it('헤더가 편집 진입을 canEdit && !isOwner 한 자리로만 낸다(블루 면 하나)', () => {
    const src = codeOnly(read(HEADER))
    expect(src).toMatch(/\{canEdit && !isOwner && \(/)
    expect(src).toMatch(/onClick=\{onEnterEdit\} className=\{editBtnCls\}/)
    expect(src).toContain("bg-brand text-white")
  })
  it('방문자에게 팔로우 버튼을 주지 않는다(대표: "그냥 방문자는 안보이면 되잖아")', () => {
    expect(codeOnly(read(HEADER))).not.toMatch(/팔로우|follow/i)
  })
  it('두 페이지 모두 헤더에 canEdit/onEnterEdit 을 넘긴다(소유권 신호는 그대로 prop)', () => {
    for (const f of [PAGE, SELLER]) {
      const src = read(f)
      expect(src, f).toMatch(/<CuratorHeader[\s\S]*?canEdit=\{isOwner\}[\s\S]*?onEnterEdit=\{/)
    }
  })
  it('헤더는 배너 히어로를 그리지 않는다(시안표 "사업자 배너: 없음") — 아바타 왼정렬', () => {
    const src = codeOnly(read(HEADER))
    expect(src).not.toMatch(/aspect-\[16\/9\]/)
    expect(src).not.toContain('uploadBanner')
    expect(src).toMatch(/w-14 h-14 rounded-full/)
  })
})

describe('유어샵 안3 — 카테고리 칩(지도 B안과 같은 그림)', () => {
  it('칩은 지도 칩 SSOT(MAP_VOUCHER_DEFS)를 쓰고, 선택은 블루 면 · 비선택은 흰 알약', () => {
    const src = read(CHIPS)
    expect(src).toContain("from '@/pages/restaurant-map/voucher-types'")
    expect(src).toMatch(/on \? 'bg-brand text-white' : 'bg-white dark:bg-\[#1D1F29\][^']*shadow-lift'/)
  })
  it('핀 7개 미만이면 칩을 그리지 않는다(시안: "6개 이하면 칩을 숨깁니다")', () => {
    const src = read(CHIPS)
    expect(src).toContain('export const CHIPS_MIN_PINS = 7')
    expect(codeOnly(src)).toMatch(/if \(pins\.length < CHIPS_MIN_PINS\) return null/)
  })
  it('CuratorPage 가 칩을 배선하고 필터가 검색과 함께 applyQ 에 들어간다', () => {
    const src = codeOnly(read(PAGE))
    expect(src).toMatch(/<PinCategoryChips pins=\{pins\} value=\{cat\} onChange=\{setCat\} \/>/)
    expect(src).toMatch(/cat === 'all' \? arr : arr\.filter\(p => pinCategory\(p\) === cat\)/)
  })
  it('순번 배지는 흰 원 + 잉크 숫자', () => {
    expect(codeOnly(read(PAGE))).toMatch(/rounded-full bg-white text-\[#16181C\][^"]*tabular-nums/)
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
  it('index.css — 좌 300px 고정 + 우 3열, lg+ 에서만', () => {
    const css = read(CSS)
    const i = css.indexOf('.ur-ushop-pc {')
    expect(i).toBeGreaterThan(-1)
    const block = css.slice(css.lastIndexOf('@media (min-width: 1024px)', i), i + 900)
    expect(block).toContain('grid-template-columns: 300px minmax(0, 1fr)')
    expect(block).toMatch(/\.ur-ushop-side \{ position: sticky/)
    expect(block).toMatch(/\.ur-ushop-main \.grid-cols-2 \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  })
})
