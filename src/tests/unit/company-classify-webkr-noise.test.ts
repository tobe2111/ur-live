/**
 * 🏛 공공기관·잘린 제목이 '대행사 tier1'(콜드 접촉 풀) 최상단에 앉던 것 — 2026-08-08 대표 신고.
 *
 *   신고 원문: *"B2B에서 나라장터 담당자도 섞여있음. `jeejeehea@naver.com` 은 전라남도중소기업일자리경제진흥원임."*
 *   ⚠️ **경로는 나라장터가 아니었다.** 실측하니 `source='webkr'`(네이버 웹문서 검색)였고, `nara` 소스는
 *   전체 30건뿐이라 애초에 이 규모가 나올 수 없었다. 인계가 지목한 레인을 그대로 고쳤으면 헛수고였다.
 *
 *   실제 사슬은 세 겹이었다(라이브 행 그대로):
 *   ```
 *     company_name  "[광주"      ← 제목을 '-' 로 자르다 괄호 안에서 끊김
 *     description   "…온라인 마케팅 활성화…"   ← 진흥원 보도자료 **본문**
 *     → BIZ_RULES 가 본문에서 매칭 → 대행사 tier1 · confidence='evidence'
 *     → evidence 는 이름 치유(Phase 3) 대상에서 제외 → 잘린 이름까지 **영구히 굳는다**
 *   ```
 *   에러가 안 나고 조용히 틀린 채 남는, 이 레포의 단골 실패 모양이다.
 */
import { describe, it, expect } from 'vitest'
import { classifyLead, suspectCompanyName, unbalancedBracket, CLASSIFY_RULES_VERSION } from '@/features/marketing/api/company-classify'

type Input = Parameters<typeof classifyLead>[0]
const cl = (i: Input) => classifyLead(i)

describe('webkr 오염 — 대표 신고 실제 행', () => {
  it('🔒 진흥원 보도자료가 대행사 파트너로 들어오지 않는다 (신고된 그 행)', () => {
    const r = cl({
      company_name: '[광주', source: 'webkr', source_keyword: '광주 동구 소상공인 마케팅',
      website: 'https://www.jepa.kr', category: '대행사', subcategory: '마케팅대행', tier: 1,
      description: '<신일인쇄> 가업 승계 2대째 인쇄업 운영 온라인 마케팅 활성화 매출 증대 성과',
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('TRUNCATED_TITLE')
  })

  it('🔒 잘린 제목 파편 — 여는 괄호가 안 닫히면 상호가 아니다', () => {
    for (const n of ['[광주', '「2025년 제1회 부산진구', '「1', '광주] 신일인쇄']) {
      expect(cl({ company_name: n, source: 'webkr' }).ok, n).toBe(false)
    }
  })

  /**
   * 🩸 이 테스트가 없었으면 **정부 등록부의 실제 업체 56건을 지울 뻔했다.**
   * 라이브에서 괄호 불균형을 전 소스로 재면 `주)다산케인엔케이통상` 류가 잡힌다 — 통신판매 등록부가
   * 앞 `(` 를 흘린 표기지 우리가 자른 파편이 아니다. 그리고 commerce 는 **제안 가능 리드의 95.7%** 다.
   * ⇒ 잘린-제목 규칙은 우리가 직접 제목을 자르는 `webkr` 에만 적용된다.
   */
  it('🔒 등록부의 괄호 흘린 표기는 지우지 않는다 (전 소스 적용 시 56건 삭제)', () => {
    for (const n of ['주)다산케인엔케이통상', '유)엠페이', '재)원불교서울교구설매재자연휴양림', '코더랩스(CorderLabs']) {
      expect(cl({ company_name: n, source: 'commerce', category: '유통' }).ok, n).toBe(true)
    }
  })

  it('🔒 or.kr 은 이름을 못 믿어도 기관 — 등록 요건상 비영리 전용', () => {
    // 상공회의소가 `「2025년 제1회 부산진구` 라는 잘린 이름으로 들어와 있었다. 호스트는 잘리지 않는다.
    const r = cl({ company_name: '부산진구상의', source: 'local', website: 'https://www.bcci.or.kr', description: '행사 대행 홍보 기획' })
    expect(r.lead_type).toBe('org')
  })

  it('🔒 본문에서만 맞은 업종은 근거가 아니다 (webkr) — 확인 카드로 보낸다', () => {
    const r = cl({
      company_name: '자동차', source: 'webkr', website: 'https://weccess.com',
      category: '대행사', subcategory: '마케팅대행', tier: 1,
      description: '중소상공인 온라인 마케팅 지원 사업 안내',
    })
    expect(r.lead_type).not.toBe('partner')
    expect(r.confidence).not.toBe('evidence')
  })

  it('이름에서 맞으면 webkr 도 그대로 파트너 — 규칙이 레인을 죽이지 않는다', () => {
    const r = cl({ company_name: '남부종합광고기획', source: 'webkr', website: 'https://nambu-ad.co.kr', description: '지역 광고' })
    expect(r.lead_type).toBe('partner')
    expect(r.confidence).toBe('evidence')
  })

  /** ⚠️ local(지도)의 description 은 지도 API 의 **업종 문자열**이라 진짜 근거다 — 5,932건이 여기 걸려 있다. */
  it('🔒 지도(local) 설명은 여전히 근거로 인정한다 (5,932건 강등 방지)', () => {
    const r = cl({ company_name: '한빛기획', source: 'local', description: '광고대행업' })
    expect(r.lead_type).toBe('partner')
    expect(r.confidence).toBe('evidence')
  })

  it('이름 치유 대상으로도 잡힌다 (잘린 파편은 og:site_name 으로 교체)', () => {
    expect(suspectCompanyName('[광주', '광주 동구 소상공인 마케팅')).toBe(true)
    expect(suspectCompanyName('애드업', '마케팅')).toBe(false)
  })

  it('괄호 균형 판정 자체', () => {
    expect(unbalancedBracket('[광주')).toBe(true)
    expect(unbalancedBracket('(주)우성무역')).toBe(false)
    expect(unbalancedBracket('[대덕장복PICK!] 5탄(feat.광고)')).toBe(false)
  })

  /**
   * 🔴 규칙을 바꿨으면 이 상수를 올려야 **기존 풀이 소급 재검사된다.** 재검사 쿼리
   * (`classified_v < CLASSIFY_RULES_VERSION`)에 시간 폴백이 없어, 안 올리면 잘못 찍힌 행이 영구히 굳는다
   * — 2026-07-27 에 "인천교통공사…특강" 류가 정확히 그렇게 영구 제외됐다.
   */
  it('🔒 이번 규칙 변경분이 소급되도록 버전이 올라가 있다', () => {
    expect(CLASSIFY_RULES_VERSION).toBeGreaterThanOrEqual(6)
  })
})
