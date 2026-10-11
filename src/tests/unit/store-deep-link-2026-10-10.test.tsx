/**
 * 🔗 사장님 문자 링크 → 한 번 눌러 그 매장의 그 화면 (2026-10-10 대표 "카카오톡으로 이용권 관리" 1번)
 *
 *  ① 링크 규칙 — 매장 번호·화면 이름뿐(비밀 0) · 모르는 화면은 홈 · 이상한 번호는 매장 미지정
 *  ② 화면 — 좌석에 앉으면 목적 화면으로, 실패하면 막다른 길 대신 마이로
 *  ③ 배선 — 판매·첫 판매·사용 문자와 운영자 알림이 이 링크를 쓴다 · 로그인 필요 라우트 · 크롤 차단
 * ⚠️ 못 보는 것: 실제 카카오 로그인 왕복 · 좌석 발급의 권한 판정(그건 seller-stores 시험이 본다).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { storeGoUrl, storeGoPath, parseStoreGo, STORE_GO_TARGETS } from '@/shared/store-deep-link'

const enter = vi.fn()
vi.mock('@/utils/enter-store', () => ({ enterStoreSeat: (id: number) => enter(id) }))
vi.mock('@/components/SEO', () => ({ default: () => null }))
vi.mock('@/components/brand/BrandLoader', () => ({ default: () => <div>loading</div> }))

describe('① 링크 규칙', () => {
  it('매장 번호와 화면 이름만 담는다', () => {
    const u = new URL(storeGoUrl(26, 'scan'))
    expect(u.origin + u.pathname).toBe('https://urdeal.kr/store/go')
    expect([...u.searchParams.keys()].sort()).toEqual(['s', 'to'])
    expect(storeGoPath(26, 'orders')).toBe('/store/go?s=26&to=orders')
  })
  it('해석 — 모르는 화면은 홈, 이상한 번호는 null', () => {
    expect(parseStoreGo('?s=26&to=scan')).toEqual({ sellerId: 26, path: STORE_GO_TARGETS.scan })
    expect(parseStoreGo('?s=26&to=https://evil.example')).toEqual({ sellerId: 26, path: '/seller' })
    expect(parseStoreGo('?s=-1&to=docs').sellerId).toBeNull()
    expect(storeGoUrl('x', 'home')).toBe('https://urdeal.kr/store/go?to=home')
  })
  it('목적지는 전부 셀러 화면이다(외부·소비자 화면으로 새지 않는다)', () => {
    for (const p of Object.values(STORE_GO_TARGETS)) expect(p).toMatch(/^\/seller(\/|$)/)
  })
})

describe('② 화면', () => {
  beforeEach(() => enter.mockReset())
  const mount = async (q: string) => {
    const { default: StoreGoPage } = await import('@/pages/StoreGoPage')
    render(
      <MemoryRouter initialEntries={[`/store/go${q}`]}>
        <Routes>
          <Route path="/store/go" element={<StoreGoPage />} />
          <Route path="/seller/scan" element={<div>SCAN</div>} />
          <Route path="/user/profile" element={<div>MY</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }
  it('좌석에 앉으면 목적 화면으로', async () => {
    enter.mockResolvedValue(true)
    await mount('?s=26&to=scan')
    await waitFor(() => expect(screen.getByText('SCAN')).toBeTruthy())
    expect(enter).toHaveBeenCalledWith(26)
  })
  it('실패하면 이유를 단정하지 않고 마이로 가는 길을 준다', async () => {
    enter.mockResolvedValue(false)
    await mount('?s=26&to=scan')
    await waitFor(() => expect(screen.getByText('이 매장을 열 수 없어요')).toBeTruthy())
    expect(screen.queryByText('SCAN')).toBeNull()
  })
  it('매장 번호가 없으면 마이로', async () => {
    await mount('?to=scan')
    await waitFor(() => expect(screen.getByText('MY')).toBeTruthy())
    expect(enter).not.toHaveBeenCalled()
  })
})

describe('③ 배선', () => {
  const read = (p: string) => readFileSync(p, 'utf8')
  it('판매·첫 판매 문자가 링크를 쓴다', () => {
    const s = read('src/features/group-buy/api/seller-sale-notify.ts')
    expect(s).toMatch(/statsUrl: storeGoUrl\(sale\.sellerId, 'scan'\)/)
    expect(s).toMatch(/scanUrl: storeGoUrl\(sale\.sellerId, 'scan'\), ordersUrl: storeGoUrl\(sale\.sellerId, 'orders'\)/)
  })
  it('셀프 사용 문자가 링크를 쓴다', () => {
    expect(read('src/features/group-buy/api/group-buy-voucher.routes.ts')).toMatch(/ordersUrl: storeGoUrl\(merchantId, 'orders'\)/)
  })
  it('운영자 승인·반려 알림이 셀러 토큰 없이도 열리는 링크를 쓴다', () => {
    expect(read('src/features/admin/api/admin-sellers/notify-store-operators.ts')).toMatch(/storeGoPath\(sellerId, 'vouchers'\)/)
    expect(read('src/features/admin/api/admin-sellers/seller-decision-notify.ts')).toMatch(/storeGoPath\(sellerId, 'docs'\)/)
  })
  it('로그인 필요 라우트 + 크롤 차단', () => {
    expect(read('src/App.tsx')).toMatch(/path="\/store\/go" element=\{<ProtectedRoute requireUser>/)
    expect(read('public/robots.txt')).toMatch(/^Disallow: \/store\/go$/m)
  })
  it('문자 시각은 한국시간이다(워커는 UTC)', () => {
    const h = read('src/features/group-buy/api/helpers.ts')
    expect(h.match(/toLocaleTimeString\('ko-KR', \{[^}]*\}\)/g)?.every(m => m.includes("timeZone: 'Asia/Seoul'"))).toBe(true)
  })
})
