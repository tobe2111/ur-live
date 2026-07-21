import { describe, it, expect } from 'vitest'
import { parseDatedLeadList, parseBuyKoreaInquiries } from '@/features/supply/api/buyer-parsers'

/**
 * 🌐 유통스타트 바이어 풀 파서 회귀 테스트 (2026-07-21 전수조사).
 *   실사고 재현 방지: ① 리스트 붙여넣기가 [제목](url) 마크다운을 회사명으로 저장(가비지)
 *   ② 북마클릿 상세 경로(parseBuyKoreaInquiries)가 마스킹 연락처/플랫폼 푸터를 바이어로 오인.
 */
describe('buyer-parsers — 리스트 붙여넣기(parseDatedLeadList)', () => {
  it('마크다운 링크 [제목](url) 는 제목 텍스트만 회사명으로 (URL 가비지 방지)', () => {
    const list = [
      '일반상품 전체 338 100 200',
      '[EMPRESA EN ESPECIFICO Y REGISTRO SANITARIO](https://buykorea.org/seller/ec/inq/inqryDetail.do?inqrySn=295914)',
      '에콰도르',
      '게시기간 : 2026.07.20~2026.08.19',
      '[cosmetics](https://buykorea.org/seller/ec/inq/inqryDetail.do?inqrySn=295642)',
      '중화인민공화국',
      '게시기간 : 2026.07.20~2026.08.19',
    ].join('\n')
    const leads = parseDatedLeadList(list)
    expect(leads.length).toBeGreaterThanOrEqual(2)
    // 회사명에 URL·마크다운 흔적이 절대 없어야 함
    for (const l of leads) {
      expect(l.company).not.toMatch(/https?:\/\/|\]\(|^\[/)
    }
    expect(leads[0].company).toBe('EMPRESA EN ESPECIFICO Y REGISTRO SANITARIO')
    expect(leads[0].country).toBe('Ecuador')
  })

  it('플레인 텍스트(마크다운 없는 실제 Ctrl+A/C)도 동일하게 파싱', () => {
    const list = ['일반상품 전체 10', 'Skincare products', '나이지리아', '게시기간 : 2026.07.17~2026.09.15'].join('\n')
    const leads = parseDatedLeadList(list)
    expect(leads.length).toBe(1)
    expect(leads[0].company).toBe('Skincare products')
    expect(leads[0].country).toBe('Nigeria')
  })
})

describe('buyer-parsers — 상세(parseBuyKoreaInquiries, 북마클릿 경로)', () => {
  const detail = [
    'HOME 인콰이어리 일반상품',
    '기초 화장품',
    'Beauty and Cosmetics Products',
    '회사명 : Zhome Trading Company',
    '국가 : 중화인민공화국',
    '웹사이트 : https://www.zhome-trading.com',
    '이메일 : ke****@****',
    '휴대전화 : +86***',
    '수량 : 5000 pcs',
    '현재 수입국가 : 일본',
    '인콰이어리 상세 : We are looking for Korean skincare and sheet masks for import to China.',
    '메세지0 Favorites0 view12',
    'buykorea@kotra.or.kr',
  ].join('\n')

  it('회사명·국가·웹사이트·수량 추출', () => {
    const leads = parseBuyKoreaInquiries(detail)
    expect(leads.length).toBe(1)
    const l = leads[0]
    expect(l.company).toBe('Zhome Trading Company')
    expect(l.country).toBe('China')
    expect(l.website).toMatch(/zhome-trading\.com/)
    expect(l.est_volume).toMatch(/5000/)
  })

  it('마스킹 이메일(ke****@****)은 저장 안 함', () => {
    const l = parseBuyKoreaInquiries(detail)[0]
    expect(l.email == null || !l.email.includes('*')).toBe(true)
  })

  it('플랫폼 푸터(buykorea@kotra.or.kr)를 바이어 이메일로 오인하지 않음', () => {
    const l = parseBuyKoreaInquiries(detail)[0]
    expect(l.email == null || !/kotra\.or\.kr|buykorea\.org/.test(l.email)).toBe(true)
  })

  it('리스트 페이지 텍스트로는 가비지 리드를 만들지 않음(회사/이메일 없으면 null)', () => {
    const listChrome = ['바이코리아 판매자센터', 'HOME 인콰이어리 카테고리', '전체 338 100 200', 'buykorea@kotra.or.kr'].join('\n')
    const leads = parseBuyKoreaInquiries(listChrome)
    const garbage = leads.filter(l => /바이코리아|판매자센터|kotra/i.test((l.company || '') + (l.email || '')))
    expect(garbage.length).toBe(0)
  })
})
