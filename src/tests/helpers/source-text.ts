/**
 * 🔧 **텍스트 기반 가드의 공통 함정 두 개** — 2026-08-01 세션 ③ 에서 **네 번** 밟고 만든 헬퍼.
 *
 * 이 레포의 여러 불변식은 소스를 문자열로 읽어 판정한다. 그때 반복해서 헛돈 이유가 정확히 둘이었다:
 *
 * ## ① **주석이 코드 행세를 한다**
 * `if` 에서 조건을 빼도 **바로 위 설명 주석에 같은 이름이 남아** 초록이 떴다.
 * (CLAUDE.md 의 `check-lock-table-symbols` 가 이미 경고한 클래스 —
 *  *"심볼이 주석에만 남아도 통과한다"*. 알고 있었는데도 세 번 더 밟았다.)
 * ⚠️ `//` 만 지우면 부족하다 — **파일 헤더의 `/** ... *\/` 블록 주석**이 남는다(네 번째가 이것).
 *
 * ## ② **앵커를 안 잡으면 남의 코드를 검사한다**
 * `code.indexOf('c.req.json<{')` 를 파일 처음부터 찾으면 **다른 엔드포인트의 body** 가 잡힌다.
 * 대상 핸들러부터 앵커한 뒤 그 안에서 찾아야 한다 — `sliceFrom` 이 그 용도다.
 *
 * > 새 텍스트 가드를 쓸 때 **이 두 가지를 기본으로 깔고 시작할 것.**
 * > 그리고 반드시 **되돌려-검증**(위반 주입 → 빨강 확인)을 할 것 — 넷 다 되돌려-검증에서만 드러났다.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

/** 소스에서 주석(`//` · `/* *\/`)을 제거한 **코드만**. 문자열 리터럴 안의 `//` 는 드물어 감수한다. */
export function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 블록 — 파일 헤더 JSDoc 포함
    .replace(/\/\/[^\n]*/g, '')          // 라인
}

/** 레포 상대경로 → **주석 제거된 코드**. 텍스트 가드의 기본 입력. */
export function readCode(relPath: string): string {
  return stripComments(readFileSync(resolve(process.cwd(), relPath), 'utf8'))
}

/** 레포 상대경로 → 원문(주석 포함). 주석 자체를 검사할 때만 쓴다. */
export function readRaw(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf8')
}

/**
 * ## ③ **심볼이 다른 이유로도 존재한다**
 * `expect(code).toContain('parseUTCDate')` 는 **import 문**이 남아 있으면 통과한다 —
 * 실제 호출을 지워도 초록이다(되돌려-검증에서 두 번 겪었다).
 * `usesSymbol` 은 **import 라인을 빼고** 본다.
 * ⚠️ 그래도 *"쓰긴 쓰는데 엉뚱한 데서"* 는 못 막는다 — 그건 `sliceFrom` 으로 범위를 좁혀야 한다.
 */
export function stripImports(code: string): string {
  return code.replace(/^\s*import\s[\s\S]*?(?:from\s+['"][^'"]+['"];?|['"][^'"]+['"];?)\s*$/gm, '')
}

/** import 를 뺀 코드에서 심볼이 **실제로 쓰이는가**. */
export function usesSymbol(code: string, name: string): boolean {
  return new RegExp(`\\b${name}\\s*[(<.[]`).test(stripImports(code))
}

/**
 * `anchor` 부터 시작하는 구간을 잘라낸다 — **남의 핸들러를 검사하지 않기 위해.**
 * @param end 선택. 주면 anchor 이후 첫 `end` 까지, 없으면 `maxLen` 만큼.
 */
export function sliceFrom(code: string, anchor: string, end?: string, maxLen = 2000): string {
  const i = code.indexOf(anchor)
  if (i < 0) return ''
  if (end) {
    const j = code.indexOf(end, i)
    return j < 0 ? code.slice(i, i + maxLen) : code.slice(i, j)
  }
  return code.slice(i, i + maxLen)
}
