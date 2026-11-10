#!/usr/bin/env node
/**
 * 🚧 **올리기 직전 — 이 PR 이 남과 부딪힐 크기·자리인지 알려 준다** (2026-11-03, 경고만 · 막지 않는다)
 *
 * 대표 *"둘 다 만들어줘"* (큰 PR 경고 + 열린 PR 과의 겹침 경고).
 *
 * ## 왜 (실측 2026-11-03)
 * PR #2139 는 **348파일 · 커밋 29개 · 12시간** 열려 있으면서 **하루 여덟 번** main 과 충돌했다. 검사가 느려서가 아니었다
 * (단위 시험 4분 · 변경분 8대 동시) — **다른 세션의 PR(#2159 모션 21차)이 같은 파일을 동시에 고치고 있었다**
 * (`sub-page-header.tsx` · `CouponClaimPage.tsx`). 어느 쪽이 먼저 머지되든 다른 쪽은 충돌을 풀고 검사를 처음부터 다시 돈다.
 * 기존 `check-branch-overlap.mjs` 는 **이미 main 에 들어간 것**과의 겹침만 봐서, 아직 PR 로 떠 있는 남의 작업은 못 봤다.
 * 그리고 머지 대기열도 이건 못 푼다(같은 줄을 서로 다르게 고친 충돌은 사람이 풀어야 한다).
 *
 * ## 무엇을 알리나
 *   ① **큰 PR** — main 과 갈라진 뒤 바꾼 파일이 `MAX_FILES` 넘거나, 첫 커밋이 `MAX_AGE_HOURS` 넘게 묵었으면
 *      "작게 나눠 먼저 머지하라" (오래·넓게 열려 있을수록 남과 부딪힐 면적과 시간이 같이 커진다)
 *   ② **열린 PR 과의 겹침** — 다른 열린 PR 이 고치고 있는 파일을 나도 고쳤으면 그 PR 번호와 파일
 *      (번역 파일·인계·시안 줄 파일처럼 자리가 흩어져 git 이 알아서 합치는 것은 뺀다)
 *
 * 경고만 한다 — 같은 파일을 고친다고 꼭 충돌하는 것은 아니고, 막으면 우회가 습관이 된다.
 * 조회 실패(네트워크·권한)는 조용히 넘어간다(안내이지 가드가 아니다).
 * zero-scan-ok — 셀 대상이 "지금 열린 남의 PR" 이고, 0개가 정상이다.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getGithubJson } from './github-api.mjs'

export const MAX_FILES = 60
export const MAX_AGE_HOURS = 6
/** 자리가 흩어져 git 이 알아서 합치는 파일 — 겹쳐도 알리지 않는다(매번 울면 안 읽는다). */
export const IGNORE = [/^public\/locales\//, /^docs\/handoff\//, /^docs\/design\/index\//, /^docs\/decisions\//]

/** 순수 — 큰 PR 판정. */
export function judgeSize({ files, ageHours }) {
  const why = []
  if (files > MAX_FILES) why.push(`바꾼 파일 ${files}개(기준 ${MAX_FILES})`)
  if (ageHours > MAX_AGE_HOURS) why.push(`갈라진 지 ${Math.round(ageHours)}시간(기준 ${MAX_AGE_HOURS})`)
  return why
}

/**
 * 순수 — 열린 PR 과의 겹침.
 * @param {{ mine: string[], others: Array<{ number: number, title: string, files: string[] }> }} x
 * @returns {Array<{ number: number, title: string, files: string[] }>}
 */
export function judgeOverlap({ mine, others }) {
  const set = new Set(mine.filter((f) => !IGNORE.some((re) => re.test(f))))
  const out = []
  for (const o of others) {
    const hit = o.files.filter((f) => set.has(f))
    if (hit.length) out.push({ number: o.number, title: o.title, files: hit })
  }
  return out.sort((a, b) => b.files.length - a.files.length)
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

const getJson = (url) => getGithubJson(url)

async function main() {
  let branch, base, repo
  try {
    branch = git(['symbolic-ref', '--short', '-q', 'HEAD'])
    base = git(['merge-base', 'HEAD', 'origin/main'])
    const m = /github\.com[/:]([^/]+)\/([^/.]+)/.exec(git(['remote', 'get-url', 'origin']))
    repo = m ? `${m[1]}/${m[2]}` : ''
  } catch { return }
  if (!branch || branch === 'main' || !base || !repo) return
  const mine = git(['diff', '--name-only', `${base}..HEAD`]).split('\n').filter(Boolean)
  if (mine.length === 0) return
  const firstTs = Number(git(['log', '--reverse', '--format=%ct', `${base}..HEAD`]).split('\n')[0] || 0)
  const ageHours = firstTs ? (Date.now() / 1000 - firstTs) / 3600 : 0

  const size = judgeSize({ files: mine.length, ageHours })
  if (size.length) {
    console.log(`🚧 큰 PR — ${size.join(' · ')}. 오래·넓게 열려 있을수록 다른 세션과 부딪혀 검사를 처음부터 다시 도는 일이 잦아진다`)
    console.log('   (2026-11-03 #2139: 348파일 · 12시간 · 하루 충돌 8번). 다 된 부분부터 작게 나눠 먼저 머지할 것.')
  }

  let overlaps = []
  try {
    const prs = (await getJson(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=50`))
      .filter((p) => p.head?.ref !== branch)
      .slice(0, 15)
    const others = await Promise.all(prs.map(async (p) => {
      try {
        const files = await getJson(`https://api.github.com/repos/${repo}/pulls/${p.number}/files?per_page=100`)
        return { number: p.number, title: String(p.title || '').slice(0, 50), files: files.map((f) => f.filename) }
      } catch { return { number: p.number, title: '', files: [] } }
    }))
    overlaps = judgeOverlap({ mine, others })
  } catch (err) {
    // 🩸 2026-11-10: 말없이 return 이라 클라우드(프록시)에선 11/3 부터 안 돌았다(github-api.mjs 머리말).
    console.log(`⚠️ 열린 PR 겹침 경고: GitHub 를 못 읽어 건너뛴다(${String(err?.message ?? err).slice(0, 60)}).`)
    return
  }
  if (overlaps.length) {
    console.log(`🚧 다른 세션의 열린 PR 이 같은 파일을 고치고 있다 — 먼저 머지되는 쪽이 이기고, 나머지는 충돌을 풀고 검사를 다시 돈다:`)
    for (const o of overlaps.slice(0, 5)) {
      console.log(`   · #${o.number} ${o.title} — ${o.files.slice(0, 4).join(', ')}${o.files.length > 4 ? ` 외 ${o.files.length - 4}개` : ''}`)
    }
    console.log('   겹치는 파일을 줄이거나, 대표께 순서를 정해 달라고 세 줄로 보고할 것(CLAUDE.md 🧱 세션 = 작업 하나 · 4번).')
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main()
