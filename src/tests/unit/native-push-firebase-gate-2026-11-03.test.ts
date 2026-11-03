/**
 * 🩸 2026-11-03 — 첫 내부 테스트 안드로이드 앱이 켜자마자 1초 만에 꺼졌다.
 *
 * Firebase 설정 파일(google-services.json) 없이 빌드한 앱에서 웹 코드가 `PushNotifications.register()` 를
 * 불러 네이티브가 죽었다(FirebaseApp 미초기화). JS try/catch 로는 못 잡는다.
 * 처방: 빌드 시점에 설정 파일이 있으면 User-Agent 에 표식(`UrDealPush`)을 붙이고, 웹은 표식이 있을 때만 푸시를 켠다.
 *
 * 이 시험이 지키는 것:
 *  ① native.ts 의 register() 호출이 표식 검사 안에 있다
 *  ② 표식 판정 함수가 표식 유무로 갈린다
 *  ③ capacitor.config.ts 가 같은 표식 이름을 쓰고, **설정 파일이 있을 때만** 붙인다(android·ios 둘 다)
 *
 * ⚠️ 못 막는 것: 실제 기기에서의 크래시(그건 실기기로만 보인다) · Firebase 외의 다른 네이티브 크래시.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { NATIVE_PUSH_UA_MARK, isNativePushReady } from '@/lib/native'

const native = readFileSync('src/lib/native.ts', 'utf8')
const capConfig = readFileSync('capacitor.config.ts', 'utf8')

describe('네이티브 푸시는 Firebase 가 든 앱 빌드에서만 켠다 (2026-11-03 시작 크래시)', () => {
  it('① register() 호출이 isNativePushReady() 검사 뒤에 있다', () => {
    const gate = native.indexOf('if (isNativePushReady())')
    const register = native.indexOf('await PushNotifications.register()')
    expect(gate).toBeGreaterThan(-1)
    expect(register).toBeGreaterThan(gate)
    // 검사와 register 사이에 다른 단계(4. 뒤로가기)가 끼면 검사 범위 밖이다
    expect(native.slice(gate, register)).not.toContain('// 4.')
  })

  it('② 표식이 없으면 끈다 · 있으면 켠다', () => {
    expect(isNativePushReady('Mozilla/5.0 (Linux; Android 14; wv) UrDealApp')).toBe(false)
    expect(isNativePushReady('')).toBe(false)
    expect(isNativePushReady(`Mozilla/5.0 (Linux; Android 14; wv) UrDealApp ${NATIVE_PUSH_UA_MARK}`)).toBe(true)
  })

  it('③ capacitor.config.ts 가 같은 표식을, 설정 파일이 있을 때만 붙인다', () => {
    expect(capConfig).toContain(`const NATIVE_PUSH_UA_MARK = '${NATIVE_PUSH_UA_MARK}'`)
    expect(capConfig).toMatch(/existsSync\('android\/app\/google-services\.json'\)/)
    expect(capConfig).toMatch(/existsSync\('ios\/App\/App\/GoogleService-Info\.plist'\)/)
    expect(capConfig).toMatch(/appendUserAgent:\s*appUserAgent\(ANDROID_PUSH_READY\)/)
    expect(capConfig).toMatch(/appendUserAgent:\s*appUserAgent\(IOS_PUSH_READY\)/)
    expect(capConfig).toMatch(/pushReady \? `UrDealApp \$\{NATIVE_PUSH_UA_MARK\}` : 'UrDealApp'/)
  })
})
