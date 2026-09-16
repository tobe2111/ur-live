/**
 * 🛡️ 2026-09-14 — 로컬↔CI 차단 동등성 SSOT
 *
 * 배경(실측): 가드 121개 중 **91개가 "CI 는 차단 · 로컬은 안 막음"** 이었다.
 *   - pre-commit 에 아예 없음 63개
 *   - 있지만 `|| true`(경고만) 28개
 * 그래서 가드가 제대로 잡아도 개발자는 **CI 한 바퀴(실측 57분) 뒤에야** 안다.
 * 2026-09-14 하루에 그 57분 루프를 두 번 돌았다(주석 제거기 · 파일크기 래칫).
 * 둘 다 로컬에서 1초면 알 수 있었다 — 실제로 그 91개 **전부 합쳐 14.5초**다.
 *
 * ⇒ 처방: 푸시 직전에 그 집합을 전부 돌린다(`pre-push-gate.mjs`).
 *   커밋은 계속 가볍게 두고, 57분 루프만 끊는다.
 *
 * 🔑 **목록을 손으로 관리하지 않는다.** `verify.yml` 에서 매번 뽑는다 —
 *   손목록은 반드시 낡고(이 레포가 여러 번 당한 "낡은 지도"), 새 가드가 조용히 샌다.
 *
 * ⚠️ 이 파일이 **못 하는 것**: verify.yml 밖에서 도는 가드(`guard-mutations-full.yml`,
 *   `dark-contrast.yml`, `live-contracts.yml`)는 보지 않는다. 그건 의도다 — 전부
 *   PR 게이트가 아니거나 브라우저·네트워크가 필요해 로컬 푸시 게이트에 맞지 않는다.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'

const WORKFLOW_DIR = '.github/workflows'

/** CI 가 strict 로 돌리지만 **로컬 푸시 게이트에서는 뺀다** — 이유를 반드시 적는다. */
export const EXCLUDE = {
  'check-guard-mutations.mjs':
    '전수 주입은 실측 45분. PR 은 --changed, 전수는 guard-mutations-full.yml(main push + 야간).',
  'check-built-css.mjs':
    'dist/ 빌드 산출물이 있어야 판정한다. 로컬에서 빌드 없이 돌리면 항상 빨간불.',
  'check-surface-role-leak.mjs':
    'route-chunk-map 이 이번 빌드의 것이어야 한다. 빌드 없이는 스스로 판정을 거부한다.',
  'check-ghost-classes.mjs':
    'dist/client/assets 의 **이번 빌드** CSS 와 대조한다. 낡은 dist 로 돌면 방금 정의한 클래스가 유령으로 잡힌다.',
}

/**
 * verify.yml 에서 **아무데서나 언급된** 가드 이름을 줍는 "멍청한 그물"(줄 단위 정규식).
 *
 * 이건 판정용이 아니다 — 파싱 워커가 **못 본 자리**를 드러내는 대조군이다.
 * (matrix·재사용 워크플로처럼 구조가 바뀌면 워커가 눈이 멀 수 있다.)
 */
export function guardsMentioned(ymlPath = `${WORKFLOW_DIR}/verify.yml`) {
  const found = new Set()
  for (const line of readFileSync(ymlPath, 'utf8').split('\n')) {
    if (line.trim().startsWith('#')) continue
    for (const m of line.matchAll(/scripts\/(check-[a-z0-9-]+\.(?:mjs|sh))/g)) found.add(m[1])
  }
  return [...found].sort()
}

/** 로컬 푸시 게이트가 실제로 돌릴 목록. */
export function localGateGuards(ymlPath) {
  return ciStrictGuards(ymlPath).filter((g) => !(g in EXCLUDE))
}

/**
 * 🩸 2026-09-14 (같은 날 세 번째) — **이름만 뽑으면 절반이 헛돈다.**
 *
 * 게이트가 `node scripts/<이름>` 을 맨손으로 돌리고 있었다. 그런데 CI 는
 * `node scripts/check-file-size.mjs --changed-only -s` 처럼 **플래그**로, 또는
 * `STRICT_FILE_SIZE: 1` 처럼 **env** 로 strict 를 켠다. 둘 다 버려지니 그 가드들은
 * 로컬에서 **경고 모드로 통과**한다 — 게이트가 "94개 통과"를 찍고 CI 가 막았다.
 *
 * 실측: strict 스텝 97개 중 **플래그 44 · env 8**. 즉 이 게이트가 없애려던 바로 그
 * "CI 는 차단 · 로컬은 안 막음" 이 게이트 자신 안에 절반쯤 남아 있었다.
 *
 * ⇒ 이름이 아니라 **CI 의 명령 그대로** 돌린다. `${'$'}{{ }}` 표현식은 실측 0건이라
 *   로컬에서 그대로 실행해도 안전하다(있으면 아래가 걸러 낸다).
 */
export function localGateSteps(ymlPath = `${WORKFLOW_DIR}/verify.yml`) {
  const { steps } = collectGuards(ymlPath)
  return steps
    .filter((s) => !s.guards.some((g) => g in EXCLUDE))
    // GitHub 표현식이 든 명령은 로컬에서 뜻이 달라진다 — 돌리지 않는다(현재 0건).
    .filter((s) => !s.run.includes('${{'))
}

/** verify.yml 이 **경고로만** 돌리는 가드(`continue-on-error: true`). 게이트 대상 아님. */
export function ciWarnGuards(ymlPath = `${WORKFLOW_DIR}/verify.yml`) {
  return [...collectGuards(ymlPath).warn].sort()
}

// ─────────────────────────────────────────────────────────────────────────────
// 🛡️ 2026-09-14 (같은 날 후속) — **깨진 워크플로는 빨간불이 아니라 "아예 안 돎"이다**
//
// 이 파일을 만든 커밋 자신이 `verify.yml` 의 들여쓰기를 깨뜨렸다(스텝 하나가 2칸,
// `continue-on-error` 중복). 결과는 CI 실패가 아니라 **잡 0개로 즉시 종료**였고,
// PR 화면엔 Verify 가 **뜨지도 않은 채** `Cloudflare Pages ✅` 하나만 초록으로 남았다.
// 훑어보면 통과한 것처럼 보인다 — 이 레포가 반복해 당한 "조용한 부재" 클래스.
//
// 그리고 위 `ciStrictGuards()` 는 **줄 단위 정규식**이라 깨진 YAML 에서도 그럴듯한
// 목록을 뱉는다. 게이트는 94개를 통과시키고 푸시를 내보냈다. 그래서 아래 둘을 더한다:
//   ① 워크플로가 YAML 로 실제 파싱되는가
//   ② 정규식이 뽑은 집합과 **파싱해서 뽑은 집합이 같은가**(정규식 드리프트 차단)

/** 워크플로 YAML 파서. 없으면 **조용히 건너뛰지 않고** 크게 실패한다. */
function loadYamlParser() {
  const req = createRequire(import.meta.url)
  try {
    return req('js-yaml')
  } catch {
    throw new Error(
      'js-yaml 을 못 찾았다(지금은 eslint 의 전이 의존). 워크플로 YAML 검증을 조용히 건너뛰면 ' +
        '깨진 워크플로가 다시 샌다 — package.json devDependencies 에 js-yaml 을 직접 추가할 것.',
    )
  }
}

export function workflowFiles(dir = WORKFLOW_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .sort()
    .map((f) => `${dir}/${f}`)
}

/** 워크플로 파일이 실제로 GitHub 가 읽을 모양인가. 빈 배열이면 정상. */
export function workflowYamlErrors(dir = WORKFLOW_DIR) {
  const yaml = loadYamlParser()
  const errors = []
  for (const file of workflowFiles(dir)) {
    let doc
    try {
      doc = yaml.load(readFileSync(file, 'utf8'))
    } catch (err) {
      errors.push({ file, message: String(err?.message ?? err).split('\n')[0] })
      continue
    }
    if (!doc || typeof doc !== 'object' || !doc.jobs || typeof doc.jobs !== 'object') {
      errors.push({ file, message: 'jobs 가 없다 — 워크플로 모양이 아니다.' })
      continue
    }
    for (const [jobName, job] of Object.entries(doc.jobs)) {
      const steps = job?.steps
      if (steps !== undefined && !Array.isArray(steps)) {
        errors.push({ file, message: `${jobName}.steps 가 배열이 아니다(들여쓰기가 깨졌을 때 나는 모양).` })
      }
    }
  }
  return errors
}

/**
 * 워크플로를 **파싱해서** 가드를 strict / warn 으로 가른다.
 *
 * 🩸 왜 파싱인가: 처음엔 줄 단위 정규식으로 `continue-on-error: true` 를 "3줄 안"에서
 *   찾았는데, YAML 은 키 순서가 자유라 그 창 밖에 있으면 못 본다. 실제로
 *   `check-bundle-size.mjs` 는 CI 에서 경고인데 게이트가 **차단**으로 오해하고 있었다.
 *   반대 방향(차단인데 경고로 오해)이면 가드가 조용히 샌다 — 같은 결함의 위험한 쪽이다.
 */
function collectGuards(ymlPath) {
  const yaml = loadYamlParser()
  const doc = yaml.load(readFileSync(ymlPath, 'utf8'))
  const strict = new Set()
  const warn = new Set()
  const steps = []
  for (const job of Object.values(doc?.jobs ?? {})) {
    for (const step of job?.steps ?? []) {
      const run = typeof step?.run === 'string' ? step.run : ''
      const isWarn = step?.['continue-on-error'] === true
      const bucket = isWarn ? warn : strict
      const guards = [...run.matchAll(/scripts\/(check-[a-z0-9-]+\.(?:mjs|sh))/g)].map((m) => m[1])
      for (const g of guards) bucket.add(g)
      // strict 스텝은 **명령·env 그대로** 보관한다 — 게이트가 CI 와 같은 모드로 돌리려면
      // 이름만으로는 부족하다(플래그 44 · env 8 이 그 증거다).
      if (!isWarn && guards.length > 0) {
        steps.push({ name: String(step?.name ?? guards[0]), run, env: step?.env ?? {}, guards })
      }
    }
  }
  // 한 가드가 두 스텝에 걸쳐 있으면(경고 1 + 차단 1) 차단이 이긴다 — 안전한 쪽.
  for (const g of strict) warn.delete(g)
  return { strict, warn, steps }
}

/** verify.yml 에서 "실패하면 CI 가 막는" 가드 스크립트 이름. **이게 판정 기준이다.** */
export function ciStrictGuards(ymlPath = `${WORKFLOW_DIR}/verify.yml`) {
  return [...collectGuards(ymlPath).strict].sort()
}
