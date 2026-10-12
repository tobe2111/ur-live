import { describe, it, expect } from 'vitest'
import { readCode, readRaw } from '../helpers/source-text'

/**
 * 👆 2026-10-01 — 셀러 **공용 chrome** 의 눌리는 크기.
 *
 * ## 무엇이 문제였나 (430px 실측)
 *
 * 셀러 대시보드 일곱 화면을 폰 폭으로 재니(`visual-preview.mjs --phone-audit`) **같은 네 자리**가
 * 모든 화면에 작은 타깃으로 나왔다 — 페이지가 아니라 **공용 chrome** 이었다:
 *
 *   · `SellerKakaoLinkBanner` 닫기 **24×24** (`p-1` + 16px 글리프)
 *   · `SellerKakaoLinkBanner` 연동하기 **32** (`ur-btn-sm`)
 *   · `SellerLayout` 페이지검색(폰 전용) **32×32** (`h-8 w-8`)
 *   · `DashboardNotificationBell` **36×36** (`p-2`)
 *
 * 한 자리를 고치면 일곱 화면이 같이 좋아진다. 바는 **40px** — 외부 규격(Apple HIG 44)이 아니라
 * 이 레포 디자인 시스템의 보통 버튼(`.ur-btn-md { height: 2.5rem }`)이다.
 *
 * ## 🩸 처방이 둘로 갈린다 — 값을 치르고 배웠다
 *
 * 처음엔 넷 다 **박스째** 키웠다. 헤더는 `h-14`(56px) 고정이라 아무 영향이 없었지만, **배너는
 * 같은 flex 행의 글자 칸이 197 → 167px 로 좁아져 설명이 한 줄 더 감기고 109 → 148px(+39px)**
 * 이 됐다(`--probe` 실측). 공용 chrome 이니 **일곱 화면에 +39px 씩** 얹는 셈이다.
 *
 *   · 고정 높이 컨테이너 안(헤더) → **박스를 키운다**(정직한 크기)
 *   · 좁은 flex 행(배너) → **`.tap-reach`** 로 닿는 범위만 키운다(레이아웃 무접촉)
 *
 * ## 이 시험이 못 보는 것
 *
 *   · **실제로 눌리는지**는 안 본다 — 조상 `overflow: hidden` 에 히트 영역이 잘려도 통과한다.
 *     그 판정은 `--phone-audit` 의 `안 닿는 히트영역`(`elementFromPoint` 히트 테스트)이 한다.
 *     ⚠️ 클래스가 붙었는지만 보는 이 시험을 "고쳐졌다" 의 근거로 쓰지 말 것.
 *   · 페이지 고유 컨트롤(탭 줄 28px · `ur-btn-sm` 전폭 CTA 32px · 카드 머리 링크 18px)은
 *     범위 밖이다 — 디자인 시스템 눈금을 바꾸는 일이라 대표 판단 사항이다.
 */

const LAYOUT = 'src/components/SellerLayout.tsx'
const BELL = 'src/components/DashboardNotificationBell.tsx'
const CSS = 'src/index.css'

describe('셀러 공용 chrome 의 탭 타깃은 40px 눈금에 닿는다', () => {
  it('`.tap-reach` 유틸이 40px(2.5rem) 로 넓힌다', () => {
    const css = readRaw(CSS)
    const block = css.slice(css.indexOf('.tap-reach::after'), css.indexOf('.tap-reach::after') + 400)
    expect(block, '`.tap-reach::after` 블록을 못 찾았다 — 이 검사가 헛돌고 있다').toContain('content')
    expect(block, '넓히는 값이 2.5rem(=ur-btn-md 눈금) 이 아니다').toMatch(/max\(100%,\s*2\.5rem\)/)
    // `max(100%, …)` 라야 이미 넓은 버튼은 **높이만** 늘고 폭이 그대로다(옆을 삼키지 않는다).
    expect(block.match(/max\(100%,\s*2\.5rem\)/g)?.length, '폭·높이 둘 다 max() 여야 한다').toBe(2)
    // 의사요소가 포인터를 안 받으면 넓힌 의미가 통째로 없어진다(주입으로 🔴 확인한 실패 모드).
    expect(block, '`pointer-events: none` 이면 닿지 않는다').not.toMatch(/pointer-events\s*:\s*none/)
  })

  it('알림 벨은 박스가 40px 다 (어드민·에이전시 머리줄이 쓴다)', () => {
    // 🧱 2026-10-12 셀러 머리줄은 지웠지만 벨은 남은 대시보드 머리줄에서 그대로 쓰인다.
    expect(readCode(BELL), '알림 벨이 40px 박스가 아니다').toMatch(/relative flex h-10 w-10 items-center justify-center/)
    expect(readCode(BELL), '벨을 반쪽 간격 패딩으로 키웠다 — 4px 격자를 쓸 것').not.toMatch(/relative p-2\.5 /)
  })

  it('측정 도구가 넓힌 히트 영역을 **보고 또 검증한다** (다음 세션이 박스를 또 키우지 않게)', () => {
    /**
     * 🩸 `getBoundingClientRect` 는 `::after` 를 안 센다. 그래서 고친 뒤에도 측정 도구가
     *   그 자리를 계속 "작은 타깃" 으로 보고했다 — 그 보고를 믿으면 다음 세션이 **또 박스를 키운다**
     *   (그게 +39px 를 만든 경로다). 도구가 유효 크기를 재고, 진짜 눌리는지까지 확인해야 한다.
     */
    const tool = readCode('scripts/visual-preview.mjs')
    expect(tool, "::after 를 합쳐 재지 않는다").toMatch(/getComputedStyle\(el, '::after'\)/)
    expect(tool, '히트 테스트(elementFromPoint)가 없다 — 클래스만 보면 잘린 경우를 놓친다').toContain('document.elementFromPoint')
    expect(tool, '안 닿는 히트영역이 판정(bad)에 안 들어간다 — 고친 줄 알고 넘어간다').toMatch(/audit\.reachDead > 0/)
  })
})
