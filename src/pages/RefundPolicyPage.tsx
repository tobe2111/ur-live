import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'

export default function RefundPolicyPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-warm pb-20">
      {/* 🔗 url 을 `/refund-policy` → `/refund` 로 정정: 전자는 2026-07-29 부터 서버 301 별칭이라 canonical 이 리다이렉트를 가리키고 있었다. */}
      <SEO title={t('refundPolicy.seoTitle', { defaultValue: CONSUMER_SURFACE_SEO['/refund'].title })} description={t('refundPolicy.seoDesc', { defaultValue: CONSUMER_SURFACE_SEO['/refund'].description })} url="/refund" />

      {/* Header */}
      {/* 🩸 2026-10-13 — 토큰 이행에서 `bg-white/90 dark:bg-[#11141C]/90` 를 `bg-warm/90` 으로
          바꿨더니 **CSS 가 아예 안 나왔다**(`check-ghost-classes` 가 잡았다). `--bg` 는 hex 를 담은
          var() 라 Tailwind 가 알파를 합성하지 못한다 — 머리줄이 통째로 투명해진다.
          `CuratorEarningsPage` 가 같은 자리에서 남긴 처방대로 **불투명 면**으로 간다:
          페이지는 `bg-warm`, 머리줄은 `bg-surface` 라 두 면이 맞닿는 것 자체가 구분이 된다
          (불투명하면 `backdrop-blur` 는 보이는 일이 없으므로 함께 뺀다). */}
      <div className="sticky top-0 md:top-14 z-40 bg-surface border-b border-rule">
        <div className="ur-content-medium flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="text-ink">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-[17px] font-bold text-ink">환불 및 교환/반품 정책</h1>
          <div className="w-6" />
        </div>
      </div>

      {/* Content */}
      <div className="ur-content-medium px-5 pt-6">
        <p className="text-[12px] text-ink-faint mb-6">시행일자: 2026년 10월 13일</p>

        {/* 회사 정보 */}
        <section>
          <h2 className="text-[15px] font-bold text-ink mb-3">운영 회사 정보</h2>
          <div className="bg-surface rounded-lg p-4 space-y-2">
            <p className="text-[13px] text-ink-soft"><span className="font-medium text-ink">상호명:</span> 리스터코퍼레이션 (LISTER Corporation)</p>
            <p className="text-[13px] text-ink-soft"><span className="font-medium text-ink">대표:</span> 정지원</p>
            <p className="text-[13px] text-ink-soft"><span className="font-medium text-ink">이메일:</span> jiwon@ur-team.com</p>
            <p className="text-[13px] text-ink-soft"><span className="font-medium text-ink">운영시간:</span> 평일 09:00 - 18:00 (주말 및 공휴일 휴무)</p>
          </div>
        </section>

        {/* 이용권 환불 */}
        <section className="border-t border-rule pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-ink mb-4">이용권 환불</h2>

          <div className="space-y-3">
            <div className="bg-surface rounded-lg p-4">
              <h3 className="text-[13px] font-medium text-ink mb-1">유효기간 안에 쓰지 않은 이용권</h3>
              <p className="text-[13px] text-ink-soft leading-relaxed">
                따로 신청하지 않아도 <span className="font-medium text-ink">결제 금액 전액</span>이 자동으로 환불됩니다.
                회사는 매일 한 번 만료된 이용권을 확인해 환불하고, 처리되면 알림으로 알려드립니다.
                <span className="text-ink-faint"> 일할 계산이나 수수료 공제는 없습니다.</span>
              </p>
            </div>

            <div className="bg-surface rounded-lg p-4">
              <h3 className="text-[13px] font-medium text-ink mb-1">돌려받는 방법</h3>
              <p className="text-[13px] text-ink-soft leading-relaxed">
                <span className="font-medium text-ink">결제한 수단 그대로</span> 돌려드립니다.
                카드로 결제했으면 카드 결제가 취소되고(카드사 사정에 따라 영업일 3~5일), 딜로 결제했으면 딜로 돌아갑니다.
                딜은 <span className="font-medium text-ink">쓸 때와 같은 종류</span>로 복원됩니다 — 충전한 딜은 충전 딜로, 리워드로 받은 딜은 리워드 딜로.
              </p>
            </div>

            <div className="bg-surface rounded-lg p-4">
              <h3 className="text-[13px] font-medium text-ink mb-1">이미 사용한 이용권</h3>
              <p className="text-[13px] text-ink-soft leading-relaxed">
                매장에서 사용 처리가 끝난 이용권은 <span className="text-tone-bad font-medium">환불 대상이 아닙니다</span>.
                매장이 이미 제공한 상품·서비스이기 때문입니다. 제공받은 내용에 문제가 있었다면 고객센터로 알려주세요. 개별적으로 확인해 처리해 드립니다.
              </p>
            </div>

            <div className="bg-surface rounded-lg p-4">
              <h3 className="text-[13px] font-medium text-ink mb-1">유효기간 전에 취소하고 싶을 때</h3>
              <p className="text-[13px] text-ink-soft leading-relaxed">
                아직 사용하지 않았다면 고객센터로 요청해 주세요. 확인 후 주문 단위로 취소·환불해 드립니다.
                기다리셔도 괜찮습니다 — 유효기간이 지나면 위와 같이 자동으로 전액 환불됩니다.
              </p>
            </div>
          </div>
        </section>

        {/* 딜 환급 */}
        <section className="border-t border-rule pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-ink mb-4">딜(충전 잔액) 환급</h2>

          <div className="space-y-3">
            <div className="bg-surface rounded-lg p-4">
              <p className="text-[13px] text-ink-soft leading-relaxed">
                직접 <span className="font-medium text-ink">충전하고 아직 쓰지 않은 딜</span>은 현금으로 환급을 신청할 수 있습니다
                (이용약관 제12조). 마이 페이지에서 신청하시면 확인 후 등록하신 계좌로 입금해 드립니다.
              </p>
            </div>
            <ul className="space-y-2 text-[13px] text-ink-soft leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>환급 한도는 <span className="font-medium text-ink">충전하신 금액</span>까지입니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>이벤트·리워드로 받은 딜은 환급 대상이 아닙니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>충전한 돈을 돌려드리는 것이므로 <span className="font-medium text-ink">원천징수를 하지 않습니다</span>. 소개 수익 출금과는 별개의 절차입니다.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* 교환 및 반품 안내 */}
        <section className="border-t border-rule pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-ink mb-4">배송 상품 교환 및 반품</h2>

          {/* 신청 방법 */}
          <div className="mb-5">
            <h3 className="text-[13px] font-medium text-ink mb-2">신청 방법</h3>
            <p className="text-[13px] text-ink-soft leading-relaxed">
              상품을 수령하신 날로부터 <span className="font-medium text-ink">7일 이내</span> 메신저 및 홈페이지 Q&A게시판 접수
            </p>
          </div>

          {/* 배송 비용 */}
          <div className="mb-5">
            <h3 className="text-[13px] font-medium text-ink mb-2">배송 비용</h3>
            <p className="text-[13px] text-ink-soft leading-relaxed">
              단순 변심은 왕복 택배비 <span className="font-medium text-tone-bad">6,000원</span>
            </p>
          </div>

          {/* 반품 주소 */}
          <div className="mb-5">
            <h3 className="text-[13px] font-medium text-ink mb-2">반품 주소</h3>
            <p className="text-[13px] text-ink-soft leading-relaxed">
              서울특별시 강남구 남부순환로359길 14, 3층(도곡동)
            </p>
          </div>

          {/* 유의 사항 */}
          <div>
            <h3 className="text-[13px] font-medium text-ink mb-3">유의 사항</h3>
            <div className="space-y-2">
              <div className="bg-surface rounded-lg p-3">
                <p className="text-[13px] text-ink-soft leading-relaxed">
                  <span className="text-tone-ok font-medium">단순 변심</span>의 경우 수령일로부터 7일 이내까지 교환·반품이 가능합니다.
                  <span className="text-tone-bad"> (교환/반품비 고객 부담)</span>
                </p>
              </div>
              <div className="bg-surface rounded-lg p-3">
                <p className="text-[13px] text-ink-soft leading-relaxed">
                  <span className="text-tone-ok font-medium">상품 하자</span> 또는 <span className="text-tone-ok font-medium">오배송</span>의 경우 수령일로부터 7일 이내 교환·반품이 가능합니다.
                  <span className="text-tone-ok"> (교환/반품비 무료)</span>
                </p>
              </div>
              <div className="bg-surface rounded-lg p-3">
                <p className="text-[13px] text-ink-soft leading-relaxed">
                  <span className="text-tone-bad font-medium">제품 특성상</span> 단순 변심, 부주의에 의한 제품 손상 및 파손, 사용 및 개봉한 경우 교환/반품이
                  <span className="text-tone-bad font-medium"> 불가</span>합니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 배송 안내 */}
        <section className="border-t border-rule pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-ink mb-4">배송 안내</h2>

          <div className="space-y-3">
            <div className="bg-surface rounded-lg p-4">
              <h3 className="text-[13px] font-medium text-ink mb-1">배송 업체</h3>
              <p className="text-[13px] text-ink-soft">대한통운 (1588-1255)</p>
              <p className="text-[12px] text-ink-faint mt-1">* 판매 환경에 따라 변경될 수 있음</p>
            </div>

            <div className="bg-surface rounded-lg p-4">
              <h3 className="text-[13px] font-medium text-ink mb-1">배송 지역</h3>
              <p className="text-[13px] text-ink-soft">대한민국 전 지역</p>
            </div>

            <div className="bg-surface rounded-lg p-4">
              <h3 className="text-[13px] font-medium text-ink mb-1">배송 비용</h3>
              <p className="text-[13px] text-ink-soft">
                3,000원 / 구매 금액 <span className="font-medium text-ink">50,000원 이상 시 무료 배송</span>
              </p>
              <p className="text-[12px] text-ink-faint mt-1">* 도서산간 지역 별도 추가 금액 발생</p>
            </div>

            <div className="bg-surface rounded-lg p-4">
              <h3 className="text-[13px] font-medium text-ink mb-1">배송 기간</h3>
              <p className="text-[13px] text-ink-soft">주말·공휴일 제외 2-5일</p>
            </div>
          </div>

          {/* 배송 유의사항 */}
          <div className="mt-4 bg-surface rounded-lg p-4">
            <h3 className="text-[13px] font-medium text-ink mb-2">유의 사항</h3>
            <ul className="space-y-2 text-[13px] text-ink-soft leading-relaxed">
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
        <section className="border-t border-rule pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-ink mb-4">환불 처리 절차</h2>
          <div className="space-y-3">
            {[
              { step: '1', title: '취소/반품 신청', desc: '마이페이지에서 신청 또는 고객센터 문의' },
              { step: '2', title: '판매자 확인', desc: '판매자가 신청 내용 확인 (1-2 영업일)' },
              { step: '3', title: '상품 반송 (반품 시)', desc: '지정된 주소로 상품 반송' },
              { step: '4', title: '환불 처리', desc: '상품 회수 확인 후 환불 (3-7 영업일)' },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center text-[12px] font-medium">
                  {item.step}
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-[13px] font-medium text-ink">{item.title}</h3>
                  <p className="text-[13px] text-ink-soft">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 배송비 부담 테이블 */}
        <section className="border-t border-rule pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-ink mb-4">배송비 부담 안내</h2>
          <div className="overflow-x-auto rounded-lg border border-rule">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-surface">
                  <th className="border-b border-rule px-4 py-2 text-left font-medium text-ink">사유</th>
                  <th className="border-b border-rule px-4 py-2 text-left font-medium text-ink">배송비 부담</th>
                </tr>
              </thead>
              <tbody className="text-ink-soft">
                <tr>
                  <td className="border-b border-rule px-4 py-2">단순 변심</td>
                  <td className="border-b border-rule px-4 py-2">
                    <span className="text-tone-bad font-medium">구매자 부담</span> (왕복 배송비 6,000원)
                  </td>
                </tr>
                <tr>
                  <td className="border-b border-rule px-4 py-2">상품 하자</td>
                  <td className="border-b border-rule px-4 py-2">
                    <span className="text-tone-ok font-medium">판매자 부담</span>
                  </td>
                </tr>
                <tr>
                  <td className="border-b border-rule px-4 py-2">오배송</td>
                  <td className="border-b border-rule px-4 py-2">
                    <span className="text-tone-ok font-medium">판매자 부담</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2">상품 불일치</td>
                  <td className="px-4 py-2">
                    <span className="text-tone-ok font-medium">판매자 부담</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 환불 방법 */}
        <section className="border-t border-rule pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-ink mb-4">환불 방법 및 소요기간</h2>
          <div className="space-y-2">
            <div className="bg-surface rounded-lg p-4">
              <h3 className="text-[13px] font-medium text-ink mb-1">신용카드</h3>
              <p className="text-[13px] text-ink-soft">카드사 승인 취소 (3-7 영업일)</p>
            </div>
            <div className="bg-surface rounded-lg p-4">
              <h3 className="text-[13px] font-medium text-ink mb-1">계좌이체</h3>
              <p className="text-[13px] text-ink-soft">구매자 계좌로 직접 입금 (영업일 기준 3일)</p>
            </div>
            <div className="bg-surface rounded-lg p-4">
              <h3 className="text-[13px] font-medium text-ink mb-1">가상계좌</h3>
              <p className="text-[13px] text-ink-soft">구매자 계좌로 직접 입금 (영업일 기준 3일)</p>
            </div>
            <div className="bg-surface rounded-lg p-4">
              <h3 className="text-[13px] font-medium text-ink mb-1">간편결제</h3>
              <p className="text-[13px] text-ink-soft">결제 수단에 따라 3-7 영업일</p>
            </div>
          </div>
        </section>

        {/* 고객센터 문의 */}
        <section className="border-t border-rule pt-6 mt-6">
          <h2 className="text-[15px] font-bold text-ink mb-3">고객센터 문의</h2>
          <div className="bg-surface rounded-lg p-4 space-y-2">
            <p className="text-[13px] text-ink-soft">
              <span className="font-medium text-ink">운영시간:</span> 평일 09:00 - 18:00 (주말 및 공휴일 휴무)
            </p>
            <p className="text-[13px] text-ink-soft">
              <span className="font-medium text-ink">이메일:</span> jiwon@ur-team.com
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-rule pt-6 mt-6 text-center space-y-1">
          <p className="text-[13px] text-ink-soft">
            <span className="font-medium text-ink">상호명:</span> 리스터코퍼레이션 (LISTER Corporation)
          </p>
          <p className="text-[13px] text-ink-soft">
            <span className="font-medium text-ink">대표:</span> 정지원
          </p>
          <p className="text-[12px] text-ink-faint mt-3">
            본 정책은 전자상거래 등에서의 소비자보호에 관한 법률을 준수합니다.
          </p>
        </div>
      </div>
    </div>
  )
}
