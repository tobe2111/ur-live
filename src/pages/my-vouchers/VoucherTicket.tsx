// 🧱 2026-06-29 TD: MyVouchersPage god 파일 분해 — 이용권 카드 클러스터(verbatim 추출). 동작 불변.
//   MiniQrHint·Barcode·KtAlphaVoucherCard 는 모듈 내부 전용, VoucherTicket 만 페이지가 사용.
import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { safeDate } from '@/utils/safe-date'
import { formatNumber } from '@/utils/format'
import { toast } from '@/hooks/useToast'
import { QrCode, Copy, Gift, Smartphone } from 'lucide-react'
import { TicketCard, TicketRow } from '@/components/ticket/TicketCard'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import type { Voucher } from './types'
import ReviewBonusButton from './ReviewBonusButton'

// 🎟️ 2026-07-06 (대표 "ㄴ 이것도 개선해줘"): 이용권 카드에 매장 사용방식 칩 표시 — 유저가 매장 가기 전에
//   이 카드만 보고도 사용법을 파악. redemption-info(사장님 설정)를 코드별 1회 조회(모듈 캐시로 재조회 방지).
type RedeemMode = 'scan_only' | 'store_code' | 'self_free'
const MODE_CHIP: Record<RedeemMode, string> = {
  scan_only: '직원 스캔',
  store_code: '코드 입력',
  self_free: '바로 사용',
}
const _modeCache = new Map<string, RedeemMode | null>()

// 🎨 2026-06-21 시안 A: 패스 풋 'QR 힌트' (장식 — 실제 QR 은 사용하기 모달). 잉크 finder 패턴 + 닷.
function MiniQrHint({ muted }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={`w-10 h-10 shrink-0 ${muted ? 'text-gray-300 dark:text-gray-700' : 'text-gray-900 dark:text-white'}`} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="7">
        <rect x="6" y="6" width="26" height="26" rx="4" />
        <rect x="68" y="6" width="26" height="26" rx="4" />
        <rect x="6" y="68" width="26" height="26" rx="4" />
      </g>
      <g fill="currentColor">
        <rect x="44" y="44" width="10" height="10" rx="1.5" />
        <rect x="62" y="44" width="10" height="10" rx="1.5" />
        <rect x="44" y="62" width="10" height="10" rx="1.5" />
        <rect x="80" y="62" width="10" height="10" rx="1.5" />
        <rect x="62" y="80" width="10" height="10" rx="1.5" />
      </g>
    </svg>
  )
}

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
  const price = v.applied_price ?? v.product_price ?? null

  // 🎟️ 2026-07-06 (대표 승인): 미사용 카드는 어디를 눌러도 사용 안내(QR/사용법) 모달이 열림 —
  //   버튼 하나만 찾을 필요 없이 카드 전체가 진입점. 내부 인터랙션(코드 복사)은 stopPropagation 으로 보호.
  const tappable = v.status === 'unused'

  // 🎫 2026-09-02 (대표 시안 — 코레일톡 화이트 지갑 "나의 티켓"): 카드 = **색 밴드(기한 · D-N) + 흰 본문** 한 장.
  //   천공·노치·테두리·그림자 스택을 걷어내고 TicketCard 부품 하나로. 밴드가 티켓 은유를 맡으니 장식이 필요 없다.
  //   사용 완료·만료·환불은 밴드가 회색이 되고 전체가 흐려진다(muted). 동작(모달·복사·환불요청·재구매·후기)은 불변.
  const bandLeftText = expiresAt
    ? `${expiresAt.getFullYear()}.${String(expiresAt.getMonth() + 1).padStart(2, '0')}.${String(expiresAt.getDate()).padStart(2, '0')} (${['일', '월', '화', '수', '목', '금', '토'][expiresAt.getDay()]})까지`
    : (v.status === 'unused' ? t('voucher.noExpiry', { defaultValue: '사용 기한 없음' }) : t(`voucher.status.${v.status}`))
  const bandRightText = v.status === 'unused'
    ? (daysLeft !== null ? (daysLeft === 0 ? 'D-DAY' : `D-${daysLeft}`) : t('voucher.status.unused', { defaultValue: '사용 가능' }))
    : t(`voucher.status.${v.status}`)

  return (
    <TicketCard bandLeft={bandLeftText} bandRight={bandRightText} muted={muted || v.status !== 'unused'} onClick={tappable ? onShowQr : undefined}>
      {/* 첫 줄: 매장 · 사용 방식 칩 */}
      <TicketRow
        left={v.restaurant_name || t('voucher.tabGroupBuy', { defaultValue: '이용권' })}
        right={tappable && mode ? MODE_CHIP[mode] : (v.status === 'used' && usedAt ? `${usedAt.toLocaleDateString(locale)} ${t('voucher.usedSuffix', { defaultValue: '사용' })}` : undefined)}
      />

      <div className="px-4 pt-3.5 pb-4">
        <p className={`text-[18px] font-extrabold tracking-tight truncate ${urgent ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'}`}>{v.product_name}</p>
        <div className="flex items-end justify-between mt-3">
          {price !== null ? (
            <div className="text-[17px] font-extrabold tabular-nums tracking-tight text-gray-700 dark:text-gray-200 leading-none">
              {formatNumber(price)}<span className="text-[12px] font-bold text-gray-400 dark:text-gray-500 ml-0.5">{t('voucher.won', { defaultValue: '원' })}</span>
            </div>
          ) : <span />}
          {v.status === 'unused' && (
            <button
              onClick={(e) => { e.stopPropagation(); onShowQr() }}
              aria-label={t('voucher.scan', { defaultValue: '사용' })}
              className="flex items-center gap-1.5 rounded-full px-5 py-2.5 bg-brand text-white text-[13.5px] font-extrabold active:opacity-80"
            >
              <QrCode className="w-4 h-4" strokeWidth={1.6} />
              {t('voucher.useFull', { defaultValue: '사용하기' })}
            </button>
          )}
        </div>
      </div>

      {/* 풋 — refunded 는 액션 없음 */}
      {v.status !== 'refunded' && (
        <div className="border-t border-rule">
          {v.status === 'unused' ? (
            <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                // 🐛 2026-06-21: 실제 복사 성공 시에만 토스트 (비보안 컨텍스트 등 미지원 시 거짓 '복사됨' 방지)
                const cb = navigator.clipboard
                if (!cb?.writeText) return
                cb.writeText(v.code).then(() => toast.success(t('voucher.copied', { defaultValue: '복사됨' }))).catch(() => { /* 권한 거부 */ })
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:opacity-70"
            >
              <MiniQrHint />
              <div className="min-w-0">
                <span className="flex items-center gap-1.5 font-mono text-[12px] font-bold tracking-wide text-gray-700 dark:text-gray-200">
                  <span className="truncate">{v.code}</span>
                  <Copy className="w-3 h-3 shrink-0 text-gray-400 dark:text-gray-500" strokeWidth={1.6} aria-hidden />
                </span>
                <span className="block text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{t('voucher.tapForQr', { defaultValue: '탭하면 코드 복사 · 사용하기로 QR 제시' })}</span>
              </div>
            </button>
            {/* ↩️ 2026-08-20 (대표): 유저도 서비스에서 환불 요청 가능 — 미사용 이용권 한정.
                접수만 한다(돈은 안 움직임) — 승인·환불 실행은 운영자 확인 후 어드민(머니 경로). */}
            {v.order_id ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const reason = window.prompt(t('voucher.refundReasonPrompt', { defaultValue: '환불 요청 사유를 입력해주세요 (예: 방문 계획 취소)' }))
                  if (!reason || !reason.trim()) return
                  api.post('/api/returns/request', { order_id: v.order_id, reason: '이용권 환불 요청', detail_reason: reason.trim().slice(0, 500) })
                    .then(r => {
                      if (r.data?.success) toast.success(t('voucher.refundRequested', { defaultValue: '환불 요청이 접수되었어요. 확인 후 처리해 드릴게요.' }))
                      else toast.error(r.data?.error || t('voucher.refundFailed', { defaultValue: '환불 요청에 실패했어요' }))
                    })
                    .catch(err => toast.error(err?.response?.data?.error || t('voucher.refundFailed', { defaultValue: '환불 요청에 실패했어요' })))
                }}
                className="w-full px-4 pb-2.5 -mt-1 text-left text-[10px] text-gray-400 dark:text-gray-500 underline underline-offset-2 active:opacity-70"
              >
                {t('voucher.requestRefund', { defaultValue: '사용 전이라면 환불 요청' })}
              </button>
            ) : null}
            </>
          ) : (
            /* 🎨 2026-06-21 (개선 #4): 사용완료/만료 동선 — 재구매 + (사용완료만) 후기 보너스 */
            <div className="px-4 pt-3 pb-3.5">
              {v.product_id != null && (
                <button
                  type="button"
                  onClick={() => navigate(`/group-buy/${v.product_id}`)}
                  className="w-full h-11 rounded-xl border border-rule-strong text-brand-text text-[13px] font-bold active:opacity-70"
                >
                  {t('voucher.rebuy', { defaultValue: '다시 구매하기' })}
                </button>
              )}
              {v.status === 'used' && <ReviewBonusButton voucherCode={v.code} restaurantName={v.restaurant_name} restaurantAddress={v.restaurant_address} />}
            </div>
          )}
        </div>
      )}
    </TicketCard>
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
      className="relative rounded-2xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#2C2F35] p-[13px]"
      style={{ opacity: muted ? 0.55 : 1, boxShadow: muted ? 'none' : '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-stretch gap-3">
        {/* 썸네일 60px */}
        <div className="w-[60px] h-[60px] shrink-0 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#F7F8FA] to-[#EFF1F4] dark:from-[#1D1F29] dark:to-[#0F0F0F]">
          {v.product_image ? (
            <img src={cfImage(v.product_image, { width: 200, quality: 82, format: 'auto' }) || v.product_image} alt={v.product_name} loading="lazy" className="w-full h-full object-cover" onError={(e) => cfImageOnError(e.currentTarget, v.product_image)} />
          ) : (
            <Gift className="w-6 h-6 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
          )}
        </div>

        {/* 본문 */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {/* 상태 줄 + 기프티쇼 칩 */}
          <div className="flex items-center gap-1.5">
            {sendFailed ? (
              <>
                <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: '#DC2626' }} aria-hidden />
                <span className="text-[12px] font-semibold text-red-600 dark:text-red-400">{t('voucher.sendFailedBadge', { defaultValue: '발송 실패' })}</span>
              </>
            ) : v.status === 'unused' ? (
              <>
                <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: '#16A34A' }} aria-hidden />
                <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">{t('voucher.status.unused', { defaultValue: '사용 가능' })}</span>
              </>
            ) : (
              <span className="text-[12px] font-semibold" style={{ color: v.status === 'expired' ? '#DC2626' : '#6B7280' }}>{t(`voucher.status.${v.status}`)}</span>
            )}
            <span className="ml-auto shrink-0 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300">📱 기프티쇼</span>
          </div>

          {/* 제목 */}
          <p className="text-gray-900 dark:text-white font-bold text-[16px] leading-tight tracking-tight truncate">{v.product_name}</p>

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
            <div className="text-[15px] font-bold font-mono text-gray-900 dark:text-white whitespace-nowrap">
              {formatNumber(price)}<span className="font-sans text-[11px] font-semibold text-gray-400 dark:text-gray-500">{t('voucher.deal', { defaultValue: '딜' })}</span>
            </div>
          ) : <span />}
          {sendFailed ? (
            <a href="tel:0507-0177-0432" aria-label={t('voucher.contactSupport', { defaultValue: '고객센터 문의 (0507-0177-0432)' })}
              className="flex items-center gap-1 rounded-xl px-3 py-[9px] border border-gray-200 dark:border-[#2C2F35] text-gray-700 dark:text-gray-200 text-[12px] font-bold active:scale-95 transition-transform whitespace-nowrap">
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
        <div className="mt-3 px-3 py-3 rounded-xl bg-gray-50 dark:bg-[#11141C] border border-gray-100 dark:border-[#2C2F35] flex flex-col items-center gap-1.5">
          <Barcode value={v.kt_pin as string} />
          <span className="text-[12px] font-mono font-bold tracking-[0.15em] text-gray-900 dark:text-white">{v.kt_pin}</span>
        </div>
      )}
    </div>
  )
}
