/**
 * 🗺️ 서비스 지도가 **실제 코드보다 낡지 않게** 고정한다. (2026-08-03 신설)
 *
 * ## 왜 — 문서가 낡아서 대표에게 잘못 보고했다
 *
 * `docs/design/urdeal-platform-model.md` §1 은 오래 **3-서비스**(유어딜/도매몰/유어애즈)였고,
 * 도매몰을 여전히 *"제조사→판매사 B2B 도매"* 로만 적어 두었다. 그 사이 **공구 서비스**
 * (매장 업주가 자기 몰을 열고 픽업 공구를 파는 운영자 SaaS)가 **도매몰 코드를 용도 변경해**
 * 구현되기 시작했는데(2026-07-29 대표 사업설계), 지도에는 없었다.
 *
 * 결과: 2026-08-03 세션이 **공구 서비스의 오픈 차단 항목**(미수령 고지·브랜딩·실결제)을
 * **"유어딜 일"** 로 보고했다. 서로 다른 서비스의 할 일이 한 목록에 섞였고, 대표가 바로잡았다.
 *
 * ## 이 테스트가 막는 것
 *
 * **코드에는 있는데 지도에는 없는 서비스.** 라우트·테이블이 실재하면 지도에 그 서비스가 있어야 한다.
 * 지금은 공구 서비스(운영자 몰)를 앵커로 잡는다 — 그게 실제로 빠져 있던 것이기 때문이다.
 *
 * ⚠️ **못 막는 것**: 지도의 *설명이 틀린* 경우(문자열로 판정 불가). 그리고 앞으로 생길 **다른**
 * 서비스가 빠지는 것도 못 잡는다 — 새 서비스를 만들면 여기에 앵커를 한 줄 추가할 것.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')

const MAP = 'docs/design/urdeal-platform-model.md'
const RULES = 'CLAUDE.md'

/** 공구 서비스가 코드에 실재한다는 증거들. 하나라도 있으면 지도에 있어야 한다. */
const MALL_CODE_ANCHORS = [
  { path: 'src/pages/MallHomePage.tsx', what: '운영자 몰 소비자 홈' },
  { path: 'src/worker/utils/mall-consumer.ts', what: '몰 슬러그 라우팅 판정' },
]

/**
 * §1 "서비스 지도" 표의 **행들**을 파싱한다.
 *
 * ⚠️ 문서 전체에서 단어를 찾으면 안 된다 — 표 행을 지워도 **설명 문단이 그 단어를 대신 만족**시켜
 *    초록이 뜬다(2026-08-03 CI 의 `check-guard-mutations` 가 이 가드를 그렇게 잡았다.
 *    내 로컬 주입은 "그 단어가 든 줄 전부 삭제"라 더 셌고, 매니페스트 주입은 **행의 첫 칸만**
 *    바꾸는 것이라 통과했다 — 주입은 항상 **매니페스트 그대로** 돌려 볼 것).
 */
function serviceRows(map: string): Array<{ name: string; cells: string[] }> {
  const lines = map.split('\n')
  const from = lines.findIndex((l) => /^##\s*1\.\s*서비스 지도/.test(l))
  if (from < 0) return []
  const rows: Array<{ name: string; cells: string[] }> = []
  for (let i = from + 1; i < lines.length; i++) {
    const l = lines[i]
    if (/^##\s/.test(l)) break                       // 다음 섹션
    if (!l.startsWith('|')) continue
    const cells = l.split('|').slice(1, -1).map((c) => c.trim())
    if (cells.length < 5) continue                    // 헤더 구분선 등
    if (/^-+$/.test(cells[0])) continue
    if (cells[0] === '서비스') continue                // 헤더
    rows.push({ name: cells[0], cells })
  }
  return rows
}

describe('서비스 지도가 코드보다 낡지 않는다', () => {
  const map = read(MAP)
  const rows = serviceRows(map)

  it('지도 문서와 §1 표를 읽었다 (0 행이면 통과가 아니라 실패)', () => {
    expect(existsSync(MAP), `${MAP} 가 없다 — SSOT 경로가 바뀌었다`).toBe(true)
    expect(rows.length, '§1 서비스 표를 한 행도 못 읽었다 — 표 형식이 바뀌었다').toBeGreaterThanOrEqual(3)
  })

  it('공구 서비스가 코드에 실재한다 (이 테스트의 전제)', () => {
    const found = MALL_CODE_ANCHORS.filter((a) => existsSync(a.path))
    expect(found.length, '앵커가 전부 사라졌다면 이 테스트를 갱신할 것').toBeGreaterThan(0)
  })

  it('🔴 코드에 있는 공구 서비스가 §1 표의 한 행으로 있다', () => {
    // 이름 칸으로 판정한다 — 설명 문단이나 같은 행 뒷칸이 대신 만족시키지 못하게.
    const row = rows.find((r) => r.name.includes('공구 서비스'))
    expect(row, '§1 표에 공구 서비스 행이 없다 — 세션이 그 일을 "유어딜"로 오인한다').toBeTruthy()
    // 그 행이 실제 진입 경로를 담고 있어야 지도로서 쓸모가 있다.
    expect(row?.cells.join(' '), '공구 서비스 행에 몰 진입 경로가 없다').toContain('{몰슬러그}')
  })

  it('도매몰 행 자체에 "전환 중"이 적혀 있다', () => {
    // 문서 아무 데나가 아니라 **그 행**이어야 한다. 다음 세션은 표를 보고 판단하기 때문이다.
    const row = rows.find((r) => r.name.includes('도매몰'))
    expect(row, '§1 표에 도매몰 행이 없다').toBeTruthy()
    expect(row?.cells.join(' '), '도매몰이 순수 B2B 로 읽히면 공구 서비스 작업을 도매 레일로 민다')
      .toMatch(/전환 중|용도 변경/)
  })

  it('CLAUDE.md 분리 룰이 공구 서비스를 포함한다', () => {
    const rules = read(RULES)
    expect(rules).toContain('공구 서비스')
    // 3줄 보고의 (a) 레일 열거 — 거기가 실제로 세션이 읽는 자리다.
    const railLine = rules.split('\n').find((l) => l.includes('어느 레일을 만지는가')) || ''
    expect(railLine, '3줄 보고의 레일 열거에 공구 서비스가 없다').toContain('공구 서비스')
  })
})
