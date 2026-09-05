/**
 * 🎫 2026-09-05 대표 지시 3건 중 2건의 배선 고정.
 *
 *   ① "모바일 버전으로 봤을 때 지금 인기 이용권 섹션 위에 배너가 작게 있어야 할 것 같음" (시안 안 2)
 *   ② "주말에 떠나느 숙소 섹션 아래의 일반 이용권들은 기본 디폴트가 현재 위치에서 가까운 순대로.
 *      지금 인기 이용권 섹션에서 더보기 누르면 인기 순으로 보여주면 됨."
 *
 * ⚠️ **이 테스트가 못 막는 것**: 실제 렌더 결과(카드 높이·줄바꿈), 어드민에서 배너를 등록했을 때
 *    실제로 뜨는지(그건 라이브 확인), 그리고 브라우저 위치 권한 흐름. 여기서 고정하는 것은
 *    **배선과 규칙**뿐이다 — 이 레포가 반복해 잃어버린 것이 정확히 그 배선이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { HOME_SORT_KEYS } from '@/pages/main-home/useHomeQuerySync'
import {
  BANNER_SLOTS, BANNER_SLOT_LABELS, BANNER_SLOT_SPECS, isBannerSlot, parseBannerSlot,
} from '@/shared/constants/home-showcase'

const read = (p: string) => readFileSync(p, 'utf-8')
/** 주석은 판정에서 뺀다 — 설명 문장에 든 이름 때문에 초록이 뜨는 사고가 이 레포에서 실제로 났다. */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('① 상단 띠 배너 자리(strip)', () => {
  it('SSOT 배열·라벨·규격에 모두 등록돼 있다 (넷 중 하나만 빠져도 어드민에서 못 고른다)', () => {
    expect(BANNER_SLOTS).toContain('strip')
    expect(BANNER_SLOT_LABELS.strip).toBeTruthy()
    expect(BANNER_SLOT_SPECS.strip).toBeTruthy()
    expect(isBannerSlot('strip')).toBe(true)
    expect(parseBannerSlot('strip')).toBe('strip')
  })

  it('모르는 자리는 여전히 미지정(null) — 기본 자리로 승격시키지 않는다', () => {
    expect(parseBannerSlot('top')).toBeNull()
    expect(parseBannerSlot(null)).toBeNull()
    expect(parseBannerSlot('')).toBeNull()
  })

  it('두 홈 모두 첫 섹션 **위**에 그린다 (한쪽만 반영하면 두 홈이 갈린다)', () => {
    for (const p of ['src/pages/mobile-home/MobileHomePage.tsx', 'src/pages/pc-home/PcHomePage.tsx']) {
      const src = codeOnly(read(p))
      const strip = src.indexOf('<HomeBannerStrip variant="strip" />')
      const sections = src.indexOf('<HomeSections')
      expect(strip, `${p}: strip 배너 미배선`).toBeGreaterThan(-1)
      expect(sections, `${p}: HomeSections 없음`).toBeGreaterThan(-1)
      expect(strip, `${p}: strip 이 첫 섹션 아래에 있다`).toBeLessThan(sections)
    }
  })

  it('등록된 배너가 없으면 아무것도 안 그린다 (대표 확정 "안 올리면 아예 안 보이게")', () => {
    const src = read('src/components/home/HomeBannerStrip.tsx')
    // 자리 분기보다 **먼저** 빈 배열 early-return 이 와야 한다.
    const guard = src.indexOf('if (banners.length === 0) return null')
    const stripBranch = src.indexOf("if (variant === 'strip')")
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(stripBranch)
  })

  it('사진은 깨진 아이콘을 남기지 않는다 (cfImage + onError 폴백 쌍)', () => {
    const src = read('src/components/home/HomeBannerStrip.tsx')
    const branch = src.slice(src.indexOf("if (variant === 'strip')"), src.indexOf("if (variant === 'wide')"))
    expect(branch).toMatch(/cfImage\(/)
    expect(branch).toMatch(/cfImageOnError\(/)
  })
})

describe('🩸 규격 SSOT — inline/wide 가 뒤바뀌어 있던 것', () => {
  /**
   * 렌더가 이름을 엇갈려 참조해 **사진 크기는 맞았고**, 그래서 증상이 없었다.
   * 대신 어드민 안내 문구만 반대로 나가 "가로 전체 배너 = 800px 권장"이라는 거짓 안내가 됐다.
   */
  it('가로 전체(wide)가 3열(inline)보다 큰 원본을 요구한다', () => {
    expect(BANNER_SLOT_SPECS.wide.requestWidth).toBeGreaterThan(BANNER_SLOT_SPECS.inline.requestWidth)
    expect(BANNER_SLOT_SPECS.wide.recommendedWidth).toBeGreaterThan(BANNER_SLOT_SPECS.inline.recommendedWidth)
  })

  it('안내 문구가 자기 자리를 말한다', () => {
    expect(BANNER_SLOT_SPECS.wide.renderedNote).toContain('가로 전체')
    expect(BANNER_SLOT_SPECS.inline.renderedNote).toContain('3열')
  })

  it('렌더가 **같은 이름의** 규격을 참조한다 (엇갈린 참조 재발 차단)', () => {
    const src = read('src/components/home/HomeBannerStrip.tsx')
    const wide = src.slice(src.indexOf("if (variant === 'wide')"))
    const wideBody = wide.slice(0, wide.indexOf('return (\n    <div className="pb-6">\n      {/*'))
    expect(wideBody).toContain('BANNER_SLOT_SPECS.wide.requestWidth')
    expect(wideBody).not.toContain('BANNER_SLOT_SPECS.inline.requestWidth')
    // inline(3열) 분기는 파일 끝쪽 — wide 분기 뒤에 남은 부분이다.
    const rest = src.slice(src.lastIndexOf('banners.slice(0, 3)'))
    expect(rest).toContain('BANNER_SLOT_SPECS.inline.requestWidth')
    expect(rest).not.toContain('BANNER_SLOT_SPECS.wide.requestWidth')
  })
})

describe('② 아래 딜 목록 기본 정렬 = 가까운 순', () => {
  it('두 홈 모두 캐시된 위치가 있으면 near 로 시작한다', () => {
    for (const p of ['src/pages/mobile-home/MobileHomePage.tsx', 'src/pages/pc-home/PcHomePage.tsx']) {
      const src = codeOnly(read(p))
      expect(src, `${p}: readCachedLoc 미사용`).toMatch(/readCachedLoc\(\)/)
      expect(src, `${p}: near 기본값 미배선`).toMatch(/readCachedLoc\(\)\s*&&\s*!readHomeRegion\(\)\.regionKey\s*\?\s*'near'\s*:\s*'popular'/)
    }
  })

  it('위치를 **새로 묻지 않는다** — 홈 진입에 권한 팝업을 띄우지 않는다', () => {
    for (const p of ['src/pages/mobile-home/MobileHomePage.tsx', 'src/pages/pc-home/PcHomePage.tsx']) {
      const src = codeOnly(read(p))
      expect(src, `${p}: 홈이 직접 측위를 시작한다`).not.toMatch(/getCurrentPosition|watchPosition/)
    }
  })

  it('지역을 직접 고른 사람에겐 거리순을 씌우지 않는다', () => {
    for (const p of ['src/pages/mobile-home/MobileHomePage.tsx', 'src/pages/pc-home/PcHomePage.tsx']) {
      expect(codeOnly(read(p))).toMatch(/!readHomeRegion\(\)\.regionKey/)
    }
  })

  it("'더보기'는 인기순이 이긴다 — 쿼리가 기본값 위를 덮는다", () => {
    // PC: 쿼리 분기가 기본값 계산보다 먼저 return 한다.
    const pc = read('src/pages/pc-home/PcHomePage.tsx')
    const q = pc.indexOf("if (q && SORT_KEYS.includes(q)) return q")
    const fallback = pc.indexOf("readCachedLoc() && !readHomeRegion().regionKey ? 'near' : 'popular'")
    expect(q).toBeGreaterThan(-1)
    expect(q).toBeLessThan(fallback)
    // 모바일: useHomeQuerySync 가 그 일을 한다(두 홈 공용).
    expect(codeOnly(read('src/pages/mobile-home/MobileHomePage.tsx'))).toMatch(/useHomeQuerySync\(/)
    expect(read('src/pages/main-home/useHomeQuerySync.ts')).toMatch(/if \(qSort && .*includes\(qSort\)\) setSort\(qSort\)/)
  })

  it("'인기 이용권' 더보기가 가리키는 정렬 키가 실재한다", () => {
    // 라이브 `homepage_sections.more_href` = '/?sort=popular'
    expect(HOME_SORT_KEYS).toContain('popular')
    expect(HOME_SORT_KEYS).toContain('near')
  })
})
