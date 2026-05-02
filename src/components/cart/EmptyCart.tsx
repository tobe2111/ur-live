import React from 'react'
import { ShoppingBag } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const EmptyCart = React.memo(function EmptyCart() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 bg-white dark:bg-[#0A0A0A]">
      <div className="w-20 h-20 bg-gray-50 dark:bg-[#121212] rounded-full flex items-center justify-center mb-5">
        <ShoppingBag size={36} className="text-gray-300" />
      </div>

      <h2 className="text-[16px] font-bold text-gray-900 dark:text-white mb-1.5">
        장바구니가 비어있습니다
      </h2>

      <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center mb-6">
        마음에 드는 상품을 담아보세요
      </p>

      <button
        onClick={() => navigate('/')}
        className="px-8 py-3 bg-gray-900 text-white text-[14px] font-bold rounded-xl hover:bg-gray-800 transition-colors active:scale-[0.98]"
      >
        쇼핑 계속하기
      </button>
    </div>
  )
})
