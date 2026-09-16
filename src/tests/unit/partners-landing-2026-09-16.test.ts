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
 *   R6 **PC 가 "넓어진 모바일" 로 되돌아가지 않는다.** (2026-09-16 2차 — 대표
 *      *"PC 버전은 전혀 PC 버전 같지 않은데? 안 B로 하는데"*) 1440px 실측으로 확인한 두 가지:
 *      ⓐ 사진이 **0장**이었다 ⓑ h2 가 1440 에서도 38px 이고 여백 리듬이 전 섹션 동일했다.
 *      ⇒ 안 B(라이브 캡처 + 폰 프레임)와 PC 타이포 단계를 불변식으로 박는다.
 *
 * ■ 이 테스트가 **못 잡는 것** (사람이 봐야 한다)
 *   · 캡처가 최신 화면인가 — 파일 존재만 본다(내용이 낡아도 초록이다).
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
  it('장점이 정확히 셋이고, 셋이 각각 다른 말을 한다', () => {
    // 2026-09-16 3차: 문구를 사람 말투로 고쳐 쓰면서 앵커를 **뜻**으로 옮겼다.
    //   종전 앵커('선불 비용 0원' 같은 제목 원문)를 그대로 두면 말투 수정이 가드에 걸려,
    //   가드가 "이 셋을 말한다" 가 아니라 "이 문장을 쓴다" 를 지키게 된다. 지켜야 하는 건 앞쪽이다.
    const src = visible('src/pages/partners/PartnerBenefits.tsx')
    expect((src.match(/^\s{2}\{$/gm) || []).length).toBe(3)
    expect(src, '① 선불 0원').toMatch(/안 팔리면 0원/)
    expect(src, '② 노출이 실제 방문으로').toMatch(/QR을 찍는 순간/)
    expect(src, '③ 선결제').toMatch(/오기 전에 값을 치릅니다/)
  })

  it('장점 섹션에 01/02/03 번호를 다시 붙이지 않는다', () => {
    // anti-slop 스킬이 "section-number eyebrow" 로 이름 붙여 금지한 그림이다.
    // 순서에 뜻이 없는 셋이라 번호는 장식이고, 그 장식이 페이지에서 가장 큰 AI 티였다.
    expect(visible('src/pages/partners/PartnerBenefits.tsx')).not.toMatch(/0\{i\s*\+\s*1\}/)
    expect(visible('src/pages/partners/PartnerFlow.tsx')).not.toMatch(/0\{i\s*\+\s*1\}/)
  })

  it('비교 대상이 체험단 · 배달앱 · 예약솔루션 셋이다', () => {
    const rows = [...visible('src/pages/partners/PartnerCompare.tsx').matchAll(/\{ k: '([^']+)'/g)].map(m => m[1])
    expect(rows).toEqual(['체험단, 블로그 마케팅', '배달앱, 검색 광고', '예약, 포스 솔루션', '유어딜'])
  })

  it('예약솔루션과의 차이가 "새 손님" 이라는 축으로 서 있다', () => {
    // 이 행의 존재 이유다. 축이 흐려지면 "또 하나의 매장 솔루션" 으로 읽힌다.
    // 🩸 2026-09-16 2차: 처음엔 파일 전체에서 문구를 찾았는데, 같은 말이 위쪽 '차별점 3' 블록에도
    //   생기면서 **표의 행을 통째로 뭉개도 초록**이 됐다(주입 러너가 잡았다). ⇒ 그 행에서만 찾는다.
    const src = visible('src/pages/partners/PartnerCompare.tsx')
    const row = (k: string) => src.match(new RegExp(`\\{ k: '${k}[^}]*\\}`))?.[0] ?? ''
    expect(row('예약, 포스 솔루션')).toMatch(/이미 오기로 한 손님/)
    expect(row('예약, 포스 솔루션')).toMatch(/온 손님 관리/)
    expect(row('유어딜')).toMatch(/결제까지 마친 새 손님/)
  })

  it('소개비를 매장이 정하고 내역이 남는다는 점을 말한다', () => {
    // 2026-09-16 2차: 이 문장이 닫는 문단 → '차별점 3'(vs 배달앱) 블록으로 옮겨졌다. 불변식은 그대로다.
    expect(visible('src/pages/partners/PartnerCompare.tsx')).toMatch(/사장님이 정하고, 그 내역이 매장 화면에 그대로 남습니다/)
  })

  it('가입을 "자동 승인" 으로 말하지 않는다 (라이브는 어드민 수동 승인)', () => {
    // 2026-09-16 2차: 이 고지가 '도구'(PartnerTools) → '시작하는 세 가지 길'(PartnerPaths) 로 옮겨졌다.
    // 가입 절차를 말하는 자리가 맞는 집이다. 불변식은 그대로 — 자동인 것은 진위확인뿐이다.
    const paths = visible('src/pages/partners/PartnerPaths.tsx')
    expect(paths).toMatch(/국세청에 자동으로 조회/)   // 자동인 것은 진위확인뿐
    expect(paths).toMatch(/사람이 한 번 보고 승인/)
    // R3 이 전 페이지에서 '자동 승인' 을 이미 막지만, 이 자리가 가장 유혹적이라 한 번 더 못박는다.
    expect(paths).not.toMatch(/자동\s*승인/)
    expect(visible('src/pages/partners/PartnerTools.tsx')).not.toMatch(/자동\s*승인/)
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

describe('R6 — PC 가 "넓어진 모바일" 로 되돌아가지 않는다 (2026-09-16 2차)', () => {
  /**
   * 🩸 1차 판을 1440px 로 실제 렌더해 재 보니 대표 지적이 맞았다:
   *   `main img` **0개** · h1 48px · h2 전부 38px · 전 섹션 `py-24` 동일.
   * 아래 셋은 그 세 가지가 조용히 되돌아가는 것을 막는다. **예쁜지는 못 본다** — 그건 렌더해서 볼 일이다.
   */
  const usesPhone = SECTIONS.filter(f => visible(f).includes('<PartnerPhone'))

  it('안 B — 라이브 캡처를 폰 프레임으로 쓴다 (섹션 셋 이상)', () => {
    // "사진 0장" 으로의 회귀 차단. 히어로만 남기고 아래를 다 지우는 것도 막는다.
    expect(usesPhone.length).toBeGreaterThanOrEqual(3)
    expect(visible('src/pages/partners/PartnerHero.tsx')).toMatch(/<PartnerPhone[\s\S]{0,400}priority/)
  })

  it('캡처 경로가 /static/ 이고 파일이 실제로 있다 (라이브 404 사고 재발 차단)', () => {
    // 🩸 처음엔 `public/partners/*.jpg` 에 뒀는데 `_routes.json` 이 `/*` 를 워커로 보내 **404** 였다.
    //    검증된 제외 경로는 `/static/*` 뿐이다. 그리고 파일이 없으면 프레임만 하얗게 남는다.
    const phone = visible('src/pages/partners/PartnerPhone.tsx')
    expect(phone).toMatch(/`\/static\/partners\/\$\{n\}\.jpg`/)
    const shots = new Set<string>()
    // 두 가지 표기를 다 줍는다: 직접 호출 `SHOT('home')` 과 목록 항목 `{ shot: 'home', ... }`.
    for (const f of usesPhone) {
      const src = visible(f)
      for (const m of src.matchAll(/SHOT\('([^']+)'\)/g)) shots.add(m[1])
      for (const m of src.matchAll(/\bshot: '([^']+)'/g)) shots.add(m[1])
    }
    expect(shots.size).toBeGreaterThanOrEqual(6)
    for (const n of shots) {
      expect(fs.existsSync(path.join(process.cwd(), `public/static/partners/${n}.jpg`)), `캡처 없음: ${n}.jpg`).toBe(true)
    }
  })

  it('폰을 섹션 밖으로 흘려 잘리게 두지 않는다', () => {
    // 1차에서 작은 폰을 `absolute bottom-[-2.5rem]` 로 내렸더니 `overflow-hidden` 이 잘라
    // **고장처럼** 읽혔다. 랜딩에서 잘린 스크린샷은 의도가 아니라 실수로 보인다.
    expect(visible('src/pages/partners/PartnerHero.tsx')).not.toMatch(/bottom-\[-/)
  })

  it('PC 타이포 단계가 모바일 치수로 되돌아가지 않는다', () => {
    const h1 = visible('src/pages/partners/PartnerHero.tsx').match(/<h1[^>]*className="([^"]+)"/)?.[1] ?? ''
    const lgPx = (cls: string) => Number(cls.match(/\blg:text-\[(\d+(?:\.\d+)?)px\]/)?.[1] ?? 0)
    expect(lgPx(h1), 'h1 의 lg 치수').toBeGreaterThanOrEqual(50)

    // 섹션 제목은 전부 lg 에서 40px 이상. 38px 로 돌아가면 1440 에서 다시 "문서" 가 된다.
    const heads = [...ALL_VISIBLE.matchAll(/<h2[^>]*className="([^"]+)"/g)].map(m => m[1])
    expect(heads.length).toBeGreaterThanOrEqual(7)
    for (const h of heads) expect(lgPx(h), `h2 의 lg 치수: ${h}`).toBeGreaterThanOrEqual(40)
  })

  it('섹션 여백 리듬이 전부 같은 값이 아니다 (PC 에서 단조로움의 정체)', () => {
    // 1차는 모든 섹션이 `lg:py-24` 였다. 값이 한 종류면 스크롤이 평평해진다.
    const pys = new Set([...ALL_VISIBLE.matchAll(/\blg:py-(\d+)\b/g)].map(m => m[1]))
    expect(pys.size).toBeGreaterThanOrEqual(2)
  })

  it('대표 확정 차별점 3의 상대가 체험단 · 배달앱 · 예약솔루션이다', () => {
    const vs = [...visible('src/pages/partners/PartnerCompare.tsx').matchAll(/vs: '([^']+)'/g)].map(m => m[1])
    expect(vs).toHaveLength(3)
    expect(vs[0]).toMatch(/체험단/)
    expect(vs[1]).toMatch(/배달앱/)
    expect(vs[2]).toMatch(/예약/)
  })
})

describe('R7 — 말투가 AI 로 되돌아가지 않는다 (2026-09-16 3차)', () => {
  /**
   * 대표: *"AI 가 만든 디자인, 말투가 아니면 좋겠는데"*
   *
   * 🩸 2차 판의 제목을 한 줄로 늘어놓으면 원인이 보인다 — **아홉 개가 전부 완결문**이고
   *   **전부 "-습니다/-입니다"** 로 끝났다. 사람이 쓴 랜딩은 명사구로 끊고, 묻고, 숫자를 던진다.
   *   그래서 여기서 재는 것은 문장 한 줄의 좋고 나쁨이 아니라 **리듬**이다.
   *
   * ⚠️ 이 가드가 **못 하는 것**: 문장이 실제로 매력적인지. 그건 렌더해서 읽어 봐야 한다.
   *   여기서 막는 것은 "전부 같은 어미로 끝나는 상태" 하나뿐이다.
   */
  const found = (() => {
    const out: { tag: string; text: string }[] = []
    for (const f of [PAGE, ...SECTIONS]) {
      const src = visible(f)
      for (const m of src.matchAll(/<(h1|h2)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
        const text = m[2]
          .replace(/\{[^}]*\}/g, '')      // {F.x} 같은 보간 제거
          .replace(/<[^>]+>/g, ' ')        // <br /> 등
          .replace(/\s+/g, ' ')
          .trim()
        if (text) out.push({ tag: m[1], text })
      }
    }
    return out
  })()
  const headings = found.map(h => h.text)

  it('제목을 여덟 개 이상 모은다 (0개면 통과가 아니라 실패)', () => {
    // 정규식이 낡아 헤딩을 못 줍기 시작하면 아래 비율 검사가 조용히 무의미해진다.
    expect(headings.length).toBeGreaterThanOrEqual(8)
  })

  it('h1 이 완결문으로 끝나지 않는다', () => {
    // 한 줄만 읽고 나가는 사람이 보는 줄이다. 2차 판은 *"…부르는 방법입니다"* 였는데
    // 뒤 네 글자가 뜻을 안 보태면서 말투만 얹었다. 명사구·질문·숫자 중 하나로 끊는다.
    // ⚠️ `headings[0]` 을 쓰면 안 된다 — 수집 순서가 파일 순서라 PartnersPage 의 마지막 CTA h2 가
    //    맨 앞에 온다(첫 판이 그렇게 틀려서 실제 소스에 빨간불이 났다). 태그로 찾는다.
    const h1 = found.find(h => h.tag === 'h1')?.text ?? ''
    expect(h1, 'h1 을 못 찾았다').not.toBe('')
    expect(h1).not.toMatch(/(습니다|입니다|합니다|됩니다)[.!?]?$/)
  })

  it('제목이 전부 "-습니다/-입니다" 로 끝나지 않는다', () => {
    // ⚠️ 이 검사는 **페이지 전체가 한 어미로 되돌아가는 것**을 막는다. 그래서 주입 한 줄로는
    //    빨간불이 안 난다(제목 하나가 완결문이 되는 건 정상이다). 주입 검증은 바로 위
    //    'h1 이 완결문으로 끝나지 않는다' 가 맡는다 — 같은 파일이라 그 주입이 이 규약 전체를 지킨다.
    const polite = headings.filter(h => /(습니다|입니다|합니다|됩니다)[.!?]?$/.test(h))
    expect(polite.length, `완결문 제목: ${polite.join(' / ')}`).toBeLessThanOrEqual(Math.ceil(headings.length / 3))
  })

  it('제목 모양이 한 가지가 아니다 (조각·질문·완결문이 섞인다)', () => {
    const shapes = new Set(headings.map(h =>
      /[?？]$/.test(h) ? 'question'
      : /(습니다|입니다|합니다|됩니다)[.!?]?$/.test(h) ? 'sentence'
      : 'fragment',
    ))
    expect(shapes.size, `제목: ${headings.join(' / ')}`).toBeGreaterThanOrEqual(2)
  })
})
