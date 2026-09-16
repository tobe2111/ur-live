/**
 * 🏪 입점 랜딩(/partners) 불변식 — 2026-09-16
 *
 * 대표 신고: *"지금 매장 사장님이 가입하는 첫 페이지가 이거인데 전혀 메리트가 없어 ·
 *   특히 PC 버전은 따로 없어. 프레임에 갇혀있고"*
 *
 * ■ 이 테스트가 지키는 것 (넷 다 실제로 났던 사고다)
 *   R1 **PC 에서 430px 소비자 액자에 갇히지 않는다.** 갇히면 빈 거터를 `ConsumerFrameRails`
 *      (홈·교환권·유어샵 바로가기 + 앱 QR)가 채워 **입점 검토 화면의 좌우가 소비자 앱 광고**가 된다.
 *   R2 **숫자가 대표 승인 덱과 같다.** `deck-common.mjs` 의 `FACTS` 를 실제로 파싱해 대조한다.
 *      기획 §0-5 가 실측한 사고가 정확히 이것이다 — 랜딩은 "수수료 5% 업계 최저", 덱은 10%.
 *      사장님은 카톡으로 PDF 를 받고 사이트를 연다. 두 값이 다르면 둘 다 신뢰를 잃는다.
 *   R3 **금지된 약속을 하지 않는다.** 기획 §0-4 의 목록(업계 최저·자동 승인·자동 송금·트래픽 보장·
 *      수익 사례)은 표시광고 위험이거나 코드가 그렇게 동작하지 않는다.
 *   R4 **정직 고지와 세 갈래 진입이 살아 있다.** 둘 다 대표 승인 덱의 장이고, 빠지면
 *      "초기 서비스" 라는 사실과 "폰이 익숙하지 않은 사장님" 의 길이 함께 사라진다.
 *
 * ■ 이 테스트가 **못 잡는 것** (사람이 봐야 한다)
 *   · 실제 PC 레이아웃이 예쁜가 — 렌더해서 눈으로 볼 것(`node out/shot.mjs` 류 하네스).
 *   · eyebrow 예산·레이아웃 계열 반복(anti-slop 의 사람 판정 항목).
 *   · 문구가 설득력이 있는가. 사실 정합만 본다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { stripComments } from '../helpers/source-text'
import { PARTNER_FACTS, FEE_DIRECT_RATE } from '../../shared/partners-facts'

const R = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')

const PAGE = 'src/pages/PartnersPage.tsx'
const SECTIONS = [
  'src/pages/partners/PartnerHero.tsx',
  'src/pages/partners/PartnerBenefits.tsx',
  'src/pages/partners/PartnerCompare.tsx',
  'src/pages/partners/PartnerMath.tsx',
  'src/pages/partners/PartnerFlow.tsx',
  'src/pages/partners/PartnerTools.tsx',
  'src/pages/partners/PartnerPaths.tsx',
  'src/pages/partners/PartnerFaq.tsx',
]
/** 주석을 걷어낸 사용자-가시 소스. 설명 주석의 단어가 판정에 새면 가드가 헛돈다(이 레포의 반복 사고). */
const visible = (p: string) => stripComments(R(p))
const ALL_VISIBLE = [PAGE, ...SECTIONS].map(visible).join('\n')

describe('R1 — /partners 는 PC 소비자 액자를 쓰지 않는다', () => {
  const layout = visible('src/components/MobileAppLayout.tsx')

  it('HIDE_SIDEBAR_PREFIXES 에 /partners 가 있다', () => {
    const block = layout.slice(layout.indexOf('HIDE_SIDEBAR_PREFIXES'), layout.indexOf('LINKSHOP_PREFIXES'))
    expect(block).toMatch(/'\/partners'/)
  })

  it('접두사를 /partner 로 줄이지 않는다 (입점 문의 폼 /partnership 을 삼킨다)', () => {
    const block = layout.slice(layout.indexOf('HIDE_SIDEBAR_PREFIXES'), layout.indexOf('LINKSHOP_PREFIXES'))
    expect(block).not.toMatch(/'\/partner'/)
  })

  it('App.tsx 가 /partners 를 fullScreen 으로 유지한다 (상·하단 소비자 네비 제외)', () => {
    expect(visible('src/App.tsx')).toMatch(/fullScreenPrefixes[\s\S]{0,400}'\/partners'/)
  })

  it('페이지가 풀너비에서 퍼지지 않게 ur-content-wide 로 중앙 정렬한다', () => {
    // 액자를 벗으면 폭 제한은 페이지 자신이 져야 한다. 없으면 1920 에서 줄이 끝까지 늘어난다.
    for (const f of SECTIONS) expect(visible(f), f).toMatch(/ur-content-wide/)
  })

  it('PC 전용 레이아웃이 실제로 있다 (lg: 분기 없이 "PC 버전"이라 할 수 없다)', () => {
    const lg = (ALL_VISIBLE.match(/\blg:/g) || []).length
    expect(lg).toBeGreaterThan(40)
    expect(ALL_VISIBLE).toMatch(/lg:grid-cols-/)
  })
})

describe('R2 — 숫자가 대표 승인 덱(deck-common.mjs FACTS)과 같다', () => {
  /** 덱의 FACTS 리터럴을 파싱한다. 덱은 .mjs 라 import 하지 않고 소스에서 읽는다. */
  const deck = R('docs/business/proposals/deck-common.mjs')
  const body = deck.slice(deck.indexOf('export const FACTS'))
  const pick = (k: string) => {
    const m = body.match(new RegExp(`\\b${k}:\\s*'([^']*)'`))
    if (!m) throw new Error(`deck-common.mjs 의 FACTS 에 ${k} 가 없다`)
    return m[1]
  }

  it('파싱이 실제로 값을 읽는다 (0건이면 통과가 아니라 실패)', () => {
    expect(pick('feeDirect')).toMatch(/^\d+%$/)
  })

  it.each([
    ['feeDirect', PARTNER_FACTS.feeDirect],
    ['feeBrokered', PARTNER_FACTS.feeBrokered],
    ['pgNote', PARTNER_FACTS.pgNote],
    ['minPayout', PARTNER_FACTS.minPayout],
    ['reviewBonus', PARTNER_FACTS.reviewBonus],
    ['liveMeasuredAt', PARTNER_FACTS.liveMeasuredAt],
    ['activeVouchers', PARTNER_FACTS.activeVouchers],
    ['realStores', PARTNER_FACTS.realStores],
    ['influencerDb', PARTNER_FACTS.influencerDb],
    ['influencerReachable', PARTNER_FACTS.influencerReachable],
    ['contactEmail', PARTNER_FACTS.contactEmail],
    ['biz', PARTNER_FACTS.biz],
  ])('%s 가 덱과 일치', (key, ours) => {
    expect(pick(key)).toBe(ours)
  })

  it('계산기 요율이 표기 요율과 갈리지 않는다', () => {
    expect(`${FEE_DIRECT_RATE * 100}%`).toBe(PARTNER_FACTS.feeDirect)
  })

  it('요율은 fee-resolver 의 직접 채널 기본값(10)과 같다', () => {
    const fee = R('src/worker/utils/fee-resolver.ts')
    expect(fee).toMatch(/직접\(direct\) 채널[\s\S]{0,80}기본 10/)
    expect(PARTNER_FACTS.feeDirect).toBe('10%')
  })

  it('숫자는 SSOT 에서만 읽는다 (섹션에 수수료율을 손으로 적지 않는다)', () => {
    for (const f of SECTIONS) {
      // "수수료 10%" 같은 하드코딩. 표기가 갈리는 길을 막는다.
      expect(visible(f), f).not.toMatch(/수수료\s*\d+%/)
    }
  })
})

describe('R3 — 금지된 약속을 하지 않는다 (기획 §0-4)', () => {
  it.each([
    ['업계 최저', /업계\s*최저/],
    ['자동 승인', /자동\s*승인/],
    ['자동 송금', /자동\s*송금/],
    ['트래픽 보장', /트래픽[^.]{0,12}(보장|약속드)/],
    ['수익 사례 금액', /매출[^.]{0,10}\d+%\s*(증가|상승)/],
    // ⚠️ 폐기 명칭은 **조각으로 조립**한다. 리터럴로 적으면 명칭 전수 스캔
    //    (`urshop-naming.test.ts`)이 이 테스트 파일 자신을 위반으로 잡는다(실제로 잡혔다).
    ['폐기 명칭(공구 + 권)', new RegExp('공구' + '권')],
    ['폐기 명칭(식사 + 권)', new RegExp('식사' + '권')],
    ['폐기 명칭(링크 + 샵)', new RegExp('링크' + '샵')],
  ])('%s 를 쓰지 않는다', (_label, re) => {
    expect(ALL_VISIBLE).not.toMatch(re)
  })

  it('카드 수수료를 고정값처럼 쓰지 않는다 (대표 2026-09-13)', () => {
    // 2.75 를 적을 거면 반드시 "바뀔 수 있음" 을 같은 문장에 달아야 한다 → pgNote 만 허용.
    const occurrences = (ALL_VISIBLE.match(/2\.75/g) || []).length
    expect(occurrences).toBe(0)
    expect(PARTNER_FACTS.pgNote).toMatch(/바뀔 수 있음/)
  })
})

describe('R4 — 덱이 정한 설득 구조가 살아 있다', () => {
  it('정직 고지 블록이 있다 (초기 서비스 · 판매 중 N건 중 실제 매장 M건)', () => {
    const faq = visible('src/pages/partners/PartnerFaq.tsx')
    // 🩸 처음엔 `/초기 서비스/` 로 봤는데, 같은 파일 FAQ 답변에도 그 말이 있어
    //    고지 블록을 통째로 지워도 초록이었다(주입 러너가 잡았다). 그래서 **문장 전체**를 앵커로 둔다.
    expect(faq).toMatch(/유어딜은 초기 서비스입니다\. \{F\.liveMeasuredAt\} 기준 판매 중인 이용권 \{F\.activeVouchers\}건/)
    expect(faq).toMatch(/실제 매장이 등록한 것은 \{F\.realStores\}건/)
    expect(faq).toMatch(/트래픽을 약속하는 대신/)
  })

  it('비교표에 유어딜 행이 있고 "팔린 뒤에만" 이 그 축이다', () => {
    const cmp = visible('src/pages/partners/PartnerCompare.tsx')
    expect(cmp).toMatch(/체험단/)
    expect(cmp).toMatch(/배달앱/)
    expect(cmp).toMatch(/팔린 뒤에만/)
    expect(cmp).toMatch(/ours:\s*true/)
  })

  it('시작하는 길이 셋이다 (직접 · 유어딜이 대신 · 대행사)', () => {
    const paths = visible('src/pages/partners/PartnerPaths.tsx')
    const titles = [...paths.matchAll(/title:\s*'([^']+)'/g)].map(m => m[1])
    expect(titles).toEqual(['사장님이 직접', '유어딜이 대신', '대행사와 함께'])
  })

  it('폰이 익숙하지 않은 사장님의 길(사람이 대신)이 남아 있다', () => {
    expect(visible('src/pages/partners/PartnerPaths.tsx')).toMatch(/사람이 합니다/)
  })

  it('CTA 목적지가 매장 등록 단일 목적지(/store/new)다', () => {
    expect(ALL_VISIBLE).toMatch(/to="\/store\/new"/)
    // 셀러 로그인 벽으로 보내지 않는다 (seller-entry.ts 가 고친 그 사고)
    expect(ALL_VISIBLE).not.toMatch(/to="\/seller\/login"/)
  })

  it('계산기가 라이브 실제 상품 가격으로 앵커돼 있다 (데모 시드 금지)', () => {
    expect(PARTNER_FACTS.sample.list).toBe(25000)
    expect(PARTNER_FACTS.sample.sale).toBe(16500)
    expect(visible('src/pages/partners/PartnerMath.tsx')).toMatch(/F\.sample\.(list|sale)/)
  })

  it('계산기가 카드 수수료 0원을 줄로 보여 준다 (빼기만 하던 이전 판의 수리)', () => {
    expect(visible('src/pages/partners/PartnerMath.tsx')).toMatch(/유어딜 부담/)
  })
})

describe('R5 — 대표 확정 골격 (2026-09-16 장점 3 · 차별점 3 · 도구)', () => {
  it('장점이 정확히 셋이다', () => {
    const src = visible('src/pages/partners/PartnerBenefits.tsx')
    expect((src.match(/^\s{2}\{$/gm) || []).length).toBe(3)
    expect(src).toMatch(/선불 비용 0원/)
    expect(src).toMatch(/실제 방문까지/)
    expect(src).toMatch(/선결제라 매출이 먼저 확정/)
  })

  it('비교 대상이 체험단 · 배달앱 · 예약솔루션 셋이다', () => {
    const rows = [...visible('src/pages/partners/PartnerCompare.tsx').matchAll(/\{ k: '([^']+)'/g)].map(m => m[1])
    expect(rows).toEqual(['체험단, 블로그 마케팅', '배달앱, 검색 광고', '예약, 포스 솔루션', '유어딜'])
  })

  it('예약솔루션과의 차이가 "새 손님" 이라는 축으로 서 있다', () => {
    // 이 행의 존재 이유다. 축이 흐려지면 "또 하나의 매장 솔루션" 으로 읽힌다.
    const src = visible('src/pages/partners/PartnerCompare.tsx')
    expect(src).toMatch(/이미 오기로 한 손님/)
    expect(src).toMatch(/결제까지 마친 새 손님/)
  })

  it('소개비를 매장이 정하고 내역이 남는다는 점을 말한다', () => {
    expect(visible('src/pages/partners/PartnerCompare.tsx')).toMatch(/사장님이 정하고 매장 화면에 내역이 그대로 남습니다/)
  })

  it('가입을 "자동 승인" 으로 말하지 않는다 (라이브는 어드민 수동 승인)', () => {
    const tools = visible('src/pages/partners/PartnerTools.tsx')
    expect(tools).toMatch(/국세청에 자동으로 조회/)   // 자동인 것은 진위확인뿐
    expect(tools).toMatch(/사람이 한 번 보고 승인/)
    // R3 이 전 페이지에서 '자동 승인' 을 이미 막지만, 이 자리가 가장 유혹적이라 한 번 더 못박는다.
    expect(tools).not.toMatch(/자동\s*승인/)
  })

  it('정산은 "자동 계산" 까지만 말하고 송금은 사람이라고 적는다', () => {
    const tools = visible('src/pages/partners/PartnerTools.tsx')
    expect(tools).toMatch(/자동으로 계산/)
    expect(tools).toMatch(/담당자가 내역을 눈으로 확인/)
  })

  it('인플루언서 성과를 "유입 몇 명" 으로 부풀리지 않는다 (그 데이터는 없다)', () => {
    // influencer_attributions 는 결제 건만 담는다(migration 0247). 클릭·유입 수는 없다.
    const tools = visible('src/pages/partners/PartnerTools.tsx')
    expect(tools).toMatch(/몇 건이 팔렸고/)
    expect(tools).not.toMatch(/몇 명이 눌렀|유입 수|클릭 수/)
  })

  it('공구 엔진 내용이 없다 (GB_ENGINE_ENABLED 가 꺼져 있다 · 대표 2026-09-16)', () => {
    // 꺼진 기능을 랜딩이 약속하면 사장님이 가입한 뒤에 없다는 걸 발견한다.
    expect(ALL_VISIBLE).not.toMatch(/링크 전용가|기간한정 공구|공구 특가|딜 초안을 제안/)
  })
})
