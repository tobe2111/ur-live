import React, { useState, useEffect } from 'react'
import axios from 'axios'

interface WishlistButtonProps {
  productId: number
  userId?: number | null
  initialWishlisted?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onToggle?: (isWishlisted: boolean) => void
}

/**
 * 위시리스트 하트 버튼 컴포넌트
 * 
 * @param productId - 상품 ID
 * @param userId - 사용자 ID (로그인 필요)
 * @param initialWishlisted - 초기 찜 상태 (서버에서 받은 값)
 * @param size - 버튼 크기 (sm: 16px, md: 20px, lg: 24px)
 * @param className - 추가 CSS 클래스
 * @param onToggle - 찜 상태 변경 콜백
 */
const WishlistButton: React.FC<WishlistButtonProps> = ({
  productId,
  userId,
  initialWishlisted = false,
  size = 'md',
  className = '',
  onToggle
}) => {
  const [isWishlisted, setIsWishlisted] = useState(initialWishlisted)
  const [isLoading, setIsLoading] = useState(false)
  const [wishlistId, setWishlistId] = useState<number | null>(null)

  // 사이즈별 아이콘 크기
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  // 컴포넌트 마운트 시 찜 상태 확인
  useEffect(() => {
    if (userId && productId) {
      checkWishlistStatus()
    }
  }, [userId, productId])

  // 찜 상태 확인
  const checkWishlistStatus = async () => {
    try {
      const response = await axios.get(`/api/wishlists/check/${userId}/${productId}`)
      if (response.data.success) {
        setIsWishlisted(response.data.data.isWishlisted)
        setWishlistId(response.data.data.wishlistId)
      }
    } catch (error) {
      console.error('[WishlistButton] Check status error:', error)
    }
  }

  // 찜하기 토글
  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // 로그인 확인
    if (!userId) {
      alert('로그인이 필요합니다.')
      // 로그인 페이지로 이동 (현재 페이지 저장)
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      window.location.href = '/login'
      return
    }

    if (isLoading) return

    setIsLoading(true)

    try {
      if (isWishlisted) {
        // 찜 취소
        await axios.delete(`/api/wishlists/product/${productId}?userId=${userId}`)
        setIsWishlisted(false)
        setWishlistId(null)
        
        // 토스트 알림 (선택)
        showToast('찜 목록에서 삭제되었습니다.')
      } else {
        // 찜하기
        const response = await axios.post('/api/wishlists', {
          userId,
          productId
        })
        
        if (response.data.success) {
          setIsWishlisted(true)
          setWishlistId(response.data.data.id)
          
          // 토스트 알림 (선택)
          showToast('찜 목록에 추가되었습니다.')
        }
      }

      // 콜백 호출
      if (onToggle) {
        onToggle(!isWishlisted)
      }
    } catch (error: any) {
      console.error('[WishlistButton] Toggle error:', error)
      
      // 에러 메시지 표시
      if (error.response?.data?.error) {
        alert(error.response.data.error)
      } else {
        alert('오류가 발생했습니다. 다시 시도해주세요.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // 간단한 토스트 알림 (선택)
  const showToast = (message: string) => {
    // 기존 토스트 제거
    const existingToast = document.getElementById('wishlist-toast')
    if (existingToast) {
      existingToast.remove()
    }

    // 토스트 생성
    const toast = document.createElement('div')
    toast.id = 'wishlist-toast'
    toast.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300'
    toast.textContent = message
    document.body.appendChild(toast)

    // 2초 후 제거
    setTimeout(() => {
      toast.style.opacity = '0'
      setTimeout(() => toast.remove(), 300)
    }, 2000)
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`
        relative flex items-center justify-center
        transition-all duration-200
        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 active:scale-95'}
        ${className}
      `}
      aria-label={isWishlisted ? '찜 취소' : '찜하기'}
    >
      {isWishlisted ? (
        // 찜된 상태 (빨간 하트)
        <svg
          className={`${sizeMap[size]} text-red-500 drop-shadow-sm`}
          fill="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ) : (
        // 찜 안 된 상태 (빈 하트)
        <svg
          className={`${sizeMap[size]} text-gray-400 hover:text-red-500 transition-colors`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          />
        </svg>
      )}

      {/* 로딩 스피너 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 rounded-full">
          <svg
            className={`animate-spin ${sizeMap[size]} text-red-500`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      )}
    </button>
  )
}

export default WishlistButton
