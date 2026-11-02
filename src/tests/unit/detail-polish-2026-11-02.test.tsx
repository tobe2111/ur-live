/**
 * 🧹 이용권 상세 다듬기 넷 (2026-11-02 대표 선택 ①②③④ — *"응 더 개선할 건 없어? 디자인적으로나"*)
 *
 *   ① 매장 칸 테두리 — 지도 부품의 상자·안쪽 이름/주소 줄을 걷는다(`bare`, 이용권 상세만) · 전화·길찾기는 회색 칸
 *   ② 리뷰 없을 때 — 한 줄 안내 · 로그아웃이면 [리뷰 작성하기] 없음(자격은 여전히 누를 때 묻는다 — 2026-09-03)
 *   ③ 팔기 창 — 이미 담은 상품이어도 [담고 링크 복사] 하나가 링크를 복사한다(별도 '링크만 복사' 줄 없음)
 *   ④ '상품 구성' — 제목을 되풀이할 뿐이면 안 그린다(라이브 2919: 제목 `달빛한스푼 닭도리탕` · 설명 `달빛한스푼 이용권`)
 * ⚠️ 못 보는 것: 보기 좋은지(그려서 본다) · 지도 SDK 실제 렌더(라이브).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hasStoreIntro, specOf } from '@/pages/group-buy/StoreIntro'

const addPin = vi.fn()
const info = vi.fn()
vi.mock('@/features/curator/api/curator-api', () => ({ curatorApi: { addPin: (...a: unknown[]) => addPin(...a) } }))
vi.mock('@/hooks/useToast', () => ({ toast: { info: (...a: unknown[]) => info(...a), success: vi.fn(), error: vi.fn() } }))
vi.mock('@/client/stores/auth.store', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { id: 3, handle: 'jiwon' }, isAuthenticated: true }),
}))
import { usePinAction } from '@/features/curator/hooks/usePinAction'

const ROOT = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf-8')

describe('① 매장 칸 테두리', () => {
  const map = read('src/components/RestaurantMiniMap.tsx')
  const page = read('src/pages/GroupBuyDetailPage.tsx')
  it('이용권 상세는 지도를 `bare` 로 그린다 — 숙소 상세는 종전 모양', () => {
    expect(page).toMatch(/<RestaurantMiniMap bare /)
    expect(read('src/pages/StayDetailPage.tsx')).not.toMatch(/<RestaurantMiniMap bare/)
  })
  it('`bare` 면 테두리 상자도 안쪽 이름·주소 줄도 없다(같은 이름이 세 번 나오던 원인)', () => {
    expect(map).toContain("className={bare ? 'relative overflow-hidden' :")
    expect(map).toContain('{!bare && <div className="px-4 py-3')
  })
  it('`bare` 여도 카카오 장소 링크는 지도 위 버튼으로 남는다 — 지도 위는 흰 표면 고정(light-island)', () => {
    expect(map).toMatch(/\{bare && kakaoMapUrl && \(/)
    expect(map).toContain('light-island absolute right-2 top-2')
  })
  it('지도 늦게 받기(잠금)는 그대로다', () => {
    expect(map).toContain('shouldLoadSdk')
    expect(map).toContain('new IntersectionObserver(')
  })
})

describe('② 리뷰 없을 때', () => {
  const src = read('src/pages/product-detail/ProductReviews.tsx')
  it('빈 상태는 한 줄 — 가운데 큰 여백(py-6) 이 아니다', () => {
    expect(src).toContain("'아직 리뷰가 없어요. 이용권을 쓴 분이 첫 리뷰를 남길 수 있어요.'")
    expect(src).not.toContain('py-6 text-center">{t(\'reviews.noReviews\'')
  })
  it('로그아웃이면 작성 버튼(폼)을 안 그린다', () => {
    expect(src).toContain('{getUserIdSync() && <ReviewForm productId={productId}')
  })
})

describe('③ 이미 담은 상품도 링크를 복사한다', () => {
  const pin = read('src/features/curator/hooks/usePinAction.ts')
  it('이미 담은 상품을 다시 누르면 내 유어샵 링크가 클립보드에 들어간다(실제 훅을 돌린다)', async () => {
    const write = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true })
    addPin.mockResolvedValue({ success: false, code: 'ALREADY_PINNED' })
    const { result } = renderHook(() => usePinAction())
    await act(async () => { await result.current.togglePin(2919) })
    expect(write).toHaveBeenCalledWith(`${window.location.origin}/u/jiwon/p/2919`)
    expect(info.mock.calls.at(-1)?.[0]).toContain('링크 복사됨')
  })
  it('ALREADY_PINNED 두 갈래(응답·예외) 모두 링크를 복사한다', () => {
    const resp = pin.slice(pin.indexOf('if (!result.success) {'), pin.indexOf('// 첫 담기'))
    const caught = pin.slice(pin.indexOf('} catch (err) {'), pin.indexOf('} finally {'))
    expect(resp).toContain('await copyShareLink(')
    expect(caught).toContain('await copyShareLink(')
  })
  it("팔기 창에 '링크만 복사' 줄이 없다", () => {
    expect(read('src/components/seeding/SellThisSheet.tsx')).not.toContain('이미 담았다면')
  })
})

describe("④ '상품 구성' 이 제목을 되풀이하면 안 그린다", () => {
  it('라이브 2919 — 설명 `달빛한스푼 이용권` · 제목 `달빛한스푼 닭도리탕` → 숨김', () => {
    expect(specOf('달빛한스푼 이용권', '달빛한스푼 닭도리탕')).toBe('')
    expect(hasStoreIntro({ description: '달빛한스푼 이용권', productName: '달빛한스푼 닭도리탕' })).toBe(false)
  })
  it('실제 구성은 그대로 뜬다(반대 방향)', () => {
    expect(specOf('닭도리탕 (2인) 1개', '달빛한스푼 닭도리탕')).toBe('닭도리탕 (2인) 1개')
    expect(specOf('쌀국수 2 + 분짜 1', '쌀국수 + 분짜 2인 세트')).toBe('쌀국수 2 + 분짜 1')
    expect(specOf('두툼한 삼겹살 500g', '삼겹살 2인')).toBe('두툼한 삼겹살 500g')
  })
  it('글자 그대로 같으면 숨김(종전 조건 유지)', () => {
    expect(specOf('치즈돈가스', '치즈돈가스')).toBe('')
  })
})
