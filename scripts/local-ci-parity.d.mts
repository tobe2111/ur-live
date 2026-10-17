/** scripts/local-ci-parity.mjs 의 타입 선언 — `.mjs` 의 짝은 `.d.ts` 가 아니라 `.d.mts` 다. */
export function ciStrictGuards(ymlPath?: string): string[]
export function ciWarnGuards(ymlPath?: string): string[]
export function guardsMentioned(ymlPath?: string): string[]
/** 한 `run:` 블록이 돌리는 가드 — 리터럴 경로 + `npm run X` 해석(check-* 만). */
export function guardsIn(run: string): string[]
/** 한 워크플로의 `run:` 스텝 전부 — YAML 파서를 두 벌 만들지 않기 위한 공용 리더. */
export function runSteps(ymlPath: string): {
  name: string
  run: string
  env: Record<string, string>
  warn: boolean
}[]
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
