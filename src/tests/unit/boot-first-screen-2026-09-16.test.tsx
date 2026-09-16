/**
 * 🖼️ 서버가 그린 첫 화면을 폴백이 덮지 않는다 〔2026-09-16〕
 *
 * 대표: *"승인할게 머지하고 판정까지도 해줘"* → 그 **판정에서 나온 결함**을 고친 것의 가드.
 *
 * ## 무엇이 잘못됐었나 (라이브 프레임 캡처, iPhone 13, `urdeal.kr/group-buy/2888`)
 *
 *     4,070ms  사진 보임 (서버가 그린 `#ur-first-screen`)
 *     4,926ms  사진 사라짐 + 풀스크린 로더            ← ❌ 이 시험이 막는 것
 *     5,463ms  사진 다시 보임 (React 가 그린 것)
 *
 * 히어로는 멀쩡했다(박스 한 종류·URL 한 종류·React 보다 1.4초 먼저). 범인은 **그 다음 단계**다 —
 * React 가 `#root` 를 비우는 순간 상세 청크가 아직 안 와서 `<Suspense fallback>` 이 먼저 그려지는데,
 * 그 폴백이 `BrandLoader fullScreen`(= `fixed inset-0` **불투명** 오버레이)이라 사진을 덮었다.
 * 대표가 2026-07-01 에 금지한 **"로딩 화면 2~3개"** 가 정확히 이 모양이다.
 *
 * ## 이 시험이 지키는 것
 * ① 서버가 첫 화면을 `id` 로 감싼다 — 그리고 그 리터럴이 클라 상수와 **같다**(갈리면 조용히 no-op).
 * ② 폴백이 서버 노드를 **같은 노드 그대로** 도로 붙인다(재파싱 0 · 픽셀 차이 0).
 * ③ 그때 화면을 덮는 `fixed inset-0` 오버레이가 **없다**.
 * ④ 서버 노드가 없으면(교환권 상세·목록·SPA 내부 이동) 종전 풀스크린 로더 그대로 — 무회귀.
 * ⑤ 경로가 다르면 안 쓴다(부팅 경로의 잔상이 다른 화면에 붙지 않게).
 * ⑥ 배선 — `App.tsx` 소비자 폴백이 이 컴포넌트이고, `main.tsx` 가 `createRoot` **앞에서** 잡는다.
 *
 * ## 이 시험이 **못** 막는 것
 * - 실제로 안 깜빡이는지 → **프레임 캡처**만이 판정한다(배포 후 라이브).
 * - jsdom 은 레이아웃이 없어 "같은 자리"는 못 잰다 — 같은 *노드*라는 것만 잰다.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { readCode } from '../helpers/source-text'
import { buildDetailFirstScreen } from '@/worker/utils/detail-ssr-body'
import { BOOT_FIRST_SCREEN_ID, captureBootFirstScreen, takeBootFirstScreen } from '@/lib/boot-first-screen'
import { BootFirstScreenLoader } from '@/components/brand/BrandLoader'

const LOADER = '<div style="min-height:100dvh;display:flex">urdeal.</div>'
const SEED = JSON.stringify({
  data: {
    id: 2888, name: '치즈돈가스 2인 세트', price: 16500,
    image_url: 'https://ldb-phinf.pstatic.net/a.jpg', category: 'meal_voucher',
  },
})

/** 워커가 하는 일을 그대로 재현: `#root` 에 첫 화면을 넣고, 부팅 경로를 그 상세로 둔다. */
function bootWithServerFirstScreen(pathname = '/group-buy/2888') {
  setPath(pathname)
  const root = document.createElement('div')
  root.id = 'root'
  root.innerHTML = buildDetailFirstScreen(SEED, LOADER)
  document.body.appendChild(root)
  captureBootFirstScreen()
  return root
}

/** `tests/setup.ts` 가 `window.location` 을 평범한 객체로 바꿔 놔서 `history` 대신 직접 쓴다. */
function setPath(pathname: string) {
  ;(window.location as unknown as { pathname: string }).pathname = pathname
}

beforeEach(() => {
  document.body.innerHTML = ''
  setPath('/')
})

describe('① 서버 마크업과 클라 상수가 같은 id 를 쓴다', () => {
  it('🔴 서버가 첫 화면을 `BOOT_FIRST_SCREEN_ID` 로 감싼다 (갈리면 폴백이 조용히 no-op)', () => {
    const html = buildDetailFirstScreen(SEED, LOADER)
    expect(html).toContain(`<div id="${BOOT_FIRST_SCREEN_ID}">`)
  })

  it('감싼 것은 [빵부스러기 + 히어로]까지 — 로더는 그 **밖**(마운트 때 사라져야 한다)', () => {
    const html = buildDetailFirstScreen(SEED, LOADER)
    const close = html.indexOf('</div>' + LOADER.replace('100dvh', '34dvh'))
    expect(close, '로더가 래퍼 밖에 있어야 한다').toBeGreaterThan(0)
    expect(html.slice(0, close)).toContain('aspect-ratio:3/2')
  })
})

describe('② 폴백이 사진을 덮지 않는다', () => {
  it('🔴 서버가 그린 **그 노드 자체**가 폴백 안으로 들어온다 (재파싱·재다운로드 0)', () => {
    const root = bootWithServerFirstScreen()
    const serverNode = root.querySelector(`#${BOOT_FIRST_SCREEN_ID}`)
    expect(serverNode).toBeTruthy()

    const { container } = render(<BootFirstScreenLoader />)
    const inFallback = container.querySelector(`#${BOOT_FIRST_SCREEN_ID}`)
    expect(inFallback, '폴백이 서버 첫 화면을 안 붙였다 — 사진이 사라진다').toBeTruthy()
    expect(inFallback).toBe(serverNode) // 같은 노드여야 한다(복제본이면 다시 그리는 것)
  })

  it('🔴 화면을 덮는 `fixed inset-0` 오버레이가 없다 (2026-09-15 판정의 그 결함)', () => {
    bootWithServerFirstScreen()
    const { container } = render(<BootFirstScreenLoader />)
    const covering = Array.from(container.querySelectorAll<HTMLElement>('div'))
      .filter((el) => el.className.includes('fixed') && el.className.includes('inset-0'))
    expect(covering, '폴백이 사진 위를 불투명하게 덮고 있다').toHaveLength(0)
  })

  it('사진 아래엔 로더가 이어진다 — 서버가 비워 둔 34dvh 자리와 같은 높이', () => {
    bootWithServerFirstScreen()
    const { container } = render(<BootFirstScreenLoader />)
    expect(container.innerHTML).toContain('34dvh')
    expect(container.querySelector('[role="status"]'), '로더가 아예 없으면 "다 온 줄" 알게 된다').toBeTruthy()
  })
})

describe('③ 서버 노드가 없으면 종전 그대로 (무회귀)', () => {
  it('🔴 첫 화면이 없으면 풀스크린 로더 — 교환권 상세·목록·PC 콜드', () => {
    setPath('/vouchers/2192')
    const { container } = render(<BootFirstScreenLoader />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('fixed')
    expect(el.className).toContain('inset-0')
  })

  it('경로가 다르면 부팅 잔상을 안 붙인다 (SPA 내부 이동)', () => {
    bootWithServerFirstScreen('/group-buy/2888')
    expect(takeBootFirstScreen('/group-buy/9999')).toBeNull()
    expect(takeBootFirstScreen('/group-buy/2888')).toBeTruthy()
  })
})

describe('④ 배선 — 한쪽만 있으면 조용히 아무 일도 안 난다', () => {
  it('🔴 `App.tsx` 소비자 폴백이 `BootFirstScreenLoader` 다 (직접 `BrandLoader fullScreen` 아님)', () => {
    const app = readCode('src/App.tsx')
    expect(app).toMatch(/const PageLoader = \(\) => <BootFirstScreenLoader \/>/)
  })

  it('🔴 `main.tsx` 가 `createRoot` **앞에서** 노드를 잡는다 (뒤면 이미 비워진 뒤다)', () => {
    const main = readCode('src/main.tsx')
    const cap = main.indexOf('captureBootFirstScreen()')
    const root = main.indexOf('createRoot(rootElement)')
    expect(cap, 'captureBootFirstScreen() 호출이 없다').toBeGreaterThan(0)
    expect(root).toBeGreaterThan(0)
    expect(cap).toBeLessThan(root)
  })

  it('🔴 노드를 미리 떼어내지 않는다 (떼면 커밋 전에 한 프레임 사라질 수 있다)', () => {
    expect(readCode('src/lib/boot-first-screen.ts')).not.toMatch(/\.remove\(\)|removeChild/)
  })
})
