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
import { searchTermsFor, DIR_MATCHED } from '../../../scripts/pre-push-search-terms.mjs'

describe('pre-push 검색어', () => {
  it('🔴 non-src 폴더 검색어에 끝 슬래시를 붙이지 않는다 (붙이면 그날 사고를 잡던 시험을 놓쳤다)', () => {
    const terms = searchTermsFor(['docs/decisions/2026-09-28-foo.md'])
    expect(terms).toEqual(['docs/decisions'])
    for (const t of terms) expect(t.endsWith('/'), `"${t}" 에 끝 슬래시`).toBe(false)
  })

  it('🔴 그 검색어가 실제로 결재함 가드 둘을 **전부** 고른다', () => {
    // 문자열이 아니라 **실제 시험 파일 본문**에서 찾는다 — 규약이 아니라 사실을 잰다.
    const [term] = searchTermsFor(['docs/decisions/2026-09-28-foo.md'])
    const dir = join(process.cwd(), 'src/tests/unit')
    const hit = readdirSync(dir)
      .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
      .filter(f => readFileSync(join(dir, f), 'utf8').includes(term))
    expect(hit).toContain('ai-team-operating-model.test.ts')   // 등급 C·필수 필드
    expect(hit).toContain('admin-decisions-parse.test.ts')     // 선택지 파싱 (끝 슬래시면 놓쳤다)
  })

  it('🔴 src 는 **파일 경로 그대로** — 폴더로 바꾸면 푸시가 터진다', () => {
    // `src/pages/Foo.tsx` 의 폴더는 `src/pages/` 이고, 그걸로 매칭하면 시험 225개가 딸려 온다(실측).
    expect(searchTermsFor(['src/pages/UserProfilePage.tsx'])).toEqual(['src/pages/UserProfilePage.tsx'])
    expect(searchTermsFor(['src/pages/user-profile/SellerSection.tsx']))
      .toEqual(['src/pages/user-profile/SellerSection.tsx'])
  })

  it('루트 파일은 그대로 (CLAUDE.md)', () => {
    expect(searchTermsFor(['CLAUDE.md'])).toEqual(['CLAUDE.md'])
  })

  it('같은 폴더의 여러 파일은 검색어 하나로 합쳐진다', () => {
    expect(searchTermsFor([
      'docs/decisions/a.md', 'docs/decisions/b.md', 'docs/handoff/c.md',
    ])).toEqual(['docs/decisions', 'docs/handoff'])
  })

  it('🔴 이 시험이 헛돌지 않는다 — 폴더 매칭 영역이 비어 있지 않다', () => {
    expect(DIR_MATCHED.length).toBeGreaterThan(2)
    expect(DIR_MATCHED).toContain('docs/')
  })

  it('🔴 실행 스크립트가 이 모듈을 실제로 쓴다 (배선이 끊기면 그물이 종전으로 돌아간다)', () => {
    const src = readFileSync(join(process.cwd(), 'scripts/pre-push-tests.mjs'), 'utf8')
    expect(src).toContain("from './pre-push-search-terms.mjs'")
    expect(src).toContain('searchTermsFor(changed)')
    // 🔴 `-- src` 로 좁히던 종전 호출이 돌아오면 문서 변경이 다시 통째로 눈이 먼다.
    expect(src).toContain("'docs'")
    expect(src).not.toMatch(/'--name-only',\s*base,\s*'HEAD',\s*'--',\s*'src'\s*\]/)
  })
})
