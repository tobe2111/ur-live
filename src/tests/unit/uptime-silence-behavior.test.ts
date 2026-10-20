/**
 * 🫀 **워크플로 스크립트를 실제로 돌려 본다** — 텍스트 검사가 못 보는 층 (2026-08-25 신설)
 *
 * `uptime-cron-silence.test.ts` 는 *"그 분기가 소스에 있는가"* 까지만 본다. 그런데 이 세션이
 * 하루 종일 고친 사고는 전부 **"있긴 한데 동작이 다르다"** 였다(부분문자열 매칭 2회, 정규식
 * 과잉 엄격 1회). 배선 존재만 보는 검사는 그 층을 못 막는다.
 *
 * 그래서 `.github/workflows/uptime.yml` 의 `github-script` 본문을 **그대로 꺼내 실행**하고,
 * 가짜 octokit 으로 *무엇이 호출되는가* 를 본다. 픽스처는 라이브 침묵 목록의 모양이다.
 *
 * ## 왜 이게 중요한가
 * 이 스크립트가 잘못 동작하면 나타나는 증상이 **"아무 일도 안 일어남"** 이다 — 이슈 #1056 이
 * 21일간 그 상태였고, 그 사이 08-24 정산 16개 누락이 신호 0 이었다. 조용한 고장은 조용해서
 * 안 보인다. 여기서라도 소리를 내게 한다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - **프로브 셸 스크립트**(`cron_stale` 추출)는 여기서 안 돈다 — bash 층이라 러너에서만 확인된다.
 * - GitHub API 의 실제 동작(권한·레이트리밋). 여기서는 호출 *의도* 만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/** `uptime.yml` 에서 cron-silence 스텝의 `script: |` 본문만 꺼낸다. */
function extractScript(): string {
  const yml = readFileSync('.github/workflows/uptime.yml', 'utf8')
  const start = yml.indexOf('- name: Open/close cron-silence issue')
  expect(start, 'cron-silence 스텝을 못 찾았다 — 이 시험이 헛돈다').toBeGreaterThan(-1)
  const after = yml.slice(start)
  const at = after.indexOf('script: |')
  expect(at, 'script 블록을 못 찾았다').toBeGreaterThan(-1)
  const lines: string[] = []
  for (const l of after.slice(at + 'script: |'.length).split('\n')) {
    // 들여쓰기가 끊기면 그 스텝의 끝이다.
    if (l.trim() && !l.startsWith('            ')) break
    lines.push(l.startsWith('            ') ? l.slice(12) : l)
  }
  const body = lines.join('\n')
  expect(body.length, '추출된 스크립트가 비었다 — 통과가 아니라 실패다').toBeGreaterThan(300)
  return body
}

const SCRIPT = extractScript()
const LIVE = '__tick,affiliate-mature,auto-settlement,d1-backup,expired-voucher-refund,ledger-reconcile'

type Call = [string, unknown, unknown, unknown?]

async function run(opts: { down: boolean; stale: string; issues: Array<{ number: number; body: string }> }): Promise<Call[]> {
  process.env.CRON_DOWN = String(opts.down)
  process.env.CRON_STALE = opts.stale
  process.env.CRON_CODE = opts.down ? '503' : '200'
  const calls: Call[] = []
  const github = { rest: { issues: {
    listForRepo: async () => ({ data: opts.issues }),
    create: async (a: Record<string, unknown>) => { calls.push(['create', a.title, a.body]); return {} },
    createComment: async (a: Record<string, unknown>) => { calls.push(['comment', a.issue_number, a.body]); return {} },
    update: async (a: Record<string, unknown>) => { calls.push(['update', a.issue_number, a.state ?? '(body)', a.body ?? '']); return {} },
  } } }
  const context = { repo: { owner: 'o', repo: 'r' } }
  const fn = new Function('github', 'context', `return (async () => { ${SCRIPT} })()`)
  await fn(github, context)
  return calls
}

/** 갱신된 본문(표식 포함)을 다음 회차의 입력으로 쓴다 — 라운드트립이 이 설계의 핵심이다. */
async function markerAfter(stale: string): Promise<string> {
  const calls = await run({ down: true, stale, issues: [{ number: 1056, body: '옛 본문' }] })
  return String(calls.find((c) => c[0] === 'update')?.[3] ?? '')
}

describe('🫀 cron 침묵 경보 — 실제 동작', () => {
  it('① 이슈가 없고 침묵이면 새로 연다', async () => {
    const calls = await run({ down: true, stale: LIVE, issues: [] })
    expect(calls.map((c) => c[0])).toContain('create')
    expect(String(calls[0][2]), '본문에 표식이 없으면 다음 회차 비교 기준이 없다').toContain('<!-- stale:')
  })

  it('🔴 ② 이미 열려 있어도 목록을 처음 보고한다 (21일 침묵의 근본 원인)', async () => {
    const calls = await run({ down: true, stale: LIVE, issues: [{ number: 1056, body: '표식 없는 옛 본문' }] })
    const c = calls.find((x) => x[0] === 'comment')
    expect(c, '열려 있다고 아무 말도 안 하면 #1056 이 그대로 재발한다').toBeTruthy()
    expect(String(c![2])).toContain('➕ 새로 침묵(6)')
    expect(calls.some((x) => x[0] === 'update'), '표식을 안 심으면 매 회차 같은 말을 반복한다').toBe(true)
  })

  it('🔴 ③ 목록이 그대로면 조용하다 (#845 는 코멘트 84개로 죽었다)', async () => {
    const marker = await markerAfter(LIVE)
    const calls = await run({ down: true, stale: LIVE, issues: [{ number: 1056, body: marker }] })
    expect(calls, '변화가 없는데 또 코멘트하면 10분마다 쌓인다').toEqual([])
  })

  it('🔴 ④ 일부가 해소되면 ➖ 로 알린다', async () => {
    const marker = await markerAfter(LIVE)
    const calls = await run({ down: true, stale: 'd1-backup', issues: [{ number: 1056, body: marker }] })
    const c = calls.find((x) => x[0] === 'comment')
    expect(String(c?.[2])).toContain('➖ 해소(5)')
    expect(String(c?.[2])).toContain('현재 침묵 중(1)')
  })

  it('🔴 ⑤ 응답을 못 읽으면(?) 아무것도 하지 않는다 — 거짓 해소가 최악이다', async () => {
    const marker = await markerAfter(LIVE)
    const calls = await run({ down: true, stale: '?', issues: [{ number: 1056, body: marker }] })
    expect(calls, "헬스체크가 죽은 순간 '전부 해소' 를 보내면 이 경보의 신뢰가 끝난다").toEqual([])
  })

  it('🔴 ⑦ 두 번 연속 바뀌면 **최신** 표식과 비교한다 (옛 표식이 남으면 같은 말을 반복한다)', async () => {
    // 🩸 이 케이스가 없어서 주입(표식 갱신 제거)이 빨간불을 안 냈다 — 픽스처가 그 경우를 안 담았다.
    //   갱신을 안 하면 본문에 표식이 **두 개** 남고, 읽기는 첫 번째(옛것)를 집는다.
    const first = await markerAfter(LIVE)                       // 기준: LIVE 6개
    const c2 = await run({ down: true, stale: 'd1-backup,__tick', issues: [{ number: 1056, body: first }] })
    const second = String(c2.find((x) => x[0] === 'update')?.[3] ?? '')
    expect(second, '두 번째 갱신 본문이 비었다').not.toBe('')
    // 이제 하나 더 해소 → **직전(2개)** 기준으로 '해소 1' 이어야 한다. 옛 표식(6개)을 읽으면 '해소 5' 가 된다.
    const c3 = await run({ down: true, stale: 'd1-backup', issues: [{ number: 1056, body: second }] })
    const msg = String(c3.find((x) => x[0] === 'comment')?.[2] ?? '')
    expect(msg, `최신 표식과 비교하지 않았다 — 본문에 옛 표식이 남아 있다: ${msg.slice(0, 120)}`).toContain('➖ 해소(1)')
    expect(second.match(/<!-- stale:/g)?.length, '표식이 두 개 남았다 — 갱신 시 옛것을 지워야 한다').toBe(1)
  })

  it('🔴 ⑥ 전부 회복되면 닫는다', async () => {
    const marker = await markerAfter(LIVE)
    const calls = await run({ down: false, stale: '', issues: [{ number: 1056, body: marker }] })
    expect(calls.map((c) => c[0])).toContain('update')
    expect(calls.find((c) => c[0] === 'update')?.[2]).toBe('closed')
  })
})
