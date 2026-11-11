/**
 * 📐 `/new-openings` 로딩 밀림 (2026-11-10 라이브 실측 CLS 0.75).
 *   응답이 오면 지역 칩 줄(40px)이 끼어들며 목록을 밀고, 로더(작은 칸)가 90장 목록으로 바뀌며 맨 아래 출처 문단이 화면 밖으로 튀었다.
 *   ⇒ 응답 전에도 칩 줄 자리를 잡고, 로더가 한 화면을 차지한다.
 * ⚠️ 못 보는 것: 실제 CLS 수치(라이브로 잰다) · 지역이 0개인 응답(자리가 접힌다 — 드물다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/pages/NewOpeningsPage.tsx', 'utf8')

describe('/new-openings 자리 예약', () => {
  it('응답 전 칩 줄 자리(40px = 칩 36 + pb-1)를 잡는다', () => {
    expect(SRC).toContain('{loading && regions.length === 0 && <div className="mt-5 h-10" aria-hidden="true" />}')
  })
  it('실제 칩 줄의 치수가 예약과 같다(py-2 · 12px · border · pb-1)', () => {
    expect(SRC).toContain('className="mt-5 flex gap-2 overflow-x-auto pb-1"')
    expect(SRC.match(/shrink-0 px-3 py-2 rounded-full text-\[12px\] font-medium border /g)?.length).toBe(2)
  })
  it('로더가 한 화면을 차지한다(출처 문단이 첫 화면에 안 걸린다)', () => {
    expect(SRC).toContain('<div key="loading" className="py-16 min-h-[100dvh] flex justify-center items-start"><BrandLoader /></div>')
  })
  it('로더 칸과 목록 칸은 서로 다른 요소다(key) — 같은 요소로 재사용되면 20px 움직인 것으로 계산된다(라이브 CLS 0.016)', () => {
    expect(SRC).toContain('<div key="loading" className="py-16'); expect(SRC).toContain('<div key="list" className="mt-5 grid')
  })
})
