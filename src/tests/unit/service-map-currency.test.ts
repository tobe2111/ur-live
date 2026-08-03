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

describe('서비스 지도가 코드보다 낡지 않는다', () => {
  it('지도 문서가 존재한다 (경로가 낡으면 통과가 아니라 실패)', () => {
    expect(existsSync(MAP), `${MAP} 가 없다 — SSOT 경로가 바뀌었다`).toBe(true)
    expect(read(MAP).length).toBeGreaterThan(1000)
  })

  it('공구 서비스가 코드에 실재한다 (이 테스트의 전제)', () => {
    const found = MALL_CODE_ANCHORS.filter((a) => existsSync(a.path))
    expect(found.length, '앵커가 전부 사라졌다면 이 테스트를 갱신할 것').toBeGreaterThan(0)
  })

  it('🔴 코드에 있는 공구 서비스가 지도에도 있다', () => {
    const map = read(MAP)
    // 서비스 지도(§1 표)에 운영자 SaaS 축이 한 줄로 존재해야 한다.
    expect(map, '공구 서비스가 지도에 없다 — 세션이 그 일을 "유어딜"로 오인한다')
      .toMatch(/공구 서비스/)
    expect(map, '몰 진입 경로가 지도에 없다').toContain('{몰슬러그}')
  })

  it('도매몰이 "전환 중"임이 지도에 적혀 있다', () => {
    // 이게 없으면 다음 세션이 도매몰을 여전히 순수 B2B 로 읽고, 공구 서비스 작업을 도매 레일로 민다.
    expect(read(MAP)).toMatch(/전환 중|용도 변경/)
  })

  it('CLAUDE.md 분리 룰이 공구 서비스를 포함한다', () => {
    const rules = read(RULES)
    // "두 서비스" 로 되돌아가면 3번째 축이 다시 사라진다.
    expect(rules).toContain('공구 서비스')
    // 3줄 보고의 (a) 레일 열거에도 있어야 한다 — 거기가 실제로 세션이 읽는 자리다.
    const railLine = rules.split('\n').find((l) => l.includes('어느 레일을 만지는가')) || ''
    expect(railLine, '3줄 보고의 레일 열거에 공구 서비스가 없다').toContain('공구 서비스')
  })
})
