/**
 * 🧪 **pre-commit 이 실패 원인을 가려 말하는가** — `scripts/install-git-hooks.sh` (2026-11-01).
 *
 * ## 무엇이 잘못돼 있었나
 * 훅의 타입 검사는 한 줄이었다:
 *     npx tsc --noEmit --skipLibCheck || { echo "❌ Commit blocked. Fix TypeScript errors."; exit 1; }
 * `||` 는 **"실패했다" 만 알고 "왜" 는 묻지 않는다.** 그래서 이 레포에서 실제로 가장 자주 나는
 * 실패(**메모리 부족**)가 *"타입 에러를 고쳐라"* 로 보고됐고, 세션이 **없는 에러를 찾아 헤맸다**.
 *
 * 2026-11-01 실측: 훅이 그 문구를 냈는데 출력 꼬리는 `Aborted` + node 힙 주소였고, 힙을 올려
 * 다시 돌리니 `error TS` **0건**이었다. CLAUDE.md 가 이미 두 번 기록한 클래스다(App.tsx 항목 ·
 * SNS 카드 인계 §5). 같은 날 고친 `check-branch-scope`·배포 스모크와 **같은 "틀린 원인 보고"** 다.
 *
 * ## 왜 힙을 숫자로 박지 않나 (실측 근거)
 *   node 기본 힙 상한 **2,096 MB → OOM**  ·  4,096 MB → 통과  ·  8,192 MB → 통과
 *   (도는 중 실제 tsc 프로세스 RSS 1,553 MB — 메모리가 없는 게 아니라 node 기본값이 2GB 다)
 * 머신마다 메모리가 다르므로 큰 숫자를 박으면 작은 기계에서 OOM-killer 를 부른다 ⇒ **계산한다**.
 *
 * ## 이 테스트가 지키는 것 — 출력이 아니라 **동작**
 * 블록을 떼어 **가짜 `npx` 로 네 가지 실패를 실제로 흉내 내 돌린다**. 문자열 검사로는
 * "원인을 가르는가" 를 알 수 없다(종전 코드도 문자열은 멀쩡했다).
 *   ① 통과 → exit 0          ② 진짜 타입 에러(파일:줄) → "타입 에러 N건"
 *   ③ 설정 오류(파일:줄 없음) → "설정·CLI 오류"    ④ OOM → "타입 에러가 아니다" + "메모리 부족"
 *   ⑤ exit 127 → "명령을 찾을 수 없다"            ⑥ 이미 정한 힙을 덮지 않는다
 *   ⑦ 힙을 숫자로 박지 않는다(계산한다)
 *
 * 🔑 ④ 는 **`set -e` 안전성까지 함께** 판정한다. 종전처럼 `npx tsc > log` 를 테스트 없이 쓰면
 *    `set -e` 가 훅을 **즉시 중단**시켜 이 메시지가 아예 안 나온다 — 메시지가 나온다는 것이
 *    실패를 테스트된 형태로 감쌌다는 증거다.
 *
 * ## 못 막는 것
 * - 진짜 OOM 이 실제로 안 나는지(그건 머신·레포 규모에 달렸다 — 그래서 ④의 안내 문구가 짝이다).
 * - 설치된 사본(`.git/hooks/pre-commit`)이 최신인지. 원격 세션은 세션마다
 *   `bash scripts/install-git-hooks.sh` 를 다시 돌려야 한다(레포가 못 보는 영역).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'

const INSTALLER = resolve(process.cwd(), 'scripts/install-git-hooks.sh')
const RAW = readFileSync(INSTALLER, 'utf8')
/** 🩸 판정은 **주석을 뺀 실행되는 줄**로 한다 — 이 수리를 기록한 주석이 옛 한 줄을 인용한다. */
const CODE = RAW.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')

/** 블록만 떼어낸다. 마커가 사라지면 이 테스트를 재조준할 것(가드가 지킬 게 없어진다). */
function extractBlock(): string {
  const a = RAW.indexOf('# --- TSC_CHECK_BEGIN')
  const b = RAW.indexOf('# --- TSC_CHECK_END ---')
  expect(a, 'TSC_CHECK_BEGIN 마커가 없다 — 블록이 옮겨졌으면 이 테스트를 재조준할 것').toBeGreaterThan(-1)
  expect(b, 'TSC_CHECK_END 마커가 없다').toBeGreaterThan(a)
  return '#!/bin/bash\nset -e\n' + RAW.slice(a, b)
}

let dir = ''
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'tscblk-'))
  mkdirSync(join(dir, 'bin'), { recursive: true })
  writeFileSync(join(dir, 'block.sh'), extractBlock())
})
afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

/** 가짜 `npx` 를 PATH 앞에 두고 블록을 실제로 돌린다. */
function run(fakeNpxBody: string, env: Record<string, string> = {}): { code: number; out: string } {
  writeFileSync(join(dir, 'bin/npx'), `#!/bin/bash\n${fakeNpxBody}\n`)
  chmodSync(join(dir, 'bin/npx'), 0o755)
  // ⚠️ 이 레포는 `ProcessEnv` 에 필수 키(KAKAO_* 등)를 더해 두었다 — `Record<string,string>` 으로
  //    캐스팅하면 TS2769 가 난다(이 수리의 훅이 그걸 파일:줄까지 잡아 줬다).
  const base = { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, ...env } as NodeJS.ProcessEnv
  if (!('NODE_OPTIONS' in env)) delete base.NODE_OPTIONS
  try {
    const out = execFileSync('bash', ['./block.sh'], { cwd: dir, encoding: 'utf8', env: base, stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

describe('pre-commit 타입 검사: 실패 원인을 가린다', () => {
  it('🔒 ① tsc 가 통과하면 통과한다', () => {
    const r = run('exit 0')
    expect(r.code, r.out).toBe(0)
    expect(r.out).not.toMatch(/Commit blocked/)
  })

  it('🔒 ② 진짜 타입 에러(파일:줄)는 타입 에러라고 말한다', () => {
    const r = run('echo "src/foo.ts(12,5): error TS2322: Type mismatch"; exit 2')
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/타입 에러 1건/)
    expect(r.out, '타입 에러인데 "아니다" 라고 말한다').not.toMatch(/타입 에러가 아니다/)
  })

  it('🔒 ③ 설정·CLI 오류(파일:줄 없는 error TS)를 코드 에러로 말하지 않는다', () => {
    // CLAUDE.md 실사고: `baseUrl` TS5101 로 tsc 가 **파일을 하나도 안 보고** 멈췄는데
    // 출력이 짧아 "에러 없음" 과 구분되지 않았고, 여러 세션이 "로컬 tsc 는 죽어 있다" 로 지나갔다.
    const r = run('echo "error TS5101: Option \\"baseUrl\\" is deprecated"; exit 1')
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/설정·CLI 오류/)
    expect(r.out).toMatch(/파일을 하나도 안 보고/)
  })

  it('🔒 ④ OOM 은 "타입 에러가 아니다" + "메모리 부족" 으로 말한다 — 이 수리의 핵심', () => {
    const r = run('echo " 5: 0x1477f13  [node]"; echo "Aborted"; exit 134')
    expect(r.code).toBe(1)
    expect(r.out, '종전처럼 "타입 에러" 라고 말한다').toMatch(/타입 에러가 아니다/)
    expect(r.out).toMatch(/메모리 부족/)
    expect(r.out).toMatch(/max-old-space-size=12288/)          // 할 수 있는 다음 행동을 준다
    expect(r.out).toMatch(/없는 타입 에러를 찾지 말 것/)
    // 🔑 set -e 안전성: 실패를 테스트된 형태로 감싸지 않았으면 이 메시지가 아예 안 나온다.
    expect(r.out, 'set -e 가 중단시켜 메시지가 안 나왔다').toContain('Commit blocked')
  })

  it('🔒 ⑤ exit 127(명령 없음)을 타입 에러로 말하지 않는다', () => {
    // 2026-11-01 실측: `/usr/bin/time` 부재로 127 이 났고, 종전 훅이라면 "타입 에러" 였다.
    const r = run('exit 127')
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/타입 에러가 아니다/)
    expect(r.out).toMatch(/명령을 찾을 수 없다/)
  })

  it('🔒 ⑥ 사람이 이미 정한 힙을 덮지 않는다', () => {
    const r = run('echo "NODE_OPTIONS=[$NODE_OPTIONS]"; exit 0', { NODE_OPTIONS: '--max-old-space-size=3000' })
    expect(r.code, r.out).toBe(0)
    const m = r.out.match(/NODE_OPTIONS=\[(.*)\]/)
    expect(m, r.out).toBeTruthy()
    expect(m![1], '사람이 정한 값을 바꿨다').toContain('--max-old-space-size=3000')
    expect((m![1].match(/max-old-space-size/g) || []).length, '힙 옵션을 두 번 넣었다').toBe(1)
  })

  it('🔒 ⑦ 힙을 숫자로 박지 않고 머신에서 계산한다 — 작은 기계에서 OOM-killer 를 부르지 않게', () => {
    const block = extractBlock()
    expect(block, 'export 가 계산값을 쓰지 않는다').toMatch(/export NODE_OPTIONS=.*\$TSC_HEAP_MB/)
    expect(block, '머신 메모리를 읽지 않는다').toMatch(/os\.totalmem\(\)/)
    // 계산이 실제로 돈다: 기본 힙(≈2GB) 이상이고 상한 8192 이하인 값이 실려야 한다.
    const r = run('echo "NODE_OPTIONS=[$NODE_OPTIONS]"; exit 0')
    const got = Number((r.out.match(/max-old-space-size=(\d+)/) || [])[1] ?? 0)
    expect(got, `계산된 힙이 이상하다: ${r.out}`).toBeGreaterThanOrEqual(2048)
    expect(got).toBeLessThanOrEqual(8192)
  })

  it('🔒 ⑧ 옛 한 줄이 되살아나지 않는다 — 어떤 실패든 "타입 에러" 라 말하던 모양', () => {
    expect(CODE, '옛 무조건 문구가 돌아왔다').not.toMatch(/Fix TypeScript errors/)
    // tsc 를 파이프로 받지 않는다(파이프 뒤 exit code 는 tsc 의 것이 아니다 — CLAUDE.md 실사고).
    expect(CODE).not.toMatch(/npx tsc[^\n|]*\|\s*(head|tail|grep|tee)/)
  })
})
