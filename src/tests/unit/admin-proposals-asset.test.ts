/**
 * 🛡️ 대외 제안서(어드민 `/admin/proposals`)가 **정적 자산**으로 남아 있는지.
 *
 * 사고 경위: 처음엔 `docs/business/proposals/*.html` 을 `?raw` 로 import 했다.
 * 그 뒤 제안서에 라이브 화면 캡처를 base64 로 심자 문자열이 그대로 JS 청크가 되어
 * `AdminProposalsPage` 청크가 **254KB** 로 불었고, `check-bundle-size --budget`
 * (총 raw JS 8.6MB)이 CI 를 빨간불로 세웠다. 이미지가 더 붙으면 같은 일이 반복된다.
 *
 * 이 테스트가 막는 것:
 *  R1 `?raw` 로 되돌아가기 (번들 폭증의 직접 원인)
 *  R2 참조 URL 과 실제 파일의 어긋남 (배포 후에야 빈 iframe 으로 드러난다)
 *  R3 `/static/` 밖으로 옮기기 — `_routes.json` 이 그 접두사만 워커에서 제외하므로
 *     다른 경로면 워커가 SPA 셸을 돌려주고 미리보기가 통째로 깨진다
 *
 * 못 막는 것: 파일 내용이 최신인지, 인쇄 결과가 16:9 로 나오는지. 그건 배포 후 눈으로.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../..')
const PAGE = resolve(ROOT, 'src/pages/admin/AdminProposalsPage.tsx')

function proposalUrls(source: string): string[] {
  return [...source.matchAll(/url:\s*'([^']+)'/g)].map(m => m[1])
}

describe('대외 제안서는 정적 자산으로 서빙된다', () => {
  const source = readFileSync(PAGE, 'utf8')
  const urls = proposalUrls(source)

  it('참조하는 제안서가 최소 1개는 있다 (0개면 아래 검사가 전부 헛돈다)', () => {
    expect(urls.length).toBeGreaterThan(0)
  })

  it('R1 제안서를 `?raw` 로 번들에 넣지 않는다', () => {
    expect(source).not.toMatch(/proposal[^'"\n]*\.html\?raw/)
  })

  it.each(urls)('R2 %s 가 public/ 아래 실제로 존재한다', url => {
    expect(existsSync(resolve(ROOT, 'public', url.replace(/^\//, '')))).toBe(true)
  })

  it.each(urls)('R3 %s 는 워커 제외 접두사(/static/) 아래에 있다', url => {
    expect(url.startsWith('/static/')).toBe(true)
  })

  it('R3 `_routes.json` 이 실제로 /static/* 를 워커에서 제외한다', () => {
    const routes = JSON.parse(readFileSync(resolve(ROOT, 'public/_routes.json'), 'utf8'))
    expect(routes.exclude).toContain('/static/*')
  })
})
