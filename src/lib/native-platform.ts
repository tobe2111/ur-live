/**
 * 📱 네이티브 앱 껍데기인가 — **Capacitor 를 불러오지 않고** 판정한다 (2026-10-12, 대표 "대기업급 속도").
 *
 * `@capacitor/core` 는 웹 방문자에겐 쓸 일이 없는데 `main.tsx` 가 정적으로 불러 첫 부팅 코드에 실려 왔다
 * (capacitor 청크 — 모든 첫 방문이 받았다). 판정만 필요한 자리는 이 파일을 쓰고, 실제 네이티브 기능은
 * 앱 안에서만 `import('@/lib/native')` 로 받는다.
 *
 * ⚠️ 판정 규칙은 `@capacitor/core` 의 `getPlatformId` / `CapacitorCustomPlatform` 과 **같아야 한다**
 *    (8.5.2 기준 — 테스트가 그 소스를 읽어 대조한다). 갈리면 앱에서 네이티브 기능이 조용히 꺼진다.
 */
export type NativePlatform = 'ios' | 'android' | 'web' | string

export function nativePlatform(win: unknown = typeof window === 'undefined' ? undefined : window): NativePlatform {
  const w = win as { CapacitorCustomPlatform?: { name: string } | null; androidBridge?: unknown; webkit?: { messageHandlers?: { bridge?: unknown } } } | undefined
  if (!w) return 'web'
  if (w.CapacitorCustomPlatform) return w.CapacitorCustomPlatform.name
  if (w.androidBridge) return 'android'
  if (w.webkit?.messageHandlers?.bridge) return 'ios'
  return 'web'
}

export const isNativeShell = (win?: unknown): boolean => nativePlatform(win) !== 'web'
export const isIOSShell = (win?: unknown): boolean => nativePlatform(win) === 'ios'
