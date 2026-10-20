import { describe, it, expect } from 'vitest'
import { buildFilteredCsv, type CsvLead } from '@/pages/admin/influencer-pool/export-csv'

/**
 * 📤 2026-07-21 필터 전체 CSV 내보내기 순수부 잠금 — 29열·BOM·수식 인젝션 가드.
 *   2026-07-27 양식 개선: 🏅점수·롱폼중앙값·쇼츠%·마지막글·메일상태·분류근거·브랜드 열 + 한국어 라벨.
 */
const lead: CsvLead = {
  platform: 'youtube', name: '=cmd|해커', handle: '@x', url: 'https://youtube.com/@x',
  subscriber_count: 1000, email: 'a@b.com', instagram: null, tiktok: null, links: null,
  category: '맛집', source_keyword: '방배 맛집', status: 'new',
  contact_channel: 'dm', contacted_at: '2026-07-21 01:00:00', follow_up_at: null,
  source: 'inbound', consented_at: null, memo: '메모, 쉼표포함', collected_at: '2026-07-20 10:00:00',
  recent_avg_views: 3400, recent_avg_comments: null, recent_posts_30d: null,
  lead_score: 72, median_long_views: 2100, shorts_ratio: 40, is_brand: 0,
  email_status: 'bounced', last_post_at: '2026-07-19', category_source: 'content',
}

describe('buildFilteredCsv', () => {
  it('BOM + 헤더 29열 + 데이터 행', () => {
    const csv = buildFilteredCsv([lead])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0].split(',')).toHaveLength(29)
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
  it('🏅 신규 열 — 점수/롱폼중앙값/메일상태·분류근거·상태·출처 한국어 라벨', () => {
    const csv = buildFilteredCsv([lead])
    expect(csv).toContain('72')
    expect(csv).toContain('2100')
    expect(csv).toContain('반송⚠️')     // email_status='bounced' — 발송 안전 경고
    expect(csv).toContain('콘텐츠분석') // category_source='content'
    expect(csv).toContain('신규')       // status='new'
    expect(csv).toContain('신청·동의')  // source='inbound'
  })
  it('분류근거 — category 없으면 빈칸, category_source NULL 은 수집키워드로', () => {
    const noCat = buildFilteredCsv([{ ...lead, name: '무카테', category: null, category_source: null }])
    const line = noCat.slice(1).split('\r\n')[1]
    expect(line).not.toContain('수집키워드,') // 분류근거 열이 빈칸(카테고리 자체가 없음)
    const nullSrc = buildFilteredCsv([{ ...lead, name: '널소스', category_source: null }])
    expect(nullSrc).toContain('수집키워드') // NULL ≈ 초기 키워드 매칭
  })
})
