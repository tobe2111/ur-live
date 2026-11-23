/**
 * 🏪 프랜차이즈 원부 — 저장 0 의 원인 (2026-11-23 라이브: 100회 실행 · 회당 600건 발견 · 저장 0).
 *    `ads_franchise_stats.diag.save_error` = `batch: ALL_REJECTED {"KEYWORD_ECHO":100}`.
 *
 * 관리번호 칸 이름이 실제 응답(brandMnno)과 달라 못 찾았고, 폴백이 브랜드명이라 "상호 = 수집 키워드" 가 돼
 * 분류기의 키워드 메아리 규칙이 전부 걸렀다. 지키는 것:
 *   ① 수집 키워드는 관리번호(없으면 고정값)이고 **상호로는 절대 폴백하지 않는다**
 *   ② 라이브 표본 행이 분류기를 통과한다 · 옛 방식(키워드 = 브랜드명)은 실제로 거절된다(원인 재현)
 * ⚠️ 못 보는 것: 저장 뒤 보강(홈페이지 검색 → 연락처)이 얼마나 채우는지 — 배포 후 `total_saved` 로 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { franchiseKeyword } from '@/features/marketing/api/franchise-collect'
import { classifyLead } from '@/features/marketing/api/company-classify'

// 라이브 `diag.sample` 그대로(2026-11-23).
const SAMPLE = { jngBizCrtraYr: '2025', brandMnno: 'BRD_20250938', jnghdqrtrsMnno: 'JNG_019626', brno: '2308110471', crno: '1101115629196',
  jnghdqrtrsRprsvNm: '김영태', brandNm: '효자동보리밥', indutyLclasNm: '외식', indutyMlsfcNm: '한식', majrGdsNm: '보리밥, 삼겹살', jngBizStrtDate: '20241204', corpNm: '바른창업(주)' }

describe('① 수집 키워드', () => {
  it('브랜드 관리번호 → 가맹본부 관리번호 → 고정값. 상호로는 폴백하지 않는다', () => {
    expect(franchiseKeyword(SAMPLE)).toBe('BRD_20250938')
    expect(franchiseKeyword({ jnghdqrtrsMnno: 'JNG_019626', brandNm: '효자동보리밥' })).toBe('JNG_019626')
    expect(franchiseKeyword({ brandNm: '효자동보리밥' })).toBe('franchise')
    expect(readFileSync('src/features/marketing/api/franchise-collect.ts', 'utf8')).toMatch(/source_keyword: franchiseKeyword\(it\),/)
  })
})

describe('② 분류기', () => {
  const lead = (kw: string) => ({ company_name: SAMPLE.brandNm, category: '창업', subcategory: '프랜차이즈본사', source: 'franchise', source_keyword: kw,
    description: '법인 바른창업(주) · 대표 김영태 · 외식>한식 · 상품 보리밥, 삼겹살' })
  it('관리번호가 키워드면 통과 · 브랜드명이 키워드면 KEYWORD_ECHO(원인 재현)', () => {
    const ok = classifyLead(lead(franchiseKeyword(SAMPLE)) as never) as { reject?: string; reason?: string }
    const bad = classifyLead(lead(SAMPLE.brandNm) as never) as { reject?: string; reason?: string }
    expect(JSON.stringify(ok)).not.toMatch(/KEYWORD_ECHO/)
    expect((ok as { ok?: boolean }).ok, JSON.stringify(ok)).toBe(true)
    expect(JSON.stringify(bad)).toMatch(/KEYWORD_ECHO/)
  })
})
