#!/usr/bin/env node
/**
 * 🛡️ 영구 방어선 — "새 배포 후 옛 청크 참조 → 흰화면/무한로딩" 자가복구 시스템 회귀 방지.
 *
 * 배경: 이 버그 클래스는 4번+ 재발(2026-06-04, 06-25, 06-29, 06-30). 캐시된 옛 index.html 이
 *   삭제된 청크(/assets/*.{js,css}) 를 참조 → 404 → SPA HTML(text/html) 폴백 →
 *   "Expected a JavaScript module ... MIME type text/html" → 앱 부팅 실패(대시보드 안 켜짐).
 *
 * 자가복구는 4개 불변식의 조합으로 성립한다. 이 중 하나라도 실수로 제거/약화되면 다시 영구
 *   흰화면이 난다. 이 검사는 그 4개가 항상 존재함을 강제한다:
 *
 *   1. index.html  — 인라인 부트가드(어떤 청크보다 먼저 실행 → 엔트리 청크가 깨져도 동작).
 *   2. chunk-error.ts — isChunkLoadError(브라우저 MIME 변종 감지) + reloadWithCacheBust
 *                       (__cb + location.replace 로 stale HTML 재서빙 우회 — plain reload 회귀 금지).
 *   3. main.tsx    — error/unhandledrejection 핸들러가 위 SSOT 를 부팅 후에도 배선.
 *   4. worker      — SPA 셸 HTML 을 no-cache 로 서빙(브라우저가 stale 옛-청크 HTML 캐시하지 않게).
 *
 * 기본 warn-only(exit 0). 차단: STRICT_CHUNK_RECOVERY=1 또는 `-s`.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const STRICT = process.env.STRICT_CHUNK_RECOVERY === '1' || process.argv.includes('-s')

const read = (rel) => {
  const p = join(ROOT, rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

/** @type {{file:string,name:string,must:RegExp[],hint:string}[]} */
const CHECKS = [
  {
    file: 'index.html',
    name: '인라인 부트가드 (엔트리 청크 실패까지 복구)',
    must: [
      /addEventListener\(\s*['"]error['"]/,   // 리소스 에러 리스너
      /\/assets\//,                            // 우리 청크 경로만 처리
      /location\.(?:replace|reload)/,          // reload 복구
    ],
    hint: 'index.html <head> 의 인라인 부트가드가 제거/약화됨 — 번들 안 복구코드가 로드조차 안 되는 닭/달걀 케이스(엔트리 청크 실패)에서 자가복구 불능 → 영구 흰화면.',
  },
  {
    file: 'src/utils/chunk-error.ts',
    name: 'chunk-error SSOT (MIME 감지 + 캐시버스트 reload)',
    must: [
      /export function isChunkLoadError/,
      /export function reloadWithCacheBust/,
      /responded with a mime type|expected a javascript/i, // MIME 변종 감지 유지(빠지면 복구 트리거 안 됨)
      /__cb/,                                  // 캐시버스트 토큰
      /location\.replace/,                     // stale HTML 우회 — plain reload-only 로 회귀 금지
    ],
    hint: 'reloadWithCacheBust 가 plain reload 로 회귀하거나 MIME 변종 감지가 빠지면 stale HTML(옛 청크 해시) 재서빙 → 같은 404 무한 → 영구 흰화면(2026-06-25 사고 패턴).',
  },
  {
    file: 'src/main.tsx',
    name: 'main.tsx 청크-에러 핸들러 배선 (부팅 후 복구)',
    must: [
      /isChunkLoadError/,
      /addEventListener\(\s*['"]error['"]/,
      /unhandledrejection/,                    // dynamic import() reject(React.lazy) 복구
    ],
    hint: 'main.tsx 의 error/unhandledrejection 핸들러가 빠지면 부팅 후 lazy 라우트 청크 실패 시 자동복구 불능.',
  },
  {
    file: 'src/worker/index.ts',
    name: 'SPA 셸 HTML no-cache (stale 옛-청크 HTML 방지)',
    must: [
      // SPA fallback 의 text/html 응답에 no-cache 가 함께 있어야(둘 중 어느 순서든).
      /text\/html[\s\S]{0,240}no-cache|no-cache[\s\S]{0,240}text\/html/,
    ],
    hint: 'worker 가 SPA 셸 HTML 을 no-cache 없이 돌려주면 브라우저가 옛 청크 해시를 참조하는 stale HTML 을 캐시 → 무한로딩 재발(no-cache 가 stale 발생 빈도를 줄이는 1차 방어).',
  },
]

const problems = []
for (const c of CHECKS) {
  const text = read(c.file)
  if (text === null) { problems.push({ c, missing: ['(파일 없음: ' + c.file + ')'] }); continue }
  const missing = c.must.filter((re) => !re.test(text)).map((re) => re.toString())
  if (missing.length) problems.push({ c, missing })
}

if (problems.length === 0) {
  console.log('✅ chunk-recovery guard: 배포-청크 자가복구 4개 불변식 모두 존재 (흰화면/무한로딩 영구 방어).')
  process.exit(0)
}

console.log('⚠️  배포-청크 자가복구 시스템 약화 감지 — "새 배포 후 흰화면/무한로딩" 재발 위험:')
for (const { c, missing } of problems) {
  console.log(`   ✗ [${c.file}] ${c.name}`)
  console.log(`     누락 패턴: ${missing.join(' , ')}`)
  console.log(`     영향: ${c.hint}`)
}
console.log('')
console.log('   이 4개는 함께 동작해야 자가복구가 성립합니다(인라인 부트가드 + chunk-error SSOT + main.tsx 배선 + worker no-cache).')
console.log('   의도적 구조 변경이면 이 검사도 함께 업데이트하세요.')

if (STRICT) {
  console.log('\n❌ STRICT_CHUNK_RECOVERY — 차단.')
  process.exit(1)
}
console.log('\n(warn-only — 차단하려면 STRICT_CHUNK_RECOVERY=1)')
process.exit(0)
