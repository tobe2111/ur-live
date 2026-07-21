import { describe, it, expect } from 'vitest'
import { b64url, SHEET_HEADER, leadToRow, type SheetLead } from '@/features/marketing/api/sheets-sync'

/**
 * 📊 2026-07-21 인플루언서 풀 → 구글시트 동기화 순수부 잠금.
 *   헤더↔행 정렬이 어긋나면 시트 컬럼이 통째로 밀림 — 길이/순서 불변식.
 */
const lead: SheetLead = {
  id: 7, platform: 'youtube', name: '방배미식가', handle: '@bb', url: 'https://youtube.com/@bb',
  subscriber_count: 12000, recent_avg_views: 3400, recent_avg_comments: 21, recent_posts_30d: null,
  email: 'a@b.com', instagram: 'bb_ig', tiktok: null, category: '맛집',
  source_keyword: '방배 맛집', status: 'new', contact_channel: null, contacted_at: null,
  follow_up_at: null, source: 'inbound', consented_at: '2026-07-21 01:00:00', memo: null, collected_at: '2026-07-20 10:00:00',
}

describe('leadToRow ↔ SHEET_HEADER 정렬', () => {
  it('열 개수 일치(밀림 방지)', () => {
    expect(leadToRow(lead).length).toBe(SHEET_HEADER.length)
  })
  it('핵심 열 위치 고정 — ID/이름/이메일/상태/동의일', () => {
    const row = leadToRow(lead)
    expect(row[SHEET_HEADER.indexOf('ID')]).toBe(7)
    expect(row[SHEET_HEADER.indexOf('이름')]).toBe('방배미식가')
    expect(row[SHEET_HEADER.indexOf('이메일')]).toBe('a@b.com')
    expect(row[SHEET_HEADER.indexOf('상태')]).toBe('new')
    expect(row[SHEET_HEADER.indexOf('동의일')]).toBe('2026-07-21 01:00:00')
  })
  it('null 은 빈 문자열(시트에 "null" 문자 노출 방지)', () => {
    const row = leadToRow(lead)
    expect(row[SHEET_HEADER.indexOf('틱톡')]).toBe('')
    expect(row[SHEET_HEADER.indexOf('메모')]).toBe('')
    expect(row[SHEET_HEADER.indexOf('月포스팅')]).toBe('') // perf 미수집 = 빈칸(0 과 구분)
  })
  it('📈 성과 열 — 평균조회/평균댓글 위치 고정', () => {
    const row = leadToRow(lead)
    expect(row[SHEET_HEADER.indexOf('평균조회수')]).toBe(3400)
    expect(row[SHEET_HEADER.indexOf('평균댓글')]).toBe(21)
  })
})

describe('b64url — JWT 인코딩', () => {
  it('패딩 없음 + URL-safe 문자만', () => {
    const s = b64url('{"alg":"RS256","typ":"JWT"}')
    expect(s).not.toMatch(/[+/=]/)
    expect(atob(s.replace(/-/g, '+').replace(/_/g, '/'))).toBe('{"alg":"RS256","typ":"JWT"}')
  })
  it('바이너리 입력(서명 바이트) 처리', () => {
    expect(b64url(new Uint8Array([0xfb, 0xff, 0x3e]))).toBe('-_8-')
  })
})
