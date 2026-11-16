/**
 * 🤫 커밋 검사 출력을 "이번 커밋에 걸린 것" 으로 줄인다 (2026-11-16 대표 "계속 개선해줘" — 토큰 낭비)
 * 실측: 파일 한 줄 고친 커밋에 pre-commit 출력 357줄 · 약 7,500 토큰 → 52줄 · 약 810 토큰.
 * 고정: ① 이번 커밋 파일에 걸린 경고 줄은 그대로 보인다 ② 무관한 기존 잔여는 요약 몇 줄로 접힌다
 *      ③ 경고 전용 검사는 전부 quiet_warn 으로 돈다 ④ 막는 검사(strict)는 거르지 않는다 ⑤ HOOK_VERBOSE=1 이면 전부.
 * ⚠️ 못 보는 것: 경고 문구에 파일 경로 없이 "이번 커밋 때문에" 라고만 쓰는 검사 — 요약 줄(⚠️·❌)로는 남지만 3줄을 넘으면 접힌다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { quietFilter, HIDDEN_NOTE, MAX_SUMMARY } from '../../../scripts/hook-quiet-filter.mjs'

const OUT = [
  '🔍 Dark mode border check (user-facing pages)',
  '   Scanned 955 tsx files',
  '',
  '⚠️  border-gray-50/100/200 without dark: override: 350',
  '   다크 모드에서 흰 선처럼 보임. dark:border-[#1A1A1A] 매핑 필요.',
  '  src/pages/A.tsx:185',
  '    <div className="border border-gray-200">',
  '  src/pages/B.tsx:12',
  '    <div className="border border-gray-100">',
  '  ... and 310 more',
].join('\n')

describe('경고 출력 줄이기', () => {
  it('이번 커밋 파일에 걸린 줄은 이어지는 코드 줄·설명과 함께 남는다', () => {
    const out = quietFilter(OUT, ['src/pages/B.tsx'])
    expect(out).toContain('src/pages/B.tsx:12')
    expect(out).toContain('border-gray-100')
    expect(out).toContain('매핑 필요')
    expect(out).not.toContain('src/pages/A.tsx')
    expect(out).not.toContain('border-gray-200">')
  })
  it('무관하면 경고 요약만 남기고 숨겼다고 말한다', () => {
    const out = quietFilter(OUT, ['src/utils/format.ts'])
    expect(out).toContain('350')
    expect(out).toContain(HIDDEN_NOTE)
    expect(out).not.toContain('src/pages/')
    expect(out.split('\n').length).toBeLessThanOrEqual(MAX_SUMMARY + 1)
  })
  it('🔍 같은 다른 이모지를 경고 표시로 잘못 읽지 않는다(이모지는 문자 둘로 쪼개진다)', () => {
    expect(quietFilter('🔍 PII log redaction check\n✅ ok', [])).toBe('')
  })
  it('경고가 없으면 아무것도 안 찍는다', () => {
    expect(quietFilter('🔍 check\n   Scanned 12 files\n✅ 문제 없음', [])).toBe('')
  })
  it('HOOK_VERBOSE 이면 손대지 않는다', () => {
    expect(quietFilter(OUT, [], { verbose: true })).toBe(OUT)
  })
})

describe('pre-commit 배선', () => {
  const s = readFileSync('scripts/install-git-hooks.sh', 'utf8')
  const start = s.indexOf("cat > \"$HOOK_FILE\" << 'EOF'")
  const body = s.slice(start, s.indexOf('\nEOF\n', start))
  it('경고 전용 검사(|| true)는 전부 quiet_warn 으로 돈다', () => {
    const bare = body.split('\n').filter((l) => /^\s*(node|bash) scripts\/check-[^\n]*\|\| true$/.test(l) && !l.includes('/dev/null'))
    expect(bare, '거르지 않는 경고 검사가 있다').toEqual([])
    expect((body.match(/^\s*quiet_warn (node|bash) scripts\/check-/gm) || []).length).toBeGreaterThanOrEqual(35)
  })
  it('막는 검사는 거르지 않는다 — 실패 이유가 그대로 보여야 한다', () => {
    expect(body).not.toMatch(/quiet_warn [^\n]*-s( |$)/m)
    expect(body).toContain('node scripts/check-conflict-markers.mjs -s || {')
  })
  it('진행 표시는 평소엔 숨기고 HOOK_VERBOSE 로 켠다 · 실패하면 켜는 법을 알린다', () => {
    expect(body).toMatch(/step\(\) \{ if \[ "\$\{HOOK_VERBOSE:-\}" = "1" \]; then echo "==> Pre-commit: \$1"; fi; return 0; \}/)
    expect(body).not.toMatch(/^\s*echo "==> Pre-commit:/m)
    expect(body).toContain('HOOK_VERBOSE=1 git commit')
  })
})

describe('숨김 안내는 한 번만', () => {
  it('훅은 검사마다 안내를 붙이지 않고(--no-note) 끝에 한 번 알린다', () => {
    const s = readFileSync('scripts/install-git-hooks.sh', 'utf8')
    expect(s).toContain('node scripts/hook-quiet-filter.mjs "$_STAGED_FOR_QUIET" --no-note')
    expect(s).toContain('경고만 하는 검사는 이번 커밋 파일에 걸린 줄만 보였다')
    expect(quietFilter(OUT, [], { note: false })).not.toContain(HIDDEN_NOTE)
  })
})
