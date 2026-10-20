/**
 * 🔁 청크 순환 0 (2026-10-13) — 근거는 `scripts/check-chunk-cycles.mjs` 머리말.
 *   묶음기가 `prop-types`(@stripe/react-stripe-js 의 의존)를 페이지 봉투로 옮기자 `stripe` ↔ `lz-…` 가 서로 import 했고
 *   결제 화면 전체가 "Cannot access 't' before initialization" 오류 화면이 됐다. 빌드·타입·단위시험 전부 초록이었다.
 *
 * 고정하는 것:
 *   ① 가드가 순환을 **실제로 찾는다**(합성 청크 디렉터리) · 동적 import 는 순환으로 세지 않는다
 *   ② 묶음기는 라이브러리끼리만 쓰는 이름 없는 의존을 페이지 봉투로 옮기지 않는다(앱 코드가 쓰면 종전대로 묶는다)
 *   ③ 배선 — verify(빌드 뒤) · audit-gate
 * ⚠️ 못 막는 것: 청크 안의 모듈 순환 · 순환 없이도 나는 런타임 오류(브라우저 렌더의 몫 — dark-contrast·render-smoke).
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { findChunkCycles } from '../../../scripts/check-chunk-cycles.mjs'
import { createSurfaceChunker } from '../../../scripts/surface-chunks.mjs'

function dir(files: Record<string, string>) {
  const d = mkdtempSync(path.join(tmpdir(), 'cc-'))
  for (const [f, s] of Object.entries(files)) writeFileSync(path.join(d, f), s)
  return d
}

describe('① 가드가 순환을 찾는다', () => {
  it('두 청크가 서로 정적 import → 순환 1건', () => {
    const d = dir({
      'stripe-AAAAAAAA.js': 'import{a as e}from"./react-core-BBBBBBBB.js";import{P as t}from"./lz-x-CCCCCCCC.js";var n=t;',
      'lz-x-CCCCCCCC.js': 'import{s}from"./stripe-AAAAAAAA.js";export const P=1;',
      'react-core-BBBBBBBB.js': 'export const a=1;',
    })
    expect(findChunkCycles(d).cycles).toEqual([['lz-x-CCCCCCCC.js', 'stripe-AAAAAAAA.js']])
  })
  it('동적 import 는 평가 순서를 묶지 않으므로 순환이 아니다', () => {
    const d = dir({
      'a-AAAAAAAA.js': 'import{x}from"./b-BBBBBBBB.js";',
      'b-BBBBBBBB.js': 'export const x=1;const l=()=>import("./a-AAAAAAAA.js");',
    })
    expect(findChunkCycles(d).cycles).toEqual([])
  })
  it('부수효과 import(`import"./x.js"`)도 정적 import 로 센다', () => {
    const d = dir({
      'a-AAAAAAAA.js': 'import"./b-BBBBBBBB.js";',
      'b-BBBBBBBB.js': 'import{y}from"./a-AAAAAAAA.js";',
    })
    expect(findChunkCycles(d).cycles).toHaveLength(1)
  })
})

describe('② 묶음기 — 라이브러리 내부 의존은 페이지 봉투로 옮기지 않는다', () => {
  const ROOT = '/repo'
  const P = (f: string) => path.join(ROOT, f)
  const big = 'x'.repeat(5000)
  const mods: Record<string, { isEntry?: boolean; importedIds: string[]; importers?: string[]; dynamicallyImportedIds?: string[]; code?: string }> = {
    [P('src/main.tsx')]: { isEntry: true, importedIds: [] },
    [P('src/pages/Checkout.tsx')]: { importedIds: [P('src/pay/StripeBox.tsx'), '/repo/node_modules/@stripe/react-stripe-js/x.js', '/repo/node_modules/lib-shared/x.js'], code: big },
    [P('src/pay/StripeBox.tsx')]: { importedIds: ['/repo/node_modules/@stripe/react-stripe-js/x.js'], importers: [P('src/pages/Checkout.tsx')], code: big },
    '/repo/node_modules/@stripe/react-stripe-js/x.js': { importedIds: ['/repo/node_modules/prop-types/index.js'], importers: [P('src/pages/Checkout.tsx'), P('src/pay/StripeBox.tsx')], code: big },
    '/repo/node_modules/prop-types/index.js': { importedIds: [], importers: ['/repo/node_modules/@stripe/react-stripe-js/x.js'], code: big },
    '/repo/node_modules/lib-shared/x.js': { importedIds: [], importers: [P('src/pages/Checkout.tsx')], code: big },
  }
  const meta = { getModuleIds: () => Object.keys(mods)[Symbol.iterator](), getModuleInfo: (id: string) => mods[id] ?? null }
  const gate = createSurfaceChunker({ routes: { checkout: ['src/pages/Checkout.tsx'] }, root: ROOT, commonMin: 4, minGroupBytes: 1 })
  it('라이브러리만 쓰는 이름 없는 의존(prop-types) → 손대지 않는다(undefined — Rollup 이 쓰는 쪽 곁에 둔다)', () => {
    expect(gate('/repo/node_modules/prop-types/index.js', undefined, meta)).toBeUndefined()
  })
  it('앱 코드가 직접 쓰는 이름 없는 라이브러리는 종전대로 페이지 봉투', () => {
    expect(gate('/repo/node_modules/lib-shared/x.js', undefined, meta)).toBe('lz-checkout')
  })
})

describe('③ 배선', () => {
  it('verify 가 빌드 뒤에 돌리고 audit-gate 에도 있다', () => {
    const v = readFileSync('.github/workflows/verify.yml', 'utf8')
    expect(v).toMatch(/run: node scripts\/check-chunk-cycles\.mjs/)
    expect(v.indexOf('check-chunk-cycles.mjs')).toBeGreaterThan(v.indexOf('check-critical-chunks.mjs'))
    expect(readFileSync('scripts/audit-gate.sh', 'utf8')).toMatch(/node scripts\/check-chunk-cycles\.mjs/)
  })
})
