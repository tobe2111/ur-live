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
import { STRIP_CLS } from '@/shared/home-strip-banners'
import { HOME_SORT_KEYS } from '@/pages/main-home/useHomeQuerySync'
import {
  BANNER_SLOTS, BANNER_SLOT_LABELS, BANNER_SLOT_SPECS, isBannerSlot, parseBannerSlot,
} from '@/shared/constants/home-showcase'

/**
 * 🎫 2026-10-14 — 배너 클래스가 공용 상수(`STRIP_CLS`, 서버 첫 화면과 같은 값)로 옮겨갔다.
 *   불변식은 그대로이므로 **참조를 실제 값으로 되돌려 넣은 소스**를 검사한다(상수를 바꾸면 여기서 잡힌다).
 */
function resolveStripCls(src: string): string {
  const v = (k: string) => (STRIP_CLS as Record<string, string>)[k]
  return src
    .replace(/\$\{STRIP_CLS\.(\w+)\}/g, (_, k) => v(k))
    .replace(/\{STRIP_CLS\.(\w+)\}/g, (_, k) => `"${v(k)}"`)
    .replace(/STRIP_CLS\.(\w+)/g, (_, k) => `'${v(k)}'`)
}

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

  it('두 홈 모두 strip 배너를 맨 위 콘텐츠 앞에 그린다 (한쪽만 반영하면 두 홈이 갈린다)', () => {
    const m = codeOnly(read('src/pages/mobile-home/MobileHomePage.tsx'))
    const strip = m.indexOf('<HomeBannerStrip variant="strip" />')
    expect(strip, '모바일: strip 배너 미배선').toBeGreaterThan(-1)
    expect(strip, '모바일: strip 이 첫 섹션 아래에 있다').toBeLessThan(m.indexOf('<HomeSections'))
    // 🧩 2026-10-14 시안 4: PC 는 같은 strip 배너를 `PcHeroBanners`(큰 1 + 작은 2)로 그리고, 그것이 맨 위다.
    const pc = codeOnly(read('src/pages/pc-home/PcHomePage.tsx'))
    const hero = pc.indexOf('<PcHeroBanners')
    expect(hero, 'PC: 큰 배너 미배선').toBeGreaterThan(-1)
    expect(hero).toBeLessThan(pc.indexOf('<HomeSections'))
    expect(codeOnly(read('src/pages/pc-home/PcHeroBanners.tsx'))).toContain("useHomeBanners('strip')")
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
    // 2026-10-18: 주소는 서버 첫 화면과 같은 함수(stripBannerImageUrl)가 만들고 그 함수가 cfImage 를 부른다
    expect(body).toMatch(/stripBannerImageUrl\(/)
    expect(read('src/shared/home-strip-banners.ts')).toMatch(/\? cfImage\(imageUrl/)
    expect(body).toMatch(/cfImageOnError\(/)
  })
})

/**
 * 🎫 대표 확정이 **안 2(가로 카드) → 안 3(스와이프 스트립)** 으로 바뀌었다.
 *    안 2 로 되돌아가는 것을 막는 게 아니라, 안 3 이 실제로 **스와이프 스트립인지**를 고정한다.
 */
describe('① 상단 띠 = 옆으로 넘기는 스트립 (안 3)', () => {
  const SRC = resolveStripCls(read('src/components/home/HomeBannerStrip.tsx'))
  const RAIL = SRC.slice(SRC.indexOf('function StripRail('))

  it('네이티브 가로 스크롤 + scroll-snap 으로 넘긴다 (JS 캐러셀 라이브러리 0)', () => {
    expect(RAIL).toMatch(/overflow-x-auto/)
    expect(RAIL).toMatch(/snap-x snap-mandatory/)
    expect(RAIL).toMatch(/snap-start/)
    // 스크롤바 숨김은 이름이 셋(`scrollbar-hide`/`no-scrollbar`/`noscroll`)으로 갈렸던 자리다.
    //   `index.css` 가 정의를 한 벌로 합치며 표기를 `scrollbar-hide` 로 고정했다.
    //   ⚠️ 그 주석은 `scroll-consistency` 라는 가드를 인용하는데 **그런 스크립트는 없다**(실측).
    //     그러니 이 규약을 실제로 지키는 것은 지금 이 줄뿐이다.
    expect(RAIL).toMatch(/scrollbar-hide/)
    expect(RAIL).not.toMatch(/no-scrollbar|noscroll/)
  })

  /**
   * 🔁 2026-10-12 **두 번** 재조준했다. 불변식은 한 번도 안 바뀌었다 —
   *   **넘길 수 있다는 신호가 화면에 있고, 손가락을 모르는 사람도 누를 수 있어야 한다.**
   *   앵커만 따라 옮겼다: `peek`(74% 미리보기) → **점 줄** → **배너 안 숫자 알약**
   *   (대표 확정 *"2로 가자"* — `1 / 4` 형태, 점 줄을 대체).
   *
   *   ⚠️ 숫자만 두고 조작을 빼지 말 것 — 그러면 스와이프를 모르는 사람에게 둘째 장이
   *     **영원히 안 보인다.** 그래서 `<button>` + `goTo` 배선까지 함께 못 박는다.
   *   ⚠️ 그리고 **배너 안**이어야 한다 — 밖에 줄을 하나 더 두면 세로를 더 먹고, 그게
   *     "따로 논다"를 만든 바로 그 종류의 층이다(아래 리듬 검사와 같은 이유).
   */
  it('넘길 수 있다는 신호가 있다 — 두 장 이상이면 숫자가 뜨고 누를 수 있다', () => {
    expect(RAIL, '장수 표시가 사라졌다 — 두 장 이상인데 넘길 수 있다는 표시가 아무것도 없다').toMatch(/\{many && \(/)
    expect(codeOnly(RAIL), '숫자 알약이 사라졌다 — `N / 전체` 표기가 없다')
      .toMatch(/\{active \+ 1\} \/ \{banners\.length\}/)
    expect(codeOnly(RAIL), '숫자가 버튼이 아니다 — 누를 수 없으면 "부드럽게 넘김"(대표 지시)이 손가락 전용이 된다')
      .toMatch(/<button[\s\S]{0,400}?onClick=\{\(\) => goTo\(active \+ 1\)\}/)
    expect(codeOnly(RAIL), '숫자가 배너 밖으로 나갔다 — 줄을 하나 더 먹으면 다시 따로 논다')
      // 2026-10-14: 교환권 띠(single)에선 위로 올라가 className 이 템플릿이 됐다 — 두 표기 모두 '배너 안 absolute' 면 통과.
      .toMatch(/className=(?:"|\{`)absolute [^"`]*right-/)
    expect(codeOnly(RAIL), '포함 블록(relative)이 없어졌다 — 알약이 레일과 함께 스크롤돼 흘러간다')
      .toContain('<div className="relative">')
  })

  /**
   * 🎫 2026-10-12 신설 — **"따로 논다"를 막는 불변식.** 대표 지적 *"밑에 지금 인기 이용권 부분이랑
   *   되게 따로 노는 느낌"* 의 원인은 크기가 아니라 **리듬**이었다(라이브 실측: 패널은 거터 14 ·
   *   모서리 14 인데 배너만 전폭 · 모서리 16).
   *
   *   ⚠️ 그래서 14 를 손으로 적지 않는다 — `.ur-home-panel` 의 **모바일 값에서 읽어** 대조한다.
   *     숫자를 두 벌 두면 패널을 고친 날 배너만 남아 다시 따로 논다(이 레포가 반복해 당한 클래스).
   */
  it('배너 거터·모서리가 아래 패널과 같다 (어긋나면 다시 따로 논다)', () => {
    const css = read('src/index.css')
    const mobile = css.match(/max-width:\s*1023px\)\s*\{\s*\.ur-home-panel\s*\{([^}]*)\}/)
    expect(mobile, '`.ur-home-panel` 의 모바일 블록을 못 찾았다 — 이 검사가 헛돈다').toBeTruthy()
    const pad = Number((mobile![1].match(/padding:\s*(\d+)px/) || [])[1])
    const radius = Number((mobile![1].match(/border-radius:\s*(\d+)px/) || [])[1])
    expect(pad, '패널 거터를 못 읽었다').toBeGreaterThan(0)
    expect(radius, '패널 모서리를 못 읽었다').toBeGreaterThan(0)

    /**
     * 패널 값이 바뀌면 이 줄이 빨간불이 되어 배너도 같이 옮기라고 말한다.
     * ⚠️ `px-3.5`(반쪽 토큰) 가 아니라 **정확한 px** 로 쓴다 — 4px 격자 가드가 반쪽 간격을 막는데,
     *   이 14 는 리듬이 아니라 **패널에서 온 값**이라 격자에 맞출 수 없다(패널 자신이 14다).
     */
    const twGutter = `px-[${pad}px]`
    /**
     * 🩸 **스크롤러 클래스만 떼어 본다.** 두 번 틀렸다:
     *   ① `toContain('px-3.5')` → `scroll-px-3.5` 안의 **부분일치**로 통과
     *   ② 경계(`(?<![\w-])`)를 줘도 → 카드 안 `자세히 보기` **버튼의 `px-3.5`** 에 걸려 통과
     *   RAIL 전체를 보는 한 어딘가의 같은 글자에 늘 걸린다 ⇒ 범위를 그 한 줄로 좁힌다.
     */
    const scroller = (codeOnly(RAIL).match(/className=\{`flex gap-\d+([^`$]*)/) || [])[1]
    expect(scroller, '스트립 스크롤러의 className 을 못 찾았다 — 이 검사가 헛돈다').toBeTruthy()
    expect(scroller, `배너 좌우 거터가 패널(${pad}px)과 달라졌다 — 전폭으로 돌아가면 다시 따로 논다`)
      .toContain(twGutter)

    // 🔁 2026-10-14: 교환권 머리(hero) 덮어쓰기 한 조각이 붙어 className 이 160자를 넘었다 — 창만 넓힌다(범위는 여전히 그 한 줄).
    const scrollerAll = (codeOnly(RAIL).match(/className=\{`flex gap-\d+[\s\S]{0,240}?`\}/) || [])[0] || ''
    expect(scrollerAll, '스냅 기준점에 거터가 안 들어갔다 — 카드가 거터에 안 맞고 어정쩡하게 선다')
      .toContain(`scroll-${twGutter}`)
    expect(codeOnly(RAIL), `배너 모서리가 패널(${radius}px)과 다르다`).toContain(`rounded-[${radius}px]`)
  })

  it('끝에서 더 밀어도 페이지가 끌리거나 뒤로가기가 걸리지 않는다', () => {
    const scrollerAll = (codeOnly(RAIL).match(/className=\{`flex gap-\d+[\s\S]{0,240}?`\}/) || [])[0] || ''
    expect(scrollerAll, '스트립 스크롤러의 className 을 못 찾았다 — 이 검사가 헛돈다').not.toBe('')
    expect(scrollerAll, 'overscroll-x-contain 이 빠졌다 — 가로 스크롤 끝에서 브라우저 뒤로가기가 발동한다')
      .toContain('overscroll-x-contain')
  })

  /**
   * 🔁 2026-10-12 대표 *"자동으로 넘어가게 해줘"* — 종전 "자동 재생 금지" 단언을 **대체**한다.
   *   지키려던 것(읽는 사람을 방해하지 않는다)은 네 개의 멈춤 조건으로 옮겨갔다.
   */
  /** 🔁 2026-10-13 재조준 — "끝이면 처음으로" 가 되감기(0 으로 scrollTo) → **복제 칸 경유 순환**으로
   *   바뀌었다(대표 *"마지막페이지에서 또 오른쪽으로 넘기면 첫페이지로"*). 불변식은 그대로이고
   *   순환 자체는 `home-banner-yanolja-2026-10-13.test.tsx` 가 지킨다. */
  it('저절로 넘어간다 — 타이머가 다음 장으로 스크롤하고, 끝이면 처음으로', () => {
    const code = codeOnly(RAIL)
    expect(SRC).toMatch(/const AUTO_ADVANCE_MS = \d+/)
    expect(code).toMatch(/window\.setTimeout\(/)
    expect(code).toMatch(/goTo\(active \+ 1\)/)
  })

  it('읽는 사람을 방해하지 않는다 — 멈춤·동작 줄이기·화면 밖·숨은 탭에서는 안 넘긴다', () => {
    const code = codeOnly(RAIL)
    expect(code, '멈춤·동작 줄이기·화면 밖 게이트가 빠졌다').toMatch(/if \(!many \|\| paused \|\| reduceMotion \|\| !onScreen\) return/)
    expect(code, '숨은 탭에서도 넘긴다').toMatch(/document\.visibilityState !== 'visible'/)
    expect(code, '화면 밖 판정이 없다').toMatch(/IntersectionObserver/)
    expect(SRC, '동작 줄이기 설정을 안 본다').toMatch(/prefers-reduced-motion: reduce/)
    expect(code, '멈춤 버튼이 없다 (WCAG 2.2.2)').toMatch(/배너 자동 넘김 멈춤/)
  })

  it('손가락이 닿으면 잠시 멈춘다 — 방금 고른 장을 빼앗지 않는다', () => {
    const code = codeOnly(RAIL)
    expect(code).toMatch(/onPointerDown=\{many \? hold : undefined\}/)
    expect(code).toMatch(/Math\.max\(AUTO_ADVANCE_MS, heldUntil - Date\.now\(\)\)/)
  })

  it('한 장이면 꽉 채우고 숫자를 안 그린다 (`1 / 1` 금지)', () => {
    expect(RAIL).toMatch(/const many = banners\.length > 1/)
    // 숫자 알약과 폭 분기가 모두 `many` 게이트 뒤에 있어야 한다.
    expect(RAIL).toMatch(/\{many && \(/)
    // 🔁 2026-10-12: 앵커 `basis-[74%]`(미리보기) → `w-full`(거터 안 한 장 꽉). 게이트 구조는 그대로.
    //   🩸 `w-[calc(100%-1.75rem)]` 로 쓰면 스크롤러의 `px-3.5` 와 **거터가 두 번 빠진다**(실측 334px,
    //      다음 장이 42px 삐져나왔다). 그래서 이 단언은 `w-full` 을 못 박는다.
    expect(RAIL).toMatch(/many \? 'snap-start shrink-0 w-full' : 'flex-1'/)
    // 🩸 주석 제거본으로 본다 — 바로 위 설명 주석이 `w-[calc(100%-…)]` 를 **예시로 인용**하고 있어서
    //   원문을 그대로 보면 이 단언이 코드가 멀쩡해도 빨간불이 난다(2026-10-12 실제로 그랬다).
    expect(codeOnly(RAIL), '거터가 두 번 빠지는 폭 계산이 돌아왔다 — 스크롤러가 이미 px-3.5 를 갖고 있다').not.toMatch(/w-\[calc\(100%-/)
  })

  it('숫자는 스크롤 위치에서 파생한다 — 따로 든 상태는 손가락과 어긋난다', () => {
    expect(RAIL).toMatch(/onScroll/)
    expect(RAIL).toMatch(/scrollLeft/)
  })

  it('장수 계산이 쓰는 간격 상수가 실제 gap 과 같다', () => {
    const gap = SRC.match(/const STRIP_GAP_PX = (\d+)/)
    expect(gap, 'STRIP_GAP_PX 상수를 못 찾았다').toBeTruthy()
    // Tailwind gap-N = N * 4px. 렌더의 gap 클래스에서 실제 값을 읽어 대조한다.
    const cls = RAIL.match(/className=\{`flex gap-(\d+) /)
    expect(cls, '스트립 컨테이너의 gap 클래스를 못 찾았다').toBeTruthy()
    expect(Number(gap![1])).toBe(Number(cls![1]) * 4)
  })

  /**
   * 🔁 2026-10-12 재조준 — 방향이 `to-r`(좌→우) → `to-t`(아래→위)로 바뀌었다(글자가 카드 **아래**로
   *   내려왔다). 그리고 브랜드 면(사진 없음)일 때는 덮을 것이 없으므로 `{bg && ...}` 로 묶였다.
   *   지키려던 것은 그대로다: **사진이 있으면 반드시 덮는다** — 어떤 사진이 올라올지 모르기 때문이다.
   *   그래서 방향을 고정하는 대신 **사진과 오버레이의 렌더 조건이 같은지**를 본다(그쪽이 더 강하다).
   */
  it('사진 위 글자 — 사진이 있으면 어두운 오버레이가 반드시 같이 덮인다', () => {
    expect(RAIL, '어두운 오버레이가 사라졌다 — 밝은 사진 위에서 흰 글자가 안 읽힌다').toMatch(/from-black\//)
    const imgCond = (RAIL.match(/\{bg && /g) || []).length
    expect(
      imgCond,
      '사진과 오버레이가 **같은 조건**(`{bg && …}`)으로 렌더되지 않는다 — 한쪽만 뜨면 글자가 안 읽히거나\n' +
        '   브랜드 면 위에 쓸데없는 검은 막이 깔린다.',
    ).toBeGreaterThanOrEqual(2)
  })

  it('규격 안내가 안 3(배경 전면 사진)을 말한다 — 안 2 의 정사각 안내가 남으면 안 된다', () => {
    expect(BANNER_SLOT_SPECS.strip.recommendedWidth).toBeGreaterThan(BANNER_SLOT_SPECS.strip.recommendedHeight)
    expect(BANNER_SLOT_SPECS.strip.renderedNote).toMatch(/넘긴다/)
    expect(BANNER_SLOT_SPECS.strip.notes.join(' ')).toMatch(/그라디언트/)
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
      // 🧭 2026-10-31: 시작 측위는 `homeStartLoc()`(마지막에 지역을 골랐으면 옛 측위를 안 쓴다) — 규칙은 그대로.
      expect(src, `${p}: homeStartLoc 미사용`).toMatch(/homeStartLoc\(\)/)
      expect(src, `${p}: near 기본값 미배선`).toMatch(/homeStartLoc\(\)\s*\?\s*'near'\s*:\s*'popular'/)
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
        .toMatch(/useState<HomeRegion>\(\(\) => \(homeStartLoc\(\) \? \{\} : readHomeRegion\(\)\)\)/)
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
    const fallback = pc.indexOf("homeStartLoc() ? 'near' : 'popular'")
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
