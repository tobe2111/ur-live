import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { stripComments } from '../helpers/source-text'

/**
 * 🔀 **인계 목차를 추적하지 않는다** — 머지 충돌의 근본 해소 (2026-10-06 대표 *"남은 것도 다 해줘"*)
 *
 * ## 무엇이 문제였나 (추측 아님 — 같은 날 실측)
 *
 * `docs/CURRENT_WORK.md` 안에는 `scripts/generate-handoff-index.mjs` 가 만드는 **생성 블록**이
 * 있었고 pre-commit 이 그걸 **stage** 했다. 그래서 `docs/handoff/*.md` 를 추가한 **모든 브랜치가
 * 같은 블록을 고쳤다** — 내용상 완전히 무관한데도 머지마다 충돌했다(2026-07-29 하루 10번+,
 * 2026-10-06 하루 3번).
 *
 * 🔴 그리고 그 충돌의 대가가 "머지 못 함" 보다 나빴다: `.gitattributes` 의 `merge=union` 은
 * **로컬 머지에만** 먹고 **GitHub 서버측 머지는 그 드라이버를 안 쓴다** → PR 이 conflicted →
 * **GitHub 이 머지 커밋을 못 만들어 `pull_request` 워크플로가 디스패치되지 않는다** →
 * `Verify` 가 실패가 아니라 **부재**로 남아(실측: check-run 0개) auto-merge 가 조용히 멎었다.
 *
 * ## 처방 — 다툴 줄을 없애는 게 아니라 **추적을 끊는다**
 *
 * 2026-07-29 는 "사람이 공유 파일을 편집하지 않게" 만들었지만 **생성물은 여전히 추적**했다.
 * 그게 남은 절반이었다. 이제 목차는 `.gitignore` 된 사이드카 `docs/handoff/INDEX.local.md` 로 가고,
 * `docs/CURRENT_WORK.md` 는 **안 바뀌는 문서**(옛 기록 + 안내)로 남는다.
 *
 * ## 🩸 이 처방은 네 조각이 **동시에** 맞아야 한다 — 하나만 되돌아가도 조용히 망가진다
 *
 *   ① 생성기 출력 경로가 사이드카    ② 그 경로가 `.gitignore`
 *   ③ pre-commit 이 `CURRENT_WORK.md` 를 stage 하지 않는다
 *   ④ 동기화 가드가 `CURRENT_WORK.md` 손댐을 "인계 갱신" 으로 세지 않는다
 *
 * ②가 빠지면 **충돌이 그대로 돌아온다**(가장 조용하다 — 다음 머지 때까지 아무 신호가 없다).
 * ④가 빠지면 목차가 거기 없는데도 "인계를 갱신했다" 로 통과해 가드가 헛돈다.
 *
 * ## 이 시험이 **못 보는 것**
 *
 *   · 사이드카의 *내용*이 맞는지는 안 본다(제목 파싱·정렬은 생성기의 일이다).
 *   · GitHub 서버측 머지가 실제로 깨끗한지는 레포가 못 본다 — 그건 pre-push 의
 *     `check-github-side-merge.mjs` 가 머지를 다시 돌려 판정한다.
 */

const GEN = 'scripts/generate-handoff-index.mjs'
const HOOKS = 'scripts/install-git-hooks.sh'
const SYNC = 'scripts/check-current-work-sync.mjs'
const SIDECAR = 'docs/handoff/INDEX.local.md'

const read = (p: string) => readFileSync(p, 'utf8')
const code = (p: string) => stripComments(read(p))

describe('① 생성기는 사이드카에 쓴다 (CURRENT_WORK.md 안이 아니다)', () => {
  it('출력 경로가 docs/handoff/INDEX.local.md', () => {
    const s = code(GEN)
    expect(s, '출력 경로가 사이드카가 아니다 — 추적되는 파일로 되돌아갔다')
      .toMatch(/const INDEX_FILE = 'docs\/handoff\/INDEX\.local\.md'/)
    expect(s, 'CURRENT_WORK.md 로 다시 쓰고 있다').not.toMatch(/INDEX_FILE\s*=\s*'docs\/CURRENT_WORK\.md'/)
  })

  it('🔗 링크가 사이드카 기준 상대경로다 — 목차가 handoff/ 안에 있으므로 형제 파일명만 쓴다', () => {
    // 쌍이다: 경로를 handoff/ 안으로 옮겼으면 링크의 `handoff/` 접두사는 반드시 빠져야 한다.
    // 한쪽만 되돌리면 **링크가 전부 404 인데 생성은 성공**한다(에러 0 — 그게 이 단언의 이유).
    const s = code(GEN)
    expect(s, '링크에 handoff/ 접두사가 남아 있다 — 사이드카 기준으로는 깨진 경로다')
      .not.toMatch(/\]\(handoff\//)
    expect(s, '아카이브 링크도 형제 기준이어야 한다').toMatch(/\]\(archive\/\)/)
  })

  /**
   * 🩸 **생성기를 레포 안에서 돌리지 않는다 — 돌렸다가 5,048줄을 날렸다** (2026-10-06 실측)
   *
   * 첫 판은 `execFileSync('node', [GEN])` 를 그냥 호출했다. 그런데 **이 시험 자신의 주입**
   * (`INDEX_FILE` 을 `docs/CURRENT_WORK.md` 로 되돌리는 것)이 걸린 상태에서 그 호출이 돌자,
   * 생성기가 **그 파일을 통째로 덮어써** 5,957줄짜리 옛 기록이 470줄로 줄었다.
   * 주입 러너는 **자기가 고친 소스**만 되돌린다 — 테스트가 쓴 파일은 되돌리지 않는다.
   *
   * ⇒ 생성기는 **합성 트리**에서 돌린다. 부작용이 0 이고, 검사하려던 것(수집·링크 모양)은
   *   그대로 잰다. **부작용 있는 스크립트를 테스트가 레포에 직접 돌리면 안 된다.**
   */
  it('합성 트리에서 돌려 보면 사이드카가 만들어진다 (생성기가 살아 있다)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'handoff-idx-'))
    try {
      mkdirSync(join(dir, 'docs/handoff'), { recursive: true })
      writeFileSync(join(dir, 'docs/handoff/2026-01-02-alpha.md'), '## 알파 세션\n본문\n')
      writeFileSync(join(dir, 'docs/handoff/2026-01-03-beta.md'), '## 베타 세션\n본문\n')
      execFileSync('node', [resolve(GEN)], { cwd: dir, encoding: 'utf8' })

      const out = readFileSync(join(dir, SIDECAR), 'utf8')
      expect(out, '머리말이 추적 안 함을 밝히지 않는다').toContain('추적 안 함')
      // 형제 링크여야 한다 — 생성물로 한 번 더 확인한다(소스 검사만으론 템플릿이 갈릴 수 있다).
      expect(out, '생성물 링크에 handoff/ 접두사가 섞였다').not.toContain('](handoff/')
      expect(out, '형제 파일명 링크가 아니다').toContain('](2026-01-03-beta.md)')
      expect(out, '제목을 안 읽는다').toContain('베타 세션')
      // 최신 우선 — 날짜 역순.
      expect(out.indexOf('베타'), '최신순 정렬이 깨졌다').toBeLessThan(out.indexOf('알파'))
      // 🔴 추적되는 파일은 **한 글자도** 안 건드려야 한다.
      expect(existsSync(join(dir, 'docs/CURRENT_WORK.md')), 'CURRENT_WORK.md 를 다시 쓰고 있다')
        .toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('② 사이드카는 추적되지 않는다 (이게 빠지면 충돌이 그대로 돌아온다)', () => {
  it('.gitignore 에 등재돼 있다', () => {
    expect(read('.gitignore'), '사이드카가 .gitignore 에서 빠졌다').toContain(SIDECAR)
  })

  it('git 이 실제로 무시한다 — 선언이 아니라 동작으로 확인', () => {
    // `.gitignore` 에 줄이 있어도 앞선 negation(`!docs/**`) 하나에 뒤집힐 수 있다.
    const out = execFileSync('git', ['check-ignore', '-v', '--no-index', SIDECAR], { encoding: 'utf8' })
    expect(out, 'git check-ignore 가 사이드카를 무시 대상으로 보지 않는다').toContain(SIDECAR)
  })

  it('인덱스에 올라와 있지 않다 — 과거에 커밋된 흔적이 되살아나지 않게', () => {
    const tracked = execFileSync('git', ['ls-files', '--', SIDECAR], { encoding: 'utf8' }).trim()
    expect(tracked, `${SIDECAR} 가 추적되고 있다 — .gitignore 는 이미 추적 중인 파일을 막지 못한다`).toBe('')
  })
})

describe('③ pre-commit 은 목차를 stage 하지 않는다', () => {
  it('CURRENT_WORK.md 를 git add 하지 않는다', () => {
    const s = read(HOOKS)
    expect(s, 'pre-commit 이 다시 CURRENT_WORK.md 를 stage 한다 — 충돌 재발')
      .not.toMatch(/git add[^\n]*docs\/CURRENT_WORK\.md/)
  })

  it('그래도 목차는 재생성한다 (사이드카가 낡지 않게)', () => {
    expect(read(HOOKS), '목차 재생성 자체가 사라졌다').toContain('node scripts/generate-handoff-index.mjs')
  })

  it('🧭 기능 현황판은 계속 stage 한다 — "생성물은 stage 안 한다" 로 일반화하면 안 된다', () => {
    // FEATURE_STATUS.md 는 **feature-flags.ts 가 바뀔 때만** 바뀌므로 다툴 브랜치가 거의 없고,
    // 추적해야 하는 이유가 따로 있다(라이브에서 무엇이 꺼져 있는지 레포로 읽는다).
    expect(read(HOOKS), '기능 현황판 stage 가 사라졌다').toMatch(/git add[^\n]*docs\/FEATURE_STATUS\.md/)
  })
})

describe('④ 동기화 가드가 CURRENT_WORK.md 를 "인계 갱신" 으로 세지 않는다', () => {
  it('판정이 docs/handoff/ 접두사 하나로만 이뤄진다', () => {
    const s = code(SYNC)
    expect(s, '판정이 다시 CURRENT_WORK.md 를 포함한다 — 목차가 거기 없으므로 늘 거짓 통과가 된다')
      .not.toMatch(/HANDOFF_INDEX|'docs\/CURRENT_WORK\.md'/)
    expect(s, 'handoff 디렉터리 판정이 사라졌다').toMatch(/const isHandoff = \(f\) => f\.startsWith\(HANDOFF_DIR\)/)
  })

  it('가드가 실제로 돈다 (등록 경로가 끊기지 않았다)', () => {
    const out = execFileSync('node', [SYNC], { encoding: 'utf8' })
    expect(out, '가드가 아무 말도 안 한다 — 출력 형식이 바뀌었으면 이 시험을 다시 조준할 것')
      .toContain('인계 문서 동기화')
  })
})

describe('⑤ 문서가 같은 말을 한다 (낡은 지도가 다음 세션을 되돌린다)', () => {
  it('CLAUDE.md 가 사이드카를 안내하고, CURRENT_WORK.md 를 목차라고 부르지 않는다', () => {
    const s = read('CLAUDE.md')
    const sec = s.slice(s.indexOf('## 🔄 진행 중 작업 인계'), s.indexOf('## 📣 유어애즈 방향 확정'))
    expect(sec, 'CLAUDE.md 가 사이드카를 안내하지 않는다').toContain(SIDECAR)
    expect(sec, 'CLAUDE.md 가 아직 CURRENT_WORK.md 를 "인계 목차" 라고 부른다')
      .not.toMatch(/`docs\/CURRENT_WORK\.md`\(인계 목차\)/)
  })

  it('CURRENT_WORK.md 자신이 목차가 어디로 갔는지 말한다', () => {
    const s = read('docs/CURRENT_WORK.md')
    expect(s.slice(0, 4000), 'CURRENT_WORK.md 가 사이드카를 가리키지 않는다 — 다음 세션이 빈 목차를 보고 헤맨다')
      .toContain('generate-handoff-index.mjs')
  })

  it('생성 블록 마커가 CURRENT_WORK.md 에서 사라졌다 (남으면 다시 거기에 쓰고 싶어진다)', () => {
    expect(read('docs/CURRENT_WORK.md'), '생성 마커가 아직 있다')
      .not.toContain('HANDOFF-INDEX:BEGIN')
  })
})
