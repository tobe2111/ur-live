import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useTheme } from '@/shared/stores/useTheme'
import { Loader2, ArrowLeft, Share2, Star, MessageCircle, Heart, ChevronRight, Eye, Play, Clock, MapPin, Pencil, Plus, Settings, Trophy, Camera, Check, X, Phone } from 'lucide-react'
import SupporterRanking from '@/components/live/SupporterRanking'
import { toast } from '@/hooks/useToast'
import { nativeShare } from '@/lib/native'
import SEO from '@/components/SEO'
import { formatNumber } from '@/utils/format'
import FollowButton from './seller-public/FollowButton'
import StreamCard from './seller-public/StreamCard'
import VideosTab from './seller-public/VideosTab'
import VouchersTab from './seller-public/VouchersTab'
import HomeTab from './seller-public/HomeTab'
import type { Seller, LiveStream, Product, Short, Tab } from './seller-public/types'

// 🛡️ 2026-05-02: TD-018 분할 — types / FollowButton / StreamCard 를
//   ./seller-public/ 디렉토리로 추출.

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

  // 셀러 본인인지 확인 (편집 버튼 표시용) — seller 로드 후 id 비교
  // 🛡️ 2026-04-30: 듀얼 세션 (user_type='user' + seller_token 동시 보유) 도 owner 인정.
  //   기존 user_type==='seller' 단독 체크는 dual-mode (CLAUDE.md 정책) 사용자를 owner 로 인식 못 함.
  const storedSellerId = localStorage.getItem('seller_id')
  const sellerToken = localStorage.getItem('seller_token')
  const isOwner = !!sellerToken && !!seller && String(seller.id) === storedSellerId

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

  // 테마별 클래스 매핑
  const T = isDark ? {
    bg: 'bg-[#020202]', card: 'bg-[#121212]', cardAlt: 'bg-[#1A1A1A]',
    text: 'text-white', textSub: 'text-gray-400', textMuted: 'text-gray-500',
    border: 'border-[#1A1A1A]', borderAlt: 'border-[#2A2A2A]',
    cover: 'from-pink-900/50 via-purple-900/40 to-orange-900/30',
    avatarBorder: 'border-[#020202]', input: 'bg-[#121212] text-white',
    btnOutline: 'border-[#2A2A2A] text-gray-300',
  } : {
    bg: 'bg-white', card: 'bg-white', cardAlt: 'bg-gray-50',
    text: 'text-gray-900', textSub: 'text-gray-600', textMuted: 'text-gray-500',
    border: 'border-gray-100', borderAlt: 'border-gray-200',
    cover: 'from-pink-200 via-purple-100 to-orange-100',
    avatarBorder: 'border-white', input: 'bg-gray-50 text-gray-900',
    btnOutline: 'border-gray-200 text-gray-700',
  }

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
      toast.error('로그인이 필요합니다')
      return
    }

    // 🛡️ 2026-05-01: base64 → DB 직접 저장 → upload-image multipart 로 변경.
    //   원인: 5MB 이미지가 ~7MB base64 → PUT body 한도 초과 + DB row 비대 → 업로드 실패.
    //   수정: /api/seller/upload-image (multipart) → URL 받기 → PUT /api/seller/profile 로 URL 만 저장.
    const MAX_BYTES = 5 * 1024 * 1024
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

    if (file.size > MAX_BYTES) {
      toast.error(`파일 크기는 5MB 이하여야 합니다 (현재: ${(file.size / 1024 / 1024).toFixed(1)}MB)`)
      return
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('JPEG, PNG, WebP, GIF 만 가능합니다')
      return
    }

    setSaving(true)
    try {
      // 1. 이미지 업로드 → URL 획득
      const formData = new FormData()
      formData.append('image', file)
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

    // 먼저 셀러 정보 조회 (username/slug 지원)
    api.get(`/api/sellers/${sellerId}/public`).then(sellerRes => {
      const sellerData = sellerRes.data.data
      if (!sellerData) { setSeller(null); setLoading(false); return }
      setSeller(sellerData)

      // 셀러 ID로 나머지 데이터 조회
      const numericId = sellerData.id
      return Promise.all([
        api.get(`/api/products?seller_id=${numericId}&limit=20`).catch(() => ({ data: { data: [] } })),
        api.get(`/api/streams?seller_id=${numericId}&limit=20`).catch(() => ({ data: { data: [] } })),
        api.get(`/api/shorts/feed?limit=20`).catch(() => ({ data: { data: [] } })),
      ]).then(([productsRes, streamsRes, shortsRes]) => {
        setProducts(productsRes.data.data || [])
        setStreams(streamsRes.data.data || [])
        const allShorts = shortsRes.data.data || []
        setShorts(allShorts.filter((s: Short & { seller_id?: number }) => String(s.seller_id) === String(numericId)))
      })
    }).catch(() => { setSeller(null) })
      .finally(() => setLoading(false))
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
  const bestProducts = products.slice(0, 6)
  const recentStreams = streams.slice(0, 6)

  const mealVouchers = products.filter(p => p.category === 'meal_voucher')
  const regularProducts = products.filter(p => p.category !== 'meal_voucher')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'home', label: t('seller.tabHome') },
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
      {/* 커버 + 프로필 */}
      <div className="relative">
        {/* 커버 이미지 */}
        <div className={`h-44 bg-gradient-to-br ${T.cover}`} />

        {/* 상단 네비 — 🛡️ 2026-04-30 v4 glass pill 톤 통일 */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 pt-safe pb-2 z-10">
          <button type="button" onClick={() => navigate(-1)} aria-label={t('notifications.back')} className="rounded-full flex items-center justify-center w-[34px] h-[34px] bg-white/[0.08] backdrop-blur-md">
            <ArrowLeft className="w-4 h-4 text-white" aria-hidden="true" />
          </button>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                const url = window.location.href
                if (navigator.share) navigator.share({ title: seller.name, url })
                else { navigator.clipboard?.writeText(url); toast.success(t('seller.linkCopiedToast')) }
              }}
              aria-label="공유"
              className="rounded-full flex items-center justify-center w-[34px] h-[34px] bg-white/[0.08] backdrop-blur-md"
            >
              <Share2 className="w-4 h-4 text-white" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* 프로필 아바타 */}
        <div className="absolute -bottom-10 left-5">
          <div className="relative">
            <div
              className={`w-20 h-20 rounded-full border-4 ${T.avatarBorder} bg-gray-700 overflow-hidden shadow-lg ${isOwner ? 'cursor-pointer' : ''}`}
              onClick={() => isOwner && fileInputRef.current?.click()}
            >
              {seller.profile_image ? (
                <img src={seller.profile_image} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center">
                  <span className={`text-2xl font-bold ${T.text}`}>{(seller.name || '?').charAt(0)}</span>
                </div>
              )}
              {isOwner && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            {isOwner && <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />}
            {liveNow && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">LIVE</span>
            )}
          </div>
        </div>
      </div>

      {/* 셀러 정보 */}
      <div className="pt-14 px-5 pb-4">
        <div className="flex items-center justify-between">
          {editingField === 'name' ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className={`text-xl font-extrabold ${T.text} bg-transparent border-b-2 border-pink-500 focus:outline-none flex-1`}
                onKeyDown={e => e.key === 'Enter' && saveEdit('name', editName)}
              />
              <button onClick={() => saveEdit('name', editName)} disabled={saving} className="p-1.5 bg-pink-500 rounded-full text-white"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditingField(null)} aria-label={t('common.cancelEdit')} className="p-1.5 bg-gray-200 rounded-full text-gray-500"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <h1 className={`text-xl font-extrabold ${T.text} group`} onClick={() => startEdit('name')}>
              {seller.name || t('seller.publicPage.noName')}
              {isOwner && <Pencil className="w-3 h-3 text-gray-300 inline ml-1.5 opacity-60 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity" />}
            </h1>
          )}
        </div>
        {seller.business_name && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className={`w-3 h-3 ${T.textMuted}`} />
            <span className={`text-xs ${T.textMuted}`}>{seller.business_name}</span>
          </div>
        )}
        {editingField === 'bio' ? (
          <div className="mt-2">
            <textarea
              autoFocus
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              rows={3}
              className={`w-full text-sm ${T.input} border border-pink-500 rounded-lg p-2 focus:outline-none focus:border-pink-500 resize-none`}
            />
            <div className="flex gap-2 mt-1">
              <button onClick={() => saveEdit('bio', editBio)} disabled={saving} className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-lg">{t('common.save')}</button>
              <button onClick={() => setEditingField(null)} className={`px-3 py-1 ${T.cardAlt} ${T.textMuted} text-xs rounded-lg`}>{t('common.cancel')}</button>
            </div>
          </div>
        ) : (
          <div className="group mt-2" onClick={() => startEdit('bio')}>
            <p className={`text-sm ${T.textSub} leading-relaxed line-clamp-2`}>
              {seller.bio || (isOwner ? t('seller.publicPage.enterBio') : '')}
            </p>
            {isOwner && <Pencil className={`w-3 h-3 ${T.textMuted} inline opacity-60 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity`} />}
          </div>
        )}

        {/* 통계 — 🛡️ 2026-04-30 v4 톤 (테마 토큰 반영) */}
        <div className="grid grid-cols-3 gap-2 mt-4 mb-2">
          <div className={`rounded-2xl px-3 py-2.5 ${isDark ? 'bg-white/[0.04]' : 'bg-gray-100'}`}>
            <p className={`text-[10px] ${T.textMuted}`}>{t('seller.tabProducts')}</p>
            <p className={`text-[15px] font-extrabold ${T.text} mt-0.5`} style={{ letterSpacing: '-0.02em' }}>{products.length}</p>
          </div>
          <div className={`rounded-2xl px-3 py-2.5 ${isDark ? 'bg-white/[0.04]' : 'bg-gray-100'}`}>
            <p className={`text-[10px] ${T.textMuted}`}>{t('seller.tabLive')}</p>
            <p className={`text-[15px] font-extrabold ${T.text} mt-0.5`} style={{ letterSpacing: '-0.02em' }}>{streams.length}</p>
          </div>
          <div className={`rounded-2xl px-3 py-2.5 ${isDark ? 'bg-white/[0.04]' : 'bg-gray-100'}`}>
            <p className={`text-[10px] ${T.textMuted}`}>{t('seller.rating')}</p>
            <p className={`text-[15px] font-extrabold ${T.text} mt-0.5 flex items-center gap-0.5`} style={{ letterSpacing: '-0.02em' }}>
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" aria-hidden="true" />
              {(seller as any)?.average_rating != null
                ? Number((seller as any).average_rating).toFixed(1)
                : <span className={`${T.textMuted} text-[11px] font-semibold`}>{t('common.new')}</span>}
            </p>
          </div>
        </div>

        {/* 🛡️ 2026-04-30: 본인이면 명시적 '프로필 수정' 버튼 (인라인 편집 외 진입점)
            아니면 팔로우 + 1:1 + 후원 CTA */}
        {isOwner ? (
          <button
            type="button"
            onClick={() => navigate('/seller/profile')}
            className={`w-full mt-2 py-3 rounded-2xl ${isDark ? 'bg-white/[0.08] text-white' : 'bg-gray-100 text-gray-900'} active:opacity-80 transition-all text-[14px] font-bold flex items-center justify-center gap-2`}
          >
            <Pencil className="w-4 h-4" aria-hidden="true" />
            {t('seller.publicPage.editProfile', { defaultValue: '프로필 수정' })}
          </button>
        ) : (
          <>
            <FollowButton sellerId={sellerId!} />
            <div className="flex gap-2 mt-2">
              {seller.kakao_chat_link && (
                <a href={seller.kakao_chat_link} target="_blank" rel="noopener" className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl ${isDark ? 'bg-white/[0.04] active:bg-white/[0.08] text-white' : 'bg-gray-100 active:bg-gray-200 text-gray-900'} transition-colors text-[12px] font-medium`}>
                  <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> {t('seller.oneOnOneInquiry')}
                </a>
              )}
              <button
                type="button"
                onClick={() => liveNow ? navigate(`/live/${liveNow.id}`) : toast.info(t('seller.noLiveNow'))}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl ${isDark ? 'bg-white/[0.04] active:bg-white/[0.08] text-white' : 'bg-gray-100 active:bg-gray-200 text-gray-900'} transition-colors text-[12px] font-medium`}
              >
                <Heart className="w-3.5 h-3.5" aria-hidden="true" /> {t('seller.donateButton')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 탭 — 🛡️ 2026-04-30 v4 sticky chrome 톤 */}
      <div
        className="sticky top-0 z-20"
        style={isDark ? { background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(20px) saturate(140%)', WebkitBackdropFilter: 'blur(20px) saturate(140%)', borderBottom: '0.5px solid rgba(84,84,88,0.34)' } : { background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px) saturate(140%)', WebkitBackdropFilter: 'blur(20px) saturate(140%)', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}
      >
        <div className="flex">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-[13px] font-semibold border-b-2 transition-colors ${
                tab === t.key ? `border-pink-500 ${T.text}` : `border-transparent ${T.textMuted}`
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="ur-content-wide px-4 lg:px-8 py-5">
        {/* ═══ 홈 탭 ═══ */}
        {tab === 'home' && (
          <HomeTab
            mealVouchers={mealVouchers}
            shorts={shorts}
            recentStreams={recentStreams}
            streams={streams}
            isOwner={isOwner}
            textClass={T.text}
            setTab={setTab}
          />
        )}

        {/* ═══ 식사권 탭 ═══ */}
        {tab === 'vouchers' && (
          <VouchersTab mealVouchers={mealVouchers} isOwner={isOwner} textClass={T.text} />
        )}

        {/* ═══ 영상 탭 (YouTube 임베드 2열) ═══ */}
        {tab === 'shorts' && (
          <VideosTab shorts={shorts} isOwner={isOwner} textClass={T.text} />
        )}

        {/* ═══ 라이브 탭 ═══ */}
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

        {/* ═══ 정보 탭 ═══ */}
        {tab === 'info' && (
          <div className="space-y-6">
            <section>
              <h3 className={`text-base font-bold ${T.text} mb-2`}>{t('seller.publicPage.introduction')}</h3>
              {editingField === 'bio-info' ? (
                <div>
                  <textarea autoFocus value={editBio} onChange={e => setEditBio(e.target.value)} rows={4}
                    className="w-full text-sm bg-gray-50 dark:bg-[#121212] border border-pink-500 rounded-lg p-2 focus:outline-none resize-none text-gray-900 dark:text-white" />
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => { saveEdit('bio', editBio); setEditingField(null) }} disabled={saving} className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-lg">{t('common.save')}</button>
                    <button onClick={() => setEditingField(null)} className="px-3 py-1 bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 text-xs rounded-lg">{t('common.cancel')}</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap group" onClick={() => { if (isOwner) { setEditBio(seller.bio || ''); setEditingField('bio-info') } }}>
                  {seller.bio || (isOwner ? t('seller.publicPage.enterBioTap') : t('seller.publicPage.noBio'))}
                  {isOwner && <Pencil className="w-3 h-3 text-gray-300 inline ml-1 opacity-60 lg:opacity-0 lg:group-hover:opacity-100" />}
                </p>
              )}

              {/* SNS 링크 */}
              <div className="mt-3 space-y-2">
                {/* Instagram */}
                {editingField === 'instagram' ? (
                  <div className="flex gap-2">
                    <input autoFocus value={editInsta} onChange={e => setEditInsta(e.target.value)} placeholder="https://instagram.com/..."
                      className="flex-1 px-2 py-1.5 border border-pink-500 rounded-lg text-sm bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-white" />
                    <button onClick={() => saveEdit('instagram', editInsta)} className="px-2 py-1.5 bg-pink-500 text-white text-xs rounded-lg"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingField(null)} aria-label="편집 취소" className="px-2 py-1.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 text-xs rounded-lg"><X className="w-3 h-3" /></button>
                  </div>
                ) : seller.sns_instagram ? (
                  <div className="flex items-center gap-2 group" onClick={() => isOwner && startEdit('instagram')}>
                    <a href={seller.sns_instagram} target="_blank" rel="noopener" onClick={e => isOwner && e.preventDefault()} className="text-sm text-pink-500">Instagram →</a>
                    {isOwner && <Pencil className="w-3 h-3 text-gray-300 opacity-60 lg:opacity-0 lg:group-hover:opacity-100" />}
                  </div>
                ) : isOwner ? (
                  <button onClick={() => startEdit('instagram')} className="text-xs text-gray-400 flex items-center gap-1"><Plus className="w-3 h-3" /> {t('seller.publicPage.addInstagram')}</button>
                ) : null}

                {/* YouTube */}
                {editingField === 'youtube' ? (
                  <div className="flex gap-2">
                    <input autoFocus value={editYoutube} onChange={e => setEditYoutube(e.target.value)} placeholder="https://youtube.com/..."
                      className="flex-1 px-2 py-1.5 border border-pink-500 rounded-lg text-sm bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-white" />
                    <button onClick={() => saveEdit('youtube', editYoutube)} className="px-2 py-1.5 bg-pink-500 text-white text-xs rounded-lg"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingField(null)} aria-label="편집 취소" className="px-2 py-1.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 text-xs rounded-lg"><X className="w-3 h-3" /></button>
                  </div>
                ) : seller.sns_youtube ? (
                  <div className="flex items-center gap-2 group" onClick={() => isOwner && startEdit('youtube')}>
                    <a href={seller.sns_youtube} target="_blank" rel="noopener" onClick={e => isOwner && e.preventDefault()} className="text-sm text-red-500">YouTube →</a>
                    {isOwner && <Pencil className="w-3 h-3 text-gray-300 opacity-60 lg:opacity-0 lg:group-hover:opacity-100" />}
                  </div>
                ) : isOwner ? (
                  <button onClick={() => startEdit('youtube')} className="text-xs text-gray-400 flex items-center gap-1"><Plus className="w-3 h-3" /> {t('seller.publicPage.addYoutube')}</button>
                ) : null}

                {/* 카카오 채팅 */}
                {editingField === 'kakao' ? (
                  <div className="flex gap-2">
                    <input autoFocus value={editKakao} onChange={e => setEditKakao(e.target.value)} placeholder="https://open.kakao.com/..."
                      className="flex-1 px-2 py-1.5 border border-pink-500 rounded-lg text-sm bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-white" />
                    <button onClick={() => saveEdit('kakao', editKakao)} className="px-2 py-1.5 bg-pink-500 text-white text-xs rounded-lg"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingField(null)} aria-label="편집 취소" className="px-2 py-1.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 text-xs rounded-lg"><X className="w-3 h-3" /></button>
                  </div>
                ) : isOwner && !seller.kakao_chat_link ? (
                  <button onClick={() => startEdit('kakao')} className="text-xs text-gray-400 flex items-center gap-1"><Plus className="w-3 h-3" /> {t('seller.publicPage.addKakaoChat')}</button>
                ) : null}
              </div>
            </section>
            {/* 사업자 정보 + 연락처 (전자상거래법: 필수 표시 항목) */}
            <section className="bg-gray-50 dark:bg-[#121212] rounded-xl p-4">
              <h3 className={`text-sm font-bold ${T.text} mb-3`}>{t('seller.publicPage.sellerInfo')}</h3>
              <div className="text-sm text-gray-400 space-y-2">
                <div className="flex">
                  <span className="w-24 text-gray-400 shrink-0 text-xs">{t('seller.publicPage.businessName')}</span>
                  <span className="text-xs">{seller.business_name || <span className="text-gray-500">{t('common.noInfo')}</span>}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-gray-400 shrink-0 text-xs">{t('seller.publicPage.representative')}</span>
                  <span className="text-xs">{seller.ceo_name || seller.name || <span className="text-gray-500">{t('common.noInfo')}</span>}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-gray-400 shrink-0 text-xs">{t('seller.publicPage.businessNumber')}</span>
                  <span className="text-xs">{seller.business_number || <span className="text-gray-500">{t('common.noInfo')}</span>}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-gray-400 shrink-0 text-xs">{t('seller.publicPage.mailOrderNumber')}</span>
                  <span className="text-xs">{seller.mail_order_number || <span className="text-gray-500">{t('common.noInfo')}</span>}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-gray-400 shrink-0 text-xs">{t('common.address')}</span>
                  <span className="text-xs">{seller.business_address || <span className="text-gray-500">{t('common.noInfo')}</span>}</span>
                </div>
                {/* 🛡️ 2026-04-22: 셀러 phone/email 공개 노출 제거 (개인정보 보호법 / PIPA)
                    - 공개 프로필에서 평문 노출은 spam/scam 위험 + 법적 위험
                    - "셀러에게 문의하기" 버튼은 별도 (있다면) 또는 카카오톡 채널 링크 사용
                    - API (/api/sellers/:id/public) 도 phone/email 미반환 (PUBLIC_SELLER_COLUMNS) */}
              </div>
              {/* 연락 수단 */}
              <div className="flex gap-2 mt-3">
                {seller.kakao_chat_link && (
                  <a href={seller.kakao_chat_link} target="_blank" rel="noopener"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-xs font-bold active:scale-[0.97]">
                    <MessageCircle className="w-3.5 h-3.5" /> {t('seller.publicPage.kakaoInquiry')}
                  </a>
                )}
                {seller.phone && (
                  <a href={`tel:${seller.phone}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white dark:bg-[#020202] border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold active:scale-[0.97]">
                    <Phone className="w-3.5 h-3.5" /> {t('seller.publicPage.phoneInquiry')}
                  </a>
                )}
              </div>
            </section>

            {/* 서포터 랭킹 */}
            <section>
              <SupporterRanking sellerId={sellerId!} />
            </section>

            <section>
              <h3 className={`text-base font-bold ${T.text} mb-2`}>{t('seller.publicPage.voucherGuide')}</h3>
              <div className="text-sm text-gray-400 space-y-2">
                <div className="flex"><span className="w-20 text-gray-500 shrink-0">{t('seller.publicPage.howToUse')}</span><span>{t('seller.publicPage.howToUseDesc')}</span></div>
                <div className="flex"><span className="w-20 text-gray-500 shrink-0">{t('seller.publicPage.validity')}</span><span>{t('seller.publicPage.validityDesc')}</span></div>
                <div className="flex"><span className="w-20 text-gray-500 shrink-0">{t('seller.publicPage.refund')}</span><span>{t('seller.publicPage.refundDesc')}</span></div>
                <div className="flex"><span className="w-20 text-gray-500 shrink-0">{t('seller.publicPage.contact')}</span><span>{t('seller.publicPage.contactDesc')}</span></div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* 셀러 본인: 플로팅 대시보드 버튼 — 🛡️ 2026-04-28: KakaoConsultButton 과 겹치지
           않도록 bottom-36 + max-w-[430px] mx-auto 컨테이너 (KakaoConsult 가 bottom-20 차지) */}
      {isOwner && (
        <div className="fixed bottom-36 left-0 right-0 z-50 px-4 pr-5 pointer-events-none">
          <div className="max-w-[430px] mx-auto flex justify-end">
            <button
              onClick={() => navigate('/seller')}
              className="pointer-events-auto flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-600/30 text-sm font-bold active:scale-95"
            >
              <Settings className="w-4 h-4" />
              {t('seller.dashboard')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
