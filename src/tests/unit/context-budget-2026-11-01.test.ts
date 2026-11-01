/**
 * 🧠 세션 컨텍스트 예산 가드의 가드 — 2026-11-01
 *
 * 대표 신고 *"계속 클로드 코드 세션들에서 금방 prompt is too long 이라고 되는데"* ·
 * *"클로드 코드 크레딧을 너무 빨리 소비해"* → 실측으로 하루에 **세 자리**가 같은 병이었다:
 * `CLAUDE.md` 30만 토큰(세션 용량 20만의 **151%**) · `docs/CURRENT_WORK.md` 24.4만 ·
 * `docs/handoff/INDEX.local.md` 2.4만. 첫 번째는 **대화 한 마디 전에 이미 한도를 넘겼다.**
 *
 * 🔴 진짜 원인은 "규칙이 없었다" 가 아니다 — **강제가 없었다.** `CLAUDE.md` 는 이미
 * `## 📚 문서 분할` 절에서 *"사고 후일담은 docs/ 로 분리"* 라고 적어 뒀고, 가드 144개 중
 * 세션 컨텍스트 비용을 보는 것은 **0개**였다(`check-file-size` 는 `src/**.ts(x)` 만 본다).
 *
 * 이 시험이 지키는 것:
 *   ① 가드가 **실제로 동작한다**(합성 트리에서 돌려 출력으로 판정 — 문자열 검사가 아니다)
 *   ② 예산을 넘기면 **잡는다**, 넘기지 않으면 통과한다(양방향)
 *   ③ 경고 없는 거대 문서를 잡고, **경고가 있으면 통과**시킨다(큰 파일 금지가 아니다)
 *   ④ 측정 대상이 비면 **통과가 아니라 실패**다(이 레포가 반복해 당한 "헛도는 가드")
 *   ⑤ 실행 경로에 등록돼 있다(audit-gate + verify.yml strict)
 *   ⑥ 실제 레포가 지금 예산 안에 있다
 *
 * ⚠️ 이 시험이 **못 보는 것**: 토큰 추정은 근사다(한글 1.0 + 그 외 0.3, 과대추정=보수적) —
 * 실제 Claude 토크나이저와 다르므로 **절대값이 아니라 비율·추세**로 읽어야 한다.
 * 그리고 "세션이 그 파일을 실제로 읽는가" 는 레포가 알 수 없다(CLAUDE.md 의 지시로 추정한다).
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const GUARD = 'scripts/check-context-budget.mjs'
const read = (p: string) => readFileSync(p, 'utf8')

/** 합성 트리에서 가드를 돌린다. 레포에 부작용 0 (가드는 읽기만 하지만 격리가 정석이다 —
 *  2026-10-06 에 테스트가 생성기를 레포에서 돌려 5,048줄을 날린 선례가 있다). */
function runIn(files: Record<string, string>): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'ctx-budget-'))
  try {
    for (const [p, body] of Object.entries(files)) {
      const full = join(dir, p)
      mkdirSync(join(full, '..'), { recursive: true })
      writeFileSync(full, body)
    }
    try {
      const out = execFileSync('node', [resolve(GUARD), '-s'], { cwd: dir, encoding: 'utf8' })
      return { code: 0, out }
    } catch (e: any) {
      return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** 한글 n자 — 토큰 추정이 한글을 1.0/자로 세므로 n 토큰에 가깝다. */
const ko = (n: number) => '가'.repeat(n)

/**
 * 예산 안의 최소 구성.
 * ④(측정 ≥5건)와, **CLAUDE.md 에서 뽑은 문서 ≥20건** 하한을 함께 채운다 —
 * 후자는 추출 정규식이 깨졌을 때 가드가 조용히 비는 것을 막는 장치다(그래서 합성
 * 트리도 실제처럼 여러 문서를 언급하는 CLAUDE.md 를 가져야 한다).
 */
function okTree(extra: Record<string, string> = {}) {
  const docs: Record<string, string> = {}
  const refs: string[] = []
  for (let i = 0; i < 22; i++) {
    const f = `docs/d${String(i).padStart(2, '0')}.md`
    docs[f] = ko(100)
    refs.push(`- 참조: \`${f}\``)
  }
  return {
    // 🔑 CLAUDE.md 가 문서를 언급해야 ①-2 가 일한다. `먼저 읽` 이 붙은 줄은 A 등급이다.
    'CLAUDE.md': [
      ko(1000),
      '',
      '작업 전 `docs/design/urdeal-platform-model.md` 를 먼저 읽는다.',
      '',
      ...refs,
    ].join('\n'),
    'docs/design/urdeal-platform-model.md': ko(100),
    'docs/CURRENT_WORK.md': ko(100),
    'docs/handoff/INDEX.local.md': ko(100),
    '.claude/agents/dev.md': ko(100),
    '.claude/agents/ops.md': ko(100),
    'docs/handoff/2026-11-01-a.md': ko(100),
    'docs/handoff/2026-10-31-b.md': ko(100),
    ...docs,
    ...extra,
  }
}

describe('① 가드가 실제로 동작한다 (합성 트리 실행)', () => {
  it('예산 안이면 통과한다', () => {
    const r = runIn(okTree())
    expect(r.out, `통과해야 하는데 실패했다:\n${r.out}`).toContain('예산 통과')
    expect(r.code).toBe(0)
  })

  it('🔴 CLAUDE.md 가 상한을 넘기면 잡는다 (이 사고의 본체)', () => {
    const r = runIn(okTree({ 'CLAUDE.md': ko(90_000) })) // 상한 80,000
    expect(r.code, '상한을 넘겼는데 통과했다 — 가드가 헛돈다').not.toBe(0)
    expect(r.out).toContain('CLAUDE.md')
    expect(r.out, '왜 그 상한인지 안 알려준다 — 다음 세션이 그냥 올린다').toContain('왜 이 상한인가')
  })

  it('🔴 CURRENT_WORK.md / INDEX.local.md 도 각각 잡는다', () => {
    expect(runIn(okTree({ 'docs/CURRENT_WORK.md': ko(9_000) })).code).not.toBe(0)
    expect(runIn(okTree({ 'docs/handoff/INDEX.local.md': ko(9_000) })).code).not.toBe(0)
  })

  it('🔴 최근 인계 5건 합계도 잡는다 (새 세션 첫 액션 비용)', () => {
    const big: Record<string, string> = {}
    for (let i = 1; i <= 5; i++) big[`docs/handoff/2026-11-0${i}-big.md`] = ko(6_000) // 합 30,000 > 25,000
    const r = runIn(okTree(big))
    expect(r.code, '인계 5건 합계 상한이 안 먹는다').not.toBe(0)
    expect(r.out).toContain('최근 인계 5건')
  })
})

describe('①-2 CLAUDE.md 가 언급하는 문서는 전부 예산 대상이다 (목록은 자동 추출)', () => {
  // 🩸 첫 판은 이 칸이 비어 있었고, 두 번째 판은 **손으로 쓴 6줄 목록**이었다.
  //   둘 다 같은 병이다 — `urdeal-platform-model.md` 가 30,584 토큰인데 예산 밖이었고
  //   (1판), 손 목록은 **내일 추가되는 문서를 못 본다**(2판). 그래서 CLAUDE.md 를 파싱한다.
  it('🔴 A등급(먼저 읽어라)이 상한을 넘기면 잡는다', () => {
    const r = runIn(okTree({ 'docs/design/urdeal-platform-model.md': ko(45_000) })) // 상한 40,000
    expect(r.code, '지시받는 문서가 상한을 넘겼는데 통과했다').not.toBe(0)
    expect(r.out).toContain('먼저 읽어라')
  })

  it('🔴 A등급은 grep 머리말로 면제되지 않는다 (통째로 읽으라고 지시한 문서다)', () => {
    const r = runIn(
      okTree({
        'docs/design/urdeal-platform-model.md':
          '# 제목\n\n> 통째로 읽지 말 것 — grep 하라.\n\n' + ko(45_000),
      }),
    )
    expect(r.code, 'A등급이 머리말 하나로 면제됐다 — 그러면 상한이 무의미하다').not.toBe(0)
  })

  it('🔴 B등급(그 외 언급)이 크면서 경고 머리말이 없으면 잡는다', () => {
    const r = runIn(okTree({ 'docs/d03.md': ko(45_000) }))
    expect(r.code, '경고 없는 큰 문서가 통과했다').not.toBe(0)
    expect(r.out).toContain('d03')
  })

  it('✅ B등급은 커도 grep 머리말이 있으면 통과한다 (이력은 값지다)', () => {
    const r = runIn(
      okTree({ 'docs/d03.md': '# 제목\n\n> 통째로 읽지 말 것 — grep 으로 찾아라.\n\n' + ko(45_000) }),
    )
    expect(r.code, `머리말이 있는데 막혔다: ${r.out}`).toBe(0)
  })

  it('🔴 추출이 비면 통과가 아니라 실패다 (정규식이 깨진 경우)', () => {
    // CLAUDE.md 가 아무 문서도 언급하지 않는 트리 — 현실엔 없는 상태이므로
    // 그렇게 보이면 가드 자신이 고장난 것이다.
    const t = okTree()
    const bare: Record<string, string> = { ...t, 'CLAUDE.md': ko(1000) }
    const r = runIn(bare)
    expect(r.code, '추출 0건인데 통과했다 — 헛도는 가드').not.toBe(0)
    expect(r.out).toContain('추출 정규식')
  })
})

describe('② 지뢰 규칙 — 큰 파일을 금지하지 않는다, 경고를 강제한다', () => {
  it('🔴 경고 없는 거대 문서를 잡는다', () => {
    const r = runIn(okTree({ 'docs/huge.md': `# 제목\n\n${ko(130_000)}` }))
    expect(r.code, '12만 토큰 문서에 경고가 없는데 통과했다').not.toBe(0)
    expect(r.out).toContain('경고 없는 거대 문서')
  })

  it('✅ 같은 크기라도 "통째로 읽지 말 것 + grep" 경고가 있으면 통과한다', () => {
    // 이게 설계의 핵심이다 — 이력은 값지므로 큰 파일 자체는 허용하고,
    // 세션이 통째로 읽어 자기 창을 날리는 것만 막는다.
    const head = '# 제목\n\n> 🔴 이 파일은 통째로 읽지 말 것 — grep 으로 찾아라.\n\n'
    const r = runIn(okTree({ 'docs/huge.md': head + ko(130_000) }))
    expect(r.out, `경고가 있는데 잡혔다:\n${r.out}`).toContain('예산 통과')
    expect(r.code).toBe(0)
  })
})

describe('③ 헛도는 가드 방지', () => {
  it('🔴 측정 대상이 비면 통과가 아니라 실패다', () => {
    const r = runIn({ 'README.md': '짧다' })
    expect(r.code, '측정할 게 없는데 초록이 떴다 — 경로가 낡으면 그대로 헛돈다').not.toBe(0)
    expect(r.out).toContain('헛돌고')
  })
})

describe('④ 실행 경로에 등록돼 있다 (안 돌면 없는 것과 같다)', () => {
  it('audit-gate.sh 가 strict 로 돌린다', () => {
    const s = read('scripts/audit-gate.sh')
    expect(s, 'audit-gate 에 없다').toContain('check-context-budget.mjs')
    expect(s, 'strict(-s) 가 없으면 실패해도 exit 0 이라 게이트가 못 본다').toMatch(
      /check-context-budget\.mjs\s+-s/,
    )
  })

  it('verify.yml 이 strict 로 돌린다 (continue-on-error: false)', () => {
    const y = read('.github/workflows/verify.yml')
    const i = y.indexOf('check-context-budget.mjs')
    expect(i, 'verify.yml 에 없다 — CI 가 안 본다').toBeGreaterThan(-1)
    // 🩸 첫 판은 `-s` 를 호출 **앞** 300자에서 찾았다 — `-s` 는 같은 `run:` 줄의 **뒤**에 온다.
    //   가드는 멀쩡한데 단언이 틀려 빨간불이 났다(내 오류). 한 창 안에서 둘 다 본다.
    const win = y.slice(i, i + 220)
    expect(win, 'strict 가 아니다').toContain('continue-on-error: false')
    expect(win, '-s 없이 호출하면 warn 이라 실패해도 CI 가 통과한다').toMatch(/-s\b|STRICT_CONTEXT_BUDGET=1/)
  })

  it('CLAUDE.md 가 이 규칙을 안내한다 (문서와 기계가 같은 말을 해야 한다)', () => {
    const s = read('CLAUDE.md')
    expect(s, 'CLAUDE.md 가 이 가드를 모른다 — 다음 세션이 왜 막히는지 알 수 없다')
      .toContain('check-context-budget')
  })
})

describe('⑤ 실제 레포가 지금 예산 안에 있다', () => {
  it('레포에서 돌려도 통과한다', () => {
    let out = ''
    try {
      out = execFileSync('node', [GUARD, '-s'], { encoding: 'utf8' })
    } catch (e: any) {
      throw new Error(`레포가 컨텍스트 예산을 넘겼다:\n${e.stdout ?? ''}${e.stderr ?? ''}`)
    }
    expect(out).toContain('예산 통과')
  })
})
