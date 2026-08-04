/**
 * 🏪 **전통시장(상권 축) 수집 계약** — 2026-08-03 대표 지시 *"상인회·상권 DB"*.
 *
 * 이 레인이 지켜야 할 것은 셋인데, **셋 다 오늘 실제로 데인 자리**다:
 *
 * ① **파라미터 넷만 보낸다.** 표준데이터 게이트웨이는 모르는 파라미터를 무시하지 않고 **거부**한다
 *    (`INVALID_REQUEST_PARAMETER_ERROR (pageIndex)`). "혹시 몰라" 얹으면 인증까지 통과한 요청이 죽는다.
 * ② **필드명은 실측한 것**(`mrktNm`/`phoneNumber`/`homepageUrl`…). 인허가에서 이걸 틀려
 *    **HTTP 200 에 행까지 오는데 저장이 0** 이었다.
 * ③ **호스트는 `api.` — `apis.` 가 아니다.** 글자 하나 차이의 별개 게이트웨이다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * 라이브 응답이 실제로 무엇인지(이 환경은 `data.go.kr` CONNECT 가 막혀 있다). 여기서는 **매핑과 URL 문법**만
 * 고정한다 — 그 둘이 오늘 하루에 세 번 우리를 넘어뜨린 자리다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  MARKET_BASE, MARKET_OP, MARKET_CATEGORY, MARKET_SUBCATEGORY,
  toMarketLead, normalizeMarketSite, pickMarketRegion,
} from '@/features/marketing/api/market-collect'
import { REGISTRY_CATEGORY_SOURCES } from '@/features/marketing/api/company-classify'

/** 🔴 라이브 응답 1행(2026-08-03 실측, 값 축약 — 키는 원문 그대로). */
const LIVE = {
  mrktNm: '사기막골도자기시장', mrktType: '상설장',
  rdnmadr: '경기도 이천시 경충대로2993번길 24', lnmadr: '경기도 이천시 사음동 536',
  mrktEstblCycle: '매일', latitude: '37.29483104', longitude: '127.4119796',
  storNumber: '62', trtmntPrdlst: '의류+가정용품+음식점+근린생활서비스',
  useGcct: '', homepageUrl: 'www.sagimakgol.com', pblicToiletYn: 'Y', prkplceYn: 'Y',
  estblYear: '1978', phoneNumber: '031-638-8388', referenceDate: '2025-11-10',
  insttCode: 'B553077', insttNm: '소상공인시장진흥공단',
}

describe('전통시장 → 파트너 리드 매핑', () => {
  const lead = toMarketLead(LIVE)!

  it('🔒 이름과 **전화**가 붙는다 — 이 축에서 전화가 없으면 리드가 아니다', () => {
    expect(lead.company_name).toBe('사기막골도자기시장')
    expect(lead.phone, 'phoneNumber 를 못 읽으면 상권 축 전체가 연락 불가 명단이 된다').toBe('031-638-8388')
    expect(lead.contact_source, '공시된 연락처라는 출처가 남아야 한다').toBe('govreg')
  })

  it('🔒 홈페이지에 스킴을 붙인다 — 원부가 `www.…` 로 주는 경우가 있다(실측)', () => {
    expect(lead.website).toBe('https://www.sagimakgol.com')
    expect(normalizeMarketSite('http://www.jmarket.org/')).toBe('http://www.jmarket.org/')  // 이미 있으면 그대로
    expect(normalizeMarketSite('')).toBeNull()
    expect(normalizeMarketSite('없음'), '도메인 꼴이 아니면 버린다(추측 금지)').toBeNull()
  })

  it('🔒 카테고리는 **기존 축**(지역조직/상인회)을 쓴다 — 새 축을 만들면 필터·리포트가 갈린다', () => {
    expect(lead.category).toBe(MARKET_CATEGORY)
    expect(lead.subcategory).toBe(MARKET_SUBCATEGORY)
    expect(MARKET_CATEGORY).toBe('지역조직')
    expect(MARKET_SUBCATEGORY).toBe('상인회')
  })

  it('🔒 `market` 은 **카테고리 권위 소스**여야 한다 — 시장 이름은 상인회 규칙에 안 걸린다', () => {
    // "사기막골도자기시장" 에는 상인회·번영회 같은 단어가 없다. 원부가 이미 "전통시장"이라고
    // 말해 주는데 이름만 보고 다시 추측하면 카테고리가 비거나 엉뚱해진다.
    expect(REGISTRY_CATEGORY_SOURCES.has('market')).toBe(true)
    expect(lead.source).toBe('market')
  })

  it('규모·업종 구성을 설명에 남긴다 — 접촉 우선순위의 재료다', () => {
    expect(lead.description).toContain('점포 62개')
    expect(lead.description).toContain('상설장')
  })

  it('주소·지역을 옮긴다(도로명 우선, 없으면 지번)', () => {
    expect(lead.address).toContain('경충대로')
    expect(lead.region).toBe('이천')
    // ⚠️ 광역시/특별시는 **시 단위**로 잡힌다("서울특별시 종로구…" → `서울`). 도 지역은 시/군 단위
    //   ("경기도 이천시…" → `이천`). 이건 파트너 풀의 기존 `region` 규약과 **같은 동작**이라 맞춘 것이다 —
    //   여기만 구 단위로 잡으면 지역 필터가 소스마다 다른 뜻이 된다(내 첫 기대가 틀렸고, 코드가 맞았다).
    expect(pickMarketRegion('서울특별시 종로구 종로 1 ')).toBe('서울')
    expect(pickMarketRegion('')).toBeNull()
  })

  it('이름이 없거나 너무 짧으면 버린다(쓰레기 행 방어)', () => {
    expect(toMarketLead({ ...LIVE, mrktNm: '' })).toBeNull()
    expect(toMarketLead({ ...LIVE, mrktNm: 'ㄱ' })).toBeNull()
  })

  it('전화가 없으면 출처를 비운다 — 없는 연락처를 지어내지 않는다', () => {
    const l = toMarketLead({ ...LIVE, phoneNumber: '' })!
    expect(l.phone).toBeNull()
    expect(l.contact_source).toBeNull()
  })
})

describe('요청 URL — 이 게이트웨이는 모르는 파라미터를 거부한다', () => {
  const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/market-collect.ts'), 'utf8')

  it("🔒 호스트가 `api.data.go.kr` 이다 — `apis.` 는 **다른 게이트웨이**다", () => {
    expect(MARKET_BASE).toBe('https://api.data.go.kr/openapi')
    expect(MARKET_BASE, "'s' 가 붙으면 표준데이터가 아니라 기관별 서비스로 간다").not.toContain('apis.data.go.kr')
    expect(MARKET_OP).toBe('tn_pubr_public_trdit_mrkt_api')
  })

  it('🔒 쿼리에 **네 파라미터만** 쓴다 — 더 얹으면 INVALID_REQUEST_PARAMETER_ERROR 로 죽는다', () => {
    const q = /const url = `\$\{base\}\/\$\{op\}\?([^`]+)`/.exec(SRC)
    expect(q, 'URL 조립부를 못 찾았다(리팩토링됐나)').toBeTruthy()
    const s = q![1]
    expect(s).toContain('serviceKey=')
    expect(s).toContain('pageNo=')
    expect(s).toContain('numOfRows=')
    expect(s).toContain('type=json')
    for (const bad of ['pageIndex', 'pageSize', 'resultType', '_type']) {
      expect(s, `${bad} 는 이 게이트웨이가 거부한다(실측)`).not.toContain(bad)
    }
  })
})

describe('🔗 배선 — 만들어 놓고 아무도 안 부르면 수집은 0 이다', () => {
  it('ur-ads 라우트 + cron 게이트가 있다', () => {
    const R = readFileSync(resolve(process.cwd(), 'src/worker-ads/public-data.routes.ts'), 'utf8')
    expect(R).toMatch(/'\/__ads\/collect-market'/)
    // ⚠️ 2026-08-03: 원래 index.ts 를 앵커했는데, 600줄 래칫에 걸려 공공데이터 cron 을 모듈로 **분리**하면서
    //   깨졌다. 지켜야 할 것은 파일 위치가 아니라 **① 게이트가 존재하고 ② 그 모듈이 실제로 호출된다**는 것이다
    //   (등록만 하고 아무도 안 부르면 레인은 없는 것과 같다 — 이 레포가 반복해 당한 "조용한 부재").
    const C = readFileSync(resolve(process.cwd(), 'src/worker-ads/cron-public-data.ts'), 'utf8')
    expect(C).toMatch(/ADS_MARKET_ENABLED === 'true'/)
    expect(C, '원부가 작고 월 1,000요청 한도라 하루 1회여야 한다').toMatch(/dailyAt\(\d+, '\/__ads\/collect-market'/)
    const I = readFileSync(resolve(process.cwd(), 'src/worker-ads/index.ts'), 'utf8')
    expect(I, 'cron 등록 모듈을 아무도 안 부르면 게이트가 있어도 안 돈다').toMatch(/registerPublicDataCrons\(env, gates\)/)
  })

  it('어드민에서 수동 실행할 수 있다 — 게이트를 켜기 전에 한 번 돌려 봐야 한다', () => {
    const P = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/partner-pool.routes.ts'), 'utf8')
    expect(P).toMatch(/app\.post\('\/collect-market'/)
    expect(P, '수집기 목록에 없으면 어드민 화면에 안 뜬다').toMatch(/'collect-market'/)
  })
})
