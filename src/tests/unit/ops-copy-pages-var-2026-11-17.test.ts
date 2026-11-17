/**
 * 🔧 2026-11-17 — Pages 일반값 → cron 워커 복사 장치(대표 영구 위임의 첫 ops 워크플로).
 * 고정하는 것: 이름 형식 검증 · plain_text 만 옮김(secret_text 는 값을 못 읽으니 빈 값을 넣지 말고 실패) ·
 *   값을 로그에 안 찍음 · 삭제 명령 없음 · 입력은 env 로만(명령 주입 차단).
 * ⚠️ 못 보는 것: 실제 Cloudflare 응답 · wrangler 동작(라이브 실행 결과로만 판정).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// @ts-expect-error — .mjs 스크립트(타입 없음)
import { parseNames, pickPlainValues } from '../../../scripts/ops/copy-pages-var-to-worker.mjs'

const SCRIPT = readFileSync('scripts/ops/copy-pages-var-to-worker.mjs', 'utf8')
const WF = readFileSync('.github/workflows/ops-copy-pages-var.yml', 'utf8')

describe('ops: Pages 설정 → 워커 복사', () => {
  it('이름은 대문자·숫자·밑줄만, 중복 제거', () => {
    expect(parseNames('NCP_A, NCP_A,NCP_B')).toEqual(['NCP_A', 'NCP_B'])
    expect(() => parseNames('ncp_a')).toThrow()
    expect(() => parseNames('A;rm -rf /')).toThrow()
    expect(() => parseNames('')).toThrow()
  })
  it('plain_text 만 옮기고, secret_text·없는 이름은 실패한다(빈 값을 넣지 않는다)', () => {
    const env = { A: { type: 'plain_text', value: 'x' }, S: { type: 'secret_text' } }
    expect(pickPlainValues(env, ['A'])).toEqual({ A: 'x' })
    expect(() => pickPlainValues(env, ['S'])).toThrow(/읽을 수 없다/)
    expect(() => pickPlainValues(env, ['Z'])).toThrow(/없다/)
  })
  it('값을 로그에 찍지 않는다 — 이름과 길이만', () => {
    expect(SCRIPT).not.toMatch(/console\.(log|error)\([^)]*values\[n\]\)/)
    expect(SCRIPT).toMatch(/길이 \$\{values\[n\]\.length\}/)
  })
  it('지우는 명령이 없다(추가·갱신만)', () => {
    expect(SCRIPT).not.toMatch(/secret['"], ?['"]delete|method: ?['"]DELETE/)
  })
  it('워크플로 입력은 env 로만 넘긴다(run 에 직접 끼우지 않는다)', () => {
    expect(WF).toMatch(/NAMES: \$\{\{ inputs\.names \}\}/)
    expect(WF).not.toMatch(/run:.*\$\{\{ inputs\./)
  })
})
