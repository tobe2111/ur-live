#!/usr/bin/env node
/**
 * 🔁 **실패한 CI 스텝의 출력을 annotation 으로도 내보내는 래퍼** (2026-10-16).
 *
 * 쓰는 법 (워크플로에서 명령 앞에 붙인다):
 *   run: node scripts/ci-run.mjs node scripts/check-exec-cost.mjs
 *
 * ## 왜 래퍼인가 — 스크립트 세 개를 각각 고치지 않는다
 * main 전용 래칫 셋(`check-bundle-size` · `check-surface-budgets` · `check-exec-cost`)이
 * **같은 눈먼 자리**를 공유한다: 실패 이유를 stdout 으로만 말하고, 세션은 그 로그를 읽을 수 없다
 * (`actions/jobs/<id>/logs` 가 blob 으로 302 → 이 환경의 `gh` 는 api.github.com 밖으로 안 간다).
 * 각 스크립트의 `console.error` 자리를 고치면 **세 벌이 되고 새 가드는 또 샌다.**
 * 래퍼는 한 자리에서 모든 스텝을 덮고, 앞으로 추가되는 래칫도 명령 앞에 한 번 붙이면 끝난다.
 *
 * ## 무엇을 보장하나
 * 1. **라이브 로그를 안 깨뜨린다** — 받은 조각을 그대로 흘려보내며(tee) 버퍼에도 쌓는다.
 *    `spawnSync` 로 모아서 찍으면 긴 스텝(8분)이 끝까지 아무것도 안 보인다.
 * 2. **종료코드를 그대로 전달한다** — 가드가 막던 것을 이 래퍼가 통과시키면 안 된다.
 *    신호로 죽었으면 `128+signo` 로 바꿔 **0 이 되지 않게** 한다(가장 조용한 실패 모드다).
 * 3. 실패할 때만 annotation 을 낸다(성공 로그를 소음으로 덮지 않는다).
 */
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { emitAnnotation, appendSummary } from './lib/ci-annotate.mjs'

/** annotation 하나에 넣는 꼬리 길이 — GitHub 가 길면 자른다. 끝이 결론이라 뒤를 남긴다. */
export const TAIL_CHARS = 4000
/** 잡 요약에 넣는 길이(요약 상한 1MB — 스텝이 여러 개라 넉넉히 줄인다). */
export const SUMMARY_CHARS = 20000

/** 뒤에서 n 자를 남기고, 잘랐으면 그 사실을 말한다(순수 — 테스트가 이것을 잰다). */
export function tail(text, n) {
  const s = String(text)
  if (s.length <= n) return s
  return `…(앞부분 ${s.length - n}자 생략 — 전문은 로그)\n` + s.slice(-n)
}

/** 신호로 죽은 것을 0 으로 읽지 않는다(순수). */
export function exitCodeOf(code, signal) {
  if (signal) return 128 + (os.constants.signals[signal] || 1)
  return code ?? 1
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.length === 0) {
    console.error('❌ ci-run: 실행할 명령이 없다 — `node scripts/ci-run.mjs <cmd> [args…]`')
    process.exit(2)
  }
  const [cmd, ...args] = argv
  const label = process.env.CI_RUN_LABEL || argv.join(' ')
  // warn 수준 스텝(`continue-on-error: true`)은 `CI_RUN_LEVEL=warning` 을 준다 —
  // 통과하는 잡에 `error` annotation 이 붙으면 다음 세션이 초록을 빨강으로 오독한다.
  const level = process.env.CI_RUN_LEVEL === 'warning' ? 'warning' : 'error'
  let buf = ''
  const child = spawn(cmd, args, { stdio: ['inherit', 'pipe', 'pipe'] })
  for (const [stream, sink] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    stream.setEncoding('utf8')
    stream.on('data', (c) => { buf += c; sink.write(c) })
  }
  child.on('error', (err) => {
    // 실행 자체가 안 된 경우(명령 없음 등) — 이것도 조용히 넘어가면 안 된다.
    emitAnnotation(level, `${label}: 실행 실패 — ${err.message}`, { title: 'ci-run' })
    process.exit(127)
  })
  child.on('close', (code, signal) => {
    const exit = exitCodeOf(code, signal)
    if (exit !== 0) {
      emitAnnotation(level, `${label} 실패(exit ${exit})\n${tail(buf, TAIL_CHARS)}`, { title: 'ci-run' })
      appendSummary(`### ❌ ${label} (exit ${exit})\n\n\`\`\`\n${tail(buf, SUMMARY_CHARS)}\n\`\`\`\n`)
    }
    process.exit(exit)
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main()
