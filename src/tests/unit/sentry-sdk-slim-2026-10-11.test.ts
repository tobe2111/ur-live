/**
 * 📦 Sentry 는 쓰는 함수만 번들에 넣는다 (2026-10-11 — 대표 "Shrink large lazy chunks" 작업 진행 지시)
 *
 * 무엇이 깨졌었나: 앱이 `import('@sentry/react')` 로 **패키지를 통째로** 동적 import 하고 그 모듈 객체를 변수에
 *   담아 썼다. 번들러는 어떤 함수가 쓰일지 몰라 패키지 전부를 sentry 청크에 넣었다 — 실측 **431 KB raw**.
 *   실제로 쓰는 함수는 6개뿐이다(init · browserTracingIntegration · captureException · captureMessage ·
 *   addBreadcrumb · setUser). `src/lib/sentry-sdk.ts` 가 그 6개만 다시 내보내고 동적 import 가 그 파일을
 *   가리키자 **129 KB raw** 가 됐다(−302 KB). 에러가 안 나고 화면도 그대로라 누구도 신고하지 않는 종류다.
 *
 * 이 시험이 **못 보는 것**: 실제 청크 크기(빌드가 필요 — `check-bundle-size` 예산이 본다) ·
 *   Sentry 가 라이브에서 실제로 이벤트를 보내는지(배포 뒤 Sentry 대시보드).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => readFileSync(p, 'utf-8')

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== 'tests') walk(p, out) }
    else if (/\.(ts|tsx)$/.test(n)) out.push(p)
  }
  return out
}

describe('Sentry 는 진입점 하나로만 들어온다', () => {
  it('🔴 앱 코드 어디에서도 @sentry/react 를 직접 import 하지 않는다 (진입점만 예외)', () => {
    const files = walk('src')
    expect(files.length, '검사 대상이 비었다 — 경로가 낡았다(통과 아님)').toBeGreaterThan(500)
    const offenders = files
      .filter((f) => !f.endsWith('src/lib/sentry-sdk.ts'))
      .filter((f) => /['"]@sentry\/react['"]/.test(stripComments(read(f))))
    expect(offenders, `패키지 통째 import — sentry 청크가 다시 430 KB 로 돌아간다: ${offenders.join(', ')}`).toEqual([])
  })

  it('진입점은 쓰는 이름만 다시 내보낸다 (통째 재수출 금지)', () => {
    const src = stripComments(read('src/lib/sentry-sdk.ts'))
    expect(src).not.toMatch(/export \* from ['"]@sentry\/react['"]/)
    for (const name of ['init', 'browserTracingIntegration', 'captureException', 'captureMessage', 'addBreadcrumb', 'setUser']) {
      expect(src, `${name} 이 빠지면 그 호출이 런타임에 undefined`).toMatch(new RegExp(`\\b${name}\\b`))
    }
  })

  it('세 호출부가 진입점을 동적 import 한다 (첫 페인트 영향 0 유지)', () => {
    for (const f of ['src/lib/sentry.ts', 'src/lib/performance-monitor.ts', 'src/lib/api.ts']) {
      expect(stripComments(read(f)), f).toMatch(/import\('\.\/sentry-sdk'\)/)
    }
  })

  it('🔴 진입점은 sentry 청크에 묶인다 (다른 청크로 새면 Sentry 가 첫 화면에 실린다)', () => {
    expect(stripComments(read('vite.config.ts'))).toMatch(/id\.includes\('@sentry'\) \|\| id\.includes\('\/src\/lib\/sentry-sdk'\)\) return 'sentry'/)
  })
})
