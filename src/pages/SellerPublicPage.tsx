import { useEffect, useState, useRef } from 'react'
// 🏁 2026-06-26 (대표 결정 — "추천템은 사업자 링크샵에선 숨김"): 사업자 = 본인 상품이 주인공.
//   추천 핀(CuratorPinsSection) 섹션 제거 → 추천 적립 동선은 크리에이터 콘솔(/creator)에서 유지.
//   (일반 유저 링크샵(CuratorPage)은 추천템이 메인이라 그대로.)
// 🏁 2026-06-26 (대표 — "상품·이용권 모두 전체 등록 페이지로"): 얄팍한 빠른등록 모달(QuickProductModal) 제거 →
//   등록은 정식 풀페이지(/seller/products/new · /seller/meal-voucher/new)로. (lazy/Suspense 도 미사용→제거)
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { compressForThumbnail } from '@/lib/image-compress'
import { useTheme } from '@/shared/stores/useTheme'
import { Search, X } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import StreamCard from './seller-public/StreamCard'
import VideosTab from './seller-public/VideosTab'
import VouchersTab from './seller-public/VouchersTab'
// 🏁 2026-06-25 (대표 "통일"): 사업자 링크샵 헤더를 canonical CuratorHeader 로 — ProfileHeader 폐기(헤더 1개).
import CuratorHeader from './curator-page/CuratorHeader'
import type { CuratorProfile } from '@/features/curator/api/curator-api'
// 🏁 2026-06-25 (대표 "카드 1종"): 내 상품도 표준 BrowseProductCard(★평점·판매수 내장) — EditorialProductCard 폐기.
import BrowseProductCard from '@/pages/browse/BrowseProductCard'
import type { Product as BrowseProduct } from '@/pages/browse/types'
import { seededColor } from '@/utils/card-gradient'
import InfoTab from './seller-public/InfoTab'
import { getThemeTokens } from './seller-public/theme'
import BrandLoader from '@/components/brand/BrandLoader'
import { LIVE_COMMERCE_SUSPENDED } from '@/shared/feature-flags'
import type { Seller, LiveStream, Product, Short } from './seller-public/types'

// 🛡️ 2026-05-02: TD-018 분할 — types / FollowButton / StreamCard 를
//   ./seller-public/ 디렉토리로 추출.
// 🛡️ 2026-05-07: TD-018 추가 분할 — ProfileHeader / InfoTab / theme 추출 (632→<350 lines).

interface SellerPublicPageProps {
  /** 🛡️ 2026-05-25 (C 옵션 URL 통합): 외부 호출 시 sellerId 직접 전달 가능.
   *  CuratorPage 가 /u/:handle 진입 후 linked_seller 매칭되면 본 페이지를 직접 render
   *  (redirect 없이) → URL 통합. 미지정 시 useParams 사용 (legacy /profile/:sellerId 호환). */
  sellerIdOverride?: string
  /** 🏁 2026-06-25 (대표 "통일"): CuratorPage(/u/{handle})가 내려주는 큐레이터 정체성.
   *  사업자 링크샵도 canonical CuratorHeader 를 렌더 → 헤더 컴포넌트 1개로 통일(ProfileHeader 폐기).
   *  배너/이름 등은 curator 우선·seller 폴백으로 병합(저장 위치 분산 흡수). 비-/u/ 진입은 undefined. */
  curator?: CuratorProfile | null
  /** 🏁 2026-06-26 [UNLOCK_LOADING] (대표 — 로딩 워터폴 제거): CuratorPage 가 가진 linked_seller.id(숫자).
   *  넘기면 셀러 /public 응답을 기다리지 않고 상품 fetch 를 병렬로 시작(RTT 1개 절감). */
  sellerNumericId?: number
}

export default function SellerPublicPage({ sellerIdOverride, curator, sellerNumericId }: SellerPublicPageProps = {}) {
  const { t } = useTranslation()
  const params = useParams<{ sellerId: string }>()
  const rawParam = sellerIdOverride ?? params.sellerId
  const navigate = useNavigate()
  // sellerId는 숫자 ID 또는 slug/username
  const sellerId = rawParam
  const [seller, setSeller] = useState<Seller | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [shorts, setShorts] = useState<Short[]>([])
  const [loading, setLoading] = useState(true)

  // 🔗 2026-06-21 (대표 승인): 레거시 셀러 공개 URL(/profile·/s) standalone 진입을 연결된 유저 링크샵
  //   (/u/{handle})으로 통일. CuratorPage 임베드(sellerIdOverride)면 이미 /u/ 라 skip, 연결 핸들 없는
  //   셀러-only 계정은 그대로 이 페이지 렌더(폴백). (탭 state 는 2026-06-25 탭→섹션 전환으로 제거)
  const curatorHandle = (seller as { curator_handle?: string | null } | null)?.curator_handle || null
  useEffect(() => {
    if (sellerIdOverride) return                 // CuratorPage 임베드 — 이미 /u/{handle}
    if (!curatorHandle) return                   // 셀러-only(핸들 없음) — 기존 페이지 유지(폴백)
    const h = curatorHandle.toLowerCase()
    if (h === 'me') return
    if (rawParam && rawParam.toLowerCase().replace(/^@/, '') === h) return  // 이미 핸들 = 루프 방지
    navigate(`/u/${encodeURIComponent(curatorHandle)}`, { replace: true })
  }, [curatorHandle, sellerIdOverride, rawParam, navigate])
  // 🔍 2026-06-16 링크샵 시안: 상품 탭 검색 (이름 필터).
  const [shopQuery, setShopQuery] = useState('')
  // 🏁 2026-06-26 (대표 결정 — "상품·이용권 각자 전체 등록 페이지로"): 등록 종류 선택 시트(상품/이용권).
  //   둘 다 정식 등록 풀페이지로 네비게이트(상품=/seller/products/new, 이용권=/seller/meal-voucher/new).
  const [showAddSheet, setShowAddSheet] = useState(false)
  // 🏁 2026-06-25 (대표 "통일"): canonical CuratorHeader 의 인라인 편집 반영(낙관적). curator 우선·seller 폴백.
  const [curatorEdits, setCuratorEdits] = useState<Partial<CuratorProfile>>({})
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast.success(t('seller.linkCopiedToast', { defaultValue: '링크가 복사되었어요' })) } catch { /* ignore */ }
  }

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

  // 🎨 2026-06-17 (#6 링크샵 통일): 큐레이터 링크샵과 동일한 '방문자 미리보기' — 본인이 남이 보는 화면 그대로 확인.
  //   previewAsVisitor=false 기본이라 ownerView===isOwner → 기존 동작 불변(편집 어포던스만 ownerView 로 게이트).
  const [previewAsVisitor, setPreviewAsVisitor] = useState(false)
  const ownerView = isOwner && !previewAsVisitor

  // ── 인라인 편집 상태 ──
  // 🖼️ 2026-07-01 (대표 신고 — 소개 섹션 헤더와 중복): InfoTab 의 bio/Instagram/YouTube 인라인 편집 폐기
  //   (CuratorHeader 가 표시+편집 전담). 여기 남는 인라인 편집은 카카오 채팅 링크(헤더에 없는 유일 항목)뿐.
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editKakao, setEditKakao] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 전역 테마 토글 연동 (useTheme 스토어)
  const { applied } = useTheme()
  const isDark = applied === 'dark'
  const T = getThemeTokens(isDark)

  const startEdit = (field: string) => {
    if (!isOwner) return
    setEditingField(field)
    if (field === 'kakao') setEditKakao(seller?.kakao_chat_link || '')
  }

  const saveEdit = async (field: string, value: string) => {
    setSaving(true)
    const token = localStorage.getItem('seller_token')
    try {
      const payload: Record<string, string> = {}
      if (field === 'kakao') payload.kakao_chat_link = value

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

    // 🛡️ 2026-05-27 (loading P0): SSR inject 즉시 사용 + 중복 fetch 제거 (영구).
    //   기존: SSR setSeller 후에도 sellers API axios fetch 재호출 → 중복 RTT 200-500ms
    //   수정: SSR data 있으면 메인 fetch skip, products/streams/shorts 만 background fetch.
    //   효과: 링크샵 페이지 첫 paint + 메인 fetch 0 (SSR hit 시).
    let initialSellerData: any = null
    try {
      if (typeof document !== 'undefined') {
        const el = document.getElementById('__SSR_INITIAL_SELLER__')
        if (el?.textContent) {
          const parsed = JSON.parse(el.textContent)
          if (parsed?.success && parsed?.data) {
            initialSellerData = parsed.data
            setSeller(parsed.data)
            setLoading(false)
          }
        }
      }
    } catch { /* SSR inject 누락 / 손상 — fallback */ }

    // 🛡️ 셀러 sub-data (products/streams/shorts) background fetch — 홈탭이 셋 다 프리뷰하므로 모두 즉시(비차단).
    //   로딩 속도는 prewarm(products) + /api/shorts/feed edge cache 로 해결(cold D1 제거). lazy-탭은 홈 프리뷰 회귀라 미적용.
    const fetchSubData = (numericId: number) => {
      api.get(`/api/products?seller_id=${numericId}&limit=20`)
        .then(r => setProducts(r.data.data || []))
        .catch(() => { /* graceful */ })
      // 🏁 2026-06-25 (대표 신고 — 로딩 김): 라이브 영구중단이면 영상/라이브 섹션 미렌더라
      //   streams/shorts fetch 는 순수 낭비 → 스킵 (요청 2개 + 30초 폴링 제거).
      if (LIVE_COMMERCE_SUSPENDED) return
      api.get(`/api/streams?seller_id=${numericId}&limit=20`)
        .then(r => setStreams(r.data.data || []))
        .catch(() => { /* graceful */ })
      api.get(`/api/shorts/feed?limit=20&seller_id=${numericId}`)
        .then(r => {
          const list = r.data.data || []
          setShorts(list.filter((s: Short & { seller_id?: number }) => String(s.seller_id) === String(numericId)))
        })
        .catch(() => { /* graceful */ })
    }

    if (initialSellerData?.id) {
      // SSR hit → 메인 fetch 스킵, sub-data 만 background
      fetchSubData(initialSellerData.id)
      return
    }

    // 🏁 2026-06-26 [UNLOCK_LOADING] (대표 — 로딩 워터폴 제거): /u/ 사업자는 SSR 이 셀러를 주입 안 해
    //   '셀러 /public → 상품' 2연속 대기였음. linked_seller.id(sellerNumericId)를 알면 상품 fetch 를
    //   셀러 fetch 와 병렬로 시작 → 내 상품 그리드가 셀러 응답을 안 기다림(RTT 1개 절감).
    let subFetched = false
    if (sellerNumericId) { fetchSubData(sellerNumericId); subFetched = true }

    // SSR miss → 메인 fetch (헤더/정보용). sub-data 는 병렬 시작 안 됐을 때만 여기서.
    api.get(`/api/sellers/${sellerId}/public`).then(sellerRes => {
      const sellerData = sellerRes.data.data
      if (!sellerData) { setSeller(null); setLoading(false); return }
      setSeller(sellerData)
      setLoading(false)
      if (!subFetched) fetchSubData(sellerData.id)
    }).catch(() => { setSeller(null); setLoading(false) })
  }, [sellerId, sellerNumericId])

  // 실시간 라이브 감지 — 공개 페이지 머물러 있을 때 셀러가 라이브 시작하면 즉시 반영
  // 30초마다 streams 만 재조회 (가벼운 쿼리)
  useEffect(() => {
    if (!seller) return
    if (LIVE_COMMERCE_SUSPENDED) return  // 🏁 2026-06-25 라이브 영구중단 — 30초 streams 폴링 낭비 제거
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

  // 🏁 2026-06-25 (대표 신고 — 로딩 김): 헤더 정체성(curator 우선·seller 폴백) 객체. seller 로드 전에도
  //   curator 만으로 헤더를 즉시 렌더 → /u/ 사업자 진입 시 콜드 seller fetch 동안 빈 스피너 대신 헤더 표시.
  const headerCurator = {
    id: curator?.id ?? seller?.id ?? 0,
    handle: curator?.handle ?? seller?.username ?? String(seller?.id ?? ''),
    name: (curatorEdits.name ?? curator?.name) || seller?.name || '',
    bio: curatorEdits.bio ?? curator?.bio ?? seller?.bio ?? null,
    profile_image: curatorEdits.profile_image ?? curator?.profile_image ?? seller?.profile_image ?? null,
    banner_url: (curatorEdits.banner_url ?? curator?.banner_url) || seller?.banner_url || null,
    headline: curatorEdits.headline ?? curator?.headline ?? null,
    accent: curatorEdits.accent ?? curator?.accent ?? null,
    youtube_url: curatorEdits.youtube_url ?? curator?.youtube_url ?? seller?.sns_youtube ?? null,
    instagram_url: curatorEdits.instagram_url ?? curator?.instagram_url ?? seller?.sns_instagram ?? null,
    tiktok_url: curatorEdits.tiktok_url ?? curator?.tiktok_url ?? null,
  }

  // 🖼️ 2026-07-01 (대표 지시 — "콜드 로딩은 풀로, 2~3가지 로딩화면 절대 금지"): 링크샵(/u/)·셀러(/profile)
  //   모두 단일 URDEAL 브랜드 로더로 통일. 기존엔 curator 진입 시 헤더+스켈레톤을 그렸다가 본문 로드 후
  //   또 바뀌어, CuratorPage 쪽 로더와 합쳐 "2~3가지 로딩화면"이 튀었음. BrandLoader 하나로 준비될 때까지 유지.
  if (loading) return <BrandLoader fullScreen />

  if (!seller) return (
    <div className={`min-h-screen ${T.bg} flex flex-col items-center justify-center`}>
      <p className={T.textMuted}>{t('seller.sellerNotFound')}</p>
      <button onClick={() => navigate('/')} className="mt-3 text-sm text-pink-500">{t('seller.goToHome')}</button>
    </div>
  )

  const liveNow = streams.find(s => s.status === 'live')
  const recentStreams = streams.slice(0, 6)

  const mealVouchers = products.filter(p => p.category === 'meal_voucher')
  // 🛡️ 2026-05-19: '상품' 탭 — 이용권 외 일반 상품 (deal_only 교환권은 셀러가 등록 안 하므로 자동 제외).
  const shopProducts = products.filter(p => p.category !== 'meal_voucher' && Number(p.deal_only) !== 1)

  // 🏁 2026-06-17 (사용자 "라이브 커머스 안 해" 영구 결정): 라이브/쇼츠(동영상) 탭 숨김.
  //   LIVE_COMMERCE_SUSPENDED SSOT 가 라이브·쇼츠를 함께 묶음 → 셀러 공개 링크샵에서도 일관 적용.
  //   default tab='home' 이라 선택 깨짐 없음. 복원: 플래그 false (사용자 허가 필요).
  return (
    <div className={`min-h-screen ${T.bg} pb-28`}>
      {/* 🎨 2026-06-17 링크샵 개선안(시안) 통일: 큐레이터 링크샵과 동일한 네이비 '✎ 편집 모드' 배너. theme-dual: 의도적 네이비 */}
      {ownerView && (
        <div className="sticky top-0 z-30 bg-[#141A2E] text-white px-3.5 py-2.5 text-[12.5px] font-semibold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0"><span className="text-[#6b7280] text-[14px] leading-none shrink-0">✎</span><span className="truncate">{t('seller.publicPage.ownerModeNotice', { defaultValue: '편집 모드 · 사진·이름·소개를 눌러 바로 수정하세요' })}</span></span>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 🏁 2026-06-18 (사용자 결정): 링크샵에서 바로 등록 (대시보드 안 나감).
                🏁 2026-06-26 (대표 — "이용권 등록도 추가"): 단일 '+ 등록' → 상품/이용권 선택 시트. */}
            <button
              type="button"
              onClick={() => setShowAddSheet(true)}
              className="px-2.5 py-1 bg-[#6b7280] hover:bg-[#e84a2b] rounded-lg text-[11px] font-bold whitespace-nowrap"
            >
              {t('seller.publicPage.addEntry', { defaultValue: '+ 등록' })}
            </button>
            <button
              type="button"
              onClick={() => setPreviewAsVisitor(true)}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-[11px] font-bold whitespace-nowrap"
            >
              {t('seller.publicPage.previewVisitor', { defaultValue: '👀 미리보기' })}
            </button>
            {/* 🏁 2026-06-26 (대표 결정 — '전체 설정'→'셀러 대시보드'): 라벨/목적지 정정.
                좁은 사업자정보 탭(?tab=business) 대신 대시보드 홈(/seller — 주문·정산·상품·이용권). */}
            <button
              type="button"
              onClick={() => navigate('/seller')}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-lg text-[11px] font-bold whitespace-nowrap"
            >
              {t('seller.publicPage.sellerDashboard', { defaultValue: '셀러 대시보드' })}
            </button>
          </div>
        </div>
      )}
      {/* 🏁 2026-06-26 (대표 — "상품·이용권 각자 전체 등록 페이지로"): 등록 종류 선택 시트.
          둘 다 정식 등록 풀페이지로 — 상품=/seller/products/new(이미지·상세·옵션), 이용권=/seller/meal-voucher/new(위치·목표인원).
          (얄팍한 빠른등록 모달은 제거 — 상세이미지/옵션 없어 실제 상품에 부족.) */}
      {ownerView && showAddSheet && (
        <div className="fixed inset-0 z-[10600] flex items-end justify-center bg-black/60" onClick={() => setShowAddSheet(false)} role="presentation">
          <div
            className="w-full max-w-[430px] bg-white dark:bg-[#121212] rounded-t-3xl px-5 pt-5 pb-8"
            onClick={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-label={t('seller.publicPage.addSheetTitle', { defaultValue: '무엇을 등록할까요?' })}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('seller.publicPage.addSheetTitle', { defaultValue: '무엇을 등록할까요?' })}</h2>
              <button onClick={() => setShowAddSheet(false)} aria-label={t('common.close', { defaultValue: '닫기' })} className="p-1 rounded-full text-gray-500 dark:text-gray-400 text-lg leading-none">✕</button>
            </div>
            <div className="space-y-2.5">
              <button
                onClick={() => { setShowAddSheet(false); navigate('/seller/products/new') }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#1A1A1A] active:scale-[0.99] transition-transform text-left"
              >
                <span className="w-11 h-11 rounded-xl bg-white dark:bg-[#222] flex items-center justify-center text-xl shrink-0">🛍️</span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-gray-900 dark:text-white">{t('seller.publicPage.addProduct', { defaultValue: '상품 등록' })}</span>
                  <span className="block text-[12px] text-gray-500 dark:text-gray-400">{t('seller.publicPage.addProductDesc', { defaultValue: '이미지·상세설명·옵션까지 정식 등록' })}</span>
                </span>
              </button>
              <button
                onClick={() => { setShowAddSheet(false); navigate('/seller/meal-voucher/new') }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#1A1A1A] active:scale-[0.99] transition-transform text-left"
              >
                <span className="w-11 h-11 rounded-xl bg-white dark:bg-[#222] flex items-center justify-center text-xl shrink-0">🎟️</span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-gray-900 dark:text-white">{t('seller.publicPage.addVoucher', { defaultValue: '이용권 등록' })}</span>
                  <span className="block text-[12px] text-gray-500 dark:text-gray-400">{t('seller.publicPage.addVoucherDesc', { defaultValue: '동네 공구·교환권 — 위치·목표인원 설정' })}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🎨 2026-06-17 (#6 통일): 방문자 미리보기 중 — 큐레이터 링크샵과 동일 패턴. theme-dual: 의도적 네이비 */}
      {isOwner && previewAsVisitor && (
        <div className="sticky top-0 z-40 bg-[#141A2E] text-white px-4 py-2 text-[12.5px] font-bold flex items-center justify-between gap-2">
          <span className="truncate">👀 {t('seller.publicPage.previewBanner', { defaultValue: '방문자 미리보기 — 다른 사람에게 보이는 화면이에요' })}</span>
          <button onClick={() => setPreviewAsVisitor(false)} className="shrink-0 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11.5px] whitespace-nowrap">{t('seller.publicPage.backToEdit', { defaultValue: '편집으로 돌아가기' })}</button>
        </div>
      )}
      <SEO
        title={`${seller.name || seller.username || t('product.seller')}의 링크샵`}
        description={seller.bio || `${seller.name || seller.username || t('product.seller')} 님의 링크샵`}
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

      {/* 🏁 2026-06-25 (대표 "통일"): 사업자 링크샵도 canonical CuratorHeader (마퀴+배너 히어로+중앙 이름).
          정체성은 curator(users) 우선 · seller(sellers) 폴백으로 병합 → 어디 저장됐든 배너/이름 복구.
          소유자 인라인 편집은 CuratorHeader 가 /api/curator/me/profile 로 처리(낙관적 반영=curatorEdits). */}
      <CuratorHeader
        curator={headerCurator}
        pinCount={products.length}
        isOwner={ownerView}
        accountType="business"
        onCopyLink={copyLink}
        onCuratorUpdate={(next) => setCuratorEdits((s) => ({ ...s, ...next }))}
      />

      {/* 🏁 2026-06-26 (대표 "추천템 숨김"): 사업자 링크샵 = 본인 상품 주인공 → 한 스크롤 섹션.
          순서: 내 상품 → 교환권 → 영상/라이브 → 정보. (추천 핀 섹션 제거 — 일반 유저 링크샵은 유지) */}
      <div className="ur-content-wide px-4 lg:px-8 py-5">
        {/* ① 내 상품 — 방문자에게 0개면 섹션 숨김(외부 조건), 소유자 0개는 컴팩트 제목 행 + 인라인 추가 */}
        {(shopProducts.length > 0 || ownerView) && (
          shopProducts.length === 0 ? (
            // 🏁 2026-06-26 (대표 — "빈 상태가 너무 큼"): py-16 빈 블록 → 제목 행 옆 인라인 '+ 상품 등록'.
            //   정식 등록 풀페이지(/seller/products/new — 이미지·상세·옵션)로 이동 → 간결 + 발견성 ↑.
            <div className="mt-7 flex items-center justify-between gap-3">
              <h3 className="text-[16px] font-extrabold text-gray-900 dark:text-white">{t('seller.publicPage.shop', { defaultValue: '내 상품' })} 0</h3>
              <button
                onClick={() => navigate('/seller/products/new')}
                className="shrink-0 inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-[12.5px] font-bold active:scale-95"
              >
                + {t('seller.publicPage.addProduct', { defaultValue: '상품 등록' })}
              </button>
            </div>
          ) : (
            <>
            <h3 className="text-[16px] font-extrabold text-gray-900 dark:text-white mt-7 mb-3">{t('seller.publicPage.shop', { defaultValue: '내 상품' })} {shopProducts.length}</h3>
            {/* 🔍 2026-06-16 링크샵 시안: 상품 검색 (이름 필터) */}
            <div className="flex items-center gap-2 h-11 px-3.5 mb-4 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#121212]">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input value={shopQuery} onChange={(e) => setShopQuery(e.target.value)} placeholder="상품 이름으로 검색" className={`flex-1 min-w-0 bg-transparent outline-none text-[14px] ${T.text} placeholder:text-gray-400`} />
              {shopQuery && <button onClick={() => setShopQuery('')} aria-label="지우기" className="shrink-0 w-5 h-5 rounded-full bg-gray-300 dark:bg-[#3A3A3A] text-white flex items-center justify-center"><X className="w-3 h-3" /></button>}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 lg:gap-x-4 lg:gap-y-8">
              {shopProducts.filter(p => !shopQuery.trim() || p.name.toLowerCase().includes(shopQuery.trim().toLowerCase())).map(p => (
                // 🏁 2026-06-25 (대표 "카드 1종"): 추천핀과 동일한 표준 BrowseProductCard 로 통일.
                <BrowseProductCard
                  key={p.id}
                  product={{ id: p.id, name: p.name, price: p.price, current_price: p.price, original_price: p.original_price ?? undefined, discount_rate: p.discount_rate ?? 0, image_url: p.image_url || '', stock: 0, dominant_color: p.dominant_color, avg_rating: p.avg_rating, review_count: p.review_count, sold_count: p.sold_count } as BrowseProduct}
                  aboveFold={false}
                  to={`/products/${p.id}`}
                  fallbackColor={seededColor(p.id)}
                />
              ))}
            </div>
            </>
          )
        )}

        {/* ③ 교환권 */}
        {mealVouchers.length > 0 && (
          <section className="pt-7">
            <h3 className="text-[16px] font-extrabold text-gray-900 dark:text-white mb-3">{t('seller.publicPage.vouchers', { defaultValue: '이용권' })} {mealVouchers.length}</h3>
            <VouchersTab mealVouchers={mealVouchers} isOwner={ownerView} textClass={T.text} />
          </section>
        )}

        {/* ④ 영상 (있을 때만) */}
        {!LIVE_COMMERCE_SUSPENDED && shorts.length > 0 && (
          <section className="pt-7">
            <h3 className="text-[16px] font-extrabold text-gray-900 dark:text-white mb-3">{t('seller.publicPage.videos', { defaultValue: '영상' })} {shorts.length}</h3>
            <VideosTab shorts={shorts} isOwner={ownerView} textClass={T.text} />
          </section>
        )}

        {/* ⑤ 라이브 (있을 때만) */}
        {!LIVE_COMMERCE_SUSPENDED && streams.length > 0 && (
          <section className="pt-7">
            <h3 className="text-[16px] font-extrabold text-gray-900 dark:text-white mb-3">{t('seller.tabLive', { defaultValue: '라이브' })} {streams.length}</h3>
            <div className="grid grid-cols-2 gap-3">
              {streams.map(s => (
                <StreamCard key={s.id} stream={s} onClick={() => navigate(`/live/${s.id}`)} />
              ))}
            </div>
          </section>
        )}

        {/* ⑥ 정보 */}
        <section className="pt-7">
          <h3 className="text-[16px] font-extrabold text-gray-900 dark:text-white mb-3">{t('seller.tabInfo', { defaultValue: '정보' })}</h3>
          <InfoTab
            seller={seller}
            isOwner={ownerView}
            T={T}
            editingField={editingField}
            setEditingField={setEditingField}
            editKakao={editKakao}
            setEditKakao={setEditKakao}
            saving={saving}
            startEdit={startEdit}
            saveEdit={saveEdit}
          />
        </section>
      </div>

      {/* 🏁 2026-06-17 (#3): 추천 핀 섹션은 홈 탭 상단으로 이동(위) — 맨 아래 매몰 제거. */}

      {/* 🛡️ 2026-05-27: OwnerDashboardFab 제거 — ProfileHeader 의 grid-2 inline 버튼 (프로필 수정 | 대시보드) 으로 통합.
          기존 floating FAB 가 상품 카드 가림 → 인라인으로 변경. */}
    </div>
  )
}
