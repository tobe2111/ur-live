/**
 * 🏷️ 유어샵 명칭 + 셀러 진입점 불변식 (2026-08-26 대표 확정)
 *
 * 배경: 이 레포는 같은 일을 세 번 했다 — 식사권→공구권→이용권, 유통사→판매사, 그리고 링크샵→유어샵.
 * 매번 일괄 치환은 성공했지만 **그 뒤에 옛 이름이 슬금슬금 돌아왔다**(새 문구를 쓰는 사람이 옛 문서를
 * 보고 쓴다). 그래서 치환과 함께 가드를 박는다.
 *
 * 지키는 것:
 *   N1 사용자-가시 "링크샵" 0건 — src 코드·6개 언어 전부.
 *   N2 코드 식별자는 **건드리지 않는다** — `linkshopPath`·`useLinkshopPath`·`nav.linkshop` 등은 그대로.
 *      (URL `/u/{handle}` 도 불변이라 이미 공유된 링크가 안 깨진다.)
 *   N3 다국어에서 유어샵은 **번역하지 않는다** — 브랜드명이므로 `UrShop`(유어딜=UrDeal 과 같은 취급).
 *   N4 "판매하세요" 진입점은 셀러가 아닌 사람을 **로그인 벽으로 보내지 않는다**.
 *
 * 이 테스트가 못 막는 것: docs/**(historical audit log 는 소급 변경하지 않는 것이 이 레포 규칙이라
 * 검사 대상에서 뺐다) · 런타임에 조립되는 문자열.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    // 이 테스트 파일 자신은 옛 이름을 '검사 대상'으로 담고 있으므로 제외한다.
    else if (/\.(ts|tsx|css)$/.test(name) && !name.startsWith('urshop-naming')) out.push(p)
  }
  return out
}

const SRC_FILES = walk('src')
const LOCALES = ['ko', 'en', 'ja', 'zh', 'es', 'fr'] as const
const readLocale = (l: string) => readFileSync(`public/locales/${l}/translation.json`, 'utf-8')

/** 로케일은 **값만** 본다 — 키(`nav.linkshop` 등)는 코드 식별자라 바꾸지 않는 게 계약이다. */
function localeValues(l: string): string {
  const out: string[] = []
  const walkJson = (o: unknown): void => {
    if (typeof o === 'string') out.push(o)
    else if (o && typeof o === 'object') Object.values(o as Record<string, unknown>).forEach(walkJson)
  }
  walkJson(JSON.parse(readLocale(l)))
  return out.join('\n')
}

describe('N1 옛 이름 "링크샵" 은 사용자에게 보이지 않는다', () => {
  it('src 코드에 0건', () => {
    const hits = SRC_FILES.filter(f => readFileSync(f, 'utf-8').includes('링크샵'))
    expect(hits, `옛 이름이 남아 있다:\n${hits.join('\n')}`).toEqual([])
  })

  it('6개 언어 전부 0건', () => {
    const hits = LOCALES.filter(l => localeValues(l).includes('링크샵'))
    expect(hits, `옛 이름이 남은 로케일: ${hits.join(', ')}`).toEqual([])
  })
})

describe('N2 코드 식별자는 그대로 — 치환이 로직을 건드리지 않았다', () => {
  it('linkshopPath / useLinkshopPath 가 살아 있다', () => {
    // 이게 사라졌다면 일괄 치환이 ASCII 식별자까지 먹은 것 = 라우팅이 조용히 깨진다.
    const hook = readFileSync('src/hooks/useLinkshopPath.ts', 'utf-8')
    expect(hook).toContain('useLinkshopPath')
    const nav = readFileSync('src/components/main/BottomNav.tsx', 'utf-8')
    expect(nav).toContain('linkshopPath')
  })

  it('i18n 키 `nav.linkshop` 이 6개 언어 전부에 남아 있다', () => {
    for (const l of LOCALES) {
      const d = JSON.parse(readLocale(l)) as Record<string, Record<string, unknown>>
      expect(d.nav?.linkshop, `${l} 에서 nav.linkshop 키가 사라졌다`).toBeTruthy()
    }
  })
})

describe('N3 유어샵은 번역하지 않는다 (브랜드명)', () => {
  it('ko 는 "유어샵", 나머지 5개 언어는 "UrShop"', () => {
    const ko = JSON.parse(readLocale('ko')) as Record<string, Record<string, string>>
    expect(ko.nav.linkshop).toBe('유어샵')
    for (const l of LOCALES.filter(x => x !== 'ko')) {
      const d = JSON.parse(readLocale(l)) as Record<string, Record<string, string>>
      expect(d.nav.linkshop, `${l} 은 브랜드명을 번역하면 안 된다`).toContain('UrShop')
    }
  })

  it('옛 번역어(Linkshop/リンクショップ/链接商店…)가 남아 있지 않다', () => {
    const OLD = [/Link\s?[Ss]hop/, /Linkshop/, /リンクショップ/, /链接商店/, /链接店/, /tienda de enlaces/, /boutique de liens/]
    for (const l of LOCALES) {
      const raw = localeValues(l)
      const found = OLD.filter(re => re.test(raw))
      expect(found.map(String), `${l} 에 옛 번역어 잔존`).toEqual([])
    }
  })
})

describe('N4 "판매하세요" 가 로그인 벽으로 보내지 않는다', () => {
  it('목적지 판정이 SSOT 함수 하나로 모여 있다', () => {
    const src = readFileSync('src/utils/seller-entry.ts', 'utf-8')
    // 셀러가 아니면 입점 안내로. `/seller` 는 requireSeller 라 비셀러를 /seller/login 으로 튕긴다.
    expect(src).toMatch(/return hasSellerToken\(\) \? '\/seller' : '\/partners'/)
  })

  it('두 호출부가 모두 그 함수를 쓴다 (손으로 쓰면 갈린다)', () => {
    for (const f of ['src/components/main/DesktopTopNav.tsx', 'src/components/main/AccountMenu.tsx']) {
      const s = readFileSync(f, 'utf-8')
      expect(s, `${f} 가 sellerEntryPath 를 안 쓴다`).toContain('sellerEntryPath()')
      // 옛 하드코딩이 남아 있으면 한쪽만 고쳐진 상태다.
      expect(s, `${f} 에 하드코딩된 '/seller' 이동이 남아 있다`).not.toMatch(/(navigate|go)\('\/seller'\)/)
    }
  })
})
