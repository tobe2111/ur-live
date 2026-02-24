import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function PrivacyPolicyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* 헤더 */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>뒤로가기</span>
          </button>
          <h1 className="text-3xl font-bold">개인정보 처리방침</h1>
          <p className="text-gray-600 mt-2">최종 수정일: 2024년 1월 15일</p>
        </div>

        {/* 본문 */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-8">
          {/* 사업자 정보 */}
          <section className="bg-gray-50 p-4 rounded-lg space-y-1 text-sm text-gray-700">
            <p><strong>사업자 정보</strong></p>
            <p>• 상호명: 리스터코퍼레이션</p>
            <p>• 대표자: 정지원</p>
            <p>• 사업자등록번호: 479-09-02930</p>
            <p>• 통신판매업신고번호: 2025-부산금정-0540</p>
            <p>• 사업장주소: 부산광역시 금정구 놀이마당로26 1402호</p>
            <p>• 대표전화: 0507-0177-0432</p>
            <p>• 대표이메일: jiwon@ur-team.com</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">1. 개인정보의 처리 목적</h2>
            <div className="space-y-3 text-gray-700 leading-relaxed">
              <p>리스터코퍼레이션(상호명: 리스터코퍼레이션, 대표자: 정지원, 이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다. 
                처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 
                이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
              
              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="font-bold text-lg mb-2">① 회원 가입 및 관리</h3>
                  <p className="ml-4">회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 
                    서비스 부정이용 방지, 각종 고지·통지 목적으로 개인정보를 처리합니다.</p>
                </div>

                <div>
                  <h3 className="font-bold text-lg mb-2">② 재화 또는 서비스 제공</h3>
                  <p className="ml-4">물품배송, 서비스 제공, 계약서·청구서 발송, 콘텐츠 제공, 맞춤서비스 제공, 
                    본인인증, 요금결제·정산을 목적으로 개인정보를 처리합니다.</p>
                </div>

                <div>
                  <h3 className="font-bold text-lg mb-2">③ 고충처리</h3>
                  <p className="ml-4">민원인의 신원 확인, 민원사항 확인, 사실조사를 위한 연락·통지, 
                    처리결과 통보 목적으로 개인정보를 처리합니다.</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. 개인정보의 처리 및 보유기간</h2>
            <div className="space-y-3 text-gray-700 leading-relaxed">
              <p>① 회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 
                동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</p>
              
              <div className="mt-4 space-y-3">
                <p>② 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다:</p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p><strong>회원 가입 및 관리:</strong> 회원 탈퇴 시까지</p>
                  <p className="text-sm text-gray-600 ml-4">
                    다만, 다음의 사유에 해당하는 경우에는 해당 사유 종료 시까지
                  </p>
                  <ul className="list-disc list-inside ml-8 text-sm space-y-1">
                    <li>관계 법령 위반에 따른 수사·조사 등이 진행중인 경우: 해당 수사·조사 종료 시까지</li>
                    <li>서비스 이용에 따른 채권·채무관계 잔존 시: 해당 채권·채무관계 정산 완료 시까지</li>
                  </ul>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p><strong>재화 또는 서비스 제공:</strong> 재화·서비스 공급완료 및 요금결제·정산 완료 시까지</p>
                  <p className="text-sm text-gray-600 ml-4">
                    다만, 다음의 사유에 해당하는 경우에는 해당 기간 종료 시까지
                  </p>
                  <ul className="list-disc list-inside ml-8 text-sm space-y-1">
                    <li>「전자상거래 등에서의 소비자 보호에 관한 법률」에 따른 표시·광고, 계약내용 및 이행 등 거래에 관한 기록
                      <ul className="list-circle list-inside ml-4 mt-1">
                        <li>표시·광고에 관한 기록: 6개월</li>
                        <li>계약 또는 청약철회, 대금결제, 재화 등의 공급기록: 5년</li>
                        <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년</li>
                      </ul>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. 처리하는 개인정보의 항목</h2>
            <div className="space-y-3 text-gray-700 leading-relaxed">
              <p>회사는 다음의 개인정보 항목을 처리하고 있습니다:</p>
              
              <div className="mt-4 space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">① 회원 가입 및 관리</h3>
                  <p className="text-sm">필수항목: 이름, 이메일, 비밀번호, 휴대전화번호</p>
                  <p className="text-sm text-gray-600 mt-1">선택항목: 프로필 사진</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">② 재화 또는 서비스 제공</h3>
                  <p className="text-sm">필수항목: 이름, 휴대전화번호, 배송지 주소, 이메일</p>
                  <p className="text-sm text-gray-600 mt-1">선택항목: 전화번호, 배송 메시지</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">③ 결제 서비스 제공</h3>
                  <p className="text-sm">신용카드 결제시: 카드사명, 카드번호 등</p>
                  <p className="text-sm">계좌이체시: 은행명, 계좌번호 등</p>
                  <p className="text-sm text-gray-600 mt-1">
                    * 결제 정보는 토스페이먼츠를 통해 안전하게 처리되며, 회사는 최소한의 정보만 보관합니다.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">④ 자동 수집 항목</h3>
                  <p className="text-sm">IP주소, 쿠키, 방문일시, 서비스 이용 기록, 불량 이용 기록</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. 개인정보의 제3자 제공</h2>
            <div className="space-y-3 text-gray-700 leading-relaxed">
              <p>① 회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며, 
                정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조에 해당하는 경우에만 
                개인정보를 제3자에게 제공합니다.</p>
              
              <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                <p className="font-bold mb-2">개인정보를 제공받는 자: 판매자(상품 판매 업체)</p>
                <p className="text-sm">제공받는 자의 이용 목적: 상품 배송, 주문 확인</p>
                <p className="text-sm">제공하는 항목: 구매자 이름, 휴대전화번호, 배송지 주소</p>
                <p className="text-sm">제공받는 자의 보유·이용기간: 배송 완료 후 3개월</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">5. 개인정보처리의 위탁</h2>
            <div className="space-y-3 text-gray-700 leading-relaxed">
              <p>① 회사는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다:</p>
              
              <div className="mt-4 space-y-3">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-bold">토스페이먼츠</p>
                  <p className="text-sm">위탁업무: 전자결제 처리</p>
                  <p className="text-sm">위탁기간: 회원 탈퇴 시 또는 위탁계약 종료 시</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-bold">Cloudflare</p>
                  <p className="text-sm">위탁업무: 클라우드 인프라 제공</p>
                  <p className="text-sm">위탁기간: 회원 탈퇴 시 또는 위탁계약 종료 시</p>
                </div>
              </div>

              <p className="mt-4">② 회사는 위탁계약 체결 시 「개인정보 보호법」 제26조에 따라 위탁업무 수행목적 외 
                개인정보 처리금지, 기술적·관리적 보호조치, 재위탁 제한, 수탁자에 대한 관리·감독, 
                손해배상 등 책임에 관한 사항을 계약서 등 문서에 명시하고, 
                수탁자가 개인정보를 안전하게 처리하는지를 감독하고 있습니다.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">6. 정보주체의 권리·의무 및 행사방법</h2>
            <div className="space-y-3 text-gray-700 leading-relaxed">
              <p>① 정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다:</p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>개인정보 열람요구</li>
                <li>오류 등이 있을 경우 정정 요구</li>
                <li>삭제요구</li>
                <li>처리정지 요구</li>
              </ol>
              <p className="mt-3">② 제1항에 따른 권리 행사는 회사에 대해 서면, 전화, 전자우편 등을 통하여 하실 수 있으며 
                회사는 이에 대해 지체없이 조치하겠습니다.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">7. 개인정보의 파기</h2>
            <div className="space-y-3 text-gray-700 leading-relaxed">
              <p>① 회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 
                지체없이 해당 개인정보를 파기합니다.</p>
              <p>② 개인정보 파기의 절차 및 방법은 다음과 같습니다:</p>
              <div className="ml-4 space-y-3">
                <div>
                  <h3 className="font-bold">파기절차</h3>
                  <p className="text-sm text-gray-600">
                    회사는 파기 사유가 발생한 개인정보를 선정하고, 회사의 개인정보 보호책임자의 승인을 받아 개인정보를 파기합니다.
                  </p>
                </div>
                <div>
                  <h3 className="font-bold">파기방법</h3>
                  <p className="text-sm text-gray-600">
                    전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용합니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">8. 개인정보의 안전성 확보조치</h2>
            <div className="space-y-3 text-gray-700 leading-relaxed">
              <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다:</p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>관리적 조치: 내부관리계획 수립·시행, 정기적 직원 교육 등</li>
                <li>기술적 조치: 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 
                  고유식별정보 등의 암호화, 보안프로그램 설치</li>
                <li>물리적 조치: 전산실, 자료보관실 등의 접근통제</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">9. 개인정보 보호책임자</h2>
            <div className="space-y-3 text-gray-700 leading-relaxed">
              <p>① 회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 
                개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다:</p>
              
              <div className="mt-4 bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="font-bold">개인정보 보호책임자</p>
                <p className="text-sm mt-2">담당부서: 운영팀</p>
                <p className="text-sm">이메일: privacy@ur-team.com</p>
                <p className="text-sm">전화번호: 1544-0000</p>
              </div>

              <p className="mt-4">② 정보주체는 회사의 서비스를 이용하시면서 발생한 모든 개인정보 보호 관련 문의, 불만처리, 
                피해구제 등에 관한 사항을 개인정보 보호책임자에게 문의하실 수 있습니다. 
                회사는 정보주체의 문의에 대해 지체없이 답변 및 처리해드릴 것입니다.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">10. 권익침해 구제방법</h2>
            <div className="space-y-3 text-gray-700 leading-relaxed">
              <p>정보주체는 개인정보침해로 인한 구제를 받기 위하여 개인정보분쟁조정위원회, 
                한국인터넷진흥원 개인정보침해신고센터 등에 분쟁해결이나 상담 등을 신청할 수 있습니다.</p>
              
              <div className="mt-4 space-y-2 bg-gray-50 p-4 rounded-lg">
                <p><strong>개인정보분쟁조정위원회:</strong> 1833-6972 (www.kopico.go.kr)</p>
                <p><strong>개인정보침해신고센터:</strong> (국번없이) 118 (privacy.kisa.or.kr)</p>
                <p><strong>대검찰청:</strong> (국번없이) 1301 (www.spo.go.kr)</p>
                <p><strong>경찰청:</strong> (국번없이) 182 (ecrm.cyber.go.kr)</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">11. 개인정보 처리방침의 변경</h2>
            <div className="space-y-3 text-gray-700 leading-relaxed">
              <p>① 이 개인정보 처리방침은 2024년 1월 15일부터 적용됩니다.</p>
              <p>② 이전의 개인정보 처리방침은 아래에서 확인하실 수 있습니다:</p>
              <p className="ml-4 text-sm text-gray-600">- 해당 사항 없음</p>
            </div>
          </section>
        </div>

        {/* 푸터 버튼 */}
        <div className="mt-6 flex justify-center">
          <Button
            onClick={() => navigate(-1)}
            className="px-8 py-3"
          >
            확인
          </Button>
        </div>
      </div>
    </div>
  )
}
