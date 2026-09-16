/**
 * 🎬 홈 헤더 유어쇼츠 진입점 (2026-09-09 대표 확정 — 자리·아이콘·마침표 전부 시안에서)
 *
 * 대표: *"이 부분에 유어쇼츠 페이지로 가는 버튼이 있으면 좋을까?"* → 캡처에 빨간 박스로
 * **카테고리 줄 오른쪽 끝**을 찍어 줌 → *"아이콘도 만들까?"* → *"유어쇼츠는 추천대로 할게"*.
 *
 * 그전까지 유어쇼츠로 가는 문은 레일 안 「전체 보기」 하나뿐이었고, 그 레일은 인기 이용권
 * 다음이라(2026-09-07 확정) 거기까지 스크롤한 사람만 존재를 알았다.
 *
 * ## 🔴 이 파일이 지키는 것 중 제일 중요한 것 — 스크롤 밖에 있어야 한다
 * 카테고리 줄은 `overflow-x-auto` 다. 진입점을 **그 안에** 넣으면 카테고리가 하나만 늘어도
 * 같이 밀려 화면 밖으로 사라진다. 지금은 다섯 개가 다 들어와 스크롤이 안 생기므로
 * **화면으로는 티가 안 난다** — 그래서 사람 눈이 아니라 이 테스트가 지켜야 한다.
 *
 * ## 못 막는 것
 * - 실제로 눌러서 `/videos` 가 열리는지(라우팅) — 라우트 자체는 App.tsx 계약이다.
 * - 16px 에서 아이콘이 뭉개지는지 — 그건 눈으로 봤다(시안 40px·16px 나란히).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8')
/** 주석은 마크업이 아니다 — 블록 주석을 **먼저 통째로** 지운다(줄 단위로 지우면 가운데 줄이 남는다). */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const HOME = 'src/pages/mobile-home/MobileHomePage.tsx'
const ICONS = 'src/components/icons/urdeal-icons.tsx'

describe('① 진입점이 카테고리 줄에 있다', () => {
  const s = code(read(HOME))
  it('유어쇼츠로 가는 링크가 있다', () => {
    expect(s).toMatch(/to=\{URSHORTS_VIEWER_PATH\}/)
  })
  it('경로를 손으로 적지 않는다(SSOT 사용)', () => {
    expect(s, "'/videos' 를 직접 적으면 SSOT 와 갈린다").not.toMatch(/to="\/videos"/)
  })
})

describe('② 🔴 스크롤 밖에 고정된다', () => {
  const s = code(read(HOME))
  it('카테고리 nav 와 진입점이 형제다(같은 flex 줄, nav 안이 아니다)', () => {
    // nav 가 닫힌 **뒤에** 링크가 온다 — 안에 있으면 스크롤과 함께 밀려 사라진다.
    const navOpen = s.indexOf('<nav')
    const navClose = s.indexOf('</nav>')
    expect(navClose, 'nav 가 사라졌다').toBeGreaterThan(-1)
    expect(s.indexOf('URSHORTS_VIEWER_PATH', navClose), '진입점이 nav 뒤에 없다').toBeGreaterThan(navClose)
    // 🩸 2026-09-09: PC 주입이 드러낸 구멍 — "뒤에 있나"만 물으면 nav 안에 하나를 더 심어도 통과한다.
    expect(s.slice(navOpen, navClose), 'nav 안에 진입점이 있다 = 스크롤되어 사라진다')
      .not.toContain('URSHORTS_VIEWER_PATH')
  })
  it('nav 는 스크롤하고 진입점은 shrink-0 이다', () => {
    expect(s).toMatch(/<nav[^>]*overflow-x-auto/)
    expect(s).toMatch(/flex shrink-0 items-center/)
  })
})

describe('③ 생김새 계약', () => {
  const s = code(read(HOME))
  it('아이콘 + 글자 둘 다 있다(아이콘만이면 새 이름을 못 알린다)', () => {
    expect(s).toMatch(/<ShortsIcon size=\{16\} \/>/)
    expect(s).toMatch(/유어쇼츠/)
  })
  it('마침표는 붙어 있고 브랜드 글자색이다(로고 urdeal. 과 같은 장치)', () => {
    expect(s).toMatch(/text-brand-text">\.<\/span>/)
    expect(s, '음수 마진이 빠지면 점이 떨어져 뱃지로 읽힌다').toMatch(/-ml-\[3px\]/)
  })
  it('면(알약)을 쓰지 않는다 — 이 줄의 유일한 면이 되면 필터보다 무거워진다', () => {
    const link = s.slice(s.indexOf('URSHORTS_VIEWER_PATH'), s.indexOf('URSHORTS_VIEWER_PATH') + 400)
    expect(link).not.toMatch(/rounded-full|bg-brand\b|bg-gray-100/)
  })
  it('반짝임(펄스)을 안 쓴다 — live-pulse 는 지도에서 "방송 중"을 뜻한다', () => {
    expect(s).not.toMatch(/animate-pulse|live-pulse/)
  })
})

describe('④ ShortsIcon 은 세트 규약을 따른다', () => {
  const s = read(ICONS)
  it('export 되고 forwardRef 로 감싼다(lucide 자리에 들어갈 수 있어야 한다)', () => {
    expect(s).toMatch(/export const ShortsIcon = forwardRef<SVGSVGElement, IconProps>/)
  })
  it('공용 base 를 쓰고 size 를 width/height 로 변환한다', () => {
    const blk = s.slice(s.indexOf('export const ShortsIcon'))
    expect(blk).toMatch(/\{\.\.\.base\} width=\{size\} height=\{size\}/)
  })
  it('재생 삼각형은 채운다 — 선으로 그리면 16px 에서 속이 비어 안 읽힌다', () => {
    const blk = s.slice(s.indexOf('export const ShortsIcon'))
    expect(blk).toMatch(/fill="currentColor" stroke="none"/)
  })
})

describe('PC 홈 — 같은 자리, 같은 함정 (2026-09-09)', () => {
  const s = code(read('src/components/main/DesktopTopNav.tsx'))
  it('진입점이 카테고리 nav **뒤**에 있고 nav 안에는 없다 = 스크롤 영역 밖', () => {
    // 🩸 2026-09-09: 이 파일엔 `<nav>` 가 **둘**이다(탭 메뉴 + 카테고리 줄). 첫 번째를 집으면
    //    엉뚱한 요소를 재고 무엇을 심어도 초록이 뜬다 — 실제로 그랬고 주입이 잡았다.
    const anchor = s.indexOf("aria-label={t('nav.categories'")
    expect(anchor, '카테고리 nav 를 못 찾았다(aria-label 이 바뀌었나)').toBeGreaterThan(-1)
    const navOpen = s.lastIndexOf('<nav', anchor)
    const navClose = s.indexOf('</nav>', anchor)
    expect(navClose, 'nav 가 사라졌다').toBeGreaterThan(-1)
    expect(s.indexOf('URSHORTS_VIEWER_PATH', navClose), '진입점이 nav 뒤에 없다').toBeGreaterThan(navClose)
    // 🩸 2026-09-09: "뒤에 있나"만 물으면 nav **안에** 하나를 더 심어도 통과한다(주입이 그걸 잡았다).
    //    스크롤러 안에 하나라도 있으면 그것이 밀려 사라지는 진입점이다.
    expect(s.slice(navOpen, navClose), 'nav 안에 진입점이 있다 = 스크롤되어 사라진다')
      .not.toContain('URSHORTS_VIEWER_PATH')
  })
  it('스크롤 컨테이너가 진입점을 감싸지 않는다', () => {
    // 진입점을 감싼 줄에는 overflow-x-auto 가 없어야 한다(있으면 같이 밀린다).
    const row = s.match(/<div className="max-w-\[1440px\][^"]*"/)
    expect(row, '카테고리 줄 컨테이너를 못 찾았다').toBeTruthy()
    expect(row![0]).not.toContain('overflow-x-auto')
    expect(row![0], '스크롤러가 남은 폭을 먹어야 진입점이 오른쪽 끝에 붙는다').toContain('flex')
  })
  it('마침표는 붙어 있고 브랜드 글자색이다(모바일과 같은 장치)', () => {
    expect(s).toMatch(/text-brand-text">\.<\/span>/)
    expect(s, '음수 마진이 빠지면 점이 떨어져 뱃지로 읽힌다').toMatch(/-ml-\[3px\]/)
  })
  it('스크롤 화살표가 스크롤러 기준으로 붙는다(right-4 면 진입점을 덮는다)', () => {
    expect(s).toMatch(/ur-appear absolute right-0/)
  })
  it('아이콘은 유어딜 전용(lucide 로 대체 금지)', () => {
    expect(s).toContain('ShortsIcon')
  })
})
