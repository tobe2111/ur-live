/**
 * 🛡️ **결제 복구 새로고침이 예산을 지키는가** — 2026-09-13
 *
 * 대표 *"결제의 다른 부분이 문제가 있는 건 없어?"* 로 결제 경로를 훑다가 라이브 로그에서 찾았다:
 * `/group-buy/confirm-payment` 가 **51초에 31번** 다시 로드됐다(frontend_errors 의 boot-stuck 비콘,
 * 서로 다른 문서 31개). 설계는 *"5분 내 8회 + 지수 백오프"* 인데 그 상한이 안 먹혔다.
 *
 * 원인: 카운터가 `reloadOnce` **안에** 있어서, 복구 오버레이의 30초 자동 재시도가
 * `bustReload()` 를 **직접** 불러 예산을 통째로 우회했다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * 실제 브라우저에서 몇 번 도는지는 못 잰다(정적 검사다). 51초에 31번이 **왜** 났는지도 모른다 —
 * 엔트리가 실행조차 안 됐는데(entryRan=n) 청크는 전부 200이고 nonce 도 정상이었다.
 * 여기서 고정하는 것은 **"자동 재시도가 예산을 지나간다"** 하나다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const html = readFileSync('index.html', 'utf8')
/** 부트가드(첫 인라인 script) 본문만 — 주석 제거 후 */
const guard = (() => {
  const m = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)
  const body = m ? m[1] : ''
  return body.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
})()

describe('🔁 재시도 예산', () => {
  it('예산이 함수 하나로 있다 (두 경로가 같은 카운터를 쓰려면 필요)', () => {
    expect(guard).toMatch(/function takeReloadBudget\(\)/)
  })

  it('🔴 자동 재시도가 예산을 지나간다 — 직접 bustReload 호출 금지', () => {
    // 종전: setTimeout(bustReload, 30000)  ← 카운터 우회
    expect(guard).not.toMatch(/setTimeout\(\s*bustReload\s*,\s*30000\s*\)/)
    expect(guard).toMatch(/setTimeout\(function \(\) \{ if \(takeReloadBudget\(\)\) bustReload\(\); \}, 30000\)/)
  })

  it('🔴 reloadOnce 도 같은 함수를 쓴다 — 카운터가 둘이면 상한이 두 배가 된다', () => {
    expect(guard).toMatch(/function reloadOnce\(\)[\s\S]{0,400}?takeReloadBudget\(\)/)
  })

  it('상한과 창은 그대로다 (5분 · 8회)', () => {
    // ⚠️ `/st\.n >= 8/` 로 쓰면 `>= 800` 에도 매치돼 **늘 통과한다**(주입이 잡았다).
    //    숫자가 계약이므로 닫는 괄호까지 앵커로 잡는다.
    expect(guard).toMatch(/st\.n >= 8\)/)
    expect(guard).toMatch(/now - st\.t < 300000\b/)
  })

  it('sessionStorage 가 막혀도 결제를 막지 않는다 (예외 시 1 = 통과)', () => {
    expect(guard).toMatch(/function takeReloadBudget\(\)[\s\S]*?catch \(e\) \{ return 1; \}/)
  })

  it('수동 완전복구는 여전히 예산을 무시한다 (사용자가 누른 버튼은 막지 않는다)', () => {
    expect(guard).toMatch(/function hardRecover\(\)[\s\S]{0,200}?removeItem\('__ur_chunk_reload__'\)/)
  })

  it('예산 키·포맷이 chunk-error.ts 미러와 같다', () => {
    const mirror = readFileSync('src/utils/chunk-error.ts', 'utf8')
    for (const token of ["'__ur_chunk_reload__'", 'st.n >= 8']) expect(mirror).toContain(token)
    expect(mirror).toMatch(/300_000/)
  })
})
