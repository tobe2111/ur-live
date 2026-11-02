/**
 * 🏠 파트너 풀 — 생활 업종 4종 + 전문직 수집 (2026-11-02 대표 *"응 모아줘. 필요해. 전문직종과 생활 카테고리 모두 각자 넣어줘야지"*).
 *
 * 라이브 실측: 54만 행 중 상호에 '이사' 250 · '청소' 225 · '방역' 20 · 법무사 35 — 분류가 틀린 게 아니라
 * **검색어가 없어서 안 모였다.** 이 시험이 지키는 것:
 *   ① 카테고리 이름 = 유어딜 생활 칩 라벨(사람이 "어느 칩에 올리나" 를 번역하지 않게)
 *   ② 진짜 상호 모양으로 분류가 맞는가 — 특히 순서 함정(`이사청소`·`방수시공`·`주방설비`)과 오탐(`청소년`·`대표이사`·`스타일`)
 *   ③ 새 검색어가 배열 **맨 끝**에 붙었는가(시드 이어받기 — 앞이 밀리면 5천 행을 처음부터 다시 훑는다)
 * ⚠️ 못 보는 것: 새 검색어가 실제로 얼마나 수확할지(카카오·네이버 색인에 달렸다 — 배포 후 `saved_total`) ·
 *   상가정보 업종코드로의 통째 수집(코드표를 이 환경에서 확인할 수 없어 넣지 않았다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { classifyLead } from '@/features/marketing/api/company-classify'
import { COMPANY_CATEGORIES } from '@/features/marketing/api/company-discovery'
import { PROFESSION_SUBCATEGORIES } from '@/features/marketing/api/company-taxonomy'
import { LIFE_SUBCATS } from '@/shared/life-deal-subcat'
import {
  buildKeywordRows, S2_REGIONS, CITY_REGIONS,
  S5_TRADES_LIFE, S5_TRADES_PROFESSION, S5_TRADES_PROFESSION_CITY,
} from '@/features/marketing/api/company-keyword-grid'

const cls = (company_name: string, extra: Record<string, string> = {}) =>
  classifyLead({ company_name, source: 'local', ...extra })

describe('① 카테고리 이름', () => {
  it('유어딜 생활 칩의 라벨이 전부 파트너 풀 카테고리다', () => {
    for (const s of LIFE_SUBCATS) expect(Object.keys(COMPANY_CATEGORIES), s.label).toContain(s.label)
  })
  it('전문서비스 세부는 국가자격 단위 그대로다(옛 중복 라벨 없음)', () => {
    for (const p of PROFESSION_SUBCATEGORIES) expect(COMPANY_CATEGORIES['전문서비스']).toContain(p)
    for (const old of ['법률', '세무·기장', '회계', '노무']) expect(COMPANY_CATEGORIES['전문서비스']).not.toContain(old)
  })
})

describe('② 진짜 상호 모양으로 분류', () => {
  const cases: Array<[string, string, string, Record<string, string>?]> = [
    ['친절포장이사', '이사', '포장이사'],
    ['번개용달', '이사', '용달·소형이사'],
    ['한진', '이사', '포장이사', { description: '서비스,산업 > 운송 > 이사,용달' }],
    ['깨끗한이사청소', '청소', '입주·이사청소'],       // 이사보다 청소가 먼저
    ['우리집입주청소', '청소', '입주·이사청소'],
    ['에어컨세척 전문 쿨맨', '청소', '에어컨·가전청소'],
    ['반짝반짝 청소대행', '청소', '사무실·상가청소'],
    ['세스코 강남지사', '방역·소독', '방역·소독'],
    ['24시누수탐지', '수리·설치', '누수·방수'],
    ['동네방수시공', '수리·설치', '누수·방수'],        // 인테리어의 '시공' 이 가로채면 안 된다
    ['대성설비', '수리·설치', '설비·배관'],
    ['행복열쇠', '수리·설치', '열쇠·도어락'],
    ['정민법무사사무소', '전문서비스', '법무사'],
    ['행정사 김민수 사무소', '전문서비스', '행정사'],
  ]
  for (const [name, cat, sub, extra] of cases) {
    it(`${name} → ${cat}/${sub}`, () => {
      const r = cls(name, extra)
      expect([r.category, r.subcategory, r.confidence]).toEqual([cat, sub, 'evidence'])
    })
  }

  it('주방설비는 여전히 인테리어/주방설비다(수리의 설비가 가로채지 않는다)', () => {
    expect(cls('대성주방설비').subcategory).toBe('주방설비')
  })
  it('오탐 — 청소년·세탁소·대표이사·스타일은 생활 업종이 아니다', () => {
    const life = new Set(['이사', '청소', '방역·소독', '수리·설치'])
    for (const n of ['푸른청소년수련관', '우리동네 드라이클리닝', '대표이사실', '스타일헤어']) {
      const r = cls(n, { category: '대행사' })
      expect(life.has(String(r.category)), n).toBe(false)
    }
  })
  it('분류가 내는 세부 라벨은 전부 카테고리 목록 안에 있다', () => {
    for (const [name, , , extra] of cases) {
      const r = cls(name, extra)
      expect(COMPANY_CATEGORIES[String(r.category)], name).toContain(r.subcategory)
    }
  })
})

describe('③ 검색어', () => {
  const rows = buildKeywordRows()
  const s5 = S2_REGIONS.length * (S5_TRADES_LIFE.length + S5_TRADES_PROFESSION.length) + CITY_REGIONS.length * S5_TRADES_PROFESSION_CITY.length
  const kws = new Set([...S5_TRADES_LIFE, ...S5_TRADES_PROFESSION, ...S5_TRADES_PROFESSION_CITY].map(t => t.kw))
  const isS5 = (k: string) => [...kws].some(w => k.endsWith(` ${w}`))

  it('5단계는 맨 끝에 붙는다(앞부분 불변 = 시드 이어받기)', () => {
    expect(rows.slice(rows.length - s5).every(r => isS5(r.keyword))).toBe(true)
    expect(rows.slice(0, rows.length - s5).some(r => isS5(r.keyword))).toBe(false)
  })
  it('생활 4종이 전부 검색어를 갖는다', () => {
    const cats = new Set(S5_TRADES_LIFE.map(t => t.category))
    for (const c of ['이사', '청소', '방역·소독', '수리·설치']) expect(cats.has(c), c).toBe(true)
  })
  it('검색어의 라벨은 전부 카테고리 목록 안에 있다', () => {
    for (const t of [...S5_TRADES_LIFE, ...S5_TRADES_PROFESSION, ...S5_TRADES_PROFESSION_CITY]) {
      expect(COMPANY_CATEGORIES[t.category], t.kw).toContain(t.subcategory)
    }
  })
  it('세무사·회계사·노무사는 상가정보가 통째로 받으므로 검색어에 중복으로 넣지 않는다', () => {
    const subs = [...S5_TRADES_PROFESSION, ...S5_TRADES_PROFESSION_CITY].map(t => t.subcategory)
    for (const s of ['세무사', '회계사', '노무사']) expect(subs).not.toContain(s)
  })
  it('시드 버전을 올렸다(안 올리면 기존 배포에 새 검색어가 안 들어간다)', () => {
    const src = readFileSync('src/features/marketing/api/company-collect.ts', 'utf8')
    expect(Number(/const KEYWORD_SEED_VERSION = (\d+)/.exec(src)?.[1])).toBeGreaterThanOrEqual(6)
  })
})
