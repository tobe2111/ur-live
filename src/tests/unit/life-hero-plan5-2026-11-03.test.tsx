/**
 * 🏠 생활 첫 화면 머리 — 안 5 + 실시간 한 줄 C 〔2026-11-03 대표 *"안 5가 가장 돋보이네"* → *"C"*〕
 *
 * 지키는 것
 *   ① 실제 견적 기록이 있으면 그 사실(시각·시군구·업종·건수)을 말한다
 *   ② 없으면 지금 견적을 받는 업체 수로 바꾼다 — 둘 다 없으면 줄을 숨긴다(지어내지 않는다)
 *   ③ '무료로 견적 받기' 는 업종 고르기 창을 열고, 업종을 누르면 그 요청서로 간다
 *   ④ 서버 응답은 시군구·업종·건수·시각만 — 이름·연락처·상세 주소를 꺼내지 않는다
 * 못 보는 것: 실제 화면 모양(그려서 본다) · 라이브 값(지금은 견적 0건이라 ② 가 뜬다).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
// 창은 lazy — 시험은 그 묶음을 기다린다(findByText).
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { agoLabel, lifeLiveLine } from '@/pages/life/life-live'

const nav = vi.fn()
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => nav }))
import LifeHero from '@/pages/life/LifeHero'

const NOW = Date.parse('2026-11-03T12:00:00Z')

describe('실시간 한 줄 — C', () => {
  it('① 실제 견적 기록이 있으면 그 사실', () => {
    const r = lifeLiveLine({ latest: { category: 'signage', sigungu: '마포구', quotes: 2, at: '2026-11-03 09:00:00' }, proTotal: 4 }, NOW)
    expect(r).toEqual({ text: '3시간 전 마포구 간판 제작·교체에 견적 2건 도착', fresh: true })
  })
  it('② 없으면 업체 수 · 둘 다 없으면 숨김', () => {
    expect(lifeLiveLine({ latest: null, proTotal: 4 }, NOW)?.text).toBe('지금 업체 4곳이 견적 요청을 기다리고 있어요')
    expect(lifeLiveLine({ latest: null, proTotal: 0 }, NOW)).toBeNull()
    expect(lifeLiveLine(null, NOW)).toBeNull()
  })
  it('모르는 업종·못 읽는 시각이면 지어내지 않고 업체 수로 내려간다', () => {
    expect(lifeLiveLine({ latest: { category: 'nope', sigungu: '마포구', quotes: 1, at: '2026-11-03 11:00:00' }, proTotal: 2 }, NOW)?.fresh).toBe(false)
    expect(lifeLiveLine({ latest: { category: 'signage', sigungu: '마포구', quotes: 1, at: 'x' }, proTotal: 0 }, NOW)).toBeNull()
  })
  it('시각은 D1 의 UTC 문자열로 읽는다(9시간 어긋남 금지)', () => {
    expect(agoLabel('2026-11-03 11:55:00', NOW)).toBe('방금')
    expect(agoLabel('2026-11-03 11:30:00', NOW)).toBe('30분 전')
    expect(agoLabel('2026-11-02 11:00:00', NOW)).toBe('어제')
  })
})

describe('머리 · 업종 고르기 창', () => {
  it('③ 버튼 → 창 → 업종 → 요청서', async () => {
    const { getByText, getByTestId, findByText } = render(
      <MemoryRouter><LifeHero groups={[{ title: '가게 문 열 때', keys: ['signage'] }]} open live={{ latest: null, proTotal: 3 }} /></MemoryRouter>,
    )
    expect(getByTestId('life-live').textContent).toContain('업체 3곳')
    fireEvent.click(getByText('무료로 견적 받기'))
    fireEvent.click(await findByText('간판 제작·교체'))
    expect(nav).toHaveBeenCalledWith('/life/request/signage')
  })
  it('줄이 없으면 그리지 않는다', () => {
    const { queryByTestId } = render(<MemoryRouter><LifeHero groups={[]} open live={null} /></MemoryRouter>)
    expect(queryByTestId('life-live')).toBeNull()
  })
})

describe('④ 서버 — 꺼내는 칸', () => {
  it('lifeLiveActivity 는 시군구·업종·건수·시각만', () => {
    const s = readFileSync('src/features/home-service/api/home-service-db.ts', 'utf8')
    const block = s.slice(s.indexOf('export async function lifeLiveActivity'), s.indexOf('/** 제휴 업체 표'))
    const sel = block.slice(block.indexOf('SELECT r.category'), block.indexOf('FROM home_service_quotes'))
    expect(sel).not.toMatch(/contact|phone|name|details|address/)
    expect(readFileSync('src/features/home-service/api/home-service.routes.ts', 'utf8')).toMatch(/lifeLiveActivity\(c\.env\.DB\)/)
  })
})
