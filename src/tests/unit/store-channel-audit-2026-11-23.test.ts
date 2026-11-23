/**
 * 🧾 매장 수수료 채널 점검 (2026-11-23) — `worker/utils/store-channel-audit.ts`
 * 2026-11-16 에 7곳이 조용히 어긋나 있던 것의 재발 방지. 판정은 순수 함수라 실제 함수를 돌린다.
 * ⚠️ 못 막는 것: 에이전시 연결 기록 없이 데려온 매장 · 실제 정산 요율(결제가 있어야 안다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { channelMismatch, recruiterLabel, storeChannelWarnings, type StoreChannelRow } from '@/worker/utils/store-channel-audit'

const row = (o: Partial<StoreChannelRow>): StoreChannelRow => ({ sellerId: 1, name: '가게', channel: null, agencies: [], brokerUserId: null, liveProducts: 0, ...o })
const OP = { id: 1, name: '유어팀' }
const EXT = { id: 2, name: '뽀야네 하우스' }

describe('채널 어긋남 판정', () => {
  it('① 외부 에이전시가 맡았는데 직접(10%) → 어긋남 (11-16 의 23·24·29)', () => {
    expect(channelMismatch(row({ channel: 'direct', agencies: [EXT] }))).toBe('external_agency_direct')
  })
  it('② 중개(5%)인데 데려온 곳이 없음 → 어긋남 (11-16 의 14)', () => {
    expect(channelMismatch(row({ channel: 'brokered' }))).toBe('brokered_no_recruiter')
  })
  it('③ 판매 중인데 미지정 → 어긋남 · 판매 전 미지정은 조용히', () => {
    expect(channelMismatch(row({ liveProducts: 2 }))).toBe('live_unset')
    expect(channelMismatch(row({}))).toBeNull()
  })
  it('정상: 직접 가입 10% · 유어팀 10% · 외부 에이전시 5% · 중개사 5%', () => {
    expect(channelMismatch(row({ channel: 'direct' }))).toBeNull()
    expect(channelMismatch(row({ channel: 'direct', agencies: [OP] }))).toBeNull()
    expect(channelMismatch(row({ channel: 'brokered', agencies: [EXT] }))).toBeNull()
    expect(channelMismatch(row({ channel: 'brokered', brokerUserId: 35 }))).toBeNull()
  })
  it('유어팀이 일부러 5% 로 고른 매장은 정상(대표 11-16 "내가 하더라도 5%로 하고 싶은 곳은")', () => {
    expect(channelMismatch(row({ channel: 'brokered', agencies: [OP] }))).toBeNull()
    expect(channelMismatch(row({ channel: 'brokered', brokerUserId: 3 }))).toBeNull()
  })
})

describe('사람이 읽는 줄', () => {
  it('데려온 곳 라벨', () => {
    expect(recruiterLabel(row({ agencies: [OP] }))).toBe('유어팀(유어팀 직영)')
    expect(recruiterLabel(row({ agencies: [EXT], brokerUserId: 3 }))).toBe('뽀야네 하우스(에이전시) · 대표 계정')
    expect(recruiterLabel(row({}))).toContain('기록 없음')
  })
  it('어긋난 매장이 없으면 다이제스트에 아무 줄도 안 붙는다 · 있으면 매장 번호와 사유', () => {
    expect(storeChannelWarnings([row({ channel: 'direct' })])).toEqual([])
    const w = storeChannelWarnings([row({ sellerId: 23, name: '김밥', channel: 'direct', agencies: [EXT] }), row({ channel: 'direct' })])
    expect(w[0]).toContain('어긋남 1곳')
    expect(w[1]).toContain('#23 김밥')
  })
})

describe('배선', () => {
  it('아침 다이제스트가 이 점검을 부른다', () => {
    expect(readFileSync('src/worker/cron/ops-daily-digest.ts', 'utf8')).toMatch(/storeChannelWarnings\(await loadStoreChannelRows\(DB\)\)/)
  })
  it('어드민 매장 카드가 데려온 곳과 경고를 그린다', () => {
    expect(readFileSync('src/features/admin/api/admin-store-channel.routes.ts', 'utf8')).toMatch(/\.\.\.\(await recruiterInfo\(c\.env\.DB, sellerId\)\)/)
    const card = readFileSync('src/pages/admin-merchant-commissions/StoreChannelCard.tsx', 'utf8')
    expect(card).toMatch(/data\.channel_warning &&/)
    expect(card).toMatch(/data\.recruited_by &&/)
  })
  it('어드민 에이전시 이름 변경: 역할 가드 + 감사 로그', () => {
    const src = readFileSync('src/features/agency-console/api/agency-admin.routes.ts', 'utf8')
    expect(src).toMatch(/patch\('\/agency-accounts\/:id\/name', requireAdminRole\('super', 'ops'\)/)
    expect(src).toMatch(/action: 'rename_agency_account'/)
  })
})
