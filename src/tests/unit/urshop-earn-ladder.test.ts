import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// 🩸 2026-08-27: 자체 codeOnly(정규식판)는 **라인 주석 안의 `/*`** 를 블록 주석 시작으로 읽어
//   그 뒤 수천 자를 삼킨다(실측 5,911자). 삼켜도 예외가 없어 부정 단언이 조용히 늘 통과한다.
//   공용 스캐너로 통일 — 경위는 `helpers/source-text.ts`.
import { stripComments as codeOnly } from '../helpers/source-text'

/**
 * 🪜 2026-08-27 — 유어샵 수익 사다리 + 딜 우선 정렬 (대표 확정 "일단 그렇게 하자").
 *
 * ## 이 가드가 지키는 것
 *   ① 딜 조건을 **또 베끼지 않는다** — 호출부는 SSOT(`findActiveDealPctsBySeller`)를 부른다
 *   ② 유어샵 핀에 `deal_pct` 가 실려 온다(안 실리면 화면이 영원히 한 덩어리)
 *   ③ 딜 있는 핀이 **맨 위 섹션**이고, 각 덩어리 안의 **주인 순서(position)는 안 덮는다**
 *   ④ 사다리가 `pins.length` 로 막히지 않는다 — 빈 유어샵일수록 필요하다
 *   ⑤ 검색 모수 = 담은 사람 ∪ 공개켬, 명시 옵트아웃 제외. **가입자 전원은 아니다**
 *
 * ## 못 막는 것
 *   - 실제 렌더/정렬 결과(소스 검사다). 시각 확인은 사람이 한다.
 *   - 요율 값 자체(어드민이 바꾼다 — 화면은 서버/정책 기본값을 읽을 뿐).
 */
const SSOT = 'src/worker/utils/influencer-deal.ts'
const CURATOR_ROUTE = 'src/worker/routes/curator.routes.ts'
const DISCOVERY = 'src/features/group-buy/api/marketing/discovery.ts'
const PAGE = 'src/pages/CuratorPage.tsx'
const LADDER = 'src/pages/curator-page/EarnLadder.tsx'
const read = (f: string) => readFileSync(f, 'utf-8')
/** 부정 단언은 주석을 걷어내고 — 주석 속 옛 코드 인용에 걸리는 사고가 이 레포에서 반복됐다. */


describe('① 딜 조건은 SSOT 한 곳에만 있다', () => {
  it('SSOT 가 배치 조회를 제공한다', () => {
    const ssot = read(SSOT)
    expect(ssot).toContain('export async function findActiveDealPctsBySeller')
    // 세 조건이 SSOT 안에 있어야 한다 — 여기가 무너지면 아래 위임이 의미 없다.
    for (const cond of ["status = 'active'", 'ends_at IS NULL OR ends_at', 'requires_content_proof']) {
      expect(ssot, `SSOT 조건 붕괴: ${cond}`).toContain(cond)
    }
  })

  for (const [label, f] of [['소개자 카탈로그', DISCOVERY], ['유어샵 핀', CURATOR_ROUTE]] as const) {
    it(`${label} — 조건을 베끼지 않고 SSOT 를 부른다`, () => {
      const src = read(f)
      expect(src, 'SSOT 위임이 사라졌다').toContain('findActiveDealPctsBySeller(')
      // 🩸 복사본은 결국 갈린다. WHERE 절이 호출부에 다시 나타나면 그게 드리프트의 시작이다.
      expect(codeOnly(src), '딜 WHERE 절이 호출부에 다시 복사됐다')
        .not.toContain('requires_content_proof')
    })
  }
})

describe('② 유어샵 핀이 딜 정보를 싣고 온다', () => {
  const src = read(CURATOR_ROUTE)
  it('핀 SELECT 컬럼 목록에 seller_id 가 있다 (딜 매칭 키)', () => {
    // ⚠️ 파일 전체 검색은 다른 쿼리의 seller_id 에 걸린다 — 핀 SELECT 의 컬럼 목록만 잘라 본다.
    const i = src.indexOf('SELECT pp.id, pp.product_id')
    expect(i, '핀 쿼리가 사라졌다').toBeGreaterThan(-1)
    const cols = src.slice(i, src.indexOf('FROM product_pins', i))
    expect(cols, 'seller_id 가 없으면 딜 매칭이 항상 실패한다(무음)').toContain('p.seller_id')
  })
  it('응답 핀마다 deal_pct 를 붙인다', () => {
    expect(src).toContain('deal_pct:')
  })
})

describe('③ 딜 있는 핀이 맨 위 · 주인 순서는 안 덮는다', () => {
  const page = read(PAGE)
  it('dealPins 그룹이 있고 섹션으로 렌더된다', () => {
    expect(page).toContain('dealPins')
    expect(page).toMatch(/<PinGrid pins=\{applyQ\(dealPins\)\}/)
  })
  it('딜 섹션이 다른 섹션보다 먼저 나온다', () => {
    const d = page.indexOf('applyQ(dealPins)}')
    const s2 = page.indexOf('applyQ(shopPins)}')
    const v = page.indexOf('applyQ(voucherPins)}')
    expect(d).toBeGreaterThan(-1)
    expect(d, '딜 섹션이 추천템보다 뒤에 있다').toBeLessThan(s2)
    expect(d, '딜 섹션이 교환권보다 뒤에 있다').toBeLessThan(v)
  })
  it('정렬이 아니라 filter 로 가른다 — position 을 덮지 않는다', () => {
    // 🔑 주인이 드래그로 맞춘 순서(position)가 사라지면 재정렬 기능이 무의미해진다.
    //    filter 는 원래 순서를 보존한다. sort 가 등장하면 그 계약이 깨진 것이다.
    const i = page.indexOf('const { dealPins, shopPins, voucherPins }')
    expect(i, '핀 그룹 계산이 사라졌다').toBeGreaterThan(-1)
    const block = page.slice(i, page.indexOf('}, [data])', i))
    expect(block).toContain('.filter(hasDeal)')
    expect(codeOnly(block), '핀을 sort 로 재배열하면 주인이 정한 순서가 사라진다').not.toContain('.sort(')
  })
})

describe('④ 사다리는 빈 유어샵에서도 보인다', () => {
  it('pins.length 로 막지 않는다', () => {
    const page = read(PAGE)
    const i = page.indexOf('<EarnLadder')
    expect(i, '사다리가 배치되지 않았다').toBeGreaterThan(-1)
    // 사다리를 감싸는 조건절을 앞쪽에서 잘라 본다 — 거기에 pins.length 게이트가 있으면 안 된다.
    const guard = page.slice(page.lastIndexOf('{ownerView', 0 + i), i)
    expect(guard, '빈 유어샵에서 사다리가 숨으면, 그때 보이는 건 "적립 ₩0" 뿐이다')
      .not.toContain('pins.length > 0')
  })
  it('1단(영입)·2단(딜)·3단(담기)이 모두 있다', () => {
    const l = read(LADDER)
    expect(l).toContain('가게를 데려오세요')
    expect(l).toContain('소개비를 정하세요')
    expect(l).toContain('담아서 파세요')
    // 요율은 하드코딩하지 않는다 — 어드민이 바꾸는 값이다.
    expect(l).toContain('COMMISSION_DEFAULTS.INFLUENCER_STORE_INTRO_PCT')
  })
  it('초대 링크가 ?ref= 로 나간다 (귀속의 유일한 자동 경로)', () => {
    expect(read(LADDER)).toContain('/store/new?ref=')
  })
})

describe('⑤ 검색 모수 — 담은 사람은 자동, 가입자 전원은 아니다', () => {
  const src = read(DISCOVERY)
  it('핀을 담았거나 공개를 켠 사람', () => {
    expect(src).toContain('pin.n > 0 OR COALESCE(p.is_open, 0) = 1')
  })
  it('명시적으로 공개를 끈 사람은 제외 (옵트아웃 보존)', () => {
    expect(src).toContain('COALESCE(p.is_open, 1) = 1')
  })
  it('유어샵 주소가 없으면 넣지 않는다', () => {
    expect(src).toContain("u.handle IS NOT NULL AND u.handle != ''")
  })
})
