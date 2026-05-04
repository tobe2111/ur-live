import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { isKorea } from '@/shared/config/region'
import SEO from '@/components/SEO'

export default function TermsOfServicePage() {
  const navigate = useNavigate()
  const isKR = isKorea()

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] pb-20">
      <SEO title="이용약관 - 유어딜" description="유어딜 서비스 이용약관입니다." url="/terms" />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-medium flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} className="text-gray-900 dark:text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-[16px] font-bold text-gray-900 dark:text-white">
            {isKR ? '이용약관' : 'Terms of Service'}
          </h1>
          <div className="w-6" />
        </div>
      </div>

      {/* Content */}
      <div className="ur-content-medium px-5 pt-6">
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-6">
          {isKR ? '최종 수정일: 2024년 1월 15일' : 'Last updated: January 15, 2024'}
        </p>

        {isKR ? (
          <div className="space-y-0">
            <section>
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">제1조 (목적)</h2>
              <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                본 약관은 리스터코퍼레이션(상호명: 리스터코퍼레이션, 대표자: 정지원, 이하 "회사")이 제공하는
                라이브 커머스 서비스(이하 "서비스")의 이용과 관련하여
                회사와 회원 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
              </p>
              <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4 space-y-1">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white mb-2">사업자 정보</p>
                <p className="text-[13px] text-gray-600 dark:text-gray-300">• 상호명: 리스터코퍼레이션</p>
                <p className="text-[13px] text-gray-600 dark:text-gray-300">• 대표자: 정지원</p>
                <p className="text-[13px] text-gray-600 dark:text-gray-300">• 사업자등록번호: 479-09-02930</p>
                <p className="text-[13px] text-gray-600 dark:text-gray-300">• 통신판매업신고번호: 2025-부산금정-0540</p>
                <p className="text-[13px] text-gray-600 dark:text-gray-300">• 사업장주소: 부산광역시 금정구 놀이마당로26 1402호</p>
                <p className="text-[13px] text-gray-600 dark:text-gray-300">• 대표전화: 0507-0177-0432</p>
                <p className="text-[13px] text-gray-600 dark:text-gray-300">• 대표이메일: jiwon@ur-team.com</p>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">제2조 (정의)</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>본 약관에서 사용하는 용어의 정의는 다음과 같습니다:</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>"서비스"란 회사가 제공하는 라이브 스트리밍을 통한 상품 판매 및 구매 플랫폼을 의미합니다.</li>
                  <li>"회원"이란 본 약관에 동의하고 회사와 서비스 이용계약을 체결한 자를 의미합니다.</li>
                  <li>"판매자"란 서비스를 통해 상품을 판매하는 회원을 의미합니다.</li>
                  <li>"구매자"란 서비스를 통해 상품을 구매하는 회원을 의미합니다.</li>
                </ol>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">제3조 (약관의 게시와 개정)</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>① 회사는 본 약관의 내용을 회원이 쉽게 알 수 있도록 서비스 초기 화면에 게시합니다.</p>
                <p>② 회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.</p>
                <p>③ 회사가 약관을 개정할 경우 적용일자 및 개정사유를 명시하여 현행 약관과 함께
                  제1항의 방식에 따라 그 개정약관의 적용일자 7일 전부터 적용일자 전일까지 공지합니다.</p>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">제4조 (회원가입)</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>① 이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 본 약관에 동의한다는 의사표시를 함으로써
                  회원가입을 신청합니다.</p>
                <p>② 회사는 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각 호에 해당하지 않는 한
                  회원으로 등록합니다:</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>등록 내용에 허위, 기재누락, 오기가 있는 경우</li>
                  <li>기타 회원으로 등록하는 것이 회사의 기술상 현저히 지장이 있다고 판단되는 경우</li>
                </ol>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">제5조 (서비스의 제공 및 변경)</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>① 회사는 다음과 같은 서비스를 제공합니다:</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>라이브 스트리밍을 통한 상품 소개 및 판매</li>
                  <li>상품 검색 및 구매</li>
                  <li>결제 및 배송 서비스</li>
                  <li>기타 회사가 추가 개발하거나 다른 회사와의 제휴계약 등을 통해 회원에게 제공하는 일체의 서비스</li>
                </ol>
                <p>② 회사는 상당한 이유가 있는 경우 운영상, 기술상의 필요에 따라 제공하고 있는 서비스를 변경할 수 있습니다.</p>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">제6조 (서비스의 중단)</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>① 회사는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는
                  서비스의 제공을 일시적으로 중단할 수 있습니다.</p>
                <p>② 제1항에 의한 서비스 중단의 경우 회사는 사전에 공지합니다. 다만, 회사가 통제할 수 없는 사유로 인한
                  서비스의 중단으로 인하여 사전 통지가 불가능한 경우에는 그러하지 아니합니다.</p>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">제7조 (회원의 의무)</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>① 회원은 다음 행위를 하여서는 안 됩니다:</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>신청 또는 변경 시 허위내용의 등록</li>
                  <li>타인의 정보 도용</li>
                  <li>회사가 게시한 정보의 변경</li>
                  <li>회사가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등의 송신 또는 게시</li>
                  <li>회사와 기타 제3자의 저작권 등 지적재산권에 대한 침해</li>
                  <li>회사 및 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
                  <li>외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위</li>
                </ol>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">제8조 (구매 및 결제)</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>① 구매자는 서비스를 통해 상품을 구매할 수 있으며, 구매 시 다음 사항을 확인해야 합니다:</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>상품의 명칭, 가격, 수량</li>
                  <li>배송비 및 배송 예정일</li>
                  <li>환불 및 교환 조건</li>
                </ol>
                <p>② 회사는 구매자가 선택한 결제수단을 통해 안전하게 결제가 이루어질 수 있도록 노력합니다.</p>
                <p>③ 결제는 신용카드, 계좌이체, 간편결제 등 회사가 제공하는 방법으로 진행됩니다.</p>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">제9조 (환불 및 교환)</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>① 구매자는 상품 수령 후 7일 이내에 환불 또는 교환을 요청할 수 있습니다.</p>
                <p>② 다음의 경우 환불 또는 교환이 제한될 수 있습니다:</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>구매자의 책임 있는 사유로 상품이 멸실 또는 훼손된 경우</li>
                  <li>구매자의 사용 또는 일부 소비에 의하여 상품의 가치가 현저히 감소한 경우</li>
                  <li>시간의 경과에 의하여 재판매가 곤란할 정도로 상품의 가치가 현저히 감소한 경우</li>
                </ol>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">제10조 (개인정보보호)</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>① 회사는 이용자의 개인정보 수집 시 서비스 제공을 위하여 필요한 범위에서 최소한의 개인정보를 수집합니다.</p>
                <p>② 회사는 회원가입 시 구매계약 이행에 필요한 정보를 미리 수집하지 않습니다.
                  다만, 관련 법령상 의무이행을 위하여 구매계약 이전에 본인확인이 필요한 경우로서
                  최소한의 특정 개인정보를 수집하는 경우에는 그러하지 아니합니다.</p>
                <p>③ 회사는 이용자의 개인정보를 수집·이용하는 때에는 당해 이용자에게 그 목적을 고지하고 동의를 받습니다.</p>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">제11조 (회사의 의무)</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>① 회사는 법령과 본 약관이 금지하거나 공서양속에 반하는 행위를 하지 않으며 본 약관이 정하는 바에 따라
                  지속적이고, 안정적으로 서비스를 제공하는데 최선을 다하여야 합니다.</p>
                <p>② 회사는 이용자가 안전하게 서비스를 이용할 수 있도록 이용자의 개인정보보호를 위한
                  보안 시스템을 갖추어야 합니다.</p>
                <p>③ 회사는 이용자로부터 제기되는 의견이나 불만이 정당하다고 객관적으로 인정될 경우에는
                  적절한 절차를 거쳐 즉시 처리하여야 합니다.</p>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">제12조 (분쟁 해결)</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>① 회사는 이용자가 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위하여
                  피해보상처리기구를 설치·운영합니다.</p>
                <p>② 회사는 이용자로부터 제출되는 불만사항 및 의견은 우선적으로 그 사항을 처리합니다.
                  다만, 신속한 처리가 곤란한 경우에는 이용자에게 그 사유와 처리일정을 즉시 통보해 드립니다.</p>
                <p>③ 회사와 이용자 간에 발생한 전자상거래 분쟁과 관련하여 이용자의 피해구제신청이 있는 경우에는
                  공정거래위원회 또는 시·도지사가 의뢰하는 분쟁조정기관의 조정에 따를 수 있습니다.</p>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">제13조 (재판권 및 준거법)</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>① 회사와 이용자 간에 발생한 전자상거래 분쟁에 관한 소송은 제소 당시의 이용자의 주소에 의하고,
                  주소가 없는 경우에는 거소를 관할하는 지방법원의 전속관할로 합니다.
                  다만, 제소 당시 이용자의 주소 또는 거소가 분명하지 않거나 외국 거주자의 경우에는
                  민사소송법상의 관할법원에 제기합니다.</p>
                <p>② 회사와 이용자 간에 제기된 전자상거래 소송에는 한국법을 적용합니다.</p>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-0">
            <section>
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">1. Purpose</h2>
              <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                These Terms of Service ("Terms") govern your use of the YourDeal live commerce platform ("Service")
                operated by Lister Corporation ("Company"). By accessing or using the Service, you agree to be bound by these Terms.
              </p>
              <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4 space-y-1">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-white mb-2">Company Information</p>
                <p className="text-[13px] text-gray-600 dark:text-gray-300">• Company: Lister Corporation</p>
                <p className="text-[13px] text-gray-600 dark:text-gray-300">• CEO: Jiwon Jung</p>
                <p className="text-[13px] text-gray-600 dark:text-gray-300">• Email: jiwon@ur-team.com</p>
                <p className="text-[13px] text-gray-600 dark:text-gray-300">• Phone: +82-507-0177-0432</p>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">2. Definitions</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>"Service" refers to the live streaming commerce platform provided by the Company.</li>
                  <li>"User" refers to any person who agrees to these Terms and enters into a service agreement.</li>
                  <li>"Seller" refers to a User who sells products through the Service.</li>
                  <li>"Buyer" refers to a User who purchases products through the Service.</li>
                </ol>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">3. Account Registration</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>You may register an account by providing accurate information and agreeing to these Terms.
                  The Company may refuse registration if false information is provided.</p>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">4. Services Provided</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>The Company provides the following services:</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Live streaming product showcase and sales</li>
                  <li>Product search and purchase</li>
                  <li>Payment processing and delivery</li>
                  <li>Meal voucher group buying</li>
                  <li>Real-time auction and time deals during live broadcasts</li>
                </ol>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">5. Purchases & Payments</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>Buyers may purchase products through the Service. Payment is processed via Stripe (international)
                  or Toss Payments (Korea). All prices are displayed in the applicable currency.</p>
                <p>By making a purchase, you agree to pay the listed price plus any applicable shipping fees.</p>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">6. Refunds & Returns</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>Buyers may request a refund or exchange within 7 days of receiving the product, except when:</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>The product has been damaged due to the buyer's fault</li>
                  <li>The product value has significantly decreased due to use or partial consumption</li>
                  <li>The product cannot be resold due to the passage of time</li>
                </ol>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">7. User Obligations</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>Users must not:</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Register false information</li>
                  <li>Use another person's identity</li>
                  <li>Infringe on intellectual property rights</li>
                  <li>Post obscene, violent, or otherwise inappropriate content</li>
                  <li>Interfere with the operation of the Service</li>
                </ol>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">8. Privacy</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>The Company collects and processes personal data in accordance with our Privacy Policy.
                  We collect only the minimum information necessary to provide the Service.</p>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">9. Limitation of Liability</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>The Service is provided "as is." The Company shall not be liable for any indirect, incidental,
                  or consequential damages arising from the use of the Service, to the extent permitted by law.</p>
              </div>
            </section>

            <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">10. Governing Law</h2>
              <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                <p>These Terms shall be governed by and construed in accordance with the laws of the Republic of Korea.
                  Any disputes shall be submitted to the jurisdiction of the competent courts in Korea.</p>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
