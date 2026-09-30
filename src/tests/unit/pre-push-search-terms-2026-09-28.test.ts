/**
 * 🔎 2026-09-28 — pre-push 그물이 **무엇을 찾는가** 의 계약.
 *
 * ## 왜 생겼나 (같은 날 CI 를 두 번 태웠다)
 * `pre-push-tests.mjs` 는 `git diff -- src` 로만 바뀐 파일을 뽑았다. 그런데 이 레포의 가드는
 * `docs/` 도 읽는다(결재함·인계·`CLAUDE.md`·로케일·마이그레이션). 문서만 바꾼 푸시는 선택된 시험이
 * **0개**라 늘 초록이었고, 깨진 건 7분 뒤 CI 가 알려 줬다 — 로컬에서 1.2초면 알 수 있는 것이었다.
 *
 * 🩸 그리고 그 수리의 **첫 판 자체가 반쪽이었다**: 폴더 검색어에 끝 슬래시를 붙여
 * (`docs/decisions/`) `join(process.cwd(), 'docs/decisions')` 를 쓰는
 * `admin-decisions-parse.test.ts` 를 통째로 놓쳤다. 하필 그게 그날 사고 하나를 잡는 시험이었다.
 * 되돌려-검증이 아니었으면 "이제 잡힌다" 고 믿은 채 넘어갔을 것이다.
 *
 * ⚠️ **이 시험이 못 막는 것**: 여기서 재는 건 *검색어를 어떻게 만드느냐* 뿐이다.
 *   그 검색어로 고른 시험이 실제로 결함을 잡는지는 이 시험이 모른다(그건 주입 매니페스트의 일이다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { searchTermsFor } from '../../../scripts/pre-push-search-terms.mjs'

describe('pre-push 검색어', () => {
  it('🔴 non-src 는 파일 + 담긴 폴더, 폴더에 끝 슬래시를 붙이지 않는다', () => {
    // 🩸 끝 슬래시를 붙이면 `join(process.cwd(), 'docs/decisions')` 를 쓰는 시험을 통째로 놓친다 —
    //   하필 그게 그날 사고 하나를 잡던 시험이었다.
    const terms = searchTermsFor(['docs/decisions/2026-09-28-foo.md'])
    expect(terms).toEqual(['docs/decisions/2026-09-28-foo.md', 'docs/decisions'])
    for (const t of terms) expect(t.endsWith('/'), `"${t}" 에 끝 슬래시`).toBe(false)
  })

  it('🔴 최상위 한 칸(`docs`·`scripts`)은 검색어가 아니다 (너무 넓어 사실상 전수가 된다)', () => {
    expect(searchTermsFor(['docs/CURRENT_WORK.md'])).toEqual(['docs/CURRENT_WORK.md'])
  })

  it('🔴 그 검색어가 실제로 결재함 가드 둘을 **전부** 고른다', () => {
    // 문자열이 아니라 **실제 시험 파일 본문**에서 찾는다 — 규약이 아니라 사실을 잰다.
    const term = 'docs/decisions'
    expect(searchTermsFor(['docs/decisions/2026-09-28-foo.md'])).toContain(term)
    const dir = join(process.cwd(), 'src/tests/unit')
    const hit = readdirSync(dir)
      .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
      .filter(f => readFileSync(join(dir, f), 'utf8').includes(term))
    expect(hit).toContain('ai-team-operating-model.test.ts')   // 등급 C·필수 필드
    expect(hit).toContain('admin-decisions-parse.test.ts')     // 선택지 파싱 (끝 슬래시면 놓쳤다)
  })

  it('🔴 src 는 **파일 경로 그대로** — 폴더로 바꾸면 푸시가 터진다', () => {
    // `src/pages/Foo.tsx` 의 폴더는 `src/pages/` 이고, 그걸로 매칭하면 시험 225개가 딸려 온다(실측).
    // 🔧 2026-09-29 재조준: 규칙 4 가 `src/` 를 뗀 **파일** 경로를 하나 더 넣는다. 이 시험이 지키는
    //   것은 "몇 개인가" 가 아니라 **"폴더가 검색어가 되지 않는가"**(= 폭발 방지)였으므로 그쪽으로 옮긴다.
    for (const f of ['src/pages/UserProfilePage.tsx', 'src/pages/user-profile/SellerSection.tsx']) {
      const terms = searchTermsFor([f])
      expect(terms, '전체 경로').toContain(f)
      expect(terms, 'src 를 뗀 파일 경로').toContain(f.slice(4))
      expect(terms, '확장자 뗀 경로(별칭 import 용)').toContain(f.slice(4).replace(/\.tsx?$/, ''))
      // 🔧 2026-09-30 재조준: 규칙 5 가 **확장자를 뗀 파일 경로**를 하나 더 넣는다
      //   (`import X from '@/components/search/SearchHeader'` 를 잡으려고). 확장자가 없다고
      //   폴더인 것은 아니다 — 지키는 선은 여전히 **"폴더가 검색어가 되지 않는가"** 다.
      const dir = f.slice(4, f.lastIndexOf('/'))          // 예: 'pages/user-profile'
      const srcDir = f.slice(0, f.lastIndexOf('/'))       // 예: 'src/pages/user-profile'
      for (const t of terms) {
        expect(t, `폴더가 검색어가 됐다: ${t}`).not.toBe(dir)
        expect(t, `폴더가 검색어가 됐다: ${t}`).not.toBe(srcDir)
        // 파일 경로이거나(확장자 유지) 그 파일에서 확장자만 뗀 것이어야 한다.
        expect(t === f || t === f.slice(4) || t === f.slice(4).replace(/\.tsx?$/, ''),
          `파일 경로가 아닌 검색어: ${t}`).toBe(true)
      }
    }
  })

  it('루트 파일은 그대로 (CLAUDE.md)', () => {
    expect(searchTermsFor(['CLAUDE.md'])).toEqual(['CLAUDE.md'])
  })

  it('같은 폴더의 여러 파일이 있어도 폴더 검색어는 하나로 합쳐진다', () => {
    const terms = searchTermsFor(['docs/decisions/a.md', 'docs/decisions/b.md', 'docs/handoff/c.md'])
    expect(terms.filter(t => t === 'docs/decisions')).toHaveLength(1)
    expect(terms).toContain('docs/handoff')
  })

  /**
   * 🩸 2026-09-29 — 그물이 **실제로 놓친 사고**를 고정한다.
   *   `voucher-card-discount-once.test.ts` 는 SSOT 를
   *   `resolve(__dirname, '../../components/deal/DealRow.tsx')` 로 읽는다. 그물이 전체 경로
   *   (`src/components/...`)만 찾던 탓에 그 시험을 **후보에서 통째로 빠뜨렸고**, 로컬은 초록,
   *   5분 뒤 CI 가 빨간불이었다 — 이 그물이 막으려던 바로 그 사고 클래스다.
   */
  it('🔴 src/ 파일은 src 를 뗀 경로도 검색어다 — 상대경로로 읽는 시험을 놓치지 않는다', () => {
    const terms = searchTermsFor(['src/components/deal/DealRow.tsx'])
    expect(terms).toContain('src/components/deal/DealRow.tsx')
    expect(terms).toContain('components/deal/DealRow.tsx')
    // 폴더만으로는 안 찾는다 — 규칙 3(폭발 방지)이 그대로 살아 있다.
    expect(terms).not.toContain('components/deal')
    expect(terms).not.toContain('src/components/deal')
  })

  it('🔴 이 시험이 헛돌지 않는다 — 빈 입력에 빈 결과, 아무거나 통과시키지 않는다', () => {
    expect(searchTermsFor([])).toEqual([])
    expect(searchTermsFor(['src/a.ts'])).not.toContain('src')
  })

  it('🔴 실행 스크립트가 **문법상 돌아간다** (텍스트 가드가 못 보는 총체적 실패)', () => {
    // 🩸 2026-09-28: 이 모듈을 뽑아내는 편집이 `function changedSourcesfunction changedSources() {`
    //   를 남겼다. 주입 검증은 그 파일을 **텍스트로만** 읽고, tsc 는 `.mjs` 를 안 본다 —
    //   그래서 아무도 못 잡았고 푸시가 터지고 나서야 알았다. 파싱은 한 번 돌리면 끝이다.
    for (const f of ['scripts/pre-push-tests.mjs', 'scripts/pre-push-search-terms.mjs']) {
      expect(() => execFileSync('node', ['--check', join(process.cwd(), f)], { stdio: 'pipe' }), f).not.toThrow()
    }
  })

  it('🔴 실행 스크립트가 이 모듈을 실제로 쓴다 (배선이 끊기면 그물이 종전으로 돌아간다)', () => {
    const src = readFileSync(join(process.cwd(), 'scripts/pre-push-tests.mjs'), 'utf8')
    expect(src).toContain("from './pre-push-search-terms.mjs'")
    expect(src).toContain('searchTermsFor(changed)')
    // 🔴 `-- src` 로 좁히던 종전 호출이 돌아오면 문서 변경이 다시 통째로 눈이 먼다.
    //    지금은 **경로 필터 없이** 레포 전체를 본다(main 이 채택한 더 넓은 판정).
    expect(src).toContain("['diff', '--name-only', base, 'HEAD']")
    expect(src).not.toMatch(/'--name-only',\s*base,\s*'HEAD',\s*'--'/)
  })
})
