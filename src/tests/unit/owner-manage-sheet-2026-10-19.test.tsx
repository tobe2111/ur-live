/**
 * 2026-10-19 — 대표 *"안 A로 해주고, 숙소 및 쇼핑 상품에도 관리하기를 넣자"*.
 *
 * ① 종류 판정 · 숫자 — 서버가 실제 SQLite 에서 센다(판매는 환불 제외, 쇼핑은 결제 확정 주문만, 숙소는 예약+이용권).
 * ② 시트 — 이 상품 하나의 숫자와 줄. 판매 중지는 시트 안에서 한 번 더 묻는다. 모르는 숫자는 '—'(0 위장 금지).
 * ③ 배선 — 세 상세가 같은 훅을 쓰고, 숫자·판매 중지는 **주인 판정 뒤**에만 나온다.
 *
 * ⚠️ 못 보는 것: 라이브 사장님 계정으로 본 실제 숫자 · 판매 중지 뒤 피드에서 실제로 빠지는지(엣지 캐시 퍼지).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequire } from 'module'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readCode } from '../helpers/source-text'

const post = vi.fn(async () => ({ data: { success: true, data: { is_active: false } } }))
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(async () => ({ data: {} })), post: (...a: unknown[]) => post(...(a as [])) } }))
vi.mock('@/hooks/useToast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { ownedKindOf, ownedStats } from '@/features/group-buy/api/owner-viewer.routes'
import OwnerManageSheet, { OWNER_SHEET_COPY } from '@/components/deal/OwnerManageSheet'
import OwnerManagePanel from '@/pages/group-buy/OwnerManagePanel'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

function d1(setup: string) {
  const db = new DatabaseSync(':memory:')
  db.exec(setup)
  return {
    prepare(sql: string) {
      let binds: unknown[] = []
      const st = {
        bind(...b: unknown[]) { binds = b; return st },
        async first() { return db.prepare(sql).get(...(binds as never[])) ?? null },
      }
      return st
    },
  } as unknown as D1Database
}

describe('① 종류와 숫자', () => {
  it('종류: 숙소 / 이용권(카테고리·교환권) / 쇼핑', () => {
    expect(ownedKindOf({ category: 'stay_voucher', deal_only: 0 })).toBe('stay')
    expect(ownedKindOf({ category: 'meal_voucher', deal_only: 0 })).toBe('pass')
    expect(ownedKindOf({ category: 'lifestyle', deal_only: 1 })).toBe('pass')
    expect(ownedKindOf({ category: 'lifestyle', deal_only: 0 })).toBe('product')
  })

  it('이용권: 판매는 환불 제외, 사용은 used 만', async () => {
    const db = d1(`CREATE TABLE vouchers (product_id INTEGER, status TEXT);
      INSERT INTO vouchers VALUES (1,'unused'),(1,'used'),(1,'used'),(1,'refunded'),(2,'used');`)
    expect(await ownedStats(db, 1, 'pass')).toEqual({ sold: 3, used: 2 })
  })

  it('쇼핑: 결제 확정 주문의 수량만 센다(대기·취소 제외), 사용 칸은 없다', async () => {
    const db = d1(`CREATE TABLE orders (id INTEGER, status TEXT); CREATE TABLE order_items (order_id INTEGER, product_id INTEGER, quantity INTEGER);
      INSERT INTO orders VALUES (1,'PAID'),(2,'PENDING'),(3,'CANCELLED'),(4,'DELIVERED');
      INSERT INTO order_items VALUES (1,7,2),(2,7,5),(3,7,9),(4,7,1),(4,8,3);`)
    expect(await ownedStats(db, 7, 'product')).toEqual({ sold: 3, used: null })
  })

  it('숙소: 확정 예약 + 기간 이용권을 더한다', async () => {
    const db = d1(`CREATE TABLE vouchers (product_id INTEGER, status TEXT); CREATE TABLE stay_bookings (product_id INTEGER, status TEXT);
      INSERT INTO vouchers VALUES (5,'used'),(5,'unused');
      INSERT INTO stay_bookings VALUES (5,'confirmed'),(5,'checked_out'),(5,'pending'),(5,'cancelled');`)
    expect(await ownedStats(db, 5, 'stay')).toEqual({ sold: 4, used: 2 })
  })

  it('테이블을 못 읽으면 null — 0 으로 위장하지 않는다', async () => {
    const db = d1('SELECT 1')
    expect(await ownedStats(db, 1, 'pass')).toEqual({ sold: null, used: null })
    expect(await ownedStats(db, 1, 'product')).toEqual({ sold: null, used: null })
  })
})

function renderSheet(kind: 'pass' | 'stay' | 'product', view: Parameters<typeof OwnerManageSheet>[0]['view']) {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}><MemoryRouter>
      <OwnerManageSheet productId={9} kind={kind} view={view} onClose={() => {}} />
    </MemoryRouter></QueryClientProvider>,
  )
}

describe('② 시트', () => {
  beforeEach(() => post.mockClear())

  it('이용권: 판매·사용 두 칸 + 세 줄', () => {
    renderSheet('pass', { is_owner: true, kind: 'pass', is_active: true, stats: { sold: 12, used: 5 } })
    expect(screen.getByTestId('owner-stats').textContent).toContain('12')
    expect(screen.getByTestId('owner-stats').textContent).toContain('5')
    for (const l of ['내용·가격 수정', '판매 현황', '사용 현황']) expect(screen.getByText(l)).toBeTruthy()
  })

  it('쇼핑: 사용 칸·사용 현황 줄이 없다(쇼핑엔 사용 처리가 없다)', () => {
    renderSheet('product', { is_owner: true, kind: 'product', is_active: true, stats: { sold: 3, used: null } })
    expect(screen.queryByText('사용 현황')).toBeNull()
    expect(screen.getByText('주문 현황')).toBeTruthy()
    expect(screen.getByTestId('owner-stats').textContent).not.toContain('사용')
  })

  it('숙소: 객실·가격 수정 · 예약 현황', () => {
    renderSheet('stay', { is_owner: true, kind: 'stay', is_active: true, stats: { sold: 1, used: 0 } })
    expect(screen.getByText('객실·가격 수정')).toBeTruthy()
    expect(screen.getByText('예약 현황')).toBeTruthy()
  })

  it('모르는 숫자는 — 로 그린다', () => {
    renderSheet('pass', { is_owner: true, kind: 'pass', is_active: true, stats: { sold: null, used: null } })
    expect(screen.getByTestId('owner-stats').textContent).toContain('—')
    expect(screen.getByTestId('owner-stats').textContent).not.toMatch(/\d/)
  })

  it('판매 중지는 한 번 더 묻고, 확인해야 서버를 부른다', async () => {
    renderSheet('pass', { is_owner: true, kind: 'pass', is_active: true, stats: { sold: 1, used: 0 } })
    fireEvent.click(screen.getByRole('button', { name: /판매 중지/ }))
    expect(post).not.toHaveBeenCalled()
    expect(screen.getByTestId('owner-stop-confirm')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: '판매 중지' }).at(-1)!)
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/group-buy/viewer/9/active', { active: false }))
  })

  it('멈춘 상품이면 [다시 판매하기] 가 바로 부른다', async () => {
    renderSheet('pass', { is_owner: true, kind: 'pass', is_active: false, stats: { sold: 1, used: 0 } })
    fireEvent.click(screen.getByRole('button', { name: /다시 판매하기/ }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/group-buy/viewer/9/active', { active: true }))
  })

  it('목적지는 존재하는 셀러 주소다', () => {
    const routes = readCode('src/routes/seller.routes.tsx')
    for (const c of Object.values(OWNER_SHEET_COPY)) {
      for (const p of [c.editPath(1), c.salesPath(1), c.usagePath].filter(Boolean) as string[]) {
        const pattern = p.replace(/\/1(\/|$)/, '/:id$1')
        expect(routes, p).toContain(`path="${pattern}"`)
      }
    }
  })
})

describe('③ 패널 문구 · 배선', () => {
  it('종류별 문구', () => {
    const { rerender } = render(<OwnerManagePanel kind="stay" compact onManage={() => {}} />)
    expect(screen.getByText('내 숙소예요')).toBeTruthy()
    expect(screen.getByText('주인은 예약할 수 없어요')).toBeTruthy()
    rerender(<OwnerManagePanel kind="product" compact onManage={() => {}} />)
    expect(screen.getByText('내 가게 상품이에요')).toBeTruthy()
  })

  it('세 상세가 같은 훅을 쓴다', () => {
    expect(readCode('src/pages/GroupBuyDetailPage.tsx')).toMatch(/useOwnerManage\(productId, isLoggedIn, 'pass'\)/)
    const stay = readCode('src/pages/StayDetailPage.tsx')
    expect(stay).toMatch(/useOwnerManage\(productId, [^\n]*'stay'\)/)
    expect(stay).toMatch(/own \? <OwnerManageCard kind="stay"/)
    expect(stay).toMatch(/own \? <OwnerManageBar kind="stay"/)
    // 🛏️ 2026-10-25 E안: 객실 카드의 예약 버튼이 사라지고 카드는 고르기만 한다 — 주인은 고를 수 없게.
    expect(stay).toMatch(/<StayRoomPicker\b[^>]*readOnly=\{own\}/)
    const prod = readCode('src/pages/ProductDetailPage.tsx')
    expect(prod).toMatch(/useOwnerManage\(Number\(id\), isLoggedIn, 'product'\)/)
    expect(prod).toMatch(/own \? <OwnerManageBar kind="product" framed/)
  })

  it('숫자는 주인에게만, 판매 중지는 주인 판정 뒤에만', () => {
    const r = readCode('src/features/group-buy/api/owner-viewer.routes.ts')
    const get = r.slice(r.indexOf("router.get('/viewer/:id'"), r.indexOf("router.post('/viewer/:id/active'"))
    expect(get.indexOf('if (!isOwner || !p)')).toBeGreaterThan(-1)
    expect(get.indexOf('if (!isOwner || !p)')).toBeLessThan(get.indexOf('ownedStats('))
    const act = r.slice(r.indexOf("router.post('/viewer/:id/active'"))
    expect(act).toMatch(/requireAuth\(\)/)
    expect(act.indexOf('isSelfOwnedGroupBuy(')).toBeGreaterThan(-1)
    expect(act.indexOf('isSelfOwnedGroupBuy(')).toBeLessThan(act.indexOf('UPDATE products'))
    expect(act).toMatch(/COALESCE\(status,''\) <> 'DELETED'/)
  })
})

describe('④ 첫 화면 무게 — 시트는 누를 때만, 주인 코드는 남의 봉투에 섞이지 않는다', () => {
  it('상세 훅은 시트를 lazy 로 부른다(정적 import 0)', () => {
    const h = readCode('src/components/deal/useOwnerManage.tsx')
    expect(h).toMatch(/lazy\(\(\) => import\('\.\/OwnerManageSheet'\)\)/)
    expect(h).not.toMatch(/import OwnerManageSheet from/)
  })
  it('시트·주인 코드·목록 부품이 고정 봉투로 간다(묶음기가 안 옮긴다)', () => {
    const v = readCode('vite.config.ts')
    expect(v).toMatch(/OWNER_KIT_MODULES\.some\(\(p\) => id\.includes\(p\)\)\) return 'app-owner-kit'/)
    expect(v).toMatch(/OWNER_UI_MODULES\.some\(\(p\) => id\.includes\(p\)\)\) return 'app-owner-ui'/)
    expect(v).toMatch(/OwnerManageSheet'\)\) return 'app-owner-sheet'/)
    const c = readCode('scripts/surface-chunks.mjs')
    expect(c).toMatch(/LAZY_ENVELOPES = new Set\(\[[^\]]*'app-owner-sheet'/)
    expect(c).toMatch(/LIBRARY_ENVELOPES = new Set\(\[[^\]]*'app-owner-kit', 'app-owner-ui'/)
  })
})

