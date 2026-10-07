// 🧱 2026-06-29 TD: MyVouchersPage god 파일 분해 — 이용권 카드 클러스터(verbatim 추출). 동작 불변.
//   Barcode·KtAlphaVoucherCard 는 모듈 내부 전용, VoucherTicket 만 페이지가 사용.
import { useRef, useEffect, useState } from 'react'
import { GiftBoxIcon } from '@/components/icons/urdeal-icons'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { safeDate } from '@/utils/safe-date'
import { formatNumber } from '@/utils/format'
import { Smartphone } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import type { Voucher } from './types'
import ReviewBonusButton from './ReviewBonusButton'

// 🎟️ 2026-07-06 (대표 "ㄴ 이것도 개선해줘"): 이용권 카드에 매장 사용방식 칩 표시 — 유저가 매장 가기 전에
//   이 카드만 보고도 사용법을 파악. redemption-info(사장님 설정)를 코드별 1회 조회(모듈 캐시로 재조회 방지).
type RedeemMode = 'scan_only' | 'store_code' | 'self_free'
/** 카드 한 줄 안내용 — 칩보다 긴 문장(무엇을 하면 되는지). 2026-10-07 A안 */
const MODE_HINT: Record<RedeemMode, string> = {
  scan_only: '직원에게 QR 보여주기',
  store_code: '매장에서 코드 입력',
  self_free: '바로 사용',
}
const _modeCache = new Map<string, RedeemMode | null>()

/**
 * 🎨 2026-06-21 시안 A '프리미엄 패스' (대표 "페이지가 투박 — UX/UI 재설계" 승인):
 *   가로 리스트 행 → 토스/애플월렛식 세로 '패스'.
 *   헤더(썸네일+가게+D-N 배지) · 큰 제목 · 큰 금액 + 사용하기 · 천공(점선+양옆 노치) · 풋(QR 힌트+코드).
 */
export default function VoucherTicket({ v, muted, locale, t, onShowQr }: {
  v: Voucher
  muted: boolean
  locale: string
  t: (key: string, opts?: any) => string
  onShowQr: () => void
}) {
  const navigate = useNavigate()  // 🎨 2026-06-21 (개선 #4): 사용완료/만료 카드 '재구매' 딥링크

  // 🎟️ 2026-07-06: 미사용 내부 이용권만 매장 사용방식 칩 조회 (KT 교환권/사용완료 제외). 코드별 캐시 → 재조회 0.
  const [mode, setMode] = useState<RedeemMode | null>(() => _modeCache.get(v.code) ?? null)
  useEffect(() => {
    if (v.status !== 'unused' || v.source === 'kt_alpha') return
    if (_modeCache.has(v.code)) { setMode(_modeCache.get(v.code) ?? null); return }
    let alive = true
    api.get(`/api/group-buy/vouchers/${encodeURIComponent(v.code)}/redemption-info`)
      .then((res) => {
        const m: RedeemMode | null = res.data?.success ? (res.data.data?.mode ?? null) : null
        _modeCache.set(v.code, m)
        if (alive) setMode(m)
      })
      .catch(() => { /* 조회 실패 시 칩 미표시 */ })
    return () => { alive = false }
  }, [v.code, v.status, v.source])

  const expiresAt = safeDate(v.expires_at)
  const usedAt = safeDate(v.used_at)
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null

  // 🛡️ 2026-05-25 (A 옵션): KT Alpha 쿠폰은 별도 카드 형식 (재발송 버튼 포함)
  if (v.source === 'kt_alpha') {
    return <KtAlphaVoucherCard v={v} muted={muted} t={t} />
  }

  // 🎨 2026-06-20 흑백 iOS-클린 (docs/design/my-vouchers-wallet-bw.md 화면1 카드):
  //   60px 썸네일 · 🟢 상태점+사용가능+D-N · 제목 · 📍가게 · 코드칩 / 우측: 가격 + 컴팩트 사용 pill.
  const urgent = v.status === 'unused' && daysLeft !== null && daysLeft <= 2
  // 🎟️ 2026-07-06 (대표 승인): 미사용 카드는 어디를 눌러도 사용 안내(QR/사용법) 모달이 열림 —
  //   버튼 하나만 찾을 필요 없이 카드 전체가 진입점. 내부 인터랙션(코드 복사)은 stopPropagation 으로 보호.
  const tappable = v.status === 'unused'

  // 🎫 2026-10-07 (대표 확정 A안 "정돈" — "이 페이지 자체가 못생겼어"): 색 밴드 티켓 → **사진 · 가게 · 메뉴 · 쓰는 법** 한 장.
  //   종전 카드는 밴드("사용 기한 없음 / 사용 가능")·가게 줄·메뉴·가격을 따로 그려 같은 말을 반복했다
  //   (가게 이름이 두 번, 금액은 머리글 합계와 두 번). 금액은 머리글이 한 번 말하고 카드는 *무엇을·어디서·어떻게* 만.
  //   동작(카드 탭 → 사용 모달 · 재구매 · 후기)은 불변.
  const inactive = muted || v.status !== 'unused'
  const store = v.restaurant_name || ''
  const dong = (v.restaurant_address || '').split(/\s+/).find((w) => /[가-힣]+(동|읍|면|가)$/.test(w) && w.length <= 8) || ''
  const menu = store && v.product_name.startsWith(store) ? (v.product_name.slice(store.length).trim() || v.product_name) : v.product_name
  const expiryText = v.status === 'used' && usedAt
    ? `${usedAt.toLocaleDateString(locale)} ${t('voucher.usedSuffix', { defaultValue: '사용' })}`
    : v.status !== 'unused'
      ? t(`voucher.status.${v.status}`)
      : expiresAt
        ? `${expiresAt.getMonth() + 1}.${expiresAt.getDate()}${t('voucher.untilSuffix', { defaultValue: '까지' })} · ${daysLeft === 0 ? 'D-DAY' : `D-${daysLeft}`}`
        : t('voucher.noExpiryShort', { defaultValue: '기한 없음' })
  const howText = tappable && mode ? MODE_HINT[mode] : ''

  return (
    <div
      onClick={tappable ? onShowQr : undefined}
      role={tappable ? 'button' : undefined}
      tabIndex={tappable ? 0 : undefined}
      onKeyDown={tappable ? (e) => { if (e.key === 'Enter') onShowQr() } : undefined}
      className={`rounded-2xl bg-surface overflow-hidden ${inactive ? 'opacity-60' : 'shadow-lift'} ${tappable ? 'cursor-pointer' : ''}`}
    >
      <div className="flex gap-4 p-4">
        <div className="w-[72px] h-[72px] shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-white/10 flex items-center justify-center">
          {v.product_image ? (
            <img src={cfImage(v.product_image, { width: 200, quality: 82, format: 'auto' }) || v.product_image} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => cfImageOnError(e.currentTarget, v.product_image)} />
          ) : (
            <GiftBoxIcon className="w-6 h-6 text-gray-300 dark:text-gray-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {store && <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 truncate">{store}{dong ? ` · ${dong}` : ''}</p>}
          <p className="mt-1 text-[17px] font-extrabold tracking-tight text-gray-900 dark:text-white truncate">{menu}</p>
          <p className={`mt-2 text-[13px] truncate ${urgent ? 'text-tone-bad font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
            {expiryText}{howText ? ` · ${howText}` : ''}
          </p>
        </div>
      </div>

      {v.status === 'unused' && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onShowQr() }}
            className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-extrabold active:opacity-80"
          >
            {t('voucher.useFull', { defaultValue: '사용하기' })}
          </button>
        </div>
      )}

      {/* 풋 — 사용 완료·만료만(재구매 + 후기). 🧹 2026-10-01: 미사용 카드의 코드·환불은 사용 모달로 옮겼다. */}
      {v.status !== 'refunded' && v.status !== 'unused' && (
        <div className="border-t border-rule px-4 pt-3 pb-4" onClick={(e) => e.stopPropagation()}>
          {v.product_id != null && (
            <button
              type="button"
              onClick={() => navigate(`/pass/${v.product_id}`)}
              className="w-full h-11 rounded-xl border border-rule-strong text-brand-text text-[13px] font-bold active:opacity-70"
            >
              {t('voucher.rebuy', { defaultValue: '다시 구매하기' })}
            </button>
          )}
          {v.status === 'used' && <ReviewBonusButton voucherCode={v.code} restaurantName={v.restaurant_name} restaurantAddress={v.restaurant_address} />}
        </div>
      )}
    </div>
  )
}

// 🛡️ 2026-05-25 (A 옵션): KT Alpha 쿠폰 카드 — MMS 발송된 기프티쇼 표시.
// 🔢 2026-06-17 (#4): 쿠폰 PIN → CODE128 바코드. jsbarcode 동적 import (페이지 chunk 영향 0).
function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    let cancelled = false
    import('jsbarcode').then(({ default: JsBarcode }) => {
      if (cancelled || !ref.current) return
      try { JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, height: 54, margin: 0, width: 1.7 }) } catch { /* invalid value */ }
    }).catch(() => { /* lib load fail */ })
    return () => { cancelled = true }
  }, [value])
  return <svg ref={ref} aria-label="쿠폰 바코드" className="max-w-full" />
}

function KtAlphaVoucherCard({ v, muted, t }: {
  v: Voucher
  muted: boolean
  t: (key: string, opts?: any) => string
}) {
  // 🛡️ 2026-06-12 (감사 1단계 — 사용자 결정): "MMS 다시 받기" 버튼 제거.
  //   admin 전용 endpoint(/api/admin/kt-alpha/trigger-order/:id) 를 일반 유저가 호출해
  //   항상 401/403 실패하던 dead 버튼 — 재발송은 어드민 화면(AdminVoucherTransactionsPage)에서.
  const maskedPhone = v.kt_recipient_phone
    ? v.kt_recipient_phone.replace(/(\d{3})\d{4}(\d{4})/, "$1-****-$2")
    : ""
  // 🔢 #4: PIN 모드 발급분(kt_pin 보유)은 인앱 바코드. 아니면 MMS 안내(기존).
  const hasBarcode = !!v.kt_pin && v.status === 'unused'
  // 🔔 2026-06-17 (사용자 요청): 발송 실패(잔액부족/API오류 등) 명시 — '결제됐는데 안 옴' 깜깜이 해소.
  const sendFailed = v.kt_status === 'failed'

  // 🎨 2026-06-21 (대표 신고 "투박") — 이용권(VoucherTicket)과 동일한 클린 가로 레이아웃으로 통일.
  //   60px 썸네일(gift_catalog 이미지) · 상태 점 + 기프티쇼 칩 · 제목 · 발송/실패/바코드 안내 ·
  //   우측 가격 + 컴팩트 액션. PIN 모드만 하단에 인앱 바코드. 천공/큰 버튼/세로 패스 구조 제거.
  const price = v.applied_price ?? null

  return (
    <div
      /* 🎨 2026-09-15: 회색 테두리 네모 → 흰 면 + 들림 한 값. 이 카드만 옛 체계(테두리 + 임의 그림자 +
         체계 밖 카드색)에 남아, 같은 지갑 안에서 티켓 카드와 **모양이 갈렸다**(대표 "AI로 만든 것 같아"). */
      className={`relative rounded-2xl bg-surface p-[13px] ${muted ? '' : 'shadow-lift'}`}
      style={{ opacity: muted ? 0.55 : 1 }}
    >
      <div className="flex items-stretch gap-3">
        {/* 썸네일 60px */}
        <div className="w-[60px] h-[60px] shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-brand-tint">
          {v.product_image ? (
            <img src={cfImage(v.product_image, { width: 200, quality: 82, format: 'auto' }) || v.product_image} alt={v.product_name} loading="lazy" className="w-full h-full object-cover" onError={(e) => cfImageOnError(e.currentTarget, v.product_image)} />
          ) : (
            <GiftBoxIcon className="w-6 h-6 text-gray-300 dark:text-gray-600" />
          )}
        </div>

        {/* 본문 */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {/* 상태 줄 + 기프티쇼 칩 */}
          <div className="flex items-center gap-2">
            {sendFailed ? (
              <>
                <span className="w-[6px] h-[6px] rounded-full shrink-0 bg-tone-bad" aria-hidden />
                <span className="text-[12px] font-semibold text-tone-bad">{t('voucher.sendFailedBadge', { defaultValue: '발송 실패' })}</span>
              </>
            ) : v.status === 'unused' ? (
              <>
                <span className="w-[6px] h-[6px] rounded-full shrink-0 bg-tone-ok" aria-hidden />
                <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">{t('voucher.status.unused', { defaultValue: '사용 가능' })}</span>
              </>
            ) : (
              <span className={`text-[12px] font-semibold ${v.status === 'expired' ? 'text-tone-bad' : 'text-gray-500 dark:text-gray-400'}`}>{t(`voucher.status.${v.status}`)}</span>
            )}
            <span className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-bold tracking-wide bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300">📱 기프티쇼</span>
          </div>

          {/* 제목 */}
          <p className="text-gray-900 dark:text-white font-bold text-[17px] leading-tight tracking-tight truncate">{v.product_name}</p>

          {/* 서브: 발송/실패/바코드 안내 */}
          {sendFailed ? (
            <p className="text-[12px] text-gray-400 dark:text-gray-500 leading-snug">{t('voucher.ktSendFailedShort', { defaultValue: '결제 완료 · 재발송은 고객센터로 문의' })}</p>
          ) : hasBarcode ? (
            <p className="text-[12px] text-gray-400 dark:text-gray-500 leading-snug">{t('voucher.ktShowBarcode', { defaultValue: '매장에서 아래 바코드를 제시하세요' })}</p>
          ) : maskedPhone ? (
            <p className="flex items-center gap-1 text-[12px] text-gray-400 dark:text-gray-500 min-w-0">
              <Smartphone className="w-3 h-3 shrink-0" strokeWidth={2} aria-hidden /><span className="truncate">{maskedPhone} {t('voucher.ktSentSuffix', { defaultValue: '문자 발송' })}</span>
            </p>
          ) : (
            <p className="text-[12px] text-gray-400 dark:text-gray-500 leading-snug">{t('voucher.ktCheckMmsShort', { defaultValue: '휴대폰 메시지함에서 확인' })}</p>
          )}
        </div>

        {/* 우측: 가격 + 액션 */}
        <div className="shrink-0 flex flex-col items-end justify-between">
          {price !== null ? (
            <div className="text-[15px] font-bold tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
              {formatNumber(price)}<span className="font-sans text-[12px] font-semibold text-gray-400 dark:text-gray-500">{t('voucher.deal', { defaultValue: '딜' })}</span>
            </div>
          ) : <span />}
          {sendFailed ? (
            <a href="tel:0507-0177-0432" aria-label={t('voucher.contactSupport', { defaultValue: '고객센터 문의 (0507-0177-0432)' })}
              className="flex items-center gap-1 rounded-xl px-3 py-[9px] border border-rule-strong text-gray-700 dark:text-gray-200 text-[12px] font-bold active:scale-95 transition-transform whitespace-nowrap">
              {t('voucher.contactSupportShort', { defaultValue: '고객센터' })}
            </a>
          ) : (
            <div className="w-7 h-7 flex items-center justify-center opacity-60" aria-hidden>
              <Smartphone className="w-5 h-5 text-gray-300 dark:text-gray-600" strokeWidth={1.6} />
            </div>
          )}
        </div>
      </div>

      {/* PIN 모드 인앱 바코드 — 하단 (매장 제시용) */}
      {hasBarcode && (
        <div className="mt-3 px-3 py-3 rounded-xl bg-warm border border-gray-100 dark:border-[#2C2F35] flex flex-col items-center gap-2">
          <Barcode value={v.kt_pin as string} />
          <span className="text-[12px] tabular-nums font-bold tracking-[0.15em] text-gray-900 dark:text-white">{v.kt_pin}</span>
        </div>
      )}
    </div>
  )
}
