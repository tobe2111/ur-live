/**
 * 🌐 번역 파일 손님용(core) / 대시보드용(dash) 분리 (2026-10-11 — 대표 "다 해줘")
 *
 * 무엇을 지키나: 손님이 볼 수 있는 화면이 쓰는 키는 **반드시 core 에 남는다.** 빠지면 그 화면에 키 이름이
 *   그대로 뜨는데(예: `seller.home.myStore`) 에러는 안 난다 — 가장 조용한 종류의 사고다.
 *   그리고 손님 첫 접속이 받는 양이 실제로 줄었는지(core 가 dash 보다 작다)도 본다.
 *
 * 이 시험이 **못 보는 것**: 변수에 담아 조합한 키(`t(prefix + x)`) · 브라우저에서 실제로 빠진 키가 보이는지
 *   (그건 `src/i18n.ts` 의 missingKeyHandler 안전망이 받는다) · 빌드 산출 청크 이름(빌드가 필요하다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// @ts-expect-error — .mjs 스크립트(타입 선언 없음)
import { splitTranslation, collectConsumerDashKeys, isDashOnlyFile, DASH_NAMESPACES } from '../../../scripts/i18n-split.mjs'
import { stripComments } from '../helpers/source-text'

const ko = JSON.parse(readFileSync('public/locales/ko/translation.json', 'utf-8'))
const used = collectConsumerDashKeys('.')
const { core, dash } = splitTranslation(ko, used)

function get(obj: Record<string, unknown>, key: string): unknown {
  if (key in obj) return obj[key]
  let cur: unknown = obj
  for (const k of key.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

describe('분리 규칙', () => {
  it('손님 화면이 언급하는 대시보드 키는 전부 core 에 남는다 (키 이름이 화면에 새지 않는다)', () => {
    expect(used.exact.size, '스캔이 비었다 — 경로가 낡았다(통과 아님)').toBeGreaterThan(20)
    const missing = [...used.exact].filter((k: string) => get(ko, k) !== undefined && get(core, k) === undefined)
    expect(missing, `core 에서 빠진 손님 키: ${missing.slice(0, 5).join(', ')}`).toEqual([])
  })

  it('대시보드 바깥 키는 하나도 빠지지 않고 core 에 있다', () => {
    const lost = Object.keys(ko).filter((k) => !DASH_NAMESPACES.includes(k.split('.')[0]) && !(k in core))
    expect(lost).toEqual([])
  })

  it('dash 는 대시보드 이름공간만 갖고, 원본의 대시보드 키를 전부 갖는다', () => {
    for (const k of Object.keys(dash)) expect(DASH_NAMESPACES).toContain(k.split('.')[0])
    const dashTops = Object.keys(ko).filter((k) => DASH_NAMESPACES.includes(k.split('.')[0]))
    for (const k of dashTops) expect(dash[k], k).toEqual(ko[k])
  })

  it('🔴 손님 첫 접속이 받는 양이 실제로 준다 (core 가 원본의 절반 미만)', () => {
    const size = (o: unknown) => JSON.stringify(o).length
    expect(size(core)).toBeLessThan(size(ko) / 2)
  })

  it('손님 화면은 대시보드 전용으로 분류되지 않는다 (분류가 틀리면 그 화면 키가 core 에서 빠진다)', () => {
    for (const f of ['src/pages/SellerPublicPage.tsx', 'src/pages/user-profile/SellerSection.tsx', 'src/pages/VouchersPage.tsx', 'src/components/SellerKakaoLinkBanner.tsx']) {
      expect(isDashOnlyFile(f), f).toBe(false)
    }
    for (const f of ['src/pages/SellerProductsPage.tsx', 'src/pages/admin/AdminAgencyAccountsPage.tsx', 'src/components/seller/StoreSwitcher.tsx']) {
      expect(isDashOnlyFile(f), f).toBe(true)
    }
  })
})

describe('배선', () => {
  it('손님 경로는 core 만, dash 는 따로 부른다', () => {
    const src = stripComments(readFileSync('src/i18n.ts', 'utf-8'))
    expect(src).toMatch(/ko: \(\) => import\('\.\.\/public\/locales\/ko\/translation\.json\?i18n-core'\)/)
    expect(src).toMatch(/ko: \(\) => import\('\.\.\/public\/locales\/ko\/translation\.json\?i18n-dash'\)/)
  })

  it('🔴 안전망 — 빠진 대시보드 키가 요청되면 dash 를 받고 다시 그린다', () => {
    const src = stripComments(readFileSync('src/i18n.ts', 'utf-8'))
    expect(src).toMatch(/missingKeyHandler:[\s\S]{0,200}ensureDashStrings\(\)/)
    expect(src).toMatch(/bindI18nStore: 'added'/)
    expect(src).toMatch(/saveMissing: true/)
  })

  it('마이 안의 판매 화면 시트가 dash 를 부른다', () => {
    expect(stripComments(readFileSync('src/pages/user-profile/seller-section/ToolPageSheet.tsx', 'utf-8'))).toMatch(/ensureDashStrings\(\)/)
  })

  it('빌드가 플러그인을 쓰고, dash 절반은 따로 청크를 받는다', () => {
    const v = stripComments(readFileSync('vite.config.ts', 'utf-8'))
    expect(v).toMatch(/i18nSplitPlugin\(__dirname\)/)
    expect(v).toMatch(/id\.includes\('\?i18n-dash'\)\) return `locale-\$\{localeMatch\[1\]\}-dash`/)
  })
})
