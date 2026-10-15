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
    for (const name of ['init', 'browserTracingIntegration', 'browserSessionIntegration', 'captureException', 'captureMessage', 'addBreadcrumb', 'setUser']) {
      expect(src, `${name} 이 빠지면 그 호출이 런타임에 undefined`).toMatch(new RegExp(`\\b${name}\\b`))
    }
  })

  it('SDK 는 lib/sentry 의 ensureSentry 한 곳에서만 동적 import 한다 (첫 페인트 영향 0 유지)', () => {
    expect(stripComments(read('src/lib/sentry.ts'))).toMatch(/import\('\.\/sentry-sdk'\)/)
    // 2026-10-15: 성능 측정·API 오류는 SDK 를 직접 부르지 않고 lib/sentry 를 거친다(보낼 때만 켠다).
    for (const f of ['src/lib/performance-monitor.ts', 'src/lib/api.ts']) {
      const src = stripComments(read(f))
      expect(src, f).not.toMatch(/(?<!typeof )import\('\.\/sentry-sdk'\)/) // 타입 표기(typeof import)는 런타임이 아니다
      expect(src, f).toMatch(/import\('\.\/sentry'\)/)
    }
  })

  it('📡 빵부스러기·사용자 정보는 SDK 를 부르지 않고 쌓기만 한다 — 보낼 것이 생길 때만 켠다(2026-10-15)', () => {
    const src = stripComments(read('src/lib/sentry.ts'))
    // 함수 본문만 잘라 본다 — 이름 접두가 같은 함수(setUser / setUserContext)를 섞어 읽지 않게.
    const body = (name: string) => { const i = src.indexOf(`export function ${name}(`); expect(i, name).toBeGreaterThan(-1); return src.slice(i, src.indexOf('\n}\n', i)) }
    for (const n of ['addBreadcrumb', 'queueBreadcrumb', 'setUser', 'setUserContext']) {
      expect(body(n), n).toMatch(/whenReady\(/)
      expect(body(n), n).not.toMatch(/ensureSentry\(/)
    }
    const perf = stripComments(read('src/lib/performance-monitor.ts'))
    expect(perf).toMatch(/addBreadcrumb:[\s\S]{0,120}queueBreadcrumb\(b\)/)
    expect(perf).not.toMatch(/addBreadcrumb:[\s\S]{0,120}ensureSentry/)
  })

  it('📡 미리 켜는 것은 표본 1% 뿐이고, 나머지는 오류가 날 때 켠다(2026-10-15)', () => {
    const main = stripComments(read('src/main.tsx'))
    expect(main).toMatch(/const SENTRY_PRELOAD_RATE = 0\.01/)
    expect(main).toMatch(/if \(Math\.random\(\) < SENTRY_PRELOAD_RATE\)/)
    expect(main).toMatch(/addEventListener\('error', onErrorEvent\)/)
    expect(main).toMatch(/addEventListener\('unhandledrejection', onRejection\)/)
    // 켜진 뒤엔 SDK 전역 핸들러가 잡는다 — 리스너를 떼지 않으면 같은 오류가 두 번 간다.
    expect(main).toMatch(/removeEventListener\('error', onErrorEvent\)/)
    // 오류가 나도 부팅 한가운데서 켜지 않는다(지도 실측 — 카카오 실패 한 건이 SDK 67KB 를 끌고 왔다).
    expect(main).toMatch(/const SENTRY_ON_ERROR_DELAY_MS = 5000/)
    expect(main).toMatch(/\}\)\.catch\(swallow\('main:sentry-on-error'\)\), SENTRY_ON_ERROR_DELAY_MS\)/)
  })

  it('🔴 진입점은 sentry 청크에 묶인다 (다른 청크로 새면 Sentry 가 첫 화면에 실린다)', () => {
    expect(stripComments(read('vite.config.ts'))).toMatch(/id\.includes\('@sentry'\) \|\| id\.includes\('\/src\/lib\/sentry-sdk'\)\) return 'sentry'/)
  })

  it('📡 세션은 페이지 단위다 — 화면 이동마다 센트리로 요청을 보내지 않는다(2026-10-15)', () => {
    expect(stripComments(read('src/lib/sentry.ts'))).toMatch(/browserSessionIntegration\(\{ lifecycle: 'page' \}\)/)
  })
})
