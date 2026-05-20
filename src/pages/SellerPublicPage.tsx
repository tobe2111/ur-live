import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { compressForThumbnail } from '@/lib/image-compress'
import { useTheme } from '@/shared/stores/useTheme'
import { Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import StreamCard from './seller-public/StreamCard'
import VideosTab from './seller-public/VideosTab'
import VouchersTab from './seller-public/VouchersTab'
import HomeTab from './seller-public/HomeTab'
import ProfileHeader from './seller-public/ProfileHeader'
import InfoTab from './seller-public/InfoTab'
import TabsNav from './seller-public/TabsNav'
import OwnerDashboardFab from './seller-public/OwnerDashboardFab'
import { getThemeTokens } from './seller-public/theme'
import type { Seller, LiveStream, Product, Short, Tab } from './seller-public/types'

// 🛡️ 2026-05-02: TD-018 분할 — types / FollowButton / StreamCard 를
//   ./seller-public/ 디렉토리로 추출.
// 🛡️ 2026-05-07: TD-018 추가 분할 — ProfileHeader / InfoTab / theme 추출 (632→<350 lines).

export default function SellerPublicPage() {
  const { t } = useTranslation()
  const { sellerId: rawParam } = useParams<{ sellerId: string }>()
  const navigate = useNavigate()
  // sellerId는 숫자 ID 또는 slug/username
  const sellerId = rawParam
  const [seller, setSeller] = useState<Seller | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [shorts, setShorts] = useState<Short[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('home')

  // 셀러 본인인지 확인 (편집 버튼 표시용) — seller 로드 후 id/username 비교
  // 🛡️ 2026-04-30: 듀얼 세션 (user_type='user' + seller_token 동시 보유) 도 owner 인정.
  // 🛡️ 2026-05-16: storedSellerId 가 username 으로 저장된 경우도 매칭 (id vs username 모두 비교)
  const storedSellerId = localStorage.getItem('seller_id')
  const sellerToken = localStorage.getItem('seller_token')
  const isOwner = !!sellerToken && !!seller && (
    String(seller.id) === storedSellerId ||
    String(seller.username || '') === storedSellerId ||
    String(seller.username || '') === rawParam  // 본인이 본인 URL 로 진입한 경우
  )
  // 🛡️ 2026-05-16: DEV 디버그 — isOwner 가 false 일 때 콘솔에 이유 표시 (운영자가 진단 용이)
  if (typeof window !== 'undefined' && import.meta.env.DEV && seller && !isOwner) {
    console.log('[SellerPublicPage] isOwner=false:', {
      hasToken: !!sellerToken,
      sellerIdInDb: seller.id,
      sellerUsernameInDb: seller.username,
      storedSellerId,
      rawParam,
    })
  }

  // ── 인라인 편집 상태 ──
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editKakao, setEditKakao] = useState('')
  const [editInsta, setEditInsta] = useState('')
  const [editYoutube, setEditYoutube] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 전역 테마 토글 연동 (useTheme 스토어)
  const { applied } = useTheme()
  const isDark = applied === 'dark'
  const T = getThemeTokens(isDark)

  const startEdit = (field: string) => {
    if (!isOwner) return
    setEditingField(field)
    if (field === 'name') setEditName(seller?.name || '')
    if (field === 'bio') setEditBio(seller?.bio || '')
    if (field === 'kakao') setEditKakao(seller?.kakao_chat_link || '')
    if (field === 'instagram') setEditInsta(seller?.sns_instagram || '')
    if (field === 'youtube') setEditYoutube(seller?.sns_youtube || '')
  }

  const saveEdit = async (field: string, value: string) => {
    setSaving(true)
    const token = localStorage.getItem('seller_token')
    try {
      const payload: Record<string, string> = {}
      if (field === 'name') payload.name = value
      if (field === 'bio') payload.bio = value
      if (field === 'kakao') payload.kakao_chat_link = value
      if (field === 'instagram') payload.sns_instagram = value
      if (field === 'youtube') payload.sns_youtube = value

      await api.put('/api/seller/profile', payload, { headers: { Authorization: `Bearer ${token}` } })
      // 로컬 상태 업데이트
      setSeller(prev => prev ? { ...prev, ...payload } : prev)
      setEditingField(null)
      toast.success(t('common.saveSuccess'))
    } catch { toast.error(t('common.saveFailed')) }
    finally { setSaving(false) }
  }

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const token = localStorage.getItem('seller_token')
    if (!token) {
      toast.error(t('common.loginRequired', { defaultValue: '로그인이 필요합니다' }))
      return
    }

    // 🛡️ 2026-05-01: base64 → DB 직접 저장 → upload-image multipart 로 변경.
    //   원인: 5MB 이미지가 ~7MB base64 → PUT body 한도 초과 + DB row 비대 → 업로드 실패.
    //   수정: /api/seller/upload-image (multipart) → URL 받기 → PUT /api/seller/profile 로 URL 만 저장.
    const MAX_BYTES = 5 * 1024 * 1024
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

    if (file.size > MAX_BYTES) {
      toast.error(t('common.fileSizeLimit', { defaultValue: `파일 크기는 5MB 이하여야 합니다 (현재: ${(file.size / 1024 / 1024).toFixed(1)}MB)`, size: (file.size / 1024 / 1024).toFixed(1) }))
      return
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t('common.imageTypeOnly', { defaultValue: 'JPEG, PNG, WebP, GIF 만 가능합니다' }))
      return
    }

    setSaving(true)
    try {
      // 1. 클라이언트 압축 → URL 획득 (CF Images 유료 회피, WebP 1024px)
      const compressed = await compressForThumbnail(file)
      const formData = new FormData()
      formData.append('image', compressed)
      const uploadRes = await api.post('/api/seller/upload-image', formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!uploadRes.data?.success || !uploadRes.data?.url) {
        throw new Error(uploadRes.data?.error || '업로드 실패')
      }
      const imageUrl = uploadRes.data.url

      // 2. URL 만 프로필에 저장
      await api.put('/api/seller/profile', { profile_image: imageUrl }, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setSeller(prev => prev ? { ...prev, profile_image: imageUrl } : prev)
      toast.success(t('seller.publicPage.profileImageChanged'))
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      const msg = e.response?.data?.error || e.message || t('seller.publicPage.imageUploadFailed')
      toast.error(msg)
      if (import.meta.env.DEV) console.error('[SellerPublic] Upload failed:', err)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!sellerId) return
    setLoading(true)

    // 🛡️ 2026-05-19 로딩 속도 최적화 (사용자 신고):
    //   이전: profile → (waited) → products/streams/shorts (sequential, 2 round-trips blank screen)
    //   이후: profile 도착 즉시 setLoading(false) → 헤더/탭 렌더링 → 데이터는 백그라운드.
    //   각 탭은 자기 데이터 도착 전까지 빈 상태 + skeleton 으로 graceful 표시.
    api.get(`/api/sellers/${sellerId}/public`).then(sellerRes => {
      const sellerData = sellerRes.data.data
      if (!sellerData) { setSeller(null); setLoading(false); return }
      setSeller(sellerData)
      setLoading(false)  // ← 헤더/탭 즉시 노출, 사용자가 빈 화면 안 봄

      // 그 다음 데이터는 백그라운드 병렬 fetch (fire-and-forget)
      const numericId = sellerData.id
      api.get(`/api/products?seller_id=${numericId}&limit=20`)
        .then(r => setProducts(r.data.data || []))
        .catch(() => { /* graceful — empty list */ })
      api.get(`/api/streams?seller_id=${numericId}&limit=20`)
        .then(r => setStreams(r.data.data || []))
        .catch(() => { /* graceful */ })
      api.get(`/api/shorts/feed?limit=20&seller_id=${numericId}`)
        .then(r => {
          const list = r.data.data || []
          setShorts(list.filter((s: Short & { seller_id?: number }) => String(s.seller_id) === String(numericId)))
        })
        .catch(() => { /* graceful */ })
    }).catch(() => { setSeller(null); setLoading(false) })
  }, [sellerId])

  // 실시간 라이브 감지 — 공개 페이지 머물러 있을 때 셀러가 라이브 시작하면 즉시 반영
  // 30초마다 streams 만 재조회 (가벼운 쿼리)
  useEffect(() => {
    if (!seller) return
    const numericId = seller.id
    let prevLiveCount = streams.filter(s => s.status === 'live').length

    const poll = async () => {
      try {
        const res = await api.get(`/api/streams?seller_id=${numericId}&limit=20`)
        const fresh: LiveStream[] = res.data.data || []
        const freshLiveCount = fresh.filter(s => s.status === 'live').length
        setStreams(fresh)

        // 라이브 시작 감지 (0 → 1+)
        if (prevLiveCount === 0 && freshLiveCount > 0) {
          const liveStream = fresh.find(s => s.status === 'live')
          toast.success(`${seller.name} 셀러의 라이브가 시작됐어요!`)
          if (liveStream) {
            // 배너 확인 용이하게 소리 없는 vibration (모바일)
            try { if ('vibrate' in navigator) navigator.vibrate(200) } catch { /* ignore */ }
          }
        }
        // 라이브 종료 감지 (1+ → 0)
        if (prevLiveCount > 0 && freshLiveCount === 0) {
          toast.info(t('seller.public.liveEnded', { defaultValue: '라이브 방송이 종료됐어요.' }))
        }
        prevLiveCount = freshLiveCount
      } catch { /* silent */ }
    }

    const id = setInterval(() => { if (!document.hidden) poll() }, 30000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller?.id])

  if (loading) return (
    <div className={`min-h-screen ${T.bg} flex items-center justify-center`}>
      <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
    </div>
  )

  if (!seller) return (
    <div className={`min-h-screen ${T.bg} flex flex-col items-center justify-center`}>
      <p className={T.textMuted}>{t('seller.sellerNotFound')}</p>
      <button onClick={() => navigate('/')} className="mt-3 text-sm text-pink-500">{t('seller.goToHome')}</button>
    </div>
  )

  const liveNow = streams.find(s => s.status === 'live')
  const recentStreams = streams.slice(0, 6)

  const mealVouchers = products.filter(p => p.category === 'meal_voucher')
  // 🛡️ 2026-05-19: '상품' 탭 — 식사권 외 일반 상품 (deal_only 교환권은 셀러가 등록 안 하므로 자동 제외).
  const shopProducts = products.filter(p => p.category !== 'meal_voucher' && Number(p.deal_only) !== 1)

  const TABS: { key: Tab; label: string }[] = [
    { key: 'home', label: t('seller.tabHome') },
    { key: 'shop', label: `${t('seller.publicPage.shop', { defaultValue: '상품' })} ${shopProducts.length}` },
    { key: 'vouchers', label: `${t('seller.publicPage.vouchers')} ${mealVouchers.length}` },
    { key: 'shorts', label: `${t('seller.publicPage.videos')} ${shorts.length}` },
    { key: 'live', label: `${t('seller.tabLive')} ${streams.length}` },
    { key: 'info', label: t('seller.tabInfo') },
  ]

  return (
    <div className={`min-h-screen ${T.bg} pb-28`}>
      <SEO
        title={seller.name || t('product.seller')}
        description={seller.bio || `${seller.name || t('product.seller')} - Ur Deal`}
        image={seller.profile_image}
        url={`/profile/${seller.username || seller.slug || seller.id}`}
        /* 🛡️ 2026-04-22: Person/Organization JSON-LD 추가 (Google 셀러 카드 노출) */
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: seller.name || seller.username || '셀러',
          description: seller.bio || `${seller.name || '셀러'}의 라이브 커머스 채널`,
          image: seller.profile_image || undefined,
          url: `https://live.ur-team.com/profile/${seller.username || seller.slug || seller.id}`,
          ...((seller as any).follower_count != null && { interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/FollowAction', userInteractionCount: (seller as any).follower_count } }),
        }}
      />

      <ProfileHeader
        seller={seller}
        sellerId={sellerId!}
        isOwner={isOwner}
        isDark={isDark}
        T={T}
        liveNow={liveNow}
        products={products}
        streams={streams}
        editingField={editingField}
        setEditingField={setEditingField}
        editName={editName}
        setEditName={setEditName}
        editBio={editBio}
        setEditBio={setEditBio}
        saving={saving}
        startEdit={startEdit}
        saveEdit={saveEdit}
        fileInputRef={fileInputRef}
        handleProfileImageUpload={handleProfileImageUpload}
      />

      {/* 탭 — 🛡️ 2026-04-30 v4 sticky chrome 톤 */}
      <TabsNav tabs={TABS} current={tab} onChange={setTab} isDark={isDark} T={T} />

      {/* 탭 콘텐츠 */}
      <div className="ur-content-wide px-4 lg:px-8 py-5">
        {tab === 'home' && (
          <HomeTab
            mealVouchers={mealVouchers}
            shorts={shorts}
            recentStreams={recentStreams}
            streams={streams}
            isOwner={isOwner}
            textClass={T.text}
            setTab={setTab}
            sellerId={seller?.id ? Number(seller.id) : undefined}
          />
        )}

        {tab === 'shop' && (
          shopProducts.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {isOwner
                ? t('seller.publicPage.noShopProductsOwner', { defaultValue: '등록한 상품이 없습니다. 셀러 대시보드 → 상품 등록에서 추가하세요.' })
                : t('seller.publicPage.noShopProducts', { defaultValue: '등록된 상품이 없습니다.' })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-6 lg:gap-x-4 lg:gap-y-8">
              {shopProducts.map(p => {
                const discountRate = p.discount_rate || (p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => navigate(`/products/${p.id}`)}
                    className="text-left active:scale-[0.98] transition-transform w-full block"
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-gray-50 rounded-xl">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-100" />
                      )}
                      {discountRate > 0 && (
                        <span className="absolute top-1.5 left-1.5 rounded-md px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-extrabold">
                          -{discountRate}%
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <p className={`text-[12px] ${T.text} leading-tight line-clamp-2`}>{p.name}</p>
                      {p.original_price && p.original_price > p.price && (
                        <p className="text-[10px] text-gray-400 line-through mt-1">{p.original_price.toLocaleString('ko-KR')}원</p>
                      )}
                      <div className="flex items-baseline gap-1 mt-0.5">
                        {discountRate > 0 && <span className="text-[13px] font-extrabold text-red-500">{discountRate}%</span>}
                        <span className={`text-[13px] font-extrabold ${T.text}`}>{p.price.toLocaleString('ko-KR')}원</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )
        )}

        {tab === 'vouchers' && (
          <VouchersTab mealVouchers={mealVouchers} isOwner={isOwner} textClass={T.text} />
        )}

        {tab === 'shorts' && (
          <VideosTab shorts={shorts} isOwner={isOwner} textClass={T.text} />
        )}

        {tab === 'live' && (
          streams.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">{t('seller.publicPage.noLiveRecords')}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {streams.map(s => (
                <StreamCard key={s.id} stream={s} onClick={() => navigate(`/live/${s.id}`)} />
              ))}
            </div>
          )
        )}

        {tab === 'info' && (
          <InfoTab
            seller={seller}
            sellerId={sellerId!}
            isOwner={isOwner}
            T={T}
            editingField={editingField}
            setEditingField={setEditingField}
            editBio={editBio}
            setEditBio={setEditBio}
            editInsta={editInsta}
            setEditInsta={setEditInsta}
            editYoutube={editYoutube}
            setEditYoutube={setEditYoutube}
            editKakao={editKakao}
            setEditKakao={setEditKakao}
            saving={saving}
            startEdit={startEdit}
            saveEdit={saveEdit}
          />
        )}
      </div>

      {/* 셀러 본인: 플로팅 대시보드 버튼 */}
      {isOwner && <OwnerDashboardFab />}
    </div>
  )
}
