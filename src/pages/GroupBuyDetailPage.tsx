import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, MapPin, Phone, Clock, Sparkles, CheckCircle2, AlertCircle, Instagram, Youtube, Facebook, Music2, ShieldCheck, RefreshCcw } from 'lucide-react'
import { resolveTossFlow } from '@/lib/toss-key-type'
import { resolveProductFlow } from '@/shared/product-flow'
import api from '@/lib/api'
import { storeAffiliateRef, fireAffiliateTrack } from '@/utils/affiliate-track'
import SEO from '@/components/SEO'
import KakaoShareButton from '@/components/KakaoShareButton'
// 🛡️ 2026-06-12 (감사 1단계 — 핀 표면): 공유 버튼 옆 핀 버튼 (additive — 잠금 항목 무변경).
import PinButton from '@/components/curator/PinButton'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { cfImage } from '@/utils/cf-image'
import { reportFunnel } from '@/lib/web-vitals-report'
import { recordRecentlyViewed } from '@/components/group-buy/RecentlyViewedStrip'
import { useInvalidateMyVouchers } from '@/hooks/queries'

// 🛡️ 2026-05-27 (loading P1): below-fold 컴포넌트 lazy — 초기 chunk 30-50KB ↓.
//   - Confetti: 100% 달성 시만 표시 (대부분 사용자 안 봄)
//   - RestaurantMiniMap: 매장 정보 아래 (fold 직후, Kakao Maps SDK 포함)
// 🎨 2026-06-16 리디자인: Confetti(공구 연출) 제거 — 정직한 즉시구매. RestaurantMiniMap 만 lazy 유지.
const RestaurantMiniMap = lazy(() => import('@/components/RestaurantMiniMap'))
// 🎨 2026-06-17 (공구상세 후속 — 디자이너 제안 "후기·평점이 가장 큰 신뢰 레버"): 기존 ProductReviews 재사용(lazy, below-fold).
const ProductReviews = lazy(() => import('./product-detail/ProductReviews'))

// 🛡️ 2026-05-15: 전용 공구 상세 페이지 (`/group-buy/:id`)
//   - 카운트다운 ring + 티어 진행 바 + 참여자 아바타 + 마감 timer + share CTA
//   - 일반 ProductDetailPage 와 분리: 공구 특화 UX (참여 후 voucher 발급 강조)

interface GroupBuyDetail {
  id: number
  name: string
  description?: string
  image_url?: string
  price: number
  original_price?: number
  category: string
  restaurant_name?: string
  restaurant_address?: string
  restaurant_phone?: string
  restaurant_lat?: number
  restaurant_lng?: number
  voucher_expiry?: string
  voucher_terms?: string
  group_buy_target: number
  group_buy_current: number
  group_buy_deadline?: string
  group_buy_status: 'active' | 'achieved' | 'expired' | 'cancelled' | string
  // 🛡️ 2026-05-27: 서버가 array 로 미리 parse 해서 보냄. 구 응답 (stale edge cache) 은 string — 둘 다 handle.
  group_buy_tiers?: string | Array<{ min: number; discount_pct: number }> | null
  current_discount_pct: number
  seller_id?: number
  seller_name?: string
  seller_username?: string
  seller_avatar?: string
  // 🛡️ 2026-05-27: 셀러 SNS 버튼 — 채팅/매너온도 X, SNS 만.
  seller_instagram?: string | null
  seller_youtube?: string | null
  seller_tiktok?: string | null
  seller_facebook?: string | null
}

interface Participant {
  masked_name: string
  avatar?: string
  created_at: string
  quantity: number
}

function CategoryEmoji({ cat }: { cat: string }) {
  const map: Record<string, string> = {
    meal_voucher: '🍽️', beauty_voucher: '💇', health_voucher: '💪',
    pet_voucher: '🐶', stay_voucher: '🏨', activity_voucher: '🎯',
  }
  return <span>{map[cat] || '🎫'}</span>
}

// 🎨 2026-06-16 리디자인: CountdownRing(공구 마감 연출) 제거 — 정직한 즉시 할인 구매로 전환 (사용자 design 결정).

export default function GroupBuyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const invalidateVouchers = useInvalidateMyVouchers()
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  // 🛡️ 2026-05-21 Phase D: 셀러 트래킹 (?seller=ID) sessionStorage 저장.
  useEffect(() => {
    import('@/lib/seller-tracking').then(m => m.captureTrackingFromUrl())
  }, [])
  // 🛡️ 2026-05-15: 인플루언서 link 진입 (?ref=) — 단독 랜딩 모드
  const refUserId = searchParams.get('ref')
  // 🧭 2026-06-10 (링크샵 적립): 핀 리다이렉트 ?aff=(유저 큐레이터) — 인플 ?ref= 와 별도 레일
  useEffect(() => { storeAffiliateRef(searchParams.get('aff')) }, [searchParams])

  // 🛡️ 2026-06-11 (플로우 감사 갭#5): 토스 실패 복귀(?fail=1) 무안내였음 — failUrl 만 만들고
  //   읽는 코드가 없어 유저가 결제 성패를 모름. 1회 toast + URL 정리(새로고침 중복 방지).
  useEffect(() => {
    if (searchParams.get('fail') !== '1') return
    const rawMsg = searchParams.get('message') || ''
    const code = searchParams.get('code') || ''
    const safeMsg = rawMsg.slice(0, 120)
    toast.error(safeMsg
      ? `결제가 완료되지 않았어요 — ${safeMsg}${code ? ` (${code})` : ''}`
      : '결제가 완료되지 않았어요. 다시 시도해주세요.')
    try {
      const u = new URL(window.location.href)
      ;['fail', 'code', 'message', 'orderId'].forEach(k => u.searchParams.delete(k))
      window.history.replaceState({}, '', u.pathname + (u.search || ''))
    } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const isInfluencerLanding = !!refUserId
  const [detail, setDetail] = useState<GroupBuyDetail | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [quantity, setQuantity] = useState(1)
  // 🎨 2026-06-16 리디자인: 스와이프 갤러리 활성 인덱스 + 이 셀러의 다른 공구
  const [activeImage, setActiveImage] = useState(0)
  const [otherDeals, setOtherDeals] = useState<Array<{ id: number; name: string; price: number; original_price?: number | null; image_url?: string | null; discount_pct?: number | null }>>([])
  const galRef = useRef<HTMLDivElement | null>(null)
  // 🏭 2026-06-07 (당근 스타일 hero 재설계): 스크롤-aware 헤더.
  //   hero 이미지를 지나치면 투명 overlay → solid 테마 바로 전환 + 제목 fade-in.
  //   passive scroll listener + ref 로 hero 높이 측정 (threshold ≈ heroHeight - headerHeight).
  const heroRef = useRef<HTMLDivElement | null>(null)
  const [headerSolid, setHeaderSolid] = useState(false)
  useEffect(() => {
    const HEADER_H = 56 // overlay 헤더 대략 높이 (px)
    const onScroll = () => {
      const h = heroRef.current?.offsetHeight ?? 0
      const threshold = Math.max(0, h - HEADER_H)
      setHeaderSolid(window.scrollY > threshold)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [detail?.id, detail?.image_url])

  const productId = Number(id)
  const isLoggedIn = !!localStorage.getItem('user_id') || !!localStorage.getItem('uid')
  // 🛡️ 2026-05-15: 본인 product 인 경우 "공구 관리" CTA 표시 (셀러 대시보드 진입점)
  const sellerId = localStorage.getItem('seller_id')
  const isOwnProduct = !!sellerId && detail?.seller_id != null && Number(detail.seller_id) === Number(sellerId)
  // 🛡️ 2026-05-15: 본인 추천 링크 (친구 초대 시 양쪽 1% 보너스 딜)
  const myUserId = localStorage.getItem('user_id') || localStorage.getItem('uid') || ''
  const shareLink = myUserId
    ? `/group-buy/${productId}?ref=${myUserId}`
    : `/group-buy/${productId}`

  useEffect(() => {
    if (!Number.isFinite(productId) || productId <= 0) {
      toast.error('잘못된 ID')
      navigate('/group-buy')
      return
    }
    let cancelled = false

    // 🛡️ 2026-05-27 (loading P0): SSR inject 즉시 사용 — worker HTMLRewriter 가 head 에 inject.
    //   효과: 첫 paint 부터 상세 표시 (axios fetch waterfall ~200-500ms 제거).
    //   miss 시 useEffect 가 정상 axios fetch (fallback 안전).
    try {
      if (typeof document !== 'undefined') {
        const el = document.getElementById('__SSR_INITIAL_DETAIL__')
        if (el?.textContent) {
          const parsed = JSON.parse(el.textContent)
          if (parsed?.success && parsed?.data?.id === productId) {
            setDetail(parsed.data)
          }
        }
      }
    } catch { /* SSR inject 누락 / 손상 — fallback */ }

    Promise.all([
      api.get(`/api/group-buy/products/${productId}`),
      api.get(`/api/group-buy/products/${productId}/participants`).catch(() => ({ data: { data: [] } })),
    ]).then(([detailRes, partRes]) => {
      if (cancelled) return
      if (detailRes.data?.success) {
        // 🛡️ 2026-05-23 revert: /group-buy/:id 진입 시 redirect 제거.
        //   이전 redirect 가 모든 voucher 카테고리 상품을 /vouchers/:id 로 보내서
        //   공구 페이지 자체가 렌더 안 됐던 사고 (모든 공구 상품이 voucher 카테고리인 환경).
        //   해결: GroupBuyDetailPage 는 받은 상품 그대로 렌더. 새 링크는 SSOT 가 정확한
        //   detail URL 로 생성 (홈 공구 → /group-buy, /vouchers 목록 → /vouchers).
        setDetail(detailRes.data.data)
        reportFunnel('view', productId)  // funnel: page view
        // 🛡️ 2026-05-15: 최근 본 공구 기록 (localStorage 12개 제한)
        try {
          recordRecentlyViewed({
            id: detailRes.data.data.id,
            name: detailRes.data.data.name,
            image_url: detailRes.data.data.image_url,
            restaurant_name: detailRes.data.data.restaurant_name,
            price: detailRes.data.data.price,
          })
        } catch { /* silent */ }
      } else toast.error(detailRes.data?.error || '상품을 찾을 수 없습니다')
      setParticipants(partRes.data?.data || [])
    }).catch(() => toast.error('네트워크 오류'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [productId, navigate])

  // 🎨 2026-06-16 리디자인: 이 셀러의 다른 공구 — active 목록에서 같은 seller 필터(현재 상품 제외).
  useEffect(() => {
    const sid = detail?.seller_id
    if (!sid) return
    let cancelled = false
    api.get('/api/group-buy/products?status=active')
      .then(r => {
        if (cancelled) return
        const list = (r.data?.data || r.data || []) as Array<{ id: number; name: string; price: number; original_price?: number | null; image_url?: string | null; seller_id?: number; discount_rate?: number | null; current_price?: number | null }>
        const mine = (Array.isArray(list) ? list : [])
          .filter(p => Number(p.seller_id) === Number(sid) && Number(p.id) !== productId)
          .slice(0, 8)
          .map(p => ({ id: p.id, name: p.name, price: Number(p.current_price ?? p.price), original_price: p.original_price, image_url: p.image_url, discount_pct: p.discount_rate ?? null }))
        setOtherDeals(mine)
      })
      .catch(() => { /* silent */ })
    return () => { cancelled = true }
  }, [detail?.seller_id, productId])

  // 🛡️ 2026-05-15: 실시간 polling — 5초±2초 jitter. 페이지 hidden 시 일시정지 (배터리 보호 + D1 thundering herd 방어).
  //   active 공구만 polling. participant 카운터 + 신규 참여자 등장 → toast.
  useEffect(() => {
    if (!detail || (detail.group_buy_status !== 'active' && detail.group_buy_status !== 'achieved')) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    // 🎨 2026-06-16 리디자인(정직한 즉시구매): 참여수 toast·confetti 연출 제거 — 상태/가격 freshness 만 silent 갱신.
    const poll = async () => {
      if (document.hidden) return
      try {
        const d = await api.get(`/api/group-buy/products/${productId}`)
        if (d.data?.success) setDetail(d.data.data)
      } catch { /* silent */ }
    }
    // 🛡️ 2026-05-15 (TD-G07): jitter — 동시 사용자 많을 때 D1 thundering herd 방어
    //   2026-05-27: 마감까지 거리 기반 adaptive — 멀면 길게, 가까우면 짧게 (서버 부하 ↓, UX 유지).
    const jitter = () => {
      const deadlineMs = detail.group_buy_deadline ? new Date(detail.group_buy_deadline).getTime() - Date.now() : Infinity
      const base = deadlineMs > 86400000 ? 20000 : deadlineMs > 3600000 ? 10000 : 5000
      return base + Math.floor((Math.random() - 0.5) * base * 0.4)
    }
    const scheduleNext = () => {
      if (cancelled) return
      timer = setTimeout(async () => {
        await poll()
        scheduleNext()
      }, jitter())
    }
    scheduleNext()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [detail?.group_buy_status, productId])

  // 🛡️ 2026-05-30: 즉시판매 단일가 모델 — 단계별 tier 사다리 UI 제거 (design/groupbuy-instant-sale.md).
  //   공구가는 인원 무관 고정(최대 할인 적용)이라 group_buy_tiers 렌더링 불필요.

  // 🧭 2026-06-17: 즉시판매 단일가 모델 — 진행률 바/티어 사다리 제거 후 미사용이던 progress 변수 정리.
  const unitPrice = detail ? Math.round(detail.price * (1 - (detail.current_discount_pct || 0) / 100)) : 0
  const total = unitPrice * quantity
  // 🏭 2026-06-06 (사용자 요청 — 가격 설득력): 정가(있으면) 대비 실제 결제가 절약액 계산.
  //   기준가 = original_price(정가, MSRP) 가 있고 결제가보다 크면 그것, 없으면 공구 기준가(price).
  //   순수 파생값 — SSR/폴링/잠금 동작 불변(렌더 카피만 추가).
  const refPrice = detail
    ? (detail.original_price && detail.original_price > unitPrice ? detail.original_price : detail.price)
    : 0
  const unitSaving = Math.max(0, refPrice - unitPrice)
  const totalSaving = unitSaving * quantity
  const isJoinable = detail?.group_buy_status === 'active' || detail?.group_buy_status === 'achieved'

  // 🎨 2026-06-16 리디자인: 스와이프 갤러리 이미지 — image_url + detail_images/image_urls(JSON) 병합·중복제거.
  const galleryImages: string[] = (() => {
    if (!detail) return []
    const out: string[] = []
    if (detail.image_url) out.push(detail.image_url)
    const extra = detail as { detail_images?: string | null; image_urls?: string | null }
    for (const raw of [extra.image_urls, extra.detail_images]) {
      if (!raw) continue
      try { const arr = JSON.parse(raw); if (Array.isArray(arr)) for (const u of arr) if (typeof u === 'string' && u) out.push(u) } catch { /* not json */ }
    }
    return Array.from(new Set(out)).slice(0, 8)
  })()
  const onGalScroll = () => {
    const el = galRef.current; if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== activeImage) setActiveImage(i)
  }

  // 🎨 2026-06-16 리디자인: 할인코드(promo) 입력 UI 제거 — checkPromo/clearPromo 삭제.

  async function handleJoin() {
    if (!detail) return
    if (!isLoggedIn) {
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }

    // 🛡️ 2026-05-23: 교환권 (voucher 카테고리) 은 딜 결제, 그 외 (일반 공구 상품) 만 토스 결제.
    //   - meal_voucher / beauty_voucher / stay_voucher / etc_voucher / health_voucher / pet_voucher / activity_voucher → 딜
    //   - 일반 상품 (공구 할인 적용된 의류/잡화/식품 등) → 토스
    //   사용자 정책 (CLAUDE.md): "교환권을 딜로 거래하는 것 외에는 토스페이먼츠 결제"
    // 🛡️ 2026-05-23 v3: getProductFlow SSOT (src/shared/product-flow.ts) —
    //   voucher_deal vs group_buy_toss 단일 helper. legacy 카테고리 graceful + 미래 분류 1곳 수정.
    const { flow } = resolveProductFlow(detail)

    if (flow === 'voucher_deal') {
      // 딜 결제 흐름 (교환권 전용)
      setJoining(true)
      reportFunnel('click', productId)
      try {
        // 🛡️ 2026-06-11 (플로우 감사 갭#3/#3b): 서버가 이미 지원하는 안전장치 2개를 드디어 전송 —
        //   idempotency_key(이중탭/재시도 중복발급·이중차감 영구 차단, VoucherDetailPage:115 동일 패턴)
        //   + ref(?ref= 배너가 약속하는 양쪽 0.5% 보너스의 실제 지급 경로 — 미전송이면 무적립이었음).
        const { getTrackedSellerId } = await import('@/lib/seller-tracking')
        const ref = getTrackedSellerId() || undefined
        const idempotency_key = `gb_${productId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        const res = await api.post(`/api/group-buy/join/${productId}`, {
          quantity, payment_method: 'deal', ref, idempotency_key,
        })
        if (res.data?.success) {
          toast.success('🎁 교환권 발급 완료')
          fireAffiliateTrack(res?.data?.data?.order_id ?? null, Number(id), detail?.name) // 큐레이터 적립 (fail-soft)
          invalidateVouchers()
          navigate('/my-vouchers')
        } else {
          toast.error(res.data?.error || '교환 실패')
        }
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string; code?: string } } }
        const code = e?.response?.data?.code
        if (code === 'INSUFFICIENT_POINTS') {
          const charge = await confirmDialog('딜이 부족합니다. 충전 페이지로 이동할까요?')
          if (charge) {
            localStorage.setItem('loginReturnUrl', window.location.pathname)
            navigate('/points/charge')
          }
          return
        }
        toast.error(e?.response?.data?.error || '교환 실패')
      } finally {
        setJoining(false)
      }
      return
    }

    // 일반 공구 상품 (non-voucher) — 토스 결제 흐름
    setJoining(true)
    reportFunnel('click', productId)
    try {
      // 🛡️ 2026-06-11 (갭#3b): 토스 경로도 ref 전송 — init 응답 metadata 에 실려 confirm 까지 전파.
      const { getTrackedSellerId: getRef } = await import('@/lib/seller-tracking')
      const initRes = await api.post(`/api/group-buy/join/${productId}`, {
        quantity, payment_method: 'toss', ref: getRef() || undefined,
      })
      if (!initRes.data?.success) {
        toast.error(initRes.data?.error || '공구 결제 시작 실패')
        return
      }
      const { orderId, amount, orderName, clientKey: serverClientKey, flow: serverFlow } = initRes.data.data as { orderId: string; amount: number; orderName: string; clientKey?: string; flow?: 'redirect' | 'widget' | 'invalid' }
      if (!serverClientKey) {
        toast.error('결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요.')
        return
      }
      // 🛡️ 2026-05-23 belt-and-suspenders: 클라이언트도 키 형식 직접 감지 →
      //   server flow 가 캐시/오감지로 widget 키에 'redirect' 반환해도 강제로 widget 으로 보정.
      //   SDK 의 "결제위젯 연동 키는 지원하지 않습니다" 에러 영구 차단.
      const flow = resolveTossFlow(serverFlow, serverClientKey)
      if (flow === 'invalid') {
        toast.error('결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요.')
        return
      }

      // 🛡️ 2026-06-11 (갭#3b): ref 를 success URL 로 전파 → confirm 페이지가 confirm-toss body 에 전달
      //   (서버 :1009 는 이미 body.ref 검증·적립 지원 — 전달만 끊겨 있었음).
      const _ref = getRef() || ''
      const successQs = new URLSearchParams({ productId: String(productId), qty: String(quantity), ...(_ref ? { ref: _ref } : {}) }).toString()
      const failQs = new URLSearchParams({ productId: String(productId) }).toString()
      const successPath = `/group-buy/confirm-payment?${successQs}`
      const failPath = `/group-buy/${productId}?fail=1&${failQs}`

      // 🛡️ 2026-05-23 v7: 모든 키 widgets() API 경로 (payment V2 폐기 — 사용자 환경에서 작동 안 함).
      const params = new URLSearchParams({
        orderId,
        amount: String(amount),
        orderName,
        clientKey: serverClientKey,
        successUrl: successPath,
        failUrl: failPath,
      })
      navigate(`/pay/widget?${params.toString()}`)
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string; code?: string } }; code?: string; message?: string }
      if (e?.code === 'USER_CANCEL') return  // 사용자 명시 취소
      if (e?.response?.status === 429) {
        toast.error('잠시 후 다시 시도해주세요.')
        return
      }
      const msg = e?.response?.data?.error || e?.message || '참여 실패'
      toast.error(msg)
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    // 🛡️ 2026-05-15: 대기업 수준 skeleton — CLS 0, perceived performance 향상
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#121212]">
        {/* 🏭 2026-06-07: 투명 overlay 헤더 — solid 흰 바 깜빡임 없이 이미지가 최상단까지. */}
        <div
          className="fixed top-0 inset-x-0 z-30 px-3 flex items-center justify-between lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-[var(--app-frame)]"
          style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))', paddingBottom: '0.625rem' }}
        >
          <div className="w-9 h-9 rounded-full bg-black/25 backdrop-blur-sm animate-pulse" />
          <div className="w-9 h-9 rounded-full bg-black/25 backdrop-blur-sm animate-pulse" />
        </div>
        <div className="ur-content-narrow mx-auto">
          <div className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#1A1A1A] dark:to-[#0A0A0A] animate-pulse" />
        </div>
        <div className="ur-content-narrow mx-auto px-4 lg:px-8 py-4 space-y-4">
          <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-5 border border-gray-100 dark:border-[#1A1A1A] space-y-3">
            <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-gray-100 dark:bg-[#1A1A1A] rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-gray-100 dark:bg-[#1A1A1A] rounded animate-pulse" />
            <div className="pt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
              <div className="h-8 w-32 bg-gray-200 dark:bg-[#1A1A1A] rounded animate-pulse" />
            </div>
          </div>
          <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-5 border border-gray-100 dark:border-[#1A1A1A] space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-6 w-16 bg-gray-200 dark:bg-[#1A1A1A] rounded animate-pulse" />
            </div>
            <div className="h-3 w-full bg-gray-100 dark:bg-[#1A1A1A] rounded animate-pulse" />
          </div>
        </div>
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white">
        <p className="font-bold mb-3">상품을 찾을 수 없습니다</p>
        <button onClick={() => navigate('/group-buy')} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-bold">공구 목록으로</button>
      </div>
    )
  }

  return (
    <div className="gbd" style={{ background: 'var(--gbd-card)', color: 'var(--gbd-ink)', minHeight: '100vh' }}>
      {/* 🛡️ 2026-05-15: SEO 풀 적용 — JSON-LD Product/Offer schema + 동적 OG image */}
      <SEO
        title={`${detail.name} 공동구매 - ${detail.restaurant_name || '유어딜'}`}
        description={
          detail.current_discount_pct > 0
            ? `🎉 ${detail.current_discount_pct}% 할인! ${detail.restaurant_name || ''} ${detail.name} 공동구매 — ${detail.group_buy_current}명 함께 구매 중, ${unitPrice.toLocaleString('ko-KR')}원`
            : `${detail.restaurant_name || ''} ${detail.name} 공동구매 — ${detail.group_buy_current}명 함께 구매 중, ${detail.price.toLocaleString('ko-KR')}원`
        }
        url={`/group-buy/${productId}`}
        image={detail.image_url || `https://live.ur-team.com/api/og/group-buy/${productId}.png`}
        type="product"
        jsonLd={[{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: detail.name,
          description: detail.description || `${detail.restaurant_name || ''} ${detail.name} 공동구매`,
          image: detail.image_url ? [detail.image_url] : undefined,
          brand: detail.restaurant_name ? { '@type': 'Brand', name: detail.restaurant_name } : undefined,
          offers: {
            '@type': 'Offer',
            url: `https://live.ur-team.com/group-buy/${productId}`,
            priceCurrency: 'KRW',
            price: unitPrice,
            availability: detail.group_buy_status === 'active' || detail.group_buy_status === 'achieved'
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            priceValidUntil: detail.group_buy_deadline,
            seller: detail.seller_name ? { '@type': 'Organization', name: detail.seller_name } : undefined,
          },
          ...(detail.restaurant_lat && detail.restaurant_lng ? {
            address: detail.restaurant_address ? {
              '@type': 'PostalAddress',
              streetAddress: detail.restaurant_address,
              addressCountry: 'KR',
            } : undefined,
            geo: {
              '@type': 'GeoCoordinates',
              latitude: detail.restaurant_lat,
              longitude: detail.restaurant_lng,
            },
          } : {}),
        }, {
          // Breadcrumb
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '홈', item: 'https://live.ur-team.com/' },
            { '@type': 'ListItem', position: 2, name: '공동구매', item: 'https://live.ur-team.com/group-buy' },
            { '@type': 'ListItem', position: 3, name: detail.name, item: `https://live.ur-team.com/group-buy/${productId}` },
          ],
        }]}
      />

      {/* WCAG AA: skip-link */}
      <a href="#gb-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-gray-900 focus:text-white focus:px-3 focus:py-2 focus:rounded-lg focus:text-sm focus:font-bold">
        본문으로 건너뛰기
      </a>

      {/* 상단 chrome — 🏭 2026-06-07 (당근 스타일): 투명 overlay → 스크롤 시 solid 바 전환.
            position fixed 로 이미지 위에 floating, 데스크탑은 footer 와 동일 centering. */}
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-colors duration-200 lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-[var(--app-frame)] ${
          headerSolid
            ? 'bg-white/90 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]'
            : 'bg-transparent border-b border-transparent'
        }`}
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))', paddingBottom: '0.625rem' }}
        role="banner"
      >
        <div className="px-3 flex items-center justify-between gap-2">
          <button
            onClick={() => navigate(-1)}
            className={`w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-colors active:scale-95 focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white focus-visible:outline-none ${
              headerSolid ? 'hover:bg-gray-100 dark:hover:bg-[#1A1A1A]' : 'bg-black/25 backdrop-blur-sm'
            }`}
            aria-label="뒤로가기"
          >
            <ArrowLeft className={`w-5 h-5 transition-colors ${headerSolid ? 'text-gray-700 dark:text-gray-200' : 'text-white'}`} />
          </button>
          {/* 스크롤 시 fade-in 되는 가운데 제목 */}
          <h2
            className={`flex-1 min-w-0 text-center text-sm font-bold text-gray-900 dark:text-white truncate transition-opacity duration-200 ${
              headerSolid ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden={!headerSolid}
          >
            {detail.name}
          </h2>
          {/* 🛡️ 2026-06-12: 내 링크샵 핀 — 공유 옆 1탭 (ProductCard 의 PinButton 재사용) */}
          <PinButton
            productId={detail.id}
            price={detail.price}
            variant="detail-floating"
            className="!w-9 !h-9 shrink-0"
          />
          <KakaoShareButton
            title={`${detail.name} 공구 참여하기`}
            description={`${detail.restaurant_name ? detail.restaurant_name + ' · ' : ''}${detail.group_buy_current}명 함께 구매 중 · ${detail.current_discount_pct > 0 ? `${detail.current_discount_pct}% 할인` : '공동구매 특가'}${myUserId ? ' · 친구 초대 시 양쪽 0.5% 보너스 (첫 1회)' : ''}`}
            imageUrl={`https://live.ur-team.com/api/og/group-buy/${productId}`}
            link={shareLink}
            buttonText="나도 참여하기"
            compact
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-95 focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white ${
              headerSolid ? 'hover:bg-gray-100 dark:hover:bg-[#1A1A1A]' : 'bg-black/25 backdrop-blur-sm'
            }`}
          />
        </div>
      </header>

      {/* 🎨 2026-06-16 리디자인: 스와이프 이미지 갤러리 (fixed 헤더가 위에 floating) */}
      <div ref={heroRef} className="relative" style={{ background: 'var(--gbd-card)' }}>
        <div ref={galRef} onScroll={onGalScroll} className="noscroll" style={{ display: 'flex', overflowX: 'auto', aspectRatio: '1/1', scrollSnapType: 'x mandatory' }}>
          {(galleryImages.length ? galleryImages : ['']).map((src, i) => (
            <div key={i} role="img" aria-label={detail.name} className="flex items-center justify-center text-6xl" style={{ flex: '0 0 100%', scrollSnapAlign: 'center', backgroundColor: '#1a1a1a', backgroundImage: src ? `url("${cfImage(src, { width: 900, format: 'auto' }) || src}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
              {!src && <CategoryEmoji cat={detail.category} />}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 110, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,.4), transparent)' }} />
        <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: 120, pointerEvents: 'none', background: 'linear-gradient(0deg, rgba(0,0,0,.32), transparent)' }} />
        <div style={{ position: 'absolute', left: 16, bottom: 17, display: 'flex', alignItems: 'center', gap: 6 }}>
          {detail.current_discount_pct > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 6, background: 'var(--gbd-danger)', color: '#fff', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{detail.current_discount_pct}% 할인</span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 6, background: 'rgba(18,20,23,.5)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {({ meal_voucher: '식사권', beauty_voucher: '뷰티', health_voucher: '건강', pet_voucher: '반려', stay_voucher: '숙박', activity_voucher: '액티비티' } as Record<string, string>)[detail.category] || '교환권'}
          </span>
          {detail.group_buy_status === 'expired' && <span style={{ padding: '5px 9px', borderRadius: 6, background: 'rgba(55,55,55,.78)', color: '#fff', fontSize: 12, fontWeight: 700 }}>마감</span>}
          {detail.group_buy_status === 'cancelled' && <span style={{ padding: '5px 9px', borderRadius: 6, background: 'var(--gbd-danger)', color: '#fff', fontSize: 12, fontWeight: 700 }}>취소</span>}
        </div>
        {galleryImages.length > 1 && (
          <div style={{ position: 'absolute', right: 16, bottom: 19, display: 'flex', alignItems: 'center', gap: 5 }}>
            {galleryImages.map((_, i) => (
              <span key={i} style={{ height: 5, borderRadius: 99, transition: 'width .25s, background .25s', width: i === activeImage ? 16 : 5, background: i === activeImage ? '#fff' : 'rgba(255,255,255,.5)' }} />
            ))}
          </div>
        )}
      </div>

      <main id="gb-main" role="main">
        {/* 추천 진입 배너 (?ref=) — 어트리뷰션 유지 */}
        {isInfluencerLanding && (
          <div style={{ margin: '14px 18px 0', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--gbd-ink)', color: 'var(--gbd-card)' }}>
            <Sparkles style={{ width: 20, height: 20, flex: '0 0 auto' }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, opacity: .9, margin: 0 }}>친구 추천 공구</p>
              <p style={{ fontSize: 13.5, fontWeight: 800, margin: '2px 0 0' }}>참여 시 양쪽 0.5% 보너스 딜 🎁</p>
            </div>
          </div>
        )}

        {/* 타이틀 */}
        <div style={{ padding: '20px 18px 0' }}>
          {detail.restaurant_name && <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gbd-accent)', letterSpacing: '.01em' }}>{detail.restaurant_name} · 정식 등록 매장</div>}
          <h1 style={{ margin: '7px 0 0', fontSize: 22, lineHeight: 1.34, fontWeight: 800, letterSpacing: '-.025em', color: 'var(--gbd-ink)' }}>{detail.name}</h1>
          {(detail.restaurant_address || detail.restaurant_phone) && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 12 }}>
              <MapPin style={{ width: 17, height: 17, marginTop: 2, flex: '0 0 auto', color: 'var(--gbd-sub)' }} />
              <div style={{ fontSize: 13.5, color: 'var(--gbd-sub)', lineHeight: 1.5 }}>
                {detail.restaurant_address || ''}
                {detail.restaurant_phone && <> · <a href={`tel:${detail.restaurant_phone}`} style={{ color: 'var(--gbd-ink2)', textDecoration: 'none', fontWeight: 600, borderBottom: '1px solid var(--gbd-line2)' }}>{detail.restaurant_phone}</a></>}
              </div>
            </div>
          )}
        </div>

        {/* 가격 */}
        <div style={{ padding: '18px 18px 22px' }}>
          {unitSaving > 0 && <div style={{ fontSize: 13.5, color: 'var(--gbd-sub2)', textDecoration: 'line-through', letterSpacing: '-.01em' }}>{formatNumber(refPrice)}원</div>}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 3 }}>
            {detail.current_discount_pct > 0 && <span style={{ fontSize: 27, fontWeight: 800, color: 'var(--gbd-danger)', letterSpacing: '-.03em' }}>{detail.current_discount_pct}%</span>}
            <span style={{ fontSize: 30, fontWeight: 900, color: 'var(--gbd-ink)', letterSpacing: '-.035em' }}>{formatNumber(unitPrice)}원</span>
          </div>
          <div style={{ marginTop: 9, fontSize: 13, color: 'var(--gbd-ink2)', fontWeight: 500 }}>{unitSaving > 0 && <>1매당 <b style={{ fontWeight: 800, color: 'var(--gbd-danger)' }}>{formatNumber(unitSaving)}원</b> 저렴 · </>}결제 즉시 교환권 발급</div>
        </div>

        <div style={{ height: 8, background: 'var(--gbd-bg)' }} />

        {/* 셀러 (컴팩트) + SNS */}
        {detail.seller_name && (() => {
          const snsLinks = [
            detail.seller_instagram && { icon: Instagram, url: detail.seller_instagram, label: 'Instagram' },
            detail.seller_youtube && { icon: Youtube, url: detail.seller_youtube, label: 'YouTube' },
            detail.seller_tiktok && { icon: Music2, url: detail.seller_tiktok, label: 'TikTok' },
            detail.seller_facebook && { icon: Facebook, url: detail.seller_facebook, label: 'Facebook' },
          ].filter(Boolean) as { icon: typeof Instagram; url: string; label: string }[]
          const normalizeUrl = (u: string) => /^https?:\/\//i.test(u) ? u : `https://${u}`
          return (
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {detail.seller_avatar
                  ? <div role="img" aria-label={detail.seller_name} style={{ width: 44, height: 44, borderRadius: '50%', flex: '0 0 auto', backgroundColor: 'var(--gbd-chip)', backgroundImage: `url("${cfImage(detail.seller_avatar, { width: 120, format: 'auto' }) || detail.seller_avatar}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  : <div style={{ width: 44, height: 44, borderRadius: '50%', flex: '0 0 auto', background: 'var(--gbd-chip)' }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--gbd-ink)', whiteSpace: 'nowrap' }}>{detail.seller_name}</span>
                    <CheckCircle2 style={{ width: 15, height: 15, color: 'var(--gbd-accent)', flex: '0 0 auto' }} />
                    <span style={{ fontSize: 12, color: 'var(--gbd-sub)', whiteSpace: 'nowrap' }}>검증 셀러</span>
                  </div>
                  {detail.seller_username && <div style={{ fontSize: 12.5, color: 'var(--gbd-sub)', marginTop: 2 }}>@{detail.seller_username}</div>}
                </div>
                <button onClick={() => { const t = detail.seller_username || detail.seller_id; if (t) navigate(`/profile/${t}`) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 1, padding: '8px 12px', border: '1px solid var(--gbd-line2)', borderRadius: 10, background: 'var(--gbd-card)', color: 'var(--gbd-ink2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
                  프로필<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
              {snsLinks.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  {snsLinks.map(({ icon: Icon, url, label }) => (
                    <a key={label} href={normalizeUrl(url)} target="_blank" rel="noopener noreferrer" aria-label={label} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gbd-chip)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gbd-ink)' }}>
                      <Icon style={{ width: 16, height: 16 }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        <div style={{ height: 8, background: 'var(--gbd-bg)' }} />

        {/* 신뢰 인라인 스트립 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px' }}>
          {[
            { title: '안전결제', sub: '토스페이먼츠' },
            { title: '정식판매', sub: '검증 셀러' },
            { title: '환불보장', sub: '안심거래' },
          ].map((tr) => (
            <div key={tr.title} style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <ShieldCheck style={{ width: 16, height: 16, flex: '0 0 auto', color: 'var(--gbd-ink)' }} />
              <div style={{ lineHeight: 1.25, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gbd-ink)', whiteSpace: 'nowrap' }}>{tr.title}</div>
                <div style={{ fontSize: 11, color: 'var(--gbd-sub)', whiteSpace: 'nowrap' }}>{tr.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ height: 8, background: 'var(--gbd-bg)' }} />

        {/* 상품 안내 */}
        <div style={{ padding: '22px 18px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gbd-ink)', letterSpacing: '-.02em' }}>상품 안내</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 13 }}>
            {['즉시 교환권 발급', '전 지점 사용', detail.voucher_expiry ? `${new Date(detail.voucher_expiry).toLocaleDateString('ko-KR')}까지` : '결제 즉시 사용'].map((chip) => (
              <span key={chip} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 99, border: '1px solid var(--gbd-line2)', fontSize: 12.5, fontWeight: 600, color: 'var(--gbd-ink2)', whiteSpace: 'nowrap' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gbd-accent)' }} />{chip}
              </span>
            ))}
          </div>
          {detail.description && <p style={{ margin: '14px 0 0', fontSize: 14.5, lineHeight: 1.72, color: 'var(--gbd-ink2)', whiteSpace: 'pre-line' }}>{detail.description}</p>}
        </div>

        {/* 대표 메뉴 — 백엔드 menu 데이터 있을 때만 (data-gate; docs/design/group-buy-detail.md) */}
        {(() => {
          const menuItems = ((detail as { menu?: Array<{ name: string; desc?: string; price?: string; image?: string; hot?: boolean }> }).menu) || []
          if (!menuItems.length) return null
          return (
            <>
              <div style={{ height: 8, background: 'var(--gbd-bg)' }} />
              <div style={{ padding: '22px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gbd-ink)', letterSpacing: '-.02em' }}>대표 메뉴</div>
                  <span style={{ fontSize: 12, color: 'var(--gbd-sub)' }}>식사권으로 주문 가능</span>
                </div>
                <div style={{ marginTop: 8, borderBottom: '1px solid var(--gbd-line2)' }}>
                  {menuItems.map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 0', borderTop: '1px solid var(--gbd-line2)' }}>
                      <div style={{ width: 56, height: 56, borderRadius: 11, flex: '0 0 auto', backgroundColor: 'var(--gbd-chip)', backgroundImage: m.image ? `url("${cfImage(m.image, { width: 120, format: 'auto' }) || m.image}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--gbd-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                          {m.hot && <span style={{ flex: '0 0 auto', padding: '2px 6px', borderRadius: 5, background: 'var(--gbd-danger-soft)', color: 'var(--gbd-danger)', fontSize: 10.5, fontWeight: 800 }}>인기</span>}
                        </div>
                        {m.desc && <div style={{ fontSize: 12.5, color: 'var(--gbd-sub)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.desc}</div>}
                      </div>
                      {m.price && <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gbd-ink)', whiteSpace: 'nowrap' }}>{m.price}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )
        })()}

        {/* 매장 위치 — RestaurantMiniMap(잠금 lazy) + 주소 카드 + 길찾기 */}
        {(detail.restaurant_address || (detail.restaurant_lat && detail.restaurant_lng)) && (
          <>
            <div style={{ height: 8, background: 'var(--gbd-bg)' }} />
            <div style={{ padding: '22px 18px' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gbd-ink)', letterSpacing: '-.02em', marginBottom: 13 }}>매장 위치</div>
              <div style={{ borderRadius: '14px 14px 0 0', overflow: 'hidden', border: '1px solid var(--gbd-line2)', borderBottom: 'none' }}>
                <Suspense fallback={<div style={{ height: 172, background: 'var(--gbd-chip)' }} />}>
                  <RestaurantMiniMap name={detail.restaurant_name} address={detail.restaurant_address} lat={detail.restaurant_lat} lng={detail.restaurant_lng} />
                </Suspense>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', border: '1px solid var(--gbd-line2)', borderTop: 'none', borderRadius: '0 0 14px 14px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {detail.restaurant_name && <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--gbd-ink)', whiteSpace: 'nowrap' }}>{detail.restaurant_name}</div>}
                  {detail.restaurant_address && <div style={{ fontSize: 12.5, color: 'var(--gbd-sub)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail.restaurant_address}</div>}
                </div>
                <a
                  href={`https://map.kakao.com/link/${detail.restaurant_lat && detail.restaurant_lng ? `to/${encodeURIComponent(detail.restaurant_name || '매장')},${detail.restaurant_lat},${detail.restaurant_lng}` : `search/${encodeURIComponent(detail.restaurant_address || detail.restaurant_name || '')}`}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 14px', border: '1px solid var(--gbd-line2)', borderRadius: 11, background: 'var(--gbd-card)', color: 'var(--gbd-ink)', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flex: '0 0 auto' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gbd-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z" /></svg>
                  길찾기
                </a>
              </div>
            </div>
          </>
        )}

        {/* 본인 product CTA (셀러 대시보드 진입) */}
        {isOwnProduct && (
          <div style={{ margin: '0 18px 14px', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', border: '1px solid var(--gbd-line2)', borderRadius: 14 }}>
            <Sparkles style={{ width: 18, height: 18, flex: '0 0 auto', color: 'var(--gbd-ink)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gbd-ink)', margin: 0 }}>내 공구</p>
              <p style={{ fontSize: 11.5, color: 'var(--gbd-sub)', margin: '2px 0 0' }}>대시보드에서 통계 / 정산 확인</p>
            </div>
            <button onClick={() => navigate('/seller/group-buy')} style={{ padding: '8px 12px', background: 'var(--gbd-cta-bg)', color: 'var(--gbd-cta-fg)', border: 'none', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flex: '0 0 auto' }}>공구 관리 →</button>
          </div>
        )}

        <div style={{ height: 8, background: 'var(--gbd-bg)' }} />

        {/* 이용 안내 — 헤어라인 스펙표 + 점불릿 유의사항 */}
        <div style={{ padding: '22px 18px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gbd-ink)', letterSpacing: '-.02em' }}>이용 안내</div>
          <div style={{ marginTop: 15 }}>
            {[
              { k: '사용기한', v: detail.voucher_expiry ? `${new Date(detail.voucher_expiry).toLocaleDateString('ko-KR')} 까지` : '발급 후 사용 기간 적용' },
              { k: '사용처', v: detail.restaurant_name || '전 지점' },
              { k: '사용 방법', v: '매장에서 교환권 제시' },
            ].map((row, i, arr) => (
              <div key={row.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderTop: '1px solid var(--gbd-line2)', borderBottom: i === arr.length - 1 ? '1px solid var(--gbd-line2)' : 'none' }}>
                <span style={{ fontSize: 13.5, color: 'var(--gbd-sub)', whiteSpace: 'nowrap' }}>{row.k}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--gbd-ink)' }}>{row.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(detail.voucher_terms
              ? detail.voucher_terms.split('\n').map(s => s.trim()).filter(Boolean)
              : ['현장에서 추가 할인이나 다른 쿠폰과 중복 적용되지 않아요.', '잔액은 환불되지 않으니 한 번에 사용하시길 권장해요.']
            ).map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{ flex: '0 0 auto', width: 4, height: 4, borderRadius: '50%', background: 'var(--gbd-sub2)', marginTop: 8 }} />
                <span style={{ fontSize: 13, color: 'var(--gbd-sub)', lineHeight: 1.5 }}>{line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 후기·평점 — 신뢰 레버 (디자이너 후속 제안). 기존 ProductReviews 재사용(lazy, 빈 상태/작성 폼 내장). */}
        <div style={{ height: 8, background: 'var(--gbd-bg)' }} />
        <div style={{ padding: '22px 18px' }}>
          <Suspense fallback={<div style={{ height: 80, background: 'var(--gbd-chip)', borderRadius: 12 }} />}>
            <ProductReviews productId={productId} limit={5} />
          </Suspense>
        </div>

        {/* 이 셀러의 다른 공구 — 가로 스크롤 */}
        {otherDeals.length > 0 && (
          <>
            <div style={{ height: 8, background: 'var(--gbd-bg)' }} />
            <div style={{ padding: '22px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gbd-ink)', letterSpacing: '-.02em' }}>이 셀러의 다른 공구</div>
                {detail.seller_username && <a href={`/profile/${detail.seller_username}`} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gbd-accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>전체보기</a>}
              </div>
              <div className="noscroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '14px 18px 2px', scrollSnapType: 'x proximity' }}>
                {otherDeals.map((o) => {
                  const pct = o.discount_pct || (o.original_price && o.original_price > o.price ? Math.round((1 - o.price / o.original_price) * 100) : 0)
                  return (
                    <a key={o.id} href={`/group-buy/${o.id}`} style={{ flex: '0 0 152px', textDecoration: 'none', scrollSnapAlign: 'start' }}>
                      <div style={{ position: 'relative', width: 152, height: 152, borderRadius: 14, overflow: 'hidden', backgroundColor: 'var(--gbd-chip)', backgroundImage: o.image_url ? `url("${cfImage(o.image_url, { width: 300, format: 'auto' }) || o.image_url}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                        {pct > 0 && <span style={{ position: 'absolute', left: 8, top: 8, padding: '3px 7px', borderRadius: 6, background: 'var(--gbd-danger)', color: '#fff', fontSize: 11, fontWeight: 800 }}>{pct}%</span>}
                      </div>
                      <div style={{ marginTop: 9, fontSize: 13, fontWeight: 600, color: 'var(--gbd-ink)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 4 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--gbd-ink)' }}>{formatNumber(o.price)}원</span>
                        {o.original_price && o.original_price > o.price && <span style={{ fontSize: 11.5, color: 'var(--gbd-sub2)', textDecoration: 'line-through' }}>{formatNumber(o.original_price)}원</span>}
                      </div>
                    </a>
                  )
                })}
              </div>
            </div>
          </>
        )}

        <div style={{ height: 112 }} />
      </main>

      {/* 🎨 2026-06-16 리디자인 결제 푸터 — 할인중 + 수량 스테퍼 + 안심 카피 + 잉크블랙 '구매하기'.
            fixed + 프레임 정렬(lg) 유지 (BottomNav z-9999 위). gbd 자손이라 var() 상속. */}
      <footer
        className="fixed bottom-0 inset-x-0 z-[10002] lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-[var(--app-frame)] lg:rounded-t-2xl"
        style={{ background: 'var(--gbd-card)', borderTop: '1px solid var(--gbd-line2)', padding: '11px 16px calc(13px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px -18px rgba(0,0,0,.3)' }}
        role="contentinfo" aria-label="결제 영역"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gbd-danger)', whiteSpace: 'nowrap' }}>
            {isJoinable && totalSaving > 0 ? (quantity > 1 ? `총 ${formatNumber(totalSaving)}원 할인 중` : `${formatNumber(unitSaving)}원 할인 중`) : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--gbd-line2)', borderRadius: 10, overflow: 'hidden' }} role="group" aria-label="수량 조절">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={!isJoinable || quantity <= 1} aria-label="수량 감소" style={{ width: 32, height: 32, border: 'none', background: 'var(--gbd-card)', color: 'var(--gbd-ink)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!isJoinable || quantity <= 1) ? .4 : 1 }}>−</button>
            <span style={{ minWidth: 30, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--gbd-ink)' }} aria-live="polite" aria-label={`현재 ${quantity}장`}>{quantity}</span>
            <button onClick={() => setQuantity(q => Math.min(10, q + 1))} disabled={!isJoinable || quantity >= 10} aria-label="수량 증가" style={{ width: 32, height: 32, border: 'none', background: 'var(--gbd-card)', color: 'var(--gbd-ink)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!isJoinable || quantity >= 10) ? .4 : 1 }}>+</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 9 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gbd-sub)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          <span style={{ fontSize: 11.5, color: 'var(--gbd-sub)', fontWeight: 500, whiteSpace: 'nowrap' }}>토스로 3초 안전결제 · 미사용 시 100% 자동환불</span>
        </div>
        <button
          onClick={handleJoin}
          disabled={!isJoinable || joining}
          aria-label={isJoinable ? `${formatNumber(total)}원 구매하기` : '구매 불가'}
          style={{ width: '100%', height: 53, border: 'none', borderRadius: 14, background: isJoinable ? 'var(--gbd-cta-bg)' : 'var(--gbd-sub2)', color: 'var(--gbd-cta-fg)', fontSize: 16, fontWeight: 800, letterSpacing: '-.01em', cursor: isJoinable ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
        >
          {joining ? '처리 중…' : !isJoinable ? '구매 불가' : <>{formatNumber(total)}원 구매하기<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></>}
        </button>
      </footer>
    </div>
  )
}
