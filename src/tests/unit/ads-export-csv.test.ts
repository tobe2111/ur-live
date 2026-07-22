import { describe, it, expect } from 'vitest'
import { buildFilteredCsv, type CsvLead } from '@/pages/admin/influencer-pool/export-csv'

/**
 * 📤 2026-07-21 필터 전체 CSV 내보내기 순수부 잠금 — 22열·BOM·수식 인젝션 가드.
 */
const lead: CsvLead = {
  platform: 'youtube', name: '=cmd|해커', handle: '@x', url: 'https://youtube.com/@x',
  subscriber_count: 1000, email: 'a@b.com', instagram: null, tiktok: null, links: null,
  category: '맛집', source_keyword: '방배 맛집', status: 'new',
  contact_channel: 'dm', contacted_at: '2026-07-21 01:00:00', follow_up_at: null,
  source: 'inbound', consented_at: null, memo: '메모, 쉼표포함', collected_at: '2026-07-20 10:00:00',
  recent_avg_views: 3400, recent_avg_comments: null, recent_posts_30d: null,
}

describe('buildFilteredCsv', () => {
  it('BOM + 헤더 22열 + 데이터 행', () => {
    const csv = buildFilteredCsv([lead])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0].split(',')).toHaveLength(22)
    expect(lines).toHaveLength(2)
  })
  it('수식 인젝션 가드 — 선행 = 는 작은따옴표로 무력화', () => {
    const csv = buildFilteredCsv([lead])
    expect(csv).toContain("'=cmd|해커")
    expect(csv).not.toMatch(/(^|,)=cmd/m)
  })
  it('쉼표 포함 셀은 따옴표 감싸기 + 채널 한글 라벨 + 성과값 포함', () => {
    const csv = buildFilteredCsv([lead])
    expect(csv).toContain('"메모, 쉼표포함"')
    expect(csv).toContain('인스타DM')
    expect(csv).toContain('3400')
  })
})
