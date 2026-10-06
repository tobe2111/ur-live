/**
 * ⚡ **첫 화면이 같은 것을 두 번 받지 않는다** (2026-10-06)
 *
 * 대표: *"마이 페이지에 로딩 속도? … 내 가게 이 부분이 가장 늦게 떠."* 에 이어
 *       *"근본적인 문제를 모두 해결해줘. **다른 페이지들도 그런 경우가 많아.**"*
 *
 * 전수로 재 보니 네 자리가 같은 병이었다. 전부 **에러가 안 난다** — 빌드도 테스트도 초록이고
 * 화면도 안 깨진다. 느릴 뿐이라 그 순간을 재 본 사람만 안다.
 *
 * | 화면 | 무엇이 | 전 → 후 |
 * |---|---|---|
 * | 홈 | `/api/banners` 를 자리마다 | **3회 → 1회** (게다가 셋 다 cron 예열 키와 달라 예열을 못 받고 있었다) |
 * | 교환권 | 카테고리 자동선택이 첫 응답을 버리고 재요청 | **2회 → 1회** (SSR 시드·예열도 같이 버려지고 있었다) |
 * | 마이 | `판매 중 N개` 한 줄 때문에 상품 목록 전체를, 좌석 확정 **뒤에** | **2단 → 1단** |
 * | 전 화면 | CSRF 토큰을 변경 요청마다 각자 | 지도 **6회 → 1회** |
 *
 * ## 이 파일이 지키는 것 / 못 지키는 것
 * 여기 있는 것은 **배선 불변식**이다(소스에 그 모양이 남아 있는가).
 * *실제로 몇 번 나가는가* 는 브라우저로만 알 수 있고 `scripts/check-duplicate-fetch.mjs` 가 잰다.
 * 🩸 그 둘이 **따로 필요한 이유**를 이번에 값을 치르고 배웠다 — CSRF 단일비행을 넣었는데
 *   소스엔 멀쩡히 보이는데도 **6회 그대로**였다. 번들을 뜯어 보니 `let csrfInFlight` 가
 *   인터셉터 콜백 **안**에 들어가 요청마다 새로 만들어지고 있었다(앵커를 함수 내부 주석에 잡았다).
 *   ⇒ **"소스에 있다" 는 "동작한다" 를 말해 주지 않는다.** 그래서 아래 ①은 *스코프*를 본다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

describe('① CSRF 토큰 — 단일 비행', () => {
  // 🔁 2026-10-06 재조준: `api.ts` 파일크기 래칫을 넘어 전용 모듈로 분리했다.
  //   지키는 불변식은 그대로 — **모듈 스코프 공유 + 인터셉터는 SSOT 호출**.
  const SRC = readCode('src/lib/csrf-token.ts')
  const API = readCode('src/lib/api.ts')

  it('공유 변수가 **모듈 스코프**에 있다 — 함수 안이면 요청마다 새로 만들어진다', () => {
    const decl = SRC.indexOf('let csrfInFlight')
    expect(decl, '`let csrfInFlight` 선언을 못 찾았다').toBeGreaterThan(-1)
    // 🔑 들여쓰기로는 판정할 수 없다 — 실제 사고 때 **0칸 들여쓰기인 채로** 인터셉터 콜백
    //   안에 있었다. 그래서 선언 지점까지의 **중괄호 깊이**가 0인지를 본다.
    //   (`readCode` 가 주석을 걷어 내므로 주석 속 괄호는 세지 않는다.)
    //   ⚠️ 전용 모듈로 분리한 지금도 이 검사는 유효하다 — 누가 다시 함수 안으로 넣을 수 있다.
    let depth = 0
    for (let i = 0; i < decl; i++) {
      const ch = SRC[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
    }
    expect(depth, `csrfInFlight 가 중괄호 깊이 ${depth} 에 있다 — 함수 안이면 공유가 안 된다`).toBe(0)
  })

  it('받는 중이면 그 약속을 같이 기다린다 (각자 fetch 금지)', () => {
    expect(SRC).toContain('if (!csrfInFlight)')
    expect(SRC).toContain('return csrfInFlight')
    // 끝나면 비워야 만료 후 다시 받는다 — 안 비우면 영원히 옛 토큰이다.
    expect(SRC).toMatch(/csrfInFlight\.finally\(\(\) => \{ csrfInFlight = null; \}\)/)
  })

  it('쿠키 리더를 공유한다 — api ↔ csrf-token 순환 import 를 만들지 않는다', () => {
    expect(SRC).toContain("from './read-cookie'")
    expect(SRC).not.toContain("from './api'")
  })

  it('인터셉터는 SSOT 를 부른다 — 자기가 fetch 하지 않는다', () => {
    const body = API.slice(API.indexOf("if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method))"))
    expect(body.slice(0, 400)).toContain('await ensureCsrfToken()')
    expect(body.slice(0, 400)).not.toContain("fetch('/api/csrf-token'")
  })
})

describe('② 홈 배너 — 한 번 받아 화면에서 가른다', () => {
  const SRC = readCode('src/components/home/useHomeBanners.ts')

  it('쿼리 키가 자리별이 아니다 — 자리별이면 요청이 다시 셋이 된다', () => {
    expect(SRC).toContain("['banners', 'all']")
    expect(SRC).not.toMatch(/\['banners', slot\]/)
  })

  it('`?type=` 을 붙이지 않는다 — 붙이면 cron 예열 키(`/api/banners`)와 어긋난다', () => {
    expect(SRC).not.toMatch(/params:\s*\{\s*type:/)
  })

  it('자리 미지정(null) 배너는 여전히 어디에도 안 뜬다 (2026-08-04 사고 규칙)', () => {
    expect(SRC).toContain('b.banner_slot === slot')
  })

  it('cron 예열 목록에 그 키가 실제로 있다 — 없으면 이 처방이 헛돈다', () => {
    expect(readCode('src/worker/cron/cache-prewarm.ts')).toContain("'/api/banners'")
  })
})

describe('③ 교환권 — 첫 응답을 버리지 않는다', () => {
  const SRC = readCode('src/pages/VouchersPage.tsx')

  it('카테고리 응답이 와도 URL 에 카테고리를 박지 않는다 (= 재요청 없음)', () => {
    // 응답 핸들러 구간만 본다 — localStorage 동기 분기의 자동선택은 **남겨 둔다**(재방문 동작 보존).
    const at = SRC.indexOf("api.get('/api/vouchers/categories')")
    expect(at, '카테고리 조회를 못 찾았다 — 이 시험이 헛돈다').toBeGreaterThan(-1)
    const handler = SRC.slice(at, at + 1600)
    expect(handler).not.toContain("next.set('category'")
  })

  it('재방문 자동선택(동기 캐시)은 그대로 살아 있다 — 기능이 사라진 게 아니다', () => {
    const at = SRC.indexOf("localStorage.getItem('vouchers_categories_v1')")
    expect(at).toBeGreaterThan(-1)
    expect(SRC.slice(at, at + 900)).toContain("next.set('category'")
  })
})

describe('④ 마이 내 가게 — 첫 화면이 상품 목록을 안 받는다', () => {
  const HOOK = readCode('src/pages/user-profile/seller-section/useSellerWork.ts')
  const SECTION = readCode('src/pages/user-profile/SellerSection.tsx')
  const ROUTE = readCode('src/features/seller/api/seller-operators.routes.ts')

  it('상품 조회가 기본으로 꺼져 있다', () => {
    expect(HOOK).toContain('withProducts = false')
    expect(HOOK).toContain("withProducts ? api.get('/api/seller/products')")
  })

  it('호출부가 상품 조회를 켜지 않는다 — 그 목록을 쓰던 시트는 철거됐다(소비처 0)', () => {
    // 🔁 2026-10-06 재조준: 처음엔 `tool === 'vouchers'` 일 때만 켜게 했는데, 그 Tool 값 자체가
    //   10-01 철거로 사라졌다(TS2367 이 잡았다). 지금 `work.products` 는 **아무도 안 읽는다**.
    //   불변식은 그대로다 — *첫 화면이 상품 목록을 받지 않는다*.
    expect(SECTION).not.toMatch(/useSellerWork\([^)]*\}, true\)/s)
    expect(SECTION).not.toContain('work.products')
  })

  it('`판매 중 N개` 는 1단계 응답이 준다 (2단계를 기다리지 않는다)', () => {
    expect(SECTION).toContain('store?.active_products')
    expect(SECTION).not.toContain('work.products.length > 0')
    expect(ROUTE).toContain('active_products:')
  })

  it('그 집계는 이미 돌고 있는 병렬 묶음 안이다 — 왕복이 안 늘어난다', () => {
    const at = ROUTE.indexOf('const [today, pending, active] = await Promise.all([')
    expect(at, '병렬 묶음을 못 찾았다').toBeGreaterThan(-1)
    // 묶음 안에서 products 집계를 한다(별도 await 로 빼면 왕복이 하나 는다).
    expect(ROUTE.slice(at, at + 2400)).toContain('FROM products')
  })

  it('상품을 안 받은 회차를 실패로 세지 않는다 (안 그러면 멀쩡한데 오류가 뜬다)', () => {
    expect(HOOK).toContain('const asked = withProducts ? [oRes, pRes] : [oRes]')
  })
})

describe('⑤ 측정기·가드 배선', () => {
  it('하네스가 기계 줄을 찍는다 — 없으면 가드가 0건을 읽는다', () => {
    expect(readCode('scripts/visual-preview.mjs')).toContain('console.log(`FETCH_RESULT ${JSON.stringify(')
  })

  it('가드가 줄을 못 읽으면 실패로 센다 (0건은 통과가 아니다)', () => {
    expect(readCode('scripts/check-duplicate-fetch.mjs')).toContain('측정 줄(FETCH_RESULT)을 못 읽었다')
  })

  it('예외 목록은 사유를 함께 적는다', () => {
    const b = JSON.parse(readCode('scripts/duplicate-fetch-baseline.json'))
    for (const k of Object.keys(b.allow || {})) {
      expect(b._reasons?.[k], `${k} 예외에 사유가 없다`).toBeTruthy()
    }
  })
})
