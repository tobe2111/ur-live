/**
 * 🎠 홈 상단 배너 — 대표 2026-10-13 지시 셋의 검사.
 *
 *   ① *"제주 여행 이용권, 강원 바다 여행 이용권 모두 폰트 색상 흰색 … 글자 위치가 더 내려가야 … 야놀자 스러워야"*
 *   ② *"각 배너마다 해당되는 페이지로 이동이 되어야지"*
 *   ③ *"마지막페이지에서 또 오른쪽으로 넘기면 첫페이지로 배너가 넘어오면 되잖아"*
 *
 * 🩸 ②는 **실제 결함**이었다: 어드민은 링크를 절대주소(`https://urdeal.kr/region/서울`)로만 받는데
 *    화면이 그걸 `safeInternalPath` 에 넣어 빈 값이 됐고, 라이브 다섯 장이 전부 `<div>` 였다.
 *    그래서 ②는 문자열이 아니라 **실제로 렌더해서 `<a href>` 를 센다.**
 *
 * ⚠️ 못 보는 것: 실제 스와이프·스냅 동작(jsdom 엔 레이아웃·스크롤이 없다 — 순환은 배선만 본다) ·
 *    흰 글자가 사진 위에서 **읽히는지**(그건 그려서 봐야 한다) · 링크 목적지가 살아 있는 페이지인지.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { STRIP_CLS } from '@/shared/home-strip-banners'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { resolveBannerLink } from '@/components/home/banner-link'
import { stripComments } from '../helpers/source-text'

/**
 * 🎫 2026-10-14 — 배너 클래스가 공용 상수(`STRIP_CLS`, 서버 첫 화면과 같은 값)로 옮겨갔다.
 *   불변식은 그대로이므로 **참조를 실제 값으로 되돌려 넣은 소스**를 검사한다(상수를 바꾸면 여기서 잡힌다).
 */
function resolveStripCls(src: string): string {
  const v = (k: string) => (STRIP_CLS as Record<string, string>)[k]
  return src
    .replace(/\$\{STRIP_CLS\.(\w+)\}/g, (_, k) => v(k))
    .replace(/\{STRIP_CLS\.(\w+)\}/g, (_, k) => `"${v(k)}"`)
    .replace(/STRIP_CLS\.(\w+)/g, (_, k) => `'${v(k)}'`)
}


const LIVE = [
  { id: 2, title: '교환권', link_url: 'https://urdeal.kr/vouchers' },
  { id: 3, title: '서울 여행 이용권', link_url: 'https://urdeal.kr/region/서울' },
  { id: 4, title: '부산', link_url: 'https://urdeal.kr/region/%EB%B6%80%EC%82%B0' },
  { id: 5, title: '강원 바다 여행 이용권', link_url: 'https://live.ur-team.com/region/강원' },
  { id: 6, title: '제주 여행 이용권', link_url: '/region/제주' },
].map((b, i) => ({ ...b, image_url: `https://media.ur-team.com/b${b.id}.webp`, description: null, banner_slot: 'strip' as const, display_order: i }))

vi.mock('@/components/home/useHomeBanners', () => ({ useHomeBanners: () => LIVE }))

const SRC = resolveStripCls(stripComments(readFileSync('src/components/home/HomeBannerStrip.tsx', 'utf-8')))
const CARD = SRC.slice(SRC.indexOf('function StripCard('))
const RAIL = SRC.slice(SRC.indexOf('function StripRail('), SRC.indexOf('function StripCard('))

describe('② 배너 링크 해석', () => {
  it('우리 도메인 절대주소는 앱 안 경로가 된다 (라이브 저장 형태)', () => {
    expect(resolveBannerLink('https://urdeal.kr/vouchers')).toEqual({ kind: 'internal', to: '/vouchers' })
    expect(resolveBannerLink('https://urdeal.kr/region/서울')).toEqual({ kind: 'internal', to: '/region/서울' })
    expect(resolveBannerLink('https://www.urdeal.kr/region/%EB%B6%80%EC%82%B0')).toEqual({ kind: 'internal', to: '/region/부산' })
    expect(resolveBannerLink('https://live.ur-team.com/region/강원')).toEqual({ kind: 'internal', to: '/region/강원' })
    expect(resolveBannerLink('https://preview.example/x', 'preview.example')).toEqual({ kind: 'internal', to: '/x' })
  })
  it('상대 경로와 필터 쿼리를 그대로 지킨다', () => {
    expect(resolveBannerLink('/region/제주')).toEqual({ kind: 'internal', to: '/region/제주' })
    expect(resolveBannerLink('https://urdeal.kr/?category=meal_voucher')).toEqual({ kind: 'internal', to: '/?category=meal_voucher' })
  })
  it('남의 https 주소는 새 탭 링크, 위험한 값은 링크 없음', () => {
    expect(resolveBannerLink('https://example.com/a')).toEqual({ kind: 'external', href: 'https://example.com/a' })
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.com/x', 'http://example.com', 'https://urdeal.kr/login', '', null, undefined]) {
      expect(resolveBannerLink(bad as string), String(bad)).toBeNull()
    }
  })
})

describe('② 렌더 — 배너마다 자기 페이지로 간다', () => {
  it('보이는 카드 다섯 장이 전부 링크이고 목적지가 맞다', async () => {
    const { default: HomeBannerStrip } = await import('@/components/home/HomeBannerStrip')
    const { container } = render(<MemoryRouter><HomeBannerStrip variant="strip" /></MemoryRouter>)
    const real = [...container.querySelectorAll('a')].filter(a => a.getAttribute('aria-hidden') !== 'true')
    expect(real.map(a => decodeURIComponent(a.getAttribute('href') || ''))).toEqual([
      '/vouchers', '/region/서울', '/region/부산', '/region/강원', '/region/제주',
    ])
    // ③ 순환용 복제 — 첫 장과 같은 목적지, 접근성 트리에서 빠진다.
    const clones = [...container.querySelectorAll('a[aria-hidden="true"]')]
    expect(clones).toHaveLength(1)
    expect(clones[0].getAttribute('href')).toBe('/vouchers')
    expect(clones[0].getAttribute('tabindex')).toBe('-1')
  })
})

describe('① 야놀자 문법 — 흰 글자 · 왼쪽 아래', () => {
  it('글자는 늘 흰색이다 (그림 밝기로 고르지 않는다)', () => {
    expect(CARD).toMatch(/line-clamp-2 text-white dark:text-white/)
    expect(CARD, '짙은 글자 분기가 돌아왔다 — 사진의 밝은 하늘이 장마다 다른 글자색을 부른다').not.toMatch(/text-gray-(900|800|700)/)
    expect(SRC, '밝기 판정이 돌아왔다').not.toMatch(/measureTitleLuminance|inkForLuminance/)
  })
  it('글자가 카드 아래에 앉고, 그 자리만 어둡게 받친다', () => {
    expect(CARD).toMatch(/aspect-\[2\/1\] flex flex-col justify-end/)
    expect(CARD).toMatch(/\{bg && <div className="absolute inset-x-0 bottom-0 h-\[\d+%\] -z-10 bg-gradient-to-t from-black\//)
  })
})

describe('③ 마지막 장 다음은 첫 장', () => {
  it('맨 뒤에 첫 장 복제를 둔다', () => {
    expect(RAIL).toContain('const slides = many ? [...banners, ...banners.slice(0, perView)] : banners')
    expect(RAIL).toMatch(/slides\.map\(/)
  })
  it('복제에 멈추면 애니메이션 없이 진짜 첫 장으로 옮긴다', () => {
    expect(RAIL).toMatch(/if \(at >= banners\.length\) jumpTo\(at - banners\.length\)/)
    expect(RAIL).toMatch(/el\.style\.scrollBehavior = 'auto'/)
  })
  it('숫자는 복제 칸에서도 1 / N 이다', () => {
    expect(RAIL).toMatch(/setActive\(i >= banners\.length \? 0 : Math\.max\(0, i\)\)/)
  })
})

describe('🖥️ PC — 한 줄에 세 장 + 좌우 화살표 (대표 확정 "시안 a")', () => {
  it('PC 에서는 세 장이 한 화면이다 — 카드 폭과 복제 수가 같은 값을 본다', () => {
    expect(SRC).toMatch(/const PC_PER_VIEW = 3/)
    expect(SRC, 'tailwind lg 와 다른 경계면 카드 폭과 순환 계산이 서로 다른 화면을 본다').toContain("const PC_QUERY = '(min-width: 1024px)'")
    expect(SRC, '카드 폭 = (칸 − STRIP_GAP_PX 둘) ÷ 3').toContain("const PC_CARD_W = 'lg:w-[calc((100%-56px)/3)]'")
    expect(CARD).toContain('${many ? PC_CARD_W : \'\'}')
    expect(SRC).toMatch(/const STRIP_GAP_PX = 28\b/)
  })
  it('마우스로 넘길 수 있다 — 이전·다음 화살표가 있고 PC 에서만 보인다', () => {
    expect(RAIL).toMatch(/onClick=\{goPrev\} aria-label="이전 배너"\s+className="hidden lg:grid/)
    expect(RAIL).toMatch(/onClick=\{goNext\} aria-label="다음 배너"\s+className="hidden lg:grid/)
  })
  it('첫 장에서 이전 — 복제 구간으로 순간이동한 뒤 한 칸 미끄러진다 (끝에서 멈추지 않는다)', () => {
    expect(RAIL).toMatch(/jumpTo\(banners\.length\)\s+requestAnimationFrame\(\(\) => goTo\(banners\.length - 1\)\)/)
  })
  it('PC 에서 보이는 세 장은 바로 받는다', () => {
    expect(RAIL).toContain('first={i < perView}')
  })
})

describe('📏 글자는 이름표 크기 (2026-10-14 대표 "배너 속 글자 크기들이 커")', () => {
  it('제목 17px · 설명 12px — 사진이 주인공이다', () => {
    // 이 파일엔 다른 배너 부품도 {b.title} 을 17px 로 그린다 — 띠 카드(max-w-[64%])로 앵커한다.
    expect(SRC).toMatch(/<strong className="block max-w-\[64%\] text-\[17px\] [^"]*">\{b\.title\}/)
    expect(SRC).toMatch(/<span className="block max-w-\[64%\] [^"]*\btext-\[12px\][^"]*">\{b\.description\}/)
  })
})
