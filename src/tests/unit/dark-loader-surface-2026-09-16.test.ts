/**
 * 🌑 2026-09-16 (대표 — *"로딩도 좀 문제 있어보이고"*)
 *
 * `/videos` 는 **도착 화면이 다크 고정**(`bg-[#0A0C12]`)인데, 거기로 가는 로더 둘의 색이 갈려 있었다:
 *   · App.tsx 청크 로더(`BootFirstScreenLoader`) — **테마 추종** → 라이트 사용자에겐 흰 화면
 *   · VideosPage 자체 로더 — `forceDark` → 검은 화면
 * 그래서 라이트 테마에서 [흰 로더 → 검은 로더 → 검은 본문] 으로 **중간에 한 번 튀었다**
 * (로컬 실측: 469ms 흰 로더 → **531ms 검정** → 980ms 본문).
 *
 * 처방은 새로 만든 것이 아니라 **이미 있는 규칙의 반대 방향**이다 — 대시보드(`/seller`·`/admin`·`/ads`)는
 * 도착이 라이트 고정이라 `DashboardLoader` 가 `forceLight` 를 쓴다. 즉 **"로더는 도착 화면의 색을 미리 입는다."**
 *
 * ⚠️ **이 테스트가 못 막는 것**:
 *   · 하드로드(주소창에 `/videos` 직접 입력·새로고침)의 **워커 정적 로더**는 여전히 테마 추종이다
 *     (`worker/index.ts` 의 `urdealLoaderHtml` — 잠금표 파일이라 별도 승인 필요). 홈 레일
 *     「전체 보기」로 들어오는 **SPA 경로에는 그 로더가 없어서** 이 수정만으로 끊김이 사라진다.
 *   · 실제 픽셀이 안 튀는지는 jsdom 이 못 잰다(레이아웃·페인트 없음) — 브라우저 프레임 캡처가 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const APP = readCode('src/App.tsx')
const LOADER = readCode('src/components/brand/BrandLoader.tsx')
const VIDEOS = readCode('src/pages/VideosPage.tsx')

describe('🌑 로더는 도착 화면의 색을 미리 입는다', () => {
  it('/videos 가 다크 표면으로 선언돼 있다', () => {
    expect(APP, '다크 표면 술어가 사라졌다').toMatch(/isDarkLoaderSurface\s*=\s*\(pathname: string\)\s*=>/)
    expect(APP.match(/isDarkLoaderSurface\s*=[^\n]*/)?.[0] ?? '', '/videos 가 빠졌다').toMatch(/videos/)
  })

  it('청크 로더가 그 술어를 실제로 쓴다 (import 만 남고 배선이 끊기는 것 차단)', () => {
    // 🩸 배선 검사를 이름 존재로 하면 술어를 정의만 해 두고 안 쓰는 상태에서도 초록이 뜬다.
    //   **호출 형태**로 앵커한다.
    expect(APP).toMatch(/<BootFirstScreenLoader\s+forceDark=\{isDarkLoaderSurface\(/)
  })

  it('로더가 forceDark 를 받아 실제 BrandLoader 로 넘긴다', () => {
    expect(LOADER).toMatch(/export function BootFirstScreenLoader\(\{\s*forceDark\s*=\s*false/)
    expect(LOADER, '받기만 하고 안 넘기면 아무 일도 안 일어난다')
      .toMatch(/<BrandLoader fullScreen forceDark=\{forceDark\}\s*\/>/)
  })

  it('도착 화면(VideosPage)이 여전히 다크 고정이다 — 이 전제가 깨지면 처방도 틀린다', () => {
    expect(VIDEOS, 'VideosPage 가 더 이상 다크 고정이 아니면 forceDark 를 되돌려야 한다')
      .toMatch(/bg-\[#0A0C12\]/)
    expect(VIDEOS, 'VideosPage 자체 로더').toMatch(/<BrandLoader fullScreen forceDark/)
  })

  it('대시보드의 반대 방향 규칙(forceLight)은 그대로다', () => {
    expect(APP).toMatch(/<BrandLoader fullScreen forceLight \/>/)
    expect(APP).toMatch(/isDashboardLoaderSurface\s*=\s*\(pathname: string\)\s*=>/)
  })
})
