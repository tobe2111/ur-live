/**
 * 🔐📐 2026-10-18 — 대표 *"이젠 마이페이지 모두 가장 이상적이야??"* 에 답하려고 다섯 경우로 그려 보다 나온 둘.
 *
 * ① **개인 캐시에 주인이 없었다.** `urq:` 캐시(내 이용권·배송지·잔액·쿠폰·알림·예약)는 키에 사람이 없고
 *    지우는 곳도 없었다 — `clearAllUserCache` 는 정의만 있고 호출 0. 같은 폰에서 A 가 로그아웃하고 B 가
 *    들어오면 B 의 첫 화면이 **A 의 데이터로 먼저** 그려졌고, 서버가 실패하면 `cacheOrRethrow` 가 그 값을
 *    계속 돌려줬다. ⇒ `localCache` 가 마지막 주인을 적고, 바뀌면 개인 항목을 **읽기 전에** 지운다.
 *
 * ② **'이용권 현황' 이 첫 방문에 아래를 밀었다.** 캐시가 없는 첫 방문엔 데이터가 아직 없어 바가 `null` 이었고
 *    응답이 오면 생겨나며 '내가 산 것' 목록 전체가 100px 아래로 갔다(`--slow=1500 --shift` 실측, 보이는 줄
 *    13~28개). 밀림 가드의 마이 경로가 `--wallet` 없이 돌아 **이 바가 아예 안 떠서** 못 잡았다.
 *    ⇒ 바는 세 상태(모름·0장·있음) 모두 **같은 숫자 줄**로 높이를 잡고, 보이는 것만 다르다.
 *
 * ⚠️ 이 파일이 못 보는 것: 실제 픽셀 높이(jsdom 에 레이아웃이 없다 — 판정은 `check-layout-shift` 가 한다) ·
 *   서버 쪽 세션이 진짜로 바뀌었는지(여기서는 `user_id` 키로만 사람을 안다).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { readCacheOrNull, writeCache, cleanupExpiredCache } from '@/hooks/queries/localCache'

const ROOT = path.resolve(__dirname, '../../..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

describe('① 개인 캐시에는 주인이 있다', () => {
  beforeEach(() => localStorage.clear())

  it('다른 사람이 로그인하면 이전 사람의 이용권이 첫 렌더에 안 나온다', () => {
    localStorage.setItem('user_id', 'A')
    writeCache('my-vouchers', [{ id: 1, owner: 'A' }])
    expect(readCacheOrNull('my-vouchers')).toEqual([{ id: 1, owner: 'A' }])

    localStorage.setItem('user_id', 'B')
    expect(readCacheOrNull('my-vouchers'), 'B 의 첫 화면이 A 의 이용권으로 그려지면 안 된다').toBeNull()
  })

  it('로그아웃(주인 없음)도 다른 사람으로 친다', () => {
    localStorage.setItem('user_id', 'A')
    writeCache('addresses', [{ zip: '04001' }])
    localStorage.removeItem('user_id')
    expect(readCacheOrNull('addresses')).toBeNull()
  })

  it('같은 사람이면 그대로 남는다 — 0ms 첫 화면은 지킨다', () => {
    localStorage.setItem('user_id', 'A')
    writeCache('balance', 0)
    expect(readCacheOrNull('balance'), '0 도 값이다').toBe(0)
  })

  it('공개 데이터(상품·셀러 공개)는 사람이 바뀌어도 남긴다', () => {
    localStorage.setItem('user_id', 'A')
    writeCache('product:7', { name: 'x' })
    writeCache('my-vouchers', [1])
    localStorage.setItem('user_id', 'B')
    readCacheOrNull('my-vouchers')
    expect(readCacheOrNull('product:7')).toEqual({ name: 'x' })
  })

  it('주인 칸은 30일 청소에 지워지지 않는다(지워지면 다음 읽기가 전부를 버린다)', () => {
    localStorage.setItem('user_id', 'A')
    writeCache('my-vouchers', [1])
    cleanupExpiredCache()
    expect(localStorage.getItem('urq:__owner')).toBe('A')
    expect(readCacheOrNull('my-vouchers')).toEqual([1])
  })

  it('소비자 로그아웃이 개인 캐시를 지운다(남겨 둘 이유가 없다)', () => {
    const src = read('src/utils/auth.ts')
    const fn = src.slice(src.indexOf('export function clearAuthData'), src.indexOf('// 선택적 삭제'))
    expect(fn, '모든 로그아웃 경로가 지나는 clearAuthData(user) 에서 지운다').toMatch(/clearAllUserCache\(\)/)
  })
})

const vouchers = vi.fn()
vi.mock('@/hooks/queries/useMyData', () => ({ useMyVouchers: () => ({ data: vouchers() }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/lib/i18n-lite', () => ({
  useTranslation: () => ({ t: (_k: string, o?: Record<string, unknown>) => String(o?.defaultValue ?? _k) }),
}))
const { default: OrderStatusBar } = await import('@/pages/user-profile/OrderStatusBar')

/** 숫자 줄 — 세 상태가 같은 줄로 높이를 잡는다. */
function numberRow(): HTMLElement {
  return screen.getByText('구매완료').closest('div.flex') as HTMLElement
}

describe('② 이용권 현황은 늘 같은 높이로 선다', () => {
  beforeEach(() => vouchers.mockReset())

  it('아직 모를 때(첫 방문) 자리를 세우되 숫자는 감춘다 — 0 을 적지 않는다', () => {
    vouchers.mockReturnValue(undefined)
    const { container } = render(<OrderStatusBar />)
    expect(container.firstChild, 'null 이면 응답 뒤에 생겨나며 아래 목록을 민다').not.toBeNull()
    expect(numberRow().className).toContain('invisible')
    expect(screen.queryByText('아직 산 이용권이 없어요'), '모르는 것을 0장이라 말하지 않는다').toBeNull()
  })

  it('0장이면 같은 자리에 빈 안내 — 접히면 위로 민다', () => {
    vouchers.mockReturnValue([])
    render(<OrderStatusBar />)
    expect(numberRow().className).toContain('invisible')
    expect(screen.getByText('아직 산 이용권이 없어요')).toBeTruthy()
  })

  it('있으면 숫자가 보이고 빈 안내는 없다', () => {
    vouchers.mockReturnValue([{ source: 'internal', id: 7, status: 'unused', deal_only: 0 }])
    render(<OrderStatusBar />)
    expect(numberRow().className).not.toContain('invisible')
    expect(screen.queryByText('아직 산 이용권이 없어요')).toBeNull()
  })

  it('밀림 가드의 마이 경로가 이용권 시드(--wallet)를 실어 이 바를 실제로 띄운다', () => {
    const src = read('scripts/check-layout-shift.mjs')
    const rows = src.split('\n').filter((l) => l.includes("'--route=/user/profile'"))
    expect(rows.length, '마이 경로가 사라지면 이 바의 밀림을 아무도 안 본다').toBeGreaterThan(0)
    for (const r of rows) expect(r, '시드 없이 돌면 바가 안 떠서 밀릴 것이 없다').toContain("'--wallet'")
  })
})
