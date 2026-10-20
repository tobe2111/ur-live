/**
 * 🏛️ 나라장터 계약정보 레인 — **라이브 응답을 픽스처로** 고정한다(2026-08-04).
 *
 *   왜 픽스처인가: 이 레인이 죽어 있던 원인이 **필드명**이었다(구 레인은 `corpNm`·`telNo` 를 찾았는데
 *   실제 원부는 `rprsntCorpNm`·`dmndInsttOfclTel` 이다). 필드명은 **200 을 받고도 저장 0** 을 만드는
 *   가장 조용한 실패 자리라, 실측 응답을 그대로 박아 매핑을 잠근다.
 *
 * ⚠️ 이 시험이 **못** 보는 것: 게이트웨이가 이 경로/파라미터를 계속 받아 주는가(네트워크 계약).
 *   그건 `live-contracts.yml` 과 배포 후 프로브의 몫이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  toContractLeads, contractPhone, contractEmail, unmasked, pickInstRegion, pickAddrRegion,
  buildContractUrl, usableParamMode, NARA_PARAM_STATE_VERSION, kstYmd,
  DISTRICT_CONTRACT_RE, NARA_CONTRACT_BASE, NARA_CONTRACT_OP,
} from '@/features/marketing/api/nara-contract-collect'

/** 2026-08-04 라이브 실측 1행(키·개인정보 그대로 — 공개 원부 값). */
const LIVE = {
  cntrctNo: 'R26TA02064011',
  cntrctNm: '2026년 OO구 상권활성화 용역',
  bsnsDivNm: '용역',
  cntrctCnclsMthdNm: '수의계약',
  cntrctCnclsDate: '2026-07-28',
  cntrctAmt: '47432000',
  ttalCntrctAmt: '47432000',
  cntrctInsttNm: '신성대학교 산학협력단',
  cntrctInsttOfclNm: '심민우',
  cntrctInsttOfclTel: '0413501208',
  cntrctInsttOfcl: 'smw@naver.com',
  dmndInsttNm: '서울특별시 종로구청',
  dmndInsttOfclDeptNm: '앵커사업단',
  dmndInsttOfclNm: '심민우',
  dmndInsttOfclTel: '0413501208',
  dmndInsttOfclEmailAdrs: 'smw@naver.com',
  rprsntCorpNm: '주식회사 드론공장',
  rprsntCorpCeoNm: '이수라',
  rprsntCorpBizrno: '423-81-01763',
  rprsntCorpAdrs: '인천광역시 서해구 로봇랜드로',
  rprsntCorpContactTel: '***********', // ← 원부가 가려서 준다(실측)
  dataBssDate: '2026-08-04',
}

describe('계약 → 리드 매핑(실측 필드명 고정)', () => {
  it('상권 계약 한 건에서 **수주사 + 발주기관** 둘이 나온다', () => {
    const leads = toContractLeads(LIVE)
    expect(leads).toHaveLength(2)
    expect(leads.map(l => l.company_name)).toEqual(['주식회사 드론공장', '서울특별시 종로구청'])
  })

  it('수주사 — 사업자번호가 실린다(= `b:` 키로 기존 풀과 자동 병합되는 근거)', () => {
    const [corp] = toContractLeads(LIVE)
    expect(corp.business_no).toBe('423-81-01763')
    expect(corp.category).toBe('대행사')
    expect(corp.region).toBe('인천')
    expect(corp.description).toContain('대표 이수라')
    expect(corp.description).toContain('상권활성화')
  })

  it('🙈 마스킹된 전화는 **없는 값**이다 — 있다고 세면 접촉 풀이 거짓말한다', () => {
    const [corp] = toContractLeads(LIVE)
    expect(corp.phone).toBeNull()
    expect(corp.contact_source).toBeNull()
  })

  it('발주기관 — 대표 확정 B안대로 담당자 이름·전화·이메일이 실린다', () => {
    const inst = toContractLeads(LIVE)[1]
    expect(inst.phone).toBe('0413501208')
    expect(inst.email).toBe('smw@naver.com')
    expect(inst.description).toContain('담당 심민우')
    expect(inst.contact_source).toBe('govreg')
    expect(inst.region).toBe('서울')
  })

  it('발주기관 필드가 비면 계약기관으로 폴백한다(원부가 둘 중 하나만 주는 행이 있다)', () => {
    const leads = toContractLeads({ ...LIVE, dmndInsttNm: '', dmndInsttOfclTel: '', dmndInsttOfclEmailAdrs: '' })
    const inst = leads[1]
    expect(inst.company_name).toBe('신성대학교 산학협력단')
    expect(inst.phone).toBe('0413501208')
    expect(inst.email).toBe('smw@naver.com')
  })

  it("포털의 'N/A' 는 값이 아니다 — 앞 별칭이 뒤 별칭의 진짜 값을 가리면 안 된다", () => {
    const inst = toContractLeads({ ...LIVE, dmndInsttOfclTel: 'N/A' })[1]
    expect(inst.phone).toBe('0413501208') // cntrctInsttOfclTel 로 폴백
  })
})

describe('🎯 상권 계약만 — 잡음을 넣지 않는다', () => {
  it('상권과 무관한 계약은 리드를 만들지 않는다', () => {
    expect(toContractLeads({ ...LIVE, cntrctNm: '미래모빌리티계열 실험실습기자재 구매' })).toHaveLength(0)
  })

  it.each(['상권활성화 용역', '전통시장 시설현대화', '상점가 환경개선', '골목형상점가 지정 용역', '청년몰 조성'])(
    '%s — 상권 계열로 걸린다', (nm) => { expect(DISTRICT_CONTRACT_RE.test(nm)).toBe(true) })

  it("⚠️ `시장` 단독은 걸리지 않는다 — '시장조사 용역' 이 통째로 들어오면 풀이 오염된다", () => {
    expect(DISTRICT_CONTRACT_RE.test('시장조사 용역')).toBe(false)
    expect(DISTRICT_CONTRACT_RE.test('농수산물도매시장 청소용역')).toBe(false)
  })
})

describe('값 위생', () => {
  it('마스킹 감지 — 별표가 하나라도 있으면 버린다', () => {
    expect(unmasked('***********')).toBe('')
    expect(unmasked('02-***-1234')).toBe('')
    expect(unmasked('02-123-4567')).toBe('02-123-4567')
  })
  it('전화는 숫자 9~12자리만', () => {
    expect(contractPhone('0413501208')).toBe('0413501208')
    expect(contractPhone('1234')).toBeNull()
    expect(contractPhone('***********')).toBeNull()
  })
  it('이메일은 형태가 맞을 때만 — 지어내지 않는다', () => {
    expect(contractEmail('SMW@Naver.com')).toBe('smw@naver.com')
    expect(contractEmail('없음')).toBeNull()
    expect(contractEmail('a@*.com')).toBeNull()
  })
  it('지역 — 기관명 앞머리, 주소는 시/군/구', () => {
    expect(pickInstRegion('서울특별시 종로구청')).toBe('서울')
    expect(pickInstRegion('경상남도 창원시')).toBe('창원') // 주소와 **같은 규칙**(소스별로 갈리면 필터가 깨진다)
    expect(pickInstRegion('신성대학교 산학협력단')).toBeNull() // 추측하지 않는다
    expect(pickAddrRegion('인천광역시 서해구 로봇랜드로')).toBe('인천')
  })
})

describe('🧪 파라미터 자가측정', () => {
  const K = 'KEY'
  const o = { page: 2, rows: 200, bgn: '20260728', end: '20260804' }

  it('window 모드는 날짜 창을 싣고, plain 모드는 **싣지 않는다**', () => {
    const w = buildContractUrl(NARA_CONTRACT_BASE, NARA_CONTRACT_OP, K, { ...o, mode: 'window' })
    const p = buildContractUrl(NARA_CONTRACT_BASE, NARA_CONTRACT_OP, K, { ...o, mode: 'plain' })
    expect(w).toContain('inqryBgnDate=20260728')
    expect(w).toContain('inqryEndDate=20260804')
    expect(p).not.toContain('inqryBgnDate')
    // 페이징은 두 모드 공통 — 폴백이 페이징까지 잃으면 커서가 무의미해진다
    for (const u of [w, p]) { expect(u).toContain('pageNo=2'); expect(u).toContain('numOfRows=200') }
  })

  it('🔒 굳은 판정은 **버전이 맞을 때만** 쓴다 — 안 그러면 코드 수정이 DB 에 진다', () => {
    expect(usableParamMode('plain', NARA_PARAM_STATE_VERSION)).toBe('plain')
    expect(usableParamMode('plain', NARA_PARAM_STATE_VERSION - 1)).toBeNull()
    expect(usableParamMode('plain', undefined)).toBeNull()
    expect(usableParamMode('garbage', NARA_PARAM_STATE_VERSION)).toBeNull()
  })

  it('날짜는 KST 기준 — UTC 로 찍으면 하루가 어긋난다', () => {
    // 2026-08-03 20:00 UTC = 2026-08-04 05:00 KST
    expect(kstYmd(Date.parse('2026-08-03T20:00:00Z'))).toBe('20260804')
  })
})

describe('🔌 배선 — 만들어 놓고 안 부르면 없는 것과 같다', () => {
  const SRC = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

  it('ur-ads 라우트 · cron 게이트가 이 레인을 부른다', () => {
    const routes = SRC('src/worker-ads/public-data.routes.ts')
    expect(routes).toContain("'/__ads/collect-nara-contract'")
    expect(routes).toContain('runNaraContractCollect')
    const idx = SRC('src/worker-ads/index.ts')
    expect(idx).toContain('ADS_NARA_CONTRACT_ENABLED')
    expect(idx).toContain("'/__ads/collect-nara-contract'")
  })

  it('어드민 버튼 → 위임 경로 → 레인 이름이 이어진다', () => {
    const pool = SRC('src/features/marketing/api/partner-pool.routes.ts')
    expect(pool).toContain("delegateCollect('collect-nara-contract'")
    expect(pool).toContain("readKey('ads_naracontract_stats')")
    expect(pool).toContain("{ lane: 'collect-nara-contract'")
    // 레인 도메인 표에 없으면 예산 배분에서 빠진다(= 부모 CPU 를 직접 태우는 자리)
    expect(SRC('src/worker-ads/lane-domains.ts')).toContain("'collect-nara-contract'")
  })

  /**
   * 🪦→🏛️ **2026-08-11 정정 — 조달업체 레인은 죽지 않았다. 우리가 잘못 죽였다.**
   *
   * 원래 이 자리는 *"죽은 조달업체 레인의 잔재가 남아 있지 않다"* 를 지켰다. 그 전제는
   * *"`UsrInfoService02` 는 코드 12 = 폐기된 주소"* 였는데 **그 판정이 틀렸다** — 대표가 공유한
   * 포털 Swagger(2026-08-10)로 확정된 진짜 원인은 **오퍼레이션 이름에 `02` 가 빠진 것**이다.
   * 코드 12 는 *주소 부재*와 *오퍼레이션 오타*를 구분하지 못한다(`public-data-diag` 가 명시한 함정).
   *
   * ⇒ 지키는 대상을 **"잔재가 없을 것"에서 "옛 오타가 기본값으로 돌아오지 않을 것"으로** 바꾼다.
   *   레인 자체는 되살렸으므로 전자는 이제 틀린 요구이고, 그대로 두면 **이 테스트가 낡은 지도**가 된다.
   */
  it('🔒 되살린 조달업체 레인이 옛 오퍼레이션 오타로 돌아가지 않는다', () => {
    const v = SRC('src/features/marketing/api/nara-vendor-collect.ts')
    // 기본값은 반드시 '02' 가 붙은 이름. 이게 빠져서 15회를 버리고 레인을 지웠다.
    expect(v).toContain("export const NARA_VENDOR_OP = 'getPrcrmntCorpBasicInfo02'")
    // 계약 레인과 **다른 주소**여야 한다 — 같아지면 둘이 같은 원부를 두 번 긁는다.
    expect(v).toContain('/1230000/ao/UsrInfoService02')
    expect(v).not.toContain(`${NARA_CONTRACT_OP}`)
  })
})
