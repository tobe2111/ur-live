/**
 * 🏠 2026-11-03 대표 *"홈 페이지에서 윗부분 동탄5동, 전체, 식사, 미용, 숙소 등등, 로고 전체적으로 그 부분이 되게 느려 처음에"*
 *
 * 서버 첫 화면이 로고 줄(로고·검색·알림·장바구니)과 위치 줄(이름·화살표·현위치)을 **화면과 같은 마크업으로** 처음부터 그린다.
 * 종전: 로고 줄 = 빈 상자, 이름 = `&nbsp;` → 앱 부팅 뒤에야 채워졌다.
 * 지키는 것: ① 정적 조각 = 리액트 부품 렌더 결과(글자 단위) ② 이름은 쿠키 → 없으면 '전국' ③ 이름은 HTML 탈출·20자
 *   ④ 위치 줄 버튼 클래스 = 화면(title 톤) ⑤ 화면이 이름을 쿠키로 남긴다.
 * ⚠️ 못 보는 것: 알림 빨간 점(안 읽음) — 서버는 모른다(화면이 붙인다) · 실제 체감(라이브).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup as r } from 'react-dom/server'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { Search, ChevronDown, LocateFixed } from 'lucide-react'
import { BellIcon, BagIcon } from '@/components/icons/urdeal-icons'
import * as M from '@/worker/utils/home-top-markup'
import { buildHomeFirstScreen, HOME_FS_CLASS } from '@/worker/utils/home-first-screen'
import { homeLocLabelFromCookieHeader, homeLocLabelCookie } from '@/shared/home-loc-label-cookie'

const P = { id: 2915, name: '홍대 돈가스 세트', image_url: 'https://media.ur-team.com/uploads/seller/26/2026-10/x.jpg', price: 7500, category: 'meal_voucher', deal_only: 0 }
const SEED = JSON.stringify({ success: true, data: [{ id: 1, title: '이런 이용권은 어떠세요?', subtitle: null, products: [P] }] })
const build = (cookie: string | null) => buildHomeFirstScreen(SEED, '<div></div>', '', cookie)

describe('홈 맨 위 — 서버 첫 화면이 처음부터 그린다', () => {
  it('① 정적 조각 = 리액트 부품 렌더 결과(바뀌면 이 시험이 새 문자열을 보여 준다)', () => {
    expect(M.HOME_TOP_LOGO).toBe(r(<UrDealLogo size={17} />))
    expect(M.HOME_TOP_SEARCH).toBe(r(<Search className="h-[21px] w-[21px]" strokeWidth={1.6} fill="none" />))
    expect(M.HOME_TOP_BELL).toBe(r(<BellIcon className="h-[21px] w-[21px]" filled={false} />))
    expect(M.HOME_TOP_BAG).toBe(r(<BagIcon className="h-[21px] w-[21px]" filled={false} />))
    expect(M.HOME_TOP_CHEVRON).toBe(r(<ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-300 shrink-0 transition-transform " />))
    expect(M.HOME_TOP_LOCATE).toBe(r(<LocateFixed className="w-[15px] h-[15px]" />))
  })
  it('② 첫 화면에 로고·버튼 셋·이름이 있다 — 쿠키 없음 = 전국', () => {
    const h = build(null)
    expect(h).toContain(M.HOME_TOP_LOGO)
    for (const l of ['검색', '알림', '장바구니', '현 위치로 설정']) expect(h).toContain(`aria-label="${l}"`)
    expect(h).toContain(`<span class="${HOME_FS_CLASS.locLabel}">전국</span>`)
    expect(h).not.toContain('&nbsp;</span>')
  })
  it('③ 쿠키 이름은 그대로 · 탈출 · 20자', () => {
    expect(build(homeLocLabelCookie('동탄5동').split(';')[0])).toContain('>동탄5동</span>')
    const evil = build(`ur_home_loc=${encodeURIComponent('<img src=x onerror=1>')}`)
    expect(evil).not.toContain('<img src=x')
    expect(homeLocLabelFromCookieHeader(`ur_home_loc=${encodeURIComponent('가'.repeat(40))}`).length).toBe(20)
    expect(homeLocLabelFromCookieHeader('ur_home_loc=%E0%A4%A')).toBe('전국') // 깨진 값
  })
  it('④ 위치 줄 클래스가 화면(title 톤)과 같다', () => {
    const src = readFileSync('src/pages/pc-home/PcHomeLocationBar.tsx', 'utf8')
    const title = src.slice(src.indexOf('  title: {'), src.indexOf('  },', src.indexOf('  title: {')))
    expect(title).toContain(`pick: '${HOME_FS_CLASS.locTrigger}'`)
    expect(title).toContain(`label: '${HOME_FS_CLASS.locLabel}'`)
    expect(title).toContain(`locate: '${HOME_FS_CLASS.locate}'`)
  })
  it('⑤ 화면이 이름을 쿠키로 남긴다', () => {
    const src = readFileSync('src/pages/mobile-home/MobileHomePage.tsx', 'utf8')
    expect(src).toMatch(/const topLocLabel = homeLocationLabel\(\{ located: !!userLoc, dongLabel: dong\?\.dong, region \}\)/)
    expect(src).toMatch(/document\.cookie = homeLocLabelCookie\(topLocLabel\)/)
    expect(src).toMatch(/<PcHomeLocationBar tone="title" value=\{region\}[^>]*located=\{!!userLoc\} locatedLabel=\{dong\?\.dong\}/)
  })
})
