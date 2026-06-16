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
import { reportFunnel } from '@/lib/web-vitals-report'
import { recordRecentlyViewed } from '@/components/group-buy/RecentlyViewedStrip'
import { useInvalidateMyVouchers } from '@/hooks/queries'

// 🛡️ 2026-05-27 (loading P1): below-fold 컴포넌트 lazy — 초기 chunk 30-50KB ↓.
//   - Confetti: 100% 달성 시만 표시 (대부분 사용자 안 봄)
//   - RestaurantMiniMap: 매장 정보 아래 (fold 직후, Kakao Maps SDK 포함)
const Confetti = lazy(() => import('@/components/group-buy/Confetti'))
const RestaurantMiniMap = lazy(() => import('@/components/RestaurantMiniMap'))

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
  next_tier?: { min: number; discount_pct: number } | null
  next_tier_remaining?: number | null
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

function CountdownRing({ deadline }: { deadline?: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!deadline) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = () => {
      const ts = Date.now()
      setNow(ts)
      const remain = Math.max(0, new Date(deadline).getTime() - ts)
      if (remain === 0) return
      // 1일+ 남으면 60초 단위 (분 표시), 1시간+ 5초 단위, 마감 임박 1초 단위.
      const next = remain > 86400000 ? 60000 : remain > 3600000 ? 5000 : 1000
      timer = setTimeout(tick, next)
    }
    tick()
    return () => { if (timer) clearTimeout(timer) }
  }, [deadline])
  if (!deadline) return null
  const end = new Date(deadline).getTime()
  const diff = Math.max(0, end - now)
  if (diff === 0) return <span className="text-red-500 font-bold">마감됨</span>
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  const urgent = diff < 24 * 3600000
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${urgent ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-amber-50 text-amber-700'}`}>
      <Clock className="w-3 h-3" />
      {days > 0 ? `${days}일 ${hours}시간 남음` : `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} 남음`}
    </div>
  )
}

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
  const [showConfetti, setShowConfetti] = useState(false)
  // 🛡️ 2026-05-15: Promo 코드 입력 + 미리보기
  const [promoCode, setPromoCode] = useState('')
  const [promoPreview, setPromoPreview] = useState<{ discount_pct: number; audience: string; description: string | null } | null>(null)
  const [promoError, setPromoError] = useState('')
  const [checkingPromo, setCheckingPromo] = useState(false)
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

  // 🛡️ 2026-05-15: 실시간 polling — 5초±2초 jitter. 페이지 hidden 시 일시정지 (배터리 보호 + D1 thundering herd 방어).
  //   active 공구만 polling. participant 카운터 + 신규 참여자 등장 → toast.
  useEffect(() => {
    if (!detail || (detail.group_buy_status !== 'active' && detail.group_buy_status !== 'achieved')) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false
    let lastCount = detail.group_buy_current
    let prevParticipantNames = participants.slice(0, 5).map(p => p.masked_name).join(',')

    const poll = async () => {
      if (document.hidden) return
      try {
        const [d, p] = await Promise.all([
          api.get(`/api/group-buy/products/${productId}`),
          api.get(`/api/group-buy/products/${productId}/participants`).catch(() => ({ data: { data: [] } })),
        ])
        if (d.data?.success) {
          const newDetail = d.data.data
          const delta = newDetail.group_buy_current - lastCount
          if (delta > 0) {
            toast.success(`🎉 방금 ${delta}명이 참여했어요!`)
            // 🛡️ 2026-05-15: 100% 달성 감지 시 confetti
            const wasBelow = lastCount < newDetail.group_buy_target
            const nowReached = newDetail.group_buy_current >= newDetail.group_buy_target
            if (wasBelow && nowReached && newDetail.group_buy_target > 0) {
              setShowConfetti(true)
              try { if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]) } catch { /* unsupported */ }
            }
            lastCount = newDetail.group_buy_current
          }
          setDetail(newDetail)
        }
        if (p.data?.data) {
          const newParticipants = p.data.data
          const newNamesKey = newParticipants.slice(0, 5).map((np: Participant) => np.masked_name).join(',')
          if (newNamesKey !== prevParticipantNames) {
            prevParticipantNames = newNamesKey
            setParticipants(newParticipants)
          }
        }
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

  const progress = detail && detail.group_buy_target > 0
    ? Math.min(100, (detail.group_buy_current / detail.group_buy_target) * 100)
    : 0
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

  async function checkPromo() {
    setPromoError('')
    setPromoPreview(null)
    const code = promoCode.trim().toUpperCase()
    if (!/^[A-Z0-9]{4,20}$/.test(code)) {
      setPromoError('영문 대문자 + 숫자 4-20자')
      return
    }
    setCheckingPromo(true)
    try {
      const res = await api.post('/api/promo/redeem', { code, product_id: productId })
      if (res.data?.success) {
        const d = res.data.data
        // 셀러 매칭 확인 — 서버에서 검증되지만 클라이언트도 확인
        if (detail && d.seller_id !== detail.seller_id) {
          setPromoError('이 셀러 상품이 아닌 코드')
          return
        }
        setPromoPreview({ discount_pct: d.discount_pct, audience: 'all', description: d.message || null })
        toast.success(`✅ ${d.discount_pct}% 할인 적용 가능`)
      } else {
        setPromoError(res.data?.error || '사용 불가')
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: string; code?: string } } }
      const errCode = e?.response?.data?.code
      setPromoError(e?.response?.data?.error || '코드 확인 실패')
      if (errCode === 'FOLLOWERS_ONLY') {
        // 단골 등록 안 됨 — 단골 등록 유도
      }
    } finally {
      setCheckingPromo(false)
    }
  }

  function clearPromo() {
    setPromoCode('')
    setPromoPreview(null)
    setPromoError('')
  }

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
          promo_code: promoPreview ? promoCode.trim().toUpperCase() : undefined,
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
        promo_code: promoPreview ? promoCode.trim().toUpperCase() : undefined,
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
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212]">
      {showConfetti && (
        <Suspense fallback={null}>
          <Confetti onDone={() => setShowConfetti(false)} />
        </Suspense>
      )}
      {/* 🛡️ 2026-05-15: SEO 풀 적용 — JSON-LD Product/Offer schema + 동적 OG image */}
      <SEO
        title={`${detail.name} 공동구매 - ${detail.restaurant_name || '유어딜'}`}
        description={
          detail.current_discount_pct > 0
            ? `🎉 ${detail.current_discount_pct}% 할인 진행 중! ${detail.restaurant_name || ''} ${detail.name} 공동구매 — ${detail.group_buy_current}/${detail.group_buy_target}명 참여, ${unitPrice.toLocaleString('ko-KR')}원`
            : `${detail.restaurant_name || ''} ${detail.name} 공동구매 — ${detail.group_buy_current}/${detail.group_buy_target}명 참여 중, ${detail.price.toLocaleString('ko-KR')}원부터`
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
            description={`${detail.restaurant_name ? detail.restaurant_name + ' · ' : ''}${detail.group_buy_current}/${detail.group_buy_target}명 참여 중 · ${detail.current_discount_pct > 0 ? `${detail.current_discount_pct}% 할인` : '공동구매 특가'}${myUserId ? ' · 친구 초대 시 양쪽 0.5% 보너스 (첫 1회)' : ''}`}
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

      {/* 이미지 + 상태 — 🏭 2026-06-07 (당근 스타일): 최상단까지 닿는 full-bleed hero.
            content flow 의 첫 요소 — overlay 헤더가 그 위에 floating. */}
      <div ref={heroRef} className="ur-content-narrow mx-auto relative bg-white dark:bg-[#0A0A0A] overflow-hidden">
        {detail.image_url ? (
          <img
            src={detail.image_url}
            alt={detail.name}
            className="w-full aspect-square object-cover bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#1A1A1A] dark:to-[#0A0A0A]"
            width={1200}
            height={1200}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        ) : (
          <div className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#1A1A1A] dark:to-[#0A0A0A] flex items-center justify-center text-6xl">
            <CategoryEmoji cat={detail.category} />
          </div>
        )}
        {/* 상단 scrim — 흰 버튼/배지 가독성 보장 (밝은 사진 대응) */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />
        {/* 카테고리/상태 배지 — 헤더 버튼과 충돌 방지 위해 좌하단 배치 */}
        <div className="absolute bottom-3 left-3 flex gap-2">
          <span className="bg-black/35 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <CategoryEmoji cat={detail.category} />
            <span className="text-white">{detail.category.replace('_voucher', '')}</span>
          </span>
          {detail.group_buy_status === 'achieved' && (
            <span className="bg-green-500 text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 달성
            </span>
          )}
          {detail.group_buy_status === 'expired' && (
            <span className="bg-gray-700 text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">마감</span>
          )}
          {detail.group_buy_status === 'cancelled' && (
            <span className="bg-red-500 text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">취소</span>
          )}
        </div>
        {/* CountdownRing — 우하단 (우상단 share 버튼과 분리) */}
        <div className="absolute bottom-3 right-3">
          <CountdownRing deadline={detail.group_buy_deadline} />
        </div>
      </div>

      <main id="gb-main" className="ur-content-narrow mx-auto px-4 lg:px-8 py-4 space-y-4" role="main">
        {/* 🛡️ 2026-05-15: 인플루언서 attribution 배너 (?ref= 진입 시) — hero 아래로 이동 */}
        {isInfluencerLanding && (
          <div className="bg-gray-900 text-white rounded-2xl p-3 flex items-center gap-3 shadow-lg">
            <Sparkles className="w-5 h-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold opacity-90">친구 추천 공구</p>
              <p className="text-sm font-extrabold">참여 시 양쪽 0.5% 보너스 딜 🎁</p>
            </div>
          </div>
        )}

        {/* 제품 정보 */}
        <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-5 border border-gray-100 dark:border-[#1A1A1A] space-y-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{detail.name}</h1>
          {detail.restaurant_name && (
            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-200">{detail.restaurant_name}</p>
                {detail.restaurant_address && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{detail.restaurant_address}</p>}
              </div>
            </div>
          )}
          {detail.restaurant_phone && (
            <a href={`tel:${detail.restaurant_phone}`} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
              <Phone className="w-4 h-4 text-gray-400" />
              <span>{detail.restaurant_phone}</span>
            </a>
          )}

          {/* 가격 — 🛡️ 2026-05-19: 공동구매는 소비자 구매라 '원' 단위. (교환권만 '딜')
                🏭 2026-06-06 (사용자 요청): '정가 대비 N,NNN원 절약' 체감 금액 강조 — 전환 설득력 ↑. */}
          <div className="pt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
            {/* 정가(취소선) → 할인 판매가. 사용자 요청: "기존에는 얼마인데 얼마에 판다" 명확화 */}
            {unitSaving > 0 && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">정가</span>
                <span className="text-sm text-gray-400 dark:text-gray-500 line-through">{formatNumber(refPrice)}원</span>
              </div>
            )}
            <div className="flex items-baseline gap-2">
              {detail.current_discount_pct > 0 && (
                <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{detail.current_discount_pct}%</span>
              )}
              <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{formatNumber(unitPrice)}</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">원</span>
              {unitSaving > 0 && (
                <span className="ml-auto bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-2 py-0.5 rounded-md text-[11px] font-bold">
                  {formatNumber(unitSaving)}원 할인
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 🏭 2026-06-07 (사용자 요청): 이 공구를 올린 셀러가 작성한 안내 내용을 안내문구처럼 노출. */}
        {detail.description && (
          <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-5 border border-gray-100 dark:border-[#1A1A1A]">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">공구 안내</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">{detail.description}</p>
          </div>
        )}

        {/* 🏭 2026-06-06 (사용자 요청 — 구매 신뢰도): 안전결제·정품·환불 trust 배지 줄. 정적(데이터 무관). */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: ShieldCheck, label: '안전결제', sub: '토스페이먼츠' },
            { icon: CheckCircle2, label: '정식 판매', sub: '검증 셀러' },
            { icon: RefreshCcw, label: '안심 거래', sub: '환불 정책 보장' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="bg-white dark:bg-[#0A0A0A] rounded-xl border border-gray-100 dark:border-[#1A1A1A] py-2.5 px-2 flex flex-col items-center text-center gap-1">
              <Icon className="w-4 h-4 text-gray-900 dark:text-white" />
              <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100 leading-none">{label}</span>
              <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-none">{sub}</span>
            </div>
          ))}
        </div>

        {/* 🛡️ 2026-05-17: 매장 위치 미니 지도 — 매장 기반 voucher 의 위치 발견성 향상.
              restaurant_lat/lng 우선 사용, 없으면 address 로 geocoding. */}
        {(detail.restaurant_address || (detail.restaurant_lat && detail.restaurant_lng)) && (
          <Suspense fallback={<div className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A]" style={{ height: 200 }} />}>
            <RestaurantMiniMap
              name={detail.restaurant_name}
              address={detail.restaurant_address}
              lat={detail.restaurant_lat}
              lng={detail.restaurant_lng}
            />
          </Suspense>
        )}

        {/* 🏭 2026-06-07 (사용자 요청): 진행 현황(참여율/목표) + 참여자 아바타 제거 —
            공구는 1인이라도 즉시 구매 가능(즉시판매 단일가)하므로 참여 인원 진척도가 무의미. */}

        {/* 🛡️ 2026-05-15: 본인 product 인 경우 셀러 대시보드 진입점 (공구 플로우 활용도 ↑) */}
        {isOwnProduct && (
          <div className="bg-gray-50 dark:bg-[#141414] border-2 border-gray-200 dark:border-[#2A2A2A] rounded-2xl p-4 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-gray-900 dark:text-white shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900 dark:text-white">내 공구</p>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5">대시보드에서 voucher 통계 / 정산 확인</p>
            </div>
            <button
              onClick={() => navigate('/seller/group-buy')}
              className="px-3 py-1.5 bg-gray-900 dark:bg-white hover:bg-black dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-xs font-bold shrink-0"
            >
              공구 관리 →
            </button>
          </div>
        )}

        {/* 🏭 2026-06-07 (사용자 요청): 할인 코드(선택) 입력 제거. */}

        {/* 셀러 정보 + SNS — 🛡️ 2026-05-27 사용자 요청: 채팅/매너온도 X, SNS 만 */}
        {detail.seller_name && (() => {
          const snsLinks = [
            detail.seller_instagram && { icon: Instagram, url: detail.seller_instagram, label: 'Instagram', color: 'text-gray-900 dark:text-white' },
            detail.seller_youtube && { icon: Youtube, url: detail.seller_youtube, label: 'YouTube', color: 'text-red-500' },
            detail.seller_tiktok && { icon: Music2, url: detail.seller_tiktok, label: 'TikTok', color: 'text-gray-900 dark:text-white' },
            detail.seller_facebook && { icon: Facebook, url: detail.seller_facebook, label: 'Facebook', color: 'text-blue-600' },
          ].filter(Boolean) as { icon: typeof Instagram; url: string; label: string; color: string }[]
          // 외부 URL 정규화 — http:// 없으면 자동 추가
          const normalizeUrl = (u: string) => /^https?:\/\//i.test(u) ? u : `https://${u}`
          return (
            <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] overflow-hidden">
              <button
                onClick={() => {
                  const target = detail.seller_username || detail.seller_id
                  if (target) navigate(`/profile/${target}`)
                }}
                className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-[#121212] transition-colors"
              >
                {detail.seller_avatar ? (
                  <img src={detail.seller_avatar} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-[#2A2A2A] dark:to-[#1A1A1A]" />
                )}
                <div className="flex-1 text-left">
                  <p className="text-xs text-gray-500 dark:text-gray-400">판매자</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{detail.seller_name}</p>
                </div>
                <span className="text-xs text-gray-400">프로필 →</span>
              </button>
              {snsLinks.length > 0 && (
                <div className="flex items-center gap-2 px-4 pb-3 -mt-1">
                  {snsLinks.map(({ icon: Icon, url, label, color }) => (
                    <a
                      key={label}
                      href={normalizeUrl(url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className={`w-9 h-9 rounded-full bg-gray-50 dark:bg-[#1A1A1A] flex items-center justify-center ${color} hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors`}
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* 사용 안내 */}
        {detail.voucher_terms && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> 사용 안내
            </p>
            <p className="text-xs text-amber-800 whitespace-pre-line leading-relaxed">{detail.voucher_terms}</p>
          </div>
        )}

        {detail.voucher_expiry && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center">
            바우처 사용 기한: {new Date(detail.voucher_expiry).toLocaleDateString('ko-KR')}
          </p>
        )}

        {/* 🏭 2026-06-07 (사용자 요청): 공구 상품 상세에서 리뷰 섹션 제거. */}

        <div style={{ height: 100 }} />
      </main>

      {/* sticky 하단 결제 영역 — BottomNav (z-9999) 위로 올림 + BottomNav 높이만큼 ur-content padding 적용됨 */}
      <footer className="fixed bottom-0 inset-x-0 bg-white dark:bg-[#0A0A0A] border-t border-gray-200 dark:border-[#2A2A2A] p-3 z-[10002] lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-[var(--app-frame)] lg:rounded-t-2xl lg:shadow-xl" role="contentinfo" aria-label="결제 영역">
        {/* 🏭 2026-06-06 (사용자 요청 — 가격 설득력): 결제 직전 절약액 강조. 수량 변경 시 실시간 갱신. */}
        {isJoinable && totalSaving > 0 && (
          <div className="flex items-center justify-between mb-2 px-0.5">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              정가 <span className="line-through">{formatNumber(refPrice * quantity)}원</span>
            </span>
            <span className="text-[11px] font-bold text-gray-900 dark:text-white">
              {formatNumber(totalSaving)}원 절약
            </span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 dark:bg-[#1A1A1A] rounded-lg overflow-hidden" role="group" aria-label="수량 조절">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={!isJoinable || quantity <= 1}
              className="w-9 h-9 flex items-center justify-center text-gray-700 dark:text-gray-200 disabled:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white focus-visible:outline-none"
              aria-label="수량 감소"
            >−</button>
            <span className="w-10 text-center text-sm font-bold text-gray-900 dark:text-white" aria-live="polite" aria-label={`현재 ${quantity}장`}>{quantity}</span>
            <button
              onClick={() => setQuantity(q => Math.min(10, q + 1))}
              disabled={!isJoinable || quantity >= 10}
              className="w-9 h-9 flex items-center justify-center text-gray-700 dark:text-gray-200 disabled:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white focus-visible:outline-none"
              aria-label="수량 증가"
            >+</button>
          </div>
          <button
            onClick={handleJoin}
            disabled={!isJoinable || joining}
            className={`flex-1 h-11 rounded-lg text-sm font-bold transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white focus-visible:outline-none ${
              isJoinable
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-100 active:scale-[0.98]'
                : 'bg-gray-300 dark:bg-[#2A2A2A] text-white dark:text-gray-500'
            }`}
            aria-label={isJoinable ? `${formatNumber(total)}원으로 ${quantity}장 참여하기` : '참여 불가'}
          >
            {joining ? '처리 중…' :
              !isJoinable ? '참여 불가' :
              `${formatNumber(total)}원 참여하기`}
          </button>
        </div>
      </footer>
    </div>
  )
}
