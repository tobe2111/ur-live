/** 타입 선언 — 구현·근거는 github-api.mjs. */
export function proxyFor(env: Record<string, string | undefined>): string
export function getGithubJson(url: string, o?: {
  env?: Record<string, string | undefined>
  timeoutMs?: number
  run?: (cmd: string, args: string[], opts?: unknown) => string | Buffer
  fetchImpl?: (url: string, init?: unknown) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>
}): Promise<any>
