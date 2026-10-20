import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { stripComments } from '../helpers/source-text'

/**
 * 🔧 2026-08-27 — `stripComments` 를 **스캐너로 교체**한 뒤의 회귀 가드.
 *
 * ## 왜 교체했나
 * 정규식 판은 **라인 주석 안의 `/*`** 를 블록 주석 시작으로 읽었다. 실측:
 * `ProductRepository.ts` 의 주석 한 줄 `(/api/wholesale/*)` 때문에 **5,911자(파일 절반)** 가 사라졌고,
 * 그 안의 코드가 검사에서 증발해 `not.toContain(...)` 류 단언이 **무조건 통과**했다.
 * 같은 클래스로 `discovery.ts` · `CuratorPage.tsx` 도 코드가 삼켜지고 있었다(4곳 실측).
 *
 * ⚠️ 이 파일 자신의 헤더가 그 함정을 **이미 경고**하고 있었다 — *"아무도 안 밟는 지뢰"* 라고 판단해
 *   놔뒀는데, 그날 밟혔다. **경고를 적는 것과 막는 것은 다르다.**
 */
describe('스캐너가 코드를 삼키지 않는다', () => {
  it('라인 주석 안의 `/*` 가 뒤 코드를 날리지 않는다', () => {
    const src = [
      '// 도매(/api/wholesale/*) 전용 — 이 줄의 /* 가 함정이었다',
      'const keep = 1',
      'const alsoKeep = 2',
    ].join('\n')
    const out = stripComments(src)
    expect(out).toContain('const keep = 1')
    expect(out).toContain('const alsoKeep = 2')
  })

  it('블록 주석 안의 `//` 가 블록을 안 닫히게 만들지 않는다', () => {
    // 순서만 뒤집는(라인 먼저) 처방이 깨지는 자리 — 스캐너는 통과해야 한다.
    const src = '/* 설명 // 부연 */\nconst keep = 3'
    expect(stripComments(src)).toContain('const keep = 3')
    expect(stripComments(src)).not.toContain('부연')
  })

  it('문자열 안의 `//` · `/*` 는 주석이 아니다', () => {
    const src = "const url = 'https://x.com/a'\nconst glob = '/*'\nconst keep = 4"
    const out = stripComments(src)
    expect(out).toContain('https://x.com/a')
    expect(out).toContain('const keep = 4')
  })

  it('정규식 리터럴 안의 `/` 를 주석으로 보지 않는다', () => {
    const src = 'const re = /a\\/\\/b/\nconst keep = 5'
    expect(stripComments(src)).toContain('const keep = 5')
  })

  it('진짜 주석은 여전히 지운다', () => {
    const out = stripComments('/** 헤더 */\n// 라인\nconst keep = 6 // 꼬리')
    expect(out).toContain('const keep = 6')
    expect(out).not.toContain('헤더')
    expect(out).not.toContain('라인')
    expect(out).not.toContain('꼬리')
  })
})

describe('레포 전수 — 스트립이 코드를 통째로 날리는 파일이 없다', () => {
  it('어떤 소스도 스트립 후 문법 뼈대를 잃지 않는다', () => {
    const files = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean)
    expect(files.length, '검사 대상이 0개면 이 테스트는 헛돈다').toBeGreaterThan(500)

    const broken: string[] = []
    for (const f of files) {
      const raw = readFileSync(f, 'utf8')
      // 원문에 있는 최상위 선언 수와 스트립 후 수를 비교 — 크게 줄면 코드가 삼켜진 것이다.
      const count = (s: string) => (s.match(/^(export |const |function |class |async function )/gm) || []).length
      const before = count(raw)
      const after = count(stripComments(raw))
      // 주석 안의 예시 코드가 지워져 줄어드는 건 정상이라, **절반 넘게** 사라지면 의심한다.
      if (before >= 6 && after < before * 0.5) broken.push(`${f} (${before} → ${after})`)
    }
    expect(broken, '스트립이 코드를 삼킨 파일 — 그 파일을 읽는 가드는 헛돈다').toEqual([])
  })
})
