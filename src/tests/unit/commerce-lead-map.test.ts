/**
 * 🛒 통신판매 원부 → 리드 매핑 (2026-07-29).
 *
 *   이 레인이 풀의 76%(13만 행)를 만든다 — 여기서 필드를 하나 버리면 13만 건의 정보가 함께 사라진다.
 *   실제로 **이메일이 있으면 도메인을 버리고** 있었다: 원래 의도는 "크롤이 필요 없으면 저장 안 함"이었지만
 *   두 크롤 선정 쿼리 모두 `email IS NULL` 을 요구하므로 도메인 저장은 **크롤 비용 0**이고,
 *   대표는 전화·메일로 직접 접촉하므로 회사 사이트는 그 자체로 값이다.
 */
import { describe, it, expect } from 'vitest'
import { mapCommerceLead } from '@/features/marketing/api/commerce-notify-collect'

const base = { bzmnNm: '테스트상회', rnAddr: '서울특별시 강남구 테헤란로 1', brno: '1234567890' }

describe('mapCommerceLead', () => {
  it('🔒 이메일이 있어도 도메인을 버리지 않는다(정보 무단 폐기 회귀 테스트)', () => {
    const l = mapCommerceLead({ ...base, rprsvEmladr: 'ceo@shop.co.kr', dmnNm: 'shop.co.kr' })
    expect(l.email).toBe('ceo@shop.co.kr')
    expect(l.website).toBe('http://shop.co.kr')
  })

  it('이메일이 없어도 도메인은 그대로 저장(크롤 관문)', () => {
    const l = mapCommerceLead({ ...base, dmnNm: 'https://shop.co.kr' })
    expect(l.email).toBeNull()
    expect(l.website).toBe('https://shop.co.kr')
  })

  it('마스킹된 대표자 이메일은 저장하지 않는다 — 발송 불가한 주소로 숫자를 부풀리지 않는다', () => {
    const l = mapCommerceLead({ ...base, rprsvEmladr: 'dduki0**@naver.com' })
    expect(l.email).toBeNull()
  })

  it('관공서 처리부서 전화는 업체 전화가 아니다 — 허위 연락처 0', () => {
    const l = mapCommerceLead({ ...base, chrgDeptTelno: '02-1234-5678' })
    expect(l.phone).toBeNull()
  })

  it('통신판매는 온라인판매 tier4 — 대행사(tier1) 보강 슬롯을 뺏지 않는다', () => {
    const l = mapCommerceLead({ ...base })
    expect(l.category).toBe('온라인판매')
    expect(l.tier).toBe(4)
  })

  it('이메일이 있을 때만 통신판매 출처로 기록(전화 출처는 보강이 기록)', () => {
    expect(mapCommerceLead({ ...base, rprsvEmladr: 'a@b.co.kr' }).contact_source).toBe('commerce')
    expect(mapCommerceLead({ ...base }).contact_source).toBeNull()
  })

  // 🪦 폐업 — 라이브 표본 2,000건 중 10.2% 가 폐업이었고 그중 35% 는 이메일까지 붙어 접촉 풀에 있었다
  //   (= 문 닫은 가게에 영업메일). 저장은 하되 `closed` 로 접촉 풀에서 뺀다.
  it('등록부가 폐업이라고 하면 closed=true — 접촉 풀에서 뺀다', () => {
    expect(mapCommerceLead({ ...base, operSttusCdNm: '폐업처리', bzmnRgsSttusSeNm: '폐업자' }).closed).toBe(true)
    expect(mapCommerceLead({ ...base, bzmnRgsSttusSeNm: '직권말소' }).closed).toBe(true)
    expect(mapCommerceLead({ ...base, operSttusCdNm: '휴업' }).closed).toBe(true)
  })

  it('정상 영업은 closed 가 서지 않는다(추측으로 죽이지 않는다)', () => {
    expect(mapCommerceLead({ ...base, operSttusCdNm: '정상영업', bzmnRgsSttusSeNm: '계속사업자' }).closed).toBe(false)
    expect(mapCommerceLead({ ...base }).closed).toBe(false) // 상태 필드가 아예 없으면 살아있다고 본다
  })

  it('폐업이어도 **버리지 않는다** — 재개업하면 등록부가 알려주고 되살아나야 한다', () => {
    const l = mapCommerceLead({ ...base, operSttusCdNm: '폐업처리', rprsvEmladr: 'ceo@shop.co.kr' })
    expect(l.closed).toBe(true)
    expect(l.company_name).toBe('테스트상회')
    expect(l.email).toBe('ceo@shop.co.kr')
  })

  // 🕳️ '값 없음'을 문자열로 주는 포털 습성 — 라이브 표본 1,000건 중 **31.7% 가 address="N/A"** 였고
  //   그 전부가 region=null 이었다. 같은 행의 지번주소엔 실제 주소가 있었는데 앞 별칭의 "N/A" 가
  //   truthy 라 뒤 별칭을 건너뛴 것이다. 게다가 카카오 스윕은 `address != ''` 로 걸러 "N/A" 를
  //   통과시켜 **없는 주소로 조회**를 날렸다(실측 47건 시도 0건 발견).
  it('앞 별칭이 "N/A" 면 **뒤 별칭의 진짜 주소**를 쓴다(정보를 버리지 않는다)', () => {
    const l = mapCommerceLead({ bzmnNm: '테스트상회', rnAddr: 'N/A', lctnAddr: '서울특별시 광진구 군자동 367-4' })
    expect(l.address).toBe('서울특별시 광진구 군자동 367-4')
    expect(l.region).toBe('서울') // 주소를 살려야 지역 필터가 산다(pickRegion 은 시도 단위)
  })

  it('모든 별칭이 자리표시자면 주소는 null — "N/A" 를 주소로 저장하지 않는다', () => {
    const l = mapCommerceLead({ bzmnNm: '테스트상회', rnAddr: 'N/A', lctnAddr: '-' })
    expect(l.address).toBeNull()
    expect(l.region).toBeNull()
  })

  it('자리표시자는 사업자번호·대표명에도 적용된다(쓰레기 값 저장 금지)', () => {
    const l = mapCommerceLead({ bzmnNm: '테스트상회', brno: 'N/A', rprsvNm: '없음', lctnAddr: '서울특별시 강남구 역삼동 1' })
    expect(l.business_no).toBeNull()
    expect(l.description || '').not.toContain('없음')
  })
})
