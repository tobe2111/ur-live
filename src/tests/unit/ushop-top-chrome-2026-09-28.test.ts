/**
 * 🎫 2026-09-28 (대표 확정 **상단 1안**) 유어샵 모바일 상단 — 버튼 몇 개를 위해 줄을 쓰지 않는다.
 *
 * ■ 왜 생겼나 (라이브 실측 · iPhone 13 844px · `urdeal.kr/u/jiwon1228` 핀 3개)
 *   대표: *"이용권 상품 문제가 아니라 윗 부분들 위치들이 별로야. 조금 더 컴팩트하게 있어야 할 것 같아.
 *   SNS 로고도 말이야. 카테고리 배치들도 그렇고, 추천순 그 버튼도."*
 *
 *   | 층 | y | 높이 |
 *   |---|---|---|
 *   | 이름·소개·공유/관리 | 64 | 75 |
 *   | **SNS 아이콘**      | 139 | **36** ← 아이콘 두 개가 자기 줄을 통째로 |
 *   | 카테고리 칩        | 187 | 48 |
 *   | **정렬 드롭다운**   | 247 | **32** ← 버튼 하나가 자기 줄을 통째로 |
 *   | 첫 상품            | 287 | |
 *
 *   상품 전에 **287px = 첫 화면의 34%**. 그중 102px(SNS 36 + 정렬 32 + 앞뒤 여백 34)이
 *   **줄 두 개의 존재 자체**에 쓰였다. 1안은 그 두 줄을 없앤다 → 첫 상품 y 287 → **185**.
 *
 * ■ 이 시험이 지키는 것
 *   ① SNS 가 전용 줄을 갖지 않는다(이름 줄의 버튼 그룹 안).
 *   ② **공유·관리 버튼은 그대로 있다** — 대표가 직접 확인을 요청한 항목이다
 *      (*"편집? 관리 버튼 들어가야 해"*). 줄을 줄이려다 버튼을 없애면 안 된다.
 *   ③ 칩이 자기 줄을 소유하지 않는다(호출부의 한 줄을 정렬과 나눠 쓴다).
 *   ④ 그런데도 **빈 진열대 판정은 칩 부품이 혼자** 한다 — 호출부에 개수 게이트를 두면 언젠가 갈린다.
 *
 * ■ 이 시험이 **못** 보는 것
 *   - 실제 픽셀(줄이 정말 한 줄인지, 넘치는지)은 브라우저만 안다. 라이브 실측으로 판정할 것:
 *     주인 화면 최악(이름 10자 + SNS 2 + 공유 + 관리)에서 오른쪽 끝 374/390px 이었다.
 *   - PC(lg+) 좌측 프로필 열의 폭(308px)에서 같은 줄이 어떻게 접히는지도 브라우저 몫이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const HEADER = 'src/pages/curator-page/CuratorHeader.tsx'
const CHIPS = 'src/pages/curator-page/PinCategoryChips.tsx'
const PAGE = 'src/pages/CuratorPage.tsx'

const read = (p: string) => stripComments(readFileSync(p, 'utf-8'))
const header = read(HEADER)
const chips = read(CHIPS)
const page = read(PAGE)

describe('① SNS 가 전용 줄을 쓰지 않는다', () => {
  it('측정이 비어 있지 않다', () => {
    // 0자면 통과가 아니라 고장이다(경로가 낡으면 아래 not.toMatch 가 전부 무의미해진다).
    expect(header.length).toBeGreaterThan(2000)
    expect(header).toContain('snsUrl(')
  })

  it('SNS 링크가 버튼 그룹 안에 들어간다', () => {
    expect(header, 'snsLinks 를 만든다').toMatch(/const snsLinks = hasSns \?/)
    // 이름 줄의 오른쪽 그룹(ml-3 …)이 SNS 를 먼저 그린다.
    const group = header.slice(header.indexOf('className="ml-3 flex items-center'))
    expect(group.slice(0, 200), '버튼 그룹이 snsLinks 를 그린다').toContain('{snsLinks}')
  })

  it('SNS 전용 줄(px-4 pb-3)이 없다', () => {
    // 되살아나면 36px + 여백이 통째로 돌아온다.
    expect(header).not.toMatch(/-ml-2 px-4 pb-3/)
  })

  it('크기는 36px 그대로다 — 줄을 없앤 것이 높이를 줄인 것이다', () => {
    // 🩸 처음엔 버튼(31px)과 균형을 맞추려 32px 로 줄였다가 **되돌렸다.** 라이브 실측에서
    //   36 → 32 로 줄여도 **헤더 높이 92px 가 그대로**였다(왼쪽 이름·소개 칸이 더 높아 그쪽이
    //   높이를 정한다). 얻는 것은 이름 칸 12px(112 → 124)뿐이고, 대신 2026-09-16 이 박아 둔
    //   탭 영역 하한(≥34px)을 깎아야 했다 — 그 거래는 남는 게 없다.
    //   ⇒ 이 작업이 줄인 것은 **줄 하나(48px)** 이고 아이콘 크기가 아니다.
    expect(header, '36px(w-9) 유지').toMatch(/w-9 h-9 rounded-full/)
    expect(header, '34px 이하로 깎지 않았다').not.toMatch(/w-\[3[0-4]px\]/)
  })
})

describe('② 공유·관리 버튼은 그대로 있다 (대표 확인 항목)', () => {
  it('공유 버튼이 있다', () => {
    expect(header).toMatch(/onClick=\{onCopyLink\}/)
    expect(header).toContain("curator.share")
  })

  it('관리 버튼이 주인에게 뜬다', () => {
    expect(header, '관리는 canEdit 일 때').toMatch(/canEdit && \([\s\S]{0,200}\/u\/me\/manage/)
    expect(header).toContain("curator.manage")
  })
})

describe('③ 칩과 정렬이 줄 하나를 나눠 쓴다', () => {
  it('칩 부품이 자기 줄의 바깥 여백을 갖지 않는다', () => {
    // `max-w-3xl mx-auto px-4` 가 부품 안에 있으면 그건 자기 줄을 소유한다는 뜻이다.
    expect(chips, '칩은 줄을 소유하지 않는다').not.toMatch(/max-w-3xl mx-auto px-4/)
    expect(chips, '줄을 나눠 쓰는 형태').toMatch(/flex-1 min-w-0 flex gap-2 overflow-x-auto/)
  })

  it('호출부의 한 줄에 칩과 정렬이 함께 있다', () => {
    const rowStart = page.indexOf('empty:hidden')
    expect(rowStart, '병합 줄이 있다').toBeGreaterThan(0)
    const row = page.slice(rowStart, rowStart + 900)
    expect(row).toContain('<PinCategoryChips')
    expect(row).toContain('<SortMenu')
  })

  it('정렬만 든 줄이 남아 있지 않다', () => {
    // 칩 없이 SortMenu 만 있는 컨테이너가 또 생기면 32px 줄이 되돌아온다.
    const sortCount = (page.match(/<SortMenu/g) || []).length
    expect(sortCount, 'SortMenu 는 한 번만 그린다').toBe(1)
  })
})

describe('④ 빈 진열대 판정은 칩 부품이 혼자 한다', () => {
  it('부품이 스스로 null 을 낸다', () => {
    expect(chips).toMatch(/if \(pins\.length === 0\) return null/)
  })

  it('호출부에 개수 게이트를 두지 않는다', () => {
    // 게이트가 두 곳이면 언젠가 갈린다(2026-09-28 주석이 경고하는 바로 그것).
    expect(page).not.toMatch(/pins\.length[^\n]*&&\s*<PinCategoryChips/)
    expect(page, '죽은 최소개수 상수가 되살아나지 않았다').not.toContain('CHIPS_MIN_PINS')
  })

  it('둘 다 없으면 빈 줄의 여백까지 접는다', () => {
    // 칩 null + (정렬은 항상 있음) 이라 실제로는 거의 안 걸리지만,
    // 이 클래스가 사라지면 미래에 정렬이 조건부가 되는 순간 빈 줄이 남는다.
    expect(page).toMatch(/flex items-center gap-2 empty:hidden/)
  })
})
