/**
 * 🏭 2026-06-12 (영업단 제안): 공급 채널 안내 SSOT 단위 테스트.
 *   순수 모듈(shared/supply-channels) — 공급률 계산·임계값 파싱·채널 판정·nudge 선택.
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SUPPLY_CHANNEL_THRESHOLDS,
  SUPPLY_CHANNELS,
  parseChannelThresholds,
  supplyRatePct,
  evaluateSupplyChannels,
  nextLockedChannel,
} from '../../shared/supply-channels'

describe('supplyRatePct', () => {
  it('공급률 = 공급가/권장가×100, 소수 1자리', () => {
    expect(supplyRatePct(7000, 10000)).toBe(70)
    expect(supplyRatePct(8550, 10000)).toBe(85.5)
    expect(supplyRatePct(1, 3)).toBe(33.3)
  })
  it('무효 입력(0/음수/비숫자/빈값)은 null', () => {
    expect(supplyRatePct(0, 10000)).toBeNull()
    expect(supplyRatePct(1000, 0)).toBeNull()
    expect(supplyRatePct(-5, 100)).toBeNull()
    expect(supplyRatePct('', '10000')).toBeNull()
    expect(supplyRatePct('abc', 10000)).toBeNull()
    expect(supplyRatePct(undefined, null)).toBeNull()
  })
  it('문자열 숫자 입력(폼 state) 허용', () => {
    expect(supplyRatePct('7000', '10000')).toBe(70)
  })
  it('역마진(공급가>권장가)도 rate 는 계산 (UI 가 경고 표시)', () => {
    expect(supplyRatePct(12000, 10000)).toBe(120)
  })
})

describe('parseChannelThresholds', () => {
  it('null/빈값 → 기본값', () => {
    expect(parseChannelThresholds(null)).toEqual(DEFAULT_SUPPLY_CHANNEL_THRESHOLDS)
    expect(parseChannelThresholds(undefined)).toEqual(DEFAULT_SUPPLY_CHANNEL_THRESHOLDS)
    expect(parseChannelThresholds('')).toEqual(DEFAULT_SUPPLY_CHANNEL_THRESHOLDS)
  })
  it('깨진 JSON → 기본값 (throw 금지)', () => {
    expect(parseChannelThresholds('{not json')).toEqual(DEFAULT_SUPPLY_CHANNEL_THRESHOLDS)
  })
  it('부분 저장값은 해당 키만 덮어쓰고 나머지는 기본값', () => {
    const th = parseChannelThresholds('{"closedmall": 65}')
    expect(th.closedmall).toBe(65)
    expect(th.openmarket).toBe(DEFAULT_SUPPLY_CHANNEL_THRESHOLDS.openmarket)
  })
  it('범위 밖(0/101/NaN) 값은 무시하고 기본값 유지', () => {
    const th = parseChannelThresholds('{"openmarket": 0, "groupbuy": 101, "special": "x"}')
    expect(th).toEqual(DEFAULT_SUPPLY_CHANNEL_THRESHOLDS)
  })
})

describe('evaluateSupplyChannels', () => {
  const th = { openmarket: 90, groupbuy: 85, special: 75, closedmall: 70 }

  it('공급률 88% → 오픈마켓만 열림 (proposal: 기본 수준)', () => {
    const evals = evaluateSupplyChannels(88, th, 10000)
    const open = evals.filter(e => e.eligible).map(e => e.key)
    expect(open).toEqual(['openmarket'])
  })
  it('공급률 80% → 오픈마켓+공동구매 (proposal 1단계)', () => {
    const open = evaluateSupplyChannels(80, th, 10000).filter(e => e.eligible).map(e => e.key)
    expect(open).toEqual(['openmarket', 'groupbuy'])
  })
  it('공급률 70% → 4채널 전부 (proposal 2단계 — 낮추면 특판·폐쇄몰까지)', () => {
    const open = evaluateSupplyChannels(70, th, 10000).filter(e => e.eligible).map(e => e.key)
    expect(open).toEqual(['openmarket', 'groupbuy', 'special', 'closedmall'])
  })
  it('임계값 동치(경계)는 제안 가능 (≤)', () => {
    const evals = evaluateSupplyChannels(85, th, 10000)
    expect(evals.find(e => e.key === 'groupbuy')?.eligible).toBe(true)
  })
  it('잠긴 채널의 목표 공급가 = floor(권장가×임계%)', () => {
    const evals = evaluateSupplyChannels(95, th, 9990)
    const closed = evals.find(e => e.key === 'closedmall')!
    expect(closed.maxSupplyPrice).toBe(Math.floor(9990 * 0.7))
  })
  it('채널 순서는 SSOT 정의 순서 보존 (UI 표시 순서)', () => {
    const keys = evaluateSupplyChannels(50, th, 10000).map(e => e.key)
    expect(keys).toEqual(SUPPLY_CHANNELS.map(c => c.key))
  })
})

describe('nextLockedChannel', () => {
  const th = { openmarket: 90, groupbuy: 85, special: 75, closedmall: 70 }

  it('잠긴 채널 중 임계값이 가장 큰(가장 가까운) 채널 반환', () => {
    const evals = evaluateSupplyChannels(80, th, 10000) // special/closedmall 잠김
    expect(nextLockedChannel(evals)?.key).toBe('special')
  })
  it('전부 열려 있으면 null', () => {
    const evals = evaluateSupplyChannels(60, th, 10000)
    expect(nextLockedChannel(evals)).toBeNull()
  })
  it('전부 잠겨 있으면 가장 느슨한 채널(오픈마켓)', () => {
    const evals = evaluateSupplyChannels(99, th, 10000)
    expect(nextLockedChannel(evals)?.key).toBe('openmarket')
  })
})
