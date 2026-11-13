/**
 * 🔇 조용히 죽은 계측 감시 · 🧭 유입 종류 구분 (2026-11-13 대표 "계속 개선해 영구적으로")
 *
 * ① '로그인 성공' 이 석 달 0 이었는데 아무도 몰랐다 → 앞 단계가 있는데 다음 단계가 7일 0 이면 매일 아침 다이제스트에 경고.
 * ② 대표 유어샵 방문 250건이 "인플루언서 링크 클릭" 으로 보고됐다 → 유입 기록에 'link' / 'ushop_visit' 를 구분해 남긴다.
 * ⚠️ 못 보는 것: 진짜 0(결제가 정말 없는 주)과 계측 끊김의 구분 — 경고 문구가 둘 다 말하고 사람이 판단한다.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
vi.mock('@/lib/api', () => ({ default: { post: vi.fn(() => Promise.resolve({})) } }))
import api from '@/lib/api'
import { funnelSilenceWarnings } from '@/worker/utils/funnel-silence'
import { storeAffiliateRef } from '@/utils/affiliate-track'

const read = (p: string) => readFileSync(p, 'utf8')
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true }) })

describe('① 조용히 죽은 계측', () => {
  it('석 달 전 그 상태(로그인 벽은 있는데 성공 0)를 잡는다', () => {
    const w = funnelSilenceWarnings({ app_open: 2625, login_wall_shown: 34, login_succeeded: 0 })
    expect(w.some((l) => l.includes("'로그인 성공' 7일 0건"))).toBe(true)
  })
  it('정상이면 조용하다 · 앞 단계가 적으면 판단하지 않는다', () => {
    expect(funnelSilenceWarnings({ app_open: 900, login_wall_shown: 34, login_succeeded: 5, checkout_started: 2, payment_succeeded: 0 })).toEqual([])
  })
  it('앱 열기 자체가 0 이면 기록 전체가 멈춘 것', () => {
    expect(funnelSilenceWarnings({})[0]).toContain('app_open')
  })
  it('매일 아침 다이제스트에 붙는다', () => {
    expect(read('src/worker/cron/ops-daily-digest.ts')).toContain('lines.push(...funnelSilenceWarnings(await loadFunnel7d(DB)))')
  })
})

describe('② 유입 종류', () => {
  it('링크로 들어오면 link, 유어샵을 열면 ushop_visit', () => {
    storeAffiliateRef('777')
    expect(api.post).toHaveBeenCalledWith('/api/acquisition/inflow', expect.objectContaining({ ref: '777', ref_type: 'link' }))
    vi.clearAllMocks(); localStorage.clear()
    storeAffiliateRef('888', 'ushop')
    expect(api.post).toHaveBeenCalledWith('/api/acquisition/inflow', expect.objectContaining({ ref: '888', ref_type: 'ushop_visit' }))
  })
  it('유어샵 화면 두 곳이 ushop 으로 부른다', () => {
    expect(read('src/pages/CuratorPage.tsx')).toContain("storeAffiliateRef(String(cid), 'ushop')")
    expect(read('src/pages/curator-page/pin-nav.ts')).toContain("storeAffiliateRef(String(curatorUserId), 'ushop')")
  })
})
