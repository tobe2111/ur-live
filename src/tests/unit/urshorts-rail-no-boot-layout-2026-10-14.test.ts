/**
 * 🧮 유어쇼츠 레일이 홈 부팅 중에 레이아웃을 강제로 읽지 않는다 (2026-10-14 대표 *"대기업급으로 … 로딩 속도 개선을 계속"*).
 *
 * 왜: 좌우 화살표 표시 여부를 재려고 `scrollWidth`·`clientWidth` 를 effect 에서 읽었다. 그 읽기는 그 순간까지 쌓인
 *   DOM 변경을 전부 레이아웃하게 만들고(강제 동기 레이아웃), 홈 부팅 CPU 프로파일(×4)에서 **앱 함수 중 최대 76ms** 였다.
 *   화살표는 마우스를 올렸을 때만 보이므로 그때(`onPointerEnter`)와 스크롤 때만 재면 된다 — 폰은 한 번도 안 잰다.
 * ⚠️ 못 막는 것: 다른 컴포넌트의 같은 패턴(마운트 effect 에서 레이아웃 읽기) — 프로파일(`visual-preview --cpu-profile`)로 찾는다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const SRC = stripComments(readFileSync('src/components/home/UrShortsRail.tsx', 'utf8'))

describe('유어쇼츠 레일 — 목록이 오기 전에 자리를 잡는다(홈 CLS)', () => {
  // 실측(2026-10-14, 하네스 --cls): 예약 전 모바일 0.576 · PC 0.518 → 예약 후 0.103 · 0.034
  //   (남은 0.103 은 하네스에 섹션 스텁이 없어 섹션 스켈레톤이 접히는 것 — 라이브는 시드가 있다).
  it('대기 중엔 빈 div 가 아니라 같은 패널을 카드 크기 자리표시자로 세운다', () => {
    expect(SRC).toMatch(/const waiting = items\.length === 0 && reserve && !settled/)
    expect(SRC).toMatch(/if \(items\.length === 0 && !waiting\) return <div ref=\{setWrapEl\}/)
    expect(SRC).toMatch(/waiting && Array\.from\(\{ length: 4 \}[\s\S]{0,200}style=\{\{ width: URSHORTS_CARD_W, height: URSHORTS_CARD_H \}\}/)
  })
  it('영상이 0 이었던 기억이 있으면 예약하지 않는다(대표 확정 "없으면 섹션 자체를 안 보인다")', () => {
    expect(SRC).toMatch(/useState\(\(\) => readRailHint\(\) !== 0\)/)
    expect(SRC).toMatch(/setItems\(r\.data\); writeRailHint\(r\.data\.length\)/)
  })
  it('실패해도 예약을 거둔다(영원히 빈 패널 금지)', () => {
    expect(SRC).toMatch(/\.catch\(\(\) => \{ if \(alive\) setSettled\(true\)/)
  })
})

describe('유어쇼츠 레일 — 부팅 중 레이아웃 읽기 없음', () => {
  it('측정 함수를 마운트/목록 effect 에서 부르지 않는다', () => {
    expect(SRC).toMatch(/const sync = useMemo/)
    expect(SRC).not.toMatch(/useEffect\(\(\)\s*=>\s*\{\s*sync\(\)/)
  })
  it('마우스를 올릴 때와 스크롤할 때 잰다(화살표가 보이는 순간)', () => {
    expect(SRC).toMatch(/className="group relative" onPointerEnter=\{sync\}/)
    expect(SRC).toMatch(/onScroll=\{sync\}/)
  })
})
