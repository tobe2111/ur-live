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
    const rail = read('src/components/home/HomeBannerStrip.tsx')
    const body = rail.slice(rail.indexOf('function StripRail('))
    expect(body).toMatch(/cfImage\(/)
    expect(body).toMatch(/cfImageOnError\(/)
  })
})

/**
 * 🎠 2026-10-12 대표 확정 — 상단 배너 = **2:1 3D 카드 캐러셀, 저절로 넘어간다**
 *    (*"2:1(362×181) 배너 크기야"* · *"자동으로 넘어가게 해줘"*). 2026-09-05 "안 3"(96px · 자동 재생 금지)을 대체한다.
 *
 * 🔁 재조준: 옛 "저절로 넘어가지 않는다" 단언은 대표 결정으로 뒤집혔다. 그 단언이 지키려던 것
 *    — *읽던 사람이 방해받지 않는다* — 은 그대로 살아 있고, 이제 **자동 넘김의 안전장치 넷**이 그 일을 한다.
 */
describe('① 상단 배너 = 2:1 카드 캐러셀 (2026-10-12)', () => {
  const SRC = read('src/components/home/HomeBannerStrip.tsx')
  const RAIL = SRC.slice(SRC.indexOf('function StripRail('))

  it('네이티브 가로 스크롤 + scroll-snap 으로 넘긴다 (JS 캐러셀 라이브러리 0)', () => {
    expect(RAIL).toMatch(/overflow-x-auto/)
    expect(RAIL).toMatch(/snap-x snap-mandatory/)
    expect(RAIL).toMatch(/snap-start/)
    // 스크롤바 숨김 표기는 `scrollbar-hide` 하나로 고정(`index.css` 정의가 한 벌).
    expect(RAIL).toMatch(/scrollbar-hide/)
    expect(RAIL).not.toMatch(/no-scrollbar|noscroll/)
  })

  it('카드는 2:1 이다 (대표 확정 362 × 181)', () => {
    expect(RAIL).toMatch(/aspect-\[2\/1\]/)
  })

  it('PC 는 한 장이 가로 전체를 먹지 않는다 — 2:1 세 장 나란히', () => {
    expect(RAIL).toMatch(/lg:basis-\[calc\(\(100%-16px\)\/3\)\]/)
  })

  describe('저절로 넘어가되, 읽는 사람을 방해하지 않는다', () => {
    it('타이머로 스크롤을 민다 — 손가락과 같은 길(scrollTo)', () => {
      expect(RAIL).toMatch(/setTimeout\(/)
      expect(RAIL).toMatch(/\.scrollTo\(/)
    })
    it('① 멈춤 버튼이 있고, 멈추면 안 넘어간다', () => {
      expect(RAIL).toMatch(/aria-label=\{paused \?/)
      expect(RAIL).toMatch(/if \(!many \|\| paused \|\| reduceMotion \|\| !onScreen\) return/)
    })
    it('② 손가락이 닿으면 멈추고 한참 뒤 재개한다', () => {
      expect(RAIL).toMatch(/onPointerDown=\{many \? hold : undefined\}/)
      expect(RAIL).toMatch(/heldUntil - Date\.now\(\)/)
    })
    it('③ 화면 밖·숨긴 탭에서는 안 넘긴다', () => {
      expect(RAIL).toMatch(/IntersectionObserver/)
      expect(RAIL).toMatch(/document\.visibilityState !== 'visible'/)
    })
    it('④ 기기의 동작 줄이기 설정이면 안 넘긴다', () => {
      expect(SRC).toMatch(/prefers-reduced-motion: reduce/)
    })
    it('끝까지 가면 처음으로 돌아간다', () => {
      expect(RAIL).toMatch(/atEnd \? 0 :/)
    })
  })

  it('한 장이면 꽉 채우고 조작부(멈춤·n/N)를 안 그린다', () => {
    expect(RAIL).toMatch(/const many = banners\.length > 1/)
    expect(RAIL).toMatch(/\{many && \(/)
    // 카드가 `StripCard` 로 분리됐다 — 레일이 `many` 를 넘기고 카드가 그 값으로 스냅을 정한다.
    expect(RAIL).toMatch(/snap=\{many\}/)
    expect(RAIL).toMatch(/\$\{snap \? 'snap-start shrink-0' : ''\}/)
  })

  it('현재 장은 스크롤 위치에서 파생한다 — 따로 든 상태는 손가락과 어긋난다', () => {
    expect(RAIL).toMatch(/onScroll/)
    expect(RAIL).toMatch(/scrollLeft/)
  })

  it('한 칸 계산이 쓰는 간격 상수가 실제 gap 과 같다', () => {
    const gap = SRC.match(/const STRIP_GAP_PX = (\d+)/)
    expect(gap, 'STRIP_GAP_PX 상수를 못 찾았다').toBeTruthy()
    const cls = RAIL.match(/className=\{`flex gap-(\d+) /)
    expect(cls, '레일 컨테이너의 gap 클래스를 못 찾았다').toBeTruthy()
    expect(Number(gap![1])).toBe(Number(cls![1]) * 4)
  })

  it('글자는 그림이 아니라 코드다 — 정본 스케일 24 / 13', () => {
    expect(RAIL).toMatch(/text-\[24px\] font-bold/)
    expect(RAIL).toMatch(/text-\[13px\] font-medium/)
  })

  it('그림 위에 그라디언트 덮개를 깔지 않는다 — 글자에만 옅은 그림자 (2026-10-12 대표 "그라데이션 촌스럽다")', () => {
    expect(RAIL).not.toMatch(/bg-gradient-to-/)
    expect(RAIL).toMatch(/\[text-shadow:/)
  })

  it('규격 안내가 2:1 · 자동 넘김을 말한다', () => {
    const s = BANNER_SLOT_SPECS.strip
    expect(s.recommendedWidth).toBe(s.recommendedHeight * 2)
    expect(s.renderedNote).toMatch(/2:1/)
    expect(s.renderedNote).toMatch(/넘어간다/)
    expect(s.notes.join(' ')).toMatch(/단색/)
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

/**
 * 🔁 **2026-09-08 규칙이 한 겹 넓어졌다** (대표 *"거리순이 가장 우선이야"*).
 *
 * 원래 여기 있던 계약은 `readCachedLoc() && !readHomeRegion().regionKey ? 'near' : 'popular'` 였다.
 * 즉 **지역을 한 번이라도 골라 둔 사람에게는 거리순을 안 씌운다**가 규칙이었고, 그 근거는
 * "지역 필터와 거리순이 겹치면 무엇으로 걸러진 목록인지 화면이 말할 수 없다" 였다.
 *
 * 🩸 그런데 실제로는 **헤더와 목록이 서로 다른 말**을 했다. 헤더는 `located` 를 우선해 "동탄5동"을
 *   띄우는데 목록만 저장된 지역으로 걸려 인기순으로 줄 섰고, 그 지역에 딜이 0건이면 전체 폴백까지
 *   걸려 **그 동네 이름 아래 서울 강남 딜**이 떴다(대표 실측 캡처).
 *
 * ⇒ 겹침 걱정은 **지역을 안 씌우는 것**으로 푼다: 좌표가 있으면 저장된 지역을 적용하지 않는다.
 *   그러면 두 기준이 겹칠 일 자체가 없고, 헤더가 이미 내리는 판단을 목록도 내리게 된다.
 *   ⚠️ 이 파일은 **기본 정렬 규칙의 주인**이다 — 같은 규칙을 `home-nearest-first.test.ts` 에
 *     또 적지 말 것(두 벌이면 갈라진다). 그 파일은 정렬 알약 라벨만 맡는다.
 */
describe('② 아래 딜 목록 기본 정렬 = 가까운 순', () => {
  it('두 홈 모두 캐시된 위치가 있으면 near 로 시작한다', () => {
    for (const p of ['src/pages/mobile-home/MobileHomePage.tsx', 'src/pages/pc-home/PcHomePage.tsx']) {
      const src = codeOnly(read(p))
      expect(src, `${p}: readCachedLoc 미사용`).toMatch(/readCachedLoc\(\)/)
      expect(src, `${p}: near 기본값 미배선`).toMatch(/readCachedLoc\(\)\s*\?\s*'near'\s*:\s*'popular'/)
    }
  })

  it('위치를 **새로 묻지 않는다** — 홈 진입에 권한 팝업을 띄우지 않는다', () => {
    for (const p of ['src/pages/mobile-home/MobileHomePage.tsx', 'src/pages/pc-home/PcHomePage.tsx']) {
      const src = codeOnly(read(p))
      expect(src, `${p}: 홈이 직접 측위를 시작한다`).not.toMatch(/getCurrentPosition|watchPosition/)
    }
  })

  // 🔁 2026-09-08: 여기 있던 "지역을 직접 고른 사람에겐 거리순을 씌우지 않는다"를 **뒤집은 규칙**으로
  //    교체한다(위 describe 주석 참조). 지우지 않고 반대 방향으로 고정해, 옛 규칙이 조용히 돌아오면 빨강.
  it('좌표가 있으면 저장된 지역을 안 씌운다 — 헤더와 목록이 같은 말을 하도록', () => {
    for (const p of ['src/pages/mobile-home/MobileHomePage.tsx', 'src/pages/pc-home/PcHomePage.tsx']) {
      const src = codeOnly(read(p))
      expect(src, `${p}: 지역 초기화가 좌표를 안 본다`)
        .toMatch(/useState<HomeRegion>\(\(\) => \(readCachedLoc\(\) \? \{\} : readHomeRegion\(\)\)\)/)
      expect(src, `${p}: 옛 규칙(지역이 거리순을 막음)이 돌아왔다`)
        .not.toMatch(/readCachedLoc\(\) && !readHomeRegion\(\)\.regionKey/)
    }
  })

  it("'더보기'는 인기순이 이긴다 — 쿼리가 기본값 위를 덮는다", () => {
    // PC: 쿼리 분기가 기본값 계산보다 먼저 return 한다.
    const pc = read('src/pages/pc-home/PcHomePage.tsx')
    const q = pc.indexOf("if (q && SORT_KEYS.includes(q)) return q")
    // ⚠️ 앵커는 **현재 코드의 표현**이어야 한다 — 2026-09-08 에 규칙이 바뀌며 옛 문자열이 사라졌고,
    //    indexOf 가 -1 을 내면서 이 비교가 통째로 무너졌다(CI 가 잡았다). 규칙이 또 바뀌면 여기도 함께.
    const fallback = pc.indexOf("readCachedLoc() ? 'near' : 'popular'")
    expect(fallback, '기본값 계산 앵커를 못 찾았다(표현이 바뀌었나?)').toBeGreaterThan(-1)
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
