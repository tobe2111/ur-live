import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function RefundPolicyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">환불 정책</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          <section>
            <h2 className="text-lg font-bold mb-3">1. 취소 및 환불 기본 원칙</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              UR Live는 전자상거래법에 따라 소비자 보호를 최우선으로 하며,
              공정하고 투명한 취소 및 환불 절차를 운영합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">2. 주문 취소</h2>
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-bold text-sm mb-2">배송 전 취소</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• 상품 준비 중: 언제든지 무료 취소 가능</li>
                  <li>• 취소 방법: 마이페이지 {'>'} 주문내역 {'>'} 주문 취소</li>
                  <li>• 환불 소요기간: 결제 수단에 따라 3-7 영업일</li>
                </ul>
              </div>

              <div className="border-l-4 border-orange-500 pl-4">
                <h3 className="font-bold text-sm mb-2">배송 시작 후 취소</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• 판매자와 협의 필요</li>
                  <li>• 반송 배송비 고객 부담</li>
                  <li>• 상품 회수 후 환불 진행</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">3. 교환 및 반품</h2>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h3 className="font-bold text-sm text-green-800 mb-2">✓ 교환/반품 가능한 경우</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 상품 수령일로부터 7일 이내 (단순 변심)</li>
                <li>• 상품이 표시·광고 내용과 다르거나 계약 내용과 다른 경우</li>
                <li>• 상품에 하자가 있는 경우</li>
                <li>• 배송된 상품이 주문 내역과 다른 경우</li>
              </ul>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-bold text-sm text-red-800 mb-2">✗ 교환/반품 불가능한 경우</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 소비자의 책임 있는 사유로 상품이 멸실·훼손된 경우</li>
                <li>• 소비자의 사용 또는 일부 소비로 상품 가치가 현저히 감소한 경우</li>
                <li>• 시간 경과로 재판매가 곤란할 정도로 상품 가치가 감소한 경우</li>
                <li>• 복제 가능한 상품의 포장을 훼손한 경우</li>
                <li>• 주문 제작 상품 (맞춤 제작 상품)</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">4. 환불 처리 절차</h2>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                <div>
                  <h3 className="font-bold text-sm">취소/반품 신청</h3>
                  <p className="text-sm text-gray-600">마이페이지에서 신청 또는 고객센터 문의</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <h3 className="font-bold text-sm">판매자 확인</h3>
                  <p className="text-sm text-gray-600">판매자가 신청 내용 확인 (1-2 영업일)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <h3 className="font-bold text-sm">상품 반송 (반품 시)</h3>
                  <p className="text-sm text-gray-600">지정된 주소로 상품 반송</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                <div>
                  <h3 className="font-bold text-sm">환불 처리</h3>
                  <p className="text-sm text-gray-600">상품 회수 확인 후 환불 (3-7 영업일)</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">5. 배송비 부담</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border px-4 py-2">사유</th>
                    <th className="border px-4 py-2">배송비 부담</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border px-4 py-2">단순 변심</td>
                    <td className="border px-4 py-2">구매자 부담 (왕복 배송비)</td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-2">상품 하자</td>
                    <td className="border px-4 py-2">판매자 부담</td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-2">오배송</td>
                    <td className="border px-4 py-2">판매자 부담</td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-2">상품 불일치</td>
                    <td className="border px-4 py-2">판매자 부담</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">6. 환불 방법</h2>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>• <strong>신용카드:</strong> 카드사 승인 취소 (3-7 영업일)</li>
              <li>• <strong>계좌이체:</strong> 구매자 계좌로 직접 입금 (영업일 기준 3일)</li>
              <li>• <strong>가상계좌:</strong> 구매자 계좌로 직접 입금 (영업일 기준 3일)</li>
              <li>• <strong>간편결제:</strong> 결제 수단에 따라 3-7 영업일</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">7. 문의</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                취소/환불/교환 관련 문의<br />
                고객센터: 0507-0177-0432<br />
                운영시간: 평일 09:00 - 18:00<br />
                이메일: support@ur-team.com
              </p>
            </div>
          </section>

          <div className="pt-4 text-center text-sm text-gray-500">
            <p>시행일자: 2026년 2월 14일</p>
            <p>UR Team</p>
          </div>
        </div>
      </div>
    </div>
  )
}
