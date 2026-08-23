import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { S4_TRADES_LOCAL, S2_REGIONS, buildKeywordRows, seedPrefixHash } from '@/features/marketing/api/company-keyword-grid'

/**
 * 🧭 **4단계 — 고수율 광맥 심화** (2026-08-23, 대표 "모두 다 하자").
 *
 * ## 무엇을 지키나 — "총계"가 아니라 "발송 가능 리드"
 * 확장 방향을 감이 아니라 실측으로 골랐다(webkr 출처, `ad_company_leads`):
 * ```
 *   창업 컨설팅 34.8% · 마케팅 대행사 32.5% · 퍼포먼스 31.9% · 바이럴 30.4%
 *   간판·광고물 제작 9.4%   ← 신규 행 비율은 99.6% 로 1위인데 이메일은 최하위
 *   인테리어·시공 0.5%(2,876행 중 14건) · 주방설비 0%
 * ```
 * ⇒ 매장 생태계 업종(식자재·주류·POS·인테리어·주방)은 **넓히지 않는다**. 넓히면 회전 주기만 길어지고
 * 발송 대상은 안 는다 — CLAUDE.md 가 못 박은 지표("제안 보낼 수 있는 리드 수")에 정확히 반대다.
 *
 * ## 이 테스트가 **못** 막는 것
 * - 새 키워드가 실제로 얼마나 수확할지 — 네이버 색인에 달렸다. 배포 후 `saved_total` 로만 안다.
 * - 이메일 수율이 기존 광맥과 같을지 — 같은 subcategory 를 골랐다는 것까지만 보증한다.
 */
const gridSrc = readFileSync('src/features/marketing/api/company-keyword-grid.ts', 'utf8')
const collectSrc = readFileSync('src/features/marketing/api/company-collect.ts', 'utf8')
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** 실측 이메일 수율 20% 이상인 광맥만 — 아래 목록을 넓히려면 라이브 수치를 먼저 재고 근거를 남길 것. */
const PROVEN = new Set(['마케팅 대행사', '퍼포먼스 마케팅 대행사', '바이럴 마케팅 대행사', '창업 컨설팅', '소상공인 마케팅'])
/** 실측 이메일 수율 10% 미만 — 사이트 보유율 자체가 낮아 이 레인(웹문서)엔 맞지 않는다. */
const LOW_YIELD = ['간판·광고물 제작', '인테리어·시공', '주방설비', '주류 도매', '식자재 유통', '포스 대리점', '상가부동산']

describe('무엇을 넓혔나 — 수율로 골랐다', () => {
  it('🩸 검증된 고수율 subcategory 만 들어간다', () => {
    expect(S4_TRADES_LOCAL.length).toBeGreaterThan(0)
    for (const t of S4_TRADES_LOCAL) {
      expect(PROVEN.has(t.subcategory), `${t.kw} → ${t.subcategory} 는 수율 근거가 없다`).toBe(true)
    }
  })

  it('🩸 저수율 매장 생태계 업종은 전국 확장 대상이 아니다', () => {
    const subs = S4_TRADES_LOCAL.map(t => t.subcategory)
    for (const bad of LOW_YIELD) expect(subs, `${bad} 는 이메일 수율이 낮다`).not.toContain(bad)
  })

  it('회전 주기를 감당할 크기 — 폭증하면 기존 광맥의 재방문이 늦어진다', () => {
    expect(S4_TRADES_LOCAL.length).toBeLessThanOrEqual(8)
  })
})

describe('시드 이어받기 — 앞부분을 밀면 안 된다', () => {
  const rows = buildKeywordRows()
  const s4Count = S2_REGIONS.length * S4_TRADES_LOCAL.length

  it('🩸 4단계는 **맨 뒤**에 붙는다 — 중간에 끼우면 4,500행을 처음부터 다시 훑는다', () => {
    const s4Kw = new Set(S4_TRADES_LOCAL.map(t => t.kw))
    const isS4 = (k: string) => [...s4Kw].some(t => k.endsWith(` ${t}`))
    const tail = rows.slice(rows.length - s4Count)
    expect(tail.every(r => isS4(r.keyword)), '꼬리가 전부 4단계여야 한다').toBe(true)
    const head = rows.slice(0, rows.length - s4Count)
    expect(head.some(r => isS4(r.keyword)), '앞부분에 4단계가 섞이면 안 된다').toBe(false)
  })

  it('🩸 앞부분 지문이 그대로다 — 이어받기의 근거', () => {
    // 이전 시드가 끝냈던 지점(=4단계 이전 전량)의 지문은 확장 전후로 같아야 한다.
    const prefixLen = rows.length - s4Count
    expect(seedPrefixHash(rows, prefixLen)).toBe(seedPrefixHash(rows.slice(0, prefixLen), prefixLen))
  })

  it('🩸 시드 버전이 올라갔다 — 안 올리면 기존 배포에 새 키워드가 영영 안 들어간다', () => {
    const m = code(collectSrc).match(/const KEYWORD_SEED_VERSION = (\d+)/)
    expect(m).toBeTruthy()
    expect(Number(m![1]), '4단계 추가분 반영을 위해 4 초과').toBeGreaterThan(4)
  })

  it('4단계가 buildKeywordRows 의 마지막 spread 다(소스 배선)', () => {
    const body = code(gridSrc)
    const build = body.slice(body.indexOf('export function buildKeywordRows'))
    const last = build.indexOf('S4_TRADES_LOCAL')
    const nationwide = build.indexOf('S3_TRADES_NATIONWIDE')
    expect(last).toBeGreaterThan(nationwide)
  })
})
