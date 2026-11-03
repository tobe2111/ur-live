#!/usr/bin/env node
/**
 * ⏳ **이 브랜치의 PR 검사가 이미 돌고 있으면, 푸시 직전에 멈춰 알린다** (2026-11-03)
 *
 * 대표 *"낭비 없이 빨리 각 세션의 배포들을 빨리 할 수 있는 방법"* → *"가장 이상적으로 해줘"*.
 *
 * 왜(실측 — 최근 3일 PR 검사 300회): **125회(42%)가 도중에 취소**됐고, 취소된 것들은 평균 **42분** 돈 뒤였다
 * (합계 약 87시간). 같은 PR 에 새 커밋이 올라오면 돌던 검사를 버리고 처음부터 다시 하기 때문이다.
 * 취소의 75%(94회)는 **세션이 수정분을 하나씩 따로 올린 것**이었다 — 모아서 한 번에 올렸으면 버리지 않았을 시간이다.
 * 그런데 푸시하는 쪽은 "지금 검사가 몇 분째 돌고 있다" 를 모른다(그 정보가 GitHub 화면에만 있다).
 *
 * 그래서 푸시 직전에 그 사실을 **보여 주고 멈춘다.** 정말 지금 올려야 하면(빨간불 수리 · 대표가 바로 보길 원함)
 * `PUSH_ANYWAY=1 git push …` 로 넘어간다 — 막는 게 목적이 아니라 **버려질 시간을 보고 고르게** 하는 것이다.
 *
 * 판정: 이 브랜치의 Verify 가 `in_progress`/`queued` 이고 **5분 이상** 돌았으면 멈춘다(막 시작한 건 버려도 싸다).
 * 조회 실패(네트워크·권한)는 **통과** — 이 검사는 정보를 주는 것이지 지키는 것이 아니다(가드가 아니라 안내다).
 * zero-scan-ok — 셀 대상이 "이 브랜치의 돌고 있는 검사" 이고, 0개가 정상이다.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const MIN_MINUTES = 5
export const BYPASS_ENV = 'PUSH_ANYWAY'

/**
 * 순수 판정.
 * @param {{ runs: Array<{status:string, run_started_at?:string, created_at:string, html_url?:string}>, now: Date }} x
 * @returns {{ block: boolean, minutes: number, url: string | null }}
 */
export function judgeInFlight({ runs, now }) {
  let best = null
  for (const r of runs || []) {
    if (r.status !== 'in_progress' && r.status !== 'queued') continue
    const start = new Date(r.run_started_at || r.created_at).getTime()
    const minutes = Math.max(0, (now.getTime() - start) / 60_000)
    if (!best || minutes > best.minutes) best = { minutes, url: r.html_url || null }
  }
  if (!best) return { block: false, minutes: 0, url: null }
  return { block: best.minutes >= MIN_MINUTES, minutes: Math.round(best.minutes), url: best.url }
}

async function main() {
  if (process.env[BYPASS_ENV] === '1') return
  let branch = ''
  let remote = ''
  try {
    branch = execFileSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], { encoding: 'utf8' }).trim()
    remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
  } catch { return }
  const m = /github\.com[/:]([^/]+)\/([^/.]+)/.exec(remote)
  if (!branch || !m || branch === 'main') return
  const url = `https://api.github.com/repos/${m[1]}/${m[2]}/actions/workflows/verify.yml/runs?branch=${encodeURIComponent(branch)}&per_page=5`
  let runs = []
  try {
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'urdeal-pre-push' }, signal: AbortSignal.timeout(6000) })
    if (!res.ok) return
    runs = (await res.json()).workflow_runs || []
  } catch { return }
  const v = judgeInFlight({ runs, now: new Date() })
  if (!v.block) return
  console.error(
    `⏳ 이 브랜치의 PR 검사(Verify)가 ${v.minutes}분째 돌고 있다 — 지금 올리면 그 검사가 **취소되고 처음부터** 다시 돈다.\n` +
      `   ${v.url ?? ''}\n` +
      '   남은 수정이 더 있으면 모아서 한 번에 올리는 것이 빠르다(최근 3일 PR 검사의 42% 가 이렇게 버려졌다).\n' +
      `   지금 올려야 하면(빨간불 수리 등): ${BYPASS_ENV}=1 git push …`,
  )
  process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
