import { useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp, Search, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface FAQ {
  id: number
  category: string
  question: string
  answer: string
}

const faqs: FAQ[] = [
  {
    id: 1,
    category: '주문/결제',
    question: '주문을 취소하고 싶어요',
    answer: '배송 전이라면 마이페이지 > 주문내역에서 직접 취소하실 수 있습니다. 배송이 시작된 경우 판매자와 협의가 필요합니다.'
  },
  {
    id: 2,
    category: '주문/결제',
    question: '결제가 완료되지 않았어요',
    answer: '결제 오류 시 카드사 또는 결제사로 문의해주세요. 토스페이먼츠 고객센터: 1544-7772'
  },
  {
    id: 3,
    category: '배송',
    question: '배송 기간은 얼마나 걸리나요?',
    answer: '일반적으로 결제 완료 후 2-3일 이내 배송됩니다. 판매자별로 차이가 있을 수 있으며, 상품 페이지에서 확인 가능합니다.'
  },
  {
    id: 4,
    category: '배송',
    question: '배송 조회는 어떻게 하나요?',
    answer: '마이페이지 > 주문내역에서 송장번호를 확인하시고 "배송 조회" 버튼을 클릭하시면 택배사 사이트로 이동합니다.'
  },
  {
    id: 5,
    category: '교환/환불',
    question: '교환/반품은 어떻게 하나요?',
    answer: '상품 수령 후 7일 이내 마이페이지 > 주문내역에서 신청하실 수 있습니다. 단순 변심의 경우 왕복 배송비가 발생합니다.'
  },
  {
    id: 6,
    category: '교환/환불',
    question: '환불은 언제 되나요?',
    answer: '상품 회수 확인 후 3-7 영업일 이내 결제 수단으로 환불됩니다. 신용카드는 카드사 정산일에 따라 다를 수 있습니다.'
  },
  {
    id: 7,
    category: '회원',
    question: '회원가입은 어떻게 하나요?',
    answer: '카카오 로그인으로 간편하게 가입하실 수 있습니다. 별도의 회원가입 절차 없이 카카오 계정으로 이용 가능합니다.'
  },
  {
    id: 8,
    category: '회원',
    question: '개인정보를 수정하고 싶어요',
    answer: '마이페이지에서 배송지, 연락처 등을 수정하실 수 있습니다. 카카오 계정 정보는 카카오에서 직접 수정해주세요.'
  },
  {
    id: 9,
    category: '라이브',
    question: '라이브 방송은 어떻게 시청하나요?',
    answer: '메인 페이지에서 진행 중인 라이브 방송을 확인하고 클릭하시면 바로 시청하실 수 있습니다.'
  },
  {
    id: 10,
    category: '라이브',
    question: '라이브 중 상품을 구매하려면?',
    answer: '라이브 화면 하단에 표시되는 상품 카드를 클릭하여 장바구니에 담거나 바로 구매하실 수 있습니다.'
  }
]

export default function FAQPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const categories = ['전체', ...Array.from(new Set(faqs.map(f => f.category)))]

  const filteredFAQs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === '전체' || faq.category === selectedCategory
    const matchesSearch = searchQuery === '' || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate(-1)}>
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold">자주 묻는 질문</h1>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="궁금한 내용을 검색해보세요"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* FAQ List */}
        <div className="space-y-3">
          {filteredFAQs.map(faq => (
            <div key={faq.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                className="w-full px-6 py-4 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {faq.category}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900">{faq.question}</p>
                </div>
                {expandedId === faq.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>
              
              {expandedId === faq.id && (
                <div className="px-6 pb-4 pt-2 border-t bg-gray-50">
                  <p className="text-sm text-gray-700 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredFAQs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">검색 결과가 없습니다.</p>
          </div>
        )}

        {/* Contact Support */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-3">
            <MessageCircle className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-bold">도움이 더 필요하신가요?</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            궁금한 사항이 해결되지 않았다면 고객센터로 문의해주세요.
          </p>
          <div className="space-y-2 text-sm">
            <p className="text-gray-700">
              <strong>고객센터:</strong> 0507-0177-0432
            </p>
            <p className="text-gray-700">
              <strong>운영시간:</strong> 평일 09:00 - 18:00
            </p>
            <p className="text-gray-700">
              <strong>이메일:</strong> support@ur-team.com
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
