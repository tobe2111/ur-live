/**
 * 🏠 생활(이사·입주청소·에어컨 청소) 카테고리 — 2026-10-20 대표 확정.
 *
 * 카테고리를 하나 더하는 일은 "목록에 한 줄"이 아니었다. 이용권 카테고리 목록이 SQL 열네 곳에
 * **손으로** 적혀 있었고, 그중 구매 경로(`group-buy.routes` 의 딜/카드 참여) 두 곳이 빠지면
 * 생활 이용권은 화면엔 뜨는데 **구매 버튼이 "상품을 찾을 수 없습니다"(404)** 를 낸다 — 에러 로그도 없다.
 * ⇒ SQL 목록은 SSOT(`VOUCHER_CATEGORY_SQL_IN`) 하나로 모았고, 이 시험이 손으로 적는 방향을 막는다.
 *
 * ⚠️ 못 보는 것: `group-buy-public.routes.ts`(로딩 잠금 파일)의 손 목록 3곳 — 피드·상세는 SSOT 를 쓰고
 *   상세는 `group_buy_status='active'` 로도 통과하지만, **라이브 티커**(최근 구매 흐름)는 생활 구매를 안 센다.
 *   잠금 해제 승인 뒤에 SSOT 로 옮긴다(아래 허용목록이 그 3곳을 정확히 고정한다).
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readCode } from '../helpers/source-text'
import {
  VOUCHER_CATEGORIES, VOUCHER_CATEGORY_SQL_IN, ALL_VOUCHER_CATEGORY_KEYS, isVoucherCategory, getVoucherShortLabel,
} from '@/shared/constants/voucher-categories'
import { DEAL_CAT_LABELS } from '@/shared/deal-cats'
import { STAYS_CHIPS } from '@/shared/stays-list'
import { MAP_ICON_INNER_FOR_TEST } from '@/shared/map-marker-icons'
import { CATEGORY_META } from '@/shared/deal-category-icon'

const HAND_LIST = "'meal_voucher','beauty_voucher','stay_voucher','etc_voucher'"
/** 잠금 파일 — 승인 전까지 손 목록이 남는다(정확히 이 개수). 늘면 새 손 목록이 생긴 것이다. */
const LOCKED_ALLOW: Record<string, number> = { 'src/features/group-buy/api/group-buy-public.routes.ts': 3 }

describe('생활(home_voucher) 카테고리', () => {
  it('SSOT 에 있고 이용권으로 판정된다', () => {
    expect(VOUCHER_CATEGORIES).toContain('home_voucher')
    expect(isVoucherCategory('home_voucher')).toBe(true)
    expect(getVoucherShortLabel('home_voucher')).toBe('생활 이용권')
  })

  it('SQL 목록이 SSOT 에서 만들어지고 레거시까지 담는다', () => {
    expect(VOUCHER_CATEGORY_SQL_IN).toContain("'home_voucher'")
    for (const k of ALL_VOUCHER_CATEGORY_KEYS) expect(VOUCHER_CATEGORY_SQL_IN).toContain(`'${k}'`)
    expect(VOUCHER_CATEGORY_SQL_IN).toContain("'activity_voucher'")
  })

  it('🔴 구매 경로(딜·카드 참여 두 곳)가 SSOT 목록을 쓴다 — 빠지면 생활 이용권이 404', () => {
    const code = readCode('src/features/group-buy/api/group-buy.routes.ts')
    const hits = code.match(/category IN \(\$\{VOUCHER_CATEGORY_SQL_IN\}\) OR deal_only = 1/g) || []
    expect(hits.length).toBeGreaterThanOrEqual(2)
    expect(code).not.toContain(HAND_LIST)
  })

  it('🔴 이용권 카테고리 SQL 목록을 손으로 적지 않는다 (잠금 파일 3곳만 예외)', () => {
    const out = execSync(`grep -rlF "${HAND_LIST}" src --include=*.ts --include=*.tsx || true`, { encoding: 'utf8' })
    const files = out.split('\n').map((s) => s.trim()).filter((f) => f && !f.startsWith('src/tests/'))
    for (const f of files) {
      const code = readCode(f)
      const n = code.split(HAND_LIST).length - 1
      if (n === 0) continue  // 주석에만 있다
      expect(LOCKED_ALLOW[f], `${f} 에 손으로 적은 카테고리 목록 ${n}곳 — VOUCHER_CATEGORY_SQL_IN 을 쓸 것`).toBe(n)
    }
  })

  it('소비자 칩·지도 마커·카테고리 아이콘이 생활을 안다', () => {
    expect(DEAL_CAT_LABELS.find((c) => c.key === 'home_voucher')?.label).toBe('생활')
    expect(STAYS_CHIPS.find((c) => c.key === 'home_voucher')?.label).toBe('생활')
    expect(MAP_ICON_INNER_FOR_TEST.home_voucher).toBeTruthy()
    expect(CATEGORY_META.home_voucher?.label).toBe('생활')
  })

  it('이사 할인권 데모는 할인율을 지어내지 않는다(fixed → 정가 = 판매가)', () => {
    const code = readCode('src/features/admin/api/admin-products.routes.ts')
    expect(code).toMatch(/p\.fixed \? \[0, 0\] : demoDiscountRange/)
    expect(code).toMatch(/const orig = p\.fixed \? price :/)
    expect(code).toMatch(/pq: '포장이사', cat: 'home_voucher'/)
    expect(code).toMatch(/'생활': 'home_voucher'/)
  })
})
