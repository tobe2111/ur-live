/**
 * 🏷️ 취급품목 탐침 — **코드표가 필요한지를 라이브가 답하게** 한다 (2026-10-24).
 *
 * ## 배경 (라이브 실측)
 *
 * 통신판매 리드 412,428건의 `subcategory` 가 **전부 `'통신판매'`** 다 — 대표가 *"업종 구별이 완벽하지
 * 않음, 정확도가 많이 낮음"* 이라고 지적한 것의 숫자다. 원재료인 취급품목은 412,485행 중 **5,425행
 * (1.3%)** 에만 있고, 그 값은 숫자 코드다(`'12'` 1,255 · `'06'` 1,090 · `'01'` 797 · `'01 06'` 96 …).
 * 코드표는 포털 활용가이드에 있는데 이 환경은 `data.go.kr` 을 **DNS 부터** 막는다.
 *
 * 🔑 그런데 수집 코드의 별칭 목록엔 `ntslPrdlstCn`(판매품목)이 **차선으로** 있다. `g()` 는 첫 값만
 * 쓰므로 `trtmntPrdlstNm` 이 있으면 그 필드를 한 번도 안 본다. 그게 한글이면 **코드표가 아예 필요 없다.**
 * 그리고 그 사실을 **몰랐던 이유**는 `diag.sample`/`coverage` 가 두 엔드포인트를 한 변수에 담아
 * `detail` 응답을 한 번도 못 본 것이다(저장된 coverage 18필드가 전부 `status` 것이었다).
 *
 * ## 이 시험이 지키는 것
 *
 * ① 판정이 라이브 실제 값에서 맞다 ② **별칭 목록이 수집 코드와 같다**(두 벌이면 탐침과 저장이 갈려
 * 화면이 거짓을 말한다) ③ 엔드포인트별 저장과 어드민 배선이 살아 있다.
 *
 * ## 못 보는 것
 *
 * · `detail` 응답이 실제로 어떤 모양인지 (배포 + 다음 detail 회차 뒤 어드민에서 판정)
 * · 표본 한 건으로 판정한다 — 그 엔드포인트의 모든 행이 같은 모양이라는 보장은 없다
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { probeGoodsField, buildCommerceProbe, GOODS_FIELD_ALIASES } from '@/features/marketing/api/commerce-goods-probe'

const COLLECT = readFileSync('src/features/marketing/api/commerce-notify-collect.ts', 'utf-8')
const ROUTES = readFileSync('src/features/marketing/api/partner-pool.routes.ts', 'utf-8')

describe('취급품목 탐침', () => {
  it('① 라이브에 실제로 들어온 코드 값들을 code 로 판정한다', () => {
    for (const v of ['12', '06', '01', '08', '01 06', '12 08', '01 08 06']) {
      const r = probeGoodsField({ trtmntPrdlstNm: v })
      expect(r.kind, `${v} 는 숫자 코드다`).toBe('code')
      expect(r.field).toBe('trtmntPrdlstNm')
      expect(r.value).toBe(v)
    }
  })

  it('②-1 글자가 있으면 text — 그때는 코드표가 필요 없다', () => {
    for (const v of ['여성의류, 패션잡화', '건강기능식품', '종합몰', '의류+가정용품']) {
      expect(probeGoodsField({ trtmntPrdlstNm: v }).kind, `${v} 는 글자다`).toBe('text')
    }
  })

  it('②-2 차선 별칭이 글자면 그것도 잡아낸다(이 수리의 목적)', () => {
    // 1순위가 비어 있으면 2순위를 쓴다 — 수집 코드의 `g()` 와 같은 우선순위.
    const r = probeGoodsField({ trtmntPrdlstNm: 'N/A', ntslPrdlstCn: '여성의류, 패션잡화' })
    expect(r.field).toBe('ntslPrdlstCn')
    expect(r.kind).toBe('text')
    // 둘 다 값이 있어도 **양쪽을 다 보여야** 한다 — 그게 "코드표 불필요" 를 판정하는 근거다.
    //   🔁 2026-10-25 재조준: `kind` 기대값을 `'code'` 로 박아 뒀는데 그건 **1순위가 코드이던
    //   시절의 값**이다(그날 한글을 코드 앞으로 옮겼다 — 같은 레코드가 `'01 02'` 와
    //   `'종합몰 교육/도서/완구/오락'` 을 쌍으로 준다). 지키려던 것은 *탐침의 우선순위가 수집
    //   코드와 같다* 이므로, 순서가 또 바뀌어도 안 낡게 **1순위 별칭에서 파생**해 판정한다.
    const both = probeGoodsField({ trtmntPrdlstNm: '12', ntslPrdlstCn: '여성의류' })
    expect(both.field, '탐침의 1순위가 수집 코드의 1순위와 다르다').toBe(GOODS_FIELD_ALIASES[0])
    expect(both.byField?.trtmntPrdlstNm, '코드 별칭의 값이 안 보인다').toBe('12')
    expect(both.byField?.ntslPrdlstCn, '한글 별칭의 값이 안 보인다').toBe('여성의류')
  })

  it('②-3 값 없음 표기를 값으로 읽지 않는다', () => {
    for (const v of ['', ' ', 'N/A', '-', 'null', '해당없음']) {
      expect(probeGoodsField({ trtmntPrdlstNm: v }).kind, `${JSON.stringify(v)} 는 값이 아니다`).toBe('none')
    }
    expect(probeGoodsField(null).kind).toBe('none')
    expect(probeGoodsField({ bzmnNm: '카츠' }).kind, '취급품목 필드가 아예 없는 status 응답').toBe('none')
  })

  it('③ 🔒 별칭 목록이 수집 코드(`mapCommerceLead`)와 **같은 순서**다', () => {
    // 두 벌이 되면 어드민 화면이 "글자다" 라고 말하는데 저장은 코드를 쓰는 식으로 갈린다.
    const m = COLLECT.match(/const goods = g\(it,\s*([^)]+)\)/)
    expect(m, '수집 코드의 별칭 호출을 못 찾았다 — 이름이 바뀌었으면 이 시험도 재조준할 것').toBeTruthy()
    const inCollect = [...m![1]!.matchAll(/'([^']+)'/g)].map(x => x[1]!)
    expect(inCollect.length, '별칭 파싱이 비었다(통과가 아니라 고장)').toBeGreaterThanOrEqual(4)
    expect([...GOODS_FIELD_ALIASES]).toEqual(inCollect)
  })

  it('④ 엔드포인트별 샘플·커버리지를 저장한다(한 변수 공유로 되돌아가면 detail 을 또 못 본다)', () => {
    expect(COLLECT, 'by_service 를 diag 에 안 싣는다').toMatch(/by_service\s*[:?]/)
    expect(COLLECT, '서비스 이름으로 칸을 가르지 않는다').toMatch(/byService\[svc\.name\]/)
    // 공유 변수도 그대로 둔다 — 기존 어드민 probe 가 그걸 읽는다(호환).
    expect(COLLECT).toMatch(/diag: \{ configured: true, error, sample, coverage/)
  })

  it('⑤ 어드민 탐침이 엔드포인트별 답을 **실제로 돌려준다**', () => {
    // 라이브 모양 그대로: status 는 취급품목이 없고(18키), detail 에만 숫자 코드가 온다.
    const probe = buildCommerceProbe({
      sample: { bzmnNm: '카츠', rprsvEmladr: 'a@naver.com' },
      by_service: {
        status: { sample: { bzmnNm: '카츠', rprsvEmladr: 'a@naver.com' } },
        detail: { sample: { bzmnNm: '카츠', trtmntPrdlstNm: '12', ntslMthdNm: '02' } },
      },
    })
    expect(probe?.goods?.status?.kind, 'status 엔 취급품목이 없다').toBe('none')
    expect(probe?.goods?.detail?.kind, 'detail 의 숫자 코드를 code 로 판정해야 한다').toBe('code')
    expect(probe?.goods?.detail?.value).toBe('12')
    expect(probe?.emailField, '이메일 필드를 키 이름으로 찾아야 한다').toBe('rprsvEmladr')
    expect(probe?.hasEmail).toBe(true)
    // 차선 별칭이 한글인 날 — 그때는 코드표가 필요 없다는 답이 화면에 떠야 한다.
    const textual = buildCommerceProbe({ sample: { x: 1 }, by_service: { detail: { sample: { ntslPrdlstCn: '여성의류, 패션잡화' } } } })
    expect(textual?.goods?.detail?.kind).toBe('text')
    // 옛 스냅샷(by_service 없음)도 공유 sample 로 재 본다 — '안 돌았다'와 '필드 없다'를 구분한다.
    const legacy = buildCommerceProbe({ sample: { trtmntPrdlstNm: '01 06' } })
    expect(legacy?.goods?.shared?.kind).toBe('code')
    expect(buildCommerceProbe({}), '샘플이 아예 없으면 탐침도 없다').toBeUndefined()
  })

  it('⑥ 어드민 라우트가 그 조립을 부른다(배선)', () => {
    // ⚠️ `toContain('buildCommerceProbe')` 로는 안 된다 — `import` 줄만 남겨도 통과한다(주입이 잡았다).
    //   지키려는 것은 *이름이 있다* 가 아니라 **그 값이 실제로 응답에 실린다** 다.
    expect(ROUTES, '라우트가 탐침 결과를 commerceProbe 에 안 담는다 — 화면에 답이 안 뜬다')
      .toMatch(/const commerceProbe = buildCommerceProbe\(/)
  })
})
