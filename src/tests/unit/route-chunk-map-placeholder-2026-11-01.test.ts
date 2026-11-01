/**
 * 🧩 라우트 청크 맵 — 추적 파일은 자리표시자, 진짜 값은 번들할 때 (2026-11-01 대표 *"모두 다 해줘"*)
 *
 * 종전엔 빌드가 추적되는 `src/worker/generated/route-chunk-map.ts` 를 매번 덮어썼다:
 *   ① 클라 빌드 없이 워커만 빌드하면(로컬 pre-commit 이 매번) **빈 맵**이 덮어써 작업트리가 더러워졌다(+3/−306)
 *   ② 그게 실수로 커밋됐다(main 150커밋 중 5회) ③ 빌드마다 해시가 바뀌어 무관한 PR 끼리 충돌했다.
 * 배포는 매번 다시 만들므로 커밋본은 **아무 데도 안 쓰였다.**
 *
 * 이 시험이 지키는 것:
 *   ① 추적 파일은 **빈** 자리표시자다(진짜 값을 다시 적으면 충돌이 되살아난다)
 *   ② 생성기는 추적 안 하는 `.build.ts` 로 쓰고, git 은 그것을 무시한다
 *   ③ **진짜 esbuild** 로 합성 트리를 번들해 — 빌드 파일이 있으면 진짜 값이, 없으면 빈 값이 들어간다
 *   ④ 번들 대조가 "빌드 파일엔 있는데 번들엔 없다" 를 **실패**로 잡는다(조용히 미리받기 0 으로 배포 금지)
 *   ⑤ 워커 빌드가 플러그인과 대조를 실제로 쓴다 · 맵을 읽는 두 검사가 빌드 파일을 본다
 *
 * ⚠️ 못 보는 것: 배포된 HTML 에 미리받기가 실제로 실리는지 — 그건 배포 후 라이브에서 잰다
 * (기준선 2026-11-01: 폰 홈 HTML 에 `MobileHomePage-*.js` 1건). `wrangler.toml` 의 cron 워커는
 * wrangler 가 직접 번들해 플러그인을 안 거치지만 도메인 라우트가 없다(HTML 을 안 그린다).
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { readCode } from '../helpers/source-text'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolve } from 'node:path'
import { ROUTE_CHUNK_MAP, ENTRY_CSS, BOOT_JS } from '@/worker/generated/route-chunk-map'

/**
 * 플러그인·대조는 **별도 node 프로세스**에서 돌린다 — esbuild 는 jsdom 환경에서 안 돌고(TextEncoder),
 * 실제 워커 빌드도 node 에서 돈다(그쪽과 같은 조건이 더 정직하다).
 */
const PLUGIN = resolve('scripts/route-chunk-map-plugin.cjs')
function node(src: string, ...args: string[]): string {
  return execFileSync('node', ['-e', src, ...args], { encoding: 'utf8', cwd: process.cwd() })
}
// 주석 제거는 공용 헬퍼로만 — 손으로 만든 제거기는 문자열 안의 `/*` 에 물려 소스를 통째로 지운다(이 레포 가드).
const code = (p: string) => readCode(p)

describe('① 추적 파일은 빈 자리표시자다', () => {
  it('값이 비어 있다 — 진짜 맵을 다시 커밋하면 빨간불', () => {
    expect(Object.keys(ROUTE_CHUNK_MAP).length, '추적 파일에 진짜 맵이 들어왔다 — 충돌이 되살아난다').toBe(0)
    expect(ENTRY_CSS).toEqual([])
    expect(BOOT_JS).toEqual([])
  })
})

describe('② 생성기는 추적 안 하는 파일로 쓴다', () => {
  it('출력 경로가 .build.ts 이다', () => {
    const g = code('scripts/generate-route-chunk-map.mjs')
    expect(g).toMatch(/ROUTE_CHUNK_MAP_BUILD = join\(ROOT, 'src\/worker\/generated\/route-chunk-map\.build\.ts'\)/)
    expect(g).toMatch(/const OUT = ROUTE_CHUNK_MAP_BUILD/)
  })
  it('git 이 그 파일을 무시한다', () => {
    expect(() => execFileSync('git', ['check-ignore', '-q', 'src/worker/generated/route-chunk-map.build.ts'])).not.toThrow()
  })
})

describe('③ 진짜 esbuild — 번들할 때 바꿔 끼운다', () => {
  function bundle(withBuildFile: boolean): string {
    const dir = mkdtempSync(join(tmpdir(), 'rcm-'))
    try {
      const gen = join(dir, 'src/worker/generated')
      mkdirSync(gen, { recursive: true })
      writeFileSync(join(gen, 'route-chunk-map.ts'), 'export const ROUTE_CHUNK_MAP: Record<string, string[]> = {}\n')
      if (withBuildFile) {
        writeFileSync(join(gen, 'route-chunk-map.build.ts'), 'export const ROUTE_CHUNK_MAP = { home: ["/assets/RealChunk-AbCdEf12.js"] }\n')
      }
      writeFileSync(join(dir, 'src/worker/entry.ts'), "import { ROUTE_CHUNK_MAP } from './generated/route-chunk-map'\nexport const M = ROUTE_CHUNK_MAP\n")
      return node(
        `const esbuild=require('esbuild');const {routeChunkMapPlugin}=require(process.argv[1]);const d=process.argv[2];
         esbuild.build({entryPoints:[d+'/src/worker/entry.ts'],bundle:true,write:false,format:'esm',
           plugins:[routeChunkMapPlugin(d)],logLevel:'silent'}).then(r=>process.stdout.write(r.outputFiles[0].text))`,
        PLUGIN, dir,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
  it('빌드 파일이 있으면 진짜 값이 번들에 들어간다', () => {
    expect(bundle(true), '플러그인이 진짜 맵으로 바꿔 끼우지 않았다').toContain('/assets/RealChunk-AbCdEf12.js')
  })
  it('빌드 파일이 없으면 자리표시자(빈 값) — 종전 "manifest 없음 → 빈 맵" 과 같다', () => {
    expect(bundle(false)).not.toContain('RealChunk')
  })
})

describe('④ 번들 대조 — 빌드 파일엔 있는데 번들엔 없으면 실패', () => {
  function run(bundleText: string, buildText: string | null): { res: string; code: number } {
    const dir = mkdtempSync(join(tmpdir(), 'rcm-a-'))
    try {
      const out = join(dir, '_worker.js'); writeFileSync(out, bundleText)
      const build = join(dir, 'map.build.ts')
      if (buildText != null) writeFileSync(build, buildText)
      const r = node(
        `const {assertRouteChunkMapBundled:a}=require(process.argv[1]);let c=0;console.error=()=>{};console.log=()=>{};
         const res=a(process.argv[2],process.argv[3],(x)=>{c=x});process.stdout.write(JSON.stringify({res,code:c}))`,
        PLUGIN, out, build,
      )
      return JSON.parse(r)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
  const MAP = 'export const ROUTE_CHUNK_MAP = { home: { js: ["/assets/Home-12345678.js"], css: [] } }'
  it('🔴 번들에 청크가 없으면 실패(exit 1)', () => {
    expect(run('/* 빈 번들 */', MAP)).toEqual({ res: 'missing', code: 1 })
  })
  it('✅ 번들에 청크가 있으면 통과', () => {
    expect(run('var m={home:{js:["/assets/Home-12345678.js"]}}', MAP)).toEqual({ res: 'ok', code: 0 })
  })
  it('빈 맵·빌드 파일 없음은 통과(클라 빌드 없는 워커 빌드 — 종전과 같은 결과)', () => {
    expect(run('', 'export const ROUTE_CHUNK_MAP = {}').res).toBe('empty-map')
    expect(run('', null).res).toBe('no-build-file')
  })
})

describe('⑤ 배선 — 워커 빌드와 두 검사', () => {
  it('워커 빌드가 플러그인을 쓰고 번들 뒤에 대조한다', () => {
    const b = code('scripts/build-worker.js')
    expect(b).toMatch(/plugins: \[routeChunkMapPlugin\(\)\]/)
    expect(b).toMatch(/assertRouteChunkMapBundled\('dist\/_worker\.js'\)/)
  })
  it('맵을 읽는 두 검사가 빌드 파일을 본다(자리표시자를 재면 늘 0)', () => {
    for (const f of ['scripts/check-surface-role-leak.mjs', 'scripts/check-surface-budgets.mjs']) {
      expect(code(f), f).toContain("'src/worker/generated/route-chunk-map.build.ts'")
      expect(code(f), f).not.toContain("'src/worker/generated/route-chunk-map.ts'")
    }
  })
})
