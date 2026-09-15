/**
 * 🧭 대시보드 Rinda 껍데기 불변식 (2026-09-14 대표 시안)
 *   시안·근거: `docs/design/dashboard-rinda-2026-09.md`
 *
 * 대표: *"rinda처럼 보이게, 그리고 쉽게 모두 해당이야."* · *"셀러대시보드 메인이 … 너무 보기 안좋아."*
 *
 * ⚠️ **이 테스트가 못 막는 것**(과신 금지):
 *   - 실제 대비·간격·"보기 좋은가" — 그건 렌더해서 눈으로 봐야 한다(이 세션은 Playwright 로 봤다).
 *   - 사이드바 **밖**(개별 페이지 본문)의 잔여 검은 버튼·그림자 카드.
 *   여기서 고정하는 것은 **되돌아가면 조용히 깨지는 배선** 넷뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { stripComments } from '../helpers/source-text'

const ROOT = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')

/** JSX/TS 주석을 걷어낸다 — 설명 글의 단어가 검사에 걸리는 오탐을 막는다.
 *  ⚠️ 자체 정규식을 쓰지 않는다 — 문자열 안의 `/*` 에 물려 소스가 통째로 증발하는 함정
 *     (`check-comment-stripper` 가 2026-09-13 부터 막는다). SSOT `stripComments` 로만. */
const strip = (s: string) => stripComments(s)

describe('R1 대시보드 사이드바는 흰 면이다 (검은 사이드바로 되돌아가지 않는다)', () => {
  const FILES = [
    'src/components/SellerLayout.tsx',
    'src/components/AdminLayout.tsx',
    // 📱 2026-09-14 (모바일 우선 재설계): 심플 nav 는 삭제됐고 하단 탭이 그 자리를 맡는다.
    'src/components/seller-layout/SellerBottomTabs.tsx',
  ]
  it.each(FILES)('%s 에 어두운 사이드바 토큰이 없다', (f) => {
    const src = strip(read(f))
    // 종전 사이드바 색(#0A0A0B)과 그 위에서만 쓰이던 반투명 흰 글자.
    expect(src).not.toMatch(/#0A0A0B/i)
    expect(src).not.toMatch(/text-white\/\d/)
    expect(src).not.toMatch(/bg-white\/\[?0?\.?\d/)
  })

  it('셀러 사이드바가 흰 면 + 헤어라인을 실제로 쓴다 (0건이면 통과가 아니라 실패)', () => {
    const src = strip(read('src/components/SellerLayout.tsx'))
    expect(src).toMatch(/<aside className="[^"]*\bbg-white\b[^"]*\bborder-r\b/)
  })
})

describe('R2 라이트 래퍼가 브랜드 틴트를 되박는다 (다크 모드 누수 차단)', () => {
  /**
   * 🩸 실제 사고 클래스: `.seller-light-theme` 는 `--lift`/`--rule`/`--tone-*` 만 라이트로 되박고
   *   `--brand-tint` 를 빠뜨렸다. 사용자가 OS/앱 다크 모드를 켜 두면 `:root.dark` 의
   *   `--brand-tint: #16243D`(남색)가 새어 들어와 **활성 메뉴 알약이 검게** 뜬다.
   *   사이드바가 흰 면이 되면서 비로소 도달 가능해진 경로라, 되돌리면 조용히 재발한다.
   */
  const css = read('src/index.css')
  const block = (sel: string) => {
    const i = css.indexOf(sel)
    expect(i, `${sel} 셀렉터가 index.css 에 있어야 한다`).toBeGreaterThan(-1)
    return css.slice(i, css.indexOf('}', i))
  }
  it('.seller-light-theme 이 --brand-tint 를 라이트 값으로 고정한다', () => {
    expect(block('.seller-light-theme {')).toMatch(/--brand-tint:\s*#EAF1FE/i)
  })
  it('어드민/에이전시 래퍼도 같이 고정한다', () => {
    expect(block('.light-island, .force-light-theme, .admin-light-theme, .agency-light-theme {'))
      .toMatch(/--brand-tint:\s*#EAF1FE/i)
  })
  it('활성 메뉴 알약이 그 토큰을 쓴다', () => {
    expect(css).toMatch(/\.ur-seller-nav-active[\s\S]{0,160}background:\s*var\(--brand-tint\)/)
  })
})

describe('R3 사이드바 CTA 로 옮겨도 검색 색인에서 사라지지 않는다', () => {
  /**
   * 🔑 '이용권 등록'을 파란 CTA 로 뽑아내면서 **그리는 목록만** 걸렀다.
   *   `orderedNavGroups`(⌘K 색인의 원본)에서까지 빼면 그 페이지는 메뉴에도 검색에도 없어진다 —
   *   이 레포가 반복해 겪은 "페이지는 있는데 닿을 수 없다"의 재발이다.
   */
  // 📱 2026-09-14: 계산이 `useSellerNavModel`(SSOT)로 뽑혀 나갔다 — 사이드바·하단 탭·더보기가 같은 목록을 쓴다.
  const src = strip(read('src/components/seller-layout/useSellerNavModel.ts'))
  it('CTA 는 renderedNavGroups 로만 걸러진다 (orderedNavGroups 원본은 무손상)', () => {
    expect(src).toMatch(/const renderedNavGroups = orderedNavGroups/)
    // 그리는 쪽은 걸러진 목록(moreGroups = renderedNavGroups)만 받는다.
    expect(src).toMatch(/moreGroups: renderedNavGroups/)
    expect(strip(read('src/components/SellerLayout.tsx'))).toMatch(/moreGroups\.map/)
    // 검색 색인(commandItems)은 여전히 거르지 않은 원본을 쓴다.
    expect(src).toMatch(/\.\.\.orderedNavGroups\.flatMap\(\(g\) => g\.items\.map/)
  })
  it('그 역할에 항목이 없으면 CTA 도 안 뜬다 (역할별 노출 규칙 승계)', () => {
    expect(src).toMatch(/const ctaItem = orderedNavGroups\.flatMap/)
    // 그리는 쪽(레이아웃)은 모델이 준 ctaItem 이 있을 때만 파란 버튼을 그린다.
    expect(strip(read('src/components/SellerLayout.tsx'))).toMatch(/\{ctaItem && \(/)
  })
})

describe('R4 홈의 행동 칩에 검은 면이 없다 (강조는 브랜드 한 가지)', () => {
  /**
   * 종전엔 `bg-gray-900` 타일이 조건에 따라 **동시에 셋까지** 떴다(이용권 등록 + 미처리 주문 + 정산).
   * 셋이 똑같이 새까매서 무엇이 급한지 구별해 주지 못했다 — 대표가 말한 "헷갈린다"의 한 축.
   * 📱 2026-09-14 오후: 타일(`PrimaryActions`)은 홈 M2 로 바뀌며 삭제됐다 — 그 자리는 '지금 처리할 일' 행의 칩이다.
   */
  it('TodoRows 에 bg-gray-900 / bg-black 면이 없다', () => {
    const src = strip(read('src/pages/seller-page/TodoRows.tsx'))
    expect(src).not.toMatch(/bg-gray-900/)
    expect(src).not.toMatch(/bg-black(?![/\w-])/)
  })
  it('행동 칩은 브랜드 틴트 한 가지로만 준다 (0건이면 통과가 아니라 실패)', () => {
    const src = strip(read('src/pages/seller-page/TodoRows.tsx'))
    expect(src).toMatch(/const ACT = 'rounded-lg bg-brand-tint px-3 py-2 text-xs font-bold text-brand-text'/)
  })
})

describe('R5 정산 금액을 건수로 말하지 않는다', () => {
  /** 🐛 ₩412,000 이 "정산 가능 412000건" 으로 찍히던 자리. 돈을 세는 단위로 말하면 안 된다. */
  it('홈의 할 일 행이 금액 키(settlementAvailableAmount)를 쓴다', () => {
    // 📱 2026-09-14 오후: 그 문자열은 홈 M2 의 '지금 처리할 일' 행(TodoRows)으로 옮겨 갔다.
    const src = strip(read('src/pages/seller-page/TodoRows.tsx'))
    expect(src).toMatch(/settlementAvailableAmount/)
    expect(src).not.toMatch(/settlementAvailableCount/)
  })
  it.each(['ko', 'en', 'ja', 'zh', 'es', 'fr'])('%s 로케일에 그 키가 있다', (lng) => {
    const j = JSON.parse(read(`public/locales/${lng}/translation.json`))
    expect(j.seller?.settlementAvailableAmount).toMatch(/\{\{amount\}\}/)
  })
})
