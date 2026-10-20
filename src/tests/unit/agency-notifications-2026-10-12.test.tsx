/**
 * 🔔 에이전시 콘솔 판매 알림 (2026-10-12, 셀러 대시보드 제거 4단계 선행)
 *
 * 지키는 것:
 *   ① 범위 — 우리 에이전시 · 운영 중(active) · 이 직원에게 배정된 매장의 판매 알림만. 읽음도 그 안에서만.
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
        async all() { return { results: db.prepare(sql).all(...(args as never[])) } },
        async run() { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      }
      return st
    },
  }
}

async function serverSetup(scope: 'all' | 'assigned') {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE agency_store_links (id INTEGER PRIMARY KEY, agency_id INTEGER, seller_id INTEGER, status TEXT);
    CREATE TABLE agency_staff (id INTEGER PRIMARY KEY, agency_id INTEGER, role TEXT, store_scope TEXT);
    CREATE TABLE agency_staff_stores (staff_id INTEGER, seller_id INTEGER);
    CREATE TABLE sellers (id INTEGER PRIMARY KEY, business_name TEXT, name TEXT);
    CREATE TABLE dashboard_notifications (id INTEGER PRIMARY KEY, recipient_type TEXT, recipient_id TEXT, type TEXT, title TEXT, message TEXT, link TEXT, is_read INTEGER DEFAULT 0, created_at TEXT);
    INSERT INTO agency_staff VALUES (8, 3, 'staff', '${scope}');
    INSERT INTO agency_store_links VALUES (1, 3, 401, 'active'), (2, 3, 402, 'active'), (3, 3, 403, 'pending'), (4, 9, 404, 'active');
    INSERT INTO agency_staff_stores VALUES (8, 401);
    INSERT INTO sellers VALUES (401, '합정', NULL), (402, '연남', NULL), (403, '성수', NULL), (404, '남의 에이전시', NULL);
    INSERT INTO dashboard_notifications (id, recipient_type, recipient_id, type, title, link, created_at) VALUES
      (1, 'seller', '401', 'x', '합정 알림', '/seller/orders', '2026-10-12 01:00:00'),
      (2, 'seller', '402', 'x', '연남 알림', '/seller/orders', '2026-10-12 02:00:00'),
      (3, 'seller', '403', 'x', '요청 단계', NULL, '2026-10-12 03:00:00'),
      (4, 'seller', '404', 'x', '남의 에이전시', NULL, '2026-10-12 04:00:00');
  `)
  const { registerAgencyNotificationRoutes } = await import('@/features/agency-console/api/agency-store-notifications')
  const app = new Hono()
  registerAgencyNotificationRoutes(app as never)
  const env = { DB: d1(db), JWT_SECRET: 'x' }
  return { db, call: (p: string, init?: RequestInit) => app.request(p, init, env) }
}

describe('① 범위', () => {
  it('전체 매장 직원 — 운영 중인 우리 매장 알림만(요청 단계·남의 에이전시 제외)', async () => {
    const { call } = await serverSetup('all')
    const j = await (await call('/notifications')).json() as { data: { items: { id: number }[]; unread: number } }
    expect(j.data.items.map((n) => n.id)).toEqual([2, 1])
    expect(j.data.unread).toBe(2)
  })
  it('🔴 배정된 매장만 맡은 직원 — 배정 밖 매장 알림은 안 보인다', async () => {
    const { call } = await serverSetup('assigned')
    const j = await (await call('/notifications')).json() as { data: { items: { id: number }[] } }
    expect(j.data.items.map((n) => n.id)).toEqual([1])
  })
  it('읽음 처리도 그 범위 안에서만', async () => {
    const { db, call } = await serverSetup('assigned')
    const r = await call('/notifications/read', { method: 'POST', body: JSON.stringify({ ids: [1, 2, 4] }), headers: { 'content-type': 'application/json' } })
    expect((await r.json() as { updated: number }).updated).toBe(1)
    const unread = (db.prepare('SELECT id FROM dashboard_notifications WHERE is_read = 0 ORDER BY id').all() as { id: number }[]).map((x) => x.id)
    expect(unread).toEqual([2, 3, 4])
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
    { id: 2, sellerId: 402, storeName: '연남', title: '연남 결제 확정', message: null, link: '/seller/orders', isRead: false, createdAt: '2026-10-12 02:00:00' },
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
    fireEvent.click(await screen.findByText('연남 결제 확정'))
    await waitFor(() => expect(screen.getByTestId('tool-sheet').textContent).toBe('/seller/orders'))
    expect(enterAgencyStore).toHaveBeenCalledWith(402, '연남')
    expect(localStorage.getItem('agency_console_store')).toBe('402')
    expect(agencyRequest).toHaveBeenCalledWith('/notifications/read', { method: 'POST', body: { ids: [2] } })
  })
  it('이미 이 직원의 그 매장 좌석이면 다시 받지 않는다', async () => {
    localStorage.setItem('seller_token', jwt({ seller_id: 402, agency_staff_id: 7 }))
    await mount()
    fireEvent.click(await screen.findByText('새 알림 1'))
    fireEvent.click(await screen.findByText('연남 결제 확정'))
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
