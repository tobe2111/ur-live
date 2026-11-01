/**
 * 🔔 판매 알림을 마이로 (2026-10-12, 셀러 대시보드 제거 4단계 선행)
 *   판매 알림은 대시보드 껍데기의 종에서만 보였다 — 3단계에서 사장님을 마이로 보내며 그 받은편지함이 사라졌다.
 *
 * 지키는 것:
 *   ① 사람 기준 범위 — 앉을 수 있는 매장(정지 제외)의 알림만 읽고, 읽음 처리도 그 안에서만(남의 매장 id 를 보내도 0건)
 *   ② 소비자 쿠키로 판정하는 경로라 죽은 좌석 토큰 가드에서 빠진다
 *   ③ 알림을 누르면 — 지금 가게의 셀러 화면은 시트로, 다른 가게 알림은 가게를 바꾸라고, 외부 주소는 버린다
 *   ④ 마이 '내 가게' 머리에 배선
 *
 * 이 시험이 **못 보는 것**: 라이브 알림 데이터(배포 뒤 사장님 계정으로 종 숫자가 대시보드 종과 같은지).
 *   에이전시 콘솔은 아직 없다(콘솔은 좌석 없이 사람이 없어 이 경로가 401 — 다음 단계).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { Hono } from 'hono'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { registerStoreNotificationRoutes, scopedStoreIds } from '@/features/seller/api/seller-store-notifications'
import { isStoreSeatGuardSkipped } from '@/worker/utils/store-seat-guard'
import StoreNotifButton, { notifTarget } from '@/pages/user-profile/seller-section/StoreNotifications'
import { stripComments } from '../helpers/source-text'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type DatabaseSync = InstanceType<typeof DatabaseSync>

const apiGet = vi.fn()
const apiPost = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => apiGet(...a), post: (...a: unknown[]) => apiPost(...a) } }))
const toastError = vi.fn()
vi.mock('@/hooks/useToast', () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }))

/** node:sqlite 위의 아주 얇은 D1 흉내 — prepare/bind/all/run 만. */
function d1(db: DatabaseSync) {
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

function setup(stores: { seller_id: number; status: string; name: string }[]) {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE dashboard_notifications (id INTEGER PRIMARY KEY, recipient_type TEXT, recipient_id TEXT, type TEXT,
    title TEXT, message TEXT, link TEXT, is_read INTEGER DEFAULT 0, created_at TEXT)`)
  const ins = db.prepare('INSERT INTO dashboard_notifications (id, recipient_type, recipient_id, type, title, link, is_read, created_at) VALUES (?,?,?,?,?,?,?,?)')
  ins.run(1, 'seller', '401', 'order_paid', '결제 확정', '/seller/orders', 0, '2026-10-12 01:00:00')
  ins.run(2, 'seller', '402', 'order_paid', '결제 확정 B', '/seller/orders', 0, '2026-10-12 02:00:00')
  ins.run(3, 'seller', '999', 'order_paid', '남의 매장', '/seller/orders', 0, '2026-10-12 03:00:00')
  ins.run(4, 'admin', '401', 'x', '어드민 것', null, 0, '2026-10-12 04:00:00')
  ins.run(5, 'seller', '403', 'x', '정지 매장', null, 0, '2026-10-12 05:00:00')
  const app = new Hono<{ Bindings: { DB: unknown } }>()
  registerStoreNotificationRoutes(app as never, async () => ({ userId: 1, stores }))
  const env = { DB: d1(db) }
  return { db, call: (path: string, init?: RequestInit) => app.request(path, init, env) }
}
const STORES = [
  { seller_id: 401, status: 'approved', name: '합정' },
  { seller_id: 402, status: 'pending', name: '연남' },
  { seller_id: 403, status: 'suspended', name: '정지' },
]

describe('① 사람 기준 범위', () => {
  it('앉을 수 있는 매장만(정지 제외)', () => {
    expect(scopedStoreIds({ userId: 1, stores: STORES })).toEqual([401, 402])
    expect(scopedStoreIds(null)).toEqual([])
  })
  it('내 매장들의 판매 알림만 최신순으로 — 남의 매장·어드민 알림·정지 매장은 안 나온다', async () => {
    const { call } = setup(STORES)
    const r = await call('/my-stores/notifications')
    const j = await r.json() as { data: { items: { id: number; storeName: string }[]; unread: number } }
    expect(j.data.items.map((n) => n.id)).toEqual([2, 1])
    expect(j.data.unread).toBe(2)
    expect(j.data.items[0].storeName).toBe('연남')
  })
  it('🔴 읽음 처리도 범위 안에서만 — 남의 매장 알림 id 를 보내도 안 바뀐다', async () => {
    const { db, call } = setup(STORES)
    const r = await call('/my-stores/notifications/read', { method: 'POST', body: JSON.stringify({ ids: [1, 3, 4] }), headers: { 'content-type': 'application/json' } })
    expect((await r.json() as { updated: number }).updated).toBe(1)
    const rows = db.prepare('SELECT id, is_read FROM dashboard_notifications ORDER BY id').all() as { id: number; is_read: number }[]
    expect(rows.find((x) => x.id === 1)?.is_read).toBe(1)
    expect(rows.find((x) => x.id === 3)?.is_read).toBe(0)
    expect(rows.find((x) => x.id === 4)?.is_read).toBe(0)
  })
  it('모두 읽음도 내 매장 것만', async () => {
    const { db, call } = setup(STORES)
    await call('/my-stores/notifications/read', { method: 'POST', body: JSON.stringify({ all: true }), headers: { 'content-type': 'application/json' } })
    const unread = (db.prepare('SELECT id FROM dashboard_notifications WHERE is_read = 0 ORDER BY id').all() as { id: number }[]).map((x) => x.id)
    expect(unread).toEqual([3, 4, 5])
  })
})

describe('② 죽은 좌석 가드에서 빠진다(소비자 쿠키로 판정)', () => {
  it.each(['/api/seller/my-stores/notifications', '/api/seller/my-stores/notifications/read'])('%s', (p) => {
    expect(isStoreSeatGuardSkipped(p)).toBe(true)
  })
})

describe('③ 누르면', () => {
  it('셀러 화면은 시트, 앱 주소는 이동, 외부·없음은 버린다', () => {
    expect(notifTarget('/seller/orders?x=1')).toEqual({ kind: 'sheet', path: '/seller/orders?x=1' })
    expect(notifTarget('/my-orders')).toEqual({ kind: 'go', path: '/my-orders' })
    for (const bad of [null, '', 'https://evil.example', '//evil.example', '/a\\b']) expect(notifTarget(bad)).toBeNull()
  })

  beforeEach(() => {
    apiGet.mockReset(); apiPost.mockReset(); toastError.mockReset()
    apiGet.mockResolvedValue({ data: { data: { unread: 2, items: [
      { id: 1, sellerId: 401, storeName: '합정', type: 'order_paid', title: '결제 확정', message: null, link: '/seller/orders', isRead: false, createdAt: '2026-10-12 01:00:00' },
      { id: 2, sellerId: 402, storeName: '연남', type: 'order_paid', title: '결제 확정 B', message: null, link: '/seller/orders', isRead: false, createdAt: '2026-10-12 02:00:00' },
    ] } } })
    apiPost.mockResolvedValue({ data: { success: true } })
  })
  it('지금 가게 알림은 시트로 열고 읽음 처리한다', async () => {
    const open = vi.fn()
    render(<StoreNotifButton currentSellerId={401} onOpenPage={open} />)
    await waitFor(() => expect(screen.getByText('2')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '판매 알림 2건' }))
    fireEvent.click(await screen.findByText('결제 확정'))
    expect(open).toHaveBeenCalledWith('/seller/orders')
    expect(apiPost).toHaveBeenCalledWith('/api/seller/my-stores/notifications/read', { ids: [1] })
  })
  it('🔴 다른 가게 알림은 지금 좌석으로 열지 않는다(그 화면이 지금 가게 데이터를 보여 준다)', async () => {
    const open = vi.fn()
    render(<StoreNotifButton currentSellerId={401} onOpenPage={open} />)
    fireEvent.click(await screen.findByRole('button', { name: '판매 알림 2건' }))
    fireEvent.click(await screen.findByText('결제 확정 B'))
    expect(open).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalled()
  })
})

describe('④ 배선', () => {
  // 🔁 2026-10-25 재조준(대표 확정 내 가게 안 G) — 머리의 알약 → 판 안의 **목록 줄**(`variant="row"`).
  //   불변식 그대로: 가게를 **알 때만** 진짜 부품을 그린다(기다리는 동안은 같은 높이의 투명 줄).
  it("마이 '내 가게' 판에 판매 알림 줄이 있다 — 가게를 알 때만", () => {
    const src = stripComments(readFileSync('src/pages/user-profile/SellerSection.tsx', 'utf-8'))
    expect(src).toMatch(/\{awaiting \? \([\s\S]{0,300}\) : \(\s*<StoreNotifButton variant="row" currentSellerId=\{store\.seller_id\} onOpenPage=\{\(p\) => \{ void openPage\(p, ''\) \}\} \/>/)
  })
  it('서버 라우트가 사람 기준 범위 함수로 등록된다', () => {
    const src = stripComments(readFileSync('src/features/seller/api/seller-operators.routes.ts', 'utf-8'))
    expect(src).toContain('registerStoreNotificationRoutes(app, resolveStoreScope)')
  })
})
