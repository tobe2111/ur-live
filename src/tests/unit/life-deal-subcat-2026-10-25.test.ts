/**
 * 🏠 생활 이용권 업종(2차 카테고리) — 2026-10-25 대표 시안 안 A + *"1번 방식으로 가자"*.
 *
 * 지키는 것:
 *  ① 업종 표는 한 곳(`shared/life-deal-subcat`)이고 칩·추정·배너가 모두 그 표를 읽는다.
 *  ② 사장님이 고른 값이 이름 추정을 이긴다(고친 것이 진실). 모르는 값은 '안 고름'.
 *  ③ 등록(POST)·수정(PUT)이 업종을 저장하고, 생활이 아니면 지운다 · 값이 안 오면 안 건드린다.
 *  ④ 등록 화면은 생활 이용권이면 업종을 고르게 하고, 안 고르면 다음으로 못 간다.
 *  ⑤ 홈 피드는 생활 탭에서만 칩을 그리고 거른다 — 다른 탭은 그대로다.
 *
 * ⚠️ 못 보는 것: 실제 렌더(칩 위치·밀림) · 라이브 데이터의 이름 추정 정확도 · 서버 캐시 적중.
 */
import { describe, expect, it } from 'vitest'
import { readCode } from '../helpers/source-text'
import { LIFE_SUBCATS, guessLifeSubcat, lifeSubcatDef, normalizeLifeSubcat, resolveLifeSubcat } from '@/shared/life-deal-subcat'
import { lifeSubcatMissing } from '@/pages/seller-meal-voucher/voucher-form'
import { LIBRARY_ENVELOPES } from '../../../scripts/surface-chunks.mjs'

const R = (p: string) => readCode(p)

describe('① 업종 표', () => {
  it('다섯 업종 · 키 중복 없음 · 시안 순서', () => {
    expect(LIFE_SUBCATS.map((s) => s.label)).toEqual(['이사', '청소', '방역·소독', '수리·설치', '간판'])
    expect(new Set(LIFE_SUBCATS.map((s) => s.key)).size).toBe(LIFE_SUBCATS.length)
  })
  it('요청서로 바로 가는 업종은 실제 생활 견적 카테고리를 가리킨다', () => {
    expect(lifeSubcatDef('move')?.request).toBe('move')
    expect(lifeSubcatDef('sign')?.request).toBe('signage')
  })
})

describe('② 추정과 우선순위', () => {
  it('이름으로 추정(라이브 이름 그대로)', () => {
    expect(guessLifeSubcat('원룸 이사 5만원 할인권')).toBe('move')
    expect(guessLifeSubcat('20평대 입주청소 (베란다·창틀 포함)')).toBe('clean')
    expect(guessLifeSubcat('가게 방역 1회')).toBe('pest')
    expect(guessLifeSubcat('간판 LED 교체')).toBe('sign') // 좁은 말이 먼저
    expect(guessLifeSubcat('이사 청소 패키지')).toBe('move')
    expect(guessLifeSubcat('에어컨 설치')).toBe('repair')
    expect(guessLifeSubcat('아무 관계 없는 이름')).toBeNull()
    expect(guessLifeSubcat(null)).toBeNull()
  })
  it('저장값이 이기고, 모르는 저장값은 무시', () => {
    expect(resolveLifeSubcat('repair', '간판 LED 교체')).toBe('repair')
    expect(resolveLifeSubcat('nope', '원룸 이사')).toBe('move')
    expect(normalizeLifeSubcat('')).toBeNull()
    expect(normalizeLifeSubcat('clean')).toBe('clean')
  })
})

describe('③ 저장', () => {
  it('생활이 아니면 지우고, 값이 안 오면 안 건드린다', () => {
    const s = R('src/features/home-service/api/life-deal-subcat-store.ts')
    expect(s).toMatch(/if \(raw === undefined[^\n]*\) return/)
    expect(s).toMatch(/=== 'home_voucher' \? normalizeLifeSubcat\(raw\) : null/)
  })
  it('등록·수정이 저장하고 조회가 돌려준다', () => {
    const r = R('src/features/seller/api/seller-orders.routes.ts')
    expect(r.match(/m\.saveLifeSubcat\(db, Number\(productId\)/g)?.length).toBe(2)
    expect(r).toMatch(/saveLifeSubcat\(db, Number\(productId\), canonicalCategory\(body\.category\) \?\? existing\.category, body\.life_subcat\)/)
    expect(r).toMatch(/kakao_place_url, life_subcat \} \}\)/)
  })
  it('공개 표 — 판매 중인 생활 이용권만 · 짧게 캐시', () => {
    const r = R('src/features/home-service/api/home-service.routes.ts')
    expect(r).toMatch(/homeServiceRoutes\.get\('\/deal-subcats'/)
    const s = R('src/features/home-service/api/life-deal-subcat-store.ts')
    expect(s).toMatch(/p\.category = 'home_voucher' AND p\.is_active = 1/)
    expect(s).toMatch(/resolveLifeSubcat\(r\.sub, r\.name\)/)
  })
})

describe('④ 사장님 화면', () => {
  it('생활인데 업종이 비면 막는다', () => {
    expect(lifeSubcatMissing({ category: 'home_voucher', life_subcat: '' })).toBe(true)
    expect(lifeSubcatMissing({ category: 'home_voucher', life_subcat: 'move' })).toBe(false)
    expect(lifeSubcatMissing({ category: 'meal_voucher', life_subcat: '' })).toBe(false)
  })
  it('등록 단계·등록 버튼·수정 화면에 배선', () => {
    const n = R('src/pages/SellerMealVoucherNewPage.tsx')
    expect(n).toMatch(/s === 1 && lifeSubcatMissing\(form\)/)
    expect(n).toMatch(/if \(lifeSubcatMissing\(form\)\) \{ toast\.error/)
    expect(n).toMatch(/life_subcat: form\.category === 'home_voucher' \? form\.life_subcat : undefined/)
    expect(R('src/pages/seller-meal-voucher/VoucherInfoStep.tsx')).toMatch(/form\.category === 'home_voucher' && <LifeSubcatPicker/)
    const e = R('src/pages/SellerProductEditPage.tsx')
    expect(e).toMatch(/formData\.category === 'home_voucher' && <LifeSubcatPicker/)
    expect(e).toMatch(/life_subcat: formData\.category === 'home_voucher' \? formData\.life_subcat : undefined/)
  })
})

describe('⑤ 홈 피드', () => {
  it('생활 탭에서만 칩·거르기', () => {
    const f = R('src/pages/main-home/GroupBuyFeed.tsx')
    expect(f).toMatch(/const life = useLifeSubcat\(category\)/)
    expect(f).toMatch(/passesFeedFilters\(p, filters, userLoc\) && life\.keep\(p\)/)
    expect(f).toMatch(/feedFiltersKey\(filters\), life\.key\]/) // 칩을 바꾸면 다시 거른다
    expect(f).toMatch(/\{life\.on && <LifeSubcatChips/)
    expect(f).toMatch(/<LifeQuoteBanner sub=\{life\.sub\} \/>/)
    const h = R('src/pages/main-home/life-subcat.tsx')
    expect(h).toMatch(/const on = category === LIFE_CATEGORY/)
    expect(h).toMatch(/enabled: on/)
    expect(h).toMatch(/if \(!active\) return true/)
  })
  it('배너가 고른 업종 문구를 쓴다', () => {
    const b = R('src/pages/main-home/LifeQuoteBanner.tsx')
    expect(b).toMatch(/d\?\.bannerTitle \?\? '가게 일은 무료 견적으로'/)
    expect(b).toMatch(/d\?\.request \? `\/life\/request\/\$\{d\.request\}` : '\/life'/)
  })
})

describe('⑥ 묶음 — 업종 SSOT 는 자기 작은 봉투', () => {
  it('홈 봉투에 섞이면 대시보드 전체가 홈 코드(+23KB)를 받는다', () => {
    expect(R('vite.config.ts')).toMatch(/id\.includes\('\/src\/shared\/life-deal-subcat'\)\) return 'app-life-subcat'/)
    expect(LIBRARY_ENVELOPES.has('app-life-subcat')).toBe(true)
  })
})
