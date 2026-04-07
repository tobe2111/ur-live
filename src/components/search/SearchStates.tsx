import { useNavigate } from 'react-router-dom'
import { Search, Package, AlertCircle, Loader2 } from 'lucide-react'

interface SearchStatesProps {
  loading: boolean
  error: string
  query: string
  hasResults: boolean
}

export default function SearchStates({ loading, error, query, hasResults }: SearchStatesProps) {
  const navigate = useNavigate()

  // Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-[#007aff] animate-spin mb-4" />
        <p className="text-[15px] text-[#6e6e73]">검색 중...</p>
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-[#ff3b30]/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10 text-[#ff3b30]" />
        </div>
        <p className="text-[17px] font-semibold text-[#1d1d1f] mb-2">오류가 발생했습니다</p>
        <p className="text-[15px] text-[#6e6e73] mb-6">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg"
          >
            다시 시도
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-[#007aff] text-white rounded-full text-[15px] font-semibold hover:bg-[#0051d5] transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  // No Query State
  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Search className="w-16 h-16 text-[#6e6e73] mb-4" />
        <p className="text-[17px] font-semibold text-[#1d1d1f] mb-2">검색어를 입력해주세요</p>
        <p className="text-[15px] text-[#6e6e73]">상품명 또는 판매자명으로 검색할 수 있습니다</p>
      </div>
    )
  }

  // No Results State
  if (query && !hasResults) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Package className="w-16 h-16 text-[#6e6e73] mb-4" />
        <p className="text-[17px] font-semibold text-[#1d1d1f] mb-2">검색 결과가 없습니다</p>
        <p className="text-[15px] text-[#6e6e73] mb-6">다른 검색어를 시도해보세요</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 bg-[#007aff] text-white rounded-full text-[15px] font-semibold hover:bg-[#0051d5] transition-colors"
        >
          홈으로 돌아가기
        </button>
      </div>
    )
  }

  return null
}
