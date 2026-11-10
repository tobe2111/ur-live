/**
 * 🌐 **푸시 전 안내 검사가 GitHub 를 읽는 단 하나의 길** (2026-11-10)
 *
 * 대표 *"또 다른 개선점"*.
 *
 * ## 왜 (실측 2026-11-10)
 * `check-verify-in-flight.mjs`(검사 도중 재푸시 경고)와 `check-pr-collision.mjs`(열린 PR 겹침 경고)는
 * Node 의 `fetch` 로 GitHub 를 읽었다. 그런데 **클라우드 세션은 밖으로 나가는 길이 프록시뿐**이고,
 * Node 의 `fetch` 는 `HTTPS_PROXY` 를 **안 본다** — 실측 `fetch(api.github.com)` → **403**, 같은 주소를 curl(프록시)로 → 200.
 * 두 스크립트 다 "조회 실패는 조용히 통과" 라서 **11/3 에 만든 날부터 클라우드에선 한 번도 일하지 않았다.**
 * 그 사이 PR 검사 취소 32건 중 **25건이 5분 넘게 돈 검사를 재푸시가 죽인 것**(이 경고가 멈췄어야 할 자리 · 합계 약 280분)이었다.
 * (내 세션에서 Verify 가 10분째 도는데 `check-verify-in-flight` 가 exit 0 을 내는 것으로 확인했다.)
 *
 * ## 무엇을 하나
 * 프록시가 설정돼 있으면 **curl** 로 읽는다(curl 은 `HTTPS_PROXY` 와 프록시 CA 를 따르고, 프록시가 인증을 붙인다).
 * 아니면(대표 PC 등) 종전처럼 `fetch`. 2xx 가 아니면 **던진다** — 호출하는 쪽이 "못 읽었다" 를 한 줄로 말하게.
 * ⇒ CLAUDE.md 3-1: *조용히 통과하는 실패는 그 자체가 결함이다.*
 */
import { execFileSync } from 'node:child_process'

const HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'urdeal-pre-push' }

/** 순수 — 프록시 주소(없으면 빈 문자열). */
export function proxyFor(env) {
  return env.HTTPS_PROXY || env.https_proxy || ''
}

/**
 * GitHub API 를 읽어 JSON 을 돌려준다. 실패(네트워크·2xx 아님)는 `HTTP 403` 같은 이유를 담아 던진다.
 * @param {string} url
 * @param {{ env?: Record<string, string | undefined>, timeoutMs?: number, run?: typeof execFileSync, fetchImpl?: typeof fetch }} [o]
 */
export async function getGithubJson(url, { env = process.env, timeoutMs = 6000, run = execFileSync, fetchImpl = fetch } = {}) {
  if (proxyFor(env)) {
    const args = ['-sS', '--max-time', String(Math.ceil(timeoutMs / 1000)), '-w', '\n%{http_code}']
    for (const [k, v] of Object.entries(HEADERS)) args.push('-H', `${k}: ${v}`)
    args.push(url)
    const out = String(run('curl', args, { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }))
    const cut = out.lastIndexOf('\n')
    const status = Number(out.slice(cut + 1).trim())
    if (!(status >= 200 && status < 300)) throw new Error(`HTTP ${status || '?'}`)
    return JSON.parse(out.slice(0, cut))
  }
  const res = await fetchImpl(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
