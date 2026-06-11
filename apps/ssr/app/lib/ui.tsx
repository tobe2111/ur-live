/**
 * SSR 파일럿 공용 — API 베이스/이미지 리사이즈/포맷터/아이콘/헤더·하단바.
 * 디자인은 본 사이트(다크 소비자 테마 + BottomNav) 이식. 상호작용(로그인/장바구니 등)은
 * 본 사이트(live.ur-team.com)로 링크 — 파일럿은 비로그인 공개 뷰 검증이 목적.
 */
import { Link, useLocation } from 'react-router'

export const API = 'https://live.ur-team.com'

/** 본 사이트 CF 이미지 리사이저 경유 — 원본(수 MB) 대신 지정 px webp. */
export function img(u: string | null | undefined, width = 300): string {
  if (!u) return ''
  const abs = u.startsWith('/') ? `${API}${u}` : u
  return `${API}/cdn-cgi/image/width=${width},format=auto,quality=78/${abs}`
}

export function formatNumber(v: unknown): string {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('ko-KR') : '0'
}

export function formatWon(v: unknown): string {
  return `₩${formatNumber(v)}`
}

/** 본 사이트 group-buy-list/utils.ts formatTimeLeft 1:1. */
export function formatTimeLeft(deadline?: string | null): string {
  if (!deadline) return ''
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return '마감'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0) return `${days}일 ${hours}시간 남음`
  if (hours > 0) return `${hours}시간 ${mins}분 남음`
  return `${mins}분 남음`
}

/** 구매수 축약 — 본 사이트 VoucherCard soldLabel 1:1. */
export function soldLabel(soldCount: number): string {
  if (soldCount >= 10000) return `${(soldCount / 10000).toFixed(1).replace(/\.0$/, '')}만`
  if (soldCount >= 1000) return `${(soldCount / 1000).toFixed(1).replace(/\.0$/, '')}천`
  return String(soldCount)
}

// ───────────────────────── 아이콘 (lucide 대응 미니 SVG) ─────────────────────────

function svg(path: React.ReactNode, size = 16) {
  return (props: { className?: string; style?: React.CSSProperties }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className={props.className} style={props.style}>{path}</svg>
  )
}

export const IconMapPin = svg(<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>)
export const IconClock = svg(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>)
export const IconStore = svg(<><path d="m2 7 4.4-4.4A2 2 0 0 1 7.8 2h8.4a2 2 0 0 1 1.4.6L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M2 7h20v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V7Z" /></>)
export const IconBell = svg(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>)
export const IconSearch = svg(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>, 20)
export const IconCart = svg(<><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></>, 20)
export const IconHome = svg(<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><polyline points="9 22 9 12 15 12 15 22" /></>, 22)
export const IconLink = svg(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>, 22)
export const IconUser = svg(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>, 22)
export const IconCheck = svg(<><path d="M21.8 10A10 10 0 1 1 17 3.34" /><path d="m9 11 3 3L22 4" /></>, 12)
export const IconShare = svg(<><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" x2="12" y1="2" y2="15" /></>)

// ───────────────────────── 공용 셸 (다크 소비자 페이지) ─────────────────────────

/** 본 사이트 MainHomePage sticky 헤더 이식 — 로고 + 검색/알림/장바구니(본 사이트 링크). */
export function TopBar() {
  return (
    <div className="topbar">
      <Link to="/" className="topbar-logo">유어딜<span className="topbar-beta">beta</span></Link>
      <div className="topbar-actions">
        <Link to="/search" aria-label="검색"><IconSearch /></Link>
        <a href={`${API}/notifications`} aria-label="알림"><IconBell className="icon-20" /></a>
        <a href={`${API}/cart`} aria-label="장바구니"><IconCart /></a>
      </div>
    </div>
  )
}

/** 본 사이트 BottomNav(홈/동네딜/➕/링크샵/마이) 이식 — ➕/링크샵/마이는 본 사이트로. */
export function BottomNav() {
  const { pathname } = useLocation()
  const item = (active: boolean) => `bnav-item${active ? ' is-active' : ''}`
  return (
    <nav className="bnav">
      <Link to="/" className={item(pathname === '/')}><IconHome /><span>홈</span></Link>
      <Link to="/group-buy" className={item(pathname.startsWith('/group-buy'))}><IconMapPin className="icon-22" /><span>동네딜</span></Link>
      <a href={`${API}/community-group-buy/new`} className="bnav-plus" aria-label="만들기">＋</a>
      <a href={`${API}/u/me`} className={item(pathname.startsWith('/u/'))}><IconLink /><span>링크샵</span></a>
      <a href={`${API}/user/profile`} className={item(false)}><IconUser /><span>마이</span></a>
    </nav>
  )
}
