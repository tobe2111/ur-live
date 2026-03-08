import React from 'react'
import { ShoppingBag } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const EmptyCart = React.memo(function EmptyCart() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <ShoppingBag size={48} className="text-gray-400" />
      </div>
      
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        장바구니가 비어있습니다
      </h2>
      
      <p className="text-gray-600 text-center mb-6">
        마음에 드는 상품을 담아보세요
      </p>
      
      <button
        onClick={() => navigate('/')}
        className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        쇼핑 계속하기
      </button>
    </div>
  )
})
