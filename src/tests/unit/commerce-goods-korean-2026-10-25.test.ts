/**
 * 🏷️ 통신판매 업종 분류 — **코드가 아니라 한글 필드로 판정한다** (2026-10-25).
 *
 * ## 무엇이 문제였나 (라이브 실측)
 *
 * 발송 가능 리드의 **93.0%**(58,389/62,757)가 업종 `'통신판매'` 한 라벨로 뭉쳐 있었다. 원인은
 * 분류기가 아니라 **별칭 순서**였다 — 공정위 등록상세는 같은 뜻을 **두 벌**로 준다:
 *
 * ```
 *   trtmntPrdlstNm = '01 02'                        ← 숫자 코드
 *   ntslPrdlstCn   = '종합몰 교육/도서/완구/오락'      ← 같은 뜻의 한글
 *   (coverage 둘 다 31% = 155/500 → 같은 행에 쌍으로 온다)
 * ```
 *
 * `g()` 가 코드 쪽을 **먼저** 보고 있었고, 그 값이 비어 있지 않으므로 거기서 멈췄다. 분류기는 한글
 * 정규식이라 `'01 02'` 에 한 건도 안 맞아 전부 `'통신판매'` 로 떨어졌다. 에러가 0건이라 아무 신호가 없었다.
 *
 * 🔑 **그래서 공정위 코드표(01~12)를 받을 필요가 없어졌다** — 2026-10-24~25 에 그 표를 구하려
 * 결재까지 올렸는데, 한글이 같은 레코드에 이미 들어 있었다.
 *
 * ## 이 시험이 지키는 것
 *
 * ① 실측한 문자열이 **실제로** 올바른 버킷으로 간다(문자열 검사가 아니라 함수를 돌린다)
 * ② 합성 문자열에서 **가장 포괄적인 라벨이 이긴다**(순서 — '완구' 가 '교육·도서'를 가로채지 않게)
 * ③ 코드-only 값은 **분류하지 않는다**(= `'통신판매'` 유지) — 추측 라벨을 만들지 않는다
 * ④ 별칭 순서가 되돌아가지 않는다(한글이 코드보다 앞)
 * ⑤ **추측 라벨을 심지 않는다** — 실측으로 본 낱말만 표에 있다
 *
 * ## 이 시험이 못 보는 것
 *
 * · 나머지 코드(03~12)의 한글 라벨이 실제로 무엇인지 — 회차가 쌓이며 `description` 에 모인다.
 *   그 분포를 보고 표를 넓히는 것은 **다음 작업**이고, 그때도 기억으로 적지 말 것.
 * · 라이브에서 93% 가 실제로 내려가는지 — detail 회차가 쌓여야 하고 판정은 D1 집계다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { productBucket, mapCommerceLead } from '@/features/marketing/api/commerce-notify-collect'

const SRC = readCode('src/features/marketing/api/commerce-notify-collect.ts')

/** 2026-10-25 16:00 KST 회차의 detail 레코드에서 그대로 가져온 값(지어내지 않았다). */
const LIVE_GOODS_KO = '종합몰 교육/도서/완구/오락'
const LIVE_GOODS_CODE = '01 02'
const LIVE_METHOD_KO = '인터넷 카탈로그'
const LIVE_METHOD_CODE = '02 03'

describe('통신판매 업종 분류 — 한글 필드 (2026-10-25)', () => {
  it('① 실측 한글 문자열이 종합몰로 분류된다 — 함수를 실제로 돌린다', () => {
    expect(productBucket(LIVE_GOODS_KO)).toBe('종합몰')
  })

  it('② 합성 문자열에서 좁은 낱말이 포괄 라벨을 가로채지 않는다', () => {
    // '완구'(유아동)·'도서'(도서·문구) 가 둘 다 들어 있는데 종합몰이 이겨야 한다.
    expect(productBucket(LIVE_GOODS_KO)).toBe('종합몰')
    // 종합몰이 빠진(= 코드 02 단독) 경우엔 교육·도서가 이긴다 — '완구' 가 아니다.
    expect(productBucket('교육/도서/완구/오락')).toBe('도서·문구')
    // 그래도 유아동 자체는 살아 있다(완구만 있으면 유아동).
    expect(productBucket('완구/장난감')).toBe('유아동')
  })

  it('③ 숫자 코드만인 값은 분류하지 않는다 — 호출부가 `통신판매` 를 유지한다', () => {
    expect(productBucket(LIVE_GOODS_CODE)).toBeNull()
    expect(productBucket('06')).toBeNull()
    expect(productBucket('01 05 08')).toBeNull()
    expect(productBucket('')).toBeNull()
    expect(productBucket(null)).toBeNull()
  })

  it('④ 한글 품목 별칭이 코드 별칭보다 **앞**이다 — 되돌리면 93% 고착으로 돌아간다', () => {
    const m = SRC.match(/const goods = g\(it,([^)]*)\)/)
    expect(m, 'goods 별칭 줄을 못 찾았다 — 이름이 바뀌었으면 이 시험도 재조준할 것').toBeTruthy()
    const order = m![1]!.split(',').map(x => x.trim().replace(/'/g, ''))
    const ko = order.indexOf('ntslPrdlstCn')
    const code = order.indexOf('trtmntPrdlstNm')
    expect(ko, 'ntslPrdlstCn(한글)이 별칭 목록에 없다').toBeGreaterThanOrEqual(0)
    expect(code, 'trtmntPrdlstNm(코드)이 목록에서 사라졌다 — 한글이 없는 행의 원문 보존이 깨진다').toBeGreaterThanOrEqual(0)
    expect(ko, '코드가 한글보다 앞이다 — 코드는 비어 있지 않으므로 거기서 멈춰 한글을 영영 못 본다').toBeLessThan(code)
  })

  it('⑤ 판매방식도 한글(`ntslMthdCn`)이 코드보다 앞이다', () => {
    const m = SRC.match(/const method = g\(it,([^)]*)\)/)
    expect(m).toBeTruthy()
    const order = m![1]!.split(',').map(x => x.trim().replace(/'/g, ''))
    expect(order.indexOf('ntslMthdCn')).toBeGreaterThanOrEqual(0)
    expect(order.indexOf('ntslMthdCn')).toBeLessThan(order.indexOf('ntslMthdNm'))
  })

  it('⑥ detail 레코드를 그대로 먹이면 subcategory 가 실제 업종이 된다(코드만 있으면 통신판매)', () => {
    const base = {
      bzmnNm: '테스트상회', brno: '4358101728', rprsvEmladr: 'a@shop.co.kr',
      lctnAddr: '서울특별시 구로구 구로동 611', operSttusCdNm: '정상영업',
    }
    // 한글 + 코드가 쌍으로 온 실제 모양
    const both = mapCommerceLead({ ...base, trtmntPrdlstNm: LIVE_GOODS_CODE, ntslPrdlstCn: LIVE_GOODS_KO, ntslMthdNm: LIVE_METHOD_CODE, ntslMthdCn: LIVE_METHOD_KO } as never)
    expect(both.subcategory, '한글이 있는데 코드를 보고 통신판매로 떨어졌다').toBe('종합몰')
    // 원문 보존: description 에 한글이 남아야 분포를 보고 표를 넓힐 수 있다
    expect(String(both.description || ''), 'description 에 한글 원문이 안 남는다 — 다음 작업이 분포를 못 본다').toContain('종합몰')

    // status 레코드처럼 한글이 **없는** 경우: 코드로는 분류하지 않고 통신판매 유지(추측 금지)
    const codeOnly = mapCommerceLead({ ...base, trtmntPrdlstNm: LIVE_GOODS_CODE } as never)
    expect(codeOnly.subcategory).toBe('통신판매')
  })

  it('⑦ 추측 라벨을 심지 않았다 — 실측 안 한 공정위 라벨이 표에 없다', () => {
    // 어제 상호명으로 역추론만 해 둔 코드(09 성인? · 11 상품권?)는 표본 3·5건짜리 추측이었다.
    // 그 라벨을 버킷 표에 넣으면 되돌리기 어려운 거짓 라벨이 된다(승격 뒤 코드 롤백으로 안 지워진다).
    const table = SRC.slice(SRC.indexOf('const PRODUCT_BUCKETS'), SRC.indexOf('export function productBucket'))
    expect(table, '추측 라벨(성인)이 표에 들어왔다 — 실측 문자열에서 본 낱말만 넣을 것').not.toMatch(/성인/)
    expect(table, '추측 라벨(상품권)이 표에 들어왔다').not.toMatch(/상품권/)
    // 그리고 표가 통째로 비면 안 된다(헛도는 가드 차단)
    expect(table.split("['").length - 1, '버킷 표가 비었다').toBeGreaterThan(8)
  })
})
