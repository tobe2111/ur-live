import { describe, it, expect } from 'vitest'
import { parseDatedLeadList, parseBuyKoreaInquiries } from '@/features/supply/api/buyer-parsers'
import { htmlToText } from '@/features/supply/api/buyer-autofetch'

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

describe('buyer-parsers — 5개 B2B 사이트 상세 HTML (다른 사이트들도 되게끔)', () => {
  // 각 사이트의 상세 표 레이아웃(table td / dl dt·dd / div)을 실제 서버 htmlToText 경유로 파싱.
  const cases: Array<{ site: string; html: string; company: string; country: string }> = [
    { site: 'tradeKorea', country: 'United Arab Emirates', company: 'Beauty World Trading LLC',
      html: '<h1>Buying Offer</h1><table><tr><td>Company Name</td><td>Beauty World Trading LLC</td></tr><tr><td>Country</td><td>United Arab Emirates</td></tr><tr><td>Homepage</td><td>https://beautyworld.ae</td></tr><tr><td>Email</td><td>purchasing@beautyworld.ae</td></tr><tr><td>Quantity Required</td><td>10000 units</td></tr></table>' },
    { site: 'EC21', country: 'Nigeria', company: 'Lagos Import Group',
      html: '<h2>Buy Offer</h2><dl><dt>Buyer</dt><dd>Lagos Import Group</dd><dt>Country / Region</dt><dd>Nigeria</dd><dt>Web Site</dt><dd>www.lagosimport.ng</dd><dt>E-mail</dt><dd>info@lagosimport.ng</dd></dl>' },
    { site: 'ECPlaza', country: 'Brazil', company: 'Sao Paulo Distribuidora',
      html: '<div>Importer: Sao Paulo Distribuidora</div><div>Country: Brazil</div><div>Website: https://spdistrib.com.br</div><div>Email: compras@spdistrib.com.br</div>' },
    { site: 'GoBizKorea', country: 'Vietnam', company: 'Hanoi Trading Co',
      html: '<table><tr><td>Business Name</td><td>Hanoi Trading Co</td></tr><tr><td>Importing Country</td><td>Vietnam</td></tr><tr><td>URL</td><td>hanoitrading.vn</td></tr><tr><td>Contact Email</td><td>import@hanoitrading.vn</td></tr></table>' },
  ]
  for (const c of cases) {
    it(`${c.site}: 회사명·국가·연락처 추출`, () => {
      const leads = parseBuyKoreaInquiries(htmlToText(c.html))
      expect(leads.length).toBeGreaterThanOrEqual(1)
      const l = leads[0]
      expect(l.company).toBe(c.company)
      expect(l.country).toBe(c.country)
      expect(l.email || l.website).toBeTruthy()
    })
  }
})

import { pickBusinessEmail } from '@/features/supply/api/buyer-discovery'
import { discoverContactPaths, addressFromHtml } from '@/features/supply/api/buyer-web-enrich'

describe('buyer-pool — 필요한 정보 전부 추출(이메일·회사·주소·홈페이지)', () => {
  it('상세에서 회사 주소(address) 추출', () => {
    const detail = htmlToText('<table><tr><td>Company Name</td><td>Cairo Beauty Imports</td></tr><tr><td>Country</td><td>Egypt</td></tr><tr><td>Address</td><td>15 Tahrir Square, Cairo, Egypt</td></tr><tr><td>Email</td><td>purchasing@cairobeauty.com</td></tr></table>')
    const l = parseBuyKoreaInquiries(detail)[0]
    expect(l.company).toBe('Cairo Beauty Imports')
    expect(l.address).toMatch(/Tahrir Square/)
    expect(l.email).toBe('purchasing@cairobeauty.com')
  })

  it('이메일 우선순위: 구매담당(purchasing/sales/import) > 일반(info) > 랜덤', () => {
    expect(pickBusinessEmail('hello@x.com info@x.com purchasing@x.com')).toBe('purchasing@x.com')
    expect(pickBusinessEmail('info@acme.com sales@acme.com')).toBe('sales@acme.com')
    expect(pickBusinessEmail('webmaster@a.com imports@a.com')).toBe('imports@a.com')
  })

  it('홈 HTML 에서 실제 연락/소개 링크 발견(추측 경로보다 우선)', () => {
    const home = '<a href="/home">Home</a><a href="/en/contact-us">Contact Us</a><a href="https://facebook.com/x">FB</a><a href="/about-company">회사소개</a>'
    const paths = discoverContactPaths(home, 'https://buyer.example')
    expect(paths).toContain('/en/contact-us')
    expect(paths).toContain('/about-company')
    expect(paths.some(p => p.includes('facebook'))).toBe(false) // 외부 SNS 제외
  })

  it('웹사이트 HTML 에서 회사 주소 추출(<address> / streetAddress / 라벨)', () => {
    expect(addressFromHtml('<address>221B Baker Street, London, UK</address>')).toMatch(/Baker Street/)
    expect(addressFromHtml('{"streetAddress":"5 Rue de Rivoli, Paris"}')).toMatch(/Rivoli/)
    expect(addressFromHtml('<p>Address: 88 Nanjing Road, Shanghai</p>')).toMatch(/Nanjing Road/)
  })
})

import { jsonLdFields } from '@/features/supply/api/buyer-parsers'
import { htmlToText as htmlToText2 } from '@/features/supply/api/buyer-autofetch'

describe('buyer-parsers — JSON-LD 구조화 데이터 우선(더 정확히)', () => {
  it('jsonLdFields: schema.org Organization 필드 추출', () => {
    const f = jsonLdFields('__JSONLD__ {"@type":"Organization","name":"X Co","email":"purchasing@x.com","telephone":"+8210","url":"https://x.com","streetAddress":"1 Main St","addressLocality":"Seoul","addressCountry":"South Korea"} __JSONLD__')
    expect(f.company).toBe('X Co')
    expect(f.email).toBe('purchasing@x.com')
    expect(f.address).toMatch(/Main St/)
    expect(f.country).toBe('South Korea')
  })
  it('라벨 없는 상세라도 JSON-LD 로 회사·이메일·주소 추출', () => {
    const detail = '<h1>Beauty wanted</h1> __JSONLD__ {"@type":"Organization","name":"Nairobi Cosmetics Ltd","email":"import@nairobicos.co.ke","address":{"streetAddress":"12 Kimathi St","addressLocality":"Nairobi","addressCountry":"Kenya"}} __JSONLD__'
    const l = parseBuyKoreaInquiries(htmlToText2(detail))[0]
    expect(l.company).toBe('Nairobi Cosmetics Ltd')
    expect(l.email).toBe('import@nairobicos.co.ke')
    expect(l.address).toMatch(/Kimathi/)
    expect(l.country).toBe('Kenya')
  })
  it('JSON-LD 없으면 무해(빈 객체)', () => {
    expect(Object.keys(jsonLdFields('no structured data here')).length).toBe(0)
  })
})

import { normalizeCompanyKey } from '@/features/supply/api/buyer-discovery'
import { isPublicHttpUrl } from '@/features/supply/api/buyer-autofetch'

describe('buyer-pool — 전수조사 감사 수정 회귀', () => {
  it('H1: 같은 제목·다른 국가 리드가 유실되지 않음(제목+국가 dedup)', () => {
    const list = ['일반상품 전체 3', 'Cosmetics', '베트남', '게시기간 : 2026.07.20~2026.08.19',
      'Cosmetics', '인도', '게시기간 : 2026.07.20~2026.08.19', 'Cosmetics', '미국', '게시기간 : 2026.07.20~2026.08.19'].join('\n')
    expect(parseDatedLeadList(list).length).toBe(3)
  })
  it('M4: JSON-LD 회사명은 Organization 블록에서만(WebPage name 오귀속 방지)', () => {
    expect(jsonLdFields('__JSONLD__ {"@type":"WebPage","name":"Inquiry Detail"} {"@type":"Organization","legalName":"ABC Corp"} __JSONLD__').company).toBe('ABC Corp')
    expect(jsonLdFields('__JSONLD__ {"@type":"WebPage","name":"Home"} __JSONLD__').company).toBeUndefined()
  })
  it('M4: 중첩 addressCountry {name} 추출', () => {
    expect(jsonLdFields('__JSONLD__ {"@type":"Organization","name":"N","addressCountry":{"@type":"Country","name":"Kenya"}} __JSONLD__').country).toBe('Kenya')
  })
  it('M3: US / United States / 미국 이 같은 company_key(중복 방지)', () => {
    expect(normalizeCompanyKey('ABC', 'US')).toBe(normalizeCompanyKey('ABC', 'United States'))
  })
  it('E1: SSRF — 내부/사설 호스트 차단, 공개 호스트 허용', () => {
    for (const u of ['http://127.0.0.1/', 'http://[fd00::1]/', 'http://[::ffff:127.0.0.1]/', 'http://169.254.169.254/', 'http://100.64.0.1/', 'http://foo.localhost/', 'http://2130706433/'])
      expect(isPublicHttpUrl(u)).toBe(false)
    for (const u of ['https://buyer.example.com/', 'http://8.8.8.8/', 'http://[2606:4700::1111]/'])
      expect(isPublicHttpUrl(u)).toBe(true)
  })
})
