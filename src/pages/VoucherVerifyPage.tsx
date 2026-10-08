/**
 * 🎟️ 이용권 사용 처리 화면 — `/v/:code` (손님 QR 을 폰 기본 카메라로 찍으면 열린다)
 *
 * 2026-10-08 대표 시안 확정("시안대로 해줘") — `docs/design/voucher-verify-redesign.md`.
 * 누가 찍었는지에 따라 상황이 다섯이고, 모양은 지갑과 같은 **티켓 카드 한 장**이다.
 *   ① 우리 매장 사장님(can_redeem)  → "이 메뉴를 드리면 돼요" + [사용 처리]
 *   ② 처리 직후                      → "사용 처리했어요" + 처리 시각 + [다음 손님 QR 찍기]
 *   ③ 이미 쓴/만료/환불 이용권        → 회색 띠에 사용 일시
 *   ④ 사장님 좌석 없음(직원·손님 폰) → "매장 확인코드" 입력 + 로그인 권유 한 줄
 *   ⑤ 다른 매장 사장님               → "다른 매장의 이용권이에요" — 처리 버튼 없음
 *
 * 🩸 종전 결함: 사장님이 처리에 **성공해도** 상태를 'used' 로 바꾸는 바람에 곧장 X 아이콘 +
 *   "이미 사용된 바우처" 가 떠서 실패처럼 보였다. ②를 별도 상태(`done`)로 둔다.
 * 🩸 종전 결함: 좌석만 있으면 어느 매장 사장님이든 처리 버튼이 떴고 누르면 403 이었다. 서버가
 *   `can_redeem`(use-by-seller 와 같은 미들웨어로 판정)을 알려 주므로 ⑤를 처음부터 안내한다.
 *
 * 🔒 권한은 하나도 안 바뀐다 — 사용 처리는 여전히 서버가 [그 매장 사장님 · 그 매장 스캔 기기 ·
 *   매장 확인코드] 로만 허용한다. `can_redeem` 은 **어떤 화면을 보여 줄지**만 정한다.
 *
 * ⚠️ 로그인 벽을 세우지 않는다 — 손님도 자기 QR 을 찍으면 이 주소로 온다(2026-10-07).
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { OkIcon } from '@/components/icons/urdeal-icons'
import { TicketCard } from '@/components/ticket/TicketCard'
import UrDealLogo from '@/components/brand/UrDealLogo'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { getSellerToken, isSellerAuthenticated } from '@/lib/seller-auth'
import { loginPathFromHere } from '@/utils/login-return'
import { getUserIdSync } from '@/utils/auth'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { parseUTCDate, formatKSTTime } from '@/utils/date'

/** QR 내용(https://urdeal.kr/v/{code}) 또는 코드 그대로에서 코드를 뽑는다. */
export function parseVoucherCode(input: string): string {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/\/v\/([A-Za-z0-9-]+)$/)
  if (urlMatch) return urlMatch[1].toUpperCase()
  try {
    const url = new URL(trimmed)
    const pathMatch = url.pathname.match(/\/v\/([A-Za-z0-9-]+)$/)
    if (pathMatch) return pathMatch[1].toUpperCase()
  } catch { /* URL 아님 → 코드 그대로 */ }
  return trimmed.toUpperCase()
}

interface VerifiedVoucher {
  code: string
  status: string
  product_name?: string
  restaurant_name?: string
  product_image?: string
  expires_at?: string | null
  used_at?: string | null
  can_redeem?: boolean
}

export type VerifyView = 'lookup' | 'redeem' | 'done' | 'closed' | 'pin' | 'other-store'

/** 어떤 화면을 보여 줄지 — 순수 함수(테스트가 이것을 잰다). */
export function pickVerifyView(v: VerifiedVoucher | null, opts: { done: boolean; isSeller: boolean }): VerifyView {
  if (opts.done) return 'done'
  if (!v) return 'lookup'
  if (v.status !== 'unused') return 'closed'
  if (v.can_redeem) return 'redeem'
  if (opts.isSeller) return 'other-store'
  return 'pin'
}

export default function VoucherVerifyPage() {
  const { code: urlCode } = useParams<{ code: string }>()
  const { t, i18n } = useTranslation()
  const [code, setCode] = useState(urlCode || '')
  const [pin, setPin] = useState('')
  const [voucher, setVoucher] = useState<VerifiedVoucher | null>(null)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneAt, setDoneAt] = useState<string | null>(null)

  const locale = i18n.language?.startsWith('ko') ? 'ko-KR' : i18n.language || 'en-US'
  const isSeller = isSellerAuthenticated()
  const loggedIn = !!getUserIdSync()
  const view = pickVerifyView(voucher, { done: !!doneAt, isSeller })

  useEffect(() => {
    if (urlCode && !voucher && !loading) lookupVoucher()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode])

  function reset() {
    setVoucher(null); setCode(''); setPin(''); setError(null); setDoneAt(null)
  }

  async function lookupVoucher() {
    if (!code.trim()) return
    const parsedCode = parseVoucherCode(code)
    setCode(parsedCode)
    setLoading(true)
    setError(null)
    try {
      // 좌석이 있으면 토큰을 실어 보낸다 → 서버가 "우리 매장인가"(can_redeem)를 알려 준다.
      const res = await api.get(`/api/vouchers/verify/${parsedCode}`, isSeller
        ? { headers: { Authorization: `Bearer ${getSellerToken() || ''}` } }
        : undefined)
      if (res.data.success) setVoucher(res.data.data)
      else setError(res.data.error || t('voucher.verify.notFound', { defaultValue: '이용권을 찾을 수 없어요' }))
    } catch {
      setError(t('voucher.verify.notFound', { defaultValue: '이용권을 찾을 수 없어요' }))
    } finally {
      setLoading(false)
    }
  }

  function finish() {
    setDoneAt(new Date().toISOString())
    setError(null)
  }

  async function redeemAsSeller() {
    if (!voucher) return
    setVerifying(true)
    try {
      const res = await api.post(`/api/vouchers/${voucher.code}/use-by-seller`, {}, {
        headers: { Authorization: `Bearer ${getSellerToken() || ''}` },
      })
      if (res.data.success) finish()
      else setError(res.data.error || t('voucher.verify.processingError', { defaultValue: '처리 중 오류가 발생했어요' }))
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || t('voucher.verify.processingError', { defaultValue: '처리 중 오류가 발생했어요' }))
    } finally {
      setVerifying(false)
    }
  }

  async function redeemWithStoreCode() {
    if (!voucher || !pin.trim()) return
    setVerifying(true)
    try {
      const res = await api.post(`/api/vouchers/${voucher.code}/use`, { pin: pin.trim() })
      if (res.data.success) finish()
      else setError(res.data.error || t('voucher.verify.processingError', { defaultValue: '처리 중 오류가 발생했어요' }))
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || t('voucher.verify.processingError', { defaultValue: '처리 중 오류가 발생했어요' }))
    } finally {
      setVerifying(false)
    }
  }

  const store = voucher?.restaurant_name || ''
  const headerRight =
    view === 'pin' && !loggedIn ? t('voucher.verify.notLoggedIn', { defaultValue: '로그인 안 됨' })
    : view === 'other-store' ? ''
    : store

  const title =
    view === 'redeem' ? t('voucher.verify.titleRedeem', { defaultValue: '이 메뉴를 드리면 돼요' })
    : view === 'done' ? t('voucher.verify.titleDone', { defaultValue: '사용 처리했어요' })
    : view === 'closed' ? (voucher?.status === 'used'
        ? t('voucher.verify.titleUsed', { defaultValue: '이미 사용한 이용권이에요' })
        : voucher?.status === 'refunded'
          ? t('voucher.verify.titleRefunded', { defaultValue: '환불된 이용권이에요' })
          : t('voucher.verify.titleExpired', { defaultValue: '기한이 지난 이용권이에요' }))
    : view === 'pin' ? t('voucher.verify.titlePin', { defaultValue: '매장 확인코드를 넣어 주세요' })
    : view === 'other-store' ? t('voucher.verify.titleOtherStore', { defaultValue: '다른 매장의 이용권이에요' })
    : t('voucher.verify.titleLookup', { defaultValue: '이용권 확인' })

  const usedLabel = voucher?.used_at
    ? parseUTCDate(voucher.used_at).toLocaleString(locale, { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''
  const expiresLabel = voucher?.expires_at
    ? parseUTCDate(voucher.expires_at).toLocaleDateString(locale, { timeZone: 'Asia/Seoul' })
    : ''

  /** 티켓 카드 본문 — 상품 사진·이름·매장·코드. 상태와 무관하게 같은 모양이다. */
  const ticketBody = voucher && (
    <div className="p-4">
      <div className="flex gap-3">
        {voucher.product_image && (
          <img
            src={cfImage(voucher.product_image, { width: 160, quality: 82, format: 'auto' }) || voucher.product_image}
            alt=""
            width={64}
            height={64}
            className="w-16 h-16 shrink-0 rounded-xl object-cover bg-gray-100 dark:bg-[#26282F]"
            onError={(e) => cfImageOnError(e.currentTarget, voucher.product_image)}
          />
        )}
        <div className="min-w-0">
          <p className="text-[17px] font-bold leading-snug text-gray-900 dark:text-white break-keep">{voucher.product_name}</p>
          {store && <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{store}</p>}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-rule flex items-center justify-between text-[13px]">
        <span className="text-gray-500 dark:text-gray-400">{t('voucher.verify.codeShort', { defaultValue: '코드' })}</span>
        <code className="font-bold tabular-nums tracking-[0.06em] text-gray-900 dark:text-white">{voucher.code}</code>
      </div>
    </div>
  )

  const primaryBtn = 'w-full h-14 rounded-2xl bg-brand text-white text-[17px] font-bold disabled:opacity-40 active:scale-[0.98] transition-transform'
  const secondaryBtn = 'w-full h-12 rounded-xl text-[15px] font-semibold text-gray-600 dark:text-gray-300'

  return (
    <div className="min-h-[100dvh] bg-[#F8F7FC] dark:bg-[#11141C] px-4 pb-10">
      <SEO title={t('voucher.verify.seoTitle', { defaultValue: '이용권 확인' })} description={t('voucher.verify.seoDescription', { defaultValue: 'QR 코드로 이용권을 확인합니다' })} url={urlCode ? `/v/${urlCode}` : '/v'} noindex />
      <div className="mx-auto w-full max-w-sm lg:max-w-md">
        <header className="flex h-14 items-center justify-between">
          <UrDealLogo size={20} />
          {headerRight && <span className="max-w-[60%] truncate text-[13px] font-semibold text-gray-500 dark:text-gray-400">{headerRight}</span>}
        </header>

        <h1 className="mt-6 text-[24px] font-bold leading-tight tracking-[-0.01em] text-gray-900 dark:text-white break-keep">{title}</h1>

        {error && (
          <p role="alert" className="mt-3 text-[15px] font-semibold text-red-600 dark:text-red-400">{error}</p>
        )}

        {view === 'lookup' && (
          <div className="mt-6">
            <label htmlFor="voucher-code" className="block text-[13px] font-semibold text-gray-500 dark:text-gray-400 mb-2">{t('voucher.verify.codeLabel', { defaultValue: '이용권 코드' })}</label>
            <input
              id="voucher-code"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onPaste={e => { e.preventDefault(); setCode(parseVoucherCode(e.clipboardData.getData('text'))) }}
              placeholder={t('voucher.verify.codePlaceholder', { defaultValue: 'UR-XXXX-XXXX' })}
              className="w-full h-14 px-4 rounded-2xl bg-surface shadow-lift text-center text-[17px] font-bold tabular-nums tracking-widest text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand/40"
              maxLength={60}
            />
            <p className="mt-2 text-center text-[12px] text-gray-500 dark:text-gray-400">{t('voucher.verify.qrHint', { defaultValue: 'QR 주소를 붙여 넣으면 코드만 뽑아요' })}</p>
            <button onClick={lookupVoucher} disabled={!code.trim() || loading} className={`${primaryBtn} mt-6`}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('voucher.verify.lookup', { defaultValue: '조회하기' })}
            </button>
          </div>
        )}

        {view === 'done' && (
          <div className="mt-6">
            <div className="rounded-2xl bg-surface shadow-lift p-6 text-center">
              <OkIcon filled className="mx-auto w-10 h-10 text-brand-text" />
              <p className="mt-3 text-[28px] font-bold tabular-nums text-gray-900 dark:text-white">{formatKSTTime(doneAt)}</p>
              {voucher?.product_name && <p className="mt-2 text-[15px] font-semibold text-gray-900 dark:text-white break-keep">{voucher.product_name}</p>}
              <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{t('voucher.verify.doneNote', { defaultValue: '손님 폰에도 ‘사용 완료’로 바뀌었어요' })}</p>
            </div>
            {isSeller ? (
              <Link to="/seller/scan" className={`${primaryBtn} mt-6 flex items-center justify-center`}>{t('voucher.verify.nextGuest', { defaultValue: '다음 손님 QR 찍기' })}</Link>
            ) : (
              <button onClick={reset} className={`${primaryBtn} mt-6`}>{t('voucher.verify.lookupAnother', { defaultValue: '다른 이용권 조회' })}</button>
            )}
          </div>
        )}

        {(view === 'redeem' || view === 'closed' || view === 'pin' || view === 'other-store') && voucher && (
          <div className="mt-6">
            <TicketCard
              muted={view === 'closed' || view === 'other-store'}
              bandLeft={
                view === 'closed' ? (voucher.status === 'used' && usedLabel ? usedLabel : t('voucher.verify.bandClosed', { defaultValue: '사용 불가' }))
                : view === 'other-store' ? t('voucher.verify.bandOtherStore', { defaultValue: '{{store}} 전용', store: store || t('voucher.verify.thatStore', { defaultValue: '다른 매장' }) })
                : t('voucher.verify.bandPaid', { defaultValue: '결제 완료' })
              }
              bandRight={
                view === 'closed' ? (voucher.status === 'used' ? t('voucher.verify.bandUsed', { defaultValue: '사용 완료' }) : voucher.status === 'refunded' ? t('voucher.verify.bandRefunded', { defaultValue: '환불' }) : t('voucher.verify.bandExpired', { defaultValue: '만료' }))
                : view === 'other-store' ? t('voucher.verify.bandCannot', { defaultValue: '처리 불가' })
                : t('voucher.verify.bandUsable', { defaultValue: '사용 가능' })
              }
            >
              {ticketBody}
            </TicketCard>

            {view === 'redeem' && (
              <>
                <p className="mt-4 px-1 text-[13px] leading-[1.55] text-gray-500 dark:text-gray-400">{t('voucher.verify.paidNote', { defaultValue: '이미 결제된 이용권이에요. 포스에서 따로 받지 마세요.' })}</p>
                {expiresLabel && <p className="mt-1 px-1 text-[13px] text-gray-500 dark:text-gray-400">{t('voucher.verify.expiresNote', { defaultValue: '{{date}}까지 사용 가능', date: expiresLabel })}</p>}
                <button onClick={redeemAsSeller} disabled={verifying} className={`${primaryBtn} mt-6`}>
                  {verifying ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('voucher.verify.redeem', { defaultValue: '사용 처리' })}
                </button>
              </>
            )}

            {view === 'closed' && (
              <>
                <p className="mt-4 px-1 text-[13px] leading-[1.55] text-gray-500 dark:text-gray-400">{t('voucher.verify.closedNote', { defaultValue: '같은 이용권은 한 번만 쓸 수 있어요. 손님이 다른 이용권을 갖고 있는지 확인해 주세요.' })}</p>
                <button onClick={reset} className={`${secondaryBtn} mt-4`}>{t('voucher.verify.lookupAnother', { defaultValue: '다른 이용권 조회' })}</button>
              </>
            )}

            {view === 'other-store' && (
              <>
                <p className="mt-4 px-1 text-[13px] leading-[1.55] text-gray-500 dark:text-gray-400">{t('voucher.verify.otherStoreNote', { defaultValue: '이 이용권은 {{store}}에서만 사용 처리할 수 있어요.', store: store || t('voucher.verify.thatStore', { defaultValue: '다른 매장' }) })}</p>
                <button onClick={reset} className={`${secondaryBtn} mt-4`}>{t('voucher.verify.lookupAnother', { defaultValue: '다른 이용권 조회' })}</button>
              </>
            )}

            {view === 'pin' && (
              <>
                <label htmlFor="store-code" className="mt-6 block text-[13px] font-semibold text-gray-500 dark:text-gray-400 mb-2">{t('voucher.verify.storeCodeLabel', { defaultValue: '매장 확인코드' })}</label>
                <input
                  id="store-code"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="• • • •"
                  className="w-full h-14 px-4 rounded-2xl bg-surface shadow-lift text-center text-[17px] tracking-[0.5em] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand/40"
                  maxLength={10}
                />
                <button onClick={redeemWithStoreCode} disabled={!pin.trim() || verifying} className={`${primaryBtn} mt-4`}>
                  {verifying ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('voucher.verify.redeem', { defaultValue: '사용 처리' })}
                </button>
                {/* 🔑 로그인 권유 한 줄 — 벽이 아니다(손님도 이 화면을 연다). 로그인했는데 좌석이 없으면 '내 가게' 로. */}
                <Link to={loggedIn ? '/user/profile' : loginPathFromHere()} className="mt-4 block text-center text-[15px] font-semibold text-brand-text">
                  {loggedIn
                    ? t('voucher.verify.ownerPickStore', { defaultValue: '사장님이면 내 가게를 고르고 바로 처리' })
                    : t('voucher.verify.ownerLogin', { defaultValue: '사장님이면 로그인하고 바로 처리' })}
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
