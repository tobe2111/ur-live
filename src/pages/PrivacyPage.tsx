import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">개인정보 처리방침</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          <section>
            <h2 className="text-lg font-bold mb-3">1. 개인정보의 수집 및 이용 목적</h2>
            <p className="text-sm text-gray-700 leading-relaxed mb-2">
              UR Live는 다음의 목적을 위하여 개인정보를 처리합니다:
            </p>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>• 회원 가입 및 관리</li>
              <li>• 상품 주문 및 배송</li>
              <li>• 결제 및 정산</li>
              <li>• 고객 상담 및 불만 처리</li>
              <li>• 마케팅 및 광고 활용</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">2. 수집하는 개인정보 항목</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm mb-2">필수 수집 항목:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• 이름, 휴대전화번호, 이메일</li>
                  <li>• 배송지 주소</li>
                  <li>• 카카오 계정 정보 (카카오 로그인 시)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-sm mb-2">자동 수집 항목:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• IP 주소, 쿠키, 서비스 이용 기록</li>
                  <li>• 접속 로그, 방문 일시</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">3. 개인정보의 보유 및 이용 기간</h2>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>• 회원 탈퇴 시: 즉시 파기 (단, 관련 법령에 따라 보존 필요한 경우 예외)</li>
              <li>• 전자상거래 기록: 5년 (전자상거래법)</li>
              <li>• 소비자 불만/분쟁 처리 기록: 3년</li>
              <li>• 접속 로그: 3개월</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">4. 개인정보의 제3자 제공</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다.
              다만, 아래의 경우에는 예외로 합니다:
            </p>
            <ul className="text-sm text-gray-700 space-y-2 mt-2">
              <li>• 이용자가 사전에 동의한 경우</li>
              <li>• 법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 요구가 있는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">5. 개인정보 처리 위탁</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border px-4 py-2">수탁업체</th>
                    <th className="border px-4 py-2">위탁업무</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border px-4 py-2">토스페이먼츠</td>
                    <td className="border px-4 py-2">결제 처리</td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-2">카카오</td>
                    <td className="border px-4 py-2">소셜 로그인</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">6. 정보주체의 권리·의무</h2>
            <p className="text-sm text-gray-700 leading-relaxed mb-2">
              이용자는 언제든지 다음의 권리를 행사할 수 있습니다:
            </p>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>• 개인정보 열람 요구</li>
              <li>• 오류 등이 있을 경우 정정 요구</li>
              <li>• 삭제 요구</li>
              <li>• 처리 정지 요구</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">7. 개인정보 보호책임자</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                성명: 개인정보 보호책임자<br />
                이메일: privacy@ur-team.com<br />
                전화: 0507-0177-0432
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
