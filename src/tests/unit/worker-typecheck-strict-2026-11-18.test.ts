/**
 * 🧩 2026-11-18 서버(워커) 타입 검사를 막는 단계로 — 오류 348건이 `continue-on-error` 뒤에 쌓여 있었다.
 *
 * 지키는 것:
 *  1. verify.yml 의 `Type check (worker)` 가 다시 경고만으로 돌아가지 않는다.
 *  2. 워커 전용 전역 선언은 `src/` 밖에 있다(안에 두면 브라우저 검사가 DOM `window` 와 겹쳐 깨진다).
 *  3. 워커 첫 화면이 React 훅·아이콘(.tsx) 파일 대신 순수 모듈에서 값을 읽는다(워커 번들에 아이콘이 딸려 오지 않게).
 * 못 막는 것: 실제 타입 오류 0 자체 — 그건 CI 의 그 단계가 판정한다(이 시험은 그 단계가 살아 있는지만 본다).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

describe('워커 타입 검사 strict', () => {
  it('verify.yml 단계가 실패를 삼키지 않는다', () => {
    const wf = fs.readFileSync('.github/workflows/verify.yml', 'utf8')
    const i = wf.indexOf('- name: Type check (worker)')
    expect(i).toBeGreaterThan(0)
    const step = wf.slice(i, wf.indexOf('- name:', i + 10))
    expect(step).toMatch(/tsc --noEmit --skipLibCheck --project tsconfig\.worker\.json/)
    expect(step).not.toMatch(/continue-on-error:\s*true/)
  })
  it('워커 전역 선언은 src 밖에 있고 워커 설정만 읽는다', () => {
    const cfg = JSON.parse(fs.readFileSync('tsconfig.worker.json', 'utf8'))
    expect(cfg.include).toContain('types-worker/**/*')
    expect(fs.existsSync('types-worker/runtime-globals.d.ts')).toBe(true)
    expect(fs.existsSync('src/worker/types/runtime-globals.d.ts')).toBe(false)
  })
  it('워커 첫 화면은 순수 모듈에서 읽는다', () => {
    const s = fs.readFileSync('src/worker/utils/map-first-screen.ts', 'utf8')
    expect(s).toMatch(/from '\.\.\/\.\.\/pages\/restaurant-map\/voucher-labels'/)
    expect(s).toMatch(/from '\.\.\/\.\.\/pages\/restaurant-map\/sheet-geometry'/)
    expect(s).not.toMatch(/voucher-types'|useSheetDrag'/)
    expect(fs.readFileSync('src/pages/restaurant-map/voucher-labels.ts', 'utf8')).not.toMatch(/^import /m)
  })
})
