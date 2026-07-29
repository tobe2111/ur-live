/**
 * 🏛 기관(org) 선판정 — 영업 파이프라인 오염 방지 (2026-07-28).
 *
 *   실사고: 라이브 표본에서 `동대문문화재단`·`서울옥외광고협회 중랑구지부` 가 **'대행사 tier1'**
 *   (실제로 콜드 접촉할 풀)에 들어가 있었다. BIZ_RULES(업종 어휘)를 ORG_WORD 보다 먼저 돌린 탓에,
 *   "행사 대행" 을 하는 재단이 파트너로 분류됐다. **기관은 무엇을 하든 기관이다.**
 *   ⚠️ 동시에, 모호한 어휘로 정상 업체를 기관으로 만들면 안 된다(`○○전기공사`).
 */
import { describe, it, expect } from 'vitest'
import { classifyLead } from '@/features/marketing/api/company-classify'

const cl = (name: string, desc = '') =>
  classifyLead({ company_name: name, description: desc } as Parameters<typeof classifyLead>[0])

describe('기관 선판정', () => {
  it('🔒 행사를 하는 재단은 파트너가 아니라 기관 (실제 오분류 사례)', () => {
    const r = cl('동대문문화재단', '[동대문구 맥주축제] 행사 운영 대행 용역 제안서 평가위원 모집 공고')
    expect(r.lead_type).toBe('org')
  })

  it('🔒 광고 협회 지부도 기관 (실제 오분류 사례)', () => {
    expect(cl('서울옥외광고협회 중랑구지부', '옥외광고').lead_type).toBe('org')
  })

  it('관공서·공공기관은 기관', () => {
    for (const n of ['중랑구청', '서울시청', '동대문 주민센터', '경기도교육청', '강남구 보건소', '○○진흥원']) {
      expect(cl(n, '홍보 대행').lead_type, n).toBe('org')
    }
  })

  it('🔒 모호한 어휘로 정상 업체를 기관으로 만들지 않는다', () => {
    // '공사'·'공단' 은 선판정에서 일부러 제외했다 — 전기공사·설비공사 같은 실제 업체가 있다.
    expect(cl('대한전기공사', '간판 제작 및 전기공사').lead_type).not.toBe('org')
    expect(cl('한빛종합광고', '광고기획').lead_type).not.toBe('org')
  })

  it('일반 대행사는 그대로 파트너', () => {
    const r = cl('신한종합기획', '종합광고기획')
    expect(r.lead_type).toBe('partner')
  })
})
