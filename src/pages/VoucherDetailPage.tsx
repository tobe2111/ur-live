import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Info } from 'lucide-react'
import api from '@/lib/api'
import { storeAffiliateRef, fireAffiliateTrack } from '@/utils/affiliate-track'
import SEO from '@/components/SEO'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { getVoucherShortLabel } from '@/shared/constants/voucher-categories'
import { formatPhone } from '@/utils/format-phone'
import { useInvalidateMyVouchers, useBalance } from '@/hooks/queries'
import { isLoggedInSync } from '@/utils/auth'
import { confirmDialog } from '@/components/ui/confirm-dialog'

/**
 * 🛡️ 2026-05-23: 교환권 전용 detail 페이지.
 *
 * 정책 (사용자 명시):
 *   - / + /browse 의 상품 → Toss 결제 (공구 / 일반 쇼핑)
 *   - /vouchers + /vouchers/:id 의 상품 → 딜 결제 (교환권 전용)
 *
 * 분리 배경:
 *   GroupBuyDetailPage 가 voucher + group-buy 두 분류를 같은 UI 로 렌더 →
 *   교환권에 "참여하기" / 진행률 같은 group-buy UI 노출 사고. 페이지 자체 분리로 영구 차단.
 *
 * UI 책임 (group-buy 와 다름):
 *   - 가격 표시 단위: 딜 (group-buy 는 원)
 *   - 버튼: "딜로 교환하기" (group-buy 는 "참여하기")
 *   - 진행률 / 참여자 수 / 마감 카운트다운 없음 (즉시 교환)
 *   - 사용 기간 + 사용처 안내
 */

interface VoucherProduct {
  id: number
  name: string
  description: string | null
  price: number
  original_price?: number | null
  discount_rate?: number | null
  image_url: string | null
  category: string
  deal_only?: number
  voucher_expiry?: string | null
  restaurant_name?: string | null
  restaurant_address?: string | null
  seller_id?: number
  seller_name?: string | null
}

/**
 * 🧹 2026-06-17 (사용자 반복 요청): 소비자 교환권 화면에서 공급사(KT Alpha) 내부 정책 표기 제거.
 *
 * 배경: KT Alpha 카탈로그 sync 가 과거 description 에 "(KT Alpha B2B 정책)" 괄호를 붙여 저장 →
 *   sync 코드는 commit addbc2b 에서 고쳤지만 **이미 prod DB 에 저장된 description 행은 그대로** 라
 *   같은 상품을 다시 봐도 계속 노출됨. DB 재동기화 없이도 즉시 사라지도록 렌더 시점에서 strip.
 *   (공급사명 노출 방지 — 환불/사용 안내 같은 정상 문구는 보존.)
 */
function stripSupplierPolicy(desc: string): string {
  return desc
    // 괄호 표기: "(KT Alpha B2B 정책)", "(KT Alpha B2B 쿠폰 정책)" 등
    .replace(/\s*\([^)]*KT\s*Alpha[^)]*정책[^)]*\)/gi, '')
    // 괄호 없이 들어온 잔여 표기
    .replace(/\s*KT\s*Alpha\s*B2B\s*(?:쿠폰\s*)?정책/gi, '')
    .split('\n').map(l => l.replace(/[ \t]+$/g, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 🎨 2026-06-17 (사용자 — "안내 문구 가시성 떨어짐"): KT Alpha 등 상품 안내(description) 평문 한 덩어리를
 *   구조화 렌더. **데이터(텍스트)는 무변경, 표시만 개선**:
 *     - `[유의사항]` 같은 대괄호-단독 라인 → 섹션 헤더(볼드)
 *     - `- ...` → 불릿 리스트
 *     - 단독 URL → 클릭 가능 링크
 *     - `⚠️` 경고 → amber 강조 / `📅` 등 → 콜아웃
 *   첫 줄이 `[브랜드] 상품명` 타이틀이면 상단 h2 와 중복이라 제거.
 */
function VoucherNotice({ text }: { text: string }) {
  let lines = text.split('\n')
  const firstIdx = lines.findIndex((l) => l.trim())
  if (firstIdx >= 0 && /^\[[^\]]+\]\s*\S/.test(lines[firstIdx].trim())) {
    lines = lines.filter((_, i) => i !== firstIdx)
  }
  return (
    <div className="space-y-1.5">
      {lines.map((raw, i) => {
        const line = raw.trim()
        if (!line) return <div key={i} className="h-1" />
        const url = line.match(/^(https?:\/\/\S+)$/)?.[1]
        if (url) {
          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-gray-900 dark:text-white underline underline-offset-2 break-all">
              🔗 안내 링크 열기
            </a>
          )
        }
        if (/^\[[^\]]+\]$/.test(line)) {
          return <p key={i} className="text-[12.5px] font-extrabold text-gray-900 dark:text-white mt-3 first:mt-0">{line.replace(/^\[|\]$/g, '')}</p>
        }
        if (/^[-•]\s+/.test(line)) {
          return (
            <div key={i} className="flex gap-1.5 text-[12.5px] text-gray-600 dark:text-gray-300 leading-relaxed">
              <span className="text-gray-300 dark:text-gray-600 shrink-0">•</span>
              <span className="flex-1">{line.replace(/^[-•]\s+/, '')}</span>
            </div>
          )
        }
        if (/^⚠️/.test(line)) {
          return <p key={i} className="text-[12px] font-medium text-amber-700 dark:text-amber-400 leading-relaxed">{line}</p>
        }
        if (/^(📅|❗|✅|💡|📌)/.test(line)) {
          return <p key={i} className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">{line}</p>
        }
        return <p key={i} className="text-[12.5px] text-gray-600 dark:text-gray-300 leading-relaxed">{line}</p>
      })}
    </div>
  )
}

export default function VoucherDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const invalidateVouchers = useInvalidateMyVouchers()
  // 🎨 2026-06-17 (교환권 상세 리디자인): 보유 딜 + 교환 후 잔액 표시.
  // 🛠️ 2026-06-17 (사용자 신고 — "딜 부족"으로 잘못 뜸): 기본 useBalance() 는 initialData(localStorage,
  //   기본 0)를 staleTime(60s) 동안 fresh 로 간주 → 이 페이지를 직접 진입(잔액 미캐시 브라우저)하면
  //   refetch 없이 0 표시 → '딜 부족' 오표시. 결제 판단 페이지라 PointsChargePage 와 동일하게 fresh
  //   fetch(0s stale + mount 마다 refetch + focus refetch)로 항상 최신 잔액 반영.
  const { data: balance = 0, isFetching: balanceFetching } = useBalance({ fresh: true })
  const [product, setProduct] = useState<VoucherProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exchanging, setExchanging] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneConsent, setPhoneConsent] = useState(false)

  // 🧭 2026-06-10 (링크샵 적립): 핀 리다이렉트 ?aff= → affiliate_ref 저장 (물리 ?ref= 와 동일 키)
  useEffect(() => {
    try { storeAffiliateRef(new URLSearchParams(window.location.search).get('aff')) } catch { /* noop */ }
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false

    // 🛡️ 2026-05-27 (loading P0): SSR inject 즉시 사용 — worker HTMLRewriter 가 head 에 inject.
    //   /group-buy/:id 와 /vouchers/:id 둘 다 같은 endpoint → 같은 __SSR_INITIAL_DETAIL__ slot.
    //   효과: 첫 paint 부터 상품 표시 (axios fetch waterfall ~200-500ms 제거).
    try {
      if (typeof document !== 'undefined') {
        const el = document.getElementById('__SSR_INITIAL_DETAIL__')
        if (el?.textContent) {
          const parsed = JSON.parse(el.textContent)
          if (parsed?.success && String(parsed?.data?.id) === String(id)) {
            setProduct(parsed.data)
            setLoading(false)
          }
        }
      }
    } catch { /* SSR 누락 — fallback */ }

    api.get(`/api/group-buy/products/${id}`)
      .then(r => {
        if (cancelled) return
        if (r.data?.success) setProduct(r.data.data)
        else setError(r.data?.error || '교환권을 찾을 수 없습니다')
      })
      .catch(err => {
        if (cancelled) return
        const msg = err?.response?.data?.error || '교환권 로드 실패'
        setError(msg)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  async function handleExchange() {
    if (!product) return
    const total = product.price * quantity
    const ok = await confirmDialog({
      message: `${product.name}\n${quantity}장 × ${formatNumber(product.price)}딜 = ${formatNumber(total)}딜\n\n⚠️ 교환 후 환불 불가\n진행할까요?`,
      danger: true,
    })
    if (!ok) return
    setExchanging(true)
    try {
      const { getTrackedSellerId } = await import('@/lib/seller-tracking')
      const ref = getTrackedSellerId() || undefined
      // 🛡️ 2026-05-23: idempotency_key — 중복 클릭 / 네트워크 retry 시 중복 차감 영구 차단.
      //   server 가 같은 key 발견하면 기존 voucher 반환 (no double charge).
      const idempotency_key = `voucher_${product.id}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      const res = await api.post(`/api/group-buy/join/${product.id}`, {
        quantity, payment_method: 'deal', ref, idempotency_key,
      })
      if (res.data?.success) {
        toast.success('🎁 교환권 발급 완료')
        fireAffiliateTrack(res.data?.data?.order_id, product.id, product.name) // 큐레이터 적립 (fail-soft)
        invalidateVouchers()
        navigate('/my-vouchers')
      } else {
        toast.error(res.data?.error || '교환 실패')
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string; code?: string } } }
      const code = e?.response?.data?.code
      if (code === 'INSUFFICIENT_POINTS') {
        const charge = await confirmDialog('딜이 부족합니다. 충전 페이지로 이동할까요?')
        if (charge) {
          localStorage.setItem('loginReturnUrl', window.location.pathname)
          navigate('/points/charge')
        }
        return
      }
      // 🛡️ 2026-05-24: KT Alpha 상품 phone 미등록 → 즉시 입력 모달.
      if (code === 'PHONE_REQUIRED') {
        setShowPhoneModal(true)
        return
      }
      toast.error(e?.response?.data?.error || '교환 실패')
    } finally {
      setExchanging(false)
    }
  }

  // 🛡️ 2026-05-24: phone 입력 후 자동 retry — 사용자가 모달 닫고 다시 클릭하지 않아도 됨.
  //   개인정보보호법: 수집·이용 동의 필수 (체크박스).
  async function savePhoneAndRetry(phoneInput: string) {
    if (!phoneConsent) {
      toast.error('개인정보 수집·이용 동의 후 진행 가능합니다')
      return
    }
    const clean = phoneInput.replace(/[-\s]/g, '')
    if (!/^01\d{8,9}$/.test(clean)) {
      toast.error('010 으로 시작하는 휴대폰 번호를 입력하세요')
      return
    }
    try {
      const res = await api.patch('/api/auth/profile', { phone: clean })
      if (!res.data?.success) {
        toast.error(res.data?.error || '전화번호 저장 실패')
        return
      }
      toast.success('전화번호 저장 완료')
      setShowPhoneModal(false)
      // 자동 retry
      handleExchange()
    } catch (err) {
      // 🛡️ React #31 — server 가 { error: { code, message } } 반환 시 string 만 추출.
      const e = err as { response?: { data?: { error?: string | { message?: string } } } }
      const errRaw = e?.response?.data?.error
      const errMsg = typeof errRaw === 'string' ? errRaw
        : (errRaw && typeof errRaw === 'object' && typeof errRaw.message === 'string') ? errRaw.message
        : '전화번호 저장 실패'
      toast.error(errMsg)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] p-4">
        <button onClick={() => navigate(-1)} className="mb-4"><ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" /></button>
        <div className="text-center mt-12">
          <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">{error || '교환권을 찾을 수 없습니다'}</p>
          <button onClick={() => navigate('/vouchers')} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-bold">교환권 목록으로</button>
        </div>
      </div>
    )
  }

  const total = product.price * quantity
  const label = getVoucherShortLabel(product.category)
  // 🎨 2026-06-17 (리디자인): 로그인 시에만 잔액 박스 노출. 교환 후 = 보유 − 결제 딜.
  const loggedIn = isLoggedInSync()
  const afterBalance = balance - total
  // 🛠️ 첫 조회 중(캐시값 없는 0)엔 '딜 부족' 오표시 금지 — 실제 잔액 확정 전까지 '…' 표시.
  const balancePending = balanceFetching && balance === 0
  // 🧹 공급사(KT Alpha) 내부 정책 표기 제거 후 표시 (prod DB 잔존 행도 즉시 정리).
  const cleanDescription = product.description ? stripSupplierPolicy(product.description) : ''
  // 🎨 정가(원) > 교환가(딜=원) 일 때만 할인 표시 (KT Alpha 교환권 등). 데이터 없으면 미표시.
  const hasDiscount = !!product.original_price && product.original_price > product.price
  const discountPct = hasDiscount
    ? Math.round(((product.original_price! - product.price) / product.original_price!) * 100)
    : 0

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] pb-52 lg:pb-40">
      <SEO title={`${product.name} 교환권 - 유어딜`} description={cleanDescription} url={`/vouchers/${product.id}`} noindex />

      {/* 🛡️ 2026-06-16 (사용자 요청): 상단 '바우처' 타이틀 바 제거. 🎨 2026-06-17 리디자인: 헤더 바 + 뒤로가기. */}
      <div className="sticky top-0 z-40 bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur">
        <div className="ur-content-narrow h-14 px-2 flex items-center">
          <button
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-900 dark:text-white active:scale-95"
          >
            <ArrowLeft className="w-[22px] h-[22px]" />
          </button>
        </div>
      </div>

      <div className="ur-content-narrow px-4">
        {/* 🎨 상품 카드 — 사용자 요청: 사진이 카드를 가득 채움(object-cover, 정사각 풀블리드).
            그라데이션은 로딩 중/투명 이미지 대비 base 로만 유지(채워지면 안 보임). */}
        <div className="relative aspect-square w-full rounded-[28px] overflow-hidden bg-gradient-to-b from-[#F7F8FA] to-[#EFF1F4] dark:from-[#15171C] dark:to-[#0F1115]">
          {product.image_url && (
            // 🛡️ 2026-05-27 (loading P0): cfImage 변환 — 원본 (1MB+) → WebP. LCP 우선 → eager.
            <img
              src={cfImage(product.image_url, { width: 800, format: 'auto' }) || product.image_url}
              srcSet={cfSrcSet(product.image_url, 800) || undefined}
              sizes="(max-width: 640px) 100vw, 720px"
              alt={product.name}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* 정보 */}
        <div className="pt-[18px]">
          <div className="flex items-center">
            <span className="text-[11.5px] font-bold text-[#171B24] bg-[#d1d5db] rounded-md px-[9px] py-1 whitespace-nowrap">{label}</span>
          </div>
          <h2 className="mt-[7px] text-[23px] font-extrabold text-[#171B24] dark:text-white leading-tight tracking-tight">{product.name}</h2>
          {product.restaurant_name && (
            <div className="mt-1 text-[13.5px] text-gray-400 dark:text-gray-500">{product.restaurant_name}{product.restaurant_address ? ` · ${product.restaurant_address}` : ''}</div>
          )}
          {/* 🎨 2026-06-17: 시안 의도 복원 — original_price(정가) 있으면 취소선 + 실제 할인율 표시 */}
          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="flex items-baseline gap-1">
              <span className="text-[32px] font-extrabold text-[#171B24] dark:text-white tracking-tight">{formatNumber(product.price)}</span>
              <span className="text-[18px] font-bold text-[#171B24] dark:text-white">딜</span>
            </div>
            {hasDiscount && (
              <div className="text-right leading-tight">
                <div className="text-[12px] text-gray-400 dark:text-gray-500 line-through">정가 ₩{formatNumber(product.original_price!)}</div>
                <div className="text-[12.5px] font-bold text-[#0E9F6E] dark:text-emerald-400">{discountPct}% 할인 교환</div>
              </div>
            )}
          </div>

          <div className="h-px bg-[#EEF0F3] dark:bg-[#1A1A1A] my-4" />

          <div className="flex flex-col gap-[11px]">
            <div className="flex justify-between items-start text-[13.5px]">
              <span className="text-gray-400 dark:text-gray-500">유효기간</span>
              <span className="text-[#3A404C] dark:text-gray-200 font-semibold text-right">{product.voucher_expiry || '발급 후 사용 기간 적용'}</span>
            </div>
            <div className="flex justify-between items-start text-[13.5px]">
              <span className="text-gray-400 dark:text-gray-500">사용처</span>
              <span className="text-[#3A404C] dark:text-gray-200 font-semibold text-right">{product.restaurant_name || '전국 가맹 매장'}</span>
            </div>
            <div className="flex justify-between items-start text-[13.5px]">
              <span className="text-gray-400 dark:text-gray-500">환불</span>
              <span className="text-[#3A404C] dark:text-gray-200 font-semibold text-right">환불 불가</span>
            </div>
          </div>

          {/* 사용 안내 */}
          <div className="mt-[14px] flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[12px]">매장에서 바코드 제시 후 사용 가능</span>
          </div>

          {/* 🎨 2026-06-17 (사용자 요청): 상품 상세 내용은 '매장에서 바코드 제시 후 사용 가능' 아래에.
              + 가시성 개선 — 평문 → 구조화 렌더(VoucherNotice). 데이터 무변경, 표시만. */}
          {cleanDescription && (
            <div className="mt-5 pt-5 border-t border-[#EEF0F3] dark:border-[#1A1A1A]">
              <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 mb-2.5">상품 안내</p>
              <VoucherNotice text={cleanDescription} />
            </div>
          )}
        </div>
      </div>

      {/* 🛡️ 2026-05-23: BottomNav (h-14 + safe-area) 위에 표시. z-[10002] = nav (z-9999) 위. */}
      <div
        className="fixed bottom-14 left-0 right-0 bg-white dark:bg-[#0A0A0A] border-t border-gray-100 dark:border-[#1A1A1A] z-[10002] lg:bottom-0"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="ur-content-narrow px-4 pt-3">
          {/* 🎨 보유 딜 + 교환 후 잔액 (로그인 시) */}
          {loggedIn && (
            <div className="flex items-center justify-between bg-[#F6F7F9] dark:bg-[#121212] rounded-xl px-3.5 py-2.5 mb-3">
              <span className="text-[12.5px] text-gray-500 dark:text-gray-400">보유 <b className="font-semibold text-gray-700 dark:text-gray-200">{balancePending ? '…' : `${formatNumber(balance)}딜`}</b></span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">교환 후</span>
                {balancePending ? (
                  <span className="text-[18px] font-extrabold text-gray-400 dark:text-gray-500 tracking-tight">…</span>
                ) : afterBalance >= 0 ? (
                  <span className="text-[18px] font-extrabold text-[#171B24] dark:text-white tracking-tight">{formatNumber(afterBalance)}딜</span>
                ) : (
                  <span className="text-[15px] font-extrabold text-red-500">딜 부족</span>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3.5 border border-[#E6E9ED] dark:border-[#2A2A2A] rounded-2xl px-3.5 h-[54px] shrink-0">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="수량 감소" className="text-[20px] font-semibold text-gray-900 dark:text-white disabled:text-gray-300 dark:disabled:text-gray-600">−</button>
              <span className="min-w-[14px] text-center text-[16px] font-bold text-gray-900 dark:text-white">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} aria-label="수량 증가" className="text-[20px] font-semibold text-gray-900 dark:text-white">+</button>
            </div>
            <button
              onClick={handleExchange}
              disabled={exchanging}
              className="flex-1 h-[54px] rounded-2xl text-white text-[16px] font-bold disabled:opacity-50"
              style={{ background: 'linear-gradient(180deg,#222B3F,#10172A)' }}
            >
              {exchanging ? '교환 중…' : `${formatNumber(total)}딜로 교환하기`}
            </button>
          </div>
        </div>
      </div>

      {/* 🛡️ 2026-05-24: KT Alpha 상품 phone 미등록 시 입력 모달 */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-[10100] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShowPhoneModal(false)}>
          <div className="bg-white dark:bg-[#0A0A0A] rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">📱 휴대폰 번호 등록</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
              기프티쇼 교환권은 휴대폰 MMS 로 발송됩니다.<br/>
              발송 받을 번호를 입력해주세요.
            </p>
            <input
              type="tel" inputMode="numeric" maxLength={13}
              value={phoneInput}
              onChange={(e) => setPhoneInput(formatPhone(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') savePhoneAndRetry(phoneInput) }}
              placeholder="010-1234-5678"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base text-gray-900 dark:text-white mb-3"
              autoFocus
            />

            {/* 🛡️ 2026-05-24: 개인정보보호법 — 수집·이용 동의 + 보유기간 명시. */}
            <label className="flex items-start gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={phoneConsent}
                onChange={(e) => setPhoneConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-gray-900"
              />
              <span className="text-[11px] text-gray-700 dark:text-gray-200 leading-relaxed">
                <b>휴대폰 번호 수집·이용에 동의</b>합니다 (필수)
                <br/>
                <span className="text-gray-500 dark:text-gray-400">
                  · 수집 항목: 휴대폰 번호<br/>
                  · 이용 목적: 기프티쇼 교환권 MMS 발송 / 알림톡 발송<br/>
                  · 보유 기간: 회원 탈퇴 시까지 (탈퇴 후 즉시 파기)
                </span>
              </span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setShowPhoneModal(false); setPhoneConsent(false) }}
                className="py-2.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200"
              >
                취소
              </button>
              <button
                onClick={() => savePhoneAndRetry(phoneInput)}
                disabled={!phoneInput || !phoneConsent}
                className="py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold disabled:opacity-40"
              >
                저장 후 교환
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
