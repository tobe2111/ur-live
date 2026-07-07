/**
 * 🎨 2026-07-07 (대표 승인 — "방문자 PC 거터 채우기, 라이트"): 링크샵 방문자(PC xl+)에게 빈 거터 대신
 *   좌측=창작자 카드(강화) / 우측=모바일 QR + "나도 링크샵 만들기" 성장 훅. **유어딜 네비는 넣지 않음**
 *   (남의 쇼핑몰에서 유어딜로 새지 않게 — 독립 쇼핑몰 느낌 유지). 창작자 데이터는 `/u/{handle}` 페이지가
 *   이미 워밍한 모듈 캐시(getCuratorCache) 재사용 + fresh fetch. 팔로우 등 API 배선은 제외(라이트).
 *   위치 계산은 ConsumerFrameRails 와 동일(프레임 430 중심 기준 calc). 링크샵 방문자일 때만 렌더.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { fetchCuratorPage, getCuratorCache } from '@/features/curator/curator-page-cache'
import { snsUrl } from '@/utils/sns-url'
import { Smartphone, Store } from 'lucide-react'

const QRCodeSVG = lazy(() => import('qrcode.react').then(m => ({ default: m.QRCodeSVG })))

const FRAME_HALF = 215, GAP = 24, RAIL_W = 264
const leftStyle = { right: `calc(50% + ${FRAME_HALF + GAP}px)`, width: `${RAIL_W}px` }
const rightStyle = { left: `calc(50% + ${FRAME_HALF + GAP}px)`, width: `${RAIL_W}px` }
const cardCls = 'rounded-2xl border border-gray-200 dark:border-white/10 bg-white/85 dark:bg-white/[0.04] backdrop-blur-sm shadow-sm'

type Cur = { name?: string; handle?: string; bio?: string | null; youtube_url?: string | null; instagram_url?: string | null; tiktok_url?: string | null }

function parseHandle(path: string): string | null {
  const m = path.match(/^\/u\/([^/]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export default function LinkshopVisitorRails() {
  const { pathname } = useLocation()
  const handle = parseHandle(pathname)
  const [url, setUrl] = useState('')
  const seed = handle ? getCuratorCache(handle) : null
  const [curator, setCurator] = useState<Cur | null>((seed?.curator as Cur) ?? null)
  const [isBiz, setIsBiz] = useState<boolean>(!!seed?.linked_seller)

  useEffect(() => { if (typeof window !== 'undefined') setUrl(window.location.origin + window.location.pathname) }, [pathname])
  useEffect(() => {
    if (!handle) return
    let alive = true
    fetchCuratorPage(handle).then((res) => {
      if (!alive || !res?.success) return
      if (res.curator) setCurator(res.curator as Cur)
      setIsBiz(!!(res as { linked_seller?: unknown }).linked_seller)
    }).catch(() => { /* 레거시 /profile·/s 는 핸들 아님 → 창작자 카드 생략, QR+성장만 */ })
    return () => { alive = false }
  }, [handle])

  const hasSns = !!(curator?.youtube_url || curator?.instagram_url)

  return (
    <>
      {/* LEFT — 창작자 카드 (있을 때만) */}
      {curator?.name && (
        <aside className="hidden xl:flex fixed top-0 bottom-0 z-30 flex-col justify-center pointer-events-none" style={leftStyle}>
          <div className={`pointer-events-auto ${cardCls} p-5 text-center`}>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[17px] font-extrabold text-gray-900 dark:text-white tracking-tight">{curator.name}</span>
              {isBiz && (
                <svg width="16" height="16" viewBox="0 0 24 24" aria-label="사업자 인증" className="shrink-0"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z" fill="#1d9bf0" /><path d="M9.8 15.6l-3-3 1.2-1.2 1.8 1.8 4.4-4.4 1.2 1.2z" fill="#fff" /></svg>
              )}
            </div>
            {curator.handle && <p className="mt-0.5 text-[12px] font-semibold text-gray-400 dark:text-gray-500">@{curator.handle}</p>}
            {curator.bio && <p className="mt-2.5 text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-300 line-clamp-4">{curator.bio}</p>}
            {hasSns && (
              <div className="mt-3 flex items-center justify-center gap-2">
                {curator.youtube_url && (
                  <a href={snsUrl('youtube', curator.youtube_url)} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="w-[30px] h-[30px] rounded-[9px] bg-[#FF0000] flex items-center justify-center">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" /></svg>
                  </a>
                )}
                {curator.instagram_url && (
                  <a href={snsUrl('instagram', curator.instagram_url)} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center" style={{ background: 'linear-gradient(45deg,#F9CE34,#EE2A7B,#6228D7)' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.7" /><circle cx="17.3" cy="6.7" r="1.1" fill="#fff" stroke="none" /></svg>
                  </a>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* RIGHT — 모바일 QR + 성장 훅 */}
      <aside className="hidden xl:flex fixed top-0 bottom-0 z-30 flex-col justify-center gap-3.5 pointer-events-none" style={rightStyle}>
        <div className="pointer-events-auto flex flex-col gap-3.5">
          <div className={`${cardCls} p-3.5`}>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Smartphone className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              <p className="text-[11px] font-bold tracking-wide text-gray-500 dark:text-gray-400">모바일로 보기</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white dark:bg-white p-1.5 shrink-0">
                <Suspense fallback={<div className="w-[84px] h-[84px] rounded bg-gray-100 dark:bg-[#1A1A1A] animate-pulse" />}>
                  {url ? <QRCodeSVG value={url} size={84} level="M" /> : <div className="w-[84px] h-[84px]" />}
                </Suspense>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">카메라로 스캔하면 이 링크샵을 폰에서 이어서 볼 수 있어요</p>
            </div>
          </div>

          {/* 성장 훅 — 방문자를 유어딜 신규 창작자로 (작게, 방해 없이) */}
          <Link to="/host/new" className="pointer-events-auto block rounded-2xl p-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm active:opacity-90">
            <span className="flex items-center gap-1.5 text-[13.5px] font-extrabold tracking-tight">
              <Store className="w-4 h-4" aria-hidden="true" /> 나도 이런 링크샵, 5분이면
            </span>
            <span className="block mt-1 text-[11.5px] leading-snug text-white/70 dark:text-gray-500">유어딜에서 무료로 내 쇼핑몰을 열고 상품·이용권을 팔아보세요.</span>
            <span className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-bold text-white dark:text-gray-900">내 링크샵 만들기 →</span>
          </Link>
        </div>
      </aside>
    </>
  )
}
