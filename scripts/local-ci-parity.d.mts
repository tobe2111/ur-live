/** scripts/local-ci-parity.mjs 의 타입 선언 — `.mjs` 의 짝은 `.d.ts` 가 아니라 `.d.mts` 다. */
export function ciStrictGuards(ymlPath?: string): string[]
export function ciWarnGuards(ymlPath?: string): string[]
export function guardsMentioned(ymlPath?: string): string[]
export function localGateGuards(ymlPath?: string): string[]
/** CI 의 명령·env 를 그대로 실은 strict 스텝 — 게이트는 이름이 아니라 이걸 돌린다. */
export function localGateSteps(ymlPath?: string): {
  name: string
  run: string
  env: Record<string, string>
  guards: string[]
}[]
export function workflowFiles(dir?: string): string[]
export function workflowYamlErrors(dir?: string): { file: string; message: string }[]
export const EXCLUDE: Record<string, string>
