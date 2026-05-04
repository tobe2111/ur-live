import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'

export default function RefundPolicyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] pb-20">
      <SEO title="환불정책 - 유어딜" description="유어딜 환불 및 반품 정책을 안내합니다." url="/refund-policy" />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-medium flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} className="text-gray-900 dark:text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-[16px] font-bold text-gray-900 dark:text-white">환불 및 교환/반품 정책</h1>
          <div className="w-6" />
        </div>
      </div>

      {/* Content */}
      <div className="ur-content-medium px-5 pt-6">
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-6">시행일자: 2026년 2월 20일</p>

        {/* 회사 정보 */}
        <section>
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">운영 회사 정보</h2>
          <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4 space-y-1.5">
            <p className="text-[13px] text-gray-600 dark:text-gray-300"><span className="font-semibold text-gray-900 dark:text-white">상호명:</span> 리스터코퍼레이션 (LISTER Corporation)</p>
            <p className="text-[13px] text-gray-600 dark:text-gray-300"><span className="font-semibold text-gray-900 dark:text-white">대표:</span> 정지원</p>
            <p className="text-[13px] text-gray-600 dark:text-gray-300"><span className="font-semibold text-gray-900 dark:text-white">고객센터:</span> 0507-0177-0432</p>
            <p className="text-[13px] text-gray-600 dark:text-gray-300"><span className="font-semibold text-gray-900 dark:text-white">이메일:</span> jiwon@ur-team.com</p>
            <p className="text-[13px] text-gray-600 dark:text-gray-300"><span className="font-semibold text-gray-900 dark:text-white">운영시간:</span> 평일 09:00 - 18:00 (주말 및 공휴일 휴무)</p>
          </div>
        </section>

        {/* 교환 및 반품 안내 */}
        <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-4">교환 및 반품 안내</h2>

          {/* 신청 방법 */}
          <div className="mb-5">
            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-2">신청 방법</h3>
            <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
              상품을 수령하신 날로부터 <span className="font-semibold text-gray-900 dark:text-white">7일 이내</span> 메신저 및 홈페이지 Q&A게시판 접수
            </p>
          </div>

          {/* 배송 비용 */}
          <div className="mb-5">
            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-2">배송 비용</h3>
            <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
              단순 변심은 왕복 택배비 <span className="font-semibold text-red-500">6,000원</span>
            </p>
          </div>

          {/* 반품 주소 */}
          <div className="mb-5">
            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-2">반품 주소</h3>
            <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
              부산광역시 금정구 놀이마당로26 1402호
            </p>
          </div>

          {/* 유의 사항 */}
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-3">유의 사항</h3>
            <div className="space-y-2">
              <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-3">
                <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                  <span className="text-green-600 font-semibold">단순 변심</span>의 경우 수령일로부터 7일 이내까지 교환·반품이 가능합니다.
                  <span className="text-red-500"> (교환/반품비 고객 부담)</span>
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-3">
                <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                  <span className="text-green-600 font-semibold">상품 하자</span> 또는 <span className="text-green-600 font-semibold">오배송</span>의 경우 수령일로부터 7일 이내 교환·반품이 가능합니다.
                  <span className="text-green-600"> (교환/반품비 무료)</span>
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-3">
                <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                  <span className="text-red-500 font-semibold">제품 특성상</span> 단순 변심, 부주의에 의한 제품 손상 및 파손, 사용 및 개봉한 경우 교환/반품이
                  <span className="text-red-500 font-semibold"> 불가</span>합니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 제22조 환불 */}
        <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-4">제22조 (환불)</h2>

          <div className="space-y-4">
            {/* 1항 */}
            <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
              <span className="font-semibold text-gray-900 dark:text-white">1.</span> 회원은 회사에 환불을 요구할 수 있습니다. 환불은 회사가 안내하는 정책 및 방법에 따라 진행됩니다.
            </p>

            {/* 2항 */}
            <div>
              <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
                <span className="font-semibold text-gray-900 dark:text-white">2.</span> 회사는 다음 각 호의 방식으로 환불을 진행합니다.
              </p>

              {/* 가. 경기 결제 회원 */}
              <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4 mb-3">
                <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-2">가. 경기 결제 회원</h3>
                <div className="space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>
                    환불은 서비스를 이용한 일수를 계산하고 <span className="font-semibold text-gray-900 dark:text-white">일할 계산</span>으로 진행됩니다.
                    결기간은 <span className="font-semibold text-gray-900 dark:text-white">300일</span>로 이용료를 일할로 나눈 금액을 환불합니다.
                  </p>
                  <p>
                    결제 금액의 <span className="text-red-500 font-semibold">10%를 제외</span>한 일수만큼 금액을 제외하고 계산되니
                    이용자는 남은 금액만 환불받습니다.
                  </p>
                  <p>
                    다만 결제 이후 <span className="font-semibold text-gray-900 dark:text-white">30일 이내</span>에 남은 기수대로 일할 계산이 이루어지며 남은 금액이 계산은
                    카드 수수료와 할인금액을 포함한 결제 금액의 <span className="text-red-500 font-semibold">20% 금액을 제외</span>한 금액에,
                    남은 일 수에 대한 일할 계산을 처리합니다.
                  </p>
                  <p className="text-red-500 font-semibold">
                    16일 이후 30일 이내 사용자는 환불이 불가능합니다.
                  </p>
                  <div className="bg-white dark:bg-[#0A0A0A] rounded p-3 mt-2">
                    <p className="text-[12px] font-mono text-gray-600 dark:text-gray-300">
                      <span className="font-semibold text-gray-900 dark:text-white">계산 공식:</span> [(전체금액) x 0.8 / 30] x 남은 일수
                    </p>
                  </div>
                </div>
              </div>

              {/* 나. 연간 결제 회원 */}
              <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4">
                <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-2">나. 연간 결제 회원</h3>
                <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                  연 기간은 <span className="font-semibold text-gray-900 dark:text-white">12개월</span>이고 전년 이용료는 전액 연간결제 이용료를 <span className="font-semibold text-gray-900 dark:text-white">12로 나누고</span>
                  하루라도 이용했으면 전액 연간결제 이용료를 12로 나누고 하루라도 이용했으면 제외합니다.
                </p>
              </div>
            </div>

            {/* 3항 */}
            <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
              <span className="font-semibold text-gray-900 dark:text-white">3.</span> 본 조의 환불 금액 기준은 연간 결제 회원이라 하더라도 <span className="font-semibold text-gray-900 dark:text-white">정기결제 금액으로 계산</span> 후
              진행됩니다. 따라서 환불 시점에 따라 환불금액이 존재하지 않는 경우도 있을 수 있습니다.
            </p>
          </div>
        </section>

        {/* 배송 안내 */}
        <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-4">배송 안내</h2>

          <div className="space-y-3">
            <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">배송 업체</h3>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">대한통운 (1588-1255)</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">* 판매 환경에 따라 변경될 수 있음</p>
            </div>

            <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">배송 지역</h3>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">대한민국 전 지역</p>
            </div>

            <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">배송 비용</h3>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">
                3,000원 / 구매 금액 <span className="font-semibold text-gray-900 dark:text-white">50,000원 이상 시 무료 배송</span>
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">* 도서산간 지역 별도 추가 금액 발생</p>
            </div>

            <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">배송 기간</h3>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">주말·공휴일 제외 2-5일</p>
            </div>
          </div>

          {/* 배송 유의사항 */}
          <div className="mt-4 bg-gray-50 dark:bg-[#121212] rounded-lg p-4">
            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-2">유의 사항</h3>
            <ul className="space-y-1.5 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>주문 폭주 및 공휴 사정으로 인하여 지연 및 품절이 발생될 수 있습니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>기본 배송기간 이상 소요되는 상품이거나, 품절 상품은 개별 연락을 드립니다.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* 환불 처리 절차 */}
        <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-4">환불 처리 절차</h2>
          <div className="space-y-3">
            {[
              { step: '1', title: '취소/반품 신청', desc: '마이페이지에서 신청 또는 고객센터 문의' },
              { step: '2', title: '판매자 확인', desc: '판매자가 신청 내용 확인 (1-2 영업일)' },
              { step: '3', title: '상품 반송 (반품 시)', desc: '지정된 주소로 상품 반송' },
              { step: '4', title: '환불 처리', desc: '상품 회수 확인 후 환불 (3-7 영업일)' },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center text-[12px] font-bold">
                  {item.step}
                </div>
                <div className="flex-1 pt-0.5">
                  <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                  <p className="text-[13px] text-gray-600 dark:text-gray-300">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 배송비 부담 테이블 */}
        <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-4">배송비 부담 안내</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-[#1A1A1A]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#121212]">
                  <th className="border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-2.5 text-left font-semibold text-gray-900 dark:text-white">사유</th>
                  <th className="border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-2.5 text-left font-semibold text-gray-900 dark:text-white">배송비 부담</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 dark:text-gray-300">
                <tr>
                  <td className="border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-2.5">단순 변심</td>
                  <td className="border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-2.5">
                    <span className="text-red-500 font-semibold">구매자 부담</span> (왕복 배송비 6,000원)
                  </td>
                </tr>
                <tr>
                  <td className="border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-2.5">상품 하자</td>
                  <td className="border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-2.5">
                    <span className="text-green-600 font-semibold">판매자 부담</span>
                  </td>
                </tr>
                <tr>
                  <td className="border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-2.5">오배송</td>
                  <td className="border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-2.5">
                    <span className="text-green-600 font-semibold">판매자 부담</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5">상품 불일치</td>
                  <td className="px-4 py-2.5">
                    <span className="text-green-600 font-semibold">판매자 부담</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 환불 방법 */}
        <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-4">환불 방법 및 소요기간</h2>
          <div className="space-y-2">
            <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">신용카드</h3>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">카드사 승인 취소 (3-7 영업일)</p>
            </div>
            <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">계좌이체</h3>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">구매자 계좌로 직접 입금 (영업일 기준 3일)</p>
            </div>
            <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">가상계좌</h3>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">구매자 계좌로 직접 입금 (영업일 기준 3일)</p>
            </div>
            <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">간편결제</h3>
              <p className="text-[13px] text-gray-600 dark:text-gray-300">결제 수단에 따라 3-7 영업일</p>
            </div>
          </div>
        </section>

        {/* 고객센터 문의 */}
        <section className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">고객센터 문의</h2>
          <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4 space-y-2">
            <p className="text-[13px] text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-900 dark:text-white">고객센터:</span> 0507-0177-0432
            </p>
            <p className="text-[13px] text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-900 dark:text-white">운영시간:</span> 평일 09:00 - 18:00 (주말 및 공휴일 휴무)
            </p>
            <p className="text-[13px] text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-900 dark:text-white">이메일:</span> jiwon@ur-team.com
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-[#1A1A1A] pt-6 mt-6 text-center space-y-1">
          <p className="text-[13px] text-gray-600 dark:text-gray-300">
            <span className="font-semibold text-gray-900 dark:text-white">상호명:</span> 리스터코퍼레이션 (LISTER Corporation)
          </p>
          <p className="text-[13px] text-gray-600 dark:text-gray-300">
            <span className="font-semibold text-gray-900 dark:text-white">대표:</span> 정지원
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">
            본 정책은 전자상거래 등에서의 소비자보호에 관한 법률을 준수합니다.
          </p>
        </div>
      </div>
    </div>
  )
}
