/**
 * 🩸 2026-11-01 — main.yml 의 클라이언트 총 용량 게이트(50MB)가 다음 스텝에서 지워질 소스맵(.map, ~19MB)까지
 *   세어 #2053 부터 배포가 6회 연속 실패했다(실제 배포분은 ~34MB). 게이트는 **배포되는 파일만** 세야 한다.
 * ⚠️ 못 보는 것: 실제 용량(빌드가 필요하다) · 맵 삭제 스텝을 게이트 앞으로 옮기는 경우(그때도 통과 — 그것도 맞다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const yml = readFileSync('.github/workflows/main.yml', 'utf8')

describe('배포 용량 게이트는 소스맵을 세지 않는다', () => {
  it('CLIENT_TOTAL 측정이 .map 을 제외한다', () => {
    const line = yml.split('\n').find((l) => /^\s*CLIENT_TOTAL=/.test(l))
    expect(line, 'CLIENT_TOTAL 측정 줄이 없다').toBeTruthy()
    expect(line).toMatch(/!\s*-name\s+'\*\.map'/)
    expect(line).not.toMatch(/du -sb dist\/client/)
  })
  it('기준값 50MB 는 그대로다(느슨하게 만들지 않았다)', () => {
    expect(yml).toMatch(/test \$CLIENT_TOTAL -lt 52428800/)
  })
})
