#!/usr/bin/env node
/**
 * 🛡️ 2026-07-29: tsconfig 가 **타입체크를 통째로 중단시키는** 설정을 갖지 않게 한다.
 *
 * ## 무슨 일이 있었나
 *
 * `tsconfig.json` 에 `baseUrl` 이 있었는데, TypeScript 6 부터 이건 **경고가 아니라 에러**다
 * (TS5101, TS 7 에서 완전 제거 예정). 그래서 최신 tsc 로 돌리면 설정 로드 단계에서 **즉시 중단**되고
 * **파일을 하나도 검사하지 않은 채** 끝난다 — 출력이 짧아 "에러 없음" 과 구분이 안 된다.
 *
 * 이 세션이 실제로 그 상태의 tsc 를 "에러 0" 으로 읽었고, 그래서 인계 문서에 *"로컬 tsc 는 죽어 있다.
 * CI 가 유일한 타입 검증"* 이라고 적힌 채 몇 세션이 지나갔다. 원인은 이 한 줄이었다.
 *
 * ## 왜 `ignoreDeprecations` 로 막지 않았나
 *
 * `"ignoreDeprecations": "6.0"` 은 TS 6 을 조용히 시킬 뿐이고, **레포가 고정한 TS 5.5 는 그 값을 거부**해
 * 오히려 CI 를 깨뜨린다(버전 결합). 대신 `baseUrl` 을 없애고 `paths` 를 tsconfig 기준 상대경로로 바꿨다 —
 * TS 4.1+ 에서 지원되는 형태라 5·6 양쪽에서 동작하고 TS 7 도 대비된다.
 * 확인: `baseUrl` 에 의존하던 비상대 import 는 **0건**, `@/` 별칭 4,094건은 그대로 해석된다.
 * 빌드 도구(vite·vitest·esbuild)는 tsconfig 와 무관하게 각자 `@` 별칭을 정의하므로 영향 없다.
 *
 * ## 검사
 *
 *   R1  tsconfig 에 `baseUrl` 이 없을 것 (TS 6 에서 타입체크 중단, TS 7 에서 제거)
 *   R2  `paths` 값은 `./` 로 시작하는 상대경로일 것 (baseUrl 없이 동작하려면 필요)
 *   R3  `ignoreDeprecations` 를 쓰지 말 것 (버전 결합 — 고정 TS 에서 거부돼 CI 가 깨진다)
 *
 * ⚠️ 이 가드가 **못 보는 것**: "설정은 멀쩡한데 검사 대상이 0개" 인 다른 원인(include 오타 등).
 *    그건 `verify.yml` 의 "검사 대상 수 확인" 스텝이 파일 수 하한으로 잡는다. 둘은 짝이다.
 *
 * 기본 warn-only(exit 0). 차단: STRICT_TSCONFIG=1 또는 `-s`.
 */
import { readFileSync, existsSync } from 'node:fs'

const STRICT = process.env.STRICT_TSCONFIG === '1' || process.argv.includes('-s')
const FILES = ['tsconfig.json', 'tsconfig.worker.json', 'tsconfig.node.json'].filter(existsSync)

if (FILES.length === 0) {
  console.error('❌ [tsconfig] tsconfig 를 하나도 못 찾았다 — 스캔 대상 부재는 통과가 아니다.')
  process.exit(1)
}

/**
 * JSONC(주석 허용) 파싱.
 *
 * ⚠️ 정규식으로 주석을 지우면 **안 된다** — tsconfig 의 glob 이 주석처럼 생겼다.
 *   첫 구현이 `/\/\*[\s\S]*?\*\//g` 를 썼다가 `"@/*"` 의 `/*` 를 블록주석 시작으로 잡고
 *   `"src/**\/*"` 의 `*\/` 까지 통째로 삼켜, **멀쩡한 tsconfig 를 "파싱 실패"로 신고**했다.
 *   그래서 문자열 안/밖을 구분하는 스캐너로 처리한다.
 */
function stripJsonComments(src) {
  let out = ''
  let inStr = false, esc = false, i = 0
  while (i < src.length) {
    const c = src[i]
    if (inStr) {
      out += c
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      i++
      continue
    }
    if (c === '"') { inStr = true; out += c; i++; continue }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
    if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    out += c
    i++
  }
  // 후행 콤마 제거(JSONC 허용, JSON.parse 는 거부)
  return out.replace(/,(\s*[}\]])/g, '$1')
}
const parse = (src) => JSON.parse(stripJsonComments(src))

const violations = []
for (const f of FILES) {
  let cfg
  try { cfg = parse(readFileSync(f, 'utf8')) } catch (e) {
    violations.push(`${f}: 파싱 실패 (${e.message}) — 설정이 깨지면 tsc 가 아무것도 검사하지 않는다`)
    continue
  }
  const co = cfg.compilerOptions || {}
  if ('baseUrl' in co) {
    violations.push(`${f}: \`baseUrl\` 사용 — TS 6 에서 TS5101 에러로 **타입체크가 즉시 중단**된다(파일 0개 검사).`)
  }
  if ('ignoreDeprecations' in co) {
    violations.push(`${f}: \`ignoreDeprecations\` 사용 — 버전 결합. 고정 TS(5.x)가 값을 거부해 CI 가 깨진다. 설정 자체를 고칠 것.`)
  }
  for (const [key, arr] of Object.entries(co.paths || {})) {
    for (const v of arr || []) {
      if (!v.startsWith('./') && !v.startsWith('../')) {
        violations.push(`${f}: paths["${key}"] 의 "${v}" 가 상대경로가 아니다 — baseUrl 없이는 해석되지 않는다("./" 를 붙일 것).`)
      }
    }
  }
}

if (violations.length) {
  console.error(`❌ [tsconfig] 타입체크를 무력화할 수 있는 설정 ${violations.length}건:`)
  for (const v of violations) console.error(`   ${v}`)
  console.error(`\n   → 설정 로드가 중단되면 tsc 는 **0개 파일 검사 후 0 에러**로 끝난다. 성공과 구분되지 않는다.`)
  process.exit(STRICT ? 1 : 0)
}
console.log(`✅ tsconfig: ${FILES.length}개 파일 — baseUrl 없음 · paths 상대경로 · ignoreDeprecations 없음.`)
