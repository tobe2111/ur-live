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

  // 🔑 로그인 판매자 본인 크롬 이메일 오수집 방지 — buyKorea 는 바이어 연락처를 마스킹(mu*****)하므로
  //   페이지의 언마스킹 이메일(hongseungkyun@naver.com)은 헤더/마이페이지의 *본인* 이메일이다.
  const realDetail = [
    '바이코리아 | 판매자센터',            // 사이트 크롬(회사명 오인 금지)
    'hongseungkyun@naver.com',           // 로그인 판매자 본인 이메일(헤더 크롬)
    'HOME 인콰이어리 일반상품',
    '인콰이어리 번호 : inq260426-000011',
    '이름 → Mr*****',
    '이메일 → mu*****',
    '회사명 → Al Dayagem for Trading agencies',
    '국가/도시 → JORDAN',
    '웹사이트 → https://www.power-bob.com',
    '메세지0 Favorites0 view7',
  ].join('\n')

  it('마스킹 바이어 상세: 회사명은 라벨값, 사이트 크롬("판매자센터")은 회사명 아님', () => {
    const leads = parseBuyKoreaInquiries(realDetail)
    expect(leads.length).toBe(1)
    const l = leads[0]
    expect(l.company).toBe('Al Dayagem for Trading agencies')
    expect(/바이코리아|판매자센터/.test(l.company)).toBe(false)
    expect(l.country).toBe('JORDAN')
    expect(l.website).toMatch(/power-bob\.com/)
  })

  it('로그인 판매자 본인 이메일(hongseungkyun@naver.com)을 바이어로 저장하지 않음', () => {
    const l = parseBuyKoreaInquiries(realDetail)[0]
    expect(l.email == null || !/hongseungkyun|@naver\.com/i.test(l.email)).toBe(true)
  })

  it('크롬만(바이어 없음)인 상세 조각은 리드로 저장하지 않음', () => {
    const chromeOnly = ['바이코리아 | 판매자센터', 'hongseungkyun@naver.com', 'my page', 'view', '가공식품'].join('\n')
    const leads = parseBuyKoreaInquiries(chromeOnly)
    const garbage = leads.filter(l => /바이코리아|판매자센터|hongseungkyun|가공식품/i.test((l.company || '') + (l.email || '')))
    expect(garbage.length).toBe(0)
  })

  // ④ 연락처 재현율 — 마스킹 없는 상세에서 본문 이메일이 웹사이트 도메인과 일치하면 확정, 아니면 '확인필요' 후보로만.
  it('본문 이메일이 웹사이트 도메인과 일치하면 확정', () => {
    const corr = ['회사명 : Global Traders Inc', '국가 : Germany', '웹사이트 : https://globaltraders.de', '문의하기 sales@globaltraders.de 로 연락'].join('\n')
    expect(parseBuyKoreaInquiries(corr)[0].email).toBe('sales@globaltraders.de')
  })
  it('도메인 불일치 이메일은 확정 안 하고 설명에 "후보이메일(확인필요)"로 보전', () => {
    const nc = ['회사명 : Foo Trading Ltd', '국가 : Germany', '웹사이트 : https://footrading.de', '연락 buyer.foo@gmail.com 으로'].join('\n')
    const l = parseBuyKoreaInquiries(nc)[0]
    expect(l.email).toBeNull()
    expect(l.description).toMatch(/후보이메일.*buyer\.foo@gmail\.com/)
  })
  it('마스킹 상세(buyKorea)는 크롬 이메일을 후보로도 새지 않음', () => {
    const mk = ['바이코리아 | 판매자센터', 'hongseungkyun@naver.com', '회사명 → Al Dayagem', '국가/도시 → JORDAN', '이메일 → mu*****', '웹사이트 → https://power-bob.com'].join('\n')
    const l = parseBuyKoreaInquiries(mk)[0]
    expect(/hongseungkyun|후보이메일/.test((l.email || '') + (l.description || ''))).toBe(false)
  })
  // UI 아코디언 토글 라벨("레이어 열기/닫기")이 회사명으로 잡히던 것 차단(대표 신고).
  it('회사명 라벨이 있으면 UI 토글 라벨이 아니라 라벨값이 회사명', () => {
    const withCo = ['레이어 열기/닫기', '회사명 : Poly-ion engineering services', '국가 : Ecuador', '웹사이트 : https://www.poly-ion.org'].join('\n')
    expect(parseBuyKoreaInquiries(withCo)[0].company).toBe('Poly-ion engineering services')
  })
  it('UI 토글만 있는 크롬 조각은 회사명으로 저장하지 않음', () => {
    const noCo = ['레이어 열기/닫기', '이름 : Alejandro Calvache', '전화 : +593 999', '국가 : Ecuador'].join('\n')
    const l = parseBuyKoreaInquiries(noCo)[0]
    expect(l == null || !/레이어|열기|닫기/.test(l.company)).toBe(true)
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
  it('법인격 접미어 정규화 — "Zarya Impex" ↔ "Zarya Impex Pvt. Ltd." 같은 키(퍼지 중복 통합)', () => {
    expect(normalizeCompanyKey('Zarya Impex', 'India')).toBe(normalizeCompanyKey('Zarya Impex Pvt. Ltd.', 'India'))
    expect(normalizeCompanyKey('GAMZEN INFRASTRUCTURE', 'India')).toBe(normalizeCompanyKey('GAMZEN INFRASTRUCTURE PVT LTD', 'India'))
    // 서로 다른 회사는 여전히 구분(과잉 병합 금지).
    expect(normalizeCompanyKey('Global Corp', 'US')).not.toBe(normalizeCompanyKey('Global Trading', 'US'))
  })
  it('E1: SSRF — 내부/사설 호스트 차단, 공개 호스트 허용', () => {
    for (const u of ['http://127.0.0.1/', 'http://[fd00::1]/', 'http://[::ffff:127.0.0.1]/', 'http://169.254.169.254/', 'http://100.64.0.1/', 'http://foo.localhost/', 'http://2130706433/'])
      expect(isPublicHttpUrl(u)).toBe(false)
    for (const u of ['https://buyer.example.com/', 'http://8.8.8.8/', 'http://[2606:4700::1111]/'])
      expect(isPublicHttpUrl(u)).toBe(true)
  })
})

describe('buyer-parsers — buyKorea 실제 상세 구조(라이브 검증 기반)', () => {
  // 대표 라이브 확인: 회사명 Al Dayagem / 국가 JORDAN / 웹사이트 power-bob / 이메일·이름 마스킹.
  const h2t = (h: string) => String(h).replace(/<\/(?:tr|div|p|li|h[1-6]|table|dt|dd|th|td|section|button)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').split('\n').map(l => l.trim()).filter((l, i, a) => l || (a[i - 1] || '').length > 0).join('\n')
  it('table 구조(th/td): 회사명·국가·웹사이트 추출 + 마스킹 이메일 제외', () => {
    const l = parseBuyKoreaInquiries(h2t('<h1>Fertilizer</h1><table><tr><th>회사명</th><td>Al Dayagem for Trading agencies</td></tr><tr><th>국가/도시</th><td>JORDAN / All areas</td></tr><tr><th>웹사이트</th><td>https://www.power-bob.com</td></tr><tr><th>이메일</th><td>mu**************</td></tr></table>'))[0]
    expect(l.company).toBe('Al Dayagem for Trading agencies')
    expect(l.country).toBe('JORDAN')
    expect(l.website).toMatch(/power-bob\.com/)
    expect(l.email == null || !l.email.includes('*')).toBe(true)
  })
  it('화살표 구분(라벨 → 값): 콜론 없는 사이트도 추출', () => {
    const l = parseBuyKoreaInquiries(h2t('<div>회사명 → Zhome Co</div><div>국가/도시 → 베트남</div><div>웹사이트 → https://zhome.vn</div>'))[0]
    expect(l.company).toBe('Zhome Co')
    expect(l.country).toBe('Vietnam')
    expect(l.website).toMatch(/zhome\.vn/)
  })
})
