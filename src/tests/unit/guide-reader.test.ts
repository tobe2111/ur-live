/**
 * 📖 운영 가이드를 **읽을 수 있는 문서**로 (2026-08-31 대표 "보기좋게 운영자료처럼 확인 가능한가?")
 *
 * ## 무엇이 문제였나
 * 섹션이 40개인데 **한 번에 하나만 열리는 아코디언**이었고, 검색도 목차도 없었다.
 * 뭘 찾으려면 접힌 줄을 하나씩 눌러 열어 보는 수밖에 없었다 — 그래서 아무도 안 읽었다.
 *
 * ## 이 테스트가 고정하는 것
 * 읽기 도구 셋(검색·목차·다중 열기)이 사라지지 않는 것. 셋 중 하나만 빠져도 다시 "못 읽는 문서"가 된다.
 *
 * ## 못 막는 것
 * 내용이 낡는 것 — 그건 `ops-handbook.test.ts` 와 생성기의 몫이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = readFileSync(resolve(__dirname, '../../..', 'src/components/guide/GuideViewer.tsx'), 'utf-8')

describe('운영 가이드 뷰어 — 읽기 도구', () => {
  it('여러 섹션을 동시에 열 수 있다', () => {
    // 단일 open(`expanded === key`)으로 되돌아가면 40개를 하나씩 눌러야 한다.
    expect(src).toMatch(/openKeys\s*,\s*setOpenKeys.*useState<Set<string>>/)
    expect(src, '단일 open 상태로 회귀했다').not.toMatch(/useState<string \| null>\(null\)[\s\S]{0,40}expanded/)
  })

  it('본문까지 검색한다 (제목만이 아니라)', () => {
    // "영입 2%" 처럼 값으로 찾는 게 실제 용례다 — 제목만 훑으면 못 찾는다.
    expect(src).toMatch(/section_title \+ ' ' \+ s\.content_md/)
  })

  it('목차가 있고, 누르면 그 섹션을 열고 이동한다', () => {
    expect(src).toContain('목차')
    expect(src).toMatch(/function jumpTo|const jumpTo/)
    expect(src, '목차가 열지 않고 스크롤만 하면 접힌 채로 도착한다').toMatch(/jumpTo[\s\S]{0,200}openKey\(/)
  })

  it('섹션마다 앵커가 있다 (링크로 특정 절을 지목할 수 있게)', () => {
    expect(src).toMatch(/id=\{`guide-\$\{s\.section_key\}`\}/)
  })
})
