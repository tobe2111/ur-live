/**
 * 🛡️ 2026-05-16: 공동구매 사용자 약관 (식사권 / voucher 사용 / 환불 / referral 보너스).
 *
 * ⚠️ 법무 검토 필수.
 */

import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'

export default function GroupBuyTermsPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] pb-20">
      <SEO title="공동구매 약관 - 유어딜" description="유어딜 식사권 공동구매 / voucher 사용 / 환불 약관" url="/terms/group-buy" />
      <div className="sticky top-0 z-40 bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-medium flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} className="text-gray-900 dark:text-white"><ChevronLeft className="w-6 h-6" /></button>
          <h1 className="text-[16px] font-bold text-gray-900 dark:text-white">공동구매 약관</h1>
          <div className="w-6" />
        </div>
      </div>

      <div className="ur-content-medium px-5 pt-6 prose prose-sm max-w-none dark:prose-invert">
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-6">최종 수정일: 2026년 5월 16일 (초안 — 법무 검토 전)</p>

        <h2 className="text-lg font-bold mt-4 mb-2">제1조 (목적)</h2>
        <p className="text-sm">본 약관은 유어딜 (이하 "회사") 식사권 공동구매 서비스 이용자 (이하 "사용자") 의 결제·voucher 사용·환불·referral 보너스를 규정합니다.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">제2조 (결제 및 voucher 발급)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>딜 포인트 또는 카드 결제 (Toss Payments).</li>
          <li>결제 즉시 voucher 발급 — 마이페이지 → 식사권 메뉴에서 확인.</li>
          <li>voucher 유효기간 보통 90일 (매장별 상이, 결제 화면에 명시).</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제3조 (voucher 사용)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>매장에 QR 코드 또는 코드 직접 보여줌 → 매장이 사용 처리.</li>
          <li>사용 처리 후 변경 / 환불 불가.</li>
          <li>유효기간 내 미사용 → 자동 만료 + 결제 금액 전액 환불 (딜 포인트).</li>
          <li>부분 사용 시 차액 환불 자동 처리.</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제4조 (환불 정책)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li><strong>사용 전 환불</strong>: 결제 후 voucher 미사용 상태에서 즉시 환불 가능 (딜 포인트 전액).</li>
          <li><strong>사용 후 환불</strong>: 매장 음식 / 서비스 문제 시 사용 후 7일 이내 어드민 분쟁 신청. 검토 후 환불.</li>
          <li><strong>공구 미달성 자동 환불</strong>: 공구가 목표 미달성 시 자동 환불 (마감 후 1일 이내).</li>
          <li>매장 강제 종료 / 폐업 시 어드민이 일괄 환불 처리.</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제5조 (Referral 보너스)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>친구 추천 링크 (?ref=) 로 진입한 사용자가 결제 시 사용자에게도 <strong>0.5% 보너스</strong> 즉시 적립 (딜 포인트).</li>
          <li>매장이 인플을 차단한 경우에도 사용자 보너스는 회사가 보장 (회사 운영비에서 충당).</li>
          <li>본인 추천 (?ref=내ID) 차단 — 적발 시 보너스 회수 + 계정 정지.</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제6조 (딜 포인트)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>딜 = 회사 사이트 내 결제 수단 (1원 = 1딜).</li>
          <li>현금화 불가 (한국 e-commerce 표준 — 네이버페이 포인트 등 동일).</li>
          <li>충전 딜 미사용분은 충전 후 5년간 보관 (전자상거래법 준수).</li>
          <li>이벤트 / referral / 보너스 딜은 별도 유효기간 (보통 1년).</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제7조 (금지 사항)</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>voucher 양도 / 판매 금지 (본인 사용 only).</li>
          <li>다중 계정 / 부정 referral.</li>
          <li>매장 / 다른 사용자에게 폭언 / 위협 / 명예훼손.</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">제8조 (회사 책임 한도)</h2>
        <p className="text-sm">매장에서 제공한 음식 / 서비스 품질에 대한 1차 책임은 매장에 있습니다. 회사는 분쟁 발생 시 중재 역할을 수행하며, 매장의 고의 / 중과실로 인한 손해는 어드민 판단에 따라 환불 / 보상 처리합니다.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">제9조 (분쟁 해결)</h2>
        <p className="text-sm">본 약관 관련 분쟁은 사용자 거주지 또는 회사 본점 소재지 관할 법원에서 해결합니다.</p>

        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-10">⚠️ 본 약관은 초안이며, 실제 시행 전 법무 검토가 필요합니다.</p>
      </div>
    </div>
  )
}
