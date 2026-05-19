/**
 * 🛡️ 2026-05-16: 매장 (셀러) 추가 이용약관 초안.
 *
 * ⚠️ 법무 검토 필수.
 */

import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'

export default function SellerTermsPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-white pb-20">
      <SEO title="매장 약관 - 유어딜" description="유어딜 매장 입점 / 정산 / 인플루언서 협업 약관" url="/terms/seller" />
      <div className="sticky top-0 z-40 bg-white/90/90 backdrop-blur border-b border-gray-100">
        <div className="ur-content-medium flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} className="text-gray-900"><ChevronLeft className="w-6 h-6" /></button>
          <h1 className="text-[16px] font-bold text-gray-900">매장 약관</h1>
          <div className="w-6" />
        </div>
      </div>

      <div className="ur-content-medium px-5 pt-6 prose prose-sm max-w-none">
        <p className="text-[11px] text-gray-400 mb-6">최종 수정일: 2026년 5월 16일 (초안 — 법무 검토 전)</p>

        <h2 className="text-lg font-bold mt-4 mb-2">제1조 (목적)</h2>
        <p className="text-sm">본 약관은 유어딜 (이하 "회사") 의 공동구매 식사권 플랫폼에 매장 (이하 "셀러") 로 입점하여 voucher 발행 / 사용 / 정산하는 절차를 규정합니다.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">제2조 (입점 자격)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>사업자등록증 보유한 매장 운영자.</li>
          <li>식품위생법 등 관련 법령 준수.</li>
          <li>음식 / 서비스 품질에 대한 책임 능력 보유.</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제3조 (수수료 및 정산)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>기본 회사 수수료: 매출의 <strong>5%</strong> (어드민 정책에 따라 변경 가능).</li>
          <li>인플 referral 발생 매출: 추가 0.5% (또는 영입 보너스 시 1.5%, 협업 deal 시 합의 %) 가 인플 commission 으로 차감.</li>
          <li>사용자 referral 보너스 0.5% 는 사용자에게 즉시 적립 (셀러 영향 없음 — 회사 또는 인플 commission 에서 분배).</li>
          <li>에이전시 소속 시 추가 2% commission 차감.</li>
          <li>최종 셀러 수령액 = 매출 - 위 합계 (모든 차감 후).</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제4조 (정산 시점)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li><strong>voucher 사용 + 7일</strong> 후 셀러 계좌로 자동 송금.</li>
          <li>7일은 환불 가능 기간 — 사용자 환불 발생 시 회수.</li>
          <li>voucher 미사용 만료 시: 사용자에게 전액 환불, 셀러 receivable 0.</li>
          <li>정산 주기는 셀러가 settings 에서 변경 가능 (즉시/주간/월간).</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제5조 (voucher 사용 / 환불 / 분쟁)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>매장은 voucher 코드 또는 QR 스캔으로 사용 처리. 사용 후 변경 불가 (atomic).</li>
          <li>부분 사용 (액면가가 결제 금액보다 작은 경우) 시 차액 환불 자동 처리.</li>
          <li>매장이 voucher 사용 거부 / 음식 품질 문제 / 매장 휴업 등 발생 시 어드민이 강제 환불 가능.</li>
          <li>강제 환불 시 셀러 receivable 회수 + 어드민 audit_log 기록.</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제6조 (인플루언서 관리)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>셀러는 <code>/seller/marketing</code> 페이지에서:
            <ul className="list-disc pl-5 mt-1">
              <li>전체 referral 마케팅 ON/OFF</li>
              <li>특정 인플 차단 (사유 필수)</li>
              <li>우대 commission 협업 deal 제안</li>
            </ul>
          </li>
          <li>차단 시점까지 발생한 commission 은 그대로 인플에게 지급 (인플 신뢰 보호).</li>
          <li>부당 차단으로 인플이 분쟁 신고 시 어드민 조정 수용 의무.</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제7조 (금지 사항)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>네이버 쇼핑라이브 / 카카오 쇼핑라이브 등 직접 경쟁 플랫폼 동시 송출 금지.</li>
          <li>위반 시 정산 5% 추가 차감 + 적발 횟수에 따라 계정 정지.</li>
          <li>허위 매출 (자기 결제), voucher 위조, 사용자 신상 유출 등 금지.</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제7조의2 (적립금 → KT Alpha 기프티쇼 교환권 정산 — 비사업자 선택지)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>사업자등록을 하지 않은 셀러(개인)의 경우, 현금 정산 대신 본인 적립금에서 차감하여 <strong>KT Alpha (기프티쇼) 모바일 교환권</strong> 으로 수령하는 옵션을 선택할 수 있습니다.</li>
          <li>본 옵션은 <strong>회사(유어딜)가 자사 비즈머니로 셀러에게 지급</strong> 하는 B2B 정산 수단이며, 최종 소비자가 교환권을 직접 구매하는 구조가 아닙니다.</li>
          <li><strong>유효기간 30일 고정</strong> — 발행일로부터 30일이며 연장 / 환불 / 취소가 불가합니다 (KT Alpha B2B 쿠폰 정책).</li>
          <li>발송 대상 휴대폰은 <strong>회원가입 시 등록한 본인 명의 휴대폰으로 한정</strong> 됩니다. 타인 명의 휴대폰 발송은 시스템적으로 차단됩니다.</li>
          <li>차감액 = KT Alpha 공급가 × (1 + 운영 마진율) × 수량. 마진율은 어드민이 5% 기본값으로 운영하며 변경 시 사전 고지합니다.</li>
          <li>발송 직전 모달에서 위 사항들에 대한 셀러의 동의 확인을 받으며, 동의 없이는 발송이 진행되지 않습니다.</li>
          <li>본 옵션 사용은 자사 비즈머니 잔액에 의존하며, 잔액 부족 시 일시 중단될 수 있습니다 (어드민이 사전 공지).</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제8조 (계정 종료)</h2>
        <p className="text-sm">셀러는 언제든 입점 종료 가능. 단 active voucher 가 있는 경우 모두 사용 / 환불 처리 후 종료.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">제9조 (분쟁 해결)</h2>
        <p className="text-sm">본 약관 관련 분쟁은 회사 본점 소재지 관할 법원을 1심 법원으로 합니다.</p>

        <p className="text-[11px] text-gray-400 mt-10">⚠️ 본 약관은 초안이며, 실제 시행 전 법무 검토가 필요합니다.</p>
      </div>
    </div>
  )
}
