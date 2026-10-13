/**
 * 🏪 가게명을 두 번 말하지 않는다 — 2026-10-13
 *
 * 실측(라이브, Googlebot UA): `/pass/2919` 의 `description` 이
 *   `달빛한스푼 달빛한스푼 닭도리탕 — 31,000원, 유어딜에서 할인가로 바로 구매`
 * 였다. 매장이 자기 가게 이름을 상품명에 넣는 것은 자연스러운데(활성 359건 중 1건,
 * 그리고 **그 1건이 실제 입점 매장**이다) `${store} ${name}` 이 그걸 그대로 이었다.
 *
 * 🔑 **규칙이 없던 게 아니라 한 곳이 규칙 밖이었다** — `crawler-noscript.ts` 가
 * 2026-10-12 에 교환권 목록에서 같은 판단을 이미 하고 있었다. 그래서 고친 방향은
 * "조건 하나 추가" 가 아니라 **판단을 SSOT 로 모으고 두 곳이 그걸 쓰게** 하는 것이다.
 *
 * ⚠️ 이 가드가 **못 보는 것**:
 *   - `<title>`(`달빛한스푼 닭도리탕 공동구매 - 달빛한스푼`)은 **여전히 중복**이다.
 *     그 문자열은 결재 #35(`/pass/:id` 310건 제목)의 주제라 승인 전에 건드리지 않았다.
 *     ⇒ 어느 안이 확정되든 그 안에 이 dedup 을 적용할 것(결재 파일에 적어 뒀다).
 *   - 구글·네이버가 그 설명을 실제로 쓰는지(색인 수일~수주 · 서치콘솔은 **대표만** 본다).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { storeNameParts, storeNameJoin } from '@/shared/seo/store-name-dedupe'
import { buildDetailMeta } from '@/worker/utils/detail-ssr-meta'
import { readCode } from '../helpers/source-text'

const root = process.cwd()
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

describe('① SSOT 가 실제로 가른다 (문자열 검사 아님)', () => {
  it('상품명이 가게명으로 시작하면 가게명을 다시 말하지 않는다', () => {
    expect(storeNameParts('달빛한스푼', '달빛한스푼 닭도리탕')).toEqual(['달빛한스푼 닭도리탕'])
    expect(storeNameJoin('달빛한스푼', '달빛한스푼 닭도리탕')).toBe('달빛한스푼 닭도리탕')
  })

  it('가게명이 상품명에 없으면 둘 다 말한다 — 정보를 잃지 않는다', () => {
    expect(storeNameParts('버크셔', '프리미엄 돈가스 1인 세트'))
      .toEqual(['버크셔', '프리미엄 돈가스 1인 세트'])
    expect(storeNameJoin('버크셔', '돈가스', ' — ')).toBe('버크셔 — 돈가스')
  })

  it('🔴 가운데·뒤에 든 가게명은 지우지 않는다 — 사람이 쓴 꼬리일 수 있다', () => {
    expect(storeNameParts('달빛한스푼', '닭도리탕 (달빛한스푼)'))
      .toEqual(['달빛한스푼', '닭도리탕 (달빛한스푼)'])
  })

  it('한쪽이 비면 있는 것만 — 빈 구분자가 남지 않는다', () => {
    expect(storeNameJoin('', '닭도리탕')).toBe('닭도리탕')
    expect(storeNameJoin('달빛한스푼', '')).toBe('달빛한스푼')
    expect(storeNameJoin('', '')).toBe('')
    expect(storeNameJoin(null, undefined)).toBe('')
  })

  it('공백만 든 값은 없는 것과 같다', () => {
    expect(storeNameJoin('   ', '닭도리탕')).toBe('닭도리탕')
    expect(storeNameParts('  달빛한스푼  ', '  달빛한스푼 닭도리탕 '))
      .toEqual(['달빛한스푼 닭도리탕'])
  })
})

describe('② 진짜 빌더를 돌려 판정한다', () => {
  // 라이브 응답 모양 그대로 — 평평하게 지어 쓰면 빌더가 null 을 준다(2026-10-12 교훈).
  const seed = (over: Record<string, unknown>) => JSON.stringify({
    success: true,
    data: {
      id: 2919, name: '달빛한스푼 닭도리탕', restaurant_name: '달빛한스푼',
      price: 31000, category: 'meal_voucher', group_buy_status: 'active', ...over,
    },
  })

  it('중복 가게명이 설명에서 사라진다 (이 결함의 실측 재현)', () => {
    const m = buildDetailMeta(seed({}), 'https://urdeal.kr', '/pass/2919')
    expect(m, '빌더가 null — 시드 모양을 다시 볼 것').toBeTruthy()
    expect(m!.description).not.toMatch(/달빛한스푼\s+달빛한스푼/)
    expect(m!.description).toContain('달빛한스푼 닭도리탕')
  })

  it('할인 분기도 같다 — 두 문장 중 하나만 고치면 할인 중인 딜에서 되살아난다', () => {
    const m = buildDetailMeta(seed({ current_discount_pct: 20 }), 'https://urdeal.kr', '/pass/2919')
    expect(m!.description).toMatch(/20% 할인/)
    expect(m!.description).not.toMatch(/달빛한스푼\s+달빛한스푼/)
  })

  it('🔵 반대 방향 — 가게명이 안 겹치면 설명에 둘 다 남는다', () => {
    const m = buildDetailMeta(
      seed({ name: '프리미엄 돈가스', restaurant_name: '버크셔' }),
      'https://urdeal.kr', '/pass/2915')
    expect(m!.description).toContain('버크셔')
    expect(m!.description).toContain('프리미엄 돈가스')
  })

  it('설명 없는 상품의 Product.description 폴백도 같은 판단을 쓴다', () => {
    const m = buildDetailMeta(seed({ description: '' }), 'https://urdeal.kr', '/pass/2919')
    const graph = JSON.parse(m!.jsonLd || '{}')
    const nodes: any[] = []
    const walk = (o: any) => {
      if (Array.isArray(o)) return o.forEach(walk)
      if (o && typeof o === 'object') { if (o['@type']) nodes.push(o); Object.values(o).forEach(walk) }
    }
    walk(graph)
    const prod = nodes.find((n) => n['@type'] === 'Product')
    expect(prod, 'Product 노드가 없다').toBeTruthy()
    expect(String(prod.description)).not.toMatch(/달빛한스푼\s+달빛한스푼/)
  })
})

describe('③ 두 곳이 같은 SSOT 를 쓴다 — 두 벌이면 또 갈린다', () => {
  const SSOT = 'src/shared/seo/store-name-dedupe.ts'

  it('SSOT 가 실재한다', () => {
    expect(fs.existsSync(path.join(root, SSOT))).toBe(true)
  })

  it('상세 메타·크롤러 요약 둘 다 SSOT 를 import 한다', () => {
    for (const f of ['src/worker/utils/detail-ssr-meta.ts', 'src/worker/utils/crawler-noscript.ts']) {
      expect(readCode(f), `${f} 가 SSOT 를 안 쓴다`).toMatch(/store-name-dedupe/)
    }
  })

  it('🔴 상세 메타에 `${store} ${name}` 을 손으로 잇는 자리가 0개다', () => {
    const c = readCode('src/worker/utils/detail-ssr-meta.ts')
    expect(c.match(/\$\{store\}\s+\$\{name\}/g) || []).toHaveLength(0)
  })

  it('🔴 크롤러 요약이 판단을 다시 구현하지 않는다', () => {
    const c = readCode('src/worker/utils/crawler-noscript.ts')
    expect(c.match(/title\.startsWith\(head\)/g) || []).toHaveLength(0)
  })
})
