/**
 * 🏷️ 유어샵 머리 2안 — 긴 이름 한 줄 + 컴팩트 (2026-11-01 대표 확정 **2안**)
 *
 * ## 무엇을 지키나
 * 대표 신고: *"리스터코퍼레이션 이렇게 길게 하니까 두줄이 되네? 아무리 길어도 1줄로 … 공백 공간?
 * 전체적인 UI가 별로인데 … 좀 더 컴팩트하게."*
 *
 * 390px 실측으로 원인은 **글자 크기가 아니라 자리**였다 — 이름 칸이 **132px**(같은 줄 오른쪽
 * 버튼 묶음이 131px 을 먼저 가져간다). 24px 한글은 거기에 5자까지라 8자가 두 줄이 됐다.
 * 2안은 버튼을 **로고 줄로** 올려 칸을 **294px** 로 넓히고, 글자 크기를 **글자 수로** 정한다.
 *
 * ## 이 파일이 **못** 보는 것 (과신 금지)
 * - 실제 픽셀. jsdom 엔 레이아웃이 없다 — 한 줄인지의 최종 판정은 브라우저 렌더다
 *   (`node scripts/visual-preview.mjs --route=/u/jiwon1228 --width=390 --ushop-name=… --probe='header h1'`).
 *   실측 결과는 `docs/design/ushop-compact-2026-11-01.md` 에 있다.
 * - 폰트가 바뀌었을 때의 폭 추정 오차. 추정은 **안전 쪽**(과대)으로만 틀리게 설계돼 있다.
 * - 보기에 좋은지. 그건 대표가 그림으로 판정했다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, readRaw } from '../helpers/source-text'
import {
  ushopNameSizePx, ushopNameWidthPx, USHOP_NAME_SIZES, USHOP_NAME_BOX_PX, USHOP_NAME_MIN_PX,
} from '@/shared/ushop-name-size'
import {
  pinCategory, showUShopChips, showUShopSort, USHOP_SORT_MIN_PINS,
} from '@/shared/ushop-pin-category'
import { CURATOR_FS_CLASS } from '@/worker/utils/curator-ssr-body'

const HEADER = 'src/pages/curator-page/CuratorHeader.tsx'
const WORKER = 'src/worker/utils/curator-ssr-body.ts'
const PAGE = 'src/pages/CuratorPage.tsx'
const CHIPS = 'src/pages/curator-page/PinCategoryChips.tsx'

describe('① 이름 크기 — 글자만 보고 정한다(측정 금지)', () => {
  it('타입 스케일 ⑧ 안의 값만 쓴다', () => {
    // 본문 5단계는 12·13·15·17·24. 그 밖의 값(20·22 …)이 들어오면 화면마다 체계가 갈린다.
    for (const px of USHOP_NAME_SIZES) expect([12, 13, 15, 17, 24]).toContain(px)
    expect(USHOP_NAME_SIZES.length, '단계가 사라지면 축소가 무의미해진다').toBeGreaterThanOrEqual(2)
    // 큰 것부터 내려가야 한다 — 뒤집히면 짧은 이름이 작게 나온다.
    const sorted = [...USHOP_NAME_SIZES].sort((a, b) => b - a)
    expect([...USHOP_NAME_SIZES]).toEqual(sorted)
  })

  it('실제로 줄인다 — 긴 이름일수록 작아지고, 짧으면 가장 큰 단계', () => {
    expect(ushopNameSizePx('정지원')).toBe(USHOP_NAME_SIZES[0])
    expect(ushopNameSizePx('리스터코퍼레이션')).toBe(USHOP_NAME_SIZES[0])
    // 21자(법인 긴 이름)는 한 단계 내려간다.
    expect(ushopNameSizePx('주식회사리스터코퍼레이션코리아글로벌홀딩스')).toBe(USHOP_NAME_MIN_PX)
    // 단조성: 이름이 길어지면서 크기가 **커지는** 구간이 없어야 한다.
    let prev = Infinity
    for (let n = 1; n <= 40; n++) {
      const px = ushopNameSizePx('가'.repeat(n))
      expect(px).toBeLessThanOrEqual(prev)
      prev = px
    }
  })

  it('고른 크기는 칸에 실제로 든다(바닥 전까지) — 추정이 헛돌지 않는다', () => {
    for (let n = 1; n <= 40; n++) {
      const name = '가'.repeat(n)
      const px = ushopNameSizePx(name)
      if (px === USHOP_NAME_MIN_PX) continue // 바닥: 넘치면 말줄임이 받는다(설계)
      expect(ushopNameWidthPx(name, px), `${n}자`).toBeLessThanOrEqual(USHOP_NAME_BOX_PX)
    }
    // 🩸 "전부 바닥이라 위 루프가 헛돈다" 를 막는다 — 가장 큰 단계가 실제로 쓰여야 한다.
    expect(ushopNameSizePx('가')).toBe(USHOP_NAME_SIZES[0])
  })

  it('한글은 ASCII 보다 넓게 센다(둘이 같으면 추정이 아니다)', () => {
    expect(ushopNameWidthPx('가가가가', 17)).toBeGreaterThan(ushopNameWidthPx('abcd', 17) * 1.5)
    expect(ushopNameWidthPx('', 17)).toBe(0)
  })

  it('칸 상수가 머리 마크업과 맞는다 — 얼굴 40 + 옆 여백 20 + gap 16', () => {
    const h = readCode(HEADER)
    expect(h, '얼굴 40px').toMatch(/const avatarCls = 'w-10 h-10 /)
    expect(h, '이름 줄 여백·gap').toMatch(/flex items-center gap-4 px-5 pt-3/)
    // 390(폰) − 40(px-5 양쪽) − 40(얼굴) − 16(gap-4) = 294
    expect(USHOP_NAME_BOX_PX).toBe(390 - 40 - 40 - 16)
  })
})

describe('② 화면과 워커가 같은 함수를 쓴다(두 벌이면 마운트 때 머리가 튄다)', () => {
  it('둘 다 `ushopNameSizePx` 로 크기를 정한다', () => {
    expect(readCode(HEADER)).toMatch(/const nameSize = ushopNameSizePx\(curator\.name\)/)
    expect(readCode(WORKER)).toMatch(/const nameSize = ushopNameSizePx\(c\.name\)/)
    // 🔴 계산만 하고 **안 쓰면** 아무 일도 안 일어난다(이 레포가 반복해 밟은 자리) —
    //   h1 태그 자체가 그 값을 싣는지 본다.
    const h1 = readCode(HEADER).match(/<h1[^>]*>/)![0]
    expect(h1, '화면 h1 이 nameSize 를 쓴다').toContain('style={{ fontSize: nameSize }}')
    expect(h1, '화면이 고정 크기를 박지 않는다').not.toMatch(/text-\[\d+px\]/)
    const wh1 = readCode(WORKER).match(/<h1 style="font-size:[^"]*"/)![0]
    expect(wh1, '워커가 고정 크기를 박지 않는다').toContain('${nameSize}px')
  })

  it('워커는 그 값을 inline style 로 h1 에 싣는다', () => {
    expect(readCode(WORKER)).toMatch(/<h1 style="font-size:\$\{nameSize\}px"/)
  })

  it('SSOT 모듈이 React·아이콘·i18n 을 끌어오지 않는다(워커가 못 읽게 된다)', () => {
    for (const f of ['src/shared/ushop-name-size.ts', 'src/shared/ushop-pin-category.ts']) {
      const code = readCode(f)
      expect(code, f).not.toMatch(/from '(react|@\/components|@\/lib\/i18n|@\/pages)/)
      expect(code, `${f} — import 가 하나도 없어야 한다(순수)`).not.toMatch(/^import /m)
    }
  })
})

describe('③ 한 줄 보장 — 크기로 안 되면 말줄임이 받는다', () => {
  it('화면은 `truncate`, 두 줄 허용으로 안 돌아간다', () => {
    const h = readCode(HEADER)
    expect(h).toMatch(/truncate">\{curator\.name\}/)
    expect(h).not.toMatch(/line-clamp-2[^"]*">\{curator\.name\}/)
    // `truncate` 가 flex 안에서 먹으려면 `min-w-0` 이 함께 있어야 한다(없으면 칸이 밀려 안 잘린다).
    expect(h).toMatch(/className="min-w-0 [^"]*truncate">\{curator\.name\}/)
  })
  it('워커 미러도 같은 클래스다', () => {
    expect(CURATOR_FS_CLASS.h1).toContain('truncate')
    expect(CURATOR_FS_CLASS.h1).toContain('min-w-0')
    expect(CURATOR_FS_CLASS.h1).not.toContain('line-clamp-2')
  })
  it('소개도 한 줄이다(칸이 넓어져 지금 소개는 원래 한 줄)', () => {
    expect(readCode(HEADER)).toMatch(/line-clamp-1">\{curator\.bio\}/)
    expect(CURATOR_FS_CLASS.bio).toContain('line-clamp-1')
  })
})

describe('④ 칩·정렬 줄 — 화면이 그릴 때만 서버가 자리를 예약한다', () => {
  it('판정은 SSOT 하나 — 화면도 워커도 같은 함수를 부른다', () => {
    expect(readCode(CHIPS)).toMatch(/if \(!showUShopChips\(pins\)\) return null/)
    expect(readCode(PAGE)).toMatch(/\{showUShopSort\(pins\) && \(/)
    const w = readCode(WORKER)
    expect(w).toMatch(/showUShopChips\(pins\) \?/)
    expect(w).toMatch(/showUShopSort\(pins\) \?/)
  })

  it('분류가 하나뿐이면 칩을 안 그린다(전체 + 그 하나 = 늘 같은 목록)', () => {
    const p = (c: string) => ({ category: c })
    expect(showUShopChips([p('meal_voucher')])).toBe(false)
    expect(showUShopChips([p('meal_voucher'), p('meal_voucher')])).toBe(false)
    expect(showUShopChips([p('meal_voucher'), p('stay_voucher')])).toBe(true)
    expect(showUShopChips([]), '빈 진열대').toBe(false)
  })

  it('정렬은 한 화면에 안 들어오기 시작할 때부터', () => {
    expect(USHOP_SORT_MIN_PINS).toBe(5)
    expect(showUShopSort(new Array(4).fill(0))).toBe(false)
    expect(showUShopSort(new Array(5).fill(0))).toBe(true)
  })

  it('분류 판정이 교환권·이용권·상품을 가른다', () => {
    expect(pinCategory({ category: 'meal_voucher' })).toBe('meal_voucher')
    expect(pinCategory({ category: 'beauty_voucher' })).toBe('beauty_voucher')
    expect(pinCategory({ category: 'lifestyle', deal_only: 1 })).toBe('etc_voucher')
    expect(pinCategory({ category: 'lifestyle' })).toBe('shop')
    expect(pinCategory({})).toBe('shop')
  })

  it('🔴 호출부가 조건을 베껴 적지 않는다 — 숫자를 손으로 쓰면 언젠가 갈린다', () => {
    const page = readCode(PAGE)
    expect(page, '정렬 임계값을 페이지에 적지 않는다').not.toMatch(/pins\.length >= 5/)
    expect(readCode(CHIPS), '칩 조건을 부품에 다시 적지 않는다').not.toMatch(/defs\.length <= 2/)
  })
})

describe('⑤ 버튼 묶음이 이름 줄을 떠났다(그것이 두 줄의 원인이었다)', () => {
  it('로고 줄에 있고, 로고만 PC 에서 숨는다', () => {
    const h = readCode(HEADER)
    expect(h, '줄은 PC 에도 있다').toMatch(/className="flex items-center px-5 pt-3"/)
    expect(h, '로고만 PC 에서 숨긴다').toMatch(/className="lg:hidden active:opacity-70"/)
    expect(h, '버튼 묶음이 그 줄 안에').toMatch(/<UrDealLogo size=\{19\} \/>[\s\S]{0,80}<\/Link>\s*\{cluster\}/)
  })
  it('워커 미러도 같다', () => {
    expect(CURATOR_FS_CLASS.brandBar).toBe('flex items-center px-5 pt-3')
    expect(CURATOR_FS_CLASS.brandLogo).toBe('lg:hidden active:opacity-70')
    expect(CURATOR_FS_CLASS.cluster).toBe('ml-auto flex items-center gap-2 shrink-0')
  })
  it('⚠️ 이 파일이 못 보는 것을 적어 둔다(다음 세션이 과신하지 않게)', () => {
    // 한 줄인지의 **최종 판정은 브라우저**다. 그 절차가 머리말과 시안 문서에 적혀 있는지만 잠근다.
    expect(readRaw('src/tests/unit/ushop-compact-head-2026-11-01.test.ts')).toContain('visual-preview.mjs')
    expect(readRaw(HEADER)).toContain('2026-11-01')
  })
})
