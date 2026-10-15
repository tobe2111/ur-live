/**
 * 🛡️ 2026-05-16: 공동구매 사용자 약관 (이용권 / voucher 사용 / 환불 / 추천 링크).
 * 🗑️ 2026-10-15: "referral 보너스" 는 제도 자체가 없다 — 제5조 주석 참조.
 *
 * ⚠️ 법무 검토 필수.
 */

import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'

// 메타 SSOT — 서버(비-JS 크롤러)와 같은 표를 읽는다.
const SEO_META = CONSUMER_SURFACE_SEO['/terms/group-buy']

export default function GroupBuyTermsPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-white dark:bg-[#11141C] pb-20">
      <SEO title={SEO_META.title} description={SEO_META.description} url="/terms/group-buy" />
      <div className="sticky top-0 z-40 bg-white/90 dark:bg-[#11141C]/90 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35]">
        <div className="ur-content-medium flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="text-gray-900 dark:text-white"><ChevronLeft className="w-6 h-6" /></button>
          <h1 className="text-[17px] font-bold text-gray-900 dark:text-white">공동구매 약관</h1>
          <div className="w-6" />
        </div>
      </div>

      <div className="ur-content-medium px-5 pt-6 prose prose-sm max-w-none dark:prose-invert">
        <p className="text-[12px] text-gray-400 dark:text-gray-500 mb-6">최종 수정일: 2026년 5월 16일 (초안 — 법무 검토 전)</p>

        <h2 className="text-[17px] font-bold mt-4 mb-2">제1조 (목적)</h2>
        <p className="text-[15px]">본 약관은 유어딜 (이하 "회사") 이용권 공동구매 서비스 이용자 (이하 "사용자") 의 결제·voucher 사용·환불·추천 링크를 규정합니다.</p>

        <h2 className="text-[17px] font-bold mt-6 mb-2">제2조 (결제 및 voucher 발급)</h2>
        <ul className="text-[15px] list-disc pl-5 space-y-1">
          <li>딜 포인트 또는 카드 결제 (Toss Payments).</li>
          <li>결제 즉시 voucher 발급 — 마이페이지 → 이용권 메뉴에서 확인.</li>
          <li>voucher 유효기간 보통 90일 (매장별 상이, 결제 화면에 명시).</li>
        </ul>

        <h2 className="text-[17px] font-bold mt-6 mb-2">제3조 (voucher 사용)</h2>
        <ul className="text-[15px] list-disc pl-5 space-y-1">
          <li>매장에 QR 코드 또는 코드 직접 보여줌 → 매장이 사용 처리.</li>
          <li>사용 처리 후 변경 / 환불 불가.</li>
          <li>유효기간 내 미사용 → 만료 시 결제 수단으로 전액 자동 환불 (딜 결제는 딜 포인트, 카드 결제는 카드 결제 취소). 별도 신청 불요.</li>
          <li>부분 사용 시 차액 환불 자동 처리.</li>
        </ul>

        <h2 className="text-[17px] font-bold mt-6 mb-2">제4조 (환불 정책)</h2>
        <ul className="text-[15px] list-disc pl-5 space-y-1">
          <li><strong>사용 전 환불</strong>: voucher 발급(결제) 후 <strong>7일 이내</strong> 미사용 상태에서 전액 환불 가능 (청약철회). 7일 경과 후 미사용분은 유효기간 만료 시 결제 수단으로 자동 환불.</li>
          <li><strong>사용 후 환불</strong>: 매장 음식 / 서비스 문제 시 사용 후 7일 이내 어드민 분쟁 신청. 검토 후 환불.</li>
          <li><strong>공구 미달성 자동 환불</strong>: 공구가 목표 미달성 시 자동 환불 (마감 후 1일 이내).</li>
          <li>매장 강제 종료 / 폐업 시 어드민이 일괄 환불 처리.</li>
        </ul>

        {/* 🗑️ 2026-10-15 (대표 결재 "0.5% 레퍼럴은 아예 없어"): 제5조를 다시 썼다.
            종전 두 줄이 **없는 보상을 약관으로 약속**하고 있었다 — "사용자에게도 0.5% 보너스 즉시 적립" ·
            "매장이 인플을 차단한 경우에도 회사가 보장". 라이브는 `user_referral_bonus_pct` 0 ·
            `influencer_commission_pct` 0 · `invite_reward_enabled` 행 부재이고, 원장
            `point_transactions.type='referral_bonus'` 가 **0행**(한 번도 지급된 적 없음)이다.
            게다가 인플루언서 약관 제3조는 같은 프로그램을 *"현재 운영하지 않습니다"* 라고 적어 뒀다 —
            **두 약관이 서로 반대로** 말하고 있었다(약관은 분쟁 때 꺼내 읽는 문서다).
            🔒 본인 추천 차단은 **지우지 않는다** — 살아 있는 레일(딜 소개비)에 실제로 구현돼 있다
            (`affiliate-credit.ts` self_referral 기록 · `gb-purchase-guards.ts` isSelfReferral).
            대상이 "보너스" 가 아니라 "소개비" 라서 그 말만 고쳤다. */}
        <h2 className="text-[17px] font-bold mt-6 mb-2">제5조 (추천 링크)</h2>
        <ul className="text-[15px] list-disc pl-5 space-y-1">
          <li>회원은 추천 링크 (?ref=) 로 이용권을 소개할 수 있으며, <strong>매장이 그 이용권에 소개비를 걸어 둔 경우에만</strong> 소개비가 적립됩니다 (비율은 매장이 정하고 이용권 상세 화면에 표시됩니다).</li>
          <li><strong>진입한 사용자(구매자)에게 지급되는 추천 보너스는 운영하지 않습니다.</strong></li>
          <li>본인 추천 (?ref=내ID) 차단 — 적발 시 소개비 미지급·회수 + 계정 정지.</li>
        </ul>

        <h2 className="text-[17px] font-bold mt-6 mb-2">제6조 (딜 포인트)</h2>
        <ul className="text-[15px] list-disc pl-5 space-y-1">
          <li>딜 = 회사 사이트 내 결제 수단 (1원 = 1딜).</li>
          <li>현금화 불가 (한국 e-commerce 표준 — 네이버페이 포인트 등 동일).</li>
          <li>충전 딜 미사용분은 충전 후 5년간 보관 (전자상거래법 준수).</li>
          <li>이벤트 / 보너스 딜은 별도 유효기간 (보통 1년).</li>
        </ul>

        <h2 className="text-[17px] font-bold mt-6 mb-2">제7조 (금지 사항)</h2>
        <ul className="text-[15px] list-disc pl-5 space-y-1">
          <li>voucher 양도 / 판매 금지 (본인 사용 only).</li>
          <li>다중 계정 / 부정한 추천 링크 사용 (소개비 편취).</li>
          <li>매장 / 다른 사용자에게 폭언 / 위협 / 명예훼손.</li>
        </ul>

        <h2 className="text-[17px] font-bold mt-6 mb-2">제8조 (회사 책임 한도)</h2>
        <p className="text-[15px]">매장에서 제공한 음식 / 서비스 품질에 대한 1차 책임은 매장에 있습니다. 회사는 분쟁 발생 시 중재 역할을 수행하며, 매장의 고의 / 중과실로 인한 손해는 어드민 판단에 따라 환불 / 보상 처리합니다.</p>

        <h2 className="text-[17px] font-bold mt-6 mb-2">제9조 (분쟁 해결)</h2>
        <p className="text-[15px]">본 약관 관련 분쟁은 사용자 거주지 또는 회사 본점 소재지 관할 법원에서 해결합니다.</p>

        <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-10">⚠️ 본 약관은 초안이며, 실제 시행 전 법무 검토가 필요합니다.</p>
      </div>
    </div>
  )
}
