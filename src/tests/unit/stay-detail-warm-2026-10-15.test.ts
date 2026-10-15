/**
 * 🏨 숙소 상세를 누르기 전에 데운다 (2026-10-15 — 로딩 전수조사).
 * 라이브 실측: `/stays` → `/stays/:id` 가 [풀스크린 로더 ~0.2초 → 상세]. 숙소 상세는 화면 코드·데이터를
 * 누른 뒤에야 받았다. 데운 요청을 상세가 **이어받아야**(같은 요청 공유) 받아 놓고 못 쓰는 일이 없다.
 * ⚠️ 못 보는 것: 실제 프레임 · 숙소 카드(`GroupBuyFeedCard`)의 미리받기 대상(잠금 파일 — 별건).
 * 주입: scripts/mutations/stay-detail-warm-2026-10-15.mjs
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const get = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }))
vi.mock('@/pages/StayDetailPage', () => ({ default: () => null }))

const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))

describe('① 같은 요청을 하나로', () => {
  beforeEach(() => { vi.resetModules(); get.mockReset() })
  it('날아가는 중인 요청을 이어받는다 (두 번 묻지 않는다)', async () => {
    let resolve!: (v: unknown) => void
    get.mockReturnValue(new Promise((r) => { resolve = r }))
    const m = await import('@/pages/stays/stay-detail-warm')
    m.warmStayDetail(7)
    const p = m.stayDetailRequest(7)
    expect(get).toHaveBeenCalledTimes(1)
    resolve({ data: { success: true, data: { product: { id: 7 } } } })
    expect((await p).data?.product).toEqual({ id: 7 })
  })
  it('도착한 값은 첫 렌더가 동기로 쓴다', async () => {
    get.mockResolvedValue({ data: { success: true, data: { product: { id: 8 } } } })
    const m = await import('@/pages/stays/stay-detail-warm')
    expect(m.peekWarmStay(8)).toBeNull()
    await m.stayDetailRequest(8)
    expect(m.peekWarmStay(8)?.data?.product).toEqual({ id: 8 })
  })
  it('실패하면 비워서 다시 묻게 한다', async () => {
    get.mockRejectedValueOnce(new Error('x')).mockResolvedValue({ data: { success: true } })
    const m = await import('@/pages/stays/stay-detail-warm')
    await expect(m.stayDetailRequest(9)).rejects.toThrow()
    await m.stayDetailRequest(9)
    expect(get).toHaveBeenCalledTimes(2)
  })
  it('오래된 값은 쓰지 않는다', async () => {
    get.mockResolvedValue({ data: { success: true, data: { product: { id: 10 } } } })
    const m = await import('@/pages/stays/stay-detail-warm')
    const now = Date.now()
    await m.stayDetailRequest(10)
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now + 61_000)
    expect(m.peekWarmStay(10)).toBeNull()
    spy.mockRestore()
  })
})

describe('② 상세가 데운 값을 쓴다', () => {
  const s = code('src/pages/StayDetailPage.tsx')
  it('첫 렌더 시드에 데운 값 + 정체성 검증', () => {
    expect(s).toMatch(/peekWarmStay\(productId\)/)
    expect(s).toMatch(/w && Number\(w\.id\) === productId \? w : null/)
  })
  it('상세 요청이 같은 함수(공유 요청)를 지난다', () => {
    expect(s).toMatch(/stayDetailRequest\(productId\)/)
    expect(s).not.toMatch(/api\.get\(`\/api\/group-buy\/stays\/\$\{productId\}`\)/)
  })
})

describe('③ 숙소 카드는 숙소 상세를 데운다 (GroupBuyFeedCard — 대표 승인 "허가 — 대상만 수정")', () => {
  const s = code('src/pages/main-home/GroupBuyFeedCard.tsx')
  it('목적지가 /stays 면 숙소 데우기 · 아니면 종전 그대로', () => {
    expect(s).toMatch(/const isStay = \(to \?\? canonicalDetailPath\(p\) \?\? ''\)\.startsWith\('\/stays\/'\)/)
    expect(s).toMatch(/if \(isStay\) warmStay\(id\); else prefetchGb\(id\)/)
    expect(s).toMatch(/const prefetchDetailChunk = isStay \? noopChunk : prefetchPassChunk/)
  })
  it('시점(hover/touch/focus · observer 100px · load 뒤)은 그대로', () => {
    expect(s).toMatch(/onTouchStart=\{\(\) => \{ prefetch\(p\.id\); prefetchDetailChunk\(\) \}\}/)
    expect(s).toMatch(/rootMargin: '100px'/)
    expect(s).toMatch(/return runAfterLoad\(\(\) => \{ prefetch\(p\.id\); prefetchDetailChunk\(\) \}\)/)
  })
})

describe('④ 홈 첫 화면이 숙소 청크를 끌고 오지 않는다', () => {
  it('카드는 데우기 모듈을 동적으로만 부른다', () => {
    const s = code('src/pages/main-home/GroupBuyFeedCard.tsx')
    expect(s).not.toMatch(/^import .*stay-detail-warm/m)
    // 상대 경로 — 화면이 아니라 데우기 모듈이고(화면 코드는 그 안에서 loadRoute 로 받는다), boot-page ⑥ 은 `@/pages/` 직접 import() 를 막는다.
    expect(s).toMatch(/import\('\.\.\/stays\/stay-detail-warm'\)\.then\(\(m\) => m\.warmStayDetail\(id\)\)/)
  })
})
