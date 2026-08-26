/**
 * 🎨 2026-07-07 (대표 승인 — "방문자 PC 거터 채우기, 라이트"): 유어샵 방문자(PC xl+)에게 빈 거터 대신
 *   좌측=창작자 카드(강화) / 우측=모바일 QR + "나도 유어샵 만들기" 성장 훅. **유어딜 네비는 넣지 않음**
 *   (남의 쇼핑몰에서 유어딜로 새지 않게 — 독립 쇼핑몰 느낌 유지). 창작자 데이터는 `/u/{handle}` 페이지가
 *   이미 워밍한 모듈 캐시(getCuratorCache) 재사용 + fresh fetch. 팔로우 등 API 배선은 제외(라이트).
 *   위치 계산은 ConsumerFrameRails 와 동일(프레임 430 중심 기준 calc). 유어샵 방문자일 때만 렌더.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { fetchCuratorPage, getCuratorCache } from '@/features/curator/curator-page-cache'
import { snsUrl } from '@/utils/sns-url'
import { Smartphone, Store } from 'lucide-react'
import VerifiedSeal from '@/components/VerifiedSeal'

const QRCodeSVG = lazy(() => import('qrcode.react').then(m => ({ default: m.QRCodeSVG })))

const FRAME_HALF = 215, GAP = 24, RAIL_W = 264
const leftStyle = { right: `calc(50% + ${FRAME_HALF + GAP}px)`, width: `${RAIL_W}px` }
const rightStyle = { left: `calc(50% + ${FRAME_HALF + GAP}px)`, width: `${RAIL_W}px` }
const cardCls = 'rounded-2xl border border-gray-200 dark:border-white/10 bg-white/85 dark:bg-white/[0.04] backdrop-blur-sm shadow-sm'

type Cur = { name?: string; handle?: string; bio?: string | null; youtube_url?: string | null; instagram_url?: string | null; tiktok_url?: string | null }
/** 매장 유어샵일 때 레일에 띄울 가게 정보 — curator(사람)가 아니라 linked_seller(가게) 쪽 값이다. */
type StoreInfo = { address?: string | null; phone?: string | null }

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
  const [store, setStore] = useState<StoreInfo | null>(null)

  useEffect(() => { if (typeof window !== 'undefined') setUrl(window.location.origin + window.location.pathname) }, [pathname])
  useEffect(() => {
    if (!handle) return
    let alive = true
    fetchCuratorPage(handle).then((res) => {
      if (!alive || !res?.success) return
      if (res.curator) setCurator(res.curator as Cur)
      setIsBiz(!!(res as { linked_seller?: unknown }).linked_seller)
      const sp = (res as { linked_seller_public?: { address?: string | null; phone?: string | null } }).linked_seller_public
      if (sp) setStore({ address: sp.address ?? null, phone: sp.phone ?? null })
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
                <VerifiedSeal size={16} className="shrink-0" />
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
                <Suspense fallback={<div className="w-[84px] h-[84px] rounded bg-gray-100 dark:bg-[#1A2334] animate-pulse" />}>
                  {url ? <QRCodeSVG value={url} size={84} level="M" /> : <div className="w-[84px] h-[84px]" />}
                </Suspense>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">카메라로 스캔하면 이 유어샵을 폰에서 이어서 볼 수 있어요</p>
            </div>
          </div>

          {/* 🏪 2026-08-26 (대표 승인 — UI 감사 #14): **매장 유어샵에서는 성장 훅을 띄우지 않는다.**
              여기 온 사람은 그 가게에서 뭔가 사려는 손님인데, "나도 이런 유어샵 만들기"는 그 손님을
              사장님 모집으로 데려간다 — 이 파일 헤더가 말하는 "유어딜로 새지 않게" 원칙과 자기모순이었다.
              (덤: 문구는 "내 쇼핑몰"인데 목적지는 `/host/new`(호스팅 카탈로그)라 말과 목적지도 어긋났다.)
              매장이면 **그 가게 정보**를 준다. 개인 추천 유어샵이면 종전 성장 훅 유지 — 거기선 손님을
              가로채는 게 아니라 "나도 이런 걸 만들고 싶다"가 자연스러운 다음 생각이다. */}
          {isBiz ? (
            (store?.address || store?.phone) ? (
              <div className="pointer-events-auto rounded-2xl p-4 bg-white dark:bg-[#1A2334] border border-gray-200 dark:border-[#2A3446] shadow-sm">
                <span className="flex items-center gap-1.5 text-[13px] font-extrabold text-gray-900 dark:text-white">
                  <Store className="w-4 h-4" aria-hidden="true" /> 매장 정보
                </span>
                {store?.address && (
                  <span className="block mt-1.5 text-[11.5px] leading-snug text-gray-500 dark:text-gray-400">{store.address}</span>
                )}
                {store?.phone && (
                  <a href={`tel:${store.phone}`} className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-gray-900 dark:text-white">
                    {store.phone} →
                  </a>
                )}
              </div>
            ) : null
          ) : (
            <Link to="/host/new" className="pointer-events-auto block rounded-2xl p-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm active:opacity-90">
              <span className="flex items-center gap-1.5 text-[13.5px] font-extrabold tracking-tight">
                <Store className="w-4 h-4" aria-hidden="true" /> 나도 이런 유어샵, 5분이면
              </span>
              <span className="block mt-1 text-[11.5px] leading-snug text-white/70 dark:text-gray-500">유어딜에서 무료로 내 쇼핑몰을 열고 상품·이용권을 팔아보세요.</span>
              <span className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-bold text-white dark:text-gray-900">내 유어샵 만들기 →</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}
