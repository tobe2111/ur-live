import { ArrowLeft, Package, Truck, RefreshCw, CreditCard, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'

export default function RefundPolicyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white">
      <SEO title="환불정책 - 유어딜" description="유어딜 환불 및 반품 정책을 안내합니다." url="/refund-policy" />
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-extrabold text-gray-900">환불 및 교환/반품 정책</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-8">
        <div className="space-y-8">
          
          {/* 회사 정보 */}
          <section className="bg-blue-50 border border-blue-200 rounded-lg p-5">
            <h2 className="text-lg font-bold mb-3 text-blue-900">운영 회사 정보</h2>
            <div className="space-y-2 text-sm text-gray-700">
              <p><strong>상호명:</strong> 리스터코퍼레이션 (LISTER Corporation)</p>
              <p><strong>대표:</strong> 정지원</p>
              <p><strong>고객센터:</strong> 0507-0177-0432</p>
              <p><strong>이메일:</strong> jiwon@ur-team.com</p>
              <p><strong>운영시간:</strong> 평일 09:00 - 18:00 (주말 및 공휴일 휴무)</p>
            </div>
          </section>

          {/* 교환 및 반품 안내 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold">교환 및 반품 안내</h2>
            </div>

            {/* 신청 방법 */}
            <div className="mb-6">
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                신청 방법
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 leading-relaxed">
                  상품을 수령하신 날로부터 <strong className="text-blue-600">7일 이내</strong> 메신저 및 홈페이지 Q&A게시판 접수
                </p>
              </div>
            </div>

            {/* 배송 비용 */}
            <div className="mb-6">
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                배송 비용
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 leading-relaxed">
                  단순 변심은 왕복 택배비 <strong className="text-red-600">6,000원</strong>
                </p>
              </div>
            </div>

            {/* 반품 주소 */}
            <div className="mb-6">
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                반품 주소
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 leading-relaxed">
                  부산광역시 금정구 놀이마당로26 1402호
                </p>
              </div>
            </div>

            {/* 유의 사항 */}
            <div className="mb-6">
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                유의 사항
              </h3>
              <div className="space-y-3">
                <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded-r-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-green-700 mt-1">✓</span>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      <strong>단순 변심</strong>의 경우 수령일로부터 7일 이내까지 교환·반품이 가능합니다. 
                      <span className="text-red-600"> (교환/반품비 고객 부담)</span>
                    </p>
                  </div>
                </div>

                <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded-r-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-green-700 mt-1">✓</span>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      <strong>상품 하자</strong> 또는 <strong>오배송</strong>의 경우 수령일로부터 7일 이내 교환·반품이 가능합니다. 
                      <span className="text-green-600"> (교환/반품비 무료)</span>
                    </p>
                  </div>
                </div>

                <div className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-red-700 mt-1">✗</span>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      <strong>제품 특성상</strong> 단순 변심, 부주의에 의한 제품 손상 및 파손, 사용 및 개봉한 경우 교환/반품이 
                      <span className="text-red-600 font-bold"> 불가</span>합니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 제22조 환불 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold">제22조 (환불)</h2>
            </div>

            <div className="space-y-5">
              {/* 1항 */}
              <div className="border-l-4 border-blue-500 pl-4">
                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                  <strong>1.</strong> 회원은 회사에 환불을 요구할 수 있습니다. 환불은 회사가 안내하는 정책 및 방법에 따라 진행됩니다.
                </p>
              </div>

              {/* 2항 - 환불 방식 */}
              <div className="border-l-4 border-blue-500 pl-4">
                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                  <strong>2.</strong> 회사는 다음 각 호의 방식으로 환불을 진행합니다.
                </p>

                {/* 가. 경기 결제 회원 */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-bold text-amber-900 mb-2">가. 경기 결제 회원</h4>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="leading-relaxed">
                      환불은 서비스를 이용한 일수를 계산하고 <strong>일할 계산</strong>으로 진행됩니다. 
                      결기간은 <strong>300일</strong>로 이용료를 일할로 나눈 금액을 환불합니다.
                    </p>
                    <p className="leading-relaxed">
                      결제 금액의 <strong className="text-red-600">10%를 제외</strong>한 일수만큼 금액을 제외하고 계산되니 
                      이용자는 남은 금액만 환불받습니다.
                    </p>
                    <p className="leading-relaxed">
                      다만 결제 이후 <strong>30일 이내</strong>에 남은 기수대로 일할 계산이 이루어지며 남은 금액이 계산은 
                      카드 수수료와 할인금액을 포함한 결제 금액의 <strong className="text-red-600">20% 금액을 제외</strong>한 금액에, 
                      남은 일 수에 대한 일할 계산을 처리합니다.
                    </p>
                    <p className="leading-relaxed text-red-600 font-medium">
                      <AlertCircle className="inline w-4 h-4 mr-1" />
                      16일 이후 30일 이내 사용자는 환불이 <strong>불가능</strong>합니다.
                    </p>
                    <div className="bg-white border border-amber-300 rounded p-3 mt-3">
                      <p className="text-xs font-mono text-gray-800">
                        <strong>계산 공식:</strong> [(전체금액) × 0.8 ÷ 30] × 남은 일수
                      </p>
                    </div>
                  </div>
                </div>

                {/* 나. 연간 결제 회원 */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-bold text-purple-900 mb-2">나. 연간 결제 회원</h4>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="leading-relaxed">
                      연 기간은 <strong>12개월</strong>이고 전년 이용료는 전액 연간결제 이용료를 <strong>12로 나누고</strong> 
                      하루라도 이용했으면 전액 연간결제 이용료를 12로 나누고 하루라도 이용했으면 제외합니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3항 */}
              <div className="border-l-4 border-blue-500 pl-4">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <strong>3.</strong> 본 조의 환불 금액 기준은 연간 결제 회원이라 하더라도 <strong>정기결제 금액으로 계산</strong> 후 
                  진행됩니다. 따라서 환불 시점에 따라 환불금액이 존재하지 않는 경우도 있을 수 있습니다.
                </p>
              </div>
            </div>
          </section>

          {/* 배송 안내 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Truck className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold">배송 안내</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* 배송 업체 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-bold mb-2 text-gray-800">배송 업체</h3>
                <p className="text-sm text-gray-700">대한통운 (1588-1255)</p>
                <p className="text-xs text-gray-500 mt-1">* 판매 환경에 따라 변경될 수 있음</p>
              </div>

              {/* 배송 지역 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-bold mb-2 text-gray-800">배송 지역</h3>
                <p className="text-sm text-gray-700">대한민국 전 지역</p>
              </div>

              {/* 배송 비용 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-bold mb-2 text-gray-800">배송 비용</h3>
                <p className="text-sm text-gray-700">
                  3,000원 / 구매 금액 <strong className="text-blue-600">50,000원 이상 시 무료 배송</strong>
                  <br />
                  <span className="text-xs text-gray-500">* 도서산간 지역 별도 추가 금액 발생</span>
                </p>
              </div>

              {/* 배송 기간 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-bold mb-2 text-gray-800">배송 기간</h3>
                <p className="text-sm text-gray-700">주말·공휴일 제외 2-5일</p>
              </div>
            </div>

            {/* 배송 유의사항 */}
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-bold mb-2 text-yellow-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                유의 사항
              </h3>
              <ul className="space-y-1.5 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="mt-1">•</span>
                  <span>주문 폭주 및 공휴 사정으로 인하여 지연 및 품절이 발생될 수 있습니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1">•</span>
                  <span>기본 배송기간 이상 소요되는 상품이거나, 품절 상품은 개별 연락을 드립니다.</span>
                </li>
              </ul>
            </div>
          </section>
          {/* 환불 처리 절차 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold">환불 처리 절차</h2>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center text-base font-bold">1</div>
                <div className="flex-1 bg-blue-50 rounded-lg p-3">
                  <h3 className="font-bold text-sm mb-1">취소/반품 신청</h3>
                  <p className="text-sm text-gray-600">마이페이지에서 신청 또는 고객센터 문의</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center text-base font-bold">2</div>
                <div className="flex-1 bg-blue-50 rounded-lg p-3">
                  <h3 className="font-bold text-sm mb-1">판매자 확인</h3>
                  <p className="text-sm text-gray-600">판매자가 신청 내용 확인 (1-2 영업일)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center text-base font-bold">3</div>
                <div className="flex-1 bg-blue-50 rounded-lg p-3">
                  <h3 className="font-bold text-sm mb-1">상품 반송 (반품 시)</h3>
                  <p className="text-sm text-gray-600">지정된 주소로 상품 반송</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center text-base font-bold">4</div>
                <div className="flex-1 bg-blue-50 rounded-lg p-3">
                  <h3 className="font-bold text-sm mb-1">환불 처리</h3>
                  <p className="text-sm text-gray-600">상품 회수 확인 후 환불 (3-7 영업일)</p>
                </div>
              </div>
            </div>
          </section>

          {/* 배송비 부담 테이블 */}
          <section>
            <h2 className="text-lg font-bold mb-4">배송비 부담 안내</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border-b border-gray-200 px-4 py-3 text-left font-bold">사유</th>
                    <th className="border-b border-gray-200 px-4 py-3 text-left font-bold">배송비 부담</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50">
                    <td className="border-b border-gray-200 px-4 py-3">단순 변심</td>
                    <td className="border-b border-gray-200 px-4 py-3">
                      <span className="text-red-600 font-medium">구매자 부담</span> (왕복 배송비 6,000원)
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="border-b border-gray-200 px-4 py-3">상품 하자</td>
                    <td className="border-b border-gray-200 px-4 py-3">
                      <span className="text-green-600 font-medium">판매자 부담</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="border-b border-gray-200 px-4 py-3">오배송</td>
                    <td className="border-b border-gray-200 px-4 py-3">
                      <span className="text-green-600 font-medium">판매자 부담</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3">상품 불일치</td>
                    <td className="px-4 py-3">
                      <span className="text-green-600 font-medium">판매자 부담</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 환불 방법 */}
          <section>
            <h2 className="text-lg font-bold mb-4">환불 방법 및 소요기간</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-sm mb-2 text-blue-900">💳 신용카드</h3>
                <p className="text-sm text-gray-700">카드사 승인 취소 (3-7 영업일)</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                <h3 className="font-bold text-sm mb-2 text-green-900">🏦 계좌이체</h3>
                <p className="text-sm text-gray-700">구매자 계좌로 직접 입금 (영업일 기준 3일)</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
                <h3 className="font-bold text-sm mb-2 text-purple-900">🔢 가상계좌</h3>
                <p className="text-sm text-gray-700">구매자 계좌로 직접 입금 (영업일 기준 3일)</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
                <h3 className="font-bold text-sm mb-2 text-orange-900">📱 간편결제</h3>
                <p className="text-sm text-gray-700">결제 수단에 따라 3-7 영업일</p>
              </div>
            </div>
          </section>

          {/* 고객센터 문의 */}
          <section className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4 text-indigo-900">고객센터 문의</h2>
            <div className="space-y-3 text-sm text-gray-700">
              <p className="flex items-center gap-2">
                <span className="font-semibold text-indigo-700">📞 고객센터:</span> 
                <span className="font-bold text-lg">0507-0177-0432</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="font-semibold text-indigo-700">⏰ 운영시간:</span> 
                평일 09:00 - 18:00 (주말 및 공휴일 휴무)
              </p>
              <p className="flex items-center gap-2">
                <span className="font-semibold text-indigo-700">📧 이메일:</span> 
                jiwon@ur-team.com
              </p>
            </div>
          </section>

          {/* Footer */}
          <div className="pt-6 border-t-2 border-gray-200 text-center space-y-2">
            <p className="text-sm text-gray-600">
              <strong>상호명:</strong> 리스터코퍼레이션 (LISTER Corporation)
            </p>
            <p className="text-sm text-gray-600">
              <strong>대표:</strong> 정지원
            </p>
            <p className="text-xs text-gray-500 mt-3">
              시행일자: 2026년 2월 20일
            </p>
            <p className="text-xs text-gray-400">
              본 정책은 전자상거래 등에서의 소비자보호에 관한 법률을 준수합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
