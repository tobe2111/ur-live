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

// ─────────────────────────────────────────────────────────────────────────────
// 🏷️ 2026-08-26 추가분 — "유어샵과 어긋나는 것" 전수 감사에서 실제로 나온 3클래스.
//   전부 **에러 없이 조용히 틀리는** 종류라(버튼은 눌리고 화면은 뜬다) 가드가 없으면 다시 샌다.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 주석을 지운 코드만 돌려준다.
 *
 * 🩸 왜 필요한가: 아래 세 검사는 전부 "이 문구가 코드에 남아 있나"를 보는데, 이 레포는 **왜 그 문구를
 *   버렸는지**를 그 자리 주석에 남기는 것이 규칙이다. 주석을 같이 세면 그 기록이 위반이 되어,
 *   다음 세션이 같은 실수를 반복하지 않게 막아 주는 유일한 장치부터 지우게 된다.
 * ⚠️ 첫 판은 줄 단위(`^\s*(//|*|/*)`)로 지웠는데 **JSX 주석 `{/* … *\/}` 의 둘째 줄부터를 못 걸렀다**
 *   (그 줄들은 `*` 로 시작하지 않는다). 블록을 통째로 지우는 방식으로 교체했다.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')  // /** … */ 와 {/* … */} 안쪽 전부
    .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')
}

/** 소비자 화면 파일만 — 셀러/어드민 대시보드는 다른 규칙을 따른다. */
const CONSUMER_FILES = SRC_FILES.filter(f =>
  (f.startsWith('src/pages/') || f.startsWith('src/components/')) &&
  !/\/(admin|wholesale|supplier|agency)[/-]/i.test(f) &&
  !/^src\/pages\/(Admin|Seller|Agency|Supplier|Wholesale)/.test(f)
)

describe('N5 "매장 등록" 이라 말하는 버튼은 실제로 매장 등록으로 간다', () => {
  /**
   * 🩸 실제로 어긋나 있었다: 하단 네비·유어샵 온보딩 모달·결제완료 넛지·빈 유어샵 CTA 가 전부
   *   "내 가게 등록"이라 적어 놓고 목적지는 `/seller/register/supplier`(사업자 가입 폼)였다.
   *   대표 확정 순서는 **매장 등록이 선행**이고(`StoreClaimPage` 헤더 주석), 사업자 인증은 그 다음에
   *   대시보드가 안내한다. 말과 목적지가 갈리면 사장님은 사업자등록번호 화면에서 멈춘다.
   *
   * ⚠️ 못 막는 것: 문구가 변수·i18n 키로만 존재해 같은 줄에 안 붙어 있는 경우.
   *   그래서 이 검사는 "같은 JSX 요소 안"이 아니라 **파일 전체에 사업자 폼 경로가 있는지**를 본다 —
   *   소비자 화면에서 그 경로가 등장할 정당한 이유가 사실상 없기 때문이다(가입 폼 자신은 제외).
   */
  const SIGNUP_FORM = '/seller/register/supplier'
  it('소비자 화면은 사업자 가입 폼으로 직접 보내지 않는다 (매장 등록 = /store/new)', () => {
    const allow = new Set([
      'src/pages/SellerRegisterSupplierPage.tsx', // 폼 자신(로그인 복귀 returnUrl)
      'src/pages/SellerWaitingPage.tsx',          // 심사 대기 → 폼으로 되돌림
    ])
    const hits = CONSUMER_FILES.filter(f => !allow.has(f))
      .filter(f => stripComments(readFileSync(f, 'utf-8')).includes(SIGNUP_FORM))
    expect(hits, `소비자 진입점이 매장 등록 대신 사업자 폼으로 간다:\n${hits.join('\n')}`).toEqual([])
  })

  it('매장 등록 단일 목적지 /store/new 가 실재하고 라우팅돼 있다', () => {
    const app = readFileSync('src/App.tsx', 'utf-8')
    expect(app).toContain('/store/new')
    expect(app).toContain('StoreClaimPage')
  })
})

describe('N6 유어샵은 "여는" 것이 아니다 — 가입하면 이미 있다', () => {
  /**
   * 🩸 "내 쇼핑몰 열기"·"5분이면 오픈"·"사업자 등록만 하면 내 유어샵이 열립니다" 가 곳곳에 있었다.
   *   전부 **사실이 아니다** — `/u/{handle}` 은 가입 시점에 자동 생성된다(`KakaoAuthService.upsertUser`).
   *   새로 만드는 것은 유어샵이 아니라 **매장**이고, 둘을 섞으면 이미 샵이 있는 사람에게
   *   "만들기" 화면을 다시 들이밀게 된다(대표가 실제로 지적한 사고).
   */
  const LIES = ['쇼핑몰을 열', '쇼핑몰 열기', '쇼핑몰 개설', '유어샵이 열립니다', '유어샵 만들기', '5분이면 오픈']
  it('소비자 화면 0건', () => {
    const hits: string[] = []
    for (const f of CONSUMER_FILES) {
      const t = stripComments(readFileSync(f, 'utf-8'))
      for (const w of LIES) if (t.includes(w)) hits.push(`${f} :: ${w}`)
    }
    expect(hits, `유어샵을 "새로 여는 것"처럼 말한다:\n${hits.join('\n')}`).toEqual([])
  })

  it('6개 언어 값에도 0건', () => {
    const hits: string[] = []
    for (const l of LOCALES) {
      const v = localeValues(l)
      for (const w of LIES) if (v.includes(w)) hits.push(`${l} :: ${w}`)
    }
    expect(hits, `로케일 값에 남아 있다:\n${hits.join('\n')}`).toEqual([])
  })
})

describe('N7 검색결과에 사람을 신분으로 부르지 않는다', () => {
  /**
   * 대표 확정: *"사람을 인플루언서 / 대행사로 나누지 않는다. 행위 2개(담기·운영)로 말한다."*
   * SEO 표(`consumer-surfaces.ts`)는 **검색결과에 그대로 노출**되는 자리라 여기부터 지킨다.
   * 페이지 본문 전체로 넓히지 않은 이유: 어드민·가이드·과거 기록까지 걸려 오탐이 나고,
   * 그러면 이 가드가 꺼지게 된다(이 레포에서 실제로 그렇게 죽은 가드가 있었다 — check-input-text-color).
   */
  const BANNED = ['인플루언서', '크리에이터', '큐레이터']
  it('consumer-surfaces 의 title/description 에 0건', () => {
    const src = readFileSync('src/shared/seo/consumer-surfaces.ts', 'utf-8')
    const code = stripComments(src)  // 왜 안 쓰는지 설명한 문장이 위반이 되면 설명을 못 남긴다
    const hits = BANNED.filter(w => code.includes(w))
    expect(hits, `SEO 문구에 신분어가 있다: ${hits.join(', ')}`).toEqual([])
  })

  it('사이트맵이 제출하는 정적 표면은 App.tsx 에 실재한다', () => {
    // 새로 8개를 추가했다 — 라우트 없는 URL 을 제출하면 soft-404 로 색인 신뢰도가 깎인다.
    const sm = readFileSync('src/worker/routes/sitemap.routes.ts', 'utf-8')
    const app = readFileSync('src/App.tsx', 'utf-8')
    const locs = [...sm.matchAll(/loc:\s*'(\/[a-z0-9/-]*)'/g)].map(m => m[1])
      .filter(p => p !== '/' && !p.startsWith('/wholesale') && p !== '/region')
    const missing = locs.filter(p => !app.includes(`path="${p}"`))
    expect(missing, `사이트맵이 없는 라우트를 제출한다: ${missing.join(', ')}`).toEqual([])
  })
})
