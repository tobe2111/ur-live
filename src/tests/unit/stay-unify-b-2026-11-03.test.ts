/**
 * 📑 숙소 상세 = 이용권 상세의 문법 (2026-11-03 숙소·예약 통일 ②, 대표 허가 — 로딩 잠금 포함)
 *  ① 숙소 상세에 이용권 상세와 **같은 폰 구역 탭 부품**(`DetailSectionTabs`)이 있고, 탭 id 마다 실제 구역이 있다
 *  ② /pass 로 들어온 숙소는 /stays 로 보낸다(꼬리표 그대로)
 * ⚠️ 못 보는 것: 탭이 화면에서 잘 붙는지(그려서 본다) · SSR 첫 화면의 /pass 숙소(클라이언트가 옮긴다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stayTabs } from '@/pages/stay-detail/stay-tabs'

const page = readFileSync('src/pages/StayDetailPage.tsx', 'utf-8')

describe('숙소 상세 구역 탭', () => {
  it('이용권 상세와 같은 부품을 쓴다', () => {
    expect(page).toContain("import DetailSectionTabs from './group-buy/DetailSectionTabs'")
    expect(page).toMatch(/<DetailSectionTabs tabs=\{stayTabs\(/)
  })
  it('모든 탭 id 가 페이지에 실제로 있다', () => {
    for (const t of stayTabs({ intro: true, map: true })) expect(page, t.id).toContain(`id="${t.id}"`)
  })
  it('내용이 없는 구역은 탭에서도 빠진다', () => {
    const ids = stayTabs({ intro: false, map: false }).map((t) => t.id)
    expect(ids).not.toContain('stay-sec-intro')
    expect(ids).not.toContain('stay-sec-map')
  })
})

describe('/pass 로 들어온 숙소', () => {
  it('숙소 상세로 보낸다', () => {
    const gb = readFileSync('src/pages/GroupBuyDetailPage.tsx', 'utf-8')
    expect(gb).toContain("if (detail.category === 'stay_voucher' && !searchParams.get('nostay')) return <Navigate replace to={`/stays/${detail.id}${window.location.search}`} />") // 🩸 ③ 에서 루프 차단 표시 추가
  })
})
