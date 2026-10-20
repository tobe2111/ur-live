/**
 * 📱 Capacitor 를 첫 부팅 코드에서 뺀다 (2026-10-12, 대표 "대기업급 속도") — 웹 방문자는 쓸 일이 없는데
 * 모든 첫 방문이 capacitor 청크를 받았다(main.tsx 정적 import + `lib/native.ts` 가 app-utils 에 섞여서).
 *
 *   ① 판정 함수가 `@capacitor/core` 의 규칙과 같다(그 소스를 읽어 같은 단서를 쓰는지 대조 + 동작)
 *   ② main.tsx · version-check · IosTopupGate 가 `@/lib/native`·`@capacitor/core` 를 정적으로 안 부른다
 *   ③ `lib/native.ts` 는 capacitor 청크로 간다(app-utils 에 섞이면 다시 모든 페이지가 끌어온다)
 * ⚠️ 못 막는 것: 실제 앱(iOS/안드로이드 껍데기)에서 네이티브 기능이 뜨는지 — 기기에서만 판정된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { nativePlatform, isNativeShell, isIOSShell } from '@/lib/native-platform'

const read = (p: string) => readFileSync(p, 'utf8')

describe('📱 네이티브 판정 — Capacitor 없이', () => {
  it('① @capacitor/core 와 같은 단서를 쓴다', () => {
    const core = read('node_modules/@capacitor/core/dist/index.js')
    expect(core).toMatch(/androidBridge/)
    expect(core).toMatch(/messageHandlers[\s\S]{0,200}bridge/)
    expect(core).toMatch(/CapacitorCustomPlatform/)
  })

  it('① 동작', () => {
    expect(nativePlatform({})).toBe('web')
    expect(nativePlatform(undefined)).toBe('web')
    expect(nativePlatform({ androidBridge: {} })).toBe('android')
    expect(nativePlatform({ webkit: { messageHandlers: { bridge: {} } } })).toBe('ios')
    expect(nativePlatform({ webkit: { messageHandlers: {} } })).toBe('web')
    expect(nativePlatform({ CapacitorCustomPlatform: { name: 'electron' }, androidBridge: {} })).toBe('electron')
    expect(isNativeShell({ androidBridge: {} })).toBe(true)
    expect(isIOSShell({ androidBridge: {} })).toBe(false)
    expect(isNativeShell()).toBe(false) // jsdom = 웹
  })

  it('② 부팅 경로는 Capacitor 를 정적으로 안 부른다', () => {
    const staticImport = /^\s*import\s[^;]*from\s+['"](@\/lib\/native|@capacitor\/[^'"]+)['"]/m
    for (const f of ['src/main.tsx', 'src/lib/version-check.ts', 'src/components/IosTopupGate.tsx']) {
      expect(read(f), f).not.toMatch(staticImport)
    }
    expect(read('src/main.tsx')).toMatch(/if \(isNativeShell\(\)\) import\('@\/lib\/native'\)/)
  })

  it('③ lib/native.ts 는 capacitor 청크로 — /src/lib/ catch-all 보다 먼저', () => {
    const v = read('vite.config.ts')
    const rule = v.indexOf("id.includes('/src/lib/native.ts')) return 'capacitor'")
    const catchAll = v.indexOf("id.includes('/src/lib/')) return 'app-utils'")
    expect(rule).toBeGreaterThan(0)
    expect(catchAll).toBeGreaterThan(rule)
  })
})
