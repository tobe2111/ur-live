/**
 * 🏠 생활 페이지 로딩 (2026-10-26 대표 "/life/pro 이 페이지 로딩이 상대적으로 많이 길어")
 *
 * 라이브 실측(아이폰 · 느린 4G · CPU 4배): `/life/pro` 로딩 화면 2.7~4.2초, `/life` 보다 약 1초 길었다. 원인 둘.
 *   ① 생활 페이지가 하드로드 미리받기·부팅 준비 표면에 없었다 → 엔트리가 다 돈 뒤에야 페이지 코드가 출발했고,
 *      React 가 "페이지 로딩 중" 을 한 번 그렸다(그 단계에 0.5초 공개 지연이 걸린다 — boot-page 머리말).
 *   ② `ProCredits` 가 결제 키 판정 함수(`lib/toss-key-type`, 37줄)를 정적으로 불렀다. 묶음기는 생활 페이지를 모르므로
 *      그 파일을 유일한 사용자인 **이용권 상세 묶음**(lz-gbDetail 66KB raw)에 넣었고, 업체 등록 화면이 그 묶음을 통째로
 *      받았다. 로그인 전 방문자는 충전 버튼을 볼 일조차 없다.
 *
 * ⚠️ 이 시험이 못 보는 것: 실제 몇 초 줄었는지(브라우저 판정) · 다른 정적 import 가 새로 남의 묶음을 끌고 오는 것
 *   (그건 surface-budgets 래칫이 바이트로 잡는다).
 */
import { describe, expect, it } from 'vitest'
import { readCode } from '../helpers/source-text'
import { routeSurface } from '@/shared/route-surface'

describe('생활 페이지 하드로드', () => {
  it('① 주소 → 표면 판정에 생활 허브·업체 등록이 있다', () => {
    expect(routeSurface('/life', true, false)).toBe('life')
    expect(routeSurface('/life/pro', true, false)).toBe('lifePro')
    expect(routeSurface('/life/pro', true, true)).toBe('lifePro')
    // 하위 경로는 다른 페이지다 — 엉뚱한 청크를 미리 받지 않는다
    expect(routeSurface('/life/pro/requests/3', true, false)).toBeNull()
  })

  it('② 미리받기 표에 같은 이름·같은 페이지로 등재돼 있다', () => {
    // 생성기는 .mjs 라 import 하면 타입 선언이 필요하다 — 형제 시험(preload-only-routes)처럼 소스로 읽는다.
    const gen = readCode('scripts/generate-route-chunk-map.mjs')
    const table = gen.slice(gen.indexOf('export const PRELOAD_ONLY_ROUTES'))
    const block = table.slice(0, table.indexOf('\n}'))
    expect(block).toContain("life: ['src/pages/life/LifePage.tsx'],")
    expect(block).toContain("lifePro: ['src/pages/life/LifeProPage.tsx'],")
  })

  it('③ App.tsx 가 두 페이지를 부팅 준비 대상으로 등록한다(React.lazy 아님)', () => {
    const app = readCode('src/App.tsx')
    expect(app).toMatch(/const LifePage = lazyPage\(\(\) => import\('\.\/pages\/life\/LifePage'\)\); registerBootPage\('life', LifePage\.load\)/)
    expect(app).toMatch(/const LifeProPage = lazyPage\(\(\) => import\('\.\/pages\/life\/LifeProPage'\)\); registerBootPage\('lifePro', LifeProPage\.load\)/)
  })
})

describe('업체 등록 화면이 이용권 상세 묶음을 끌고 오지 않는다', () => {
  it('ProCredits 는 결제 키 판정을 누를 때만 받는다', () => {
    const src = readCode('src/pages/life/pro/ProCredits.tsx')
    expect(src).not.toMatch(/^import[^\n]*toss-key-type/m)
    expect(src).toMatch(/await import\('@\/lib\/toss-key-type'\)/)
  })
})
