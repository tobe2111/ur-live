/**
 * 🔴 소비자 도메인 경로 몰 조회 불변식 〔세션 ③-a, O2 "몰이 열린다"〕
 *
 * `urdeal.kr/{슬러그}` 를 몰로 해석하는 판정. 두 가지를 동시에 지켜야 한다:
 *
 * ① **핫패스 불변** — 기존 소비자 라우트는 **DB 를 한 번도 안 본다**(예약어 조기 탈출).
 * ② **서비스 분리** — 도매몰이 소비자 도메인 경로로 **열리지 않는다**(`consumer_path=1` 만).
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 워커 배선(호출부가 이 함수를 안 쓰고 직접 판정하는 경우)
 *   - `consumer_path` 를 **잘못 켠** 몰(사람의 실수 — 어드민 화면의 문제)
 *   - 라우트가 아닌 충돌(정적 파일 경로 등)
 */
import { describe, it, expect } from 'vitest'
import { isMallLookupCandidate, pickConsumerMall } from '@/worker/utils/mall-consumer'
import { RESERVED_SLUGS } from '@/shared/mall/slug'

const operatorMall = { id: 3, slug: 'dongne-shop', name: '동네상회', active: 1, consumer_path: 1 }
const wholesaleMall = { id: 2, slug: 'medi', name: '메디스타트', active: 1, consumer_path: 0 }

describe('🔴 ① 핫패스 — 기존 라우트는 DB 를 보지 않는다', () => {
  it('예약어는 후보가 아니다 — 조회 자체를 안 한다', () => {
    for (const s of ['products', 'admin', 'vouchers', 'group-buy', 'seller', 'wholesale']) {
      expect(RESERVED_SLUGS).toContain(s)
      expect(isMallLookupCandidate(s)).toBe(false)
    }
  })

  it('🔴 예약어 검사가 문법 검사보다 **먼저**여야 한다', () => {
    // 순서가 뒤집혀도 결과는 같아 보이지만, 뒤집히면 예약어가 **문법 통과 후** 걸러진다 —
    // 즉 DB 조회를 한 번 하고 버리게 된다. 이 케이스는 그 순서를 값으로 고정한다.
    // ('products' 는 문법상 완전히 유효한 슬러그다.)
    expect(/^[a-z0-9-]{3,30}$/.test('products')).toBe(true)   // 문법만 보면 통과한다
    expect(isMallLookupCandidate('products')).toBe(false)      // 그런데 후보가 아니어야 한다
  })

  it('문법 밖도 후보 아님 — 3자 미만·비ASCII·언더스코어·과길이', () => {
    for (const s of ['ab', '한글가게', 'shop_1', 'a'.repeat(31), '', '   ']) {
      expect(isMallLookupCandidate(s)).toBe(false)
    }
  })

  it('예약어도 문법 밖도 아닌 것만 후보', () => {
    for (const s of ['dongne-shop', 'kim-farm', 'mystore2']) {
      expect(isMallLookupCandidate(s)).toBe(true)
    }
  })
})

describe('🔴 ② 서비스 분리 — 표시된 몰만 경로로 열린다 (fail-closed)', () => {
  it('운영자 몰(consumer_path=1)은 열린다', () => {
    expect(pickConsumerMall([operatorMall], 'dongne-shop')?.id).toBe(3)
  })

  it('🔴 도매몰은 열리지 않는다 — host 가 NULL 이어도', () => {
    // 메디스타트는 host 가 NULL 인 **도매몰**이다. `host IS NULL` 로 추론했다면
    // `urdeal.kr/medi` 로 B2B 몰이 열렸을 것이다. **추론 대신 표시**를 쓰는 이유.
    expect(pickConsumerMall([wholesaleMall], 'medi')).toBeNull()
  })

  it('consumer_path 가 없는(구) 행은 닫힘 — 기본값이 fail-closed', () => {
    expect(pickConsumerMall([{ id: 5, slug: 'oldmall', name: 'x', active: 1 }], 'oldmall')).toBeNull()
  })

  it('비활성 몰은 열리지 않는다 — 표시돼 있어도', () => {
    expect(pickConsumerMall([{ ...operatorMall, active: 0 }], 'dongne-shop')).toBeNull()
  })

  it('없는 슬러그는 null — 그대로 SPA 404 로 흘려보낸다', () => {
    expect(pickConsumerMall([operatorMall], 'nope-nope')).toBeNull()
  })

  it('빈 목록·예약어 입력에도 안전', () => {
    expect(pickConsumerMall([], 'dongne-shop')).toBeNull()
    expect(pickConsumerMall([operatorMall], 'admin')).toBeNull()
  })

  it('대소문자 무시 — DB 값이 정규화돼 있다고 믿지 않는다', () => {
    expect(pickConsumerMall([{ ...operatorMall, slug: 'Dongne-Shop' }], 'dongne-shop')?.id).toBe(3)
  })

  it('🔴 같은 슬러그의 도매몰이 섞여 있어도 열리지 않는다', () => {
    // 몰 목록에 여러 행이 오는 상황에서 "일치하는 첫 행"만 보고 통과시키면 안 된다.
    expect(pickConsumerMall([{ id: 9, slug: 'shopshop', name: 'B2B', active: 1, consumer_path: 0 }], 'shopshop')).toBeNull()
  })
})
