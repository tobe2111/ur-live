/**
 * 🎨 첫 화면 CSS — 추적 파일은 자리표시자, 진짜 값은 번들할 때 (2026-11-03 대표 *"가장 이상적으로 해줘"*)
 *
 * 근거: `scripts/critical-css-plugin.cjs` 머리말(59KB 한 줄 생성물을 커밋해 3일 머지 109건 중 16건이 그 파일을 고쳤고,
 * 동시에 고친 PR 끼리 무조건 충돌했다). 같은 처방의 선례: `route-chunk-map-placeholder-2026-11-01.test.ts`.
 *
 * 이 시험이 지키는 것:
 *   ① 추적 파일은 **빈** 자리표시자 ② 생성기는 추적 안 하는 `.build.ts` 로 쓰고 git 은 무시한다
 *   ③ **진짜 esbuild** 로 합성 트리를 번들해 — 빌드 파일이 있으면 진짜 값, 없으면 빈 값
 *   ④ 번들 대조가 "빌드 파일엔 있는데 번들엔 없다" 와 "빌드 파일이 비었다" 를 **실패**로 잡는다
 *   ⑤ 워커 빌드가 플러그인과 대조를 실제로 쓴다
 *
 * ⚠️ 못 보는 것: 배포된 HTML 에 `<style id=…>` 가 실제로 실리는지 — 배포 후 라이브에서 잰다.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { readCode } from '../helpers/source-text'
import { CRITICAL_CSS } from '@/worker/generated/critical-css'

const PLUGIN = resolve('scripts/critical-css-plugin.cjs')
function node(src: string, ...args: string[]): string {
  return execFileSync('node', ['-e', src, ...args], { encoding: 'utf8', cwd: process.cwd() })
}
const REAL = '.a{color:red}'.repeat(20) + '.realcritical-AbCdEf{display:block;margin:0 auto;padding:0 16px;max-width:1280px;}'

describe('① 추적 파일은 빈 자리표시자다', () => {
  it('값이 비어 있다 — 진짜 CSS 를 다시 커밋하면 빨간불(충돌이 되살아난다)', () => {
    expect(CRITICAL_CSS).toBe('')
  })
})

describe('② 생성기는 추적 안 하는 파일로 쓴다', () => {
  it('출력 경로가 .build.ts 이다', () => {
    const g = readCode('scripts/generate-critical-css.mjs')
    expect(g).toMatch(/CRITICAL_CSS_BUILD = join\(ROOT, 'src\/worker\/generated\/critical-css\.build\.ts'\)/)
    expect(g).toMatch(/const OUT = CRITICAL_CSS_BUILD/)
  })
  it('git 이 그 파일을 무시한다', () => {
    expect(() => execFileSync('git', ['check-ignore', '-q', 'src/worker/generated/critical-css.build.ts'])).not.toThrow()
  })
})

describe('③ 진짜 esbuild — 번들할 때 바꿔 끼운다', () => {
  function bundle(withBuildFile: boolean): string {
    const dir = mkdtempSync(join(tmpdir(), 'ccss-'))
    try {
      const gen = join(dir, 'src/worker/generated')
      mkdirSync(join(dir, 'src/worker/utils'), { recursive: true })
      mkdirSync(gen, { recursive: true })
      writeFileSync(join(gen, 'critical-css.ts'), "export const CRITICAL_CSS: string = ''\n")
      if (withBuildFile) writeFileSync(join(gen, 'critical-css.build.ts'), `export const CRITICAL_CSS: string = ${JSON.stringify(REAL)}\n`)
      writeFileSync(join(dir, 'src/worker/utils/use.ts'), "import { CRITICAL_CSS } from '../generated/critical-css'\nexport const C = CRITICAL_CSS\n")
      return node(
        `const esbuild=require('esbuild');const {criticalCssPlugin}=require(process.argv[1]);const d=process.argv[2];
         esbuild.build({entryPoints:[d+'/src/worker/utils/use.ts'],bundle:true,write:false,format:'esm',
           plugins:[criticalCssPlugin(d)],logLevel:'silent'}).then(r=>process.stdout.write(r.outputFiles[0].text))`,
        PLUGIN, dir,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
  it('빌드 파일이 있으면 진짜 값이 번들에 들어간다', () => {
    expect(bundle(true), '플러그인이 진짜 CSS 로 바꿔 끼우지 않았다').toContain('realcritical-AbCdEf')
  })
  it('빌드 파일이 없으면 빈 값 — 워커가 첫 화면 CSS 를 끄고 종전처럼 그린다', () => {
    expect(bundle(false)).not.toContain('realcritical')
  })
})

describe('④ 번들 대조', () => {
  function run(bundleText: string, buildText: string | null): { res: string; code: number } {
    const dir = mkdtempSync(join(tmpdir(), 'ccss-a-'))
    try {
      const out = join(dir, '_worker.js'); writeFileSync(out, bundleText)
      const build = join(dir, 'c.build.ts')
      if (buildText != null) writeFileSync(build, buildText)
      return JSON.parse(node(
        `const {assertCriticalCssBundled:a}=require(process.argv[1]);let c=0;console.error=()=>{};console.log=()=>{};
         const res=a(process.argv[2],process.argv[3],(x)=>{c=x});process.stdout.write(JSON.stringify({res,code:c}))`,
        PLUGIN, out, build,
      ))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
  const BUILD = `export const CRITICAL_CSS: string = ${JSON.stringify(REAL)}\n`
  it('🔴 번들에 CSS 가 없으면 실패(exit 1)', () => {
    expect(run('/* 빈 번들 */', BUILD)).toEqual({ res: 'missing', code: 1 })
  })
  it('🔴 빌드 파일이 비었으면 실패 — 못 잰 것은 통과가 아니다', () => {
    expect(run('', "export const CRITICAL_CSS: string = ''\n")).toEqual({ res: 'empty', code: 1 })
  })
  it('✅ 번들에 CSS 가 있으면 통과', () => {
    expect(run(`var C=${JSON.stringify(REAL)};`, BUILD)).toEqual({ res: 'ok', code: 0 })
  })
  it('빌드 파일 없음은 통과(생성기를 안 돌린 워커 빌드 — 종전과 같은 결과)', () => {
    expect(run('', null).res).toBe('no-build-file')
  })
})

describe('⑤ 배선', () => {
  it('워커 빌드가 플러그인을 쓰고 번들 뒤에 대조한다', () => {
    const b = readCode('scripts/build-worker.js')
    expect(b).toMatch(/plugins: \[routeChunkMapPlugin\(\), criticalCssPlugin\(\)\]/)
    expect(b).toMatch(/assertCriticalCssBundled\('dist\/_worker\.js'\)/)
  })
})
