/**
 * 🖥️ 2026-09-02 (대표 확정 — "PC 마이: 왼쪽 메뉴 + 오른쪽은 내용"): PC(lg+) 마이의 **우측 칸 상단**.
 *
 *   대표: *"PC 모드 답지 않은 페이지야. PC모드에선 이렇게 나오면 안돼."* — 종전 PC 는 모바일 '마이'의
 *   메뉴 목록(내 이용권/내 교환권/쿠폰함/…)을 가운데 600px 에 그대로 세운 것이라, 왼쪽 메뉴와 오른쪽
 *   목록이 **같은 항목을 두 번** 보여 줬다. 오른쪽은 메뉴가 아니라 **내용**이어야 한다:
 *     ① 프로필 한 줄 카드 ② 숫자 넷(딜·이용권·교환권·쿠폰 — 주인공) ③ 주문 현황 + 리뷰어 레벨 한 줄
 *     ④ 곧 쓸 이용권(티켓 카드, 지갑·결제 완료와 같은 부품) ⑤ 바로가기 타일 넷.
 *   그 아래(수익·역할·설정·로그아웃)는 페이지가 모바일과 **같은 컴포넌트**를 이어 그린다.
 *
 *   모바일(<lg)에서는 이 컴포넌트가 마운트되지 않는다(페이지의 `isPc` 분기) — 모바일은 손대지 않는다.
 *   데이터는 전부 기존 훅/엔드포인트(`useMyCounts` · `useMyVouchers` · `/api/points/balance`) 재사용.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BedDouble, BookOpen, Heart, Star, ChevronRight, Bell } from 'lucide-react'
import api from '@/lib/api'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import { parseUTCDate, formatKSTDate } from '@/utils/date'
import { useMyVouchers } from '@/hooks/queries/useMyData'
import { isStoreVoucher } from '@/shared/voucher-wallet'
import { TicketCard } from '@/components/ticket/TicketCard'
import OrderStatusBar from './OrderStatusBar'
import ReviewLevelCard from './ReviewLevelCard'
import SellerSwitchInline from './SellerSwitchInline'

type MyVoucher = NonNullable<ReturnType<typeof useMyVouchers>['data']>[number]
type Counts = { voucher: number | null; gifticon: number | null; coupon?: number | null; wish?: number | null }

const KPI_CLS = 'rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift p-5 text-left active:opacity-90'
const TILE_CLS = 'flex items-center gap-3 rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift px-4 py-3.5 text-left text-[13.5px] font-semibold text-gray-900 dark:text-white active:opacity-90'

function dday(expiresAt?: string): number | null {
  if (!expiresAt) return null
  const ms = parseUTCDate(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

export default function AccountPcPane({ counts, userName, profileImage, onEditProfile }: {
  counts: Counts
  userName: string
  profileImage?: string
  onEditProfile: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [balance, setBalance] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => api.get('/api/points/balance').then(r => { if (alive && r.data?.success) setBalance(Number(r.data.data?.balance ?? 0)) }).catch(() => {})
    load()
    window.addEventListener('pointsBalanceChanged', load)
    return () => { alive = false; window.removeEventListener('pointsBalanceChanged', load) }
  }, [])
  const { data: vouchers } = useMyVouchers()
  // 곧 쓸 이용권 — 사용 가능(unused) 매장 이용권을 만료 임박순으로 3장. 기한 없는 건 뒤로.
  const soon = useMemo(() => {
    const list = ((vouchers ?? []) as MyVoucher[]).filter(v => v.status === 'unused' && isStoreVoucher(v))
    return [...list].sort((a, b) => (dday(a.expires_at) ?? 9e9) - (dday(b.expires_at) ?? 9e9)).slice(0, 3)
  }, [vouchers])

  const kpis = [
    { label: t('my.dealBalance', { defaultValue: '내 딜 잔액' }), value: balance == null ? '–' : formatNumber(balance), unit: '딜', link: t('my.dealHistory', { defaultValue: '사용 내역' }), path: '/my-deal-history' },
    { label: t('my.kpiVouchers', { defaultValue: '사용 가능 이용권' }), value: counts.voucher == null ? '–' : String(counts.voucher), unit: '장', link: t('my.kpiOpenWallet', { defaultValue: '지갑 열기' }), path: '/my-vouchers' },
    { label: t('my.kpiGifticons', { defaultValue: '받은 교환권' }), value: counts.gifticon == null ? '–' : String(counts.gifticon), unit: '장', link: t('my.kpiSeeGifticons', { defaultValue: '교환권 보기' }), path: '/my-gifticons' },
    { label: t('shopping.coupons', { defaultValue: '쿠폰' }), value: counts.coupon == null ? '–' : String(counts.coupon), unit: '장', link: t('my.kpiCouponBox', { defaultValue: '쿠폰함' }), path: '/my-coupons' },
  ]
  const tiles = [
    { Icon: BedDouble, label: t('shopping.myStays', { defaultValue: '내 숙소 예약' }), path: '/my-stays' },
    { Icon: BookOpen, label: t('shopping.digitalLibrary', { defaultValue: '디지털 보관함' }), path: '/my/digital' },
    { Icon: Star, label: t('shopping.myFollows', { defaultValue: '내 단골 가게' }), path: '/my/follows' },
    { Icon: Heart, label: t('shopping.wishlist', { defaultValue: '찜한 상품' }), path: '/wishlist', count: counts.wish ?? undefined },
  ]

  return (
    <div className="space-y-5 pb-2">
      {/* ① 프로필 한 줄 카드 — 보라 그라디언트 띠 대신 */}
      <div className="flex items-center gap-3.5 rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift px-5 py-4">
        <img
          src={profileImage ? cfImage(profileImage, { width: 96 }) : `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=1C69EF&color=ffffff&size=96`}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          className="w-12 h-12 rounded-full object-cover shrink-0"
          onError={(e) => cfImageOnError(e.currentTarget, profileImage)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[16px] font-extrabold text-gray-900 dark:text-white truncate tracking-[-0.01em]">{userName}</p>
            <SellerSwitchInline />
          </div>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">{localStorage.getItem('user_email') || ''}</p>
        </div>
        <button type="button" onClick={() => navigate('/notifications')} aria-label={t('userProfile.ariaNotifications')} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-700 dark:text-white shrink-0">
          <Bell className="w-4 h-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={onEditProfile} className="inline-flex items-center gap-0.5 text-[13px] font-bold text-brand-text shrink-0">
          {t('userProfile.editProfile', { defaultValue: '프로필 편집' })} <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* ② 숫자 넷 — 주인공 */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map(k => (
          <button key={k.path} type="button" onClick={() => navigate(k.path)} className={KPI_CLS}>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">{k.label}</p>
            <p className="mt-1.5 text-[28px] font-extrabold leading-none tracking-[-0.02em] text-gray-900 dark:text-white tabular-nums">
              {k.value}<span className="ml-1 text-[14px] font-bold text-gray-400 dark:text-gray-500">{k.unit}</span>
            </p>
            <p className="mt-3 text-[12.5px] font-bold text-brand-text">{k.link} ›</p>
          </button>
        ))}
      </div>

      {/* ③ 주문 현황 + 리뷰어 레벨 — 한 줄 (기존 컴포넌트 재사용, 칸 안에서 폭 제한 무력화는 index.css) */}
      <div className="grid grid-cols-2 gap-4 items-start">
        <OrderStatusBar />
        <ReviewLevelCard />
      </div>

      {/* ④ 곧 쓸 이용권 — 티켓 카드 (지갑·결제 완료와 같은 부품). 없으면 이 절 자체를 그리지 않는다. */}
      {soon.length > 0 && (
        <div>
          <h5 className="text-[14px] font-extrabold text-gray-900 dark:text-white mb-3">{t('my.soonVouchers', { defaultValue: '곧 쓸 이용권' })}</h5>
          <div className="grid grid-cols-3 gap-4">
            {soon.map(v => {
              const d = dday(v.expires_at)
              const store = v.restaurant_name ? String(v.restaurant_name) : ''
              const name = String(v.product_name ?? '')
              return (
                <TicketCard
                  key={String(v.id)}
                  bandLeft={v.expires_at ? `${formatKSTDate(v.expires_at)}까지` : t('my.noExpiry', { defaultValue: '기한 없음' })}
                  bandRight={d == null ? undefined : `D-${d}`}
                  muted={d != null && d > 30}
                  onClick={() => navigate('/my-vouchers')}
                >
                  <div className="px-4 pt-3 pb-3.5">
                    {store && <p className="text-[11.5px] text-gray-500 dark:text-gray-400 truncate">{store}</p>}
                    <p className="text-[14px] font-bold text-gray-900 dark:text-white truncate">{name}</p>
                    <p className="mt-2 text-[12.5px] font-bold text-brand-text">{t('my.useVoucher', { defaultValue: '사용하기' })} ›</p>
                  </div>
                </TicketCard>
              )
            })}
          </div>
        </div>
      )}

      {/* ⑤ 바로가기 타일 넷 — 모바일 목록의 나머지 행. 여기서는 목록이 아니라 타일이다. */}
      <div className="grid grid-cols-4 gap-4">
        {tiles.map(({ Icon, label, path, count }) => (
          <button key={path} type="button" onClick={() => navigate(path)} className={TILE_CLS}>
            <Icon className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400 shrink-0" strokeWidth={1.6} aria-hidden="true" />
            <span className="flex-1 min-w-0 truncate">{label}</span>
            <span className="text-gray-400 dark:text-gray-500 text-[12px] tabular-nums shrink-0">{count != null ? `${count} ` : ''}›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
