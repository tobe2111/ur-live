/**
 * 🔎📝 어드민에서 쇼츠 넣기 — 대표가 실제로 써 보고 신고한 두 가지 (2026-09-08)
 *
 * 1. *"이용권 ID 입력 말고 다른 방법 없을까? ID 하나하나 다 모르는데."*
 * 2. *"그리고 채널 정보, 영상 제목 이런거 자동으로 못가져오나?"*
 *
 * 둘 다 **화면에 에러가 안 나는 종류의 결함**이라 가드가 없으면 조용히 되돌아간다:
 * 숫자 입력은 틀린 번호를 넣어도 아무 일이 안 일어나고(엉뚱한 이용권에 붙는다),
 * 제목이 비면 그냥 "채널 미상"으로 보일 뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const R = readCode('src/features/urshorts/api/urshorts.routes.ts')
const PAGE = readCode('src/pages/AdminUrShortsPage.tsx')
const PICK = readCode('src/pages/admin-urshorts/ProductPicker.tsx')

describe('① 이용권은 골라서 연결한다 — 번호를 외우게 하지 않는다', () => {
  it('상품 ID 숫자 입력이 사라졌다', () => {
    expect(PAGE, 'ID 숫자 입력이 되살아났다').not.toMatch(/placeholder="상품 ID"/)
    expect(PAGE).not.toMatch(/type="number"[^>]*product_id/)
  })

  it('고르는 컴포넌트가 배선돼 있다', () => {
    // 파일만 있고 안 쓰면 화면은 그대로다 — 렌더를 확인한다.
    expect(PAGE).toMatch(/<ProductPicker/)
    expect(PAGE).toMatch(/onPick=\{/)
  })

  it('검색이 매장명까지 훑는 기존 어드민 API 를 쓴다 (새 API 를 안 만든다)', () => {
    // `/api/admin/products?q=` 는 name·description·restaurant_name 을 함께 훑는다.
    // 이용권은 이름이 서로 비슷해서(버섯 샤브 2인 류) 매장명이 사실상 식별자다.
    expect(PICK).toMatch(/\/api\/admin\/products\?/)
    expect(PICK).toMatch(/[?&]q=\$\{encodeURIComponent/)
  })

  it('🔒 꺼진 상품은 후보에 안 넣는다 — 붙여도 홈에 영영 안 나온다', () => {
    // 공개 쿼리가 p.is_active = 1 로 거르므로, 꺼진 상품에 연결하면 조용히 안 보인다.
    expect(PICK).toMatch(/status=active/)
  })

  it('🔒 타이핑마다 부르지 않는다 (D1 읽기는 계정 단위 한도다)', () => {
    expect(PICK).toMatch(/setTimeout\(/)
    expect(PICK).toMatch(/clearTimeout\(/)
  })

  it('고를 때 매장명·가격을 함께 보여 준다 (이름만으로는 못 고른다)', () => {
    expect(PICK).toMatch(/h\.restaurant_name/)
    expect(PICK).toMatch(/formatNumber\(h\.price\)/)
  })
})

describe('② 제목·채널을 유튜브에서 자동으로 가져온다', () => {
  it('🔒 videos.list 에 snippet 을 얹는다 — 파트를 늘려도 1 unit 이라 공짜다', () => {
    expect(R).toMatch(/part=contentDetails,snippet/)
    // search 는 100 unit 이고 그 쿼터는 유어애즈가 이미 다 쓴다 — 여기서 쓰면 안 된다.
    expect(R, 'search 를 쓰면 쿼터가 100배다').not.toMatch(/youtube\/v3\/search/)
  })

  it('제목·채널을 실제로 읽어 온다', () => {
    expect(R).toMatch(/snippet\?\.title/)
    expect(R).toMatch(/snippet\?\.channelTitle/)
  })

  it('🔒 사람이 적은 값이 유튜브 값을 이긴다 (고쳐 쓴 제목을 덮지 않는다)', () => {
    expect(R).toMatch(/\(body\?\.title \?\? ''\)\.slice\(0, 200\) \|\| verdict\.title/)
    expect(R).toMatch(/\(body\?\.channel \?\? ''\)\.slice\(0, 100\) \|\| verdict\.channel/)
  })

  it('🔒 쇼츠 주소는 메타 조회가 실패해도 저장된다 (fail-soft)', () => {
    // 이전 동작: 키 없이도 /shorts/ 는 추가할 수 있었다. 그게 안 깨져야 한다.
    const fn = R.slice(R.indexOf('async function verifyIsShort'), R.indexOf('adminUrshortsRoutes.post'))
    expect(fn).toMatch(/if \(form === 'shorts'\)/)
    expect(fn, '쇼츠인데 메타 실패로 거부한다').toMatch(/ok: true, duration: null, title: null, channel: null/)
  })

  it('🔒 watch?v= 는 길이를 모르면 통과시키지 않는다 (쇼츠 판정은 그대로)', () => {
    const fn = R.slice(R.indexOf('async function verifyIsShort'), R.indexOf('adminUrshortsRoutes.post'))
    expect(fn).toMatch(/if \(!meta\.ok\)/)
    expect(fn).toMatch(/meta\.duration > URSHORTS_MAX_DURATION_SEC/)
    expect(fn).toMatch(/if \(meta\.duration == null\) return \{ ok: false/)
  })

  it('이 기능 전에 넣은 영상도 채울 수 있다 (다시 가져오기)', () => {
    expect(R).toMatch(/adminUrshortsRoutes\.post\('\/:id\/refresh-meta'/)
    // 이미 채워진 칸은 안 덮는다.
    expect(R).toMatch(/row\.title \|\| meta\.title/)
    expect(R).toMatch(/row\.channel \|\| meta\.channel/)
    expect(PAGE).toMatch(/refresh-meta/)
  })

  it('🔒 다시 가져오기도 어드민 전용이다', () => {
    const at = R.indexOf("adminUrshortsRoutes.post('/:id/refresh-meta'")
    expect(at).toBeGreaterThan(0)
    expect(R.slice(at, at + 120)).toMatch(/requireAdmin\(\)/)
  })
})
