/**
 * 📦 네이티브 SDK(Capacitor)를 **어디서도** 정적으로 부르지 않는다 (2026-10-14)
 *
 * 2026-10-12 가 부팅 경로(main.tsx 등 셋)만 막았는데, 실측해 보니 그 밖에서 둘이 새고 있었다:
 *   · 마이의 보상 광고 카드(`reward-ad-card`)가 "앱인가?" 하나를 묻느라 `@capacitor/core` 를 정적으로 불러,
 *     **웹 마이 첫 화면**(카드는 웹에서 렌더조차 안 한다)과 주문 내역·주문 상세가 capacitor 청크를 받았다(마이 −5.1KB br)
 *   · 블로그 상세의 공유 버튼이 `@/lib/native` 를 정적으로 불렀다(누를 때만 필요)
 * ⇒ 판정은 import 없는 `@/lib/native-platform`, 네이티브 기능은 쓰는 순간 `import('@/lib/native')`.
 *    정적으로 불러도 되는 곳은 그 SDK 를 감싼 `src/lib/native.ts` 하나뿐이다.
 * ⚠️ 못 막는 것: 변수 경로 동적 import · 앱 기기에서 기능이 실제로 뜨는지.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== 'tests' && n !== 'node_modules') walk(p, out) }
    else if (/\.(ts|tsx)$/.test(n)) out.push(p)
  }
  return out
}

const STATIC = /^\s*import\s[^;]*?from\s+['"](@\/lib\/native|(?:\.\.?\/)+(?:lib\/)?native|@capacitor\/[^'"]+)['"]/m
const ALLOWED = new Set(['src/lib/native.ts'])

describe('📦 Capacitor 정적 import 는 감싼 파일 하나뿐', () => {
  const files = walk('src')
  it('검사 대상이 실재한다(0개면 통과가 아니라 고장)', () => {
    expect(files.length).toBeGreaterThan(1000)
  })
  it('lib/native.ts 밖에서 정적으로 부르지 않는다', () => {
    const bad = files.filter((f) => !ALLOWED.has(f) && STATIC.test(readFileSync(f, 'utf8')))
    expect(bad).toEqual([])
  })
  it('보상 광고 카드는 import 없는 판정을 쓴다', () => {
    const s = readFileSync('src/components/my-page/reward-ad-card.tsx', 'utf8')
    expect(s).toMatch(/import \{ isNativeShell \} from '@\/lib\/native-platform'/)
    expect(s).toMatch(/const isNative = isNativeShell\(\)/)
  })
})
