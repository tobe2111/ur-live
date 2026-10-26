/**
 * ⚫ 하단 탭 — 전부 검정, 누르면 채워진다 〔2026-10-14〕
 * 대표: *"야놀자 하단바처럼 아예 버튼들 검정색에 클릭 시 색이 채워지는 식으로 어때 더 깔끔하게"*
 * 시안: docs/design/bottomnav-black-filled-2026-10-14.md
 *
 * 활성 신호는 **면(filled) + 라벨 굵기** 둘뿐이다. 비활성을 회색으로 흐리거나 아래 점을 다시 달면
 * 신호가 겹쳐 "깔끔하게" 가 무너진다.
 *
 * 못 막는 것: 아이콘 그림 자체(면/선 모양)는 urdeal-icons 쪽 시험이 본다 · 실제 렌더 색은 브라우저만 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const SRC = stripComments(readFileSync('src/components/main/BottomNav.tsx', 'utf8'))
const render = SRC.slice(SRC.indexOf('const renderItem'), SRC.indexOf('isWholesaleSurface(location.pathname)) return null'))

describe('하단 탭 — 검정 + 채움', () => {
  it('렌더 구간을 찾았다(헛도는 가드 방지)', () => {
    expect(render.length).toBeGreaterThan(500)
    expect(render).toMatch(/filled=\{active\}/)
  })
  it('탭 아이콘은 활성 여부와 무관하게 잉크색이다', () => {
    expect(render).toMatch(/<TabIcon[\s\S]*?className="text-gray-900 dark:text-white"/)
  })
  it('비활성 회색(gray-400)으로 흐리지 않는다', () => {
    expect(render).not.toMatch(/text-gray-400/)
    expect(render).not.toMatch(/opacity-60/)
  })
  it('라벨은 굵기로만 가른다', () => {
    expect(render).toMatch(/text-gray-900 dark:text-white \$\{active \? 'font-semibold' : 'font-normal'\}/)
  })
  it('아래 브랜드 점이 다시 생기지 않는다', () => {
    expect(render).not.toMatch(/rounded-full bg-brand/)
  })
})

/**
 * 홈 상단 검색·알림·장바구니도 같은 규칙(대표 *"메인의 검색, 장바구니, 알림 버튼도 마찬가지로 똑같이"*).
 * 잉크색 선 · 누르는 동안(알림은 시트가 열려 있는 동안도) 면으로 채운다.
 */
const HOME = stripComments(readFileSync('src/pages/mobile-home/MobileHomePage.tsx', 'utf8'))
// 🏠 2026-10-26 (대표 확정 안 A): 검색은 머리 아래 **큰 검색창**(`HOME_SEARCH`)이 맡는다 — 아이콘 버튼은 알림·장바구니 둘.
const head = HOME.slice(HOME.indexOf('aria-label="알림"') - 300, HOME.indexOf('aria-label="장바구니"') + 300)

describe('홈 상단 아이콘 — 검정 + 누르면 채움', () => {
  it('구간을 찾았다', () => {
    expect(head).toMatch(/aria-label="알림"/)
  })
  it('아이콘 버튼 묶음이 잉크색이다(회색 아님)', () => {
    expect(head).toMatch(/flex items-center gap-1 text-gray-900 dark:text-white/)
    expect(head).not.toMatch(/text-gray-500 dark:text-gray-400/)
  })
  it('아이콘 버튼 모두 누르는 상태를 받는다', () => {
    for (const k of ['bell', 'cart']) expect(head).toContain(`pressProps('${k}')`)
  })
  it('검색은 큰 검색창이 맡는다(같은 자리에 검색 아이콘 버튼을 두 벌 두지 않는다)', () => {
    expect(HOME).toContain('className={HOME_SEARCH.pill}')
    expect(HOME).not.toContain(`pressProps('search')`)
  })
  it('누르면 채운다 — 장바구니는 누르는 동안, 알림은 열려 있는 동안도', () => {
    expect(head).toMatch(/filled=\{pressed === 'bell' \|\| bell\.isOpen\}/)
    expect(head).toMatch(/filled=\{pressed === 'cart'\}/)
  })
  it('손을 떼거나 벗어나면 선으로 돌아간다', () => {
    for (const ev of ['onPointerUp', 'onPointerLeave', 'onPointerCancel']) expect(HOME).toMatch(new RegExp(`${ev}: \\(\\) => setPressed\\(null\\)`))
  })
})
