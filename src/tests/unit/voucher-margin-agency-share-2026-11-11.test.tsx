/**
 * 🧮 마진 계산기 — 에이전시 몫 줄 (2026-11-11 대표 *"2번 계산기 보강"*)
 *
 * 지키는 것:
 *  ① 산술 — 정가 − 할인 − 유어딜 수수료 − 인플루언서 수수료 − 에이전시 몫 = 최종 마진(판매가 기준).
 *  ② 서버가 준 `agency_shares` 가 있으면 줄이 생기고, 없으면 종전 화면 그대로(줄 없음).
 *  ③ 여러 에이전시면 가장 큰 % 로 보인다(보수적 — 마진을 부풀려 보이지 않게).
 *  ④ 서버는 지금 맡은(active) 에이전시만, % 가 0 이면 안 돌려준다 — 실제 SQLite 로.
 *  ⑤ 화면 이름은 "에이전시 운영"(옛 "중개 운영" 아님).
 *
 * ⚠️ 못 보는 것: 실제 정산(표시 전용 카드 — 정산은 판매 시각의 % 를 따로 읽는다) · 화면이 보기 좋은지.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { render, screen, cleanup } from '@testing-library/react'

const get = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }))

import NetProceedsCard from '@/pages/seller-meal-voucher/NetProceedsCard'
import { voucherMargin } from '@/shared/voucher-margin'

beforeEach(() => { cleanup(); get.mockReset() })

const feeCtx = (agency_shares?: Array<{ name: string; pct: number }>) =>
  get.mockResolvedValue({ data: { success: true, data: { channel: 'brokered', platform_fee_pct: 5, channel_rates_active: false, agency_shares } } })

describe('① 산술', () => {
  it('판매가 10,000 · 유어딜 5% · 인플 10% · 에이전시 3% → 8,200원', () => {
    expect(voucherMargin({ price: 10000, platformFeePct: 5, influencerPct: 10, agencyPct: 3 }))
      .toMatchObject({ platformCut: 500, influencerCut: 1000, agencyCut: 300, net: 8200 })
  })
  it('에이전시 % 를 안 주면 종전 계산과 같다', () => {
    expect(voucherMargin({ price: 10000, platformFeePct: 5, influencerPct: 0 })).toMatchObject({ agencyCut: 0, net: 9500 })
  })
})

describe('② ③ ⑤ 화면', () => {
  it('에이전시 하나 — 이름과 % 로 줄을 보이고 마진에서 뺀다', async () => {
    feeCtx([{ name: '리스터코퍼레이션', pct: 3 }])
    render(<NetProceedsCard price={10000} />)
    await screen.findByText('마진 계산기')
    expect(screen.getByText(/에이전시 몫 \(3% · 리스터코퍼레이션\)/)).toBeTruthy()
    expect(screen.getByText('−300원')).toBeTruthy()
    expect(screen.getByText(/^9,200원/)).toBeTruthy()
    expect(screen.getByText(/에이전시 운영/)).toBeTruthy()
  })
  it('에이전시가 없으면 줄도 안내도 없다', async () => {
    feeCtx([])
    render(<NetProceedsCard price={10000} />)
    await screen.findByText('마진 계산기')
    expect(screen.queryByText(/에이전시 몫/)).toBeNull()
    expect(screen.getByText(/^9,500원/)).toBeTruthy()
  })
  it('여러 에이전시면 가장 큰 % 로 보인다', async () => {
    feeCtx([{ name: 'A', pct: 2 }, { name: 'B', pct: 7 }])
    render(<NetProceedsCard price={10000} />)
    await screen.findByText('마진 계산기')
    expect(screen.getByText(/에이전시 몫 \(최대 7%\)/)).toBeTruthy()
    expect(screen.getByText(/^8,800원/)).toBeTruthy()
  })
})

describe('④ 서버', () => {
  it('fee-context 가 agency_shares 를 돌려준다', () => {
    expect(readFileSync('src/features/seller/api/seller-stores.routes.ts', 'utf8'))
      .toMatch(/agency_shares: await activeAgencySharesForStore\(c\.env\.DB, sellerId\)/)
  })
  it('지금 맡은 에이전시만, % 0 은 빼고 돌려준다 (실제 SQLite)', async () => {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE agency_accounts (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE agency_store_links (id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER, seller_id INTEGER, status TEXT);
      CREATE TABLE agency_share_terms (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER, agency_id INTEGER, pct REAL, effective_from TEXT, set_by_user_id INTEGER);
      INSERT INTO agency_accounts VALUES (1,'가'),(2,'나'),(3,'다'),(4,'라');
      INSERT INTO agency_store_links (agency_id, seller_id, status) VALUES (1,20,'active'),(2,20,'ended'),(3,20,'active'),(4,20,'active');
      INSERT INTO agency_share_terms (seller_id, agency_id, pct, effective_from) VALUES
        (20,1,2,'2026-01-01'),(20,1,4,'2026-02-01'),(20,2,9,'2026-01-01'),(20,3,0,'2026-01-01');`)
    const D1 = {
      prepare: (sql: string) => ({
        bind: (...a: unknown[]) => ({
          all: async () => ({ results: db.prepare(sql).all(...(a as never[])) }),
        }),
      }),
    } as unknown as D1Database
    const { activeAgencySharesForStore } = await import('@/features/agency-console/api/agency-share')
    // 가: 최신 % 4 · 나: 끝남 · 다: 0% · 라: % 미설정 → 가 하나만
    expect(await activeAgencySharesForStore(D1, 20)).toEqual([{ name: '가', pct: 4 }])
  })
})
