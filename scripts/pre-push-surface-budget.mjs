#!/usr/bin/env node
/**
 * 📏 **올리기 전에 화면 무게를 미리 잰다** — 화면 코드를 바꾼 푸시에만 (2026-11-10)
 *
 * 대표 *"더 개선할 건 뭐야"* → *"응 해줘"*.
 *
 * ## 왜 (실측 — 11/3~11/10 PR 검사 실패 32건)
 * **화면 무게 예산 12건 · 실행 비용 6건 = 실패의 56%** 였고, 무게 12건 중 11건이 허용치(1.5KB)를 **0~0.3KB** 넘긴 것이었다.
 * 이 둘은 화면을 실제로 빌드해야 잴 수 있어 푸시 전 로컬 게이트에서 빠져 있었다(`local-ci-parity.mjs` EXCLUDE).
 * 그래서 세션은 CI(약 11분)가 끝나서야 "조금 넘었다" 를 알고, 기준값을 갱신해 다시 올리고, 검사를 한 번 더 돌렸다.
 * 로컬에서 같은 측정은 **약 43초**(클라 빌드 41초 + 청크 맵 0초 + 측정 2초, 2026-11-10 실측)다.
 *
 * ## 하는 일
 *   이 브랜치가 화면 코드를 바꿨으면(`needsSurfaceCheck`) CI 와 **같은 환경변수**로 `build:client` →
 *   `generate-route-chunk-map` → `check-surface-budgets` 를 돌린다. 넘으면 푸시를 멈추고 CI 가 낼 메시지를 그대로 보여 준다.
 *   빌드가 이 환경 탓에 실패하면(의존성 없음 등) **막지 않는다** — CI 가 다시 잰다(안내이지 마지막 방어선이 아니다).
 *   우회: `SKIP_SURFACE_PREPUSH=1 git push …`
 *
 * ## 못 하는 것
 *   - 실행 비용(`check-exec-cost`) — 브라우저를 띄워 화면을 그려야 해 로컬에선 3~6분이라 뺐다. CI 의 `exec-cost` 잡이 본다.
 *   - 로컬과 CI 의 의존성이 다르면 바이트가 조금 다를 수 있다 — 그래서 최종 판정은 여전히 CI 다.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** CI(verify.yml 의 Build client)와 같은 더미 값 — 다르면 번들 바이트가 달라진다. 시험이 verify.yml 과 대조한다. */
export const CI_BUILD_ENV = {
  VITE_FIREBASE_API_KEY: 'pr-verify-dummy',
  VITE_FIREBASE_AUTH_DOMAIN: 'pr.example.com',
  VITE_FIREBASE_PROJECT_ID: 'pr-verify',
  VITE_FIREBASE_STORAGE_BUCKET: 'pr.example.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '0',
  VITE_FIREBASE_APP_ID: '0',
  VITE_KAKAO_APP_KEY: 'pr-verify',
  VITE_TOSS_CLIENT_KEY: 'pr-verify',
}

/** 순수 — 화면 무게가 바뀔 수 있는 변경인가. 서버(워커)·시험·문서만 바꾼 푸시는 빌드하지 않는다. */
export function needsSurfaceCheck(files) {
  return files.some((f) => {
    if (/^(index\.html|vite\.config\.ts|tailwind\.config\.js|postcss\.config\.(c?js|mjs)|package(-lock)?\.json)$/.test(f)) return true
    if (!f.startsWith('src/')) return false
    if (f.startsWith('src/tests/') || f.startsWith('src/worker/') || f.startsWith('src/worker-ads/')) return false
    if (/^src\/features\/[^/]+\/api\//.test(f)) return false
    return true
  })
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

function main() {
  if (process.env.SKIP_SURFACE_PREPUSH === '1') return
  let files = []
  try {
    const base = git(['merge-base', 'HEAD', 'origin/main'])
    files = git(['diff', '--name-only', `${base}..HEAD`]).split('\n').filter(Boolean)
  } catch { return }
  if (!needsSurfaceCheck(files)) return
  const env = { ...process.env, ...CI_BUILD_ENV }
  const t0 = Date.now()
  try {
    execFileSync('npm', ['run', 'build:client'], { env, stdio: 'pipe', timeout: 300_000 })
    execFileSync('node', ['scripts/generate-route-chunk-map.mjs'], { env, stdio: 'pipe', timeout: 60_000 })
  } catch {
    console.log('⚠️ 화면 무게 사전 측정: 이 환경에서 빌드가 안 돼 건너뛴다 — CI 가 다시 잰다.')
    return
  }
  try {
    execFileSync('node', ['scripts/check-surface-budgets.mjs'], { env, stdio: 'pipe', encoding: 'utf8', timeout: 60_000 })
    console.log(`✅ 화면 무게 사전 측정: 예산 안 (${Math.round((Date.now() - t0) / 1000)}초)`)
  } catch (err) {
    process.stdout.write(`${err.stdout ?? ''}`)
    console.error('\n❌ 화면 무게 예산을 넘었다 — CI 가 이 커밋을 똑같이 막는다(약 11분 뒤). 지금 줄이거나, 정말 필요하면 위 안내대로 기준값을 갱신해 같은 푸시에 넣을 것.')
    console.error('   (우회: SKIP_SURFACE_PREPUSH=1 git push …)')
    process.exit(1)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main()
