import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { normalizeKakaoPlaceUrl, kakaoPlaceId } from '@/shared/kakao-place-url'

/**
 * 🔒 2026-10-13 — `kakao_place_url` 을 **검증 없이 저장하던 세 자리**.
 *
 * ## 무엇이 잘못돼 있었나 (실측)
 * SSOT(`shared/kakao-place-url.ts`) 머리말은 그 파일의 목적을 *"그 외 도메인은 거부 →
 * RestaurantMiniMap 이 임의 URL 로 열리지 않게"* 라고 적어 뒀는데, 쓰기 경로 **셋**이 그 함수를
 * 거치지 않고 생 `String(b.kakao_place_url)` 로 저장하고 있었다:
 *
 * ```
 * seller-stores.routes.ts   매장 정보 저장      String(...)   ← 검증 0
 * seller-stores.routes.ts   매장 신규 등록      String(...)   ← 검증 0
 * agency-store-register.ts  대행사 매장 등록    String(...)   ← 검증 0
 * ```
 *
 * 받는 쪽(`store-profile.ts`)은 **300자 자르기만** 한다. 상세 응답은 읽을 때 정규화하므로
 * (`detail-meta-enrich.ts`) 오늘 미니맵이 임의 URL 을 열지는 않지만, **저장소에 쓰레기가 들어가는
 * 것**이고 다음 읽는 사람이 정규화를 빠뜨리는 날 그대로 샌다. 어드민 경로(3곳)는 처음부터
 * SSOT 를 지났다 — 즉 규칙이 없던 게 아니라 **세 자리가 규칙 밖**이었다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 런타임 동작(핸들러를 띄우지 않는다 — 배선이 SSOT 를 지나는지만 본다)
 * - 이미 저장된 과거 값(마이그레이션 없음. 읽을 때 정규화돼 표시는 안전하다)
 */
const SELLER = 'src/features/seller/api/seller-stores.routes.ts'
const AGENCY = 'src/features/agency-console/api/agency-store-register.ts'
const ADMIN = 'src/features/admin/api/admin-products.routes.ts'

describe('① 쓰기 경로가 전부 SSOT 를 지난다', () => {
  it.each([
    ['셀러 매장', SELLER, 2],
    ['에이전시 매장 등록', AGENCY, 1],
  ])('%s — normalizeKakaoPlaceUrl 경유', (_l, file, min) => {
    const c = readCode(file)
    expect((c.match(/normalizeKakaoPlaceUrl\(/g) || []).length,
      `${file} 의 검증 호출이 줄었다`).toBeGreaterThanOrEqual(min)
    // 🔴 생 `String(...)` 로 저장하는 자리가 남아 있으면 그 경로만 구멍이다.
    expect(c, `${file} 이 검증 없이 저장한다`).not.toMatch(/kakao_place_url:\s*(?:b|body)\.kakao_place_url\s*!=\s*null\s*\?\s*String\(/)
    expect(c, `${file} 이 검증 없이 저장한다(spread 형)`).not.toMatch(/kakao_place_url:\s*String\((?:b|body)\.kakao_place_url\)/)
  })

  it('어드민 경로는 처음부터 SSOT 를 지났다 — 그 상태가 유지된다', () => {
    expect((readCode(ADMIN).match(/normalizeKakaoPlaceUrl\(/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('② SSOT 가 실제로 걸러낸다 — 문자열 검사가 아니라 동작', () => {
  it.each([
    ['남의 호스트', 'https://evil.example.com/1'],
    ['호스트 접미 함정', 'https://place.map.kakao.com.evil.com/1'],
    ['스킴 장난', 'javascript:alert(1)'],
    ['프로토콜 상대', '//place.map.kakao.com/1'],
    ['빈 값', ''],
  ])('%s → null(저장 안 됨)', (_l, raw) => {
    expect(normalizeKakaoPlaceUrl(raw)).toBeNull()
  })

  it('유효한 카카오 링크는 정본으로 접혀 저장된다', () => {
    for (const raw of [
      'https://place.map.kakao.com/10256701',
      'http://place.map.kakao.com/10256701',
      'https://map.kakao.com/?itemId=10256701',
      'https://map.kakao.com/link/map/10256701',
    ]) expect(normalizeKakaoPlaceUrl(raw)).toBe('https://place.map.kakao.com/10256701')
  })

  it('id 를 못 뽑는 카카오 링크는 그대로 통과한다 — 접을 수 없는 것을 지어내지 않는다', () => {
    // `kko.to` 는 URL 안에 id 가 없다. 저장은 되지만(미니맵이 열 수 있는 정당한 링크다)
    // `sameAs` 는 안 나간다 — 그 둘은 다른 질문이다.
    expect(normalizeKakaoPlaceUrl('https://kko.to/AbC_123')).toBe('https://kko.to/AbC_123')
    expect(kakaoPlaceId('https://kko.to/AbC_123')).toBeNull()
  })
})
