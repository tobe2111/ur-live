import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function TermsPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">이용약관</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          <section>
            <h2 className="text-lg font-bold mb-3">제1조 (목적)</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              본 약관은 리스터코퍼레이션(이하 "회사")이 제공하는 라이브 커머스 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">제2조 (정의)</h2>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>1. "서비스"란 회사가 제공하는 라이브 쇼핑, 상품 판매 및 관련 부가 서비스를 의미합니다.</li>
              <li>2. "회원"이란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.</li>
              <li>3. "판매자"란 회사의 승인을 받아 상품을 등록하고 판매하는 자를 말합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">제3조 (약관의 효력 및 변경)</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.
              회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">제4조 (서비스 제공)</h2>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>1. 라이브 스트리밍을 통한 상품 판매</li>
              <li>2. 상품 주문 및 결제 서비스</li>
              <li>3. 실시간 채팅 및 고객 상담</li>
              <li>4. 기타 회사가 추가 개발하거나 제휴 계약 등을 통해 회원에게 제공하는 일체의 서비스</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">제5조 (개인정보 보호)</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              회사는 관련 법령이 정하는 바에 따라 회원의 개인정보를 보호하기 위해 노력합니다.
              개인정보의 보호 및 사용에 대해서는 관련 법령 및 회사의 개인정보처리방침이 적용됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">제6조 (외부 거래 금지)</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-bold mb-2">⚠️ 중요 안내</p>
              <p className="text-sm text-red-700 leading-relaxed">
                서비스 외부에서의 직거래는 금지되며, 이로 인한 피해는 회사가 책임지지 않습니다.
                판매자와 직접 거래 시 발생하는 사기, 분쟁 등 모든 문제는 당사자 간 해결해야 하며,
                외부 거래로 인한 피해 발생 시 회사는 일체의 책임을 지지 않습니다.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">제7조 (환불 및 취소)</h2>
            <p className="text-sm text-gray-700 leading-relaxed mb-2">
              주문 취소 및 환불은 다음과 같은 규정에 따릅니다:
            </p>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>• 결제 후 배송 전: 전액 환불 가능</li>
              <li>• 배송 시작 후: 판매자와 협의 필요</li>
              <li>• 상품 수령 후 7일 이내: 단순 변심 반품 가능 (왕복 배송비 고객 부담)</li>
              <li>• 상품 하자: 무료 반품/교환 가능</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">제8조 (면책조항)</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.
              회사는 회원의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않습니다.
            </p>
          </section>

          <div className="pt-4 text-center text-sm text-gray-500">
            <p>시행일자: 2026년 2월 14일</p>
            <p>리스터코퍼레이션</p>
          </div>
        </div>
      </div>
    </div>
  )
}
