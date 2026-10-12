/**
 * 📈 대시보드 차트는 직접 그린 SVG (2026-10-11 — 대표 "다 해줘")
 *
 * recharts(+redux·immer·d3) 가 막대 하나·선 둘·원 하나를 위해 charts 청크 **388 KB raw** 를 실었다.
 * 같은 모양을 SVG 로 그리자 **7.7 KB** 가 됐다. 다시 무거운 차트 라이브러리를 들이면 그 388 KB 가 조용히 돌아온다.
 *
 * 이 시험이 **못 보는 것**: 그림이 보기 좋은지(브라우저로 그려서 봐야 한다 — 2026-10-11 실측 캡처로 확인) ·
 *   jsdom 은 폭이 0 이라 SVG 를 그리지 않으므로 여기서는 계산 함수와 배선만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { niceTicks } from '@/components/charts/svg-charts'
import { stripComments } from '../helpers/source-text'

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== 'tests') walk(p, out) } else if (/\.tsx?$/.test(n)) out.push(p)
  }
  return out
}

describe('눈금', () => {
  it('0 부터 최댓값을 덮는 눈금을 만든다', () => {
    const t = niceTicks(337465)
    expect(t[0]).toBe(0)
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(337465)
    expect(t.length).toBeGreaterThanOrEqual(3)
  })
  it('🔴 값이 전부 0 이어도 깨지지 않는다 (0 으로 나누기 금지)', () => {
    const t = niceTicks(0)
    expect(t[t.length - 1]).toBeGreaterThan(0)
  })
})

describe('무거운 차트 라이브러리를 다시 들이지 않는다', () => {
  it('🔴 앱 코드 어디에서도 recharts 를 import 하지 않는다', () => {
    const files = walk('src')
    expect(files.length, '검사 대상이 비었다(통과 아님)').toBeGreaterThan(500)
    const bad = files.filter((f) => /from ['"]recharts['"]|import\(['"]recharts['"]\)/.test(stripComments(readFileSync(f, 'utf-8'))))
    expect(bad).toEqual([])
  })
  it('package.json 에도 없다', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
    expect(pkg.dependencies?.recharts).toBeUndefined()
    expect(pkg.devDependencies?.recharts).toBeUndefined()
  })
  it('두 화면의 차트가 SVG 컴포넌트를 쓴다', () => {
    expect(stripComments(readFileSync('src/components/charts/AdminRevenueCharts.tsx', 'utf-8'))).toMatch(/<SvgBarChart[\s\S]*<SvgLineChart[\s\S]*<SvgPieChart/)
    expect(stripComments(readFileSync('src/components/charts/SellerAnalyticsChart.tsx', 'utf-8'))).toMatch(/<SvgLineChart/)
  })
})
