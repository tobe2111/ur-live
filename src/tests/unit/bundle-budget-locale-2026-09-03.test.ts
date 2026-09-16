/**
 * 📦 **번들 예산이 재는 것** — 2026-09-03.
 *
 * 총량 예산은 여섯 언어 청크를 전부 더해 왔다(합 ~1.55 MB, 총 raw 의 18%). 그런데 `src/i18n.ts` 는
 * 사용자 언어 **하나만** 가져온다 — 나머지 다섯은 **아무도 받지 않는 바이트**다. 그래서 이 예산은
 * 실제 무게가 아니라 "번역을 추가했는가"를 재고 있었고, CLAUDE.md 가 6개 언어 동시 추가를
 * **의무화**하므로 라벨 30여 개에 선을 넘었다(8.60 → 8.61).
 *
 * ⇒ 가장 큰 언어 하나만 센다. 임계값도 그만큼 내려 **비-언어 코드에 걸리는 압력은 세졌다.**
 *
 * ⚠️ 이 교정은 **전제 하나에 기대고 있다**: 언어는 한 번에 하나만 받는다. 누군가 i18n 을
 *   "전부 preload" 로 바꾸면 그 전제가 깨지고 예산은 진짜 무게를 놓치게 된다 — 그래서 여기서 함께 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SCRIPT = readFileSync('scripts/check-bundle-size.mjs', 'utf8')
const I18N = readFileSync('src/i18n.ts', 'utf8')
const SUPPORTED = ['ko', 'en', 'ja', 'zh', 'es', 'fr'] as const

describe('① 전제 — 언어는 한 번에 하나만 받는다', () => {
  it('언어마다 dynamic import 로 따로 가져온다', () => {
    for (const lang of SUPPORTED) {
      expect(I18N).toContain(`import('../public/locales/${lang}/translation.json')`)
    }
  })

  it('🔒 정적 import 로 번역을 끌어오지 않는다 — 그러면 전부 한 청크가 되어 전제가 깨진다', () => {
    expect(I18N).not.toMatch(/^import .*locales\/\w+\/translation\.json/m)
  })
})

describe('② 예산은 배타적 언어 청크를 한 번만 센다', () => {
  it('가장 큰 언어 하나만 총량에 넣는다', () => {
    expect(SCRIPT).toMatch(/const LOCALE_RE = \/\^locale-\(\?:ko\|en\|ja\|zh\|es\|fr\)-\//)
    expect(SCRIPT).toContain('const countedFiles = jsFiles.filter(f => !LOCALE_RE.test(f.name) || f === biggestLocale)')
  })

  it('🔒 총량 두 개가 모두 그 목록을 쓴다 — 한쪽만 고치면 두 예산이 서로 다른 것을 잰다', () => {
    expect(SCRIPT).toContain('const totalSize = countedFiles.reduce')
    expect(SCRIPT).toContain('const totalGzip = countedFiles.reduce')
  })
})

describe('③ 임계값 — 교정과 함께 내려간 채로 유지된다', () => {
  const num = (key: string) => Number(SCRIPT.match(new RegExp(`${key}:\\s*([\\d.]+)`))![1])

  it('🔒 raw 임계값이 교정 전 값(8.6)으로 되돌아가지 않는다', () => {
    // 되돌리면 언어 청크 1.29 MB 만큼의 완충재가 다시 생겨 실제 증가를 가린다.
    expect(num('totalRawMB')).toBeLessThanOrEqual(7.6)
  })

  it('🔒 gzip 임계값도 마찬가지', () => {
    expect(num('totalGzipMB')).toBeLessThanOrEqual(2.6)
  })

  it('critical path 예산은 손대지 않았다 — 첫 페인트 감지기는 그대로다', () => {
    expect(SCRIPT).toMatch(/criticalGzipKB: 240/)
  })
})
