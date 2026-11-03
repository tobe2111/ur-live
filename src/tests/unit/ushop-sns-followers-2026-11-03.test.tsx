/**
 * 📈 유어샵 SNS 이름표의 팔로워 수 — 2026-11-03 대표 *"유어샵은 B. 근데 … 인스타그램, 틱톡 등 연동도 해서
 *   나타날텐데..?"* → *"응 그 순서대로 하자"*(시안 I5·I6).
 *
 * 지키는 것:
 *  ① 숫자 글자 — 1.2만 · 8,400 (만 단위는 소수 한 자리, 반올림 아니라 내림 — 12,999 를 1.3만이라 부풀리지 않는다)
 *  ② **같은 계정일 때만** 붙는다 — 이름표 주소(유저가 적은 값)와 연동 계정 이름이 조각 단위로 같아야 한다.
 *     `jiwon` 이 `jiwon_food` 에 걸리면 남의 팔로워를 내 것처럼 보이게 된다.
 *  ③ 서버 첫 화면과 화면이 **같은 글자**를 그린다(갈리면 마운트 때 이름표 폭이 바뀌어 줄이 튄다).
 *  ④ API 는 그 조회를 첫 물결(Promise.all)에 싣는다 — 왕복을 하나 더 만들지 않는다.
 * ⚠️ 못 보는 것: 실제 연동 계정의 숫자가 맞는지(플랫폼 응답) · 숫자가 낡았는지(다시 확인 주기).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { snsFollowerLabel, sameSnsAccount } from '@/shared/ushop-sns-followers'
import { buildCuratorFirstScreen, CURATOR_FS_CLASS } from '@/worker/utils/curator-ssr-body'
import CuratorHeader from '@/pages/curator-page/CuratorHeader'

const PIN = { id: 11, product_id: 2887, product_name: '등심돈까스', category: 'meal_voucher', price: 13500, original_price: 20000, restaurant_name: '홍대돈까스', is_active: 1, sold_count: 1 }
const curator = (f?: Record<string, number>) => ({
  id: 3, handle: 'jiwon1228', name: '정지원', bio: null, profile_image: null,
  instagram_url: 'https://instagram.com/jiwon_eats', tiktok_url: 'https://www.tiktok.com/@jiwon.tt', youtube_url: '',
  ...(f ? { sns_followers: f } : {}),
})
const pillTexts = (root: Element | Document) =>
  Array.from(root.querySelectorAll(`.${CURATOR_FS_CLASS.snsPill.split(' ').map((t) => CSS.escape(t)).join('.')}`)).map((e) => (e.textContent || '').trim())

describe('① 숫자 글자', () => {
  it('만 단위 · 천 단위', () => {
    expect(snsFollowerLabel(12345)).toBe('1.2만')
    expect(snsFollowerLabel(12999)).toBe('1.2만')
    expect(snsFollowerLabel(10000)).toBe('1만')
    expect(snsFollowerLabel(8400)).toBe('8,400')
    expect(snsFollowerLabel(950)).toBe('950')
    expect(snsFollowerLabel(Number.NaN)).toBe('')
  })
})

describe('② 같은 계정일 때만', () => {
  it('주소 조각이 정확히 같아야 한다', () => {
    expect(sameSnsAccount('https://instagram.com/Jiwon_Eats/', 'jiwon_eats')).toBe(true)
    expect(sameSnsAccount('https://www.tiktok.com/@jiwon.tt', '@jiwon.tt')).toBe(true)
    expect(sameSnsAccount('https://instagram.com/jiwon_food', 'jiwon')).toBe(false)
    expect(sameSnsAccount('https://instagram.com/other', 'jiwon_eats')).toBe(false)
    expect(sameSnsAccount('', 'jiwon')).toBe(false)
    expect(sameSnsAccount('https://instagram.com/jiwon', null)).toBe(false)
  })
  it('API 는 그 판정을 거쳐서만 숫자를 싣는다', () => {
    const src = readFileSync('src/worker/utils/ushop-sns-followers.ts', 'utf8')
    expect(src).toMatch(/sameSnsAccount\(urlOf\[p\], l\.username\)\) out\[p\]/)
  })
})

describe('③ 서버 첫 화면 = 화면', () => {
  const ssr = (f?: Record<string, number>) => {
    const html = buildCuratorFirstScreen(JSON.stringify({ success: true, curator: curator(f), pins: [PIN], linked_seller: null }), '<div></div>')
    return new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  }
  const client = (f?: Record<string, number>) => render(
    <MemoryRouter><CuratorHeader curator={curator(f) as never} counts={{ pins: 1 }} onCopyLink={() => {}} /></MemoryRouter>,
  ).container
  it('숫자가 있으면 숫자, 없으면 이름 — 두 곳이 같다', () => {
    const f = { instagram: 12345 }
    expect(pillTexts(ssr(f))).toEqual(['1.2만', 'TikTok'])
    expect(pillTexts(client(f))).toEqual(['1.2만', 'TikTok'])
    expect(pillTexts(ssr())).toEqual(['Instagram', 'TikTok'])
    expect(pillTexts(client())).toEqual(['Instagram', 'TikTok'])
  })
  it('로고만 보이는 칸도 무엇인지 말한다(aria)', () => {
    const a = client({ instagram: 12345 }).querySelector('a[aria-label^="Instagram"]')
    expect(a?.getAttribute('aria-label')).toBe('Instagram 팔로워 1.2만')
  })
})

describe('④ 왕복을 늘리지 않는다', () => {
  it('첫 물결에 실린다', () => {
    const r = readFileSync('src/worker/routes/curator.routes.ts', 'utf8')
    expect(r).toMatch(/const \[linkedSeller, pinsResult, dealBySeller, ushopSold, affiliateOn, head, snsFollowers\] = await Promise\.all\(\[/)
    expect(r).toMatch(/loadUShopSnsFollowers\(DB, user\), \/\/ 📈/)
  })
})
