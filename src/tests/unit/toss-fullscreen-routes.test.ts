/**
 * 🛡️ 2026-05-24: 결제 위젯 마운트 라우트가 BottomNav 에 안 가리는지 영구 검증.
 *
 * 사고 (regression):
 *   /pay/widget (TossWidgetPayPage) 가 fullScreenPrefixes 에 빠져있어 BottomNav 가
 *   결제하기 버튼을 가리는 UX 버그. 사용자 결제 못 함.
 *
 * 영구 방어:
 *   1) src/ 전체에서 TossPaymentWidget 또는 TossWidgetPayPage import 하는 파일 발견
 *   2) 해당 파일이 App.tsx 의 <Route path="..."> 에 어떻게 마운트되는지 추출
 *   3) 모든 마운트 라우트가 fullScreenPrefixes 의 한 prefix 와 매치하는지 검증
 *
 * 신규 결제 페이지 추가 시 자동 잡힘 — 사용자 경험 회귀 차단.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const SRC = join(__dirname, '..', '..', '..', 'src')
const APP_TSX = join(SRC, 'App.tsx')

// 재귀적으로 .tsx 파일 수집
function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, acc)
    else if (name.endsWith('.tsx') || name.endsWith('.ts')) acc.push(p)
  }
  return acc
}

describe('Toss payment widget — fullscreen route guard', () => {
  it('all routes mounting TossPaymentWidget / TossWidgetPayPage must be in fullScreenPrefixes', () => {
    const appSource = readFileSync(APP_TSX, 'utf8')

    // 1) fullScreenPrefixes 배열 추출
    const prefixMatch = appSource.match(/const fullScreenPrefixes = \[([^\]]+)\]/)
    expect(prefixMatch, 'App.tsx 에서 fullScreenPrefixes 배열을 찾을 수 없음').toBeTruthy()
    const prefixes = (prefixMatch![1].match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1))
    expect(prefixes.length).toBeGreaterThan(0)

    // 2) Toss 위젯 마운트 컴포넌트 식별
    const widgetMountComponents = new Set<string>(['TossWidgetPayPage'])
    // CheckoutPage 도 TossPaymentWidget 마운트 (PaymentSection 경유)
    widgetMountComponents.add('CheckoutPage')

    // 3) App.tsx 에서 해당 컴포넌트가 사용된 <Route path="..."> 추출
    //    lazy import 패턴: const TossWidgetPayPage = lazy(() => import('./pages/TossWidgetPayPage'))
    //    Route 패턴:        <Route path="/pay/widget" element={<...><TossWidgetPayPage /></...>} />
    const failures: string[] = []
    for (const comp of widgetMountComponents) {
      // 해당 컴포넌트가 사용된 Route 모두 찾기 (multiline)
      const routeRegex = new RegExp(`<Route\\s+path="([^"]+)"[^>]*>[\\s\\S]*?<${comp}\\s*/>`, 'g')
      let match
      let found = false
      while ((match = routeRegex.exec(appSource)) !== null) {
        found = true
        const route = match[1]
        const covered = prefixes.some((p) => route === p || route.startsWith(p + '/'))
        if (!covered) {
          failures.push(
            `❌ Route "${route}" (${comp}) is NOT in fullScreenPrefixes — BottomNav will cover payment button.\n` +
            `   Add a prefix that matches "${route}" to fullScreenPrefixes in App.tsx.`,
          )
        }
      }
      expect(found, `${comp} 컴포넌트가 App.tsx 에서 <Route> 로 마운트되지 않음 — 테스트 패턴 오래됐을 수 있음`).toBe(true)
    }

    expect(failures, failures.join('\n\n')).toEqual([])
  })

  it('discovers any NEW file that imports TossPaymentWidget — alert if route untested', () => {
    const allFiles = walk(SRC)
    const widgetImporters: string[] = []
    for (const f of allFiles) {
      if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue
      const src = readFileSync(f, 'utf8')
      // import { TossPaymentWidget } from '...' OR lazy() => import('.../TossPaymentWidget')
      if (/from\s+['"][^'"]*TossPaymentWidget['"]/.test(src) || /import\s*\(\s*['"][^'"]*TossPaymentWidget['"]\s*\)/.test(src)) {
        widgetImporters.push(f.replace(SRC, 'src'))
      }
    }
    // 알려진 마운트 처: PaymentSection.tsx (CheckoutPage 경유) + 잠재 향후 추가
    //   신규 추가 시 이 배열 갱신 + 그 라우트가 fullScreenPrefixes 에 있는지 위 테스트가 검증.
    const KNOWN_MOUNTS = [
      'src/pages/checkout/PaymentSection.tsx',
      // region.ts 는 region-aware payment provider 헬퍼 (KR=Toss/Global=Stripe).
      //   직접 마운트가 아니라 indirection — 실제 마운트는 호출 쪽에서.
      'src/shared/config/region.ts',
    ]
    const unknown = widgetImporters.filter((f) => !KNOWN_MOUNTS.includes(f))
    expect(unknown, `🚨 신규 TossPaymentWidget 마운트 파일 발견: ${unknown.join(', ')}\n` +
      `→ 1) 라우트가 App.tsx fullScreenPrefixes 에 포함되는지 확인\n` +
      `→ 2) 이 테스트 파일의 KNOWN_MOUNTS 배열에 추가`).toEqual([])
  })
})
