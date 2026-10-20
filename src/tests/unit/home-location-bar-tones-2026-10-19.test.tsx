/**
 * 🧱 2026-10-19 대표 "영구적으로 수정해볼래?" — 위치 바의 톤이 서로 새지 않게.
 *
 * 사고: 2026-10-17 PC 왼쪽 필터 열(`panel`)만 세로로 쌓으려던 조건이 `!hero` 로 쓰여
 *   모바일 홈 제목(`title`)까지 세로로 쌓였다 → 동 이름 "공..." 잘림 + 현 위치 버튼이 아래 줄.
 *   에러 0, PC 에서만 보면 안 보인다.
 * 근본 원인: 세 톤의 클래스를 **중첩 삼항으로 아홉 군데**에서 갈랐다. 한 톤을 고치는 조건이
 *   다른 톤을 같이 집기 쉬웠다.
 * 처방: 톤별 모양을 표(`LOCATION_BAR_TONES`) 한 곳에 **칸마다 따로** 적는다.
 *
 * 이 시험이 지키는 것:
 *   ① 실제로 렌더해서 — title 줄은 한 줄(flex-col 없음)이고 두 버튼이 같은 줄 안에 있다
 *   ② 세로 쌓기는 panel 하나에만
 *   ③ 컴포넌트 안에 톤 분기(`tone ===` · `hero ?` · `!title` …)가 다시 생기지 않는다
 *   ④ 렌더 결과가 표와 같다 — 표를 우회한 클래스가 없다
 * ⚠️ 못 보는 것: 실제 폭·글자 잘림(jsdom 에 레이아웃이 없다). 라이브 실측은 2026-10-19
 *   Playwright(390·360px): `전국` 버튼 y=48 · 현 위치 버튼 y=50 — 같은 줄.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PcHomeLocationBar, { LOCATION_BAR_TONES, type LocationBarTone } from '@/pages/pc-home/PcHomeLocationBar'
import { readCode } from '../helpers/source-text'

const TONES: LocationBarTone[] = ['panel', 'hero', 'title']

function mount(tone: LocationBarTone) {
  const { container } = render(<PcHomeLocationBar tone={tone} value={{}} onChange={() => {}} />)
  const locate = container.querySelector('button[aria-label="현 위치로 설정"]') as HTMLElement
  const pick = container.querySelector('button[aria-expanded]') as HTMLElement
  return { container, locate, pick, row: locate.parentElement as HTMLElement }
}

describe('홈 위치 바 — 톤이 서로 새지 않는다', () => {
  it('① title(모바일 홈 제목)은 한 줄이다 — 두 버튼이 세로로 쌓이지 않는다', () => {
    const { row, pick } = mount('title')
    expect(pick.parentElement, '지역 버튼과 현 위치 버튼이 같은 줄에 있어야 한다').toBe(row)
    expect(row.className).not.toMatch(/\bflex-col\b/)
    expect(row.className).toMatch(/\bitems-center\b/)
  })

  it('② 세로 쌓기(flex-col)는 panel 하나에만 걸린다', () => {
    for (const tone of TONES) {
      const { row } = mount(tone)
      expect(/\bflex-col\b/.test(row.className), `${tone} 의 줄`).toBe(tone === 'panel')
    }
  })

  it('③ 컴포넌트 안에 톤 분기를 다시 쓰지 않는다 — 모양은 표에서만', () => {
    const src = readCode('src/pages/pc-home/PcHomeLocationBar.tsx')
    const body = src.slice(src.indexOf('export default function PcHomeLocationBar'))
    expect(body.length, '컴포넌트 본문을 못 찾았다').toBeGreaterThan(2000)
    for (const bad of [/\btone\s*===/, /\btone\s*!==/, /\bhero\s*\?/, /\btitle\s*\?/, /!\s*hero\b/, /!\s*title\b/, /\bhero\s*&&/, /\btitle\s*&&/]) {
      expect(body, `톤 분기 ${bad} — 그 클래스를 LOCATION_BAR_TONES 로 옮길 것`).not.toMatch(bad)
    }
    expect(body).toMatch(/LOCATION_BAR_TONES\[tone\]/)
  })

  it('④ 렌더된 클래스가 표의 값과 같다', () => {
    for (const tone of TONES) {
      const t = LOCATION_BAR_TONES[tone]
      const { container, row, pick, locate } = mount(tone)
      expect((container.firstElementChild as HTMLElement).className).toBe(t.box)
      expect(row.className).toBe(t.row)
      expect(pick.className).toBe(t.pick)
      expect(locate.className).toBe(t.locate)
      expect(!!container.querySelector('span.w-px'), `${tone} 실선`).toBe(t.divider)
      expect(locate.textContent?.includes('현 위치로 설정'), `${tone} 버튼 글자`).toBe(t.locateText)
    }
  })

  it('⑤ 표에 모든 톤이 있다(빈 칸 없음)', () => {
    for (const tone of TONES) {
      const t = LOCATION_BAR_TONES[tone]
      for (const k of ['box', 'row', 'pick', 'label', 'chevron', 'locate'] as const) {
        expect(t[k].trim().length, `${tone}.${k}`).toBeGreaterThan(0)
      }
    }
  })
})
