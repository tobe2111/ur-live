import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { getUserId, isLoggedIn } from '@/utils/auth'

// Import KREAM-style components
import { MobileHeader } from '@/components/product/mobile-header'
import { ProductImageCarousel } from '@/components/product/product-image-carousel'
import { ProductHeader } from '@/components/product/product-header'
import { FloatingActionBar } from '@/components/product/floating-action-bar'
import { Separator } from '@/components/ui/separator'

interface Product {
  id: number
  name: string
  description: string
  price: number
  current_price?: number
  original_price?: number
  discount_rate: number
  image_url: string
  seller_name: string
  seller_id?: number
  stock: number
  sold_count?: number
  category?: string
  detail_images?: string | string[]
  kakao_chat_link?: string
}

interface ProductOption {
  id: number
  product_id: number
  option_type: string
  option_value: string
  price_adjustment: number
  stock: number
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [options, setOptions] = useState<ProductOption[]>([])
  const [selectedOptions, setSelectedOptions] = useState<{ [key: string]: number }>({})
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadProduct()
    
    const referrer = document.referrer
    if (referrer && !referrer.includes('/login') && !referrer.includes('/auth/kakao')) {
      try {
        const referrerPath = new URL(referrer).pathname
        sessionStorage.setItem('productDetailReferrer', referrerPath)
      } catch (e) {
        console.error('Failed to parse referrer URL:', e)
      }
    }
  }, [id])

  async function loadProduct() {
    try {
      setLoading(true)
      const response = await api.get(`/api/products/${id}`)
      if (response.data.success && response.data.data) {
        setProduct(response.data.data.product)
        setOptions(response.data.data.options || [])
      } else {
        setError('상품을 불러올 수 없습니다.')
      }
    } catch (err) {
      console.error('Failed to load product:', err)
      setError('상품을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleAddToCart() {
    if (!isLoggedIn()) {
      showToast('로그인이 필요합니다.', 'error')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      setTimeout(() => navigate('/login'), 1000)
      return
    }

    try {
      await api.post('/api/cart', {
        product_id: product!.id,
        quantity,
        option_id: Object.values(selectedOptions)[0] || null
      })
      showToast('장바구니에 추가되었습니다.', 'success')
      localStorage.setItem('hasCartItems', 'true')
    } catch (err: any) {
      console.error('Failed to add to cart:', err)
      showToast(err.response?.data?.error || '장바구니 추가에 실패했습니다.', 'error')
    }
  }

  async function handleBuyNow() {
    if (!isLoggedIn()) {
      showToast('로그인이 필요합니다.', 'error')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      setTimeout(() => navigate('/login'), 1000)
      return
    }

    navigate('/checkout', {
      state: {
        product: product!,
        quantity,
        selectedOptions,
        fromCart: false
      }
    })
  }

  function handleShare() {
    if (!product) return

    const shareText = `${product.name} - ${displayPrice.toLocaleString()}원`
    const shareUrl = window.location.href

    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: shareText,
        url: shareUrl
      }).catch(err => {
        console.log('Share cancelled', err)
      })
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('링크가 복사되었습니다.', 'success')
      })
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-foreground border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{error || '상품을 찾을 수 없습니다.'}</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-foreground text-background rounded-lg text-sm font-semibold"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  const displayPrice = product.current_price || product.price

  // Parse detail images
  let detailImages: string[] = []
  if (product.detail_images) {
    try {
      detailImages = typeof product.detail_images === 'string' 
        ? JSON.parse(product.detail_images)
        : product.detail_images
    } catch (e) {
      console.error('Failed to parse detail images:', e)
      detailImages = []
    }
  }

  // All product images for carousel (main image + detail images)
  const allImages = [product.image_url, ...detailImages].filter(Boolean)

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background">
      {/* Mobile Header */}
      <MobileHeader onShare={handleShare} />

      <main className="pb-20">
        {/* Product Images Carousel */}
        <ProductImageCarousel images={allImages} />

        <Separator />

        {/* Product Info */}
        <ProductHeader name={product.name} price={displayPrice} />

        {/* Product Description */}
        {product.description && (
          <>
            <Separator />
            <div className="px-5 py-6">
              <h2 className="text-sm font-bold text-foreground">상품 설명</h2>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {product.description}
              </p>
            </div>
          </>
        )}

        {/* Product Details - Vertical Images */}
        {detailImages.length > 0 && (
          <>
            <Separator />
            <div className="px-5 py-6">
              <h2 className="text-sm font-bold text-foreground">상세 이미지</h2>
              <div className="mt-4 flex flex-col gap-1">
                {detailImages.map((src, idx) => (
                  <div key={idx} className="relative w-full">
                    <img
                      src={src}
                      alt={`Product detail ${idx + 1}`}
                      className="h-auto w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Product Info Section */}
        <Separator />
        <div className="px-5 py-6">
          <h2 className="text-sm font-bold text-foreground">상품 정보</h2>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">판매자</span>
              <span className="text-xs font-medium text-foreground">{product.seller_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">재고</span>
              <span className="text-xs font-medium text-foreground">{product.stock}개</span>
            </div>
            {product.sold_count !== undefined && product.sold_count > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">판매량</span>
                <span className="text-xs font-medium text-foreground">{product.sold_count}개</span>
              </div>
            )}
            {product.category && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">카테고리</span>
                <span className="text-xs font-medium text-foreground">{product.category}</span>
              </div>
            )}
          </div>
        </div>

        {/* 안내 정보 */}
        <Separator />
        <div className="px-5 py-6">
          <h2 className="text-sm font-bold text-foreground">안내 정보</h2>
          <div className="mt-3 space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">
                  검수 포함
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  모든 상품은 철저한 검수 과정을 거칩니다
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">
                  배송 기간 5-7 영업일
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  판매자 발송 및 검수 완료 후 배송됩니다
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">
                  교환/반품 안내
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  상품 수령 후 7일 이내 교환/반품 가능합니다
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 교환 및 반품 안내 (상세) */}
        <Separator />
        <div className="px-5 py-6 bg-muted/30">
          <h2 className="text-sm font-bold text-foreground mb-4">교환 및 반품 안내</h2>
          
          {/* 신청 방법 */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-foreground mb-2">신청 방법</h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              상품을 수령하신 날로부터 7일 이내 메신저 및 홈페이지 Q&A게시판 접수
            </p>
          </div>

          {/* 배송 비용 */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-foreground mb-2">배송 비용</h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              단순 변심은 왕복 택배비 6,000원
            </p>
          </div>

          {/* 반품 주소 */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-foreground mb-2">반품 주소</h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              서울특별시 강남구 테헤란로 131, 15층 (역삼동, 한국지식재산센터)
            </p>
          </div>

          {/* 유의 사항 */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-foreground mb-3">유의 사항</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-muted-foreground">•</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
                  단순 변심의 경우 수령일로부터 7일 이내까지 교환·반품이 가능합니다. (교환/반품비 고객 부담)
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-muted-foreground">•</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
                  상품 하자 또는 오배송의 경우 수령일로부터 7일 이내 교환·반품이 가능합니다. (교환/반품비 무료)
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-muted-foreground">•</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
                  제품 특성상 단순 변심, 부주의에 의한 제품 손상 및 파손, 사용 및 개봉한 경우 교환/반품이 불가합니다.
                </p>
              </div>
            </div>
          </div>

          {/* 제22조 (환불) */}
          <div className="mb-5 pt-4 border-t border-border/50">
            <h3 className="text-xs font-semibold text-foreground mb-3">제22조 (환불)</h3>
            <div className="space-y-3">
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                <p className="font-medium mb-1">1. 회원은 회사에 환불을 요구할 수 있습니다. 환불은 회사가 안내하는 정책 및 방법에 따라 진행됩니다.</p>
              </div>
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                <p className="font-medium mb-1">2. 회사는 다음 각 호의 방식으로 환불을 진행합니다.</p>
                <div className="ml-3 mt-2 space-y-1.5">
                  <p>가. 경기 결제 회원 : 환불은 서비스를 이용한 일수를 계산하고 일할 계산으로 진행됩니다. 결기간은 300일로 이용료를 일할로 나눈 금액을 환불합니다. 결제 금액의 10%를 제외한 일수만큼 금액을 제외하고 계산되니 이용자는 남은 금액만 환불받습니다. 다만 결제 이후30일 이내에 남은 기수대로 일할 계산이 이루어지며 남은 금액이 계산은 카드 수수료와 할인금액을 포함한 결제 금액의 20% 금액을 제외한 금액에, 남은 일 수에 대한 일할 계산을 포함한 결제 금액의 20% 금액을 제외한 금액에, 남은 일 수에 대한 일할 계산을 포함한 결제 금액의 20%를 제외한 금액에, 날은 일 수에 대한 일할 계산을 포함한 결제 금액의 20% 금액을 제외한 금액에, 남은 일 수에 대한 일할 계산을 처리하니다. 16일 이후 30일 이내 사용자는 환불이 불가능합니다. 일할 계산은 카드 수수료와 할인금액을 포함한 금액입니다.</p>
                  <p className="mt-2">제시 : [(전체금액) * 0.8/30] * 남은 일수</p>
                  <p className="mt-2">나. 연간 결제 회원 : 연 기간은 12개월이고 전년 이용료는 전액 연간결제 이용료를 12로 나누고 하루라도 이용했으면 제외합니다.</p>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                <p className="font-medium">3. 본 조의 환불 금액 기준은 연간 결제 회원이라 하더라도 정기결제 금액으로 계산 후 진행됩니다. 따라서 환불 시점에 따라 환불금액이 존재하지 않는 경우도 있을 수 있습니다.</p>
              </div>
            </div>
          </div>
        </div>

        {/* 배송안내 */}
        <Separator />
        <div className="px-5 py-6">
          <h2 className="text-sm font-bold text-foreground mb-4">배송안내</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-foreground mb-2">배송 업체</h3>
              <p className="text-[11px] text-muted-foreground">OO배송물류 (1544-7772)</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-foreground mb-2">배송 지역</h3>
              <p className="text-[11px] text-muted-foreground">대한민국 전 지역</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-foreground mb-2">배송 비용</h3>
              <p className="text-[11px] text-muted-foreground">3,000원 / 구매 금액 50,000원 이상 시 무료 배송/도서산간 지역 별도 추가 금액 발생</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-foreground mb-2">배송 기간</h3>
              <p className="text-[11px] text-muted-foreground">주말·공휴일 제외 2-5일</p>
            </div>

            <div className="pt-3 border-t border-border/50">
              <h3 className="text-xs font-semibold text-foreground mb-2">유의 사항</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-[11px] text-muted-foreground">•</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
                    주문 폭주 및 공휴 사정으로 인하여 지연 및 품절이 발생될 수 있습니다.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[11px] text-muted-foreground">•</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
                    기본 배송기간 이상 소요되는 상품이거나, 품절 상품은 개별 연락을 드립니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Cart / Purchase Bar */}
      <FloatingActionBar 
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        disabled={product.stock === 0}
      />

      {/* Toast Notification */}
      {toast && (
        <div 
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-lg shadow-lg max-w-sm transition-all ${
            toast.type === 'success' 
              ? 'bg-foreground text-background' 
              : 'bg-destructive text-white'
          }`}
        >
          <p className="text-sm font-medium text-center">{toast.message}</p>
        </div>
      )}
    </div>
  )
}
