/**
 * 🔔 에이전시 콘솔 판매 알림 (2026-10-12, 셀러 대시보드 제거 4단계 선행)
 *
 * 지키는 것:
 *   ① 범위 — 우리 에이전시 · 운영 중(active) · 이 직원에게 배정된 매장에서 **우리가 맡은 이용권 판매**만(2026-10-24 — 판매 기록에서 만든다).
 *      읽음은 사람마다(`agency_sales_seen`) — 매장 알림함은 건드리지 않는다.
 *   ② 콘솔에서 알림을 누르면 — 그 매장을 고르고, 이 직원의 좌석이 아니면 **그 클릭에서** 좌석을 받고, 화면을 시트로 연다
 *   ③ 링크 판정은 마이와 공용(`@/lib/notif-target`)
 *
 * 못 보는 것: 실제 에이전시 계정 라이브(E4).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { Hono } from 'hono'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { stripComments } from '../helpers/source-text'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

// ── 서버: 인증 미들웨어는 직원 컨텍스트만 심는다 ──
const staffCtx = { staffId: 8, agencyId: 3, role: 'staff' as 'admin' | 'staff' }
vi.mock('@/features/agency-console/api/agency-session', () => ({
  requireAgencyStaff: () => async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => { c.set('agencyStaff', { ...staffCtx }); await next() },
}))
vi.mock('@/features/agency-console/api/agency-schema', () => ({
  ensureAgencyConsoleTables: async () => {},
  staffStoreAccessSql: (s: string, sellerExpr: string) => `(${s}.role = 'admin' OR COALESCE(${s}.store_scope, 'all') <> 'assigned' OR EXISTS (
    SELECT 1 FROM agency_staff_stores x WHERE x.staff_id = ${s}.id AND x.seller_id = ${sellerExpr}))`,
}))

// ── 화면 ──
const agencyRequest = vi.fn()
const enterAgencyStore = vi.fn()
vi.mock('@/pages/agency-console/agency-api', async (orig) => {
  const real = await orig<typeof import('@/pages/agency-console/agency-api')>()
  return { ...real, agencyRequest: (...a: unknown[]) => agencyRequest(...a), enterAgencyStore: (...a: unknown[]) => enterAgencyStore(...a) }
})
vi.mock('@/pages/user-profile/seller-section/ToolPageSheet', () => ({
  default: ({ path }: { path: string }) => <div data-testid="tool-sheet">{path}</div>,
}))
vi.mock('@/hooks/useToast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

function d1(db: InstanceType<typeof DatabaseSync>) {
  return {
    prepare(sql: string) {
      let args: unknown[] = []
      const st = {
        bind(...a: unknown[]) { args = a; return st },
        async first() { return db.prepare(sql).get(...(args as never[])) ?? null },
        async all() { return { results: db.prepare(sql).all(...(args as never[])) } },
        async run() { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      }
      return st
    },
  }
}

/**
 * 매장 401·402(우리 에이전시 3 운영 중) · 403(요청 단계) · 404(다른 에이전시 9).
 * 이용권 51 = 401 의 우리 것 · 52 = 402 의 우리 것 · 53 = 401 의 사장님 것 · 54 = 404 의 남의 에이전시 것 · 55 = 403(요청 단계)의 우리 것.
 */
async function serverSetup(scope: 'all' | 'assigned') {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE agency_store_links (id INTEGER PRIMARY KEY, agency_id INTEGER, seller_id INTEGER, status TEXT);
    CREATE TABLE agency_staff (id INTEGER PRIMARY KEY, agency_id INTEGER, role TEXT, store_scope TEXT);
    CREATE TABLE agency_staff_stores (staff_id INTEGER, seller_id INTEGER);
    CREATE TABLE sellers (id INTEGER PRIMARY KEY, business_name TEXT, name TEXT);
    CREATE TABLE dashboard_notifications (id INTEGER PRIMARY KEY, recipient_type TEXT, recipient_id TEXT, type TEXT, title TEXT, message TEXT, link TEXT, is_read INTEGER DEFAULT 0, created_at TEXT);
    CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, name TEXT, price INTEGER);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, seller_id INTEGER, status TEXT, created_at TEXT);
    CREATE TABLE vouchers (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, status TEXT DEFAULT 'unused', applied_price INTEGER, is_experience INTEGER DEFAULT 0, used_at TEXT);
    CREATE TABLE agency_product_periods (id INTEGER PRIMARY KEY, product_id INTEGER, seller_id INTEGER, agency_id INTEGER, started_at TEXT, ended_at TEXT);
    CREATE TABLE agency_sales_seen (staff_id INTEGER PRIMARY KEY, seen_at TEXT NOT NULL);
    INSERT INTO agency_staff VALUES (8, 3, 'staff', '${scope}');
    INSERT INTO agency_store_links VALUES (1, 3, 401, 'active'), (2, 3, 402, 'active'), (3, 3, 403, 'pending'), (4, 9, 404, 'active');
    INSERT INTO agency_staff_stores VALUES (8, 401);
    INSERT INTO sellers VALUES (401, '합정', NULL), (402, '연남', NULL), (403, '성수', NULL), (404, '남의 에이전시', NULL);
    INSERT INTO dashboard_notifications (id, recipient_type, recipient_id, type, title, link, created_at) VALUES
      (1, 'seller', '401', 'x', '합정 알림', '/seller/orders', datetime('now'));
    INSERT INTO products VALUES (51, 401, '합정 식사권', 10000), (52, 402, '연남 식사권', 20000), (53, 401, '사장님 식사권', 30000), (54, 404, '남의 식사권', 40000), (55, 403, '성수 식사권', 5000);
    INSERT INTO agency_product_periods (product_id, seller_id, agency_id, started_at) VALUES
      (51, 401, 3, '2026-01-01 00:00:00'), (52, 402, 3, '2026-01-01 00:00:00'), (54, 404, 9, '2026-01-01 00:00:00'),
      (55, 403, 3, '2026-01-01 00:00:00'); -- 요청 단계 매장에도 우리 기간·판매가 있어야 '요청 단계 제외' 가 시험된다
    INSERT INTO orders VALUES (101, 401, 'PAID', datetime('now', '-2 hours')), (102, 402, 'PAID', datetime('now', '-1 hours')),
      (103, 401, 'PAID', datetime('now')), (104, 404, 'PAID', datetime('now')),
      (105, 403, 'PAID', datetime('now', '-30 minutes'));
    INSERT INTO vouchers (id, order_id, product_id, applied_price) VALUES (1, 101, 51, 9000), (2, 101, 51, 9000), (3, 102, 52, 18000), (4, 103, 53, 27000), (5, 104, 54, 36000), (6, 105, 55, 4500);
  `)
  const { registerAgencyNotificationRoutes } = await import('@/features/agency-console/api/agency-store-notifications')
  const app = new Hono()
  registerAgencyNotificationRoutes(app as never)
  const env = { DB: d1(db), JWT_SECRET: 'x' }
  return { db, call: (p: string, init?: RequestInit) => app.request(p, init, env) }
}

type NotifJson = { data: { items: { id: number; sellerId: number; type: string; message: string; isRead: boolean }[]; unread: number } }

describe('① 범위 — 🤝 2026-10-24 판매 기록에서 만든 **우리 이용권 판매**만(사장님·다른 에이전시 판매는 안 섞인다)', () => {
  it('배정된 매장 · 우리가 맡은 이용권 판매만 — 사장님 이용권 · 다른 에이전시 · 요청 단계 매장은 0', async () => {
    const all = await (await (await serverSetup('all')).call('/notifications')).json() as NotifJson
    expect(all.data.items.map((i) => i.id)).toEqual([102, 101]) // 최신순, 103(사장님) · 104(남의 에이전시) · 105(요청 단계 매장) 없음
    expect(all.data.items[1]).toMatchObject({ sellerId: 401, type: 'agency_sale', isRead: false })
    expect(all.data.items[1].message).toBe('합정 식사권 2장 · 18,000원')
    expect(all.data.unread).toBe(2)
    const assigned = await (await (await serverSetup('assigned')).call('/notifications')).json() as NotifJson
    expect(assigned.data.items.map((i) => i.id)).toEqual([101]) // 배정된 401 만
  })
  it('🔴 읽음은 사람마다 따로 — 매장 알림함(사장님 알림)은 그대로다', async () => {
    const { db, call } = await serverSetup('all')
    await call('/notifications/read', { method: 'POST', body: JSON.stringify({ ids: [101] }), headers: { 'content-type': 'application/json' } })
    let j = await (await call('/notifications')).json() as NotifJson
    expect(j.data.items.find((i) => i.id === 101)!.isRead).toBe(true)
    expect(j.data.items.find((i) => i.id === 102)!.isRead).toBe(false) // 더 늦은 판매는 그대로 새 알림
    await call('/notifications/read', { method: 'POST', body: JSON.stringify({ all: true }), headers: { 'content-type': 'application/json' } })
    j = await (await call('/notifications')).json() as NotifJson
    expect(j.data.unread).toBe(0)
    expect((db.prepare('SELECT is_read FROM dashboard_notifications').get() as { is_read: number }).is_read).toBe(0)
  })
  it('🔴 읽음은 앞으로만 간다 — 옛 알림을 나중에 눌러도 이미 읽은 새 알림이 다시 안 읽음이 되지 않는다', async () => {
    const { call } = await serverSetup('all')
    const post = (body: unknown) => call('/notifications/read', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
    await post({ ids: [102] }) // 더 늦은 판매를 먼저 읽고
    await post({ ids: [101] }) // 옛 알림을 나중에 누른다
    const j = await (await call('/notifications')).json() as NotifJson
    expect(j.data.items.find((i) => i.id === 102)!.isRead).toBe(true)
    expect(j.data.unread).toBe(0)
  })
  it('🔴 남의 매장 주문 id 로 "여기까지 봤음" 을 앞당기지 못한다', async () => {
    const { call } = await serverSetup('assigned')
    await call('/notifications/read', { method: 'POST', body: JSON.stringify({ ids: [104] }), headers: { 'content-type': 'application/json' } })
    const j = await (await call('/notifications')).json() as NotifJson
    expect(j.data.unread).toBe(1)
  })
})

describe('② 콘솔에서 누르면', () => {
  const jwt = (claims: Record<string, unknown>) => `x.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.y`
  const STORES = {
    success: true, canManage: false,
    stores: [
      { linkId: 21, sellerId: 401, status: 'active', name: '합정', storeStatus: 'approved', requestedAt: '', acceptedAt: '', today: null },
      { linkId: 22, sellerId: 402, status: 'active', name: '연남', storeStatus: 'approved', requestedAt: '', acceptedAt: '', today: null },
    ],
  }
  const NOTIFS = { success: true, data: { unread: 1, items: [
    // 🤝 2026-10-24 — 에이전시가 여는 화면은 이용권뿐이라 알림 링크도 그쪽으로(매장 전체 화면 주소는 판이 무시한다).
    { id: 2, sellerId: 402, storeName: '연남', title: '연남 이용권 판매', message: null, link: '/seller/group-buy', isRead: false, createdAt: '2026-10-12 02:00:00' },
  ] } }
  beforeEach(() => {
    localStorage.clear()
    Object.assign(window.location, { pathname: '/agency', search: '' })
    agencyRequest.mockReset(); enterAgencyStore.mockReset()
    agencyRequest.mockImplementation(async (path: string) => ({
      ok: true, status: 200, data: path.startsWith('/notifications?') ? NOTIFS : path.startsWith('/notifications/read') ? { success: true } : STORES,
    }))
    enterAgencyStore.mockImplementation(async (sellerId: number) => {
      localStorage.setItem('seller_token', jwt({ seller_id: sellerId, agency_staff_id: 7 }))
      return { ok: true }
    })
  })
  async function mount() {
    const { AgencyStoresPanel } = await import('@/pages/agency-console/AgencyStoresPanel')
    render(<AgencyStoresPanel onExpired={() => {}} staffId={7} />)
  }
  it('좌석이 없으면 그 클릭에서 받고, 그 매장을 고르고, 화면을 시트로 연다', async () => {
    await mount()
    fireEvent.click(await screen.findByText('새 알림 1'))
    fireEvent.click(await screen.findByText('연남 이용권 판매'))
    await waitFor(() => expect(screen.getByTestId('tool-sheet').textContent).toBe('/seller/group-buy'))
    expect(enterAgencyStore).toHaveBeenCalledWith(402, '연남')
    expect(localStorage.getItem('agency_console_store')).toBe('402')
    expect(agencyRequest).toHaveBeenCalledWith('/notifications/read', { method: 'POST', body: { ids: [2] } })
  })
  it('이미 이 직원의 그 매장 좌석이면 다시 받지 않는다', async () => {
    localStorage.setItem('seller_token', jwt({ seller_id: 402, agency_staff_id: 7 }))
    await mount()
    fireEvent.click(await screen.findByText('새 알림 1'))
    fireEvent.click(await screen.findByText('연남 이용권 판매'))
    await waitFor(() => expect(screen.getByTestId('tool-sheet')).toBeTruthy())
    expect(enterAgencyStore).not.toHaveBeenCalled()
  })
  it('콘솔을 여는 것만으로는 좌석을 받지 않는다', async () => {
    await mount()
    await screen.findByText('새 알림 1')
    expect(enterAgencyStore).not.toHaveBeenCalled()
    // 줄 이름도 본다 — 숫자만 누르면 줄이 '판매 알림' 인지 아무도 확인하지 않는다(주입이 잡았다).
    expect(screen.getByText('판매 알림')).toBeTruthy()
  })
})

describe('③ 공용 판정', () => {
  it('마이와 콘솔이 같은 링크 판정을 쓴다', () => {
    expect(stripComments(readFileSync('src/pages/agency-console/AgencyStoresPanel.tsx', 'utf-8'))).toContain("import { notifTarget } from '@/lib/notif-target'")
    expect(stripComments(readFileSync('src/pages/user-profile/seller-section/StoreNotifications.tsx', 'utf-8'))).toContain("import { notifTarget } from '@/lib/notif-target'")
  })
  it('서버 라우트가 콘솔 API 에 등록된다', () => {
    expect(stripComments(readFileSync('src/features/agency-console/api/agency-stores.routes.ts', 'utf-8'))).toContain('registerAgencyNotificationRoutes(agencyStoresRoutes)')
  })
})
